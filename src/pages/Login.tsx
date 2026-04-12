import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, LogIn } from 'lucide-react';

export default function Login() {
  const { login, loading, erro } = useAuth();
  const loginParam = new URLSearchParams(window.location.search).get('login') ?? '';
  const [form, setForm] = useState({ login: loginParam, senha: '' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login(form.login, form.senha);
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <HardHat size={32} color="#f59e0b" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#1e293b' }}>Controla Obra</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Acesse sua conta</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Login</label>
            <input className="form-input" placeholder="usuário ou telefone"
              value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              autoComplete="username" required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Senha</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
              autoComplete="current-password" required />
          </div>

          {erro && <div className="alert alert-error" style={{ marginBottom: 16, marginTop: 0 }}>{erro}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            <LogIn size={16} /> {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b' }}>
          {/* <strong>Admin:</strong> login <code>admin</code> / senha <code>admin123</code><br />
          <strong>Funcionário:</strong> login = telefone / senha <code>obra1234</code> */}
        </div>
      </div>
    </div>
  );
}
