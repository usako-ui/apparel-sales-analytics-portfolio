import { Suspense } from "react";
import { MemberManager } from "@/components/admin/MemberManager";
import { requireAdmin } from "@/lib/auth/guard";
import { loadMembers } from "./members-data";

// 管理者画面（T-10）。最初に requireAdmin()：操作者・停止中・未ログインはここで止まる（URL直打ちの守り）
export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-4 text-body text-ink-muted">読み込み中…</p>}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const admin = await requireAdmin();
  const members = await loadMembers(admin.shopId);

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <MemberManager members={members} currentUserId={admin.userId} />
    </main>
  );
}
