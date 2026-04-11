import { useState, useEffect, useRef, useCallback } from 'react';
import { db, distanciaMetros } from '../services/storage';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Presenca as PresencaType, Funcionario } from '../types';
import { MapPin, CheckCircle, Clock, AlertTriangle, Edit2, Trash2, Save, X, Camera, RotateCcw } from 'lucide-react';

// ── Componente de câmera ──────────────────────────────────────────────────────
function CapturarFoto({ onCapturar, onCancelar }: { onCapturar: (blob: Blob) => void; onCancelar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const iniciarCamera = useCallback(async () => {
    setPreview(null); setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setErro('Não foi possível acessar a câmera.');
    }
  }, []);

  useEffect(() => {
    iniciarCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [iniciarCamera]);

  function capturar() {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    // espelha horizontalmente (selfie natural)
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL('image/jpeg', 0.8));
  }

  function confirmar() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => { if (blob) { streamRef.current?.getTracks().forEach(t => t.stop()); onCapturar(blob); } }, 'image/jpeg', 0.8);
  }

  function refazer() { setPreview(null); iniciarCamera(); }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 }}>
      <p style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>Tire uma selfie para confirmar sua presença</p>

      {erro && <p style={{ color: '#f87171', fontSize: 13 }}>{erro}</p>}

      {!preview ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', maxWidth: 400, borderRadius: 12, transform: 'scaleX(-1)' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onCancelar} className="btn btn-secondary"><X size={16} /> Cancelar</button>
            <button onClick={capturar} className="btn btn-primary"><Camera size={16} /> Capturar</button>
          </div>
        </>
      ) : (
        <>
          <img src={preview} alt="preview" style={{ width: '100%', maxWidth: 400, borderRadius: 12 }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={refazer} className="btn btn-secondary"><RotateCcw size={16} /> Refazer</button>
            <button onClick={confirmar} className="btn btn-success"><CheckCircle size={16} /> Usar esta foto</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Presenca() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [obras, setObras]               = useState(() => db.getObras().filter(o => o.ativa));
  const [presencas, setPresencas]       = useState<PresencaType[]>([]);
  const [geo, setGeo]                   = useState<{ lat: number; lng: number } | null>(null);
  const [geoErro, setGeoErro]           = useState(() => navigator.geolocation ? '' : 'Geolocalização não suportada');
  const [msg, setMsg]                   = useState('');
  const [salvando, setSalvando]         = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [editForm, setEditForm]         = useState<Partial<PresencaType>>({});

  // câmera
  const [cameraAberta, setCameraAberta] = useState(false);
  const pendingRef = useRef<{ tipo: 'entrada' | 'saida'; presenca?: PresencaType } | null>(null);

  const [form, setForm] = useState({ funcionarioId: '', obraId: '', status: 'presente' as PresencaType['status'] });

  const hoje = new Date().toISOString().split('T')[0];
  const presencasHoje = presencas.filter(p => p.data === hoje);

  const funcLogado     = funcionarios.find(f => f.id === usuario?.funcionarioId);
  const obraFuncLogado = obras.find(o => o.id === funcLogado?.obraId);

  const presencaHoje = !isAdmin ? presencasHoje.find(p => p.funcionarioId === usuario?.funcionarioId) : null;
  const temEntrada   = !!presencaHoje;
  const temSaida     = !!presencaHoje?.horaSaida;

  function carregarPresencas() {
    const params = !isAdmin && usuario?.funcionarioId
      ? { data: hoje, funcionarioId: usuario.funcionarioId }
      : { data: hoje };
    return db.getPresencasAsync(params).then(setPresencas);
  }

  useEffect(() => {
    db.getFuncionariosAsync().then(l => setFuncionarios(l.filter(f => f.ativo)));
    db.getObrasAsync().then(l => setObras(l.filter(o => o.ativa)));
    carregarPresencas();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoErro('Não foi possível obter localização.')
    );
  }, []);

  function obraIdEfetivo(funcId: string): string {
    if (!isAdmin) return funcLogado?.obraId ?? '';
    return funcionarios.find(f => f.id === funcId)?.obraId || form.obraId;
  }

  // Abre câmera e guarda o que fazer após a foto
  function pedirFoto(tipo: 'entrada' | 'saida', presenca?: PresencaType) {
    pendingRef.current = { tipo, presenca };
    setCameraAberta(true);
  }

  async function aoCapturar(blob: Blob) {
    setCameraAberta(false);
    const pending = pendingRef.current;
    if (!pending) return;

    if (pending.tipo === 'entrada') {
      await executarRegistro(blob);
    } else {
      await executarSaida(pending.presenca!, blob);
    }
  }

  async function executarRegistro(foto: Blob) {
    const funcId = isAdmin ? form.funcionarioId : (usuario?.funcionarioId ?? '');
    const obraId = obraIdEfetivo(funcId);
    if (!funcId || !obraId || !geo) return;

    const obra = obras.find(o => o.id === obraId)!;
    const dist = distanciaMetros(geo.lat, geo.lng, obra.lat, obra.lng);
    const nova: PresencaType = {
      id: 'p' + Date.now(), funcionarioId: funcId, obraId,
      data: hoje, horaEntrada: new Date().toTimeString().slice(0, 8),
      lat: geo.lat, lng: geo.lng, distanciaObra: dist,
      status: isAdmin ? form.status : 'presente',
    };
    setSalvando(true);
    try {
      await db.savePresenca(nova);
      await api.uploadFoto(nova.id, 'entrada', foto);
      await carregarPresencas();
      setMsg(`Presença registrada! Distância da obra: ${dist}m`);
      if (isAdmin) setForm(f => ({ ...f, obraId: '', status: 'presente' }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao registrar');
    } finally { setSalvando(false); }
  }

  async function executarSaida(p: PresencaType, foto: Blob) {
    setSalvando(true);
    try {
      await db.savePresenca({ ...p, horaSaida: new Date().toTimeString().slice(0, 8) });
      await api.uploadFoto(p.id, 'saida', foto);
      await carregarPresencas();
    } finally { setSalvando(false); }
  }

  // Validações antes de abrir câmera
  function iniciarRegistro() {
    const funcId = isAdmin ? form.funcionarioId : (usuario?.funcionarioId ?? '');
    const obraId = obraIdEfetivo(funcId);
    if (!funcId)  { setMsg('Selecione o funcionário.'); return; }
    if (!obraId)  { setMsg(isAdmin ? 'Selecione a obra.' : 'Funcionário não possui obra vinculada.'); return; }
    if (!geo)     { setMsg('Aguardando localização GPS...'); return; }
    if (presencasHoje.find(p => p.funcionarioId === funcId)) { setMsg('Funcionário já possui entrada registrada hoje.'); return; }
    setMsg('');
    pedirFoto('entrada');
  }

  async function salvarEdicao(p: PresencaType) {
    await db.savePresenca({ ...p, ...editForm });
    setEditId(null);
    await carregarPresencas();
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta presença?')) return;
    await db.deletePresenca(id);
    await carregarPresencas();
  }

  const statusColor: Record<string, string> = { presente: '#059669', ausente: '#dc2626', 'meio-periodo': '#d97706' };
  const statusClass: Record<string, string> = { presente: 'status-presente', ausente: 'status-ausente', 'meio-periodo': 'status-meio' };
  const mostrarPainel = isAdmin || !temSaida;

  return (
    <>
      {cameraAberta && (
        <CapturarFoto
          onCapturar={aoCapturar}
          onCancelar={() => { setCameraAberta(false); pendingRef.current = null; }}
        />
      )}

      <div>
        <div className="page-header">
          <h2 className="page-title">Presença</h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>

        <div className="presenca-layout">

          {mostrarPainel && (
            <div className="card card-body presenca-panel">
              <h3 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 15 }}>
                {!isAdmin && temEntrada ? 'Registrar Saída' : 'Registrar Presença'}
              </h3>

              <div className={`geo-bar ${geo ? 'geo-ok' : 'geo-wait'}`}>
                <MapPin size={16} color={geo ? '#059669' : '#d97706'} />
                <span style={{ fontSize: 13 }}>
                  {geo ? `GPS: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : geoErro || 'Obtendo localização...'}
                </span>
              </div>

              {isAdmin ? (
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">Funcionário</label>
                  <select className="form-input" value={form.funcionarioId}
                    onChange={e => setForm(f => ({ ...f, funcionarioId: e.target.value, obraId: '' }))}>
                    <option value="">Selecione...</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.funcao}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ marginBottom: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                  <strong>Funcionário:</strong> {usuario?.funcionarioNome}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Obra</label>
                {isAdmin ? (() => {
                  const funcSel = funcionarios.find(f => f.id === form.funcionarioId);
                  const obraVinculada = obras.find(o => o.id === funcSel?.obraId);
                  return obraVinculada ? (
                    <div style={{ padding: '9px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 14, color: '#166534' }}>
                      {obraVinculada.nome} <span style={{ fontSize: 12, color: '#86efac' }}>(vínculo)</span>
                    </div>
                  ) : (
                    <select className="form-input" value={form.obraId}
                      onChange={e => setForm(f => ({ ...f, obraId: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  );
                })() : (
                  <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, color: obraFuncLogado ? '#1e3a5f' : '#94a3b8' }}>
                    {obraFuncLogado ? obraFuncLogado.nome : '— Nenhuma obra vinculada —'}
                  </div>
                )}
              </div>

              {isAdmin && (
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as PresencaType['status'] }))}>
                    <option value="presente">Presente</option>
                    <option value="meio-periodo">Meio Período</option>
                    <option value="ausente">Ausente</option>
                  </select>
                </div>
              )}

              {(() => {
                if (!isAdmin && temEntrada) {
                  return (
                    <button onClick={() => pedirFoto('saida', presencaHoje!)} disabled={salvando}
                      className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                      <Camera size={16} /> {salvando ? 'Salvando...' : 'Selfie + Registrar Saída'}
                    </button>
                  );
                }
                if (isAdmin) {
                  const funcSelPresenca = presencasHoje.find(p => p.funcionarioId === form.funcionarioId);
                  if (funcSelPresenca && !funcSelPresenca.horaSaida) {
                    return (
                      <button onClick={() => pedirFoto('saida', funcSelPresenca)} disabled={salvando}
                        className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                        <Camera size={16} /> Selfie + Registrar Saída
                      </button>
                    );
                  }
                  if (funcSelPresenca?.horaSaida) {
                    return (
                      <div className="alert alert-success" style={{ marginTop: 4 }}>
                        ✓ Ponto completo. Entrada: {funcSelPresenca.horaEntrada} — Saída: {funcSelPresenca.horaSaida}
                      </div>
                    );
                  }
                }
                return (
                  <button onClick={iniciarRegistro} disabled={salvando}
                    className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                    <Camera size={16} /> {salvando ? 'Salvando...' : 'Selfie + Registrar Presença'}
                  </button>
                );
              })()}

              {msg && (
                <div className={`alert ${msg.startsWith('Presença') ? 'alert-success' : 'alert-error'}`}>{msg}</div>
              )}
            </div>
          )}

          {!isAdmin && temSaida && (
            <div className="card card-body presenca-panel">
              <div className="alert alert-success" style={{ marginTop: 0 }}>
                ✓ Ponto completo registrado hoje. Entrada: {presencaHoje?.horaEntrada} — Saída: {presencaHoje?.horaSaida}
              </div>
              {presencaHoje?.fotoEntrada && (
                <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Entrada</p>
                    <img src={presencaHoje.fotoEntrada} alt="foto entrada" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid #bbf7d0' }} />
                  </div>
                  {presencaHoje?.fotoSaida && (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Saída</p>
                      <img src={presencaHoje.fotoSaida} alt="foto saída" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid #bbf7d0' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card presenca-table">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: 15 }}>
                {isAdmin ? 'Presenças de Hoje' : 'Meu Ponto de Hoje'}
              </h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {isAdmin && <th>Funcionário</th>}
                    <th>Obra</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                    <th>Dist.</th>
                    <th>Status</th>
                    {isAdmin && <th>Fotos</th>}
                    {isAdmin && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {presencasHoje.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                        Nenhuma presença hoje
                      </td>
                    </tr>
                  )}
                  {presencasHoje.map(p => {
                    const f = funcionarios.find(x => x.id === p.funcionarioId);
                    const o = obras.find(x => x.id === p.obraId);
                    const longe = p.distanciaObra > 200;
                    const emEdicao = isAdmin && editId === p.id;

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
                        <td><input className="form-input" style={{ width: 80, fontSize: 13 }} value={editForm.horaEntrada}
                          onChange={e => setEditForm(f => ({ ...f, horaEntrada: e.target.value }))} /></td>
                        <td><input className="form-input" style={{ width: 80, fontSize: 13 }} value={editForm.horaSaida ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, horaSaida: e.target.value || undefined }))} /></td>
                        <td style={{ color: '#94a3b8' }}>{p.distanciaObra}m</td>
                        <td>
                          <select className="form-input" style={{ fontSize: 13 }} value={editForm.status}
                            onChange={e => setEditForm(f => ({ ...f, status: e.target.value as PresencaType['status'] }))}>
                            <option value="presente">presente</option>
                            <option value="meio-periodo">meio-periodo</option>
                            <option value="ausente">ausente</option>
                          </select>
                        </td>
                        <td />
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => salvarEdicao(p)} className="btn btn-success btn-sm"><Save size={12} /></button>
                            <button onClick={() => setEditId(null)} className="btn btn-secondary btn-sm"><X size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );

                    return (
                      <tr key={p.id}>
                        {isAdmin && <td style={{ fontWeight: 500 }}>{f?.nome}</td>}
                        <td style={{ color: '#64748b' }}>{o?.nome}</td>
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
                        {isAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {p.fotoEntrada && <a href={p.fotoEntrada} target="_blank" rel="noreferrer"><img src={p.fotoEntrada} alt="entrada" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} /></a>}
                              {p.fotoSaida   && <a href={p.fotoSaida}   target="_blank" rel="noreferrer"><img src={p.fotoSaida}   alt="saída"   style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} /></a>}
                              {!p.fotoEntrada && !p.fotoSaida && <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>}
                            </div>
                          </td>
                        )}
                        {isAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {!p.horaSaida && (
                                <button onClick={() => pedirFoto('saida', p)} className="btn btn-secondary btn-sm">
                                  <Camera size={12} /> Saída
                                </button>
                              )}
                              <button onClick={() => { setEditId(p.id); setEditForm({ funcionarioId: p.funcionarioId, obraId: p.obraId, horaEntrada: p.horaEntrada, horaSaida: p.horaSaida, status: p.status }); }}
                                className="btn btn-blue btn-sm"><Edit2 size={12} /></button>
                              <button onClick={() => excluir(p.id)}
                                className="btn btn-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
