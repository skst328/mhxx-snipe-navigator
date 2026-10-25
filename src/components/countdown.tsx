import { useEffect, useRef } from 'react'

import type { Pattern } from '@/lib/pattern'
import { FRAME_MS, splitFrames } from '@/lib/timing'

/** サークル: 輪が縮み始めてから円に重なるまでの秒数と、円・輪の始まりの半径 */
const APPROACH = 0.5
const CIRCLE_R = 22
const RING_START_R = 58

/**
 * 0 になる瞬間 (target、performance.now() の時刻) までのカウントダウンと、目押しの合図。
 * どのパターンも、1 秒の区切りの瞬間に合図が中央 (線) に来て、最後の区切りが 0。
 * 位置は毎回 performance.now() から計算するので、描画が飛んでもずれは溜まらない。毎フレームの更新は
 * React の再描画を通さず、要素を直接書き換える。target が null なら idleFrames を止めたまま出す
 */
export function Countdown({
  target,
  idleFrames,
  pattern,
}: {
  target: number | null
  idleFrames: number
  pattern: Pattern
}) {
  const seconds = useRef<HTMLSpanElement>(null)
  const frames = useRef<HTMLSpanElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  const circle = useRef<SVGCircleElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const arm = useRef<SVGGElement>(null)

  useEffect(() => {
    const draw = (remainingMs: number) => {
      const left = Math.max(0, remainingMs)
      const shown = splitFrames(Math.floor(left / FRAME_MS))
      if (seconds.current) {
        const m = Math.floor(shown.seconds / 60)
        const s = shown.seconds % 60
        seconds.current.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      }
      if (frames.current) frames.current.textContent = `${String(shown.frames).padStart(2, '0')}F`
      // 残り時間 (秒)。整数になる瞬間が秒の区切り
      const t = left / 1000
      const frac = t - Math.floor(t)
      // 赤丸は左から右へ一定の速さ (1 秒で幅の 2 倍) で流れ、秒の区切りの瞬間に中央を通る。
      // 見えるのは区切りの前後 0.25 秒ずつ
      dot.current?.setAttribute('cx', String(3 * (125 - ((frac * 200 + 75) % 200))))
      // 円は出しっぱなし。次の区切りまで APPROACH 秒を切ると輪が出て、縮んで区切りの瞬間に円に重なる
      if (circle.current && ring.current) {
        ring.current.style.visibility = frac <= APPROACH ? 'visible' : 'hidden'
        ring.current.setAttribute('r', String(CIRCLE_R + (frac / APPROACH) * (RING_START_R - CIRCLE_R)))
        const last = Math.floor(t) === 0
        circle.current.setAttribute('class', last ? 'fill-warning' : 'fill-destructive')
        ring.current.setAttribute('class', last ? 'stroke-warning' : 'stroke-foreground')
      }
      arm.current?.setAttribute('transform', `rotate(${35 * Math.sin(Math.PI * t)} 150 12)`)
    }
    if (target === null) {
      draw(idleFrames * FRAME_MS)
      return
    }
    let frame = 0
    const loop = () => {
      draw(target - performance.now())
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [target, idleFrames, pattern])

  return (
    <div className="space-y-4">
      <p className="text-center font-mono tabular-nums">
        <span ref={seconds} className="text-6xl font-semibold" />
        <span ref={frames} className="ml-2 text-3xl text-muted-foreground" />
      </p>
      <svg viewBox="0 0 300 120" className="mx-auto w-full max-w-md rounded-lg border bg-muted/40" aria-hidden>
        {pattern === 'dot' && (
          <>
            <line x1="150" x2="150" y1="0" y2="120" className="stroke-foreground" strokeWidth="2" />
            <circle ref={dot} cy="60" r="22" className="fill-destructive" />
          </>
        )}
        {pattern === 'pendulum' && (
          <>
            <line x1="150" x2="150" y1="12" y2="112" className="stroke-border" strokeWidth="2" strokeDasharray="4 4" />
            <g ref={arm}>
              <line x1="150" x2="150" y1="12" y2="100" className="stroke-foreground" strokeWidth="2" />
              <circle cx="150" cy="100" r="10" className="fill-destructive" />
            </g>
            <circle cx="150" cy="12" r="3" className="fill-foreground" />
          </>
        )}
        {pattern === 'circle' && (
          <>
            <circle ref={circle} cx="150" cy="60" r={CIRCLE_R} />
            <circle ref={ring} cx="150" cy="60" fill="none" strokeWidth="3" />
          </>
        )}
      </svg>
    </div>
  )
}
