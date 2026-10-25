import { useEffect, useState } from 'react'

/** GitHub Pages では同じユーザーのツールどうしが localStorage を共有するので、ツールの名前を付ける */
const PREFIX = 'mhxx-snipe-navigator:'

function load<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(PREFIX + key)
    return stored === null ? fallback : (JSON.parse(stored) as T)
  } catch {
    // プライベートウィンドウなどでは読めないことがある
    return fallback
  }
}

/** localStorage に残す state (読めなければ fallback。書けなくても画面はそのまま動く) */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback))
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // 保存できなくても、このページを開いている間は使える
    }
  }, [key, value])
  return [value, setValue] as const
}
