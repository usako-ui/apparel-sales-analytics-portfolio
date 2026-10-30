import { Calculator, Rocket, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LpContainer, LpSectionTitle, Ph } from "./LpUi";
import { Reveal } from "./Reveal";

const TECHS = ["Next.js", "TypeScript", "Supabase", "Gemini API", "Vercel", "GitHub Actions"];

const POINTS: Array<{ icon: LucideIcon; title: string; text: string; note?: string }> = [
  {
    icon: Calculator,
    title: "数字の正確さ",
    text: "集計は正解値テストで確認し、AI の文中の数字も|集計と自動で照合",
  },
  {
    icon: ShieldCheck,
    title: "お店ごとの|データを守る",
    text: "データベースの権限（RLS）で、ほかのお店のデータは|見えない作り",
    note: "（本番版の設計）",
  },
  {
    icon: Rocket,
    title: "安心して|更新できる",
    text: "テストに合格した時だけ|本番に公開する仕組み|（CI/CD）",
    note: "（本番版の設計）",
  },
];

// 7 使った技術（文字のバッジ・薄い節）＋ この作品でこだわったこと（濃いネイビーの節）
export function LpTech() {
  return (
    <>
      <LpContainer className="pb-14 pt-14 md:pb-20 md:pt-20">
        <section aria-labelledby="lp-tech-title">
          <Reveal>
            <LpSectionTitle id="lp-tech-title" size="md" label="TECH">
              使った技術
            </LpSectionTitle>
          </Reveal>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-3 md:mt-8 md:gap-x-4">
            {TECHS.map((name, index) => (
              <Reveal
                as="li"
                key={name}
                delayMs={index * 70}
                className="rounded-full border border-line-strong bg-surface px-5 py-1.5 text-[13px] font-bold text-brand-navy shadow-card md:px-7 md:py-2 md:text-[14px]"
              >
                {name}
              </Reveal>
            ))}
          </ul>
        </section>
      </LpContainer>

      <section aria-labelledby="lp-points-title" className="relative overflow-hidden bg-gradient-to-b from-lp-night via-brand-navy-hover to-brand-navy py-14 md:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-24 size-[460px] rounded-full bg-chart-3/25 blur-3xl" />
        <LpContainer className="relative">
          <Reveal>
            <LpSectionTitle id="lp-points-title" tone="dark" label="POINTS">
              この作品で|こだわったこと
            </LpSectionTitle>
          </Reveal>
          <ul className="mt-8 grid gap-4 md:mt-11 md:grid-cols-3 md:gap-6">
            {POINTS.map(({ icon: Icon, title, text, note }, index) => (
              <Reveal as="li" key={title} delayMs={index * 120} className="flex flex-col gap-3 rounded-xl border border-on-navy/25 bg-on-navy/5 p-6 md:p-7">
                <div className="flex items-center gap-3">
                  <Icon aria-hidden="true" className="size-8 shrink-0 text-chart-4" strokeWidth={1.5} />
                  <h3 className="text-[17px] font-bold leading-snug text-on-navy md:text-[18px]">
                    <Ph>{title}</Ph>
                  </h3>
                </div>
                <p className="text-[14px] leading-[1.8] text-on-navy-muted md:text-[15px]">
                  <Ph sentences>{text}</Ph>
                </p>
                {note ? <p className="text-caption text-on-navy-muted">{note}</p> : null}
              </Reveal>
            ))}
          </ul>
        </LpContainer>
      </section>
    </>
  );
}
