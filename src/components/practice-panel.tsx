import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayIcon, Trash2Icon } from 'lucide-react'

import { Countdown } from '@/components/countdown'
import { PressButton } from '@/components/press-button'
import { FIELD_LABEL, TimingSettingsFields } from '@/components/timing-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PATTERNS, type Pattern } from '@/lib/pattern'
import type { TimingSettings } from '@/lib/snipe'
import { scheduleBeeps } from '@/lib/sound'
import { FPS, FRAME_MS, formatOffset, parseInteger } from '@/lib/timing'
import { useWakeLock } from '@/lib/wake-lock'
import { cn } from '@/lib/utils'

/** 記録をパターンごとに何回分まで残すか */
const HISTORY = 20
/** 0 を過ぎてから押さずにこれだけたったら、押し忘れとして記録せずに終える (ミリ秒) */
const MISS_AFTER_MS = 1000

/** 押したときのずれ (フレーム、+ が遅い) と、そのときの合図のパターン */
interface Press {
  pattern: Pattern
  offset: number
}

/** 目押しの練習: 決めた時間のカウントダウンに合わせて押し、ずれを測る */
export function PracticePanel({
  settings,
  onSettings,
}: {
  settings: TimingSettings
  onSettings: (s: Partial<TimingSettings>) => void
}) {
  const [secondsText, setSecondsText] = useState('5')
  const [framesText, setFramesText] = useState('0')
  /** 0 になる瞬間 (performance.now() の時刻)。止まっている間は null */
  const [target, setTarget] = useState<number | null>(null)
  /** 押した記録。新しい順 */
  const [presses, setPresses] = useState<Press[]>([])
  const stopBeeps = useRef<() => void>(() => {})
  // カウントダウン中は、画面を触らなくても消えないようにする
  useWakeLock(target !== null)

  const seconds = parseInteger(secondsText)
  const frames = parseInteger(framesText)
  const valid = seconds !== null && seconds >= 0 && frames !== null && frames >= 0 && frames < FPS
  const waitFrames = valid ? seconds * FPS + frames : 0

  const stop = useCallback(() => {
    stopBeeps.current()
    setTarget(null)
  }, [])

  useEffect(() => () => stopBeeps.current(), [])

  // 0 を過ぎても押さなかったら、少しして記録せずに終える (押し忘れ。やめるボタンの代わり)
  useEffect(() => {
    if (target === null) return
    const timer = setTimeout(stop, Math.max(0, target - performance.now()) + MISS_AFTER_MS)
    return () => clearTimeout(timer)
  }, [target, stop])

  const start = () => {
    if (!valid) return
    // 音ずれ補正は、0 になる瞬間をずらす量 (+ で遅く、- で早く)
    const next = performance.now() + (waitFrames + settings.soundCorrection) * FRAME_MS
    stopBeeps.current()
    stopBeeps.current = scheduleBeeps(next, settings.beepFrom)
    setTarget(next)
  }

  const press = useCallback(() => {
    if (target === null) return
    const offset = (performance.now() - target) / FRAME_MS
    const { pattern } = settings
    // パターンごとに、新しいほうから HISTORY 回分だけ残す
    setPresses((prev) => {
      const same = prev.filter((p) => p.pattern === pattern)
      const rest = prev.filter((p) => p.pattern !== pattern)
      return [{ pattern, offset }, ...same.slice(0, HISTORY - 1), ...rest]
    })
    stop()
  }, [target, stop, settings])

  // PC ではスペースキーでも押せる (キーを押し下げた瞬間で測る)
  useEffect(() => {
    if (target === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      press()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, press])

  // 記録はパターンごとに分けて見る (パターンによって押し方の癖が違うので)
  const offsetsOf = (pattern: Pattern) => presses.filter((p) => p.pattern === pattern).map((p) => p.offset)
  const current = offsetsOf(settings.pattern)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5">
          {/* 待機時間と目押しの設定は、欄の間を詰めてひとまとまりにする */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className={FIELD_LABEL}>待機時間</Label>
              <Input
                inputMode="numeric"
                className="w-16 font-mono"
                value={secondsText}
                onChange={(e) => setSecondsText(e.target.value)}
                disabled={target !== null}
              />
              <span className="text-sm text-muted-foreground">秒</span>
              <Input
                inputMode="numeric"
                className="w-16 font-mono"
                value={framesText}
                onChange={(e) => setFramesText(e.target.value)}
                disabled={target !== null}
              />
              <span className="text-sm text-muted-foreground">F</span>
            </div>
            <TimingSettingsFields
              id="practice"
              value={settings}
              onChange={onSettings}
              waitCorrection={false}
              disabled={target !== null}
            />
          </div>

          <Countdown target={target} idleFrames={waitFrames} pattern={settings.pattern} />

          {/* スタートと押すは同じ場所に置き、押した瞬間に動かす (離したときに替わったボタンが反応しないように)。
              やめるボタンは置かない (押し間違えるので。押さなければ 0 を過ぎて少しで終わる) */}
          {target === null ? (
            <PressButton className="h-14 w-full text-base" onPress={start} disabled={!valid}>
              <PlayIcon />
              スタート
            </PressButton>
          ) : (
            <PressButton className="h-14 w-full text-lg" onPress={press}>
              押す
            </PressButton>
          )}
          {!valid && <p className="text-sm text-destructive">整数で入力 (F は 0〜29)</p>}
        </CardContent>
      </Card>

      {presses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>練習の記録</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* パターンごとの回数・平均・ばらつき。今のパターンの行は薄く塗る */}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm whitespace-nowrap tabular-nums [&_td]:py-2 [&_th]:pt-2 [&_th]:pb-1.5 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
                <thead className="border-b">
                  <tr>
                    <th className={cn(CELL, 'text-left')}>パターン</th>
                    <th className={cn(COLUMN, 'text-right')}>回数</th>
                    <th className={cn(COLUMN, 'text-right')}>平均</th>
                    <th className={cn(COLUMN, 'text-right')}>ばらつき</th>
                    <th className="w-full" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {PATTERNS.map((p) => {
                    const offsets = offsetsOf(p.value)
                    if (offsets.length === 0) return null
                    const { mean, spread } = stats(offsets)
                    return (
                      <tr key={p.value} className={cn(p.value === settings.pattern && 'bg-primary/10')}>
                        <td className={CELL}>{p.label}</td>
                        <td className={cn(COLUMN, 'text-right')}>{offsets.length}</td>
                        <td className={cn(COLUMN, 'text-right')}>{formatOffset(mean)}</td>
                        <td className={cn(COLUMN, 'text-right')}>{spread === null ? '―' : `±${spread.toFixed(1)}F`}</td>
                        <td />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* 今のパターンの記録 (新しい順)。最後に押したずれは大きく出す */}
            {current.length > 0 && (
              <>
                <p className="text-center font-mono text-4xl tabular-nums">{formatOffset(current[0])}</p>
                <ol className="flex flex-wrap gap-2 font-mono text-sm tabular-nums">
                  {current.map((p, i) => (
                    <li
                      key={current.length - i}
                      className={cn(
                        'rounded-md border px-2 py-0.5',
                        Math.abs(p) < 0.5 && 'border-success text-success',
                      )}
                    >
                      {formatOffset(p)}
                    </li>
                  ))}
                </ol>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setPresses([])}>
              <Trash2Icon />
              記録を消す
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** 表の最初の列と、その後ろの列 (中身の幅に詰め、左に薄い線) */
const CELL = 'w-px px-2 sm:px-3'
const COLUMN = `${CELL} border-l border-border/60`

/** ずれの平均と、ばらつき (標準偏差。1 回だけなら null) */
function stats(offsets: number[]): { mean: number; spread: number | null } {
  const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length
  const spread =
    offsets.length > 1 ? Math.sqrt(offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / (offsets.length - 1)) : null
  return { mean, spread }
}
