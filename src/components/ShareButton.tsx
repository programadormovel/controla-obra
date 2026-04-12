import { useState } from 'react';
import { Share2, MessageCircle, Mail, X } from 'lucide-react';

interface Props {
  buildTexto: () => string;
  assunto: string;
  adminEmail?: string | null;
}

export default function ShareButton({ buildTexto, assunto, adminEmail }: Props) {
  const [open, setOpen] = useState(false);

  function via(canal: 'whatsapp' | 'email') {
    const texto = buildTexto();
    if (canal === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    } else {
      const mailto = adminEmail ?? '';
      window.open(`mailto:${mailto}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`, '_blank');
    }
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} className="btn btn-secondary" title="Compartilhar">
        <Share2 size={15} /> Compartilhar
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 100,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 200, padding: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Enviar via</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={14} color="#94a3b8" /></button>
            </div>
            <button onClick={() => via('whatsapp')} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
              borderRadius: 6, fontSize: 14, color: '#16a34a', fontWeight: 500,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <MessageCircle size={16} /> WhatsApp
            </button>
            <button onClick={() => via('email')} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
              borderRadius: 6, fontSize: 14, color: '#2563eb', fontWeight: 500,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <Mail size={16} /> E-mail {adminEmail ? `(${adminEmail})` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
