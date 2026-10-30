import { Shirt } from "lucide-react";
import { cx } from "@/components/ui/cx";

type Props = {
  // "onNavy"：ネイビーの上（左メニュー）／"onLight"：白い面の上（ログイン）
  tone: "onNavy" | "onLight";
  className?: string;
};

// ロゴ（シャツの線アイコン＋「Apparel Analytics」）。縦に並べる
export function Logo({ tone, className }: Props) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-2",
        tone === "onNavy" ? "text-on-navy" : "text-brand-navy",
        className,
      )}
    >
      <Shirt aria-hidden="true" className="size-10" strokeWidth={1.5} />
      <span className="text-body font-bold">Apparel Analytics</span>
    </div>
  );
}
