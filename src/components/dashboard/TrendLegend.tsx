// 推移グラフの凡例（売上＝濃いネイビー／粗利＝薄いネイビー）。Panel の右上に置く。色はグラフの線と同じ名前
export function TrendLegend() {
  return (
    <ul className="flex items-center gap-4 text-caption text-ink-muted">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-1" />
        売上
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-3" />
        粗利
      </li>
    </ul>
  );
}
