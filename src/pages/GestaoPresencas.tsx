import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/storage';
import type { Presenca, Funcionario, Obra } from '../types';
import { Edit2, Trash2, Save, X, AlertTriangle, Search, CheckCircle } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import ShareButton from '../components/ShareButton';
import { useAdminEmail } from '../hooks/useAdminEmail';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { JORNADA_META_MINUTOS, formatarMinutos, minutosTrabalhados } from '../utils/jornada';

const hoje = new Date().toISOString().split('T')[0];
const umMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const statusColor: Record<string, string> = { presente: '#059669', ausente: '#dc2626', 'meio-periodo': '#d97706' };
const statusClass: Record<string, string> = { presente: 'status-presente', ausente: 'status-ausente', 'meio-periodo': 'status-meio' };

function minutosDaJornada(p: Presenca) {
  return p.minutosTrabalhados ?? p.minutosTrabalhadosTotal ?? (p.horaSaida ? minutosTrabalhados(p, '00:00:00') : minutosTrabalhados(p));
}

function resumoJornada(p: Presenca) {
  const minutos = minutosDaJornada(p);
  if (!p.horaSaida) return `${formatarMinutos(minutos)} / ${formatarMinutos(JORNADA_META_MINUTOS)}`;
  return formatarMinutos(minutos);
}

