import { useRef, type ComponentProps } from 'react'

import { Button } from '@/components/ui/button'

/** 押してからこれより早いもう一度は無視する (ミリ秒)。慌てて 2 回触れたときや、指がぶれて 2 回入ったときに */
const REPEAT_GUARD_MS = 500

/**
 * タイミングを合わせて押すボタン: 指を離した瞬間ではなく、押した瞬間に動かす (押す長さのばらつきが入らない
 * ように)。押すと別のボタンに替わるので、替わったボタンも押した瞬間だけで動かす (離したときの click が替わった
 * ボタンに届くため)。キーボードの Enter やスペースは click で受ける (キーボードの click は detail が 0)。
 * 押した直後のもう一度は無視する。同じ場所で中身だけ替えて使えば (呼ぶ側で、どの場合もこの部品を同じ位置に
 * 置けば) React は作り直さないので、替わったあとのボタンにも効く
 */
export function PressButton({ onPress, ...props }: ComponentProps<typeof Button> & { onPress: () => void }) {
  const last = useRef(-Infinity)
  const press = (at: number) => {
    if (at - last.current < REPEAT_GUARD_MS) return
    last.current = at
    onPress()
  }
  return (
    <Button
      {...props}
      onPointerDown={(e) => {
        if (e.button === 0) press(e.timeStamp)
      }}
      onClick={(e) => {
        if (e.detail === 0) press(e.timeStamp)
      }}
    />
  )
}
