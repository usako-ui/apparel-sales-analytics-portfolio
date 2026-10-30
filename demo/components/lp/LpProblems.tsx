import { ChartNoAxesColumn, CircleQuestionMark, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LpContainer, LpIconChip, LpPanel, LpSectionTitle, Ph } from "./LpUi";
import { Reveal } from "./Reveal";

const PROBLEMS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Clock,
    title: "毎月の Excel 集計に|時間がかかる",
    text: "注文データを貼り付けて、関数を直して…。月1回の集計に、半日かかってしまう。",
  },
  {
    icon: ChartNoAxesColumn,
    title: "数字の変化に|気づくのが遅れる",
    text: "売上は見ていても、粗利やリピート率の|変化までは追いきれない。",
  },
  {
    icon: CircleQuestionMark,
    title: "結局、|次に何をするか|決まらない",
    text: "数字は出たけれど、「来月なにをするか」まで|たどり着けない。",
  },
];

// 3 お悩み：カード3つ
export function LpProblems() {
  return (
    <LpContainer className="py-12 md:py-20">
      <LpPanel labelledBy="lp-problems-title">
        <Reveal>
          <LpSectionTitle id="lp-problems-title" label="PROBLEM">
            こんなお悩みは|ありませんか？
          </LpSectionTitle>
        </Reveal>
        <ul className="mt-8 grid gap-4 md:mt-11 md:grid-cols-3 md:gap-6">
          {PROBLEMS.map(({ icon: Icon, title, text }, index) => (
            <Reveal as="li" key={title} delayMs={index * 120} className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5 shadow-lp-card md:gap-5 md:p-7">
              <LpIconChip className="size-12 md:size-14">
                <Icon className="size-6 md:size-7" strokeWidth={1.6} />
              </LpIconChip>
              <div className="flex flex-col gap-2.5">
                <h3 className="text-balance text-[17px] font-bold leading-snug text-brand-navy md:text-[19px]">
                  <Ph>{title}</Ph>
                </h3>
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  <Ph sentences>{text}</Ph>
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </LpPanel>
    </LpContainer>
  );
}