export default function GestaoPresencas() {
  const [presencas, setPresencas]       = useState<Presenca[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [obras, setObras]               = useState<Obra[]>([]);
  const [carregando, setCarregando]     = useState(false);
  const [filtroFuncId, setFiltroFuncId] = useState('');
  const [filtroInicio, setFiltroInicio] = useState(umMesAtras);
  const [filtroFim, setFiltroFim]       = useState(hoje);
  const [filtroObra, setFiltroObra]     = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [editId, setEditId]             = useState<string | null>(null);
  const [editForm, setEditForm]         = useState<Partial<Presenca>>({});
  const [confirmExcluir, setConfirmExcluir] = useState<Presenca | null>(null);
  const [salvando, setSalvando]         = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);
  const { run } = useApi();
  const adminEmail = useAdminEmail();
  const { usuario } = useAuth();

  function buildRows() {
    return presencasFiltradas.map(p => {
      const f = funcionarios.find(x => x.id === p.funcionarioId);
      const o = obras.find(x => x.id === p.obraId);
      return {
        'Data': p.data,
        'Funcionário': f?.nome ?? p.funcionarioId,
        'Obra': o?.nome ?? p.obraId,
        'Entrada': p.horaEntrada,
        'Saída': p.horaSaida ?? '',
        'Jornada': resumoJornada(p),
        'Distância (m)': p.distanciaObra,
        'Status': p.status,
      };
    });
  }

  function buildTexto() {
    const porDataLocal = presencasFiltradas.reduce<Record<string, Presenca[]>>((acc, p) => {
      (acc[p.data] ??= []).push(p); return acc;
    }, {});
    const datasLocal = Object.keys(porDataLocal).sort((a, b) => b.localeCompare(a));
    const contadores = { presente: 0, ausente: 0, 'meio-periodo': 0 };
    presencasFiltradas.forEach(p => contadores[p.status]++);
    const linhas = datasLocal.map(data => {
      const resumo = porDataLocal[data].map(p => {
        const f = funcionarios.find(x => x.id === p.funcionarioId);
        const o = obras.find(x => x.id === p.obraId);
        return `  - ${f?.nome ?? p.funcionarioId} @ ${o?.nome ?? p.obraId}: ${p.horaEntrada}–${p.horaSaida ?? '?'} [${p.status}] | Jornada: ${resumoJornada(p)}`;
      });
      return `${data}\n${resumo.join('\n')}`;
    });
    return [
      `*Presenças ${filtroInicio} a ${filtroFim}*`,
      `Total: ${presencasFiltradas.length} | Presentes: ${contadores.presente} | Meio período: ${contadores['meio-periodo']} | Ausentes: ${contadores.ausente}`,
      '',
      ...linhas,
    ].join('\n');
  }

  useEffect(() => {
    run(() => Promise.all([db.getFuncionariosAsync(), db.getObrasAsync()]).then(([f, o]) => {
      setFuncionarios(f);
      setObras(o);
    }));
    buscar();
  }, []);

  async function buscar() {
    setCarregando(true);
    try {
      const params: { de?: string; ate?: string; funcionarioId?: string } = { de: filtroInicio, ate: filtroFim };
      if (filtroFuncId) params.funcionarioId = filtroFuncId;
      setPresencas(await db.getPresencasAsync(params));
    } finally { setCarregando(false); }
  }

  // filtros client-side (obra e status aplicados após busca)
  const presencasFiltradas = useMemo(() =>
    presencas.filter(p =>
      (!filtroObra || p.obraId === filtroObra) &&
      (!filtroStatus || p.status === filtroStatus)
    ), [presencas, filtroObra, filtroStatus]);

  // agrupa por data
  const porData = useMemo(() => presencasFiltradas.reduce<Record<string, Presenca[]>>((acc, p) => {
    (acc[p.data] ??= []).push(p); return acc;
  }, {}), [presencasFiltradas]);

  const datas = useMemo(() => Object.keys(porData).sort((a, b) => b.localeCompare(a)), [porData]);

  // pagina os grupos de data
  const pg = usePagination(datas, 5);

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

  async function autorizarHoraExtra(p: Presenca) {
    const dataRef = new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR');
    const confirmado = confirm(
      `Autorizar hora extra para ${dataRef}?\\n\\nAtenção: esta autorização é válida somente para o dia solicitado, salvo programação previamente acordada.`
    );
    if (!confirmado) return;
    const login = usuario?.login ?? 'admin';
    // atualiza estado local imediatamente
    setPresencas(prev => prev.map(x => x.id === p.id
      ? { ...x, horaExtraAutorizada: true, autorizadoPor: login }
      : x
    ));
    await api.autorizarHoraExtra(p.id, login);
  }

  const temFiltroExtra = filtroObra || filtroStatus;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Gestão de Presenças</h2>
        <ShareButton buildTexto={buildTexto} assunto={`Presenças ${filtroInicio} a ${filtroFim}`} adminEmail={adminEmail} buildRows={buildRows} exportFilename={`presencas_${filtroInicio}_${filtroFim}`} />
      </div>

      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="form-grid" style={{ alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">De</label>
            <input className="form-input" type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Até</label>
            <input className="form-input" type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Funcionário</label>
            <select className="form-input" value={filtroFuncId} onChange={e => setFiltroFuncId(e.target.value)}>
              <option value="">Todos</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Obra</label>
            <select className="form-input" value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
              <option value="">Todas</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="presente">Presente</option>
              <option value="meio-periodo">Meio período</option>
              <option value="ausente">Ausente</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button onClick={buscar} disabled={carregando} className="btn btn-primary" style={{ flex: 1 }}>
              <Search size={15} /> {carregando ? 'Buscando...' : 'Buscar'}
            </button>
            {temFiltroExtra && (
              <button className="btn btn-secondary" onClick={() => { setFiltroObra(''); setFiltroStatus(''); }} title="Limpar filtros extras">
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {presencasFiltradas.length > 0 && (
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          {presencasFiltradas.length} registro{presencasFiltradas.length !== 1 ? 's' : ''} em {datas.length} dia{datas.length !== 1 ? 's' : ''}
        </div>
      )}

      {datas.length === 0 && !carregando && (
        <div className="card card-body" style={{ textAlign: 'center', color: '#94a3b8' }}>
          Nenhuma presença encontrada para o período selecionado.
        </div>
      )}

      {pg.paged.map(data => (
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
                  <th>Funcionário</th><th>Obra</th><th>Entrada</th><th>Saída</th><th>Jornada</th>
                  <th>Dist.</th><th>Status</th><th>Fotos</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {porData[data].map(p => {
                  const f = funcionarios.find(x => x.id === p.funcionarioId);
                  const o = obras.find(x => x.id === p.obraId);
                  const longe = p.distanciaObra > 200;
                  const emEdicao = editId === p.id;
                  const minutosJornada = minutosDaJornada(p);
                  const abaixoMeta = Boolean(p.horaSaida && minutosJornada < JORNADA_META_MINUTOS);
                  const extraPendente = Boolean(p.horaSaida && minutosJornada > JORNADA_META_MINUTOS && !p.horaExtraAutorizada);
                  const extraAutorizada = Boolean(p.horaSaida && minutosJornada > JORNADA_META_MINUTOS && p.horaExtraAutorizada);

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
                      <td><input className="form-input" style={{ width: 80, fontSize: 13 }} value={editForm.horaEntrada ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, horaEntrada: e.target.value }))} /></td>
                      <td><input className="form-input" style={{ width: 80, fontSize: 13 }} value={editForm.horaSaida ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, horaSaida: e.target.value || undefined }))} /></td>
                      <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{resumoJornada(p)}</td>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, color: '#1e3a5f' }}>{resumoJornada(p)}</span>
                          {abaixoMeta && <span style={{ fontSize: 11, color: '#b45309' }}>Abaixo de 8h</span>}
                          {extraAutorizada && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ fontSize: 11, color: '#166534' }}>✅ Hora extra autorizada</span>
                              {p.autorizadoPor && <span style={{ fontSize: 10, color: '#64748b' }}>por {p.autorizadoPor}</span>}
                            </div>
                          )}
                        </div>
                      </td>
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
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {extraPendente && (
                            <button onClick={() => autorizarHoraExtra(p)} className="btn btn-warn btn-sm">Autorizar HE</button>
                          )}
                          {extraAutorizada && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, color: '#166534', whiteSpace: 'nowrap' }}>
                              <CheckCircle size={11} /> HE autorizada{p.autorizadoPor ? ` · ${p.autorizadoPor}` : ''}
                            </div>
                          )}
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

      {datas.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <Pagination page={pg.page} totalPages={pg.totalPages} pageSize={pg.pageSize} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </div>
      )}

      {confirmExcluir && (() => {
        const f = funcionarios.find(x => x.id === confirmExcluir.funcionarioId);
        return (
          <div className="modal-overlay">
            <div className="modal modal-sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#fef2f2', borderRadius: 8, padding: 10 }}><Trash2 size={22} color="#dc2626" /></div>
                <span className="modal-title">Excluir Presença</span>
              </div>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}><strong>{f?.nome}</strong></p>
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
