import { CrosshairIcon, StarIcon } from 'lucide-react'

import { OwnedCrownIcon } from '@/components/owned-crown-icon'
import { Button } from '@/components/ui/button'
import { frameToShortTime, showFrame } from '@/lib/frame'
import { skillName } from '@/lib/skills'
import { gosekiKey, targetKey, type Goseki, type Target } from '@/lib/snipe'
import type { Charm, SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 護石の中身を、スキルとスロットの列に分けて出す。スキルの列は第 1 スキルと第 2 スキルを 2 行に分ける
 * (正式名称は長いので、横に並べると狭い幅で表がはみ出す。スキル名とポイントは詰める)。
 * どれも狙いを決める条件なので、同じ強さで出す。span 行ぶん縦に結合する */
function CharmCells({ skills, charm, span }: { skills: SkillInfo[]; charm: Charm; span: number }) {
  return (
    <>
      <td rowSpan={span} className={FIRST}>
        <div>
          {skillName(skills, charm.skill1)}
          {charm.pts1}
        </div>
        {charm.skill2 !== null && (
          <div>
            {skillName(skills, charm.skill2)}
            {charm.pts2}
          </div>
        )}
      </td>
      <td rowSpan={span} className={COLUMN}>
        S{charm.slots}
      </td>
    </>
  )
}

/** スキルより後ろの列。見出しと中身の対応が分かるように、左に薄い線を引く。
 * どの列も中身の幅に詰めて左から並べる (余った幅は狙うの手前の空の列が持ち、狙うは右端に置く) */
const COLUMN = 'w-px border-l border-border/60 px-1 sm:px-3'

/** 最初の列 (スキル)。☆ との間も少し空ける */
const FIRST = 'w-px pr-1 pl-1 sm:pr-3 sm:pl-2'

/**
 * 狙いの候補の表: ☆・スキル (第 1 と第 2 を 2 行で)・スロット (ここまで護石ごと) と、錬金のフレーム・時間 (広い幅だけ)・鑑定順・狙う
 * (タイミングごと)。同じ護石の行 (錬金するフレームと鑑定順だけが違うもの) を隣どうしに並べて渡すと、
 * 護石ごとの列を縦に結合して、護石 1 つにタイミングが何行か並ぶ形にする。
 * extra があれば、鑑定順の後ろに列を足す (お気に入りの試行回数など)。
 * ☆ は護石ごと (その護石のタイミング全部が入る)。owned は所持済みの護石のキー (☆ の代わりに王冠を出す)
 */
export function TargetTable({
  skills,
  rows,
  target,
  favorites,
  onTarget,
  onFavorite,
  owned,
  extra,
  className,
}: {
  skills: SkillInfo[]
  rows: Target[]
  target: Target | null
  favorites: Goseki[]
  onTarget: (t: Target) => void
  onFavorite: (t: Target) => void
  owned: string[]
  extra?: { label: string; cell: (t: Target) => string }
  /** 表の枠に足すクラス */
  className?: string
}) {
  const favoriteKeys = new Set(favorites.map(gosekiKey))
  const targetId = target && targetKey(target)
  return (
    <div className={cn('overflow-x-auto rounded-lg border', className)}>
      <table className="w-full text-sm whitespace-nowrap tabular-nums [&_td]:py-2 [&_th]:pt-2 [&_th]:pb-1.5 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
        <thead className="border-b">
          <tr>
            <th className="w-px">
              <span className="sr-only">お気に入り</span>
            </th>
            {/* 見出しの余白と寄せ方は、下の中身の列と同じにする (縦の位置を揃える) */}
            <th className={cn(FIRST, 'text-left')}>スキル</th>
            {/* 狭い幅では見出しを縮める (中身の S3 より見出しのほうが長く、表がはみ出すので) */}
            <th className={cn(COLUMN, 'text-left')}>
              スロ<span className="hidden sm:inline">ット</span>
            </th>
            {/* フレームと時間は桁がそろうように右寄せ */}
            <th className={cn(COLUMN, 'text-right')}>フレーム</th>
            <th className={cn(COLUMN, 'hidden text-right sm:table-cell')}>時間</th>
            <th className={cn(COLUMN, 'text-left')}>鑑定順</th>
            {/* 足した列は、狭い幅では隠す (表が横にはみ出さないように) */}
            {extra && <th className={cn(COLUMN, 'hidden text-right sm:table-cell')}>{extra.label}</th>}
            <th className="w-full" />
            <th className="w-px">
              <span className="sr-only">狙う</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const key = targetKey(r)
            const aimed = key === targetId
            const favorite = favoriteKeys.has(gosekiKey(r))
            // 同じ護石の行のまとまり: 最初の行にだけ護石の列を置き、まとまりの行数ぶん縦に結合する。
            // まとまりの間にだけ横線を引く
            const same = (j: number) => rows[j] !== undefined && gosekiKey(rows[j]) === gosekiKey(r)
            const first = !same(i - 1)
            let span = 1
            while (first && same(i + span)) span++
            // 色はタイミングの欄 (行ごとの欄) にだけ付ける。結合した護石の欄は 1 行目に属するので、行に付けると
            // 1 行目のときだけ護石の欄まで色が付いてしまう。マウスを乗せた行は濃くする (マウスで乗せられる端末だけ)
            const tint = cn('group-hover/row:bg-foreground/10', aimed && 'bg-primary/10 group-hover/row:bg-primary/20')
            return (
              <tr key={key} className={cn('group/row', i > 0 && first && 'border-t')}>
                {first && (
                  <>
                    <td rowSpan={span} className="pl-1">
                      {/* 狭い幅では少し小さくする (表が横にはみ出さないように)。所持済みの護石は ☆ の代わりに王冠を出す
                          (形で所持済み、塗りでお気に入りが分かる。押したときはどちらもお気に入りの出し入れ) */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 sm:size-8"
                        onClick={() => onFavorite(r)}
                        aria-label={favorite ? 'お気に入りから外す' : 'お気に入りに入れる'}
                        aria-pressed={favorite}
                      >
                        {owned.includes(gosekiKey(r)) ? (
                          <OwnedCrownIcon
                            className={cn(favorite ? 'fill-warning text-warning' : 'text-muted-foreground/50')}
                            jewel={favorite}
                          />
                        ) : (
                          <StarIcon
                            className={cn(favorite ? 'fill-warning text-warning' : 'text-muted-foreground/50')}
                          />
                        )}
                      </Button>
                    </td>
                    <CharmCells skills={skills} charm={r.charm} span={span} />
                  </>
                )}
                {/* 数字の幅は表全体の tabular-nums で揃うので、フォントは変えない (表の中で強調の差を付けるのは時間だけ) */}
                <td className={cn(COLUMN, tint, 'text-right')}>{showFrame(r.frame)}</td>
                <td className={cn(COLUMN, tint, 'hidden text-right text-muted-foreground sm:table-cell')}>
                  {frameToShortTime(r.frame)}
                </td>
                <td className={cn(COLUMN, tint)}>{r.index}番目</td>
                {extra && (
                  <td className={cn(COLUMN, tint, 'hidden text-right text-muted-foreground sm:table-cell')}>
                    {extra.cell(r)}
                  </td>
                )}
                <td className={tint} />
                <td className={cn(tint, 'px-1 text-right sm:px-2')}>
                  {/* 狭い幅ではアイコンだけにする (表が横にはみ出さないように) */}
                  <Button
                    size="xs"
                    variant={aimed ? 'default' : 'outline'}
                    onClick={() => onTarget(r)}
                    aria-label={aimed ? '狙い中' : '狙う'}
                  >
                    <CrosshairIcon />
                    <span className="hidden sm:inline">{aimed ? '狙い中' : '狙う'}</span>
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
