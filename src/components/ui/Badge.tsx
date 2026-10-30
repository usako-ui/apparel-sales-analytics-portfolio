import { cx } from "./cx";

type BadgeProps = { tone: "up" | "down" | "flat" | "caution" | "navy"; children: string };

const tones: Record<BadgeProps["tone"], string> = {
  up: "bg-up-soft text-up",
  down: "bg-down-soft text-down",
  flat: "bg-flat-soft text-flat",
  caution: "bg-caution-soft text-caution",
  navy: "bg-chart-5 text-brand-navy",
};

// 小さなラベルの共通の形。色だけで意味を伝えないよう、必ず文字を入れる
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

// アカウントの状態のラベル（有効／休職／退職）
export type AccountStatus = "active" | "leave" | "retired";

const statusView: Record<AccountStatus, { tone: BadgeProps["tone"]; label: string }> = {
  active: { tone: "up", label: "有効" },
  leave: { tone: "caution", label: "休職" },
  retired: { tone: "flat", label: "退職" },
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  const { tone, label } = statusView[status];
  return <Badge tone={tone}>{label}</Badge>;
}

// ロールのラベル（管理者／操作者）
export type MemberRole = "admin" | "operator";

const roleView: Record<MemberRole, { tone: BadgeProps["tone"]; label: string }> = {
  admin: { tone: "navy", label: "管理者" },
  operator: { tone: "flat", label: "操作者" },
};

export function RoleBadge({ role }: { role: MemberRole }) {
  const { tone, label } = roleView[role];
  return <Badge tone={tone}>{label}</Badge>;
}
