import { useEffect } from 'react'

/**
 * active の間、画面が消えないようにする (Screen Wake Lock)。使えないブラウザや、電池の節約などで断られたときは
 * 何もしない (端末の設定どおりに消える)。ページが裏に回るとブラウザが外すので、表に戻ったら取り直す
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let done = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        (l) => {
          // 取れる前に終わっていたら、すぐ返す
          if (done) void l.release()
          else lock = l
        },
        () => {},
      )
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [active])
}
