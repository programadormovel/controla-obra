import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import type { Cargo } from '../types';
import { Plus, Edit2, X, Save, Trash2, Search } from 'lucide-react';
import ShareButton from '../components/ShareButton';
import { useAdminEmail } from '../hooks/useAdminEmail';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

const vazio: Omit<Cargo, 'id'> = { nome: '', diaria: 0, transporte: 0, alimentacao: 0 };

export default function Cargos() {
  const [lista, setLista] = useState<Cargo[]>([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Cargo | null>(null);
  const [form, setForm] = useState<Omit<Cargo, 'id'>>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<Cargo | null>(null);
  const [busca, setBusca] = useState('');
  const adminEmail = useAdminEmail();

  const filtrada = useMemo(() => {
    const b = busca.toLowerCase();
    return lista.filter(c => !b || c.nome.toLowerCase().includes(b));
  }, [lista, busca]);

  const pg = usePagination(filtrada);

  function buildRows() {
    return lista.map(c => ({
      'Cargo': c.nome,
      'Diária (R$)': c.diaria,
      'Transporte (R$)': c.transporte,
      'Alimentação (R$)': c.alimentacao,
      'Total/Dia (R$)': +(c.diaria + c.transporte + c.alimentacao).toFixed(2),
    }));
  }

  function buildTexto() {
    const linhas = lista.map(c =>
      `• ${c.nome} — Diária: R$${c.diaria.toFixed(2)} | Transp: R$${c.transporte.toFixed(2)} | Alim: R$${c.alimentacao.toFixed(2)} | Total: R$${(c.diaria + c.transporte + c.alimentacao).toFixed(2)}`
    );
    return `*Cargos Cadastrados*\n${linhas.join('\n')}`;
  }

  async function carregar() { setLista(await api.getCargos()); }
  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setForm(vazio); setEditando(null); setModal(true); }
  function abrirEdicao(c: Cargo) { setForm({ nome: c.nome, diaria: c.diaria, transporte: c.transporte, alimentacao: c.alimentacao }); setEditando(c); setModal(true); }
  function fechar() { setModal(false); setEditando(null); setForm(vazio); }

  async function salvar() {
    if (!form.nome) return;
    setSalvando(true);
    await api.saveCargo({ id: editando?.id ?? 'c' + Date.now(), ...form });
    await carregar();
    setSalvando(false);
    fechar();
  }

  async function excluir(c: Cargo) {
    await api.deleteCargo(c.id);
    await carregar();
    setConfirmExcluir(null);
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Cargos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <ShareButton buildTexto={buildTexto} assunto="Cargos Cadastrados" adminEmail={adminEmail} buildRows={buildRows} exportFilename="cargos" />
          <button onClick={abrirNovo} className="btn btn-primary"><Plus size={16} /> Novo Cargo</button>
        </div>
      </div>

      <div className="card card-body" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={15} color="#94a3b8" />
          <input className="form-input" style={{ maxWidth: 280 }} placeholder="Buscar cargo..." value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button className="btn btn-secondary btn-sm" onClick={() => setBusca('')}>Limpar</button>}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{['Cargo', 'Diária', 'Transporte', 'Alimentação', 'Total/Dia', 'Ações'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {pg.paged.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>{busca ? 'Nenhum cargo encontrado' : 'Nenhum cargo cadastrado'}</td></tr>}
              {pg.paged.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.nome}</td>
                  <td>R$ {c.diaria.toFixed(2)}</td>
                  <td>R$ {c.transporte.toFixed(2)}</td>
                  <td>R$ {c.alimentacao.toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: '#1e3a5f' }}>R$ {(c.diaria + c.transporte + c.alimentacao).toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => abrirEdicao(c)} className="btn btn-secondary btn-sm"><Edit2 size={12} /> Editar</button>
                      <button onClick={() => setConfirmExcluir(c)} className="btn btn-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={pg.page} totalPages={pg.totalPages} pageSize={pg.pageSize} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editando ? 'Editar Cargo' : 'Novo Cargo'}</span>
              <button className="btn-icon" onClick={fechar}><X size={20} /></button>
            </div>
            <div className="form-grid">
              <div className="form-full">
                <label className="form-label">Nome do cargo *</label>
                <input className="form-input" value={form.nome} onChange={set('nome')} placeholder="Ex: Pedreiro" />
              </div>
              <div>
                <label className="form-label">Diária (R$)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.diaria || ''} onChange={set('diaria')} placeholder="0,00" />
              </div>
              <div>
                <label className="form-label">Transporte (R$)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.transporte || ''} onChange={set('transporte')} placeholder="0,00" />
              </div>
              <div>
                <label className="form-label">Alimentação (R$)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.alimentacao || ''} onChange={set('alimentacao')} placeholder="0,00" />
              </div>
              <div>
                <label className="form-label">Total/Dia</label>
                <div className="form-input" style={{ background: '#f8fafc', fontWeight: 700, color: '#1e3a5f' }}>
                  R$ {(form.diaria + form.transporte + form.alimentacao).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={fechar} className="btn btn-secondary">Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome} className="btn btn-primary">
                <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmExcluir && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: 10 }}><Trash2 size={22} color="#dc2626" /></div>
              <span className="modal-title">Excluir Cargo</span>
            </div>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>Tem certeza que deseja excluir:</p>
            <p style={{ fontWeight: 700, marginBottom: 20 }}>{confirmExcluir.nome}</p>
            <div className="modal-footer">
              <button onClick={() => setConfirmExcluir(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => excluir(confirmExcluir)} className="btn btn-danger"><Trash2 size={14} /> Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
