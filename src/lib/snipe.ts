import type { Pattern } from './pattern'
import type { Charm, Kind, Melding } from './types'

/** 錬金のタイミング: 錬金するフレームと、そこで鑑定順の何番目に出るか */
export interface Aim {
  /** 錬金するフレーム */
  frame: number
  /** 鑑定順 (1 から) */
  index: number
}

/** 狙える護石: 錬金のやり方、中身と種類、作られる乱数の位置、そこへ届く錬金のタイミング (フレームの小さい順)。
 * お気に入りはこの単位で持つ */
export interface Goseki {
  melding: Melding
  charm: Charm
  kind: Kind
  /** その護石を作る乱数の始まり */
  position: number
  aims: Aim[]
}

/** 狙い: 護石と、そのタイミングのうち錬金するもの */
export type Target = Goseki & Aim

/** 1 回の挑戦の記録 */
export interface Trial {
  /** 記録した時刻 (Date.now()) */
  at: number
  target: Target
  /** 待機時間補正と音ずれ補正 (F) */
  waitCorrection: number
  soundCorrection: number
  /** 実際に錬金したフレーム */
  actual: number
  /** 調合タイマーで出した現在フレーム (調合タイマーを使っていなければ無い) */
  current?: number
  /** カウントダウンに使った待機時間 (F。カウントダウンを使っていなければ無い) */
  wait?: number
}

/** 目押しの設定 (スナイプと練習で共通。待機時間補正はスナイプだけ) */
export interface TimingSettings {
  pattern: Pattern
  /** 待機時間に足す量 (F、+ で遅く)。ゲーム側のずれを打ち消す */
  waitCorrection: number
  /** 0 になる瞬間の合図 (音と画面) をずらす量 (F、+ で遅く)。端末の音や画面の遅れを打ち消す */
  soundCorrection: number
  /** 音を鳴らし始める残り秒数 */
  beepFrom: number
}

/** 連打の設定 */
export interface MashSettings {
  bpm: number
  /** 1 回で乱数が進む量 (F) */
  advance: number
  /** ゲームを起動してからコンティニューするまでに進むフレーム (連打を始める前の分) */
  offset: number
}

/** 補正や連打などの値 (どのタブで変えても同じ値が変わる) */
export type Settings = TimingSettings & MashSettings

export const DEFAULT_SETTINGS: Settings = {
  pattern: 'dot',
  waitCorrection: 0,
  soundCorrection: 0,
  beepFrom: 5,
  bpm: 60,
  advance: 702,
  offset: 0,
}

export const drift = (t: Trial) => t.actual - t.target.frame

/** 狙いを見分けるキー (錬金するフレームと鑑定順が同じなら、同じ護石の同じタイミング) */
export const targetKey = (t: Aim) => `${t.frame}-${t.index}`

/** 護石を見分けるキー (錬金のやり方・乱数の位置・種類が同じなら、同じ護石) */
export const gosekiKey = (g: Goseki) => `${g.melding}-${g.position}-${g.kind}`

/** 錬金のやり方の名前 (遊んでいる人にはこれで通じる短い呼び方) */
export const MELDING_LABEL: Record<Melding, string> = {
  juju: 'マカ',
  halcyon: '天運',
}

/** 狙いから、護石の部分だけを取り出す */
export const gosekiOf = ({ melding, charm, kind, position, aims }: Target): Goseki => ({
  melding,
  charm,
  kind,
  position,
  aims,
})

/** 護石の各タイミングを、狙いの一覧にする */
export const targetsOf = (g: Goseki): Target[] => g.aims.map((a) => ({ ...g, ...a }))
