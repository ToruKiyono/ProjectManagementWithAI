import type { VersionOption } from "../../domain/models/version";

type Props = {
  value: string;
  options: VersionOption[];
  hint: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

export function VersionFilter({ value, options, hint, onChange, onClear }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">版本筛选</div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="ALL">全部版本</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button className="btn-secondary" onClick={onClear}>清除筛选</button>
        <div className="flex items-center text-sm text-slate-500">{hint}</div>
      </div>
    </section>
  );
}
