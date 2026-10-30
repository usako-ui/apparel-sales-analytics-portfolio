import { RoleBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { MemberView } from "./member-types";

type Props = {
  members: MemberView[];
  currentUserId: string;
  onOperate: (member: MemberView) => void;
};

// メンバー一覧。PC・タブレットは表、スマホは横にはみ出さないカード型（同じデータを2通りに見せる）
export function MemberList({ members, currentUserId, onOperate }: Props) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
        <table className="w-full text-left text-body">
          <thead className="bg-brand-light text-caption text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">名前</th>
              <th scope="col" className="px-4 py-3 font-semibold">メールアドレス</th>
              <th scope="col" className="px-4 py-3 font-semibold">ロール</th>
              <th scope="col" className="px-4 py-3 font-semibold">状態</th>
              <th scope="col" className="px-4 py-3 font-semibold">最終ログイン</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">
                  {m.displayName}
                  {m.userId === currentUserId ? <span className="ml-1 text-caption font-normal text-ink-muted">（あなた）</span> : null}
                </td>
                <td className="px-4 py-3 break-all text-ink-muted">{m.email}</td>
                <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{m.lastLoginLabel}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="secondary" className="min-h-9 px-3" onClick={() => onOperate(m)} aria-label={`${m.displayName}さんの操作`}>
                    操作
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {m.displayName}
                  {m.userId === currentUserId ? <span className="ml-1 text-caption font-normal text-ink-muted">（あなた）</span> : null}
                </p>
                <p className="text-caption break-all text-ink-muted">{m.email}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <RoleBadge role={m.role} />
                <StatusBadge status={m.status} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-caption text-ink-muted">最終ログイン　{m.lastLoginLabel}</p>
              <Button variant="secondary" className="min-h-9 px-3" onClick={() => onOperate(m)} aria-label={`${m.displayName}さんの操作`}>
                操作
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
