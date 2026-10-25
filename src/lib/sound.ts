let context: AudioContext | null = null

/** 音を鳴らす AudioContext (1 つを使い回す)。ブラウザは操作の中でしか音を出させないので、ボタンを押したときに呼ぶ */
export function audio(): AudioContext {
  context ??= new AudioContext()
  void context.resume()
  return context
}

/** at (AudioContext の時刻) に、音を 1 つ予約する (duration 秒かけて消える)。止めるための OscillatorNode を返す */
export function tone(ctx: AudioContext, at: number, frequency: number, volume = 0.2, duration = 0.08): OscillatorNode {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(volume, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + duration)
  return osc
}

/** 予約した音を止める (鳴り終わったものは止められないので、そのまま) */
export function stopTones(oscillators: Iterable<OscillatorNode>) {
  for (const osc of oscillators) {
    try {
      osc.stop()
    } catch {
      // 鳴り終わったものは止められない
    }
  }
}

/**
 * 0 になる瞬間 (target、performance.now() の時刻) に向けて、残り from 秒から 1 秒ごとに短い音を鳴らす。
 * 最後 (0 の瞬間) だけ高い音にする。鳴らす時刻は Web Audio に予約するので、画面の描画が遅れても音はずれない。
 * ブラウザは操作の中でしか音を出させないので、ボタンを押したときに呼ぶ。止める関数を返す
 */
export function scheduleBeeps(target: number, from: number): () => void {
  if (from <= 0) return () => {}
  const ctx = audio()
  const oscillators: OscillatorNode[] = []
  for (let k = from; k >= 0; k--) {
    const at = ctx.currentTime + (target - k * 1000 - performance.now()) / 1000
    if (at < ctx.currentTime) continue
    oscillators.push(tone(ctx, at, k === 0 ? 1320 : 880))
  }
  return () => stopTones(oscillators)
}
