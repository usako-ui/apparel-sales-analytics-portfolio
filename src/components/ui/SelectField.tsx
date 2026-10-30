import { useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { cx } from "./cx";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
};

// 選択欄（ロール・状態の選択に使う）。ラベルは必ず付ける
export function SelectField({ label, options, className, ...rest }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        className={cx(
          "min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-body text-ink",
          className,
        )}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
