import { useState, useEffect } from 'react';
import { db } from '../services/storage';
import { api } from '../services/api';
import type { Funcionario, Obra } from '../types';
import { Edit2, X, Save, UserPlus, Trash2, UserX } from 'lucide-react';

const vazio: Omit<Funcionario, 'id'> = { nome: '', funcao: '', diaria: 0, transporte: 0, alimentacao: 0, telefone: '', ativo: true, obraId: null };

export default function Funcionarios() {
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [presencaIds, setPresencaIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<Omit<Funcionario, 'id'>>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<Funcionario | null>(null);

  async function carregar() {
    const [funcs, presencas, obrasLista] = await Promise.all([
      db.getFuncionariosAsync(),
      db.getPresencasAsync(),
      api.getObras(),
    ]);
    setLista(funcs);
    setPresencaIds(new Set(presencas.map(p => p.funcionarioId)));
    setObras(obrasLista);
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setForm(vazio); setEditando(null); setModal(true); }
  function abrirEdicao(f: Funcionario) {
    setForm({ nome: f.nome, funcao: f.funcao, diaria: f.diaria, transporte: f.transporte, alimentacao: f.alimentacao, telefone: f.telefone, ativo: f.ativo, obraId: f.obraId });
    setEditando(f); setModal(true);
  }
  function fechar() { setModal(false); setEditando(null); setForm(vazio); }

  async function salvar() {
    if (!form.nome || !form.funcao) return;
    setSalvando(true);
    const f: Funcionario = editando ? { ...form, id: editando.id } : { ...form, id: 'f' + Date.now() };
    await db.saveFuncionario(f);
    await carregar();
    setSalvando(false);
    fechar();
  }

  async function excluir(f: Funcionario) {
    await db.deleteFuncionario(f.id);
    await carregar();
    setConfirmExcluir(null);
  }

  async function desativar(f: Funcionario) {
    await db.saveFuncionario({ ...f, ativo: !f.ativo });
    await carregar();
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Funcionários</h2>
        <button onClick={abrirNovo} className="btn btn-primary"><UserPlus size={16} /> Novo Funcionário</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{['Nome', 'Função', 'Obra', 'Diária', 'Transporte', 'Aliment.', 'Total/Dia', 'Telefone', 'Status', 'Ações'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum funcionário cadastrado</td></tr>}
              {lista.map(f => {
                const temPresenca = presencaIds.has(f.id);
                const obraNome = obras.find(o => o.id === f.obraId)?.nome;
                return (
                  <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 500 }}>{f.nome}</td>
                    <td style={{ color: '#64748b' }}>{f.funcao}</td>
                    <td style={{ color: obraNome ? '#1e3a5f' : '#94a3b8', fontWeight: obraNome ? 500 : 400 }}>{obraNome ?? '—'}</td>
                    <td>R$ {f.diaria.toFixed(2)}</td>
                    <td>R$ {f.transporte.toFixed(2)}</td>
                    <td>R$ {f.alimentacao.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: '#1e3a5f' }}>R$ {(f.diaria + f.transporte + f.alimentacao).toFixed(2)}</td>
                    <td style={{ color: '#64748b' }}>{f.telefone}</td>
                    <td><span className={`status-badge ${f.ativo ? 'status-ativo' : 'status-inativo'}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => abrirEdicao(f)} className="btn btn-secondary btn-sm"><Edit2 size={12} /> Editar</button>
                        {temPresenca ? (
                          <button onClick={() => desativar(f)} className={`btn btn-sm ${f.ativo ? 'btn-warn' : 'btn-green'}`}>
                            <UserX size={12} /> {f.ativo ? 'Desativar' : 'Reativar'}
                          </button>
                        ) : (
                          <button onClick={() => setConfirmExcluir(f)} className="btn btn-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                            <Trash2 size={12} /> Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editando ? 'Editar Funcionário' : 'Novo Funcionário'}</span>
              <button className="btn-icon" onClick={fechar}><X size={20} /></button>
            </div>
            <div className="form-grid">
              <div className="form-full">
                <label className="form-label">Nome completo *</label>
                <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: João da Silva" />
              </div>
              <div className="form-full">
                <label className="form-label">Função *</label>
                <input className="form-input" value={form.funcao} onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))} placeholder="Ex: Pedreiro" />
              </div>
              <div className="form-full">
                <label className="form-label">Obra vinculada</label>
                <select className="form-input" value={form.obraId ?? ''} onChange={e => setForm(f => ({ ...f, obraId: e.target.value || null }))}>
                  <option value="">— Nenhuma —</option>
                  {obras.filter(o => o.ativa).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Diária (R$)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.diaria || ''} onChange={e => setForm(f => ({ ...f, diaria: +e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="form-label">Transporte (R$)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.transporte || ''} onChange={e => setForm(f => ({ ...f, transporte: +e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="form-label">Alimentação (R$)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.alimentacao || ''} onChange={e => setForm(f => ({ ...f, alimentacao: +e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="form-label">Custo Total/Dia</label>
                <div className="form-input" style={{ background: '#f8fafc', fontWeight: 700, color: '#1e3a5f' }}>
                  R$ {(form.diaria + form.transporte + form.alimentacao).toFixed(2)}
                </div>
              </div>
              <div className="form-full">
                <label className="form-label">Telefone</label>
                <input className="form-input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Ex: 11999990001" />
              </div>
              <div className="form-full form-check">
                <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                <label htmlFor="ativo">Funcionário ativo</label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={fechar} className="btn btn-secondary">Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome || !form.funcao} className="btn btn-primary">
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
              <span className="modal-title">Excluir Funcionário</span>
            </div>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>Tem certeza que deseja excluir:</p>
            <p style={{ fontWeight: 700, marginBottom: 20 }}>{confirmExcluir.nome} — {confirmExcluir.funcao}</p>
            <div className="alert alert-error" style={{ marginTop: 0, marginBottom: 20 }}>Esta ação é permanente e não pode ser desfeita.</div>
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
