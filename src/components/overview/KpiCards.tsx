type Props = {
  items: Array<{ label: string; value: number | string }>;
};

export function KpiCards({ items }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">概览</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">{item.label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-800">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
