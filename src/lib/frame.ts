import { FPS } from './timing'

/** フレームを短い時間の表記にする (「5d 19h 31m 50s 20f」。本家の watch と同じ並びで、0 の上の単位は省く)。
 * 先頭より後ろの単位は 2 桁にそろえる (「20m 00s 08f」。右寄せで並べると単位の位置がそろう) */
export function frameToShortTime(frame: number): string {
  const f = frame % FPS
  const s = Math.floor(frame / FPS)
  const parts: [number, string][] = [
    [Math.floor(s / 86400), 'd'],
    [Math.floor(s / 3600) % 24, 'h'],
    [Math.floor(s / 60) % 60, 'm'],
    [s % 60, 's'],
  ]
  const first = parts.findIndex(([v]) => v > 0)
  const shown: [number, string][] = [...(first < 0 ? [] : parts.slice(first)), [f, 'f']]
  return shown.map(([v, u], i) => `${i === 0 ? v : String(v).padStart(2, '0')}${u}`).join(' ')
}

/** フレームをゲーム開始からの時間としてざっくり表す */
export function approximateTime(frame: number): string {
  if (frame <= 0) return '0秒'
  const seconds = frame / FPS
  if (seconds >= 86400) return `約${Math.round(seconds / 86400)}日`
  if (seconds >= 3600) return `約${Math.round(seconds / 3600)}時間`
  if (seconds >= 60) return `約${Math.round(seconds / 60)}分`
  return `約${Math.round(seconds)}秒`
}

/** フレームの番号として読めれば数、読めなければ null (0 以上の整数。カンマは無視する) */
export function parseFrame(text: string): number | null {
  const t = text.replaceAll(',', '').trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) ? n : null
}

/** フレームの表示 (桁区切りはしない。区切りたくなったらここで変える) */
export const showFrame = (frame: number) => String(frame)

/** ずれ (フレーム、+ が遅い) を「+2F」「±0F」に */
export function showDrift(frames: number): string {
  if (frames === 0) return '±0F'
  return `${frames > 0 ? '+' : ''}${frames}F`
}
