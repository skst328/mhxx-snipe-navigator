import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'

/**
 * タイミングを合わせて押すボタン: 指を離した瞬間ではなく、押した瞬間に動かす (押す長さのばらつきが入らない
 * ように)。押すと別のボタンに替わるので、替わったボタンも押した瞬間だけで動かす (離したときの click が替わった
 * ボタンに届くため)。キーボードの Enter やスペースは click で受ける (キーボードの click は detail が 0)
 */
export function PressButton({ onPress, ...props }: ComponentProps<typeof Button> & { onPress: () => void }) {
  return (
    <Button
      {...props}
      onPointerDown={(e) => {
        if (e.button === 0) onPress()
      }}
      onClick={(e) => {
        if (e.detail === 0) onPress()
      }}
    />
  )
}
