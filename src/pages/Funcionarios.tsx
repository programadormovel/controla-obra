import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/storage';
import { api } from '../services/api';
import type { Funcionario, Obra, UsuarioAdmin, Cargo } from '../types';
import { Edit2, X, Save, UserPlus, Trash2, UserX, Share2, Plus } from 'lucide-react';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

type FormFunc = Omit<Funcionario, 'id'> & {
  login: string; senha: string; confirmarSenha: string; email: string;
};

const vazio: FormFunc = {
  nome: '', funcao: '', diaria: 0, transporte: 0, alimentacao: 0,
  telefone: '', ativo: true, obraId: null,
  login: '', senha: '', confirmarSenha: '', email: '',
};

export default function Funcionarios() {
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [presencaIds, setPresencaIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<FormFunc>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<Funcionario | null>(null);

  async function carregar() {
    const [funcs, presencas, obrasLista, usuariosLista, cargosLista] = await Promise.all([
      db.getFuncionariosAsync(),
      db.getPresencasAsync(),
      api.getObras(),
      api.getUsuarios(),
      api.getCargos(),
    ]);
    setLista(funcs);
    setPresencaIds(new Set(presencas.map(p => p.funcionarioId)));
    setObras(obrasLista);
    setUsuarios(usuariosLista);
    setCargos(cargosLista);
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setForm(vazio); setEditando(null); setErro(null); setModal(true); }

  function abrirEdicao(f: Funcionario) {
    const u = usuarios.find(u => u.funcionarioId === f.id);
    setForm({
      nome: f.nome, funcao: f.funcao, diaria: f.diaria, transporte: f.transporte,
      alimentacao: f.alimentacao, telefone: f.telefone, ativo: f.ativo, obraId: f.obraId,
      login: u?.login ?? '', email: u?.email ?? '', senha: '', confirmarSenha: '',
    });
    setEditando(f); setErro(null); setModal(true);
  }

  function fechar() { setModal(false); setEditando(null); setForm(vazio); setErro(null); }

  async function salvar() {
    if (!form.nome || !form.funcao) return setErro('Nome e função são obrigatórios.');
    if (!form.login) return setErro('Login é obrigatório.');
    if (!editando && !form.senha) return setErro('Senha é obrigatória para novo funcionário.');
    if (form.senha && form.senha !== form.confirmarSenha) return setErro('As senhas não conferem.');
    if (form.senha && form.senha.length < 6) return setErro('Senha deve ter no mínimo 6 caracteres.');

    setSalvando(true); setErro(null);
    try {
      const funcId = editando?.id ?? 'f' + Date.now();
      const usuarioExistente = editando ? usuarios.find(u => u.funcionarioId === editando.id) : null;
      const uid = usuarioExistente?.id ?? 'u' + Date.now();

      const f: Funcionario = { id: funcId, nome: form.nome, funcao: form.funcao, diaria: form.diaria, transporte: form.transporte, alimentacao: form.alimentacao, telefone: form.telefone, ativo: form.ativo, obraId: form.obraId };
      const usuario = {
        id: uid, login: form.login, email: form.email || undefined,
        senhaHash: form.senha ? await sha256(form.senha) : undefined,
      };

      await api.saveFuncionario(f, usuario);
      await carregar();
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally { setSalvando(false); }
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

  function compartilhar(f: Funcionario) {
    const login = usuarios.find(u => u.funcionarioId === f.id)?.login;
    const url = `${window.location.origin}/presenca${login ? `?login=${encodeURIComponent(login)}` : ''}`;
    const texto = `Olá ${f.nome}! Acesse o link para registrar seu ponto:\n${url}`;
    const tel = f.telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  const set = (k: keyof FormFunc) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

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
              <tr>{['Nome', 'Função', 'Login', 'Obra', 'Diária', 'Transporte', 'Aliment.', 'Total/Dia', 'Status', 'Ações'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum funcionário cadastrado</td></tr>}
              {lista.map(f => {
                const temPresenca = presencaIds.has(f.id);
                const obraNome = obras.find(o => o.id === f.obraId)?.nome;
                const login = usuarios.find(u => u.funcionarioId === f.id)?.login ?? '—';
                return (
                  <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 500 }}>{f.nome}</td>
                    <td style={{ color: '#64748b' }}>{f.funcao}</td>
                    <td style={{ color: '#64748b', fontFamily: 'monospace' }}>{login}</td>
                    <td style={{ color: obraNome ? '#1e3a5f' : '#94a3b8', fontWeight: obraNome ? 500 : 400 }}>{obraNome ?? '—'}</td>
                    <td>R$ {f.diaria.toFixed(2)}</td>
                    <td>R$ {f.transporte.toFixed(2)}</td>
                    <td>R$ {f.alimentacao.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: '#1e3a5f' }}>R$ {(f.diaria + f.transporte + f.alimentacao).toFixed(2)}</td>
                    <td><span className={`status-badge ${f.ativo ? 'status-ativo' : 'status-inativo'}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => abrirEdicao(f)} className="btn btn-secondary btn-sm"><Edit2 size={12} /> Editar</button>
                        <button onClick={() => compartilhar(f)} className="btn btn-sm" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }} title="Enviar link de ponto via WhatsApp">
                          <Share2 size={12} /> WhatsApp
                        </button>
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
                <input className="form-input" value={form.nome} onChange={set('nome')} placeholder="Ex: João da Silva" />
              </div>
              <div className="form-full">
                <label className="form-label">Cargo *</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="form-input" style={{ flex: 1 }} value={form.funcao} onChange={e => {
                    const cargo = cargos.find(c => c.nome === e.target.value);
                    setForm(f => ({ ...f, funcao: e.target.value, ...(cargo ? { diaria: cargo.diaria, transporte: cargo.transporte, alimentacao: cargo.alimentacao } : {}) }));
                  }}>
                    <option value="">— Selecione —</option>
                    {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/cargos')} title="Cadastrar novo cargo">
                    <Plus size={13} /> Novo cargo
                  </button>
                </div>
              </div>
              <div className="form-full">
                <label className="form-label">Obra vinculada</label>
                <select className="form-input" value={form.obraId ?? ''} onChange={set('obraId')}>
                  <option value="">— Nenhuma —</option>
                  {obras.filter(o => o.ativa).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
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
                <label className="form-label">Custo Total/Dia</label>
                <div className="form-input" style={{ background: '#f8fafc', fontWeight: 700, color: '#1e3a5f' }}>
                  R$ {(form.diaria + form.transporte + form.alimentacao).toFixed(2)}
                </div>
              </div>
              <div>
                <label className="form-label">Telefone</label>
                <input className="form-input" value={form.telefone} onChange={set('telefone')} placeholder="Ex: 11999990001" />
              </div>
              <div className="form-full form-check">
                <input type="checkbox" id="ativo" checked={form.ativo} onChange={set('ativo')} />
                <label htmlFor="ativo">Funcionário ativo</label>
              </div>

              <div className="form-full" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 4 }}>
                <span style={{ fontWeight: 600, color: '#1e3a5f', fontSize: 13 }}>Acesso ao sistema</span>
              </div>
              <div>
                <label className="form-label">Login *</label>
                <input className="form-input" value={form.login} onChange={set('login')} placeholder="Ex: joao.silva" />
              </div>
              <div>
                <label className="form-label">E-mail (recuperação de senha)</label>
                <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="Ex: joao@email.com" />
              </div>
              <div>
                <label className="form-label">{editando ? 'Nova senha (em branco = manter)' : 'Senha *'}</label>
                <input className="form-input" type="password" value={form.senha} onChange={set('senha')} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="form-label">Confirmar senha</label>
                <input className="form-input" type="password" value={form.confirmarSenha} onChange={set('confirmarSenha')} placeholder="Repita a senha" />
              </div>
            </div>
            {erro && <div className="alert alert-error">{erro}</div>}
            <div className="modal-footer">
              <button onClick={fechar} className="btn btn-secondary">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="btn btn-primary">
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
