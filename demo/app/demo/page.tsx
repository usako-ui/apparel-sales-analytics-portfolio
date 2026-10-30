import { DemoApp } from "../../components/DemoApp";
import { DemoHeader } from "../../components/DemoHeader";

// デモ版の画面（/demo）。ログインなし。データはブラウザの中だけに置く
export default function DemoPage() {
  return (
    <>
      <DemoHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
        <DemoApp />
      </main>
    </>
  );
}
