export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  label = "items",
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (!total) return null;
  const pages = Math.ceil(total / pageSize),
    current = Math.min(page, pages - 1);
  const countLabel = total === 1 && label.endsWith("s") ? label.slice(0, -1) : label;
  return (
    <nav className="list-pagination" aria-label={`${label} pages`}>
      <span>
        {total} {countLabel} · Page {current + 1} of {pages}
      </span>
      <div>
        <button
          className="text-button"
          disabled={current === 0}
          onClick={() => onPageChange(current - 1)}
        >
          Previous
        </button>
        <button
          className="text-button"
          disabled={current + 1 === pages}
          onClick={() => onPageChange(current + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
