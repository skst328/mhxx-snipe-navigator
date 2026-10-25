/** 目押しの合図の出し方。どれも秒の区切りの瞬間に合図が中央 (線) に来る */
export type Pattern = 'dot' | 'pendulum' | 'circle'

export const PATTERNS: { value: Pattern; label: string }[] = [
  { value: 'dot', label: '丸' },
  { value: 'pendulum', label: '振り子' },
  { value: 'circle', label: 'サークル' },
]
