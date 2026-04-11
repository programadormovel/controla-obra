import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Funcionario, UsuarioAdmin } from '../types';
import { Plus, Edit2, X, Save, Trash2, KeyRound, Mail, ShieldCheck } from 'lucide-react';

type FormUsuario = { login: string; perfil: 'admin' | 'funcionario'; funcionarioId: string; email: string; ativo: boolean; senha: string; confirmarSenha: string; };
const vazio: FormUsuario = { login: '', perfil: 'funcionario', funcionarioId: '', email: '', ativo: true, senha: '', confirmarSenha: '' };

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Usuarios() {
  const [lista, setLista] = useState<UsuarioAdmin[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [form, setForm] = useState<FormUsuario>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<UsuarioAdmin | null>(null);
  const [resetando, setResetando] = useState<string | null>(null);
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null);

  async function carregar() {
    const [usuarios, funcs] = await Promise.all([api.getUsuarios(), api.getFuncionarios()]);
    setLista(usuarios);
    setFuncionarios(funcs);
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setForm(vazio); setEditando(null); setErro(null); setModal(true); }
  function abrirEdicao(u: UsuarioAdmin) {
    setForm({ login: u.login, perfil: u.perfil, funcionarioId: u.funcionarioId ?? '', email: u.email ?? '', ativo: u.ativo, senha: '', confirmarSenha: '' });
    setEditando(u); setErro(null); setModal(true);
  }
  function fechar() { setModal(false); setEditando(null); setForm(vazio); setErro(null); }

  async function salvar() {
    if (!form.login) return setErro('Login é obrigatório.');
    if (!editando && !form.senha) return setErro('Senha é obrigatória para novo usuário.');
    if (form.senha && form.senha !== form.confirmarSenha) return setErro('As senhas não conferem.');
    if (form.senha && form.senha.length < 6) return setErro('A senha deve ter no mínimo 6 caracteres.');
    setSalvando(true); setErro(null);
    try {
      const payload: Parameters<typeof api.saveUsuario>[0] = {
        id: editando?.id ?? 'u' + Date.now(),
        login: form.login, perfil: form.perfil,
        funcionarioId: form.funcionarioId || null,
        email: form.email || null, ativo: form.ativo,
      };
      if (form.senha) payload.senhaHash = await sha256(form.senha);
      await api.saveUsuario(payload);
      await carregar();
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar usuário.');
    } finally { setSalvando(false); }
  }

  async function excluir(u: UsuarioAdmin) {
    try { await api.deleteUsuario(u.id); await carregar(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Erro ao excluir.'); }
    setConfirmExcluir(null);
  }

  async function resetSenha(u: UsuarioAdmin) {
    if (!u.email) return alert('Usuário não possui e-mail cadastrado.');
    setResetando(u.id);
    try {
      await api.resetSenha(u.id);
      setMsgSucesso(`Nova senha enviada para ${u.email}`);
      setTimeout(() => setMsgSucesso(null), 5000);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao resetar senha.');
    } finally { setResetando(null); }
  }

  const funcDisponiveis = funcionarios.filter(f =>
    !lista.some(u => u.funcionarioId === f.id && u.id !== editando?.id)
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Usuários</h2>
        <button onClick={abrirNovo} className="btn btn-primary"><Plus size={16} /> Novo Usuário</button>
      </div>

      {msgSucesso && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={16} /> {msgSucesso}
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{['Login', 'Perfil', 'Funcionário', 'E-mail', 'Status', 'Ações'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum usuário cadastrado</td></tr>}
              {lista.map(u => (
                <tr key={u.id} style={{ opacity: u.ativo ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={14} color={u.perfil === 'admin' ? '#f59e0b' : '#3b82f6'} />
                      {u.login}
                    </div>
                  </td>
                  <td><span className={`status-badge ${u.perfil === 'admin' ? 'perfil-admin' : 'perfil-func'}`}>{u.perfil === 'admin' ? 'Admin' : 'Funcionário'}</span></td>
                  <td style={{ color: '#64748b' }}>{u.funcionarioNome ?? '—'}</td>
                  <td style={{ color: '#64748b' }}>{u.email ?? '—'}</td>
                  <td><span className={`status-badge ${u.ativo ? 'status-ativo' : 'status-inativo'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => abrirEdicao(u)} className="btn btn-secondary btn-sm"><Edit2 size={12} /> Editar</button>
                      <button onClick={() => resetSenha(u)} disabled={resetando === u.id || !u.email}
                        title={!u.email ? 'Cadastre um e-mail para resetar a senha' : 'Enviar nova senha por e-mail'}
                        className="btn btn-green btn-sm" style={{ opacity: !u.email ? 0.5 : 1 }}>
                        <KeyRound size={12} /> {resetando === u.id ? 'Enviando...' : 'Reset'}
                      </button>
                      <button onClick={() => setConfirmExcluir(u)} className="btn btn-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editando ? 'Editar Usuário' : 'Novo Usuário'}</span>
              <button className="btn-icon" onClick={fechar}><X size={20} /></button>
            </div>
            <div className="form-grid">
              <div>
                <label className="form-label">Login *</label>
                <input className="form-input" value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} placeholder="Ex: joao.silva" />
              </div>
              <div>
                <label className="form-label">Perfil *</label>
                <select className="form-input" value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value as 'admin' | 'funcionario', funcionarioId: '' }))}>
                  <option value="funcionario">Funcionário</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {form.perfil === 'funcionario' && (
                <div className="form-full">
                  <label className="form-label">Funcionário vinculado</label>
                  <select className="form-input" value={form.funcionarioId} onChange={e => setForm(f => ({ ...f, funcionarioId: e.target.value }))}>
                    <option value="">— Selecione —</option>
                    {funcDisponiveis.map(f => <option key={f.id} value={f.id}>{f.nome} ({f.funcao})</option>)}
                    {editando?.funcionarioId && !funcDisponiveis.find(f => f.id === editando.funcionarioId) && (
                      <option value={editando.funcionarioId}>{editando.funcionarioNome}</option>
                    )}
                  </select>
                </div>
              )}
              <div className="form-full">
                <label className="form-label">E-mail (para recuperação de senha)</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Ex: joao@email.com" />
              </div>
              <div>
                <label className="form-label">{editando ? 'Nova senha (em branco = manter)' : 'Senha *'}</label>
                <input className="form-input" type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="form-label">Confirmar senha</label>
                <input className="form-input" type="password" value={form.confirmarSenha} onChange={e => setForm(f => ({ ...f, confirmarSenha: e.target.value }))} placeholder="Repita a senha" />
              </div>
              <div className="form-full form-check">
                <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                <label htmlFor="ativo">Usuário ativo</label>
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
              <span className="modal-title">Excluir Usuário</span>
            </div>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>Tem certeza que deseja excluir:</p>
            <p style={{ fontWeight: 700, marginBottom: 20 }}>{confirmExcluir.login}</p>
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
