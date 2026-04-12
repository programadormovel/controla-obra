import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/storage';
import type { Obra } from '../types';
import { Plus, Edit2, X, Save, MapPin, Trash2, Building2, Search } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import ShareButton from '../components/ShareButton';
import { useAdminEmail } from '../hooks/useAdminEmail';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

const vazio: Omit<Obra, 'id'> = { nome: '', endereco: '', lat: 0, lng: 0, ativa: true };

export default function Obras() {
  const [lista, setLista] = useState<Obra[]>([]);
  const [presencaObraIds, setPresencaObraIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Obra | null>(null);
  const [form, setForm] = useState<Omit<Obra, 'id'>>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [buscandoGeo, setBuscandoGeo] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<Obra | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { run } = useApi();
  const adminEmail = useAdminEmail();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'inativa'>('todas');

  const filtrada = useMemo(() => {
    const b = busca.toLowerCase();
    return lista.filter(o =>
      (!b || o.nome.toLowerCase().includes(b) || o.endereco.toLowerCase().includes(b)) &&
      (filtroStatus === 'todas' || (filtroStatus === 'ativa' ? o.ativa : !o.ativa))
    );
  }, [lista, busca, filtroStatus]);

  const pg = usePagination(filtrada);

  function buildRows() {
    return lista.map(o => ({
      'Nome': o.nome,
      'Endereço': o.endereco,
      'Latitude': o.lat,
      'Longitude': o.lng,
      'Status': o.ativa ? 'Ativa' : 'Inativa',
    }));
  }

  function buildTexto() {
    const linhas = lista.map(o =>
      `• ${o.nome} — ${o.endereco} [${o.ativa ? 'Ativa' : 'Inativa'}]`
    );
    return `*Obras Cadastradas*\n${linhas.join('\n')}`;
  }

  async function carregar() {
    await run(async () => {
      const [obras, presencas] = await Promise.all([db.getObrasAsync(), db.getPresencasAsync()]);
      setLista(obras);
      setPresencaObraIds(new Set(presencas.map(p => p.obraId)));
    });
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setForm(vazio); setEditando(null); setErro(null); setModal(true); }
  function abrirEdicao(o: Obra) {
    setForm({ nome: o.nome, endereco: o.endereco, lat: o.lat, lng: o.lng, ativa: o.ativa });
    setEditando(o); setErro(null); setModal(true);
  }
  function fechar() { setModal(false); setEditando(null); setForm(vazio); setErro(null); }

  function usarGeoAtual() {
    if (!navigator.geolocation) return;
    setBuscandoGeo(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, lat: +pos.coords.latitude.toFixed(7), lng: +pos.coords.longitude.toFixed(7) })); setBuscandoGeo(false); },
      () => setBuscandoGeo(false)
    );
  }

  async function salvar() {
    if (!form.nome || !form.endereco) return;
    setSalvando(true); setErro(null);
    try {
      const o: Obra = editando ? { ...form, id: editando.id } : { ...form, id: 'o' + Date.now() };
      await db.saveObra(o);
      await carregar();
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar obra');
    } finally { setSalvando(false); }
  }

  async function excluir(o: Obra) {
    await db.deleteObra(o.id);
    await carregar();
    setConfirmExcluir(null);
  }

  async function alterarAtiva(o: Obra) {
    await db.saveObra({ ...o, ativa: !o.ativa });
    await carregar();
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Obras</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <ShareButton buildTexto={buildTexto} assunto="Obras Cadastradas" adminEmail={adminEmail} buildRows={buildRows} exportFilename="obras" />
          <button onClick={abrirNovo} className="btn btn-primary"><Plus size={16} /> Nova Obra</button>
        </div>
      </div>
      <div className="card card-body" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Search size={15} color="#94a3b8" />
          <input className="form-input" style={{ maxWidth: 260 }} placeholder="Buscar nome ou endereço..." value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="form-input" style={{ width: 'auto' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}>
            <option value="todas">Todas</option>
            <option value="ativa">Ativas</option>
            <option value="inativa">Inativas</option>
          </select>
          {(busca || filtroStatus !== 'todas') && <button className="btn btn-secondary btn-sm" onClick={() => { setBusca(''); setFiltroStatus('todas'); }}>Limpar</button>}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{['Nome', 'Endereço', 'Latitude', 'Longitude', 'Status', 'Ações'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {pg.paged.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>{busca || filtroStatus !== 'todas' ? 'Nenhuma obra encontrada' : 'Nenhuma obra cadastrada'}</td></tr>}
              {pg.paged.map(o => {
                const temPresenca = presencaObraIds.has(o.id);
                return (
                  <tr key={o.id} style={{ opacity: o.ativa ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Building2 size={14} color="#1e3a5f" />{o.nome}
                      </div>
                    </td>
                    <td style={{ color: '#64748b', maxWidth: 220 }}>{o.endereco}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{o.lat.toFixed(5)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{o.lng.toFixed(5)}</td>
                    <td>
                      <span className={`status-badge ${o.ativa ? 'status-ativo' : 'status-inativo'}`}>
                        {o.ativa ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => abrirEdicao(o)} className="btn btn-secondary btn-sm"><Edit2 size={12} /> Editar</button>
                        {temPresenca ? (
                          <button onClick={() => alterarAtiva(o)} className={`btn btn-sm ${o.ativa ? 'btn-warn' : 'btn-green'}`}>
                            <Building2 size={12} /> {o.ativa ? 'Desativar' : 'Reativar'}
                          </button>
                        ) : (
                          <button onClick={() => setConfirmExcluir(o)} className="btn btn-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
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
        <Pagination page={pg.page} totalPages={pg.totalPages} pageSize={pg.pageSize} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </div>
      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editando ? 'Editar Obra' : 'Nova Obra'}</span>
              <button className="btn-icon" onClick={fechar}><X size={20} /></button>
            </div>
            <div className="form-grid">
              <div className="form-full">
                <label className="form-label">Nome da obra *</label>
                <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Residência Jardins" />
              </div>
              <div className="form-full">
                <label className="form-label">Endereço *</label>
                <input className="form-input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Ex: Rua das Flores, 123" />
              </div>
              <div>
                <label className="form-label">Latitude</label>
                <input className="form-input" type="number" step="0.0000001" value={form.lat || ''} onChange={e => setForm(f => ({ ...f, lat: +e.target.value }))} placeholder="-23.5614000" />
              </div>
              <div>
                <label className="form-label">Longitude</label>
                <input className="form-input" type="number" step="0.0000001" value={form.lng || ''} onChange={e => setForm(f => ({ ...f, lng: +e.target.value }))} placeholder="-46.6558000" />
              </div>
              <div className="form-full">
                <button onClick={usarGeoAtual} disabled={buscandoGeo} className="btn btn-green btn-sm">
                  <MapPin size={14} /> {buscandoGeo ? 'Obtendo...' : 'Usar minha localização'}
                </button>
                {form.lat !== 0 && form.lng !== 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>GPS: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</div>
                )}
              </div>
              <div className="form-full form-check">
                <input type="checkbox" id="ativa" checked={form.ativa} onChange={e => setForm(f => ({ ...f, ativa: e.target.checked }))} />
                <label htmlFor="ativa">Obra ativa</label>
              </div>
            </div>
            {erro && <div className="alert alert-error">{erro}</div>}
            <div className="modal-footer">
              <button onClick={fechar} className="btn btn-secondary">Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome || !form.endereco} className="btn btn-primary">
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
              <span className="modal-title">Excluir Obra</span>
            </div>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>Tem certeza que deseja excluir:</p>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>{confirmExcluir.nome}</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{confirmExcluir.endereco}</p>
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
