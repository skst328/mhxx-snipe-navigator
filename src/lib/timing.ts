/** ゲームの 1 秒のフレーム数 (mhxx-rng と同じ) */
export const FPS = 30
/** 1 フレームのミリ秒 */
export const FRAME_MS = 1000 / FPS

/** フレーム数を、秒とそれに満たないフレームに分ける */
export function splitFrames(frames: number): { seconds: number; frames: number } {
  return { seconds: Math.floor(frames / FPS), frames: frames % FPS }
}

/** 入力欄の文字列を整数にする。空や不正なら null */
export function parseInteger(text: string): number | null {
  const value = Number(text.trim())
  return text.trim() !== '' && Number.isInteger(value) ? value : null
}

/** 押したタイミングのずれ (フレーム、+ が遅い) を表示用にする */
export function formatOffset(frames: number): string {
  const rounded = Math.round(frames * 10) / 10
  if (rounded === 0) return '±0.0F'
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}F`
}
