"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/account";
import { cx } from "@/components/ui/cx";
import { Logo } from "./Logo";
import { isActivePath, visibleMenuItems } from "./menu-items";

// 左のメニュー（PC・タブレット）。スマホでは隠し、下のタブを使う
export function SideMenu({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = visibleMenuItems(isAdmin);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-sidebar flex-col bg-brand-navy px-3 py-5 text-on-navy md:flex">
      <Logo tone="onNavy" className="pb-6" />
      <nav aria-label="メインメニュー" className="flex-1">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-11 items-center gap-3 rounded-control px-3 text-body font-semibold transition-colors",
                    active ? "bg-brand-navy-soft text-on-navy" : "text-on-navy-muted hover:bg-brand-navy-soft/60",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <form action={logout} className="border-t border-brand-navy-soft pt-3">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-body font-semibold text-on-navy-muted transition-colors hover:bg-brand-navy-soft/60"
        >
          <LogOut aria-hidden="true" className="size-5 shrink-0" />
          ログアウト
        </button>
      </form>
    </aside>
  );
}
