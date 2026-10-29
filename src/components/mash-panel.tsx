import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'

import { IntegerField } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { frameToShortTime, showFrame } from '@/lib/frame'
import { beatsDone, runMetronome, type MetronomeRun } from '@/lib/metronome'
import { mashLanding, type MashSettings, type Target } from '@/lib/snipe'

/** BPM の上限 */
const MAX_BPM = 600

/**
 * 乱数を進める連打: メトロノームを鳴らしながら、決めた回数 (count) を数える。
 * 連打し終えたときの乱数の位置 (推定着地) と、狙いまでの猶予を出す
 */
export function MashPanel({
  target,
  settings,
  onSettings,
  count,
  onCount,
  done,
  onDone,
}: {
  target: Target
  settings: MashSettings
  onSettings: (s: Partial<MashSettings>) => void
  count: number
  onCount: (count: number) => void
  /** 鳴らし終えた (押し終えた) 回数。一時停止したところから続ける */
  done: number
  onDone: (done: number) => void
}) {
  /** 鳴らしている間のメトロノームと、鳴らし始めた回数 */
  const [run, setRun] = useState<{ metronome: MetronomeRun; from: number } | null>(null)

  const { bpm, advance, offset } = settings
  const finished = done >= count
  const landing = mashLanding(settings, count)
  const margin = target.frame - landing

  // 鳴らしている間は、何回目まで鳴ったかを時刻から数え直す (呼ぶ側が保存するので、変わったときだけ知らせる)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })
  useEffect(() => {
    if (!run) return
    let frame = 0
    let last = run.from
    const loop = () => {
      const n = beatsDone(run.metronome, run.from, count, performance.now())
      if (n !== last) {
        last = n
        onDoneRef.current(n)
      }
      if (n >= count) {
        // 決めた回数に届いた。予約はもう終わっているので止めない (止めると、最後の「ポーン」の伸びが切れる)
        setRun(null)
        return
      }
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [run, count])

  // 画面を離れたら止める
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  useEffect(() => () => runRef.current?.metronome.stop(), [])

  const start = () => {
    if (finished) return
    setRun({ metronome: runMetronome(bpm, done, count), from: done })
  }
  const pause = () => {
    run?.metronome.stop()
    setRun(null)
  }
  const reset = () => {
    pause()
    onDone(0)
  }

  // 数え方が変わったら、数え直す
  const change = (s: Partial<MashSettings>) => {
    onSettings(s)
    onDone(0)
  }

  const progress = count > 0 ? done / count : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. 連打</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 狭い幅では 2 つずつ、広い幅では 4 つを 1 行に */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <IntegerField
            id="mash-bpm"
            label="BPM"
            value={bpm}
            min={1}
            max={MAX_BPM}
            onChange={(bpm) => change({ bpm })}
            disabled={!!run}
          />
          <IntegerField
            id="mash-count"
            label="連打回数"
            value={count}
            min={1}
            onChange={(v) => {
              onCount(v)
              onDone(0)
            }}
            disabled={!!run}
          />
          <IntegerField
            id="mash-advance"
            label="1回の進行量 (F)"
            value={advance}
            min={1}
            onChange={(advance) => change({ advance })}
            disabled={!!run}
          />
          <IntegerField
            id="mash-offset"
            label="オフセット (F)"
            value={offset}
            min={0}
            onChange={(offset) => change({ offset })}
            disabled={!!run}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-lg border px-3 py-2.5 tabular-nums">
          <div>
            <dt className="text-xs text-muted-foreground">推定着地</dt>
            {/* 時間はフレームの下の行に (狭い幅で途中から折り返さないように) */}
            <dd className="font-medium">
              約 {showFrame(landing)}F
              <span className="block text-sm font-normal text-muted-foreground">{frameToShortTime(landing)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">狙いまでの猶予</dt>
            {margin >= 0 ? (
              <dd className="font-medium">約 {frameToShortTime(margin)}</dd>
            ) : (
              <dd className="font-medium text-destructive">狙いを {frameToShortTime(-margin)} 越える</dd>
            )}
          </div>
        </dl>

        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">残り</p>
          <p className="font-mono text-6xl font-semibold tabular-nums">
            {count - done}
            <span className="ml-2 text-2xl font-normal text-muted-foreground">回</span>
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {done} / {count} 回目
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        </div>

        <div className="flex gap-2">
          {run ? (
            <Button className="h-14 flex-3 text-base" onClick={pause}>
              <PauseIcon />
              一時停止
            </Button>
          ) : (
            <Button className="h-14 flex-3 text-base" onClick={start} disabled={finished}>
              <PlayIcon />
              {done > 0 && !finished ? '続ける' : '開始'}
            </Button>
          )}
          <Button variant="outline" className="h-14 flex-1" onClick={reset} disabled={done === 0 && !run}>
            <RotateCcwIcon />
            リセット
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
