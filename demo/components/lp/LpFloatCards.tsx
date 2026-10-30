import { Repeat, Sparkles, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { CountUp } from "./CountUp";
import { Ph } from "./LpUi";

type CardProps = {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  // 広い画面での置き場所と、上下の動きのずらし（Tailwind の class）
  className?: string;
};

function FloatCard({ icon: Icon, label, children, className }: CardProps) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-brand-navy shadow-lp-float animate-lp-float motion-reduce:animate-none lg:absolute lg:z-20 lg:px-5 lg:py-3.5",
        className,
      )}
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-on-navy">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-caption font-medium text-ink-muted">{label}</span>
        {children}
      </div>
    </div>
  );
}

// ノート PC のまわりに浮かぶ小さなカード3枚。数字はデモのダミーデータ（11月）の正解値に合わせる
// （売上 104,000 → 120,000 円で前月比 +15.4%・リピート率 8人/12人 = 66.7%。tests/unit/demo-sample-csv.test.ts で確認済み）
// スマホ・タブレットでは PC の下に並べ（重ならない）、広い画面では PC のまわりに置く
export function LpFloatCards() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 lg:contents">
      <FloatCard icon={TrendingUp} label="売上 前月比" className="lg:-top-[4.75rem] lg:right-4 xl:right-8">
        <span className="text-[24px] font-extrabold leading-none text-up">
          <CountUp value={15.4} decimals={1} prefix="+" suffix="%" />
        </span>
      </FloatCard>
      <FloatCard icon={Repeat} label="リピート率" className="[animation-delay:-2.2s] lg:-left-8 lg:bottom-[26%] xl:-left-16">
        <span className="text-[24px] font-extrabold leading-none">
          <CountUp value={66.7} decimals={1} suffix="%" />
        </span>
      </FloatCard>
      <FloatCard icon={Sparkles} label="AI コメント" className="col-span-2 [animation-delay:-4.1s] lg:-right-2 lg:-bottom-[5%] xl:-right-6">
        <span className="text-[15px] font-bold leading-snug">
          <Ph>来月の|打ち手を提案</Ph>
        </span>
      </FloatCard>
    </div>
  );
}
