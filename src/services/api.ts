import type { Funcionario, Obra, Presenca, Usuario, UsuarioAdmin } from '../types';

const BASE = '/api';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE + path, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export const api = {
  async login(login: string, senha: string): Promise<Usuario> {
    const senhaHash = await sha256(senha);
    const data = await post<{ Id: string; Login: string; Perfil: string; FuncionarioId: string | null; FuncionarioNome: string | null; Funcao: string | null; }>('/login', { login, senhaHash });
    return { id: data.Id, login: data.Login, perfil: data.Perfil as Usuario['perfil'], funcionarioId: data.FuncionarioId, funcionarioNome: data.FuncionarioNome, funcao: data.Funcao };
  },
  getFuncionarios: () => get<Funcionario[]>('/funcionarios').then(l => l.map(r => mapFuncionario(r as Record<string, unknown>))),
  getObras: () => get<Obra[]>('/obras').then(l => l.map(r => mapObra(r as Record<string, unknown>))),
  getPresencas: (params?: { data?: string; funcionarioId?: string; de?: string; ate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.data) qs.set('data', params.data);
    if (params?.funcionarioId) qs.set('funcionarioId', params.funcionarioId);
    if (params?.de)  qs.set('de',  params.de);
    if (params?.ate) qs.set('ate', params.ate);
    const q = qs.toString() ? '?' + qs.toString() : '';
    return get<Presenca[]>('/presencas' + q).then(l => l.map(r => mapPresenca(r as Record<string, unknown>)));
  },
  saveFuncionario: (f: Funcionario) => post('/funcionarios', f),
  deleteFuncionario: (id: string) => del('/funcionarios/' + id),
  saveObra: (o: Obra) => post('/obras', o),
  deleteObra: (id: string) => del('/obras/' + id),
  savePresenca: (p: Presenca) => post('/presencas', p),
  deletePresenca: (id: string) => del('/presencas/' + id),
  uploadFoto: async (presencaId: string, tipo: 'entrada' | 'saida', blob: Blob): Promise<string> => {
    const fd = new FormData();
    fd.append('foto', blob, `${tipo}.jpg`);
    fd.append('tipo', tipo);
    const res = await fetch(`${BASE}/presencas/${presencaId}/foto`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { url: string };
    return data.url;
  },
  getUsuarios: () => get<UsuarioAdmin[]>('/usuarios').then(l => l.map(r => mapUsuario(r as Record<string, unknown>))),
  saveUsuario: (u: { id: string; login: string; perfil: string; funcionarioId: string | null; email: string | null; ativo: boolean; senhaHash?: string }) => post('/usuarios', u),
  deleteUsuario: (id: string) => del('/usuarios/' + id),
  resetSenha: (id: string) => post<{ ok: boolean }>('/usuarios/' + id + '/reset-senha', {}),
  getRelatorio: (dataInicio: string, dataFim: string, obraId?: string) => {
    const qs = new URLSearchParams({ dataInicio, dataFim });
    if (obraId) qs.set('obraId', obraId);
    return get('/relatorio?' + qs.toString());
  },
};

function mapFuncionario(r: Record<string, unknown>): Funcionario {
  return { id: r.Id as string, nome: r.Nome as string, funcao: r.Funcao as string, diaria: Number(r.Diaria), transporte: Number(r.Transporte), alimentacao: Number(r.Alimentacao), telefone: r.Telefone as string, ativo: Boolean(r.Ativo), obraId: (r.ObraId as string) || null };
}
function mapObra(r: Record<string, unknown>): Obra {
  return { id: r.Id as string, nome: r.Nome as string, endereco: r.Endereco as string, lat: Number(r.Lat), lng: Number(r.Lng), ativa: Boolean(r.Ativa) };
}
function mapUsuario(r: Record<string, unknown>): UsuarioAdmin {
  return { id: r.Id as string, login: r.Login as string, perfil: r.Perfil as 'admin' | 'funcionario', funcionarioId: r.FuncionarioId as string | null, funcionarioNome: r.FuncionarioNome as string | null, email: r.Email as string | null, ativo: Boolean(r.Ativo) };
}
function mapPresenca(r: Record<string, unknown>): Presenca {
  return {
    id: r.Id as string, funcionarioId: (r.FuncionarioId ?? r.funcionarioId) as string,
    obraId: (r.ObraId ?? r.obraId) as string, data: (r.Data as string).slice(0, 10),
    horaEntrada: (r.HoraEntrada ?? r.horaEntrada) as string,
    horaSaida: (r.HoraSaida ?? r.horaSaida) as string | undefined,
    lat: Number(r.Lat ?? r.lat), lng: Number(r.Lng ?? r.lng),
    distanciaObra: Number(r.DistanciaObra ?? r.distanciaObra),
    status: (r.Status ?? r.status) as Presenca['status'],
    fotoEntrada: (r.FotoEntrada ?? r.fotoEntrada) as string | undefined,
    fotoSaida: (r.FotoSaida ?? r.fotoSaida) as string | undefined,
  };
}
