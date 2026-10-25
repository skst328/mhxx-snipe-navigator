import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayIcon, SquareIcon, Trash2Icon } from 'lucide-react'

import { Countdown } from '@/components/countdown'
import { FIELD_LABEL, TimingSettingsFields } from '@/components/timing-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TimingSettings } from '@/lib/snipe'
import { scheduleBeeps } from '@/lib/sound'
import { FPS, FRAME_MS, formatOffset, parseInteger } from '@/lib/timing'
import { cn } from '@/lib/utils'

/** 記録を何回分まで出すか */
const HISTORY = 20

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
  /** 押したときのずれ (フレーム、+ が遅い)。新しい順 */
  const [presses, setPresses] = useState<number[]>([])
  const stopBeeps = useRef<() => void>(() => {})

  const seconds = parseInteger(secondsText)
  const frames = parseInteger(framesText)
  const valid = seconds !== null && seconds >= 0 && frames !== null && frames >= 0 && frames < FPS
  const waitFrames = valid ? seconds * FPS + frames : 0

  const stop = useCallback(() => {
    stopBeeps.current()
    setTarget(null)
  }, [])

  useEffect(() => () => stopBeeps.current(), [])

  const start = () => {
    if (!valid) return
    // 補正は、0 になる瞬間をずらす量 (+ で遅く、- で早く)
    const next = performance.now() + (waitFrames + settings.correction) * FRAME_MS
    stopBeeps.current()
    stopBeeps.current = scheduleBeeps(next, settings.beepFrom)
    setTarget(next)
  }

  const press = useCallback(() => {
    if (target === null) return
    const offset = (performance.now() - target) / FRAME_MS
    setPresses((prev) => [offset, ...prev].slice(0, HISTORY))
    stop()
  }, [target, stop])

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

  const mean = presses.length ? presses.reduce((a, b) => a + b, 0) / presses.length : null
  const spread =
    presses.length > 1 && mean !== null
      ? Math.sqrt(presses.reduce((a, b) => a + (b - mean) ** 2, 0) / (presses.length - 1))
      : null

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
                className="w-20 font-mono"
                value={secondsText}
                onChange={(e) => setSecondsText(e.target.value)}
                disabled={target !== null}
              />
              <span className="text-sm text-muted-foreground">秒</span>
              <Input
                inputMode="numeric"
                className="w-20 font-mono"
                value={framesText}
                onChange={(e) => setFramesText(e.target.value)}
                disabled={target !== null}
              />
              <span className="text-sm text-muted-foreground">F</span>
            </div>
            <TimingSettingsFields id="practice" value={settings} onChange={onSettings} disabled={target !== null} />
          </div>

          <Countdown target={target} idleFrames={waitFrames} pattern={settings.pattern} />

          <div className="flex gap-2">
            {target === null ? (
              <Button className="h-14 flex-1 text-base" onClick={start} disabled={!valid}>
                <PlayIcon />
                スタート
              </Button>
            ) : (
              <>
                <Button className="h-14 flex-3 text-lg" onPointerDown={press}>
                  押す
                </Button>
                <Button variant="outline" className="h-14 flex-1" onClick={stop}>
                  <SquareIcon />
                  やめる
                </Button>
              </>
            )}
          </div>
          {!valid && <p className="text-sm text-destructive">整数で入力 (F は 0〜29)</p>}
        </CardContent>
      </Card>

      {presses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>練習の記録</CardTitle>
            <CardDescription>
              {presses.length} 回{mean !== null && `・平均 ${formatOffset(mean)}`}
              {spread !== null && `・ばらつき ${spread.toFixed(1)}F`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-center font-mono text-4xl tabular-nums">{formatOffset(presses[0])}</p>
            <ol className="flex flex-wrap gap-2 font-mono text-sm tabular-nums">
              {presses.map((p, i) => (
                <li
                  key={presses.length - i}
                  className={cn('rounded-md border px-2 py-0.5', Math.abs(p) < 0.5 && 'border-success text-success')}
                >
                  {formatOffset(p)}
                </li>
              ))}
            </ol>
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
