type Props = {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export function Pagination({ page, totalPages, total, onPrev, onNext }: Props) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button className="btn-secondary" onClick={onPrev} disabled={page <= 1}>
        上一页
      </button>
      <button className="btn-secondary" onClick={onNext} disabled={page >= totalPages}>
        下一页
      </button>
      <span className="text-sm text-slate-500">{`第 ${page}/${totalPages} 页，共 ${total} 条`}</span>
    </div>
  );
}
