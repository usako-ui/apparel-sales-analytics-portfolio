"use client";

import { importUpload, previewUpload } from "@/actions/upload";
import { isSignedOut } from "./session-check";
import { UploadView } from "./UploadView";

// 本番のCSVアップロード画面。画面の本体は UploadView。ここでは Server Action とログイン切れの確認だけを渡す
export function UploadManager() {
  return <UploadView onPreview={previewUpload} onImport={importUpload} dashboardHref="/" checkSignedOut={isSignedOut} />;
}
