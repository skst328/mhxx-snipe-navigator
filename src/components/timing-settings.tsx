import { IntegerInput } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PATTERNS } from '@/lib/pattern'
import type { TimingSettings } from '@/lib/snipe'

/** 入力欄の横に置く見出し。どれも同じ幅にして、欄の頭をそろえる (いちばん長い「待機時間」に合わせる) */
export const FIELD_LABEL = 'w-16 shrink-0 text-sm font-normal text-muted-foreground'

/** 目押しの設定: 補正・音・合図のパターン (スナイプと練習と設定で共通)。変えた項目だけを渡す */
export function TimingSettingsFields({
  id,
  value,
  onChange,
  disabled,
}: {
  /** 欄の id の頭 (同じ欄が画面に何組かあるので) */
  id: string
  value: TimingSettings
  onChange: (v: Partial<TimingSettings>) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <NumberField
        id={`${id}-correction`}
        label="補正"
        unit="F"
        value={value.correction}
        onChange={(correction) => onChange({ correction })}
        disabled={disabled}
      />
      <NumberField
        id={`${id}-beep`}
        label="音"
        unit="秒前から"
        value={value.beepFrom}
        min={0}
        onChange={(beepFrom) => onChange({ beepFrom })}
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="目押しのパターン">
        {PATTERNS.map((p) => (
          <Button
            key={p.value}
            variant={value.pattern === p.value ? 'default' : 'outline'}
            size="sm"
            role="radio"
            aria-checked={value.pattern === p.value}
            onClick={() => onChange({ pattern: p.value })}
            disabled={disabled}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** 見出しと単位を横に置いた整数の欄 */
function NumberField({
  id,
  label,
  unit,
  value,
  min,
  onChange,
  disabled,
}: {
  id: string
  label: string
  unit: string
  value: number
  min?: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </Label>
      <IntegerInput
        id={id}
        className="w-20 font-mono"
        value={value}
        min={min}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}
