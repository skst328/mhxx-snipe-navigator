let context: AudioContext | null = null

/**
 * 0 になる瞬間 (target、performance.now() の時刻) に向けて、残り from 秒から 1 秒ごとに短い音を鳴らす。
 * 最後 (0 の瞬間) だけ高い音にする。鳴らす時刻は Web Audio に予約するので、画面の描画が遅れても音はずれない。
 * ブラウザは操作の中でしか音を出させないので、ボタンを押したときに呼ぶ。止める関数を返す
 */
export function scheduleBeeps(target: number, from: number): () => void {
  if (from <= 0) return () => {}
  context ??= new AudioContext()
  const ctx = context
  void ctx.resume()
  const oscillators: OscillatorNode[] = []
  for (let k = from; k >= 0; k--) {
    const at = ctx.currentTime + (target - k * 1000 - performance.now()) / 1000
    if (at < ctx.currentTime) continue
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = k === 0 ? 1320 : 880
    gain.gain.setValueAtTime(0.2, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.08)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.08)
    oscillators.push(osc)
  }
  return () => {
    for (const osc of oscillators) {
      try {
        osc.stop()
      } catch {
        // 鳴り終わったものは止められない
      }
    }
  }
}
