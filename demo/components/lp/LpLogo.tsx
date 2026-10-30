import { Shirt } from "lucide-react";
import { cx } from "@/components/ui/cx";

type Props = {
  // "onLight"：白い面の上／"onNavy"：ネイビーの上（フッター）
  tone: "onLight" | "onNavy";
  className?: string;
};

// 紹介ページ用のロゴ（シャツの線アイコン＋「Apparel Analytics」を横に並べる）
export function LpLogo({ tone, className }: Props) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2.5 font-bold",
        tone === "onNavy" ? "text-on-navy" : "text-brand-navy",
        className,
      )}
    >
      <Shirt aria-hidden="true" className="size-8 shrink-0 md:size-10" strokeWidth={1.5} />
      <span className="text-[17px] md:text-[21px]">Apparel Analytics</span>
    </span>
  );
}
