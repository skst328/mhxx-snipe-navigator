import { describe, expect, test } from 'vitest'

import { approximateTime, frameToShortTime, parseFrame, showDrift } from './frame'
import { FPS } from './timing'

describe('frameToShortTime', () => {
  test('0 の上の単位は省く', () => {
    expect(frameToShortTime(0)).toBe('0f')
    expect(frameToShortTime(20)).toBe('20f')
    expect(frameToShortTime(FPS + 3)).toBe('1s 03f')
  })

  test('先頭より後ろの単位は 2 桁にそろえる', () => {
    expect(frameToShortTime(20 * 60 * FPS + 8)).toBe('20m 00s 08f')
  })

  test('日まで出す', () => {
    const seconds = 5 * 86400 + 19 * 3600 + 31 * 60 + 50
    expect(frameToShortTime(seconds * FPS + 20)).toBe('5d 19h 31m 50s 20f')
  })
})

test('approximateTime はいちばん大きい単位で丸める', () => {
  expect(approximateTime(0)).toBe('0秒')
  expect(approximateTime(45 * FPS)).toBe('約45秒')
  expect(approximateTime(90 * FPS)).toBe('約2分')
  expect(approximateTime(2 * 3600 * FPS)).toBe('約2時間')
  expect(approximateTime(3 * 86400 * FPS)).toBe('約3日')
})

describe('parseFrame', () => {
  test('0 以上の整数を読む (カンマと前後の空白は無視する)', () => {
    expect(parseFrame('19000')).toBe(19000)
    expect(parseFrame('1,234,567')).toBe(1234567)
    expect(parseFrame(' 42 ')).toBe(42)
    expect(parseFrame('0')).toBe(0)
  })

  test('読めないものは null', () => {
    expect(parseFrame('')).toBeNull()
    expect(parseFrame('-1')).toBeNull()
    expect(parseFrame('1.5')).toBeNull()
    expect(parseFrame('12a')).toBeNull()
    // 正確に扱えない大きさ
    expect(parseFrame('99999999999999999999')).toBeNull()
  })
})

test('showDrift は + が遅い、0 は ±0F', () => {
  expect(showDrift(0)).toBe('±0F')
  expect(showDrift(2)).toBe('+2F')
  expect(showDrift(-3)).toBe('-3F')
})
