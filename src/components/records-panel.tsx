import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CrownIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { frameToShortTime, showDrift, showFrame } from '@/lib/frame'
import { charmText } from '@/lib/skills'
import { drift, gosekiKey, melded, MELDING_LABEL, targetKey, type Target, type Trial } from '@/lib/snipe'
import type { SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 挑戦の記録を、護石ごとに見る (エイムポイントで絞り込める): 試行・平均のズレ・最も近いズレ、ズレの推移のグラフ、
 * 1 回ごとのカード */
export function RecordsPanel({
  skills,
  trials,
  target,
  onClear,
}: {
  skills: SkillInfo[]
  /** 新しい順 */
  trials: Trial[]
  /** 今の狙い (記録があれば、最初はその護石を出す) */
  target: Target | null
  onClear: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  /** 絞り込むエイムポイント (null ならすべて) */
  const [aim, setAim] = useState<string | null>(null)
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
  const group = groups.get(key)!
  // 中身が同じでも乱数の位置が違えば別の護石なので、一覧では最後に狙ったフレームも添えて見分ける
  // (ほかのエイムポイントでも狙っていたら「など」を付ける)
  const options = keys.map((k) => {
    const g = groups.get(k)!
    const t = g[0].target
    const others = new Set(g.map((x) => targetKey(x.target))).size > 1
    return {
      value: k,
      label: `${charmText(skills, t.charm)} ${MELDING_LABEL[t.melding]}`,
      detail: `${showFrame(t.frame)}F${others ? ' など' : ''} ・ ${g.length}回`,
    }
  })

  /** この護石で試したエイムポイント */
  const tried = new Set(group.map((t) => targetKey(t.target)))
  // 別の護石に替えて、絞り込んでいたエイムポイントの記録がなければ、すべてを出す
  const aimKey = aim !== null && tried.has(aim) ? aim : null
  const shown = aimKey === null ? group : group.filter((t) => targetKey(t.target) === aimKey)

  // ズレは錬金まで行った回だけで見る (連打で狙いを超過した回は、試行の数にだけ入る)
  const drifts = shown.filter(melded).map(drift)
  const mean = drifts.length ? drifts.reduce((a, b) => a + b, 0) / drifts.length : null
  const nearest = drifts.length ? drifts.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a)) : null

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">表示する護石</p>
          {/* 閉じている欄には護石の中身だけを出す (どのフレームかは下のエイムポイントで分かる)。開いた一覧は
              2 行にして、フレームと試行の回数を添える */}
          <Select
            items={options}
            value={key}
            onValueChange={(v) => {
              if (v !== null) setSelected(v)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="flex flex-col">
                    <span>{o.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{o.detail}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 押したエイムポイントの記録だけに絞る (「すべて」で戻す)。記録のないエイムポイントは押せない */}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="エイムポイント">
          <AimButton checked={aimKey === null} onClick={() => setAim(null)}>
            すべて
          </AimButton>
          {group[0].target.aims.map((a) => (
            <AimButton
              key={targetKey(a)}
              checked={aimKey === targetKey(a)}
              disabled={!tried.has(targetKey(a))}
              onClick={() => setAim(targetKey(a))}
            >
              {showFrame(a.frame)}F {a.index}番目
            </AimButton>
          ))}
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="試行" value={`${shown.length}回`} />
          <Stat label="平均のズレ" value={mean === null ? '―' : `${mean > 0 ? '+' : ''}${mean.toFixed(1)}F`} />
          <Stat label="最も近い" value={nearest === null ? '―' : showDrift(nearest)} />
        </dl>

        {drifts.length > 0 && <DriftChart drifts={[...drifts].reverse()} />}

        {/* 1 回 1 枚のカード (新しい順)。広い幅では 2 列 */}
        <ol className="grid gap-3 sm:grid-cols-2">
          {/* 番号は絞り込んでも変えない (この護石で何回目か) */}
          {shown.map((t) => (
            <TrialCard key={t.at} trial={t} no={group.length - group.indexOf(t)} />
          ))}
        </ol>

        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2Icon />
          記録を全部消す
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * 1 回分の記録: 1 行目に結果 (錬金まで行った回は実際に錬金したフレームとズレ、連打で狙いを超過した回は「超過」と
 * 越えたフレーム数)、その下に連打の値、調合を始めたフレーム (調合)、待機時間 (錬金まで行った回だけ)。
 * エイムポイントは護石ごとにカードの外に出す。記録に無い項目の行は出さない
 */
function TrialCard({ trial: t, no }: { trial: Trial; no: number }) {
  // 錬金まで行った回だけ、実際に錬金したフレームとズレがある
  const result = melded(t) ? { actual: t.actual, d: drift(t) } : null
  return (
    <li className="rounded-lg border text-sm tabular-nums">
      {/* 1 行目は結果。超過は赤い札、錬金した回はフレームを太く、ズレを札にする。下に区切り線を引いて中身と分ける */}
      <div className="border-b px-3 py-2">
        <p className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">#{no}</span>
          {result === null ? (
            // 錬金した回と同じ形: 大きく狙いを越えたと分かった位置 (調合スキャンのフレーム + 調合タイマーの経過)、
            // 札に「超過」とどれだけ越えたか (狙いとの差)
            <>
              {t.reached !== undefined && <span className="text-base font-semibold">{showFrame(t.reached)}F</span>}
              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-destructive">
                超過{t.reached !== undefined && ` ${showDrift(t.reached - t.target.frame)}`}
              </span>
            </>
          ) : (
            <>
              <span className="text-base font-semibold">{showFrame(result.actual)}F</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                  result.d === 0 ? 'bg-success/15 text-success' : 'bg-muted text-foreground',
                )}
              >
                {result.d === 0 && <CrownIcon className="size-3" aria-label="的中" />}
                {showDrift(result.d)}
              </span>
            </>
          )}
        </p>
      </div>
      {/* 中身は 2 列に並べて行を減らす。連打の値は補足なので小さく薄く */}
      <div className="space-y-1.5 px-3 py-2">
        {t.mash && (
          <p className="text-xs text-muted-foreground">
            連打 {t.mash.bpm}BPM × {t.mash.count}回 進行{t.mash.advance}
            {t.mash.offset !== 0 && ` オフセット${t.mash.offset}`}
          </p>
        )}
        {/* 調合を始めたフレームと待機時間は、錬金まで行った回だけ (超過の回は 1 行目の位置で足りる) */}
        {result !== null && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {t.craftStart !== undefined && <Item label="調合">{showFrame(t.craftStart)}F</Item>}
            <Item label="待機">{t.wait === undefined ? '―' : frameToShortTime(t.wait)}</Item>
          </dl>
        )}
      </div>
    </li>
  )
}

/** 絞り込みのボタン 1 つ (狙いのバーのボタンと同じ形。選んでいるものを塗る) */
function AimButton({
  checked,
  disabled,
  onClick,
  children,
}: {
  checked: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      size="xs"
      variant={checked ? 'default' : 'outline'}
      role="radio"
      aria-checked={checked}
      className="tabular-nums"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/** 1 項目: 左に薄く見出し、右に中身 */
function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

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
