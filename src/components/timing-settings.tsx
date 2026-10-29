import type { ReactNode } from 'react'
import { MinusIcon, PlusIcon } from 'lucide-react'

import { IntegerInput } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PATTERNS } from '@/lib/pattern'
import type { TimingSettings } from '@/lib/snipe'

/** 入力欄の横に置く見出し。どれも同じ幅にして、欄の頭をそろえる (いちばん長い「待機時間補正」に合わせる) */
export const FIELD_LABEL = 'w-22 shrink-0 text-sm font-normal text-muted-foreground'

/**
 * 目押しの設定: 補正・音・合図のパターン (スナイプと練習で共通)。変えた項目だけを渡す。
 * 待機時間補正はスナイプだけで使うので、waitCorrection が false なら出さない
 */
export function TimingSettingsFields({
  id,
  value,
  onChange,
  waitCorrection = true,
  waitCorrectionNote,
  disabled,
}: {
  /** 欄の id の頭 (同じ欄が画面に何組かあるので) */
  id: string
  value: TimingSettings
  onChange: (v: Partial<TimingSettings>) => void
  waitCorrection?: boolean
  /** 待機時間補正のすぐ下に出すもの (補正を決める材料) */
  waitCorrectionNote?: ReactNode
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      {waitCorrection && (
        <CorrectionField
          id={`${id}-wait-correction`}
          label="待機時間補正"
          value={value.waitCorrection}
          onChange={(waitCorrection) => onChange({ waitCorrection })}
          disabled={disabled}
        />
      )}
      {waitCorrection && waitCorrectionNote}
      <CorrectionField
        id={`${id}-sound-correction`}
        label="音ずれ補正"
        value={value.soundCorrection}
        onChange={(soundCorrection) => onChange({ soundCorrection })}
        disabled={disabled}
      />
      <div className="flex items-center gap-2">
        <Label htmlFor={`${id}-beep`} className={FIELD_LABEL}>
          合図の音
        </Label>
        <IntegerInput
          id={`${id}-beep`}
          className="w-16 font-mono"
          value={value.beepFrom}
          min={0}
          onChange={(beepFrom) => onChange({ beepFrom })}
          disabled={disabled}
        />
        <span className="text-sm text-muted-foreground">秒前から</span>
      </div>
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

/** 補正の欄 (F)。スマホの数字のキーボードには「-」が無いことがあるので、− と + のボタンでも 1 ずつ変えられる */
function CorrectionField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(value - 1)}
          disabled={disabled}
          aria-label={`${label}を 1 減らす`}
        >
          <MinusIcon />
        </Button>
        <IntegerInput
          id={id}
          className="w-12 text-center font-mono"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(value + 1)}
          disabled={disabled}
          aria-label={`${label}を 1 増やす`}
        >
          <PlusIcon />
        </Button>
      </div>
      <span className="text-sm text-muted-foreground">F</span>
    </div>
  )
}
