"use client";

import { Database, Trash2, TriangleAlert } from "lucide-react";
import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Panel } from "@/components/ui/Panel";
import { UploadView } from "@/components/upload/UploadView";
import type { SalesRow } from "@/lib/csv/validate";
import { createBrowserStore, type DemoStore } from "../lib/store";
import { createDemoUploadActions } from "./demo-upload";
import { DEMO_DATA_ANCHOR, DEMO_PATH, DemoDashboard } from "./DemoDashboard";
import { DemoNotice } from "./DemoNotice";
import { SampleCsvButton } from "./SampleCsvButton";

const DASHBOARD_ANCHOR = "demo-dashboard";

// 購読する外部の変化はない（useSyncExternalStore を「ブラウザで描画しているか」の判定にだけ使う）
const subscribeNever = () => () => {};

// デモ版の画面の本体：データの区画（取り込み・ダミーCSV・消す）とダッシュボードの区画。
// 保存データはブラウザでしか読めないので、読み込んだ後に表示する（サーバーの出力とずれないため）
export function DemoApp() {
  // サーバーでは false、ブラウザでの最初の描画も false（サーバーと同じ）。そのあと true になる
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  // サーバーではメモリだけのストアになる（使われない）。ブラウザでは localStorage のストア
  const [store] = useState<DemoStore>(createBrowserStore);
  const [rows, setRows] = useState<SalesRow[]>(() => store.loadRows());
  // ブラウザに保存できているか。false なら、メモリだけ（このタブを閉じると消える）
  const [persisted, setPersisted] = useState(() => store.persisted);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const actions = useMemo(
    () =>
      createDemoUploadActions(store, (savedToBrowser) => {
        setRows(store.loadRows());
        setPersisted(savedToBrowser);
      }),
    [store],
  );

  // 保存データは表示しない（最初の描画がサーバーの出力とずれないよう、読み込み後に出す）
  if (!mounted) {
    return (
      <p role="status" className="text-body text-ink-muted">
        読み込み中…
      </p>
    );
  }

  function handleClear() {
    store.clearAll();
    setRows([]);
    setPersisted(store.persisted);
    setConfirmingClear(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <section id={DEMO_DATA_ANCHOR} aria-label="データ" className="scroll-mt-4">
        <Panel
          title="データを用意する"
          icon={Database}
          action={
            <Button variant="secondary" onClick={() => setConfirmingClear(true)} disabled={rows.length === 0}>
              <Trash2 aria-hidden="true" className="size-4" />
              データを消す
            </Button>
          }
        >
          {!persisted ? (
            <DemoNotice tone="caution">
              <p role="status">ブラウザに保存できなかったため、このタブを閉じるまで保存されます。</p>
            </DemoNotice>
          ) : null}
          <UploadView
            onPreview={actions.preview}
            onImport={actions.import}
            dashboardHref={`${DEMO_PATH}#${DASHBOARD_ANCHOR}`}
            renderExtra={({ select, disabled }) => <SampleCsvButton onSelect={select} disabled={disabled} />}
          />
        </Panel>
      </section>

      <section id={DASHBOARD_ANCHOR} aria-label="ダッシュボード" className="flex scroll-mt-4 flex-col gap-5">
        <Suspense fallback={<p className="text-body text-ink-muted">読み込み中…</p>}>
          <DemoDashboard rows={rows} />
        </Suspense>
      </section>

      <Dialog
        open={confirmingClear}
        onClose={() => setConfirmingClear(false)}
        title="データを消しますか？"
        icon={<TriangleAlert aria-hidden="true" className="size-5" />}
      >
        <p className="text-body">このブラウザに保存した売上データをすべて消します。元に戻せません。</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirmingClear(false)}>
            消さない
          </Button>
          <Button variant="danger" onClick={handleClear}>
            消す
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
