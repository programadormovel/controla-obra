import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardCheck, BarChart2, HardHat } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const nav = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/presenca', icon: <ClipboardCheck size={18} />, label: 'Presença' },
    { to: '/funcionarios', icon: <Users size={18} />, label: 'Funcionários' },
    { to: '/relatorio', icon: <BarChart2 size={18} />, label: 'Relatório' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#1e3a5f', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
        <HardHat size={24} color="#f59e0b" />
        <span style={{ fontWeight: 700, fontSize: 18 }}>Controla Obra</span>
      </header>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 4, padding: '0 16px' }}>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
              color: isActive ? '#1e3a5f' : '#64748b',
              borderBottom: isActive ? '2px solid #1e3a5f' : '2px solid transparent',
            })}>
            {n.icon}{n.label}
          </NavLink>
        ))}
      </nav>
      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>{children}</main>
    </div>
  );
}
