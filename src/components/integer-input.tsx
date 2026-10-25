import { useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseInteger } from '@/lib/timing'

/**
 * 整数の入力欄。打ちかけで読めない値 (範囲の外も) のあいだは、前の値のままにする。
 * ほかの欄 (設定と各タブ) で値が変わったら、表示をその値に合わせる
 */
export function IntegerInput({
  value,
  onChange,
  min,
  max,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'min' | 'max'> & {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  const [text, setText] = useState(String(value))
  /** 欄に出している値 (これと違う値が来たら、外で変わったので表示を合わせる) */
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(String(value))
  }
  return (
    <Input
      inputMode="numeric"
      {...props}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const v = parseInteger(e.target.value)
        if (v !== null && (min === undefined || v >= min) && (max === undefined || v <= max)) {
          setShown(v)
          onChange(v)
        }
      }}
    />
  )
}

/** 見出しを上に置いた整数の欄 */
export function IntegerField({
  id,
  label,
  ...props
}: { id: string; label: string } & Omit<ComponentProps<typeof IntegerInput>, 'id'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      <IntegerInput id={id} className="font-mono" {...props} />
    </div>
  )
}
