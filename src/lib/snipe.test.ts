import { describe, expect, test } from 'vitest'

import { drift, gosekiKey, gosekiOf, mashLanding, melded, targetKey, targetsOf, type Goseki, type Trial } from './snipe'

const goseki: Goseki = {
  melding: 'juju',
  charm: { skill1: 1, pts1: 10, skill2: null, pts2: null, slots: 3 },
  kind: 'worn',
  position: 12345,
  aims: [
    { frame: 20000, index: 1 },
    { frame: 20004, index: 2 },
  ],
}

describe('mashLanding', () => {
  test('1 回ごとに、連打で進む分と 1 拍のあいだに時間で進む分を足す', () => {
    // BPM 60 なら 1 拍 1 秒で 30F 進む
    expect(mashLanding({ bpm: 60, advance: 702, offset: 0 }, 100)).toBe(100 * (702 + 30))
    expect(mashLanding({ bpm: 120, advance: 702, offset: 500 }, 100)).toBe(500 + 100 * (702 + 15))
  })

  test('時間で進む分が割り切れないときは、全体を丸める', () => {
    // 3 × (702 + 1800 / 70) = 2183.14...
    expect(mashLanding({ bpm: 70, advance: 702, offset: 0 }, 3)).toBe(2183)
  })
})

test('targetsOf と gosekiOf で行き来できる', () => {
  const targets = targetsOf(goseki)
  expect(targets.map(targetKey)).toEqual(['20000-1', '20004-2'])
  expect(targets.map(gosekiOf)).toEqual([goseki, goseki])
  // 同じ護石のエイムポイントは、どれも同じ護石のキーになる
  expect(new Set(targets.map(gosekiKey))).toEqual(new Set(['juju-12345-worn']))
})

test('錬金まで行った回だけ drift を出す (+ が遅い)', () => {
  const target = targetsOf(goseki)[0]
  const base: Trial = { at: 0, target, waitCorrection: 0, soundCorrection: 0 }
  const overshoot: Trial = { ...base, reached: 20010 }
  const late: Trial = { ...base, actual: 20001 }
  expect(melded(overshoot)).toBe(false)
  expect(melded(late)).toBe(true)
  expect([late].filter(melded).map(drift)).toEqual([1])
})
