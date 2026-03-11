import { EmptyState } from "../common/EmptyState";
import { Tag } from "../common/Tag";

type OwnerItem = { name: string; count: number };

type Props = {
  title: string;
  description: string;
  items: OwnerItem[];
  tone?: "default" | "ok" | "warn" | "danger";
};

export function OwnerListPanel({ title, description, items, tone = "default" }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{description}</div>
      <div className="mt-4">
        {items.length ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <Tag key={item.name} tone={tone}>{item.name} {item.count}</Tag>
            ))}
          </div>
        ) : <EmptyState description="当前范围暂无责任人数据" />}
      </div>
    </section>
  );
}

export const renderRiskOwnerList = OwnerListPanel;
