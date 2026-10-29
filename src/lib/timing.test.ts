import { expect, test } from 'vitest'

import { formatOffset, parseInteger, splitFrames } from './timing'

test('splitFrames は秒とそれに満たないフレームに分ける', () => {
  expect(splitFrames(976)).toEqual({ seconds: 32, frames: 16 })
  expect(splitFrames(29)).toEqual({ seconds: 0, frames: 29 })
  expect(splitFrames(30)).toEqual({ seconds: 1, frames: 0 })
})

test('parseInteger は整数だけ読む', () => {
  expect(parseInteger('5')).toBe(5)
  expect(parseInteger(' 12 ')).toBe(12)
  expect(parseInteger('-3')).toBe(-3)
  expect(parseInteger('')).toBeNull()
  expect(parseInteger('  ')).toBeNull()
  expect(parseInteger('1.5')).toBeNull()
  expect(parseInteger('x')).toBeNull()
})

test('formatOffset は小数 1 桁、0 は ±0.0F', () => {
  expect(formatOffset(0.04)).toBe('±0.0F')
  expect(formatOffset(1.26)).toBe('+1.3F')
  expect(formatOffset(-2.04)).toBe('-2.0F')
})
