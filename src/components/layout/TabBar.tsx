"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import { isActivePath, visibleMenuItems } from "./menu-items";

// 下のタブ（スマホ）。上のメニューボタンは使わず、これだけでメニューをまかなう
// ログアウトは「アカウント」タブで開くパスワード変更の画面の下にある
export function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = visibleMenuItems(isAdmin);

  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-20 flex h-tabbar items-center gap-1 border-t border-brand-navy-soft bg-brand-navy px-2 text-on-navy md:hidden"
    >
      {items.map(({ href, label, shortLabel, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        const visibleText = shortLabel ?? label;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            // 見える文字が短くても、読み上げの名前は見える文字を含むフルの名前にする
            aria-label={label.includes(visibleText) ? label : undefined}
            className={cx(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-center text-caption font-semibold transition-colors",
              active ? "bg-brand-navy-soft text-on-navy" : "text-on-navy-muted",
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
            {visibleText}
          </Link>
        );
      })}
    </nav>
  );
}
