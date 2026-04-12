import { useState } from 'react';
import { Share2, MessageCircle, Mail, FileText, FileSpreadsheet, X } from 'lucide-react';
import { exportCsv, exportXlsx, type ExportRow } from '../utils/export';

interface Props {
  buildTexto: () => string;
  assunto: string;
  adminEmail?: string | null;
  buildRows?: () => ExportRow[];
  exportFilename?: string;
}

type Section = 'compartilhar' | 'exportar';

export default function ShareButton({ buildTexto, assunto, adminEmail, buildRows, exportFilename = 'export' }: Props) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>('compartilhar');

  function close() { setOpen(false); setSection('compartilhar'); }

  function via(canal: 'whatsapp' | 'email') {
    const texto = buildTexto();
    if (canal === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    } else {
      window.open(`mailto:${adminEmail ?? ''}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`, '_blank');
    }
    close();
  }

  function exportar(fmt: 'csv' | 'xlsx') {
    const rows = buildRows ? buildRows() : [];
    if (!rows.length) return close();
    if (fmt === 'csv') exportCsv(rows, exportFilename);
    else exportXlsx(rows, exportFilename, assunto.slice(0, 31));
    close();
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
    borderRadius: 6, fontSize: 14, fontWeight: 500, textAlign: 'left',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 0', fontSize: 12, fontWeight: active ? 700 : 500,
    background: active ? '#1e3a5f' : '#f1f5f9', color: active ? '#fff' : '#64748b',
    border: 'none', cursor: 'pointer', borderRadius: 5, transition: 'all .15s',
  });

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} className="btn btn-secondary" title="Compartilhar / Exportar">
        <Share2 size={15} /> Exportar
      </button>

      {open && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 100,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.13)', minWidth: 220, padding: 8,
          }}>
            {/* header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px 8px', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <button style={tabStyle(section === 'compartilhar')} onClick={() => setSection('compartilhar')}>
                  Compartilhar
                </button>
                {buildRows && (
                  <button style={tabStyle(section === 'exportar')} onClick={() => setSection('exportar')}>
                    Exportar
                  </button>
                )}
              </div>
              <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px' }}>
                <X size={14} color="#94a3b8" />
              </button>
            </div>

            {section === 'compartilhar' && (
              <>
                <button
                  onClick={() => via('whatsapp')}
                  style={{ ...itemStyle, color: '#16a34a' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
                <button
                  onClick={() => via('email')}
                  style={{ ...itemStyle, color: '#2563eb' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <Mail size={16} />
                  <span>E-mail{adminEmail ? <> <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({adminEmail})</span></> : ''}</span>
                </button>
              </>
            )}

            {section === 'exportar' && buildRows && (
              <>
                <button
                  onClick={() => exportar('csv')}
                  style={{ ...itemStyle, color: '#0f766e' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdfa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <FileText size={16} /> CSV (.csv)
                </button>
                <button
                  onClick={() => exportar('xlsx')}
                  style={{ ...itemStyle, color: '#15803d' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <FileSpreadsheet size={16} /> Excel (.xlsx)
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
