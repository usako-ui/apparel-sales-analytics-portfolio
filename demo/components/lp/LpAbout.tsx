import { LINE_URL, PORTFOLIO_URL } from "../../lib/contact";
import { ExternalLink } from "./LpLinks";
import { LpContainer, LpSectionTitle, Ph } from "./LpUi";
import { Reveal } from "./Reveal";

const buttonBase =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl px-8 text-[15px] font-bold transition-colors focus-visible:outline-on-navy sm:w-auto md:min-h-14 md:text-[16px]";

// 9 つくった人：濃いネイビーの帯。押し売りにならない呼びかけと、連絡先のボタン2つ（LINE を一番目立たせる）
export function LpAbout() {
  return (
    <section aria-labelledby="lp-about-title" className="relative overflow-hidden bg-gradient-to-b from-lp-night to-brand-navy py-16 md:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-24 size-[460px] rounded-full bg-chart-3/25 blur-3xl" />
      <LpContainer className="relative">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <LpSectionTitle id="lp-about-title" tone="dark" label="CONTACT">
            業務の「ちょっと困った」を、|仕組みで解決しませんか？
          </LpSectionTitle>
          <p className="text-[15px] leading-[1.9] text-on-navy md:text-[16px]">
            <Ph sentences>個人事業主・小規模〜中規模事業者向けに、業務課題に合わせた |AI 活用・システム開発の|相談を承ります。</Ph>
          </p>
          <p className="text-[14px] leading-[1.9] text-on-navy-muted md:text-[15px]">
            <Ph sentences>このダッシュボードのように、小さなお店や個人事業の|「毎月の手間」を、使いやすい仕組みに変える|お手伝いをしています。「うちでもできるかな？」という|段階のご相談も歓迎です。</Ph>
          </p>
          <div className="mt-3 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <ExternalLink
              href={LINE_URL}
              className={`${buttonBase} min-h-14 bg-surface text-[16px] text-brand-navy shadow-lp-float hover:bg-lp-tint-deep md:min-h-16 md:px-12 md:text-[18px]`}
            >
              LINE 公式で相談する
              <span className="sr-only">（新しいタブで開きます）</span>
            </ExternalLink>
            <ExternalLink href={PORTFOLIO_URL} className={`${buttonBase} border-2 border-on-navy text-on-navy hover:bg-on-navy/10`}>
              ポートフォリオを見る
              <span className="sr-only">（新しいタブで開きます）</span>
            </ExternalLink>
          </div>
        </Reveal>
      </LpContainer>
    </section>
  );
}
