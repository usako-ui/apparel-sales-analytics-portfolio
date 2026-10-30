import { GitBranch } from "lucide-react";
import { LaptopMockup } from "./LaptopMockup";
import { LpFloatCards } from "./LpFloatCards";
import { DemoLinkButton, GithubLink } from "./LpLinks";
import { LpContainer, Ph } from "./LpUi";
import { Reveal } from "./Reveal";

// 2 ファーストビュー：濃いネイビー。左に見出し・説明・ボタン、右に斜めに傾けたノート PC と浮かぶカード
export function LpHero() {
  return (
    <section aria-labelledby="lp-hero-title" className="relative overflow-hidden bg-gradient-to-b from-brand-navy via-brand-navy-hover to-lp-night">
      {/* 右上のうっすらした光のにじみ／左下の淡い光 */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-4 size-[420px] rounded-full bg-chart-3/35 blur-3xl md:-right-10 md:size-[640px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-32 size-[420px] rounded-full bg-chart-2/25 blur-3xl" />
      <LpContainer inset className="relative grid items-center gap-10 pb-14 pt-28 lg:grid-cols-[5fr_6fr] lg:gap-4 lg:pb-20 lg:pt-36">
        <Reveal className="relative z-10 flex flex-col gap-6 md:gap-7">
          <h1
            id="lp-hero-title"
            className="text-balance text-[32px] font-extrabold leading-[1.3] tracking-wide text-on-navy sm:text-[44px] lg:text-[clamp(2.5rem,3.7vw,3.5rem)]"
          >
            <Ph>CSV を入れるだけで、</Ph>
            <br />
            <Ph>来月の打ち手まで。</Ph>
          </h1>
          <p className="max-w-[31rem] text-[15px] leading-[1.9] text-on-navy md:text-[17px]">
            <Ph sentences>アパレル EC の|小さなお店向けの |AI 売上分析ダッシュボード。Shopify の売上 CSV を|アップロードするだけで、月別の売上・粗利・|リピート率・カテゴリ別・|売れ筋を自動で集計し、AI が「次の月の打ち手」まで|コメントします。</Ph>
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <DemoLinkButton size="lg" withHint tone="onDark" />
            <GithubLink className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-on-navy px-7 text-[16px] font-bold text-on-navy hover:bg-on-navy/10 focus-visible:outline-on-navy">
              <GitBranch aria-hidden="true" className="size-5" />
              GitHub を見る
            </GithubLink>
          </div>
        </Reveal>
        <Reveal delayMs={150} className="relative z-10">
          {/* ノート PC を少し斜めに。下に柔らかい光の影 */}
          <div className="relative [perspective:1600px]">
            <div aria-hidden="true" className="absolute -bottom-3 left-1/2 h-12 w-[72%] -translate-x-1/2 rounded-full bg-chart-3/45 blur-2xl" />
            <div className="[transform-style:preserve-3d] [transform:rotateY(-10deg)_rotateX(5deg)_rotateZ(1.5deg)] lg:[transform:rotateY(-16deg)_rotateX(6deg)_rotateZ(2deg)]">
              <LaptopMockup src="/lp/dashboard-pc.png" alt="デモ版ダッシュボードの画面（ダミーデータ）" />
            </div>
          </div>
          <p className="mt-5 text-center lg:max-xl:text-left text-caption text-on-navy-muted">
            <Ph>※画面は|デモ用のダミーデータです</Ph>
          </p>
          <LpFloatCards />
        </Reveal>
      </LpContainer>
    </section>
  );
}
