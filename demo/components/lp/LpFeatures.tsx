import { BrainCircuit, ChartColumn, CloudUpload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LpContainer, LpIconChip, LpSectionTitle, Ph } from "./LpUi";
import { Reveal } from "./Reveal";

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: CloudUpload,
    title: "CSV をアップロード |→ 自動で集計",
    text: "Shopify の売上 CSV を|入れるだけ。形式のチェックや|同じ月の上書きの確認も|自動で行います。",
  },
  {
    icon: ChartColumn,
    title: "KPI とグラフで、|ひと目で分かる",
    text: "売上・粗利・リピート率を|前月比つきで。月次の推移、カテゴリ別、売れ筋トップ10も|一画面に。",
  },
  {
    icon: BrainCircuit,
    title: "AI が分析コメントと|打ち手を提案",
    text: "まとめ・注目点・|気になる点・|来月の打ち手を |AI が作成。文中の数字は|集計結果と自動で照合し、ずれがあれば|知らせます。",
  },
];

// 4 できること：3つの特長（広い画面では縦線で区切る）
export function LpFeatures() {
  return (
    <LpContainer className="pb-12 md:pb-20">
      <section aria-labelledby="lp-features-title">
        <Reveal>
          <LpSectionTitle id="lp-features-title" label="FEATURES">
            このダッシュボードで|できること
          </LpSectionTitle>
        </Reveal>
        <ul className="mt-8 grid gap-4 md:mt-12 md:grid-cols-3 md:gap-0">
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <Reveal
              as="li"
              key={title}
              delayMs={index * 120}
              className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5 shadow-lp-card md:flex-col md:items-center md:gap-6 md:rounded-none md:border-0 md:border-l md:border-line-strong md:bg-transparent md:px-10 md:py-3 md:text-center md:shadow-none md:first:border-l-0"
            >
              <LpIconChip className="size-14 md:size-[4.5rem]">
                <Icon className="size-7 md:size-9" strokeWidth={1.5} />
              </LpIconChip>
              <div className="flex flex-col gap-3">
                <h3 className="text-balance text-[17px] font-bold leading-snug text-brand-navy md:text-[20px]">
                  <Ph>{title}</Ph>
                </h3>
                <p className="text-[14px] leading-[1.8] text-ink-muted md:text-[15px]">
                  <Ph sentences>{text}</Ph>
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>
    </LpContainer>
  );
}
