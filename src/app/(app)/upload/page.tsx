import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { UploadManager } from "@/components/upload/UploadManager";
import { requireMember } from "@/lib/auth/guard";

// CSVアップロード画面（T-15）。最初に requireMember()：未ログイン・停止中・パスワード未変更はここで止まる
// 管理者でも操作者でも使える。セッションを読む部分は <Suspense> の中（Cache Components の決まり）
export default function UploadPage() {
  return (
    <Suspense fallback={<p className="p-4 text-body text-ink-muted">読み込み中…</p>}>
      <UploadContent />
    </Suspense>
  );
}

async function UploadContent() {
  await requireMember();

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="flex max-w-4xl flex-col gap-5">
        <PageHeader title="CSVアップロード" description="Shopifyの売上CSVをアップロードして、データを取り込みます" />
        <UploadManager />
      </div>
    </main>
  );
}
