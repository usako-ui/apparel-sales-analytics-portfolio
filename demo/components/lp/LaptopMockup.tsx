import Image from "next/image";
import { cx } from "@/components/ui/cx";

type Props = {
  // 画面に入れる画像（デモのダミーデータで撮ったダッシュボードのスクショ）
  src: string;
  alt: string;
  className?: string;
};

// ノート PC の枠（CSS だけで描く）。画面の中にスクショを入れる
export function LaptopMockup({ src, alt, className }: Props) {
  return (
    <div className={cx("relative mx-auto w-full max-w-[780px]", className)}>
      {/* 画面：濃い縁取りの中にスクショ。7:6 で上から切り取る */}
      <div className="mx-auto w-[94%] rounded-t-[14px] bg-ink p-[1.6%] pb-[1.8%] md:w-[86%] md:rounded-t-[20px]">
        <div className="relative aspect-[7/6] overflow-hidden rounded-[3px] bg-surface md:rounded-[5px]">
          {/* 開発中に撮り直しても古い画像が残らないよう、最適化を通さずそのまま出す */}
          <Image src={src} alt={alt} fill unoptimized sizes="(min-width: 1024px) 560px, 90vw" className="object-cover object-top" priority />
        </div>
      </div>
      {/* 本体の底：画面より少し広い。真ん中に指をかける切り欠き */}
      <div className="relative h-[10px] rounded-b-[16px] bg-gradient-to-b from-line to-line-strong shadow-lp-laptop md:h-[16px] md:rounded-b-[22px]">
        <span aria-hidden="true" className="absolute left-1/2 top-0 h-[4px] w-[16%] -translate-x-1/2 rounded-b-md bg-line-strong md:h-[6px]" />
      </div>
    </div>
  );
}
