import { createContext, useContext, useState } from 'react';
import type { Usuario } from '../types';
import { api } from '../services/api';

type AuthState = {
  usuario: Usuario | null;
  loading: boolean;
  erro: string;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState>(null!);

const SESSION_KEY = 'co_usuario';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function login(loginStr: string, senha: string) {
    setLoading(true);
    setErro('');
    try {
      const u = await api.login(loginStr, senha);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
      setUsuario(u);
    } catch {
      setErro('Login ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, erro, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
