import { Fragment } from "react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type ContainerProps = {
  children: ReactNode;
  className?: string;
  // true：ヘッダー・ファーストビュー用。広い画面では左右に少し余白を足す（参考画像の左端の位置）
  inset?: boolean;
};

// 紹介ページの横幅をそろえる入れ物（最大 1330px・中央）
export function LpContainer({ children, className, inset = false }: ContainerProps) {
  return (
    <div
      className={cx(
        // 狭い画面だけ左右に余白（1400px 以上は最大幅の外側が余白になる）
        "mx-auto w-full max-w-[1330px] max-[767px]:px-5 min-[768px]:max-[1399px]:px-8",
        inset && "min-[1400px]:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

type PhProps = {
  // 文節の区切りを「|」で書いた文（表示される文字は「|」を除いたもの）。区切りの前後の半角スペースは、そのまま残す。
  // 「、」「。」の所は節の区切りとして自動で扱うので、そこに「|」は不要
  children: string;
  // true：「。」で終わる節の後ろ（文が続く場合だけ）で強制的に改行する。説明文（本文）用。見出し・短い文には使わない
  sentences?: boolean;
};

// 「、」「。」で終わる節に分ける（句読点は前の節につく）
const CLAUSE_PATTERN = /[^、。]*[、。]|[^、。]+/g;

// 1つの文節を inline-block で囲む（前後の半角スペースは外に出す）
function renderSegment(segment: string, key: number) {
  const [, before = "", body = "", after = ""] = /^( *)(.*?)( *)$/.exec(segment) ?? [];
  return (
    <Fragment key={key}>
      {before}
      <span className="inline-block">{body}</span>
      {after}
    </Fragment>
  );
}

// 節（、。で区切った単位）ごと、さらに文節ごとに折り返す文。
// 幅に収まる時は節のまとまりのまま、収まらない時は読点の所で、それでも収まらない時だけ文節で折り返す。
// inline-block で囲むので、word-break: auto-phrase に対応していない Safari などでも言葉の途中で切れない
export function Ph({ children, sentences = false }: PhProps) {
  const clauses = (children.match(CLAUSE_PATTERN) ?? [])
    .map((clause) => clause.split("|").filter((segment) => segment.trim() !== ""))
    .filter((segments) => segments.length > 0);

  return (
    <>
      {clauses.map((segments, index) => {
        const endsSentence = segments[segments.length - 1].trimEnd().endsWith("。");
        const breakAfter = sentences && endsSentence && index < clauses.length - 1;
        return (
          <Fragment key={index}>
            {segments.length === 1 ? renderSegment(segments[0], 0) : <span className="inline-block">{segments.map(renderSegment)}</span>}
            {breakAfter ? <br /> : null}
          </Fragment>
        );
      })}
    </>
  );
}

type SectionTitleProps = {
  id?: string;
  // 見出しの上に薄く添える英語のラベル
  label: string;
  // 見出しの文。文節の区切りを「|」で書く（Ph と同じ）
  children: string;
  // "lg"：節の見出し／"md"：使った技術などの小さめの見出し
  size?: "lg" | "md";
  // "light"：薄い背景の上／"dark"：濃いネイビーの上
  tone?: "light" | "dark";
  className?: string;
};

// 節の見出し：英語のラベル（両側に短い線）＋太く大きな見出し
export function LpSectionTitle({ id, label, children, size = "lg", tone = "light", className }: SectionTitleProps) {
  const dark = tone === "dark";
  return (
    <div className={cx("flex flex-col items-center gap-3 text-center md:gap-4", className)}>
      <p aria-hidden="true" className={cx("flex items-center gap-3 text-[12px] font-bold tracking-[0.24em]", dark ? "text-chart-4" : "text-chart-2")}>
        <span className={cx("h-px w-7", dark ? "bg-chart-4/60" : "bg-chart-2/50")} />
        {label}
        <span className={cx("h-px w-7", dark ? "bg-chart-4/60" : "bg-chart-2/50")} />
      </p>
      <h2
        id={id}
        className={cx(
          "text-balance font-extrabold leading-[1.35] tracking-wide",
          dark ? "text-on-navy" : "text-brand-navy",
          size === "lg" ? "text-[24px] sm:text-[30px] md:text-[38px]" : "text-[22px] md:text-[28px]",
        )}
      >
        <Ph>{children}</Ph>
      </h2>
    </div>
  );
}

// 丸いアイコンの台（濃いネイビーの地に白い線のアイコン）
export function LpIconChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("flex shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-on-navy shadow-card", className)}>
      {children}
    </span>
  );
}

// 薄い色の面（お悩み・使い方の節の背景）
export function LpPanel({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cx("rounded-2xl bg-lp-tint px-4 py-8 md:px-10 md:py-10", className)}>
      {children}
    </section>
  );
}
