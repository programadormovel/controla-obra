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
          <button className="btn-menu" onClick={() => setMenuOpen(o => !o)} aria-label="Menu"
            style={{ display: undefined }}>
            {menuOpen ? <X size={22} color="#fff" /> : <Menu size={22} color="#fff" />}
          </button>
          <HardHat size={22} color="#f59e0b" />
          <span>Controla Obra</span>
        </div>
        <div className="app-header-user">
          <span style={{ display: 'none' }} className="user-name-desktop">
            {usuario?.funcionarioNome ?? usuario?.login}
          </span>
          <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-func'}`}>
            {isAdmin ? 'Admin' : 'Func'}
          </span>
          <button className="btn-logout" onClick={logout}>
            <LogOut size={13} />
            <span style={{ display: 'none' }} className="logout-label">Sair</span>
          </button>
        </div>
      </header>

      {/* overlay mobile */}
      <div className={`app-nav-overlay${menuOpen ? ' open' : ''}`} onClick={close} />

      {/* nav */}
      <nav className={`app-nav${menuOpen ? ' open' : ''}`}>
        {menuOpen && (
          <div style={{ padding: '4px 8px 12px', borderBottom: '1px solid #e2e8f0', marginBottom: 8, fontSize: 13, color: '#64748b' }}>
            {usuario?.funcionarioNome ?? usuario?.login}
          </div>
        )}
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={close}>
            {n.icon}{n.label}
          </NavLink>
        ))}
        {menuOpen && (
          <button className="nav-link btn-logout" onClick={() => { logout(); close(); }}
            style={{ marginTop: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', width: '100%' }}>
            <LogOut size={16} /> Sair
          </button>
        )}
      </nav>

      <main className="app-main">{children}</main>

      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ width: 36, height: 36, border: '4px solid #e2e8f0', borderTop: '4px solid #1e3a5f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>Aguarde...</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) {
          .btn-menu { display: none !important; }
          .app-nav  { position: static !important; transform: none !important; width: auto !important;
            flex-direction: row !important; padding: 0 16px !important;
            border-bottom: 1px solid #e2e8f0 !important; border-right: none !important;
            top: auto !important; bottom: auto !important; left: auto !important;
            overflow: visible !important; }
          .user-name-desktop { display: inline !important; }
          .logout-label { display: inline !important; }
        }
      `}</style>
    </div>
  );
}
