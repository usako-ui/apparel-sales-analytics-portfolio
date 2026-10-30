import { ChartNoAxesColumn, ChevronRight, Database, Info, Lock, Sparkles, Trash2, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LpContainer, LpPanel, LpSectionTitle, Ph } from "./LpUi";
import { Reveal } from "./Reveal";

const STEPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Upload,
    title: "ダミーの CSV を|読み込む",
    text: "「ダミーCSVで試す」を押すだけ。ご自身の CSV は不要です。",
  },
  {
    icon: ChartNoAxesColumn,
    title: "ダッシュボードを見る",
    text: "月を切り替えて、売上・粗利・リピート率・|カテゴリ別・売れ筋を|確かめられます。",
  },
  {
    icon: Sparkles,
    title: "自分の Gemini API キーで |AI 分析",
    text: "キーを入力すると、AI の分析コメントと|打ち手を試せます。",
  },
];

const NOTES: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Lock, text: "API キーは保存されません|（画面を閉じると消えます）" },
  { icon: Database, text: "ダミーのデータだけで|試してください" },
  { icon: Trash2, text: "読み込んだデータは|このブラウザだけに保存され、「データを消す」で|いつでも削除できます" },
];

// 5 使い方3ステップ ＋ 6 デモについての注意（同じ面の中に、横長の帯で置く）
export function LpSteps() {
  return (
    <LpContainer>
      <LpPanel labelledBy="lp-steps-title">
        <Reveal>
          <LpSectionTitle id="lp-steps-title" label="HOW TO USE">
            使い方は|かんたん 3 ステップ
          </LpSectionTitle>
        </Reveal>
        <ol className="mt-8 grid gap-12 md:mt-11 md:grid-cols-3 md:gap-16">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <Reveal as="li" key={title} delayMs={index * 140} className="relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-lp-card md:p-6">
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[20px] font-extrabold text-on-navy shadow-card"
                >
                  {index + 1}
                </span>
                <Icon aria-hidden="true" className="size-8 shrink-0 text-brand-navy-soft" strokeWidth={1.4} />
              </div>
              <h3 className="mt-1 text-balance text-[17px] font-bold leading-snug text-brand-navy md:text-[18px]">
                <span className="sr-only">ステップ{index + 1}：</span>
                <Ph>{title}</Ph>
              </h3>
              <p className="text-[14px] leading-[1.8] text-ink-muted">
                <Ph sentences>{text}</Ph>
              </p>
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-[2.6rem] left-1/2 flex size-8 -translate-x-1/2 rotate-90 items-center justify-center text-chart-3 md:-right-[3rem] md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-0 md:rotate-0"
                >
                  <ChevronRight className="size-7" strokeWidth={1.8} />
                </span>
              ) : null}
            </Reveal>
          ))}
        </ol>

        <Reveal
          as="section"
          labelledBy="lp-notice-title"
          className="mt-10 flex flex-col gap-4 rounded-xl border border-line bg-lp-tint-deep/60 px-5 py-4 md:mt-11 md:flex-row md:items-center md:gap-0 md:px-7"
        >
          <div className="flex shrink-0 flex-col gap-1 md:pr-7">
            <p aria-hidden="true" className="text-[11px] font-bold tracking-[0.24em] text-chart-2">
              NOTICE
            </p>
            <h3 id="lp-notice-title" className="flex items-center gap-3 text-[15px] font-bold text-brand-navy">
              <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-brand-navy text-on-navy">
                <Info className="size-4" strokeWidth={2} />
              </span>
              デモについて
            </h3>
          </div>
          <ul className="flex flex-1 flex-col gap-3 md:flex-row md:gap-0">
            {NOTES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-[14px] leading-relaxed text-ink-muted md:flex-1 md:items-center md:border-l md:border-line-strong md:px-6">
                <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-navy-soft md:mt-0" strokeWidth={1.5} />
                <span>
                  <Ph sentences>{text}</Ph>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </LpPanel>
    </LpContainer>
  );
}
