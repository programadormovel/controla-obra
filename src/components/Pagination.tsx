import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '../hooks/usePagination';

interface Props {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  start: number;
  end: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}

export default function Pagination({ page, totalPages, pageSize, total, start, end, onPage, onPageSize }: Props) {
  if (total === 0) return null;

  // em mobile mostra menos páginas
  const delta = window.innerWidth < 480 ? 1 : 2;
  const pages: (number | '...')[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > delta + 2) pages.push('...');
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) pages.push(i);
    if (page < totalPages - delta - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        <span>Linhas:</span>
        <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))}>
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>{start}–{end} de {total}</span>
      </div>

      <div className="pagination-nav">
        <button className="pg-btn" onClick={() => onPage(1)} disabled={page === 1} title="Primeira">
          <ChevronsLeft size={14} />
        </button>
        <button className="pg-btn" onClick={() => onPage(page - 1)} disabled={page === 1} title="Anterior">
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ width: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>…</span>
            : <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => onPage(p as number)}>{p}</button>
        )}

        <button className="pg-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages} title="Próxima">
          <ChevronRight size={14} />
        </button>
        <button className="pg-btn" onClick={() => onPage(totalPages)} disabled={page === totalPages} title="Última">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
