import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { GithubLink } from "./LpLinks";
import { LpLogo } from "./LpLogo";
import { LpContainer, Ph } from "./LpUi";

// 10 フッター：濃いネイビー
export function LpFooter() {
  return (
    <footer className="border-t border-on-navy/15 bg-brand-navy text-on-navy">
      <LpContainer inset className="flex flex-col gap-4 py-6 md:py-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-0">
          <div className="flex items-center gap-5">
            <LpLogo tone="onNavy" />
            <span aria-hidden="true" className="h-6 w-px bg-on-navy-muted/60" />
            <GithubLink className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-on-navy">
              GitHub
              <ExternalLinkIcon aria-hidden="true" className="size-4" />
            </GithubLink>
          </div>
          <p className="text-caption text-on-navy-muted md:ml-auto">© 2026 Apparel Analytics</p>
        </div>
        <p className="border-t border-on-navy-muted/25 pt-4 text-caption text-on-navy-muted">
          <Ph sentences>本作品は|架空のアパレル EC を|想定した|ポートフォリオです。</Ph>
        </p>
      </LpContainer>
    </footer>
  );
}
