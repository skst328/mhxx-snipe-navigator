import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircleIcon, CheckIcon, PlayIcon, RotateCcwIcon, SquareIcon, TimerIcon } from 'lucide-react'

import { Countdown } from '@/components/countdown'
import { TimingSettingsFields } from '@/components/timing-settings'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseFrame, showDrift, showFrame } from '@/lib/frame'
import { meldOutcomes } from '@/lib/navi'
import { charmText } from '@/lib/skills'
import type { Target, TimingSettings, Trial } from '@/lib/snipe'
import { scheduleBeeps } from '@/lib/sound'
import { FRAME_MS, splitFrames } from '@/lib/timing'
import type { Outcome, SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 答え合わせで出す、狙いの前後のフレーム数 */
const AROUND = 30

/**
 * 狙いのフレームで錬金するまで: 調合を始めた瞬間から時間を測り、調合スキャンのフレームを入れると、
 * 狙いまでのカウントダウンになる。錬金したら、前後のフレームで出る護石から実際のフレームを選んで記録する。
 * 狙いを変えたときは、呼ぶ側が key を変えて作り直す
 */
export function SnipePanel({
  skills,
  target,
  settings,
  onSettings,
  onRecord,
}: {
  skills: SkillInfo[]
  target: Target
  settings: TimingSettings
  onSettings: (s: TimingSettings) => void
  onRecord: (t: Trial) => void
}) {
  /** 調合を始めた瞬間 (performance.now() の時刻) */
  const [craftStart, setCraftStart] = useState<number | null>(null)
  const [scanText, setScanText] = useState('')
  /** カウントダウンの 0 の瞬間と、始めたときの狙いのフレーム。止まっている間は null */
  const [running, setRunning] = useState<{ zero: number; frame: number } | null>(null)
  // 同じ護石の別のタイミングに切り替えたら、前のタイミングのカウントダウンは止まっているものとする (調合タイマーは残す)
  const zero = running !== null && running.frame === target.frame ? running.zero : null
  const stopBeeps = useRef<() => void>(() => {})

  const scan = parseFrame(scanText)
  // 調合を始めた瞬間の乱数の位置が scan なので、狙いまではそこから (狙い - scan) フレーム
  const zeroAt =
    craftStart !== null && scan !== null ? craftStart + (target.frame - scan + settings.correction) * FRAME_MS : null
  const [now, setNow] = useState(() => performance.now())
  // 過ぎたかどうかの判定のために、ときどき時刻を取り直す
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [])
  const passed = zeroAt !== null && zeroAt <= now

  const stop = useCallback(() => {
    stopBeeps.current()
    setRunning(null)
  }, [])

  const start = () => {
    if (zeroAt === null || passed) return
    stopBeeps.current()
    stopBeeps.current = scheduleBeeps(zeroAt, settings.beepFrom)
    setRunning({ zero: zeroAt, frame: target.frame })
  }

  // 画面を離れたとき、別のタイミングに切り替えたときは、予約した音を止める
  useEffect(() => () => stopBeeps.current(), [target.frame])

  return (
    <div className="space-y-6">
      {/* 広い幅では、調合タイマーとカウントダウンを横に並べる */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <Card>
          <CardHeader>
            <CardTitle>1. 調合タイマー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Elapsed since={craftStart} />
            <div className="flex gap-2">
              {craftStart === null ? (
                <Button className="h-12 flex-1 text-base" onClick={() => setCraftStart(performance.now())}>
                  <TimerIcon />
                  調合開始
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={() => {
                    stop()
                    setCraftStart(null)
                  }}
                >
                  <RotateCcwIcon />
                  やり直す
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
                onChange={(e) => setScanText(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. 錬金まで</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <TimingSettingsFields value={settings} onChange={onSettings} disabled={zero !== null} />
            <Countdown
              target={zero}
              idleFrames={zeroAt === null ? 0 : Math.max(0, Math.round((zeroAt - now) / FRAME_MS))}
              pattern={settings.pattern}
            />
            {passed && zero === null && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertDescription>
                  狙いを{' '}
                  {(() => {
                    const over = splitFrames(Math.round((now - zeroAt!) / FRAME_MS))
                    return `${over.seconds}秒 ${over.frames}F`
                  })()}{' '}
                  過ぎています
                </AlertDescription>
              </Alert>
            )}
            {zero === null ? (
              <Button className="h-14 w-full text-base" onClick={start} disabled={zeroAt === null || passed}>
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

      <Review skills={skills} target={target} correction={settings.correction} onRecord={onRecord} />
    </div>
  )
}

/** 調合を始めてからの時間 (止まっていれば 00:00 00F)。毎フレームの更新は要素を直接書き換える */
function Elapsed({ since }: { since: number | null }) {
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
  }, [since])
  return (
    <p className={cn('text-center font-mono tabular-nums', since === null && 'text-muted-foreground')}>
      <span ref={time} className="text-5xl font-semibold" />
      <span ref={frames} className="ml-2 text-2xl text-muted-foreground" />
    </p>
  )
}

/** 答え合わせ: 狙いの前後で錬金したときに、狙いと同じ鑑定順に出る護石を並べ、出たものを選ぶ */
function Review({
  skills,
  target,
  correction,
  onRecord,
}: {
  skills: SkillInfo[]
  target: Target
  correction: number
  onRecord: (t: Trial) => void
}) {
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const [actualText, setActualText] = useState('')
  const [saved, setSaved] = useState(false)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    meldOutcomes(target.melding, target.frame - AROUND, target.frame + AROUND + 1).then(setOutcomes, () =>
      setOutcomes([]),
    )
  }, [target])

  // 一覧は狙いの行が真ん中に来るようにしておく
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>('[data-target]')
    if (row && list.current)
      list.current.scrollTop = row.offsetTop - list.current.clientHeight / 2 + row.clientHeight / 2
  }, [outcomes])

  const actual = parseFrame(actualText)
  const drift = actual === null ? null : actual - target.frame

  const record = () => {
    if (actual === null) return
    onRecord({ at: Date.now(), target, correction, actual })
    setSaved(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. 答え合わせ</CardTitle>
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
                  onClick={() => {
                    setActualText(String(o.frame))
                    setSaved(false)
                  }}
                  className={cn(
                    'grid w-full grid-cols-[3rem_6.5rem_1fr] items-center gap-2 px-3 py-2 text-left text-sm tabular-nums hover:bg-muted/50',
                    offset === 0 && 'font-semibold text-primary',
                    selected && 'bg-primary/10',
                  )}
                >
                  <span className="text-right font-mono">
                    {offset === 0 ? '±0' : offset > 0 ? `+${offset}` : offset}
                  </span>
                  <span className="font-mono text-muted-foreground">{showFrame(o.frame)}</span>
                  <span>{charm ? charmText(skills, charm.charm) : '―'}</span>
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
              onChange={(e) => {
                setActualText(e.target.value)
                setSaved(false)
              }}
            />
          </div>
          {drift !== null && (
            <p className="pb-1 font-mono text-3xl font-semibold tabular-nums">
              <span className="mr-2 text-sm font-normal text-muted-foreground">ずれ</span>
              <span className={cn(drift === 0 && 'text-success')}>{showDrift(drift)}</span>
            </p>
          )}
        </div>
        <Button onClick={record} disabled={actual === null || saved}>
          {saved && <CheckIcon />}
          {saved ? '記録しました' : '記録に残す'}
        </Button>
      </CardContent>
    </Card>
  )
}
