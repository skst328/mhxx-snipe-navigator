import { IntegerField } from '@/components/integer-input'
import { MAX_BPM } from '@/components/mash-panel'
import { TimingSettingsFields } from '@/components/timing-settings'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Settings } from '@/lib/snipe'

/** 設定: 各タブの初期値 (狙いがある間にタブで変えた値は、その狙いの間はそちらを使う) */
export function SettingsDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: Settings
  onChange: (s: Partial<Settings>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            各タブの初期値。狙いがある間にタブで変えた値は、同じ狙いの間はそちらを使う
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y">
          <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <h3 className="text-sm font-medium">連打</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <IntegerField
                id="settings-bpm"
                label="BPM"
                value={value.bpm}
                min={1}
                max={MAX_BPM}
                onChange={(bpm) => onChange({ bpm })}
              />
              <IntegerField
                id="settings-advance"
                label="1回の進行量 (F)"
                value={value.advance}
                min={1}
                onChange={(advance) => onChange({ advance })}
              />
              <IntegerField
                id="settings-offset"
                label="オフセット (F)"
                value={value.offset}
                min={0}
                onChange={(offset) => onChange({ offset })}
              />
            </div>
          </section>
          <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <h3 className="text-sm font-medium">カウントダウン</h3>
            <TimingSettingsFields id="settings" value={value} onChange={onChange} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
