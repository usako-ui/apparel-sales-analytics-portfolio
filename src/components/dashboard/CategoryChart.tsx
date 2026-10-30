"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategorySales } from "@/lib/aggregate";
import { formatManYen, formatYen } from "@/lib/format";

// グラフの色（濃い順。globals.css の --chart-series-1〜5 ＝ --color-chart-1〜5）。カテゴリが5つを超えたら最初の色に戻る
const SERIES_COUNT = 5;
const colorOf = (index: number) => `var(--chart-series-${(index % SERIES_COUNT) + 1})`;

// カテゴリ別売上の棒グラフ。並び（売上の多い順）と値は集計（calcCategorySales）の結果のまま。
// 金額は円の整数のまま受け取り、ラベルは「万」、ツールチップは円で整形する
export function CategoryChart({ items }: { items: readonly CategorySales[] }) {
  const data = [...items];

  return (
    <div>
      {/* 図は読み上げから外し、同じ数字を下の表（画面には出さない）で読めるようにする */}
      <div aria-hidden="true" data-testid="category-chart">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 8 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} className="stroke-line" />
            <XAxis
              dataKey="category"
              tickLine={false}
              axisLine={{ className: "stroke-line-strong" }}
              tick={{ className: "fill-ink-muted", fontSize: 12 }}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ className: "fill-brand-light" }}
              formatter={(value) => [`${formatYen(Number(value))}円`, "売上"]}
            />
            <Bar dataKey="revenue" name="売上" radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={false}>
              {data.map((item, index) => (
                <Cell key={item.category} fill={colorOf(index)} />
              ))}
              <LabelList
                dataKey="revenue"
                position="top"
                offset={6}
                className="fill-ink"
                fontSize={12}
                fontWeight={600}
                formatter={(value: unknown) => formatManYen(Number(value))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>カテゴリ別売上</caption>
        <thead>
          <tr>
            <th scope="col">カテゴリ</th>
            <th scope="col">売上（円）</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.category}>
              <th scope="row">{item.category}</th>
              <td>{formatYen(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
