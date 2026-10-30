import { DemoLinkButton } from "./LpLinks";
import { LpLogo } from "./LpLogo";
import { LpContainer } from "./LpUi";

// 1 ヘッダー：ロゴと「デモを試す」。ファーストビューの濃いネイビーの上に重ねる（背景は透明）
export function LpHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <LpContainer inset className="flex min-h-16 items-center justify-between gap-3 py-2 md:min-h-[73px]">
        <LpLogo tone="onNavy" />
        <DemoLinkButton size="sm" tone="onDark" />
      </LpContainer>
    </header>
  );
}
