import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import type { SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

/** スキルを名前で絞り込んで選ぶ。noneLabel があれば一覧の先頭にその項目を置き、選ぶと値は null になる
 * (null のあいだは入力欄を空にして noneLabel を薄く出す。押してすぐ打ち始められるように)。
 * attention なら要確認の色にする */
export function SkillCombobox({
  skills,
  value,
  onChange,
  noneLabel,
  placeholder,
  attention = false,
  id,
}: {
  /** 選べるスキル */
  skills: SkillInfo[]
  value: number | null
  onChange: (id: number | null) => void
  noneLabel?: string
  placeholder?: string
  attention?: boolean
  id?: string
}) {
  const allowNone = noneLabel !== undefined
  const NONE: SkillInfo = { id: -1, name: noneLabel ?? '', pts1: null, pts2: null }
  const items = allowNone ? [NONE, ...skills] : skills
  const selected = skills.find((s) => s.id === value) ?? null
  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(s: SkillInfo | null) => onChange(s === null || s.id === NONE.id ? null : s.id)}
      itemToStringLabel={(s: SkillInfo) => s.name}
      isItemEqualToValue={(a: SkillInfo, b: SkillInfo) => a.id === b.id}
    >
      <ComboboxInput
        id={id}
        className={cn('w-full', attention && 'border-warning ring-3 ring-warning/20')}
        placeholder={selected === null && allowNone ? noneLabel : placeholder}
      />
      <ComboboxContent>
        <ComboboxEmpty>見つかりません</ComboboxEmpty>
        <ComboboxList>
          {(s: SkillInfo) => (
            <ComboboxItem key={s.id} value={s}>
              {s.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
