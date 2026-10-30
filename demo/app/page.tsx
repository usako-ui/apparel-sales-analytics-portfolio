import { LpAbout } from "../components/lp/LpAbout";
import { LpCta } from "../components/lp/LpCta";
import { LpFeatures } from "../components/lp/LpFeatures";
import { LpFooter } from "../components/lp/LpFooter";
import { LpHeader } from "../components/lp/LpHeader";
import { LpHero } from "../components/lp/LpHero";
import { LpProblems } from "../components/lp/LpProblems";
import { LpSteps } from "../components/lp/LpSteps";
import { LpTech } from "../components/lp/LpTech";

// 紹介ページ（LP・/）。状態を持たない Server Component。節の順番は architecture.md 第18項
// 濃い節（ファーストビュー・こだわったこと・つくった人）と薄い節を交互に置く。
// 文は文節で折り返す（word-break: auto-phrase に対応するブラウザはそれも効く。対応しないブラウザ向けに、文は Ph 部品で文節を区切る）
export default function LandingPage() {
  return (
    <div className="relative flex flex-1 flex-col [word-break:auto-phrase]">
      <LpHeader />
      <main className="flex-1 bg-surface">
        <LpHero />
        <LpProblems />
        <LpFeatures />
        <LpSteps />
        <LpTech />
        <LpCta />
        <LpAbout />
      </main>
      <LpFooter />
    </div>
  );
}
