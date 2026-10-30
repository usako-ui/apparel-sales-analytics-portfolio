// 集計の入口。画面・AI・テストはここから import する（集計はこの1か所だけ）
export {
  makeRatio,
  makeChange,
  explainReason,
  roundPercent,
  type Ratio,
  type Change,
  type ChangeReason,
} from "./ratio";
export { monthOf, previousMonth, isValidMonth } from "./month";
export { calcMonthlyKpis, type MonthlyKpi } from "./monthly";
export { calcRepeatOverall, calcMonthlyRepeat, type RepeatOverall, type MonthlyRepeat } from "./repeat";
export { ALL_PERIOD, rowsInPeriod, type DisplayPeriod } from "./period";
export { calcCategorySales, type CategorySales } from "./category";
export { calcSkuTop, SKU_TOP_LIMIT, type SkuSales } from "./sku";
export { loadSalesRows, toSalesRow, type LoadSalesRowsResult } from "./load";
