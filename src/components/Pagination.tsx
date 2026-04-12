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

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 6,
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151',
    transition: 'all .15s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
        <span>Linhas por página:</span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer' }}
        >
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: 4 }}>
          {start}–{end} de {total}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={() => onPage(1)} disabled={page === 1} style={{ ...btnBase, opacity: page === 1 ? .4 : 1 }} title="Primeira">
          <ChevronsLeft size={14} />
        </button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} style={{ ...btnBase, opacity: page === 1 ? .4 : 1 }} title="Anterior">
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ width: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>…</span>
            : <button key={p} onClick={() => onPage(p as number)} style={{
                ...btnBase,
                background: p === page ? '#1e3a5f' : '#fff',
                color: p === page ? '#fff' : '#374151',
                borderColor: p === page ? '#1e3a5f' : '#e2e8f0',
                fontWeight: p === page ? 700 : 400,
              }}>{p}</button>
        )}

        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={{ ...btnBase, opacity: page === totalPages ? .4 : 1 }} title="Próxima">
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} style={{ ...btnBase, opacity: page === totalPages ? .4 : 1 }} title="Última">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
