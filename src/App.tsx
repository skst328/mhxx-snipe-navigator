import { useEffect, useMemo, useState } from 'react'
import { AlertCircleIcon, ChartColumnIcon, CrosshairIcon, DumbbellIcon, SearchIcon, XIcon } from 'lucide-react'

import { PracticePanel } from '@/components/practice-panel'
import { RecordsPanel } from '@/components/records-panel'
import { SnipePanel } from '@/components/snipe-panel'
import { TargetSearch } from '@/components/target-search'
import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { frameToShortTime, showFrame } from '@/lib/frame'
import { loadSkills, type MeldingSkills } from '@/lib/navi'
import { charmText } from '@/lib/skills'
import {
  DEFAULT_SETTINGS,
  gosekiKey,
  MELDING_LABEL,
  targetKey,
  type Goseki,
  type Settings,
  type Target,
  type Trial,
} from '@/lib/snipe'
import { useStored } from '@/lib/storage'
import { cn } from '@/lib/utils'

type Tab = 'target' | 'snipe' | 'records' | 'practice'

const TABS: { value: Tab; label: string; icon: typeof SearchIcon }[] = [
  { value: 'target', label: '検索', icon: SearchIcon },
  { value: 'snipe', label: 'スナイプ', icon: CrosshairIcon },
  { value: 'records', label: '記録', icon: ChartColumnIcon },
  { value: 'practice', label: '練習', icon: DumbbellIcon },
]

export default function App() {
  const [tab, setTab] = useStored<Tab>('tab', 'target')
  const [target, setTarget] = useStored<Target | null>('target-goseki', null)
  const [trials, setTrials] = useStored<Trial[]>('trial-records', [])
  /** 補正や連打などの値 (どのタブで変えても同じ値が変わる) */
  const [settings, setSettings] = useStored<Settings>('snipe-settings', DEFAULT_SETTINGS)
  const changeSettings = (s: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...s }))
  const [favorites, setFavorites] = useStored<Goseki[]>('favorite-goseki-by-melding', [])
  /** 錬金のやり方ごとの、出るスキルとポイントの範囲 (wasm から) */
  const [meldingSkills, setMeldingSkills] = useState<MeldingSkills | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 名前を出すだけなら、どちらの錬金のスキルも引けるように合わせておく */
  const skills = useMemo(() => meldingSkills && [...meldingSkills.juju, ...meldingSkills.halcyon], [meldingSkills])

  useEffect(() => {
    loadSkills().then(setMeldingSkills, (e: Error) => setError(e.message))
  }, [])

  return (
    <>
      {/* 狙いのバー: 画面の上に貼り付け、スクロールしても見えるようにする。狙いがないときは出さない */}
      {target && skills && (
        // 目立つように狙いの色を薄く敷く (下の中身が透けないよう、不透明な背景の上に重ねる)
        <div className="sticky top-0 z-40 border-b border-primary/40 bg-background">
          <div className="bg-primary/10">
            {/* 1 行目に護石・時間・×、2 行目にタイミングのボタン */}
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
              <CrosshairIcon className="size-5 shrink-0 text-primary" />
              {/* 護石と時間をまとめ、入りきらないときは時間だけをこの中で折り返す (× を 1 行目の右端に残す) */}
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
                {/* スマホでは一段小さく (PC では目立つように大きめ) */}
                <span className="text-base font-semibold whitespace-nowrap sm:text-lg">
                  {charmText(skills, target.charm)}
                </span>
                {/* どちらの錬金で狙うのか (間違えると出ない) */}
                <span className="text-sm whitespace-nowrap text-muted-foreground">{MELDING_LABEL[target.melding]}</span>
                <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                  {frameToShortTime(target.frame)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => setTarget(null)}
                aria-label="狙いを外す"
              >
                <XIcon />
              </Button>
              {/* この護石に届く錬金のタイミングを全部並べ、選んだものだけ塗る。押すとそのタイミングに切り替わる。
                  広い幅ではボタンを一回り大きく */}
              <div className="flex w-full flex-wrap gap-1.5" role="radiogroup" aria-label="錬金のタイミング">
                {target.aims.map((a) => {
                  const selected = targetKey(a) === targetKey(target)
                  return (
                    <Button
                      key={targetKey(a)}
                      size="xs"
                      variant={selected ? 'default' : 'outline'}
                      role="radio"
                      aria-checked={selected}
                      className="tabular-nums sm:h-8 sm:px-3 sm:text-sm"
                      onClick={() => setTarget({ ...target, ...a })}
                    >
                      {showFrame(a.frame)}F {a.index}番目
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold tracking-tight sm:text-3xl">MHXX 護石スナイプナビ</span>
              <span className="text-base font-normal whitespace-nowrap text-muted-foreground tabular-nums sm:text-lg">
                v{__APP_VERSION__}
              </span>
            </h1>
          </div>
          <ThemeToggle />
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>読み込めませんでした</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <nav role="tablist" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-md py-1.5 text-xs font-medium sm:flex-row sm:justify-center sm:gap-1.5 sm:py-2 sm:text-sm',
                tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* タブを切り替えても入力や結果が残るように、どのタブも隠すだけにする */}
        {skills && meldingSkills && (
          <>
            <div role="tabpanel" hidden={tab !== 'target'}>
              <TargetSearch
                meldingSkills={meldingSkills}
                skills={skills}
                target={target}
                onTarget={setTarget}
                favorites={favorites}
                onFavorites={setFavorites}
                trials={trials}
              />
            </div>
            <div role="tabpanel" hidden={tab !== 'snipe'}>
              {target ? (
                <SnipePanel
                  // 同じ護石のタイミングを切り替えても、調合タイマーは測り直さない (護石が変わったら作り直す)
                  key={gosekiKey(target)}
                  skills={skills}
                  target={target}
                  settings={settings}
                  onSettings={changeSettings}
                  trials={trials}
                  onRecord={(t) => setTrials((prev) => [t, ...prev])}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">狙いが決まっていません</p>
                    <Button size="sm" onClick={() => setTab('target')}>
                      <SearchIcon />
                      狙いを探す
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
            <div role="tabpanel" hidden={tab !== 'records'}>
              <RecordsPanel skills={skills} trials={trials} target={target} onClear={() => setTrials([])} />
            </div>
            <div role="tabpanel" hidden={tab !== 'practice'}>
              <PracticePanel settings={settings} onSettings={changeSettings} />
            </div>
          </>
        )}
      </main>
    </>
  )
}
