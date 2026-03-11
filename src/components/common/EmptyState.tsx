type Props = {
  title?: string;
  description: string;
};

export function EmptyState({ title = "暂无数据", description }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-2 text-sm text-slate-500">{description}</div>
    </div>
  );
}
