/**
 * 所持済みの印の王冠 (lucide の王冠に、先の玉と真ん中の宝石を足したもの)。lucide のアイコンと同じく、
 * 色は文字色、大きさと塗りは className で決める。jewel なら真ん中の宝石を赤く塗る
 */
export function OwnedCrownIcon({ className, jewel = false }: { className?: string; jewel?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <circle cx="12" cy="2.2" r="1.3" />
      <circle cx="2.3" cy="4.6" r="1.3" />
      <circle cx="21.7" cy="4.6" r="1.3" />
      <path d="M5 20.5h14" />
      <circle
        cx="12"
        cy="12.5"
        r="1.6"
        strokeWidth={1.2}
        className={jewel ? 'fill-destructive stroke-destructive' : 'fill-none'}
      />
    </svg>
  )
}
