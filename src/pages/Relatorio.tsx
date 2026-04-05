import { useState } from 'react';
import { db, calcCustoDiario } from '../services/storage';

export default function Relatorio() {
  const hoje = new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [obraFiltro, setObraFiltro] = useState('');

  const funcionarios = db.getFuncionarios();
  const obras = db.getObras();
  const presencas = db.getPresencas();

  const filtradas = presencas.filter(p =>
    p.data >= dataInicio && p.data <= dataFim && (!obraFiltro || p.obraId === obraFiltro)
  );

  const porFuncionario = (() => {
    const map: Record<string, { nome: string; funcao: string; dias: number; diarias: number; transporte: number; alimentacao: number; total: number }> = {};
    filtradas.forEach(p => {
      const f = funcionarios.find(x => x.id === p.funcionarioId);
      if (!f) return;
      const custo = calcCustoDiario(f, p.status);
      if (!map[f.id]) map[f.id] = { nome: f.nome, funcao: f.funcao, dias: 0, diarias: 0, transporte: 0, alimentacao: 0, total: 0 };
      map[f.id].dias += p.status === 'meio-periodo' ? 0.5 : p.status === 'presente' ? 1 : 0;
      map[f.id].diarias += custo.diaria;
      map[f.id].transporte += custo.transporte;
      map[f.id].alimentacao += custo.alimentacao;
      map[f.id].total += custo.total;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  const totais = porFuncionario.reduce((acc, r) => ({
    dias: acc.dias + r.dias, diarias: acc.diarias + r.diarias,
    transporte: acc.transporte + r.transporte, alimentacao: acc.alimentacao + r.alimentacao, total: acc.total + r.total
  }), { dias: 0, diarias: 0, transporte: 0, alimentacao: 0, total: 0 });

  const inputStyle = { padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 };
  const thStyle = { padding: '10px 16px', textAlign: 'left' as const, color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#1e293b' }}>Relatório de Custos</h2>
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px #0001', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Data Início</label>
          <input type="date" style={inputStyle} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Data Fim</label>
          <input type="date" style={inputStyle} value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Obra</label>
          <select style={inputStyle} value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}>
            <option value="">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Diárias', value: `R$ ${totais.diarias.toFixed(2)}`, color: '#1e3a5f' },
          { label: 'Total Transporte', value: `R$ ${totais.transporte.toFixed(2)}`, color: '#d97706' },
          { label: 'Total Alimentação', value: `R$ ${totais.alimentacao.toFixed(2)}`, color: '#7c3aed' },
          { label: 'CUSTO TOTAL', value: `R$ ${totais.total.toFixed(2)}`, color: '#dc2626' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px #0001', borderLeft: `4px solid ${c.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px #0001', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Funcionário', 'Função', 'Dias', 'Diárias', 'Transporte', 'Alimentação', 'Total'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {porFuncionario.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum registro no período</td></tr>
            )}
            {porFuncionario.map(r => (
              <tr key={r.nome} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{r.nome}</td>
                <td style={{ padding: '10px 16px', color: '#64748b' }}>{r.funcao}</td>
                <td style={{ padding: '10px 16px' }}>{r.dias}</td>
                <td style={{ padding: '10px 16px' }}>R$ {r.diarias.toFixed(2)}</td>
                <td style={{ padding: '10px 16px' }}>R$ {r.transporte.toFixed(2)}</td>
                <td style={{ padding: '10px 16px' }}>R$ {r.alimentacao.toFixed(2)}</td>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: '#1e3a5f' }}>R$ {r.total.toFixed(2)}</td>
              </tr>
            ))}
            {porFuncionario.length > 0 && (
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: '10px 16px' }}>TOTAL</td>
                <td style={{ padding: '10px 16px' }}>{totais.dias}</td>
                <td style={{ padding: '10px 16px' }}>R$ {totais.diarias.toFixed(2)}</td>
                <td style={{ padding: '10px 16px' }}>R$ {totais.transporte.toFixed(2)}</td>
                <td style={{ padding: '10px 16px' }}>R$ {totais.alimentacao.toFixed(2)}</td>
                <td style={{ padding: '10px 16px', color: '#dc2626' }}>R$ {totais.total.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
