import type { SkuSales } from "@/lib/aggregate";
import { formatYen } from "@/lib/format";

// 売れ筋商品トップ10の表（順位・商品名・SKU・数量・売上）。並びと件数は集計（calcSkuTop）の結果のまま
// スマホ（sm 未満）は列を絞り、SKU を商品名の下の小さな文字にする（横にはみ出さない）
export function SkuTable({ items }: { items: readonly SkuSales[] }) {
  return (
    <div className="overflow-x-auto rounded-control border border-line">
      <table className="w-full text-left text-body">
        <caption className="sr-only">売れ筋商品トップ10（数量の多い順）</caption>
        {/* 見出しは折り返さない（「順位」「数量」が縦に割れるため）。商品名の列だけが折り返して幅を吸収する */}
        <thead className="bg-brand-light text-caption whitespace-nowrap text-ink-muted">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">順位</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">商品名</th>
            <th scope="col" className="hidden px-3 py-2.5 font-semibold sm:table-cell">SKU</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">数量</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">売上（円）</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.sku} className="border-t border-line">
              <td className="px-3 py-2.5 tabular-nums">{index + 1}</td>
              <td className="px-3 py-2.5">
                {item.productName}
                <span className="block text-caption text-ink-muted sm:hidden">{item.sku}</span>
              </td>
              <td className="hidden px-3 py-2.5 whitespace-nowrap text-ink-muted sm:table-cell">{item.sku}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatYen(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
