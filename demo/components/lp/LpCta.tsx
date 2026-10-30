import { LeafSprig } from "./LeafSprig";
import { DemoLinkButton } from "./LpLinks";
import { LpContainer, LpSectionTitle } from "./LpUi";
import { Reveal } from "./Reveal";

// 8 最後の呼びかけ：大きなボタン。両端に葉の線画
export function LpCta() {
  return (
    <LpContainer className="py-14 md:py-20">
      <section
        aria-labelledby="lp-cta-title"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-lp-tint via-surface to-lp-tint px-5 py-12 text-center md:py-16"
      >
        <LeafSprig className="absolute -left-2 bottom-0 h-[120px] w-auto md:left-6 md:h-[170px]" />
        <LeafSprig flip className="absolute -right-2 bottom-0 h-[120px] w-auto md:right-6 md:h-[170px]" />
        <Reveal className="relative flex flex-col items-center gap-8">
          <LpSectionTitle id="lp-cta-title" size="md" label="TRY IT">
            まずは気軽に、|デモを試してみませんか？
          </LpSectionTitle>
          <DemoLinkButton size="xl" withHint />
        </Reveal>
      </section>
    </LpContainer>
  );
}
