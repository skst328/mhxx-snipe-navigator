import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon, PartyPopperIcon, PlayIcon, RotateCcwIcon, SquareIcon, TimerIcon } from 'lucide-react'

import { Countdown } from '@/components/countdown'
import { MashPanel } from '@/components/mash-panel'
import { FIELD_LABEL, TimingSettingsFields } from '@/components/timing-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { frameToShortTime, parseFrame, showDrift, showFrame } from '@/lib/frame'
import { meldOutcomes } from '@/lib/navi'
import { charmText } from '@/lib/skills'
import {
  drift,
  gosekiKey,
  mashLanding,
  melded,
  type MashRecord,
  type MeldedTrial,
  type Settings,
  type Target,
  type Trial,
} from '@/lib/snipe'
import { scheduleBeeps } from '@/lib/sound'
import { useStored } from '@/lib/storage'
import { FPS, FRAME_MS, parseInteger, splitFrames } from '@/lib/timing'
import type { Outcome, SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 答え合わせで出す、狙いの前後のフレーム数 */
const AROUND = 30
/** カウントダウンが 0 になってから、0 の表示を残しておく時間 (ミリ秒) */
const FINISHED_HOLD_MS = 1000

/**
 * 1 回の挑戦の途中の値。スマホでほかのアプリに切り替えている間にタブが捨てられても戻せるように保存する。
 * 持つのはいまの護石の分だけで、別の護石に変えたときと「計測を初期化」で消す
 */
interface Progress {
  /** どの護石の挑戦か */
  goseki: string
  /** 連打で鳴らし終えた回数 */
  mashDone: number
  /** 調合タイマーで測った経過 (F、端数込み。止めるまでは null) */
  elapsed: number | null
  scanText: string
  /** カウントダウンの待機時間 (秒とそれに満たないフレーム) */
  waitSecText: string
  waitFrameText: string
  /** 調合タイマーからセットした待機時間の、表示では切り捨てた端数 (F、0 以上 1 未満)。欄を書き換えたら 0 */
  fraction: number
  /** 最後にカウントダウンを始めたときの待機時間・調合を始めたフレーム・連打 (記録に残す) */
  lastStart: Pick<Trial, 'wait' | 'craftStart' | 'mash'>
  /** 超過として記録したときの、調合タイマーの経過と調合スキャンのフレーム (同じものを二重に記録しないように) */
  overshootSaved: string | null
  /** 答え合わせの、錬金したフレームの欄と、記録に残したか */
  actualText: string
  recorded: boolean
}

const freshProgress = (goseki: string): Progress => ({
  goseki,
  mashDone: 0,
  elapsed: null,
  scanText: '',
  waitSecText: '5',
  waitFrameText: '0',
  fraction: 0,
  lastStart: {},
  overshootSaved: null,
  actualText: '',
  recorded: false,
})

/**
 * 狙いのフレームで錬金するまで。
 * 1. 連打: 乱数を狙いの手前まで進める (ゲームを操作しながら使うので、ほかの手順と同じタブに置く)
 * 2. 調合タイマー: 調合を始めると同時に開始し、ホーム画面に戻ると同時に止める (ホーム画面ではゲーム内の時間が
 *    止まる)。調合スキャンのフレーム (調合開始時点) を入れると、
 *    現在フレーム = 調合開始時点のフレーム + タイマーの計測フレーム、待機時間 = 狙い − 現在フレーム を出し、
 *    待機時間をカウントダウンにセットできる
 * 3. カウントダウン: ゲームに戻った瞬間にスタートを押し、待機時間から数える (調合タイマーを使わず、待機時間を自分で
 *    入れてもよい)
 * 4. 答え合わせ: 錬金したら、前後のフレームで出る護石から実際のフレームを選んで記録する
 * 狙いを変えたときは、呼ぶ側が key を変えて作り直す
 */
export function SnipePanel({
  skills,
  target,
  settings,
  onSettings,
  trials,
  onRecord,
}: {
  skills: SkillInfo[]
  target: Target
  settings: Settings
  onSettings: (s: Partial<Settings>) => void
  /** 新しい順 */
  trials: Trial[]
  onRecord: (t: Trial) => void
}) {
  const goseki = gosekiKey(target)
  const [stored, setStored] = useStored<Progress>('snipe-progress', freshProgress(goseki))
  const progress = stored.goseki === goseki ? stored : freshProgress(goseki)
  const update = (p: Partial<Progress>) => setStored((prev) => ({ ...prev, ...p }))
  // 別の護石の値が残っていたら消す (護石を変えると作り直されるので、変えた時点で消える)
  useEffect(() => {
    setStored((prev) => (prev.goseki === goseki ? prev : freshProgress(goseki)))
  }, [goseki, setStored])
  const { elapsed, scanText, waitSecText, waitFrameText, fraction, lastStart, overshootSaved } = progress
  /** 「計測を初期化」を押した回数 (連打のカードを作り直して、鳴らしているメトロノームを止めるのに使う) */
  const [round, setRound] = useState(0)

  /** 調合タイマーを始めた瞬間 (調合を始めた瞬間。performance.now() の時刻)。測っている間だけ持つ */
  const [timerStart, setTimerStart] = useState<number | null>(null)
  /** カウントダウンの 0 の瞬間と、始めたときの狙いのフレーム。止まっている間は null */
  const [running, setRunning] = useState<{ zero: number; frame: number } | null>(null)
  // 同じ護石の別のタイミングに切り替えたら、前のタイミングのカウントダウンは止まっているものとする (調合タイマーは残す)
  const zero = running !== null && running.frame === target.frame ? running.zero : null
  const stopBeeps = useRef<() => void>(() => {})

  const scan = parseFrame(scanText)
  // タイマーを止めたら、現在フレームと待機時間が決まる (計測フレームはタイマーの表示と同じく切り捨て。
  // 切り捨てた端数は、カウントダウンにセットしたときに待機時間から引く)
  const measured = elapsed !== null ? Math.floor(elapsed) : null
  const current = measured !== null && scan !== null ? scan + measured : null
  const wait = current !== null ? target.frame - current : null

  const waitSec = parseInteger(waitSecText)
  const waitFrame = parseInteger(waitFrameText)
  const waitValid = waitSec !== null && waitSec >= 0 && waitFrame !== null && waitFrame >= 0 && waitFrame < FPS
  /** 連打の回数 (連打のカードで決める。記録にも残す) */
  const [count, setCount] = useStored('mash-count', 100)
  const mash: MashRecord = {
    bpm: settings.bpm,
    advance: settings.advance,
    offset: settings.offset,
    count,
    landing: mashLanding(settings, count),
  }
  const overshootKey = `${elapsed}-${scan}`

  const stop = useCallback(() => {
    stopBeeps.current()
    setRunning(null)
  }, [])

  /** 調合タイマーで出した待機時間を、カウントダウンの欄に入れる */
  const reflect = () => {
    if (wait === null || wait < 0) return
    const w = splitFrames(wait)
    update({ waitSecText: String(w.seconds), waitFrameText: String(w.frames), fraction: elapsed! - measured! })
  }

  /** 1 回の挑戦の途中の値を全部消す (カウントダウンと連打のメトロノームも止める) */
  const reset = () => {
    stop()
    setTimerStart(null)
    setStored(freshProgress(goseki))
    setRound((r) => r + 1)
  }

  // カウントダウンのスタート: 押した瞬間 (ゲームに戻った瞬間) から、待機時間 (と補正) で数える
  const start = () => {
    if (!waitValid) return
    // 待機時間 (調合タイマーからセットしたなら、表示で切り捨てた端数も引く) で数える。
    // 待機時間補正はゲーム側のずれ、音ずれ補正は合図の遅れを打ち消す。どちらも 0 の瞬間をずらす
    const frames = waitSec * FPS + waitFrame - fraction
    const zeroAt = performance.now() + (frames + settings.waitCorrection + settings.soundCorrection) * FRAME_MS
    stopBeeps.current()
    stopBeeps.current = scheduleBeeps(zeroAt, settings.beepFrom)
    setRunning({ zero: zeroAt, frame: target.frame })
    update({ lastStart: { wait: waitSec * FPS + waitFrame, ...(scan !== null && { craftStart: scan }), mash } })
  }

  // 画面を離れたとき、別のタイミングに切り替えたときは、予約した音を止める
  useEffect(() => () => stopBeeps.current(), [target.frame])

  // 0 になったら自動で終える (0 の表示を少し残してから、待機時間の表示とスタートに戻す。音はもう鳴り終わっている)
  useEffect(() => {
    if (zero === null) return
    const timer = setTimeout(() => setRunning(null), Math.max(0, zero - performance.now()) + FINISHED_HOLD_MS)
    return () => clearTimeout(timer)
  }, [zero])

  return (
    <div className="space-y-6">
      {/* 次の挑戦に移るときに、途中の値をまとめて消す (補正や連打の値、記録は残す)。挑戦のたびに押すので、幅いっぱいに置く */}
      <Button variant="secondary" className="h-12 w-full text-base" onClick={reset}>
        <RotateCcwIcon />
        計測を初期化
      </Button>
      <MashPanel
        key={round}
        target={target}
        settings={settings}
        onSettings={onSettings}
        count={count}
        onCount={setCount}
        done={progress.mashDone}
        onDone={(mashDone) => update({ mashDone })}
      />
      {/* 広い幅では、調合タイマーとカウントダウンを横に並べる */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <Card>
          <CardHeader>
            <CardTitle>2. 調合タイマー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Elapsed since={timerStart} stopped={elapsed} />
            {/* 待機中は「調合開始」、計測中は「停止」(ホーム画面に戻ると同時に押す)、止めたら「リセット」まで時間を残す */}
            <div className="flex gap-2">
              {elapsed !== null ? (
                <Button variant="outline" className="h-12 flex-1" onClick={() => update({ elapsed: null })}>
                  <RotateCcwIcon />
                  リセット
                </Button>
              ) : timerStart === null ? (
                <Button className="h-12 flex-1 text-base" onClick={() => setTimerStart(performance.now())}>
                  <TimerIcon />
                  調合開始
                </Button>
              ) : (
                <Button
                  className="h-12 flex-1 text-base"
                  onClick={() => {
                    update({ elapsed: (performance.now() - timerStart) / FRAME_MS })
                    setTimerStart(null)
                  }}
                >
                  <SquareIcon />
                  停止
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scan" className="text-sm font-normal text-muted-foreground">
                調合スキャンのフレーム
              </Label>
              <Input
                id="scan"
                inputMode="numeric"
                className="font-mono"
                value={scanText}
                aria-invalid={scanText !== '' && scan === null}
                onChange={(e) => update({ scanText: e.target.value })}
              />
            </div>
            {/* タイマーを止めて、スキャンのフレームを入れたら、現在フレームと待機時間を出す */}
            {current !== null && wait !== null && (
              <dl className="grid grid-cols-2 gap-3 rounded-lg border px-3 py-2.5 tabular-nums">
                <div>
                  <dt className="text-xs text-muted-foreground">現在フレーム</dt>
                  <dd className="font-medium">{showFrame(current)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">待機時間</dt>
                  {wait >= 0 ? (
                    <dd className="font-medium">{frameToShortTime(wait)}</dd>
                  ) : (
                    <dd className="font-medium text-destructive">狙いを {frameToShortTime(-wait)} 過ぎている</dd>
                  )}
                </div>
              </dl>
            )}
            {/* 連打で狙いを超過した回も、連打の値を合わせる材料として記録できる */}
            {scan !== null && current !== null && wait !== null && wait < 0 && (
              <Button
                variant="outline"
                className="w-full"
                disabled={overshootSaved === overshootKey}
                onClick={() => {
                  onRecord({
                    at: Date.now(),
                    target,
                    waitCorrection: settings.waitCorrection,
                    soundCorrection: settings.soundCorrection,
                    craftStart: scan,
                    reached: current,
                    mash,
                  })
                  update({ overshootSaved: overshootKey })
                }}
              >
                {overshootSaved === overshootKey && <CheckIcon />}
                {overshootSaved === overshootKey ? '記録しました' : '超過として記録'}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={reflect}
              disabled={wait === null || wait < 0 || zero !== null}
            >
              カウントダウンにセット
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. カウントダウン</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 待機時間と目押しの設定は、欄の間を詰めてひとまとまりにする */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="wait-sec" className={FIELD_LABEL}>
                  待機時間
                </Label>
                <Input
                  id="wait-sec"
                  inputMode="numeric"
                  className="w-16 font-mono"
                  value={waitSecText}
                  onChange={(e) => update({ waitSecText: e.target.value, fraction: 0 })}
                  disabled={zero !== null}
                />
                <span className="text-sm text-muted-foreground">秒</span>
                <Input
                  inputMode="numeric"
                  className="w-16 font-mono"
                  value={waitFrameText}
                  onChange={(e) => update({ waitFrameText: e.target.value, fraction: 0 })}
                  disabled={zero !== null}
                  aria-label="待機時間のフレーム"
                />
                <span className="text-sm text-muted-foreground">F</span>
              </div>
              <TimingSettingsFields
                id="snipe"
                value={settings}
                onChange={onSettings}
                disabled={zero !== null}
                waitCorrectionNote={
                  <RecentCorrections
                    trials={trials.filter(melded).filter((t) => gosekiKey(t.target) === gosekiKey(target))}
                  />
                }
              />
            </div>
            {/* スタートを押すまでは待機時間のまま止めておく */}
            <Countdown
              target={zero}
              idleFrames={waitValid ? waitSec * FPS + waitFrame : 0}
              pattern={settings.pattern}
            />
            {!waitValid && <p className="text-sm text-destructive">整数で入力 (F は 0〜29)</p>}
            {zero === null ? (
              <Button className="h-14 w-full text-base" onClick={start} disabled={!waitValid}>
                <PlayIcon />
                スタート
              </Button>
            ) : (
              <Button variant="outline" className="h-14 w-full" onClick={stop}>
                <SquareIcon />
                止める
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Review
        skills={skills}
        target={target}
        corrections={{ waitCorrection: settings.waitCorrection, soundCorrection: settings.soundCorrection }}
        context={lastStart}
        onRecord={onRecord}
        actualText={progress.actualText}
        recorded={progress.recorded}
        onChange={update}
      />
    </div>
  )
}

/**
 * 調合を始めてからの時間 (始める前は 00:00 00F、止めたら測った時間 stopped (F))。毎フレームの更新は要素を直接書き換える
 */
function Elapsed({ since, stopped }: { since: number | null; stopped: number | null }) {
  const time = useRef<HTMLSpanElement>(null)
  const frames = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const draw = (ms: number) => {
      const shown = splitFrames(Math.floor(Math.max(0, ms) / FRAME_MS))
      const m = Math.floor(shown.seconds / 60)
      const s = shown.seconds % 60
      if (time.current) time.current.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      if (frames.current) frames.current.textContent = `${String(shown.frames).padStart(2, '0')}F`
    }
    // 止めたら、測った時間のまま
    if (stopped !== null) {
      draw(stopped * FRAME_MS)
      return
    }
    if (since === null) {
      draw(0)
      return
    }
    let frame = 0
    const loop = () => {
      draw(performance.now() - since)
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [since, stopped])
  return (
    <p
      className={cn(
        'text-center font-mono tabular-nums',
        since === null && stopped === null && 'text-muted-foreground',
      )}
    >
      <span ref={time} className="text-5xl font-semibold" />
      <span ref={frames} className="ml-2 text-2xl text-muted-foreground" />
    </p>
  )
}

/** 答え合わせ: 狙いの前後で錬金したときに、狙いと同じ鑑定順に出る護石を並べ、出たものを選ぶ */
function Review({
  skills,
  target,
  corrections,
  context,
  onRecord,
  actualText,
  recorded,
  onChange,
}: {
  skills: SkillInfo[]
  target: Target
  /** 記録に一緒に残す補正 */
  corrections: Pick<Trial, 'waitCorrection' | 'soundCorrection'>
  /** 記録に一緒に残す、カウントダウンを始めたときの待機時間・調合を始めたフレーム・連打 */
  context: Pick<Trial, 'wait' | 'craftStart' | 'mash'>
  onRecord: (t: Trial) => void
  /** 錬金したフレームの欄と、記録に残したか (呼ぶ側が保存する) */
  actualText: string
  recorded: boolean
  onChange: (p: { actualText?: string; recorded: boolean }) => void
}) {
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    meldOutcomes(target.melding, target.frame - AROUND, target.frame + AROUND + 1).then(setOutcomes, () =>
      setOutcomes([]),
    )
  }, [target])

  // 一覧は狙いの行が真ん中に来るようにしておく。読み込んだときにタブが隠れていると高さが 0 で合わせられないので、
  // 見えて高さが付いたときに合わせる (一度合わせたら、あとは動かさない)
  useEffect(() => {
    const el = list.current
    if (!el) return
    let centered = false
    const center = () => {
      const row = el.querySelector<HTMLElement>('[data-target]')
      if (centered || !row || el.clientHeight === 0) return
      el.scrollTop = row.offsetTop - el.clientHeight / 2 + row.clientHeight / 2
      centered = true
    }
    center()
    const observer = new ResizeObserver(center)
    observer.observe(el)
    return () => observer.disconnect()
  }, [outcomes])

  const actual = parseFrame(actualText)
  const drift = actual === null ? null : actual - target.frame

  const record = () => {
    if (actual === null) return
    onRecord({ at: Date.now(), target, ...corrections, actual, ...context })
    onChange({ recorded: true })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. 答え合わせ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul ref={list} className="relative max-h-80 divide-y overflow-y-auto rounded-lg border">
          {outcomes?.map((o) => {
            const charm = o.charms[target.index - 1]
            const offset = o.frame - target.frame
            const selected = actual === o.frame
            return (
              <li key={o.frame} data-target={offset === 0 ? '' : undefined}>
                <button
                  type="button"
                  onClick={() => onChange({ actualText: String(o.frame), recorded: false })}
                  // 狙いの行は薄く塗って「狙い」と添え、選んだ行は塗りつぶす
                  className={cn(
                    'grid w-full grid-cols-[2.5rem_6rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap tabular-nums',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : offset === 0
                        ? 'bg-primary/15 font-semibold hover:bg-primary/25'
                        : 'hover:bg-muted/50',
                  )}
                >
                  <span className="text-right font-mono">
                    {offset === 0 ? '±0' : offset > 0 ? `+${offset}` : offset}
                  </span>
                  <span className={cn('font-mono', !selected && 'text-muted-foreground')}>{showFrame(o.frame)}F</span>
                  {/* 護石の中身は長いと折り返す (スキル名の途中では折らず、空白のところで) */}
                  <span className="break-keep whitespace-normal">{charm ? charmText(skills, charm.charm) : '―'}</span>
                  <span className={cn('text-xs', !selected && 'text-primary')}>{offset === 0 && '狙い'}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="actual" className="text-sm font-normal text-muted-foreground">
              錬金したフレーム
            </Label>
            <Input
              id="actual"
              inputMode="numeric"
              className="w-40 font-mono"
              value={actualText}
              onChange={(e) => onChange({ actualText: e.target.value, recorded: false })}
            />
          </div>
          {drift !== null && (
            <p className="pb-1 font-mono text-3xl font-semibold tabular-nums">
              <span className="mr-2 text-sm font-normal text-muted-foreground">ずれ</span>
              <span className={cn(drift === 0 && 'text-success')}>{showDrift(drift)}</span>
            </p>
          )}
        </div>
        <Button onClick={record} disabled={actual === null || recorded}>
          {recorded && <CheckIcon />}
          {recorded ? '記録しました' : '記録に残す'}
        </Button>
        {recorded && drift === 0 && (
          <p className="flex w-fit items-center gap-1.5 rounded-full border border-success/50 px-3 py-1 text-sm text-success">
            <PartyPopperIcon className="size-4" />
            おめでとう！記録しました
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** 直近の試行を何回分出すか */
const RECENT = 3

/**
 * この護石の直近の試行の、待機時間補正と結果のズレの組 (新しい順)。次の補正を決める材料にする
 * (どう直すかは使う人が決めるので、平均や当たる補正のような値は出さない)
 */
function RecentCorrections({ trials }: { trials: MeldedTrial[] }) {
  if (trials.length === 0) return null
  return (
    <div className="flex gap-2 text-xs text-muted-foreground">
      <span className={cn(FIELD_LABEL, 'text-xs')}>直近</span>
      <ol className="space-y-0.5 tabular-nums">
        {trials.slice(0, RECENT).map((t) => {
          const d = drift(t)
          return (
            <li key={t.at}>
              補正 {showDrift(t.waitCorrection)} → ズレ{' '}
              <span className={cn(d === 0 ? 'text-success' : 'text-foreground')}>{showDrift(d)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
