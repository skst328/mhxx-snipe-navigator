import { expect, test } from 'vitest'

import { charmText, majorSkills, pointsFor, skillName, skillsFor } from './skills'
import type { SkillInfo } from './types'

const skills: SkillInfo[] = [
  { id: 1, name: '連撃', abbr: '連撃', pts1: { min: 1, max: 4 }, pts2: { min: 1, max: 6 } },
  { id: 2, name: '痛撃', abbr: '痛撃', pts1: null, pts2: { min: 1, max: 5 } },
  { id: 3, name: '気まぐれ', abbr: '気紛', pts1: { min: 1, max: 3 }, pts2: null },
]

test('skillName は無いときに「なし」、知らない番号は #番号', () => {
  expect(skillName(skills, 1)).toBe('連撃')
  expect(skillName(skills, null)).toBe('なし')
  expect(skillName(skills, 99)).toBe('#99')
})

test('skillsFor はその欄に出せるスキルだけ', () => {
  expect(skillsFor(skills, 'pts1').map((s) => s.id)).toEqual([1, 3])
  expect(skillsFor(skills, 'pts2').map((s) => s.id)).toEqual([1, 2])
})

test('majorSkills は主要なスキルと keep だけ残す', () => {
  expect(majorSkills(skills).map((s) => s.id)).toEqual([1, 2])
  expect(majorSkills(skills, 3).map((s) => s.id)).toEqual([1, 2, 3])
})

test('pointsFor は範囲の両端を含む', () => {
  expect(pointsFor({ min: 2, max: 4 })).toEqual([2, 3, 4])
  expect(pointsFor(null)).toEqual([])
})

test('charmText は第 2 スキルが無ければ省く', () => {
  expect(charmText(skills, { skill1: 1, pts1: 4, skill2: 2, pts2: 5, slots: 3 })).toBe('連撃4 痛撃5 S3')
  expect(charmText(skills, { skill1: 3, pts1: 2, skill2: null, pts2: null, slots: 0 })).toBe('気まぐれ2 S0')
})
