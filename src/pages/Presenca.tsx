import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, distanciaMetros } from '../services/storage';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Presenca as PresencaType, Funcionario } from '../types';
import {
  diferencaMinutos,
  formatarMinutos,
  intervaloEmAberto,
  intervaloObrigatorioCumprido,
  INTERVALO_REFEICAO_MINIMO,
  JORNADA_META_MINUTOS,
  minutosRestantesJornada,
  minutosTrabalhados,
} from '../utils/jornada';
import { MapPin, CheckCircle, AlertTriangle, Edit2, Trash2, Save, X, Camera, RotateCcw } from 'lucide-react';

type AcaoRegistro = 'entrada' | 'saida-almoco' | 'retorno-almoco' | 'saida-jantar' | 'retorno-jantar' | 'saida';
type TipoMensagem = 'success' | 'warn' | 'error';

const HORA_ZERO = '00:00:00';

function horaAtual() {
  return new Date().toTimeString().slice(0, 8);
}

function acaoSequencial(presenca: PresencaType | null, turnoNoturnoPadrao = false): AcaoRegistro {
  if (!presenca) return 'entrada';
  const turnoNoturno = Boolean(presenca.turnoNoturno ?? turnoNoturnoPadrao);

  if (turnoNoturno) {
    if (!presenca.saidaJantar) return 'saida-jantar';
    if (!presenca.retornoJantar) return 'retorno-jantar';
    return 'saida';
  }

  if (!presenca.saidaAlmoco) return 'saida-almoco';
  if (!presenca.retornoAlmoco) return 'retorno-almoco';
  return 'saida';
}

function rotuloAcao(acao: AcaoRegistro, turnoNoturno: boolean) {
  switch (acao) {
    case 'entrada': return 'Selfie + Registrar Entrada';
    case 'saida-almoco': return 'Registrar Saida para Almoco';
    case 'retorno-almoco': return 'Registrar Retorno do Almoco';
    case 'saida-jantar': return 'Registrar Saida para Jantar/Cafe';
    case 'retorno-jantar': return 'Registrar Retorno do Jantar/Cafe';
    case 'saida': return 'Selfie + Registrar Saida';
    default: return turnoNoturno ? 'Registrar Jantar/Cafe' : 'Registrar Almoco';
  }
}

function classeMensagem(tipo: TipoMensagem) {
  if (tipo === 'success') return 'alert-success';
  if (tipo === 'warn') return 'alert-warn';
  return 'alert-error';
}

function CapturarFoto({ onCapturar, onCancelar }: { onCapturar: (blob: Blob) => void; onCancelar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const iniciarCamera = useCallback(async () => {
    setPreview(null);
    setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setErro('Nao foi possivel acessar a camera.');
    }
  }, []);

  useEffect(() => {
    iniciarCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [iniciarCamera]);

  function capturar() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL('image/jpeg', 0.8));
  }

  function confirmar() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => {
      if (!blob) return;
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapturar(blob);
    }, 'image/jpeg', 0.8);
  }

  function refazer() {
    setPreview(null);
    iniciarCamera();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 }}>
      <p style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>Tire uma selfie para confirmar o registro de ponto</p>

      {erro && <p style={{ color: '#f87171', fontSize: 13 }}>{erro}</p>}

      {!preview ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 400, borderRadius: 12, transform: 'scaleX(-1)' }} />
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

