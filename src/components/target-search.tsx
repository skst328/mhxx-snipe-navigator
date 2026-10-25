import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { AlertCircleIcon, AlertTriangleIcon, LoaderCircleIcon, SearchIcon } from 'lucide-react'

import { SkillCombobox } from '@/components/skill-combobox'
import { TargetTable } from '@/components/target-table'
import { ValueSelect, type Option } from '@/components/value-select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { approximateTime, parseFrame } from '@/lib/frame'
import { searchCharms, type MeldingSkills } from '@/lib/navi'
import { majorSkills, pointsFor, skillsFor, type Slot } from '@/lib/skills'
import { gosekiKey, MELDING_LABEL, targetKey, targetsOf, type Goseki, type Target, type Trial } from '@/lib/snipe'
import type { Compare, Kind, Melding, SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 一度に出す数 */
const PAGE = 50

/** 錬金のやり方ごとの、出るお守りの種類 */
const KINDS: Record<Melding, Option<Kind>[]> = {
  juju: [
    { value: 'weathered', label: '風化' },
    { value: 'worn', label: '古びた' },
  ],
  halcyon: [
    { value: 'worn', label: '古びた' },
    { value: 'shining', label: '光る' },
    { value: 'mystery', label: 'なぞ' },
  ],
}

/** その錬金で出る種類を全部 (お守りの種類の最初の選び方) */
const allKinds = (m: Melding) => KINDS[m].map((k) => k.value)

const MELDINGS: Melding[] = ['juju', 'halcyon']

/** 狙いを決める: 条件で探すか、お気に入りから選ぶ */
export function TargetSearch({
  meldingSkills,
  skills,
  target,
  onTarget,
  favorites,
  onFavorites,
  owned,
  trials,
}: {
  /** 錬金のやり方ごとの、出るスキルとポイントの範囲 (条件の選択肢に使う) */
  meldingSkills: MeldingSkills
  /** どちらの錬金のスキルも入った一覧 (名前を出すのに使う) */
  skills: SkillInfo[]
  target: Target | null
  onTarget: (t: Target) => void
  favorites: Goseki[]
  onFavorites: Dispatch<SetStateAction<Goseki[]>>
  /** 所持済みの護石のキー */
  owned: string[]
  trials: Trial[]
}) {
  const [view, setView] = useState<'search' | 'favorites'>('search')

  // ☆ を押したら、その護石 (どのタイミングの行でも) を入れる・外す (新しく入れたものは先頭に)。
  // 続けて押しても取りこぼさないよう、直前の値から作る
  const toggleFavorite = (t: Target) => {
    const key = gosekiKey(t)
    const { melding, charm, kind, position, aims } = t
    onFavorites((prev) =>
      prev.some((f) => gosekiKey(f) === key)
        ? prev.filter((f) => gosekiKey(f) !== key)
        : [{ melding, charm, kind, position, aims }, ...prev],
    )
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ['search', '条件'],
            ['favorites', `お気に入り (${favorites.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium tabular-nums',
              view === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 切り替えても検索の条件と結果が残るように、隠すだけにする */}
      <div hidden={view !== 'search'}>
        <SearchView
          meldingSkills={meldingSkills}
          skills={skills}
          target={target}
          onTarget={onTarget}
          favorites={favorites}
          onFavorite={toggleFavorite}
          owned={owned}
        />
      </div>
      <div hidden={view !== 'favorites'}>
        {favorites.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">検索結果の ☆ で入れる</p>
            </CardContent>
          </Card>
        ) : (
          // 錬金のやり方ごとに枠を分ける (入っていない錬金の枠は出さない)
          <div className="space-y-4">
            {MELDINGS.map((m) => {
              const inMelding = favorites.filter((f) => f.melding === m)
              if (inMelding.length === 0) return null
              return (
                <section key={m} className="space-y-1.5">
                  <h3 className="text-sm text-muted-foreground">{MELDING_LABEL[m]}</h3>
                  <TargetTable
                    skills={skills}
                    rows={inMelding.flatMap(targetsOf)}
                    target={target}
                    favorites={favorites}
                    onTarget={onTarget}
                    onFavorite={toggleFavorite}
                    owned={owned}
                    extra={{
                      label: '試行',
                      cell: (f) =>
                        String(
                          trials.filter(
                            (t) => gosekiKey(t.target) === gosekiKey(f) && targetKey(t.target) === targetKey(f),
                          ).length,
                        ),
                    }}
                  />
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** 条件で護石を探し、錬金のフレームの一覧を出す */
function SearchView({
  meldingSkills,
  skills: allSkills,
  target,
  onTarget,
  favorites,
  onFavorite,
  owned,
}: {
  meldingSkills: MeldingSkills
  skills: SkillInfo[]
  target: Target | null
  onTarget: (t: Target) => void
  favorites: Goseki[]
  onFavorite: (t: Target) => void
  owned: string[]
}) {
  const [melding, setMelding] = useState<Melding>('juju')
  const [compare, setCompare] = useState<Compare>('atLeast')
  /** スキルの選択肢を主要なものだけにするか */
  const [majorOnly, setMajorOnly] = useState(true)
  /** オンにしているお守りの種類 (このどれかとして出る護石を探す) */
  const [kinds, setKinds] = useState<Kind[]>(() => allKinds('juju'))
  const [skill1, setSkill1] = useState<number | null>(null)
  const [pts1, setPts1] = useState<number | null>(null)
  const [skill2, setSkill2] = useState<number | null>(null)
  const [pts2, setPts2] = useState<number | null>(null)
  const [slots, setSlots] = useState(0)
  const [startText, setStartText] = useState('0')
  const [endText, setEndText] = useState('10000000')
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ rows: Target[]; truncated: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const abort = useRef<AbortController | null>(null)

  /** 選んでいる錬金で出るスキル (条件の選択肢はこの中から) */
  const skills = meldingSkills[melding]
  // 錬金を切り替えたら、出るスキルと種類が変わるので、スキルと種類は選び直してもらう
  const pickMelding = (m: Melding) => {
    setMelding(m)
    setKinds(allKinds(m))
    setSkill1(null)
    setPts1(null)
    setSkill2(null)
    setPts2(null)
  }
  const atLeast = compare === 'atLeast'
  const suffix = atLeast ? ' 以上' : ''
  const range = (id: number | null, slot: Slot) => skills.find((s) => s.id === id)?.[slot]
  /** その欄の選択肢 (主要だけのときも、選んでいるスキルは残す) */
  const choices = (slot: Slot, keep: number | null) =>
    majorOnly ? majorSkills(skillsFor(skills, slot), keep) : skillsFor(skills, slot)
  // スキルを選んだら、ポイントはそのスキルの最小にする (「以上」ならいちばんゆるい値)
  const pickSkill1 = (id: number | null) => {
    setSkill1(id)
    setPts1(range(id, 'pts1')?.min ?? null)
  }
  const pickSkill2 = (id: number | null) => {
    setSkill2(id)
    setPts2(range(id, 'pts2')?.min ?? null)
  }
  const points = (id: number | null, slot: Slot) =>
    pointsFor(range(id, slot)).map((p) => ({ value: p, label: `${p}${suffix}` }))
  const slotOptions: Option<number>[] = [0, 1, 2, 3].map((n) => ({ value: n, label: `${n}${suffix}` }))

  const start = parseFrame(startText)
  const end = parseFrame(endText)
  // 第 1 スキルは「以上」なら問わなくてよい (「一致」では決める)。ただし第 2 スキルも問わないと、
  // スロットだけの条件になって何でも当たるので、検索させない
  const skill1Ready = skill1 === null ? atLeast && skill2 !== null : pts1 !== null
  const canSearch = skill1Ready && start !== null && end !== null && start < end && !searching

  const search = async () => {
    if (!canSearch) return
    setSearching(true)
    setProgress(0)
    setError(null)
    // 前の条件の結果は消す (検索中やエラーのときに、今の条件の結果に見えないように)
    setResult(null)
    const controller = new AbortController()
    abort.current = controller
    try {
      const second = { skill2, pts2: skill2 === null ? null : pts2, slots }
      // 第 1 スキルを問わないときは、選択肢に出している第 1 スキルごとに、その最小のポイント以上で探す
      // (出ない組み合わせは wasm 側で飛ばす)
      const charms =
        skill1 === null
          ? choices('pts1', null).map((s) => ({ skill1: s.id, pts1: s.pts1!.min, ...second }))
          : [{ skill1, pts1: pts1!, ...second }]
      const { found, truncated } = await searchCharms(melding, charms, kinds, compare, start, end, {
        onProgress: (done, total) => setProgress(done / total),
        signal: controller.signal,
      })
      // 同じ護石 (同じ位置・種類) に届く錬金のフレームは、隣どうしに並べてまとめる。
      // まとまりは最初のフレームの順、まとまりの中はフレームの順 (aimpoints は start の小さい順)
      const rows = found
        .map((f): Goseki => ({
          melding,
          charm: f.charm,
          kind: f.kind,
          position: f.position,
          aims: f.aimpoints.map((a) => ({ frame: a.start, index: a.index })),
        }))
        .sort((a, b) => (a.aims[0]?.frame ?? 0) - (b.aims[0]?.frame ?? 0))
        .flatMap(targetsOf)
      setResult({ rows, truncated })
      setShown(PAGE)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // 出ない組み合わせなら、wasm が見出しと種類ごとの理由を改行で区切って返す (選択肢はスキルごとに錬金全体の
      // 範囲から出しているので、組み合わせや種類によっては出ない)
      setError((e as Error).message)
    } finally {
      setSearching(false)
      abort.current = null
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          {/* 錬金のやり方と比べ方は、それぞれ 1 行に。左に薄く見出しを付け、ボタンの頭をそろえる */}
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">錬金の種類</span>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="錬金の種類">
              {MELDINGS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={melding === m ? 'default' : 'outline'}
                  role="radio"
                  aria-checked={melding === m}
                  onClick={() => pickMelding(m)}
                  disabled={searching}
                >
                  {MELDING_LABEL[m]}
                </Button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">検索条件</span>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="検索条件">
              {(
                [
                  ['atLeast', '以上'],
                  ['exact', '一致'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={compare === value ? 'default' : 'outline'}
                  role="radio"
                  aria-checked={compare === value}
                  onClick={() => setCompare(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">スキル</span>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="スキルの選択肢">
              {(
                [
                  [true, '主要'],
                  [false, 'すべて'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={label}
                  size="sm"
                  variant={majorOnly === value ? 'default' : 'outline'}
                  role="radio"
                  aria-checked={majorOnly === value}
                  onClick={() => setMajorOnly(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {/* 錬金の種類・検索条件と、護石の条件の間に区切り線 */}
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <Field label="第1スキル" htmlFor="skill1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <SkillCombobox
                    id="skill1"
                    skills={choices('pts1', skill1)}
                    value={skill1}
                    onChange={pickSkill1}
                    placeholder="スキル"
                    noneLabel={atLeast ? '問わない' : undefined}
                  />
                </div>
                <ValueSelect
                  value={pts1}
                  onChange={setPts1}
                  options={points(skill1, 'pts1')}
                  placeholder="-"
                  className="w-28"
                  disabled={skill1 === null}
                />
              </div>
            </Field>
            <Field label="第2スキル" htmlFor="skill2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <SkillCombobox
                    // 「以上」なら第 2 スキルを問わない、「一致」なら第 2 スキルなし
                    id="skill2"
                    skills={choices('pts2', skill2)}
                    value={skill2}
                    onChange={pickSkill2}
                    noneLabel={atLeast ? '問わない' : 'なし'}
                  />
                </div>
                <ValueSelect
                  value={pts2}
                  onChange={setPts2}
                  options={points(skill2, 'pts2')}
                  placeholder="-"
                  className="w-28"
                  disabled={skill2 === null}
                />
              </div>
            </Field>
            <Field label="スロット">
              <ValueSelect value={slots} onChange={setSlots} options={slotOptions} className="w-full" />
            </Field>
            <Field label="お守りの種類">
              {/* 種類ごとのオン/オフ。オンにした種類のどれかとして出る護石を探す (最後の 1 つは外せない) */}
              <div className="flex flex-wrap gap-1">
                {KINDS[melding].map(({ value, label }) => {
                  const on = kinds.includes(value)
                  return (
                    <Button
                      key={value}
                      variant={on ? 'default' : 'outline'}
                      aria-pressed={on}
                      disabled={on && kinds.length === 1}
                      onClick={() =>
                        setKinds((prev) =>
                          on
                            ? prev.filter((k) => k !== value)
                            : allKinds(melding).filter((k) => k === value || prev.includes(k)),
                        )
                      }
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </Field>
            <Field label="開始フレーム" htmlFor="start">
              <Input
                id="start"
                inputMode="numeric"
                className="font-mono"
                value={startText}
                aria-invalid={start === null}
                onChange={(e) => setStartText(e.target.value)}
              />
            </Field>
            <Field label="終了フレーム" htmlFor="end">
              <Input
                id="end"
                inputMode="numeric"
                className="font-mono"
                value={endText}
                aria-invalid={end === null || (start !== null && end <= start)}
                onChange={(e) => setEndText(e.target.value)}
              />
            </Field>
            {/* 範囲をゲーム開始からの時間でも示す */}
            {start !== null && end !== null && start < end ? (
              <p className="-mt-2 text-sm text-muted-foreground sm:col-span-2">
                ゲーム開始から {approximateTime(start)} 〜 {approximateTime(end)}
              </p>
            ) : (
              <p className="-mt-2 text-sm text-destructive sm:col-span-2">
                {start === null || end === null ? '0 以上の整数' : '終了は開始より後'}
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            {searching ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    {Math.floor(progress * 100)}%
                  </p>
                  <Button variant="outline" size="sm" onClick={() => abort.current?.abort()}>
                    中止
                  </Button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${Math.min(100, progress * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <Button onClick={search} disabled={!canSearch}>
                <SearchIcon />
                検索
              </Button>
            )}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              {/* 1 行目が見出し、2 行目からが理由 */}
              <AlertTitle>{error.split('\n')[0]}</AlertTitle>
              {error.includes('\n') && (
                <AlertDescription>
                  <ul>
                    {error
                      .split('\n')
                      .slice(1)
                      .map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        // 狭い幅では、表が収まるようにカードの内側の余白を詰める
        <Card className="[--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
          <CardHeader>
            <CardTitle>候補</CardTitle>
            {result.rows.length > 0 && (
              <CardDescription>
                {result.rows.length} 件{result.truncated && ' (候補が多すぎるので打ち切り)'}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {result.rows.length === 0 ? (
              <Alert variant="warning">
                <AlertTriangleIcon />
                <AlertTitle>この範囲では見つかりませんでした</AlertTitle>
                <AlertDescription>条件と範囲を確認してください。</AlertDescription>
              </Alert>
            ) : (
              <TargetTable
                // 結果は検索したときの錬金のものなので、名前はどちらの錬金のスキルからでも引けるようにする
                skills={allSkills}
                rows={result.rows.slice(0, shown)}
                target={target}
                favorites={favorites}
                onTarget={onTarget}
                onFavorite={onFavorite}
                owned={owned}
                // 狭い幅では、カードの内側の余白を使って左右いっぱいに広げる (9 桁のフレームでも横にはみ出さないように)
                className="-mx-3 rounded-none border-x-0 sm:mx-0 sm:rounded-lg sm:border-x"
              />
            )}
            {shown < result.rows.length && (
              <Button variant="outline" onClick={() => setShown(shown + PAGE)}>
                さらに表示 (残り {result.rows.length - shown} 件)
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
