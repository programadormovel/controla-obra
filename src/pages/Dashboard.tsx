import { db, calcCustoDiario } from '../services/storage';
import { Users, DollarSign, MapPin, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const hoje = new Date().toISOString().split('T')[0];
  const presencasHoje = db.getPresencas().filter(p => p.data === hoje);
  const funcionarios = db.getFuncionarios();
  const obras = db.getObras();

  const custoHoje = presencasHoje.reduce((acc, p) => {
    const f = funcionarios.find(x => x.id === p.funcionarioId);
    if (!f) return acc;
    return acc + calcCustoDiario(f, p.status).total;
  }, 0);

  const cards = [
    { label: 'Presentes Hoje', value: presencasHoje.length, icon: <Users size={22} />, color: '#1e3a5f' },
    { label: 'Custo Total Hoje', value: `R$ ${custoHoje.toFixed(2)}`, icon: <DollarSign size={22} />, color: '#059669' },
    { label: 'Obras Ativas', value: obras.filter(o => o.ativa).length, icon: <MapPin size={22} />, color: '#d97706' },
    { label: 'Funcionários Ativos', value: funcionarios.filter(f => f.ativo).length, icon: <AlertCircle size={22} />, color: '#7c3aed' },
  ];

  const statusColor: Record<string, string> = { presente: '#059669', ausente: '#dc2626', 'meio-periodo': '#d97706' };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#1e293b' }}>Dashboard — {new Date().toLocaleDateString('pt-BR')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px #0001', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: c.color + '18', borderRadius: 8, padding: 10, color: c.color }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{c.value}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ margin: '0 0 12px', color: '#1e293b' }}>Presenças de Hoje</h3>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px #0001', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Funcionário', 'Função', 'Obra', 'Entrada', 'Status', 'Distância', 'Custo'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {presencasHoje.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhuma presença registrada hoje</td></tr>
            )}
            {presencasHoje.map(p => {
              const f = funcionarios.find(x => x.id === p.funcionarioId);
              const o = obras.find(x => x.id === p.obraId);
              const custo = f ? calcCustoDiario(f, p.status) : null;
              const cor = statusColor[p.status];
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{f?.nome}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{f?.funcao}</td>
                  <td style={{ padding: '10px 16px' }}>{o?.nome}</td>
                  <td style={{ padding: '10px 16px' }}>{p.horaEntrada}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: cor + '18', color: cor, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {p.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: p.distanciaObra > 200 ? '#dc2626' : '#059669' }}>{p.distanciaObra}m</td>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e3a5f' }}>R$ {custo?.total.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
