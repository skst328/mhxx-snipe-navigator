import { audio, stopTones, tone } from './sound'

/** 最後の拍の手前で、合図の音 (ピッ) にする拍の数 */
const PIPS = 3
/** 押したあとの残りの回数がこれで割り切れる拍は、目印として強拍にする */
const MARK_EVERY = 10
/** ふつうの拍の音の高さと大きさ */
const BEAT = { frequency: 880, volume: 0.25 }
/** 強拍は、ふつうの拍より 4 度上 (高さ 4/3 倍) で、1.5 倍の大きさ */
const ACCENT = { frequency: (BEAT.frequency * 4) / 3, volume: BEAT.volume * 1.5 }
/** 音を予約しておく先の長さ (秒)。これより先は、近づいてから予約する (止めたときにすぐ黙るように) */
const LOOKAHEAD = 0.2
/** 予約の見直しの間隔 (ミリ秒) */
const TICK_MS = 25

/** 鳴らしているメトロノーム。拍の時刻は performance.now() の時刻で持つ (画面はこれから何拍目かを計算する) */
export interface MetronomeRun {
  /** from 拍目 (0 から) を鳴らす瞬間 (performance.now() の時刻) */
  startAt: number
  /** 1 拍の長さ (ミリ秒) */
  intervalMs: number
  stop: () => void
}

/**
 * bpm のテンポで、from 拍目から total 拍目の手前までを鳴らす。終わりが分かるよう、最後の手前の PIPS 拍と
 * 最後の拍だけ音を変える (時報の「ピッ・ピッ・ピッ・ポーン」)。押したあとの残りの回数が 10 で割り切れる拍は、
 * 目印として強拍にする (画面の残りの回数と同じ数え方)。
 * 音は Web Audio に少し先まで予約するので、画面の描画が遅れてもテンポはずれない。ボタンを押したときに呼ぶ
 */
export function runMetronome(bpm: number, from: number, total: number): MetronomeRun {
  const ctx = audio()
  const interval = 60 / bpm
  // 最初の拍は少し先にして、予約が間に合うようにする
  const lead = 0.1
  const ctxStart = ctx.currentTime + lead
  const startAt = performance.now() + lead * 1000
  const scheduled = new Set<OscillatorNode>()
  let next = from
  const schedule = () => {
    while (next < total) {
      const at = ctxStart + (next - from) * interval
      if (at > ctx.currentTime + LOOKAHEAD) break
      // 終わりは時報のように「ピッ・ピッ・ピッ・ポーン」: 最後の手前の 3 拍は高めの短い音、最後の拍は
      // もっと高い音を長く伸ばす。10 回ごとの目印は強拍
      const left = total - 1 - next
      const osc =
        left === 0
          ? tone(ctx, at, 1760, 0.3, 0.8)
          : left <= PIPS
            ? tone(ctx, at, 1320, 0.25)
            : left % MARK_EVERY === 0
              ? tone(ctx, at, ACCENT.frequency, ACCENT.volume)
              : tone(ctx, at, BEAT.frequency, BEAT.volume)
      scheduled.add(osc)
      osc.onended = () => scheduled.delete(osc)
      next++
    }
    if (next >= total) clearInterval(timer)
  }
  const timer = setInterval(schedule, TICK_MS)
  schedule()
  return {
    startAt,
    intervalMs: interval * 1000,
    stop: () => {
      clearInterval(timer)
      stopTones(scheduled)
    },
  }
}

/** 鳴らし始めてから now までに鳴った拍の数 (from 拍目から数えて、total で頭打ち) */
export function beatsDone(run: MetronomeRun, from: number, total: number, now: number): number {
  if (now < run.startAt) return from
  return Math.min(total, from + Math.floor((now - run.startAt) / run.intervalMs) + 1)
}
