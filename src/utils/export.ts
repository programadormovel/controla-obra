import * as XLSX from 'xlsx';

export type ExportRow = Record<string, string | number>;

export function exportCsv(rows: ExportRow[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? '');
      return v.includes(';') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(';')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename + '.csv');
}

export function exportXlsx(rows: ExportRow[], filename: string, sheetName = 'Dados') {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  ws['!cols'] = headers.map(h => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length), 10),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename + '.xlsx');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
