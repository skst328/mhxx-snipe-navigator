import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PATTERNS } from '@/lib/pattern'
import type { TimingSettings } from '@/lib/snipe'
import { parseInteger } from '@/lib/timing'

/** 目押しの設定: 補正・音・合図のパターン (スナイプと練習で共通) */
export function TimingSettingsFields({
  value,
  onChange,
  disabled,
}: {
  value: TimingSettings
  onChange: (v: TimingSettings) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <NumberField
          id="correction"
          label="補正"
          unit="F"
          value={value.correction}
          onChange={(correction) => onChange({ ...value, correction })}
          disabled={disabled}
        />
        <NumberField
          id="beep"
          label="音"
          unit="秒前から"
          value={value.beepFrom}
          min={0}
          onChange={(beepFrom) => onChange({ ...value, beepFrom })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="目押しのパターン">
        {PATTERNS.map((p) => (
          <Button
            key={p.value}
            variant={value.pattern === p.value ? 'default' : 'outline'}
            size="sm"
            role="radio"
            aria-checked={value.pattern === p.value}
            onClick={() => onChange({ ...value, pattern: p.value })}
            disabled={disabled}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** 整数の入力欄。読めない値のあいだは、前の値のままにする */
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
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        className="w-20 font-mono"
        defaultValue={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const v = parseInteger(e.target.value)
          if (v !== null && (min === undefined || v >= min)) onChange(v)
        }}
      />
      <span className="text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}
