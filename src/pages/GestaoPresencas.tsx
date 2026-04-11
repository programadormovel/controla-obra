import { useState, useEffect } from 'react';
import { db } from '../services/storage';
import type { Presenca, Funcionario, Obra } from '../types';
import { Edit2, Trash2, Save, X, AlertTriangle, Search } from 'lucide-react';

const hoje = new Date().toISOString().split('T')[0];
const umMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const statusColor: Record<string, string> = { presente: '#059669', ausente: '#dc2626', 'meio-periodo': '#d97706' };
const statusClass: Record<string, string> = { presente: 'status-presente', ausente: 'status-ausente', 'meio-periodo': 'status-meio' };

export default function GestaoPresencas() {
  const [presencas, setPresencas]     = useState<Presenca[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [obras, setObras]             = useState<Obra[]>([]);
  const [carregando, setCarregando]   = useState(false);
  const [filtroFuncId, setFiltroFuncId] = useState('');
  const [filtroInicio, setFiltroInicio] = useState(umMesAtras);
  const [filtroFim, setFiltroFim]     = useState(hoje);
  const [editId, setEditId]           = useState<string | null>(null);
  const [editForm, setEditForm]       = useState<Partial<Presenca>>({});
  const [confirmExcluir, setConfirmExcluir] = useState<Presenca | null>(null);
  const [salvando, setSalvando]       = useState(false);
  const [erro, setErro]               = useState<string | null>(null);

  useEffect(() => {
    Promise.all([db.getFuncionariosAsync(), db.getObrasAsync()]).then(([f, o]) => {
      setFuncionarios(f);
      setObras(o);
    });
    buscar();
  }, []);

  async function buscar() {
    setCarregando(true);
    try {
      const params: { de?: string; ate?: string; funcionarioId?: string } = {
        de: filtroInicio, ate: filtroFim,
      };
      if (filtroFuncId) params.funcionarioId = filtroFuncId;
      setPresencas(await db.getPresencasAsync(params));
    } finally {
      setCarregando(false);
    }
  }

  function iniciarEdicao(p: Presenca) {
    setEditId(p.id);
    setEditForm({ funcionarioId: p.funcionarioId, obraId: p.obraId, horaEntrada: p.horaEntrada, horaSaida: p.horaSaida, status: p.status });
    setErro(null);
  }

  async function salvarEdicao(p: Presenca) {
    setSalvando(true); setErro(null);
    try {
      await db.savePresenca({ ...p, ...editForm });
      setEditId(null);
      await buscar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  async function excluir(p: Presenca) {
    await db.deletePresenca(p.id);
    setConfirmExcluir(null);
    await buscar();
  }

  // agrupa por data para exibição
  const porData = presencas.reduce<Record<string, Presenca[]>>((acc, p) => {
    (acc[p.data] ??= []).push(p);
    return acc;
  }, {});
  const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Gestão de Presenças</h2>
      </div>

      {/* Filtros */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="form-grid" style={{ alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">De</label>
            <input className="form-input" type="date" value={filtroInicio}
              onChange={e => setFiltroInicio(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Até</label>
            <input className="form-input" type="date" value={filtroFim}
              onChange={e => setFiltroFim(e.target.value)} />
          </div>
          <div className="form-full" style={{ minWidth: 180 }}>
            <label className="form-label">Funcionário</label>
            <select className="form-input" value={filtroFuncId}
              onChange={e => setFiltroFuncId(e.target.value)}>
              <option value="">Todos</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <button onClick={buscar} disabled={carregando} className="btn btn-primary" style={{ width: '100%' }}>
              <Search size={15} /> {carregando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {/* Resumo */}
      {presencas.length > 0 && (
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          {presencas.length} registro{presencas.length !== 1 ? 's' : ''} encontrado{presencas.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Tabela agrupada por data */}
      {datas.length === 0 && !carregando && (
        <div className="card card-body" style={{ textAlign: 'center', color: '#94a3b8' }}>
          Nenhuma presença encontrada para o período selecionado.
        </div>
      )}

      {datas.map(data => (
        <div key={data} className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px 8px 0 0' }}>
            <strong style={{ fontSize: 14, color: '#1e293b' }}>
              {new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </strong>
            <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>
              {porData[data].length} registro{porData[data].length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Obra</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Dist.</th>
                  <th>Status</th>
                  <th>Fotos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {porData[data].map(p => {
                  const f = funcionarios.find(x => x.id === p.funcionarioId);
                  const o = obras.find(x => x.id === p.obraId);
                  const longe = p.distanciaObra > 200;
                  const emEdicao = editId === p.id;

                  if (emEdicao) return (
                    <tr key={p.id} style={{ background: '#f0f9ff' }}>
                      <td>
                        <select className="form-input" style={{ fontSize: 13 }} value={editForm.funcionarioId}
                          onChange={e => setEditForm(f => ({ ...f, funcionarioId: e.target.value }))}>
                          {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-input" style={{ fontSize: 13 }} value={editForm.obraId}
                          onChange={e => setEditForm(f => ({ ...f, obraId: e.target.value }))}>
                          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                        </select>
                      </td>
                      <td>
                        <input className="form-input" style={{ width: 80, fontSize: 13 }} value={editForm.horaEntrada ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, horaEntrada: e.target.value }))} />
                      </td>
                      <td>
                        <input className="form-input" style={{ width: 80, fontSize: 13 }} value={editForm.horaSaida ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, horaSaida: e.target.value || undefined }))} />
                      </td>
                      <td style={{ color: '#94a3b8' }}>{p.distanciaObra}m</td>
                      <td>
                        <select className="form-input" style={{ fontSize: 13 }} value={editForm.status}
                          onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Presenca['status'] }))}>
                          <option value="presente">presente</option>
                          <option value="meio-periodo">meio-periodo</option>
                          <option value="ausente">ausente</option>
                        </select>
                      </td>
                      <td />
                      <td>
                        {erro && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 4 }}>{erro}</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => salvarEdicao(p)} disabled={salvando} className="btn btn-success btn-sm">
                            <Save size={12} /> {salvando ? '...' : 'Salvar'}
                          </button>
                          <button onClick={() => setEditId(null)} className="btn btn-secondary btn-sm"><X size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{f?.nome ?? p.funcionarioId}</td>
                      <td style={{ color: '#64748b' }}>{o?.nome ?? p.obraId}</td>
                      <td>{p.horaEntrada}</td>
                      <td>{p.horaSaida || '—'}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: longe ? '#dc2626' : '#059669', whiteSpace: 'nowrap' }}>
                          {longe && <AlertTriangle size={13} />}{p.distanciaObra}m
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass[p.status]}`}
                          style={{ background: statusColor[p.status] + '18', color: statusColor[p.status] }}>
                          {p.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {p.fotoEntrada && <a href={p.fotoEntrada} target="_blank" rel="noreferrer"><img src={p.fotoEntrada} alt="entrada" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} /></a>}
                          {p.fotoSaida   && <a href={p.fotoSaida}   target="_blank" rel="noreferrer"><img src={p.fotoSaida}   alt="saída"   style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} /></a>}
                          {!p.fotoEntrada && !p.fotoSaida && <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => iniciarEdicao(p)} className="btn btn-blue btn-sm"><Edit2 size={12} /> Editar</button>
                          <button onClick={() => setConfirmExcluir(p)}
                            className="btn btn-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Modal confirmar exclusão */}
      {confirmExcluir && (() => {
        const f = funcionarios.find(x => x.id === confirmExcluir.funcionarioId);
        return (
          <div className="modal-overlay">
            <div className="modal modal-sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#fef2f2', borderRadius: 8, padding: 10 }}><Trash2 size={22} color="#dc2626" /></div>
                <span className="modal-title">Excluir Presença</span>
              </div>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
                <strong>{f?.nome}</strong>
              </p>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                {new Date(confirmExcluir.data + 'T12:00:00').toLocaleDateString('pt-BR')} — Entrada: {confirmExcluir.horaEntrada}
              </p>
              <div className="alert alert-error" style={{ marginTop: 0, marginBottom: 20 }}>Esta ação é permanente e não pode ser desfeita.</div>
              <div className="modal-footer">
                <button onClick={() => setConfirmExcluir(null)} className="btn btn-secondary">Cancelar</button>
                <button onClick={() => excluir(confirmExcluir)} className="btn btn-danger"><Trash2 size={14} /> Excluir</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
