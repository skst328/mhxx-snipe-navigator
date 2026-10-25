import { Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { showDrift, showFrame } from '@/lib/frame'
import { charmText } from '@/lib/skills'
import { drift, type Trial } from '@/lib/snipe'
import type { SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 挑戦の記録 (新しい順) と、ずれのまとめ */
export function RecordsPanel({
  skills,
  trials,
  onClear,
}: {
  skills: SkillInfo[]
  trials: Trial[]
  onClear: () => void
}) {
  if (trials.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">まだ記録がありません</p>
        </CardContent>
      </Card>
    )
  }
  const drifts = trials.map(drift)
  const mean = drifts.reduce((a, b) => a + b, 0) / drifts.length
  const hits = drifts.filter((d) => d === 0).length
  return (
    <Card>
      <CardHeader>
        <CardTitle>記録</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="試行" value={`${trials.length}`} />
          <Stat label="平均ずれ" value={`${mean > 0 ? '+' : ''}${mean.toFixed(1)}F`} />
          <Stat label="的中" value={`${hits}`} />
        </dl>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums [&_td]:py-1.5 [&_td]:pr-3 [&_th]:pr-3 [&_th]:pb-1 [&_th]:text-left [&_th]:font-normal [&_th]:text-muted-foreground">
            <thead>
              <tr>
                <th>狙い</th>
                <th className="text-right">フレーム</th>
                <th className="text-right">補正</th>
                <th className="text-right">ずれ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {trials.map((t) => {
                const d = drift(t)
                return (
                  <tr key={t.at}>
                    <td className="whitespace-nowrap">{charmText(skills, t.target.charm)}</td>
                    <td className="text-right font-mono">{showFrame(t.target.frame)}</td>
                    <td className="text-right font-mono">{showDrift(t.correction)}</td>
                    <td className={cn('text-right font-mono font-semibold', d === 0 && 'text-success')}>
                      {showDrift(d)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2Icon />
          記録を消す
        </Button>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-2 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
