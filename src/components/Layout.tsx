import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardCheck, BarChart2, HardHat, LogOut, Building2, UserCog, Menu, X, CalendarDays, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { usuario, logout } = useAuth();
  const { loading } = useLoading();
  const isAdmin = usuario?.perfil === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = [
    ...(isAdmin ? [{ to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' }] : []),
    { to: '/presenca', icon: <ClipboardCheck size={18} />, label: 'Presença' },
    ...(isAdmin ? [
      { to: '/funcionarios', icon: <Users size={18} />, label: 'Funcionários' },
      { to: '/cargos', icon: <Briefcase size={18} />, label: 'Cargos' },
      { to: '/obras', icon: <Building2 size={18} />, label: 'Obras' },
      { to: '/gestao-presencas', icon: <CalendarDays size={18} />, label: 'Presenças' },
      { to: '/relatorio', icon: <BarChart2 size={18} />, label: 'Relatório' },
      { to: '/usuarios', icon: <UserCog size={18} />, label: 'Usuários' },
    ] : []),
  ];

  function close() { setMenuOpen(false); }

  return (
    <div style={{ minHeight: '100dvh', background: '#f1f5f9' }}>
      <header className="app-header">
        <div className="app-header-brand">
          <button className="btn-menu" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            {menuOpen ? <X size={20} color="#fff" /> : <Menu size={20} color="#fff" />}
          </button>
          <HardHat size={20} color="#f59e0b" />
          <span>Controla Obra</span>
        </div>

        <div className="app-header-user">
          <span className="user-name">{usuario?.funcionarioNome ?? usuario?.login}</span>
          <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-func'}`}>
            {isAdmin ? 'Admin' : 'Func'}
          </span>
          <button className="btn-logout" onClick={logout}>
            <LogOut size={13} />
            <span className="logout-label">Sair</span>
          </button>
        </div>
      </header>

      <div className={`app-nav-overlay${menuOpen ? ' open' : ''}`} onClick={close} />

      <nav className={`app-nav${menuOpen ? ' open' : ''}`}>
        {/* info do usuário — só no drawer mobile */}
        <div className="nav-user-info">
          <strong>{usuario?.funcionarioNome ?? usuario?.login}</strong>
          <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-func'}`} style={{ marginTop: 4 }}>
            {isAdmin ? 'Administrador' : 'Funcionário'}
          </span>
        </div>

        {nav.map(n => (
          <NavLink
            key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={close}
          >
            {n.icon}{n.label}
          </NavLink>
        ))}

        <button className="nav-logout-btn" onClick={() => { logout(); close(); }}>
          <LogOut size={16} /> Sair
        </button>
      </nav>

      <main className="app-main">{children}</main>

      {loading && (
        <div className="spinner-overlay">
          <div className="spinner-box">
            <div className="spinner" />
            <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>Aguarde...</span>
          </div>
        </div>
      )}
    </div>
  );
}
