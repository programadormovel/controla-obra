import { useState, useEffect } from 'react';
import { db, calcCustoDiario } from '../services/storage';
import type { Presenca, Funcionario, Obra } from '../types';
import { Users, DollarSign, MapPin, HardHat } from 'lucide-react';

export default function Dashboard() {
  const hoje = new Date().toISOString().split('T')[0];
  const [presencas, setPresencas]     = useState<Presenca[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [obras, setObras]             = useState<Obra[]>([]);

  useEffect(() => {
    Promise.all([
      db.getPresencasAsync({ data: hoje }),
      db.getFuncionariosAsync(),
      db.getObrasAsync(),
    ]).then(([p, f, o]) => { setPresencas(p); setFuncionarios(f); setObras(o); });
  }, []);

  const custoHoje = presencas.reduce((acc, p) => {
    const f = funcionarios.find(x => x.id === p.funcionarioId);
    return f ? acc + calcCustoDiario(f, p.status).total : acc;
  }, 0);

  const cards = [
    { label: 'Presentes Hoje',      value: presencas.length,                        icon: <Users size={20} />,     color: '#1e3a5f' },
    { label: 'Custo Total Hoje',    value: `R$ ${custoHoje.toFixed(2)}`,             icon: <DollarSign size={20} />, color: '#059669' },
    { label: 'Obras Ativas',        value: obras.filter(o => o.ativa).length,        icon: <MapPin size={20} />,    color: '#d97706' },
    { label: 'Funcionários Ativos', value: funcionarios.filter(f => f.ativo).length, icon: <HardHat size={20} />,   color: '#7c3aed' },
  ];

  const statusColor: Record<string, string> = { presente: '#059669', ausente: '#dc2626', 'meio-periodo': '#d97706' };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </span>
      </div>

      <div className="dash-grid" style={{ marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} className="dash-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: c.color + '18', borderRadius: 8, padding: 10, color: c.color, flexShrink: 0 }}>{c.icon}</div>
            <div>
              <div className="dash-card-value">{c.value}</div>
              <div className="dash-card-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: 15 }}>Presenças de Hoje</h3>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Funcionário', 'Função', 'Obra', 'Entrada', 'Status', 'Distância', 'Custo'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {presencas.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhuma presença registrada hoje</td></tr>
              )}
              {presencas.map(p => {
                const f = funcionarios.find(x => x.id === p.funcionarioId);
                const o = obras.find(x => x.id === p.obraId);
                const custo = f ? calcCustoDiario(f, p.status) : null;
                const cor = statusColor[p.status];
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{f?.nome}</td>
                    <td style={{ color: '#64748b' }}>{f?.funcao}</td>
                    <td>{o?.nome}</td>
                    <td>{p.horaEntrada}</td>
                    <td>
                      <span className="status-badge" style={{ background: cor + '18', color: cor }}>
                        {p.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td style={{ color: p.distanciaObra > 200 ? '#dc2626' : '#059669' }}>{p.distanciaObra}m</td>
                    <td style={{ fontWeight: 600, color: '#1e3a5f' }}>R$ {custo?.total.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
