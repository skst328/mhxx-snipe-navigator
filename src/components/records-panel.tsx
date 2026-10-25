import { useEffect, useRef, useState } from 'react'
import { CrownIcon, Trash2Icon } from 'lucide-react'

import { ValueSelect } from '@/components/value-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { frameToShortTime, showDrift, showFrame } from '@/lib/frame'
import { charmText } from '@/lib/skills'
import { drift, gosekiKey, MELDING_LABEL, type Target, type Trial } from '@/lib/snipe'
import type { SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 挑戦の記録を、護石ごとに見る: 試行・平均のズレ・最も近いズレ、ズレの推移のグラフ、試行ごとの表 */
export function RecordsPanel({
  skills,
  trials,
  target,
  owned,
  onOwned,
  onClear,
}: {
  skills: SkillInfo[]
  /** 新しい順 */
  trials: Trial[]
  /** 今の狙い (記録があれば、最初はその護石を出す) */
  target: Target | null
  /** 所持済みの護石のキー */
  owned: string[]
  /** 護石の所持済みを付ける・外す */
  onOwned: (key: string) => void
  onClear: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  if (trials.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">まだ記録がありません</p>
        </CardContent>
      </Card>
    )
  }

  // 護石ごとにまとめる (最後に試した順)
  const groups = new Map<string, Trial[]>()
  for (const t of trials) {
    const key = gosekiKey(t.target)
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const keys = [...groups.keys()]
  const fallback = target && groups.has(gosekiKey(target)) ? gosekiKey(target) : keys[0]
  const key = selected !== null && groups.has(selected) ? selected : fallback
  const shown = groups.get(key)!
  const options = keys.map((k) => {
    const t = groups.get(k)![0].target
    return { value: k, label: `${charmText(skills, t.charm)} ${MELDING_LABEL[t.melding]} (${groups.get(k)!.length}回)` }
  })

  const isOwned = owned.includes(key)
  const drifts = shown.map(drift)
  const mean = drifts.reduce((a, b) => a + b, 0) / drifts.length
  const nearest = drifts.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a))

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">表示する護石</p>
          <div className="flex gap-2">
            <ValueSelect value={key} onChange={setSelected} options={options} className="min-w-0 flex-1" />
            {/* 狙っていた護石が出たら付ける (検索とお気に入りの表に王冠が出る)。もう一度押すと外す */}
            <Button
              variant={isOwned ? 'default' : 'outline'}
              className="shrink-0"
              onClick={() => onOwned(key)}
              aria-pressed={isOwned}
            >
              <CrownIcon />
              {isOwned ? '所持済み' : '所持済みにする'}
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="試行" value={`${shown.length}回`} />
          <Stat label="平均のズレ" value={`${mean > 0 ? '+' : ''}${mean.toFixed(1)}F`} />
          <Stat label="最も近い" value={showDrift(nearest)} />
        </dl>

        <DriftChart drifts={[...drifts].reverse()} />

        {/* 検索の表と同じく、列は中身の幅に詰めて左から並べ、薄い縦線で区切る */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm whitespace-nowrap tabular-nums [&_td]:py-2 [&_th]:pt-2 [&_th]:pb-1.5 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
            <thead className="border-b">
              <tr>
                <th className={cn(CELL, 'text-left')}>#</th>
                <th className={cn(COLUMN, 'text-right')}>調合時点</th>
                <th className={cn(COLUMN, 'text-right')}>待機</th>
                <th className={cn(COLUMN, 'text-right')}>補正</th>
                <th className={cn(COLUMN, 'text-right')}>ズレ</th>
                <th className="w-full" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((t, i) => {
                const d = drift(t)
                return (
                  <tr key={t.at}>
                    <td className={CELL}>
                      <span className="inline-flex items-center gap-1">
                        {shown.length - i}
                        {d === 0 && <CrownIcon className="size-3.5 text-success" aria-label="的中" />}
                      </span>
                    </td>
                    <td className={cn(COLUMN, 'text-right')}>{t.current === undefined ? '―' : showFrame(t.current)}</td>
                    <td className={cn(COLUMN, 'text-right')}>
                      {t.wait === undefined ? '―' : frameToShortTime(t.wait)}
                    </td>
                    <td className={cn(COLUMN, 'text-right')}>{showDrift(t.correction)}</td>
                    <td className={cn(COLUMN, 'text-right', d === 0 && 'text-success')}>{showDrift(d)}</td>
                    <td />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2Icon />
          記録を全部消す
        </Button>
      </CardContent>
    </Card>
  )
}

/** 表の最初の列と、その後ろの列 (中身の幅に詰め、左に薄い線)。狭い幅では余白を詰める */
const CELL = 'w-px px-2 sm:px-3'
const COLUMN = `${CELL} border-l border-border/60`

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-2 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** グラフの高さと余白 (px)。幅は表示している幅に合わせる (縮めて描くと文字が小さくなるので) */
const H = 200
const PAD = { left: 36, right: 20, top: 24, bottom: 28 }
/** 点に値を添えるのは、点どうしがこの幅 (px) より離れているとき (近いと重なるので) */
const LABEL_GAP = 36

/** 要素の表示幅 (px) を追いかける */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * ズレの推移 (古い順): 0 の線を真ん中に、遅い (+) は上、早い (−) は下。点の色は遅い・早い・的中で分け、
 * 凡例と値を添える (色だけで見分けさせない)。点に乗せると何回目かとズレが出る
 */
function DriftChart({ drifts }: { drifts: number[] }) {
  const [box, measured] = useWidth<HTMLDivElement>()
  const W = Math.max(240, measured)
  const range = Math.max(3, ...drifts.map(Math.abs))
  const showLabels = drifts.length === 1 || (W - PAD.left - PAD.right) / (drifts.length - 1) >= LABEL_GAP
  const x = (i: number) =>
    drifts.length === 1 ? W / 2 : PAD.left + (i * (W - PAD.left - PAD.right)) / (drifts.length - 1)
  const y = (d: number) => PAD.top + ((range - d) * (H - PAD.top - PAD.bottom)) / (2 * range)
  return (
    <figure className="space-y-2 rounded-lg border px-3 pt-2 pb-3">
      <figcaption className="text-sm text-muted-foreground">ズレの推移</figcaption>
      <div ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block max-w-full"
          role="img"
          aria-label="ズレの推移 (古い順)"
        >
          {/* 目盛り: +範囲・0・−範囲 */}
          {[range, 0, -range].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? 'stroke-border' : 'stroke-border/50'}
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : '4 4'}
              />
              <text
                x={PAD.left - 8}
                y={y(v)}
                dy="0.35em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {v > 0 ? `+${v}` : v}
              </text>
            </g>
          ))}
          {drifts.length > 1 && (
            <polyline
              points={drifts.map((d, i) => `${x(i)},${y(d)}`).join(' ')}
              fill="none"
              className="stroke-muted-foreground/60"
              strokeWidth={2}
            />
          )}
          {drifts.map((d, i) => (
            <g key={i}>
              <title>{`${i + 1}回目 ${showDrift(d)}`}</title>
              {/* 当たり判定は点より大きく */}
              <circle cx={x(i)} cy={y(d)} r={14} fill="transparent" />
              <circle
                cx={x(i)}
                cy={y(d)}
                r={d === 0 ? 7 : 5}
                className={cn('stroke-card', d > 0 ? 'fill-warning' : d < 0 ? 'fill-primary' : 'fill-success')}
                strokeWidth={2}
              />
              {showLabels && (
                <text
                  x={x(i)}
                  y={y(d)}
                  dy={d < 0 ? 20 : -12}
                  textAnchor="middle"
                  className="fill-foreground text-[12px]"
                >
                  {d === 0 ? '的中' : showDrift(d)}
                </text>
              )}
            </g>
          ))}
          <text x={x(0)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            1回目
          </text>
          {drifts.length > 1 && (
            <text x={x(drifts.length - 1)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {drifts.length}回目
            </text>
          )}
        </svg>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <Legend className="bg-warning" label="遅い" />
        <Legend className="bg-primary" label="早い" />
        <Legend className="bg-success" label="的中" />
      </div>
    </figure>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-full', className)} />
      {label}
    </span>
  )
}
