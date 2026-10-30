import { cx } from "@/components/ui/cx";

type Props = {
  className?: string;
  // true：左右を反転する
  flip?: boolean;
};

// 左上に伸びる葉1枚（原点が付け根）。右側の葉は scale(-1,1) で反転して使う
const LEAF = "M0 0 C-26 -6 -40 -30 -42 -56 C-16 -48 -2 -26 0 0Z";
const RIB = "M0 0 C-14 -14 -26 -32 -34 -50";

// 葉の位置：[x, y, 向き（度）, 大きさ, 左右（-1 で反転）]
const LEAVES: Array<[number, number, number, number, 1 | -1]> = [
  [62, 192, -14, 1, 1],
  [62, 170, 12, 0.95, -1],
  [64, 140, -10, 0.9, 1],
  [66, 114, 10, 0.85, -1],
  [70, 82, -8, 0.75, 1],
  [73, 58, 10, 0.65, -1],
  [76, 30, 0, 0.55, 1],
];

// 装飾の葉の線画（飾りだけ。読み上げない）
export function LeafSprig({ className, flip = false }: Props) {
  return (
    <svg
      viewBox="0 0 130 230"
      aria-hidden="true"
      focusable="false"
      className={cx("pointer-events-none select-none stroke-lp-leaf", flip && "-scale-x-100", className)}
      fill="none"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M64 228 C60 170 64 100 78 10" />
      {LEAVES.map(([x, y, angle, scale, side], index) => (
        <g key={index} transform={`translate(${x} ${y}) rotate(${angle}) scale(${side * scale} ${scale})`}>
          <path d={LEAF} className="fill-lp-leaf-fill" />
          <path d={RIB} strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}
