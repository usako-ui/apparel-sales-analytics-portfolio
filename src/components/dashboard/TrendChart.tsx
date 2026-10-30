"use client";

import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonthLabel } from "@/components/upload/month-label";
import { formatManYen, formatYen } from "@/lib/format";
import type { TrendPoint } from "./trend-data";

// 点が多いと数字が重なるので、点のそばの数字（ラベル）は 6 か月までにする。それ以上はツールチップで読む
const MAX_POINTS_WITH_LABELS = 6;

type Props = { points: readonly TrendPoint[] };

// 月次推移グラフ（売上＝濃いネイビー／粗利＝薄いネイビー）。値は円の整数のまま受け取り、軸・ラベルは format.ts で整形する
// 色は Tailwind／globals.css の名前だけ使う：className（点・目盛りの文字・格子）と、線の stroke の var(--chart-series-N)（globals.css）
// （Recharts は線の path に直接 stroke を付けるため、線だけは var() で渡す）
export function TrendChart({ points }: Props) {
  const data = [...points];
  const showLabels = data.length <= MAX_POINTS_WITH_LABELS;

  return (
    <div>
      {/* 図は読み上げから外し、同じ数字を下の表（画面には出さない）で読めるようにする */}
      <div aria-hidden="true" data-testid="trend-chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 24, right: 24, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} className="stroke-line" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ className: "stroke-line-strong" }}
              tick={{ className: "fill-ink-muted", fontSize: 12 }}
              padding={{ left: 24, right: 24 }}
            />
            <YAxis
              width={48}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatManYen(value)}
              domain={[(dataMin: number) => Math.min(0, dataMin), "auto"]}
              tick={{ className: "fill-ink-muted", fontSize: 12 }}
            />
            <Tooltip
              isAnimationActive={false}
              formatter={(value, name) => [`${formatYen(Number(value))}円`, name]}
              labelFormatter={(_label, payload) => {
                const month = payload?.[0]?.payload?.month;
                return typeof month === "string" ? formatMonthLabel(month) : "";
              }}
            />
            <Line
              name="売上"
              dataKey="revenue"
              type="linear"
              strokeWidth={2.5}
              stroke="var(--chart-series-1)"
              dot={{ r: 4, strokeWidth: 2, className: "fill-chart-1 stroke-surface" }}
              activeDot={{ r: 6, className: "fill-chart-1 stroke-surface" }}
              isAnimationActive={false}
            >
              {showLabels ? (
                <LabelList
                  dataKey="revenue"
                  position="top"
                  offset={10}
                  className="fill-chart-1"
                  fontSize={12}
                  fontWeight={600}
                  formatter={(value: unknown) => formatManYen(Number(value))}
                />
              ) : null}
            </Line>
            <Line
              name="粗利"
              dataKey="grossProfit"
              type="linear"
              strokeWidth={2.5}
              stroke="var(--chart-series-3)"
              dot={{ r: 4, strokeWidth: 2, className: "fill-chart-3 stroke-surface" }}
              activeDot={{ r: 6, className: "fill-chart-3 stroke-surface" }}
              isAnimationActive={false}
            >
              {showLabels ? (
                <LabelList
                  dataKey="grossProfit"
                  position="bottom"
                  offset={10}
                  className="fill-chart-3"
                  fontSize={12}
                  fontWeight={600}
                  formatter={(value: unknown) => formatManYen(Number(value))}
                />
              ) : null}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>月次推移（売上・粗利）</caption>
        <thead>
          <tr>
            <th scope="col">月</th>
            <th scope="col">売上（円）</th>
            <th scope="col">粗利（円）</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.month}>
              <th scope="row">{formatMonthLabel(p.month)}</th>
              <td>{formatYen(p.revenue)}</td>
              <td>{formatYen(p.grossProfit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
