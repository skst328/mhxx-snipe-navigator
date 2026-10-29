import { expect, test } from 'vitest'

import { beatsDone, type MetronomeRun } from './metronome'

// 時刻 1000 に from 拍目を鳴らし、500 ミリ秒ごとに鳴らす
const run: MetronomeRun = { startAt: 1000, intervalMs: 500, stop: () => {} }

test('beatsDone は鳴った瞬間に数を進める', () => {
  expect(beatsDone(run, 0, 10, 999)).toBe(0)
  expect(beatsDone(run, 0, 10, 1000)).toBe(1)
  expect(beatsDone(run, 0, 10, 1499)).toBe(1)
  expect(beatsDone(run, 0, 10, 1500)).toBe(2)
})

test('beatsDone は一時停止したところ (from) から数え、total で頭打ち', () => {
  expect(beatsDone(run, 3, 10, 0)).toBe(3)
  expect(beatsDone(run, 3, 10, 1000)).toBe(4)
  expect(beatsDone(run, 3, 10, 100_000)).toBe(10)
})