export default function Presenca() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [obras, setObras] = useState(() => db.getObras().filter(o => o.ativa));
  const [presencas, setPresencas] = useState<PresencaType[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErro, setGeoErro] = useState(() => navigator.geolocation ? '' : 'Geolocalizacao nao suportada');
  const [msg, setMsg] = useState('');
  const [msgTipo, setMsgTipo] = useState<TipoMensagem>('success');
  const [alertaJornada, setAlertaJornada] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PresencaType>>({});
  const [agora, setAgora] = useState(horaAtual());

  const [cameraAberta, setCameraAberta] = useState(false);
  const pendingRef = useRef<{ tipoFoto: 'entrada' | 'saida'; acao: AcaoRegistro; presenca?: PresencaType } | null>(null);

  const [form, setForm] = useState({
    funcionarioId: '',
    obraId: '',
    status: 'presente' as PresencaType['status'],
  });

  const hoje = new Date().toISOString().split('T')[0];
  const presencasHoje = useMemo(() => presencas.filter(p => p.data === hoje), [presencas, hoje]);

  const funcLogado = funcionarios.find(f => f.id === usuario?.funcionarioId);
  const obraFuncLogado = obras.find(o => o.id === funcLogado?.obraId);

  const presencaHoje = !isAdmin ? (presencasHoje.find(p => p.funcionarioId === usuario?.funcionarioId) ?? null) : null;
  const registroSelecionado = useMemo(() => {
    if (!isAdmin) return presencaHoje;
    if (!form.funcionarioId) return null;
    return presencasHoje.find(p => p.funcionarioId === form.funcionarioId) ?? null;
  }, [form.funcionarioId, isAdmin, presencaHoje, presencasHoje]);

  const temSaida = Boolean(presencaHoje?.horaSaida);

  function feedback(texto: string, tipo: TipoMensagem) {
    setMsg(texto);
    setMsgTipo(tipo);
  }

  function carregarPresencas() {
    const params = !isAdmin && usuario?.funcionarioId
      ? { data: hoje, funcionarioId: usuario.funcionarioId }
      : { data: hoje };
    return db.getPresencasAsync(params).then(setPresencas);
  }

  useEffect(() => {
    db.getFuncionariosAsync().then(lista => setFuncionarios(lista.filter(f => f.ativo)));
    db.getObrasAsync().then(lista => setObras(lista.filter(o => o.ativa)));
    carregarPresencas();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(horaAtual()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoErro('Nao foi possivel obter localizacao.')
    );
  }, []);

  useEffect(() => {
    if (isAdmin || !presencaHoje || presencaHoje.horaSaida) {
      setAlertaJornada('');
      return;
    }
    if (!intervaloObrigatorioCumprido(presencaHoje)) {
      if (intervaloEmAberto(presencaHoje)) {
        setAlertaJornada('Intervalo de refeicao em andamento. Registre o retorno apos 1 hora minima.');
      } else if (presencaHoje.turnoNoturno) {
        setAlertaJornada('Lembrete: registre saida e retorno do jantar/cafe (minimo de 1h).');
      } else {
        setAlertaJornada('Lembrete: registre saida e retorno do almoco (minimo de 1h).');
      }
      return;
    }
    const restantes = minutosRestantesJornada(presencaHoje, agora);
    if (restantes > 0 && restantes <= 10) {
      setAlertaJornada(`Sua jornada termina em cerca de ${Math.ceil(restantes)} minuto(s). Registre a saida pontualmente.`);
      return;
    }
    if (restantes <= 0) {
      setAlertaJornada('Jornada minima de 8h atingida. Horas extras so serao validadas com autorizacao do administrador.');
      return;
    }
    setAlertaJornada('');
  }, [agora, isAdmin, presencaHoje]);

  function obraIdEfetivo(funcId: string): string {
    if (!isAdmin) return funcLogado?.obraId ?? '';
    return funcionarios.find(f => f.id === funcId)?.obraId || form.obraId;
  }

  function pedirFoto(tipoFoto: 'entrada' | 'saida', acao: AcaoRegistro, presenca?: PresencaType) {
    pendingRef.current = { tipoFoto, acao, presenca };
    setCameraAberta(true);
  }

  async function aoCapturar(blob: Blob) {
    setCameraAberta(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;

    if (pending.acao === 'entrada') {
      await executarRegistro(blob);
      return;
    }
    if (!pending.presenca) return;
    await executarAcaoRegistro(pending.presenca, pending.acao, blob);
  }

  async function executarRegistro(foto: Blob) {
    const funcId = isAdmin ? form.funcionarioId : (usuario?.funcionarioId ?? '');
    const obraId = obraIdEfetivo(funcId);

    if (!funcId) { feedback('Selecione o funcionario.', 'error'); return; }
    if (!obraId) { feedback(isAdmin ? 'Selecione a obra.' : 'Funcionario nao possui obra vinculada.', 'error'); return; }
    if (!geo) { feedback('Aguardando localizacao GPS...', 'warn'); return; }
    if (presencasHoje.find(p => p.funcionarioId === funcId)) {
      feedback('Funcionario ja possui ponto de entrada registrado hoje.', 'error');
      return;
    }

    const obra = obras.find(o => o.id === obraId);
    if (!obra) {
      feedback('Obra nao encontrada para o funcionario.', 'error');
      return;
    }

    const dist = distanciaMetros(geo.lat, geo.lng, obra.lat, obra.lng);
    const nova: PresencaType = {
      id: 'p' + Date.now(),
      funcionarioId: funcId,
      obraId,
      data: hoje,
      horaEntrada: horaAtual(),
      lat: geo.lat,
      lng: geo.lng,
      distanciaObra: dist,
      status: isAdmin ? form.status : 'presente',
      tipoRegistro: 'entrada',
      turnoNoturno: obraEfetiva?.turnoNoturno ?? false,
      minutosTrabalhados: 0,
      minutosTrabalhadosTotal: 0,
      horaExtraAutorizada: false,
    };

    setSalvando(true);
    try {
      await db.savePresenca(nova);
      await api.uploadFoto(nova.id, 'entrada', foto);
      await carregarPresencas();
      feedback(`Entrada registrada com sucesso. Distancia da obra: ${dist}m.`, 'success');
      if (isAdmin) {
        setForm(f => ({ ...f, obraId: '', status: 'presente' }));
      }
    } catch (e) {
      feedback(e instanceof Error ? e.message : 'Erro ao registrar entrada.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function executarAcaoRegistro(presenca: PresencaType, acao: AcaoRegistro, fotoSaida?: Blob) {
    const agoraRegistro = horaAtual();
    const atualizado: PresencaType = { ...presenca, tipoRegistro: acao };
    let mensagemSucesso = 'Registro atualizado com sucesso.';
    let mensagemTipo: TipoMensagem = 'success';

    if (acao === 'saida-almoco') {
      if (atualizado.saidaAlmoco && !atualizado.retornoAlmoco) {
        feedback('O intervalo de almoco ja foi iniciado. Registre o retorno antes de novo evento.', 'error');
        return;
      }
      if (atualizado.retornoAlmoco) {
        feedback('O intervalo de almoco deste turno ja foi concluido.', 'warn');
        return;
      }
      atualizado.saidaAlmoco = agoraRegistro;
      mensagemSucesso = 'Saida para almoco registrada.';
    }

    if (acao === 'retorno-almoco') {
      if (!atualizado.saidaAlmoco) {
        feedback('Registre primeiro a saida para almoco.', 'error');
        return;
      }
      const minutos = diferencaMinutos(atualizado.saidaAlmoco, agoraRegistro);
      if (minutos < INTERVALO_REFEICAO_MINIMO) {
        const faltam = INTERVALO_REFEICAO_MINIMO - minutos;
        feedback(`Intervalo minimo de 1h para almoco. Aguarde mais ${faltam} minuto(s).`, 'warn');
        return;
      }
      atualizado.retornoAlmoco = agoraRegistro;
      mensagemSucesso = 'Retorno do almoco registrado.';
    }

    if (acao === 'saida-jantar') {
      if (atualizado.saidaJantar && !atualizado.retornoJantar) {
        feedback('O intervalo de jantar/cafe ja foi iniciado. Registre o retorno antes de novo evento.', 'error');
        return;
      }
      if (atualizado.retornoJantar) {
        feedback('O intervalo de jantar/cafe deste turno ja foi concluido.', 'warn');
        return;
      }
      atualizado.saidaJantar = agoraRegistro;
      mensagemSucesso = 'Saida para jantar/cafe registrada.';
    }

    if (acao === 'retorno-jantar') {
      if (!atualizado.saidaJantar) {
        feedback('Registre primeiro a saida para jantar/cafe.', 'error');
        return;
      }
      const minutos = diferencaMinutos(atualizado.saidaJantar, agoraRegistro);
      if (minutos < INTERVALO_REFEICAO_MINIMO) {
        const faltam = INTERVALO_REFEICAO_MINIMO - minutos;
        feedback(`Intervalo minimo de 1h para jantar/cafe. Aguarde mais ${faltam} minuto(s).`, 'warn');
        return;
      }
      atualizado.retornoJantar = agoraRegistro;
      mensagemSucesso = 'Retorno do jantar/cafe registrado.';
    }

    if (acao === 'saida') {
      if (!fotoSaida) {
        feedback('Capture a selfie para registrar a saida final.', 'error');
        return;
      }
      if (intervaloEmAberto(atualizado)) {
        feedback('Existe intervalo de refeicao em aberto. Registre o retorno antes da saida final.', 'error');
        return;
      }
      if (!intervaloObrigatorioCumprido(atualizado)) {
        const mensagem = atualizado.turnoNoturno
          ? 'Turno noturno exige intervalo minimo de 1h para jantar/cafe antes da saida.'
          : 'A jornada exige intervalo minimo de 1h para almoco antes da saida.';
        feedback(mensagem, 'error');
        return;
      }

      atualizado.horaSaida = agoraRegistro;
      const minutosLiquidos = minutosTrabalhados(atualizado, HORA_ZERO);
      atualizado.minutosTrabalhados = minutosLiquidos;
      atualizado.minutosTrabalhadosTotal = minutosLiquidos;

      if (minutosLiquidos < JORNADA_META_MINUTOS) {
        const faltou = JORNADA_META_MINUTOS - minutosLiquidos;
        mensagemSucesso = `Saida registrada com ${formatarMinutos(minutosLiquidos)} de trabalho. Faltaram ${formatarMinutos(faltou)} e pode haver desconto na diaria.`;
        mensagemTipo = 'warn';
      } else if (minutosLiquidos > JORNADA_META_MINUTOS && !atualizado.horaExtraAutorizada) {
        const excedente = minutosLiquidos - JORNADA_META_MINUTOS;
        mensagemSucesso = `Saida registrada com ${formatarMinutos(minutosLiquidos)}. Excedente de ${formatarMinutos(excedente)} sem autorizacao previa; o administrador deve avaliar banco de horas ou hora extra.`;
        mensagemTipo = 'warn';
      } else {
        mensagemSucesso = `Saida registrada com ${formatarMinutos(minutosLiquidos)} de trabalho.`;
      }
    }

    setSalvando(true);
    try {
      await db.savePresenca(atualizado);
      if (acao === 'saida' && fotoSaida) {
        await api.uploadFoto(atualizado.id, 'saida', fotoSaida);
      }
      await carregarPresencas();
      feedback(mensagemSucesso, mensagemTipo);
    } catch (e) {
      feedback(e instanceof Error ? e.message : 'Erro ao atualizar registro.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  function acionarRegistroPrincipal() {
    const funcId = isAdmin ? form.funcionarioId : (usuario?.funcionarioId ?? '');
    if (!funcId) {
      feedback('Selecione o funcionario.', 'error');
      return;
    }

    const presencaFuncionario = presencasHoje.find(p => p.funcionarioId === funcId) ?? null;
    const proxima = acaoSequencial(presencaFuncionario, turnoNoturnoAtual);

    if (proxima === 'entrada') {
      const obraId = obraIdEfetivo(funcId);
      if (!obraId) { feedback(isAdmin ? 'Selecione a obra.' : 'Funcionario nao possui obra vinculada.', 'error'); return; }
      if (!geo) { feedback('Aguardando localizacao GPS...', 'warn'); return; }
      pedirFoto('entrada', 'entrada');
      return;
    }

    if (!presencaFuncionario) {
      feedback('Nenhum registro de entrada encontrado para o funcionario.', 'error');
      return;
    }

    if (presencaFuncionario.horaSaida) {
      feedback(`Ponto ja finalizado. Entrada: ${presencaFuncionario.horaEntrada} | Saida: ${presencaFuncionario.horaSaida}`, 'success');
      return;
    }

    if (proxima === 'saida') {
      pedirFoto('saida', 'saida', presencaFuncionario);
      return;
    }

    void executarAcaoRegistro(presencaFuncionario, proxima);
  }

  async function salvarEdicao(p: PresencaType) {
    const merged: PresencaType = { ...p, ...editForm };
    if (merged.horaSaida) {
      const minutosLiquidos = minutosTrabalhados(merged, HORA_ZERO);
      merged.minutosTrabalhados = minutosLiquidos;
      merged.minutosTrabalhadosTotal = minutosLiquidos;
    }
    await db.savePresenca(merged);
    setEditId(null);
    await carregarPresencas();
  }

  async function autorizarHoraExtra(p: PresencaType) {
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

  async function excluir(id: string) {
    if (!confirm('Excluir este registro de presenca?')) return;
    await db.deletePresenca(id);
    await carregarPresencas();
  }

  function resumoJornada(p: PresencaType) {
    const minutos = p.horaSaida ? (p.minutosTrabalhados ?? minutosTrabalhados(p, HORA_ZERO)) : minutosTrabalhados(p, agora);
    const restante = JORNADA_META_MINUTOS - minutos;
    return {
      minutos,
      restante,
      texto: p.horaSaida
        ? formatarMinutos(minutos)
        : `${formatarMinutos(minutos)} / ${formatarMinutos(JORNADA_META_MINUTOS)}`,
    };
  }

  const statusColor: Record<string, string> = { presente: '#059669', ausente: '#dc2626', 'meio-periodo': '#d97706' };
  const statusClass: Record<string, string> = { presente: 'status-presente', ausente: 'status-ausente', 'meio-periodo': 'status-meio' };
  const mostrarPainel = isAdmin || !temSaida;
  const obraEfetiva = obras.find(o => o.id === (registroSelecionado?.obraId ?? obraIdEfetivo(form.funcionarioId)));
  const turnoNoturnoAtual = Boolean(registroSelecionado?.turnoNoturno ?? obraEfetiva?.turnoNoturno);
  const acaoPainel = acaoSequencial(registroSelecionado, turnoNoturnoAtual);
  const resumoSelecionado = registroSelecionado ? resumoJornada(registroSelecionado) : null;

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
          <h2 className="page-title">Presenca</h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>

        <div className="presenca-layout">
          {mostrarPainel && (
            <div className="card card-body presenca-panel">
              <h3 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 15 }}>
                {registroSelecionado?.horaSaida ? 'Ponto Finalizado' : 'Registro de Jornada'}
              </h3>

              <div className={`geo-bar ${geo ? 'geo-ok' : 'geo-wait'}`}>
                <MapPin size={16} color={geo ? '#059669' : '#d97706'} />
                <span style={{ fontSize: 13 }}>
                  {geo ? `GPS: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : geoErro || 'Obtendo localizacao...'}
                </span>
              </div>
              {isAdmin ? (
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">Funcionario</label>
                  <select className="form-input" value={form.funcionarioId} onChange={e => setForm(f => ({ ...f, funcionarioId: e.target.value, obraId: '' }))}>
                    <option value="">Selecione...</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} - {f.funcao}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ marginBottom: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                  <strong>Funcionario:</strong> {usuario?.funcionarioNome}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Obra</label>
                {isAdmin ? (() => {
                  const funcSel = funcionarios.find(f => f.id === form.funcionarioId);
                  const obraVinculada = obras.find(o => o.id === funcSel?.obraId);
                  return obraVinculada ? (
                    <div style={{ padding: '9px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 14, color: '#166534' }}>
                      {obraVinculada.nome} <span style={{ fontSize: 12, color: '#15803d' }}>(vinculo)</span>
                    </div>
                  ) : (
                    <select className="form-input" value={form.obraId} onChange={e => setForm(f => ({ ...f, obraId: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  );
                })() : (
                  <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, color: obraFuncLogado ? '#1e3a5f' : '#94a3b8' }}>
                    {obraFuncLogado ? obraFuncLogado.nome : 'Nenhuma obra vinculada'}
                  </div>
                )}
              </div>

              {isAdmin && (
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PresencaType['status'] }))}>
                    <option value="presente">Presente</option>
                    <option value="meio-periodo">Meio periodo</option>
                    <option value="ausente">Ausente</option>
                  </select>
                </div>
              )}

              {resumoSelecionado && (
                <div className={`alert ${resumoSelecionado.restante < 0 ? 'alert-warn' : 'alert-success'}`} style={{ marginTop: 0, marginBottom: 12 }}>
                  Jornada: <strong>{resumoSelecionado.texto}</strong>
                  {registroSelecionado?.horaSaida ? (
                    <>
                      {resumoSelecionado.minutos < JORNADA_META_MINUTOS && ` | Faltaram ${formatarMinutos(JORNADA_META_MINUTOS - resumoSelecionado.minutos)}`}
                      {resumoSelecionado.minutos > JORNADA_META_MINUTOS && ` | Excedente: ${formatarMinutos(resumoSelecionado.minutos - JORNADA_META_MINUTOS)}`}
                    </>
                  ) : (
                    <> | Restam {formatarMinutos(Math.max(resumoSelecionado.restante, 0))}</>
                  )}
                </div>
              )}

              {!isAdmin && alertaJornada && (
                <div className="alert alert-warn" style={{ marginTop: 0, marginBottom: 12 }}>{alertaJornada}</div>
              )}

              {registroSelecionado?.horaSaida ? (
                <div className="alert alert-success" style={{ marginTop: 4 }}>
                  Ponto completo. Entrada: {registroSelecionado.horaEntrada} - Saida: {registroSelecionado.horaSaida}
                </div>
              ) : (
                <button
                  onClick={acionarRegistroPrincipal}
                  disabled={salvando}
                  className={acaoPainel === 'saida' ? 'btn btn-secondary' : 'btn btn-primary'}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                >
                  <Camera size={16} /> {salvando ? 'Salvando...' : rotuloAcao(acaoPainel, turnoNoturnoAtual)}
                </button>
              )}

              {msg && (
                <div className={`alert ${classeMensagem(msgTipo)}`}>{msg}</div>
              )}
            </div>
          )}

          {!isAdmin && temSaida && (
            <div className="card card-body presenca-panel">
              <div className="alert alert-success" style={{ marginTop: 0 }}>
                Ponto completo registrado hoje. Entrada: {presencaHoje?.horaEntrada} - Saida: {presencaHoje?.horaSaida}
              </div>
              {presencaHoje?.fotoEntrada && (
                <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Entrada</p>
                    <img src={presencaHoje.fotoEntrada} alt="foto entrada" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid #bbf7d0' }} />
                  </div>
                  {presencaHoje?.fotoSaida && (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Saida</p>
                      <img src={presencaHoje.fotoSaida} alt="foto saida" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid #bbf7d0' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card presenca-table">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: 15 }}>
                {isAdmin ? 'Presencas de Hoje' : 'Meu Ponto de Hoje'}
              </h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {isAdmin && <th>Funcionario</th>}
                    <th>Obra</th>
                    <th>Entrada</th>
                    <th>Saida</th>
                    <th>Jornada</th>
                    <th>Dist.</th>
                    <th>Status</th>
                    {isAdmin && <th>Fotos</th>}
                    {isAdmin && <th>Acoes</th>}
                  </tr>
                </thead>
                <tbody>
                  {presencasHoje.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                        Nenhuma presenca hoje
                      </td>
                    </tr>
                  )}
                  {presencasHoje.map(p => {
                    const f = funcionarios.find(x => x.id === p.funcionarioId);
                    const o = obras.find(x => x.id === p.obraId);
                    const longe = p.distanciaObra > 200;
                    const emEdicao = isAdmin && editId === p.id;
                    const resumo = resumoJornada(p);
                    const excedeu = Boolean(p.horaSaida && resumo.minutos > JORNADA_META_MINUTOS);
                    const abaixo = Boolean(p.horaSaida && resumo.minutos < JORNADA_META_MINUTOS);
                    const extraPendente = excedeu && !p.horaExtraAutorizada;

                    if (emEdicao) {
                      return (
                        <tr key={p.id} style={{ background: '#f0f9ff' }}>
                          <td>
                            <select className="form-input" style={{ fontSize: 13 }} value={editForm.funcionarioId} onChange={e => setEditForm(v => ({ ...v, funcionarioId: e.target.value }))}>
                              {funcionarios.map(func => <option key={func.id} value={func.id}>{func.nome}</option>)}
                            </select>
                          </td>
                          <td>
                            <select className="form-input" style={{ fontSize: 13 }} value={editForm.obraId} onChange={e => setEditForm(v => ({ ...v, obraId: e.target.value }))}>
                              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
                            </select>
                          </td>
                          <td>
                            <input className="form-input" style={{ width: 92, fontSize: 13 }} value={editForm.horaEntrada ?? ''} onChange={e => setEditForm(v => ({ ...v, horaEntrada: e.target.value }))} />
                          </td>
                          <td>
                            <input className="form-input" style={{ width: 92, fontSize: 13 }} value={editForm.horaSaida ?? ''} onChange={e => setEditForm(v => ({ ...v, horaSaida: e.target.value || undefined }))} />
                          </td>
                          <td style={{ color: '#94a3b8' }}>{resumo.texto}</td>
                          <td style={{ color: '#94a3b8' }}>{p.distanciaObra}m</td>
                          <td>
                            <select className="form-input" style={{ fontSize: 13 }} value={editForm.status} onChange={e => setEditForm(v => ({ ...v, status: e.target.value as PresencaType['status'] }))}>
                              <option value="presente">presente</option>
                              <option value="meio-periodo">meio-periodo</option>
                              <option value="ausente">ausente</option>
                            </select>
                          </td>
                          <td />
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => void salvarEdicao(p)} className="btn btn-success btn-sm"><Save size={12} /></button>
                              <button onClick={() => setEditId(null)} className="btn btn-secondary btn-sm"><X size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const proxima = acaoSequencial(p, p.turnoNoturno);

                    return (
                      <tr key={p.id}>
                        {isAdmin && <td style={{ fontWeight: 500 }}>{f?.nome}</td>}
                        <td style={{ color: '#64748b' }}>{o?.nome}</td>
                        <td>{p.horaEntrada}</td>
                        <td>{p.horaSaida || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 600, color: '#1e3a5f' }}>{resumo.texto}</span>
                            {abaixo && <span style={{ fontSize: 11, color: '#b45309' }}>Abaixo de 8h</span>}
                            {excedeu && p.horaExtraAutorizada && (
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
                          <span className={`status-badge ${statusClass[p.status]}`} style={{ background: statusColor[p.status] + '18', color: statusColor[p.status] }}>
                            {p.status.replace('-', ' ')}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {p.fotoEntrada && <a href={p.fotoEntrada} target="_blank" rel="noreferrer"><img src={p.fotoEntrada} alt="entrada" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} /></a>}
                              {p.fotoSaida && <a href={p.fotoSaida} target="_blank" rel="noreferrer"><img src={p.fotoSaida} alt="saida" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} /></a>}
                              {!p.fotoEntrada && !p.fotoSaida && <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>}
                            </div>
                          </td>
                        )}
                        {isAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {!p.horaSaida && (
                                <button
                                  onClick={() => {
                                    if (proxima === 'saida') {
                                      pedirFoto('saida', 'saida', p);
                                    } else {
                                      void executarAcaoRegistro(p, proxima);
                                    }
                                  }}
                                  className="btn btn-secondary btn-sm"
                                >
                                  {proxima === 'saida' ? <Camera size={12} /> : <CheckCircle size={12} />} {rotuloAcao(proxima, Boolean(p.turnoNoturno)).replace('Selfie + ', '')}
                                </button>
                              )}
                              {extraPendente && (
                                <button onClick={() => void autorizarHoraExtra(p)} className="btn btn-warn btn-sm">
                                  Autorizar HE
                                </button>
                              )}
                              {excedeu && p.horaExtraAutorizada && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, color: '#166534', whiteSpace: 'nowrap' }}>
                                  <CheckCircle size={11} /> HE autorizada{p.autorizadoPor ? ` · ${p.autorizadoPor}` : ''}
                                </div>
                              )}
                              <button
                                onClick={() => { setEditId(p.id); setEditForm({ funcionarioId: p.funcionarioId, obraId: p.obraId, horaEntrada: p.horaEntrada, horaSaida: p.horaSaida, status: p.status }); }}
                                className="btn btn-blue btn-sm"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button onClick={() => void excluir(p.id)} className="btn btn-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
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
