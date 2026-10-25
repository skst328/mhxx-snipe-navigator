// スキルの一覧 (wasm の skillInfo) を、画面の選択肢や表示にする道具
import type { Charm, PointRange, SkillInfo } from './types'

/** 第 1 スキルの欄か、第 2 スキルの欄か */
export type Slot = 'pts1' | 'pts2'

export function skillName(skills: SkillInfo[], id: number | null): string {
  if (id === null) return 'なし'
  return skills.find((s) => s.id === id)?.name ?? `#${id}`
}

/** その欄に出せるスキル */
export function skillsFor(skills: SkillInfo[], slot: Slot): SkillInfo[] {
  return skills.filter((s) => s[slot] !== null)
}

/** ポイントの選択肢 (錬金で出る範囲) */
export function pointsFor(range: PointRange | null | undefined): number[] {
  return range ? Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i) : []
}

/** 護石の中身を 1 行に (「連撃4 痛撃5 S3」) */
export function charmText(skills: SkillInfo[], c: Charm): string {
  const second = c.skill2 === null ? '' : ` ${skillName(skills, c.skill2)}${c.pts2}`
  return `${skillName(skills, c.skill1)}${c.pts1}${second} S${c.slots}`
}
