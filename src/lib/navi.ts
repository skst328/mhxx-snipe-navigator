// ページ側から Worker (src/workers/navi.worker.ts) に検索を頼む
import type { WorkerRequest, WorkerResponse } from '../workers/navi.worker'
import type { Charm, Compare, Found, Kind, Melding, Outcome, SkillInfo } from './types'

/** 錬金のやり方ごとの、出うるスキルとポイントの範囲 */
export type MeldingSkills = Record<Melding, SkillInfo[]>

/** 頼む内容 (id は call が付ける) */
type Request = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never

type Pending = {
  resolve: (value: WorkerResponse) => void
  reject: (error: Error) => void
  onProgress?: (done: number, total: number) => void
}

let worker: Worker | null = null
let skillsReady: Promise<MeldingSkills> | null = null
const pending = new Map<number, Pending>()
let nextId = 1

function start(): Promise<MeldingSkills> {
  if (skillsReady) return skillsReady
  skillsReady = new Promise((resolveSkills, rejectSkills) => {
    worker = new Worker(new URL('../workers/navi.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      if (message.type === 'ready') {
        resolveSkills(message.skills)
        return
      }
      if (message.type === 'failed') {
        rejectSkills(new Error(`準備に失敗しました (${message.message})`))
        return
      }
      const p = pending.get(message.id)
      if (!p) return
      if (message.type === 'progress') {
        p.onProgress?.(message.done, message.total)
        return
      }
      pending.delete(message.id)
      if (message.type === 'error') p.reject(new Error(message.message))
      else if (message.type === 'cancelled') p.reject(new DOMException('中止しました', 'AbortError'))
      else p.resolve(message)
    }
    worker.onerror = (event) => rejectSkills(new Error(event.message || '準備に失敗しました'))
  })
  return skillsReady
}

function call(
  request: Request,
  options: { onProgress?: Pending['onProgress']; signal?: AbortSignal } = {},
): Promise<WorkerResponse> {
  return start().then(
    () =>
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject, onProgress: options.onProgress })
        options.signal?.addEventListener(
          'abort',
          () => worker!.postMessage({ id: nextId++, type: 'cancel', target: id }),
          {
            once: true,
          },
        )
        worker!.postMessage({ ...request, id } as WorkerRequest)
      }),
  )
}

/** wasm を読み込み、錬金のやり方ごとに出るスキルとポイントの範囲を返す */
export function loadSkills(): Promise<MeldingSkills> {
  return start()
}

/** 位置 [start, end) で、melding の錬金で compare の比べ方で charms のどれかに合う護石を、kinds のどれかの
 * 種類のお守りとして探す (位置の小さい順。多すぎれば打ち切る) */
export async function searchCharms(
  melding: Melding,
  charms: Charm[],
  kinds: Kind[],
  compare: Compare,
  start: number,
  end: number,
  options: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<{ found: Found[]; truncated: boolean }> {
  const r = await call({ type: 'search', melding, charms, kinds, compare, start, end }, options)
  if (r.type !== 'search') throw new Error('検索の応答が不正')
  return { found: r.found, truncated: r.truncated }
}

/** フレーム [start, end) のフレームごとに、melding で錬金したときの結果 */
export async function meldOutcomes(melding: Melding, start: number, end: number): Promise<Outcome[]> {
  const r = await call({ type: 'outcomes', melding, start: Math.max(0, start), end })
  if (r.type !== 'outcomes') throw new Error('応答が不正')
  return r.outcomes
}
