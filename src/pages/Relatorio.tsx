import { useState, useEffect, useMemo } from 'react';
import { db, calcCustoDiario } from '../services/storage';
import type { Presenca, Funcionario, Obra } from '../types';
import { Search } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import ShareButton from '../components/ShareButton';
import { useAdminEmail } from '../hooks/useAdminEmail';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

export default function Relatorio() {
  const hoje = new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio]   = useState(hoje);
  const [dataFim, setDataFim]         = useState(hoje);
  const [obraFiltro, setObraFiltro]   = useState('');
  const [presencas, setPresencas]     = useState<Presenca[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [obras, setObras]             = useState<Obra[]>([]);
  const [carregando, setCarregando]   = useState(false);
  const { run } = useApi();
  const adminEmail = useAdminEmail();
  const [buscaNome, setBuscaNome] = useState('');

  useEffect(() => {
    run(() => Promise.all([db.getFuncionariosAsync(), db.getObrasAsync()])
      .then(([f, o]) => { setFuncionarios(f); setObras(o); }));
    buscar();
  }, []);

  async function buscar() {
    setCarregando(true);
    try {
      const todas = await db.getPresencasAsync({ de: dataInicio, ate: dataFim });
      setPresencas(obraFiltro ? todas.filter(p => p.obraId === obraFiltro) : todas);
    } finally { setCarregando(false); }
  }

  const porFuncionario = (() => {
    const map: Record<string, { nome: string; funcao: string; dias: number; diarias: number; transporte: number; alimentacao: number; total: number }> = {};
    presencas.forEach(p => {
      const f = funcionarios.find(x => x.id === p.funcionarioId);
      if (!f) return;
      const custo = calcCustoDiario(f, p.status);
      if (!map[f.id]) map[f.id] = { nome: f.nome, funcao: f.funcao, dias: 0, diarias: 0, transporte: 0, alimentacao: 0, total: 0 };
      map[f.id].dias       += p.status === 'meio-periodo' ? 0.5 : p.status === 'presente' ? 1 : 0;
      map[f.id].diarias    += custo.diaria;
      map[f.id].transporte += custo.transporte;
      map[f.id].alimentacao += custo.alimentacao;
      map[f.id].total      += custo.total;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  const totais = porFuncionario.reduce((acc, r) => ({
    dias: acc.dias + r.dias, diarias: acc.diarias + r.diarias,
    transporte: acc.transporte + r.transporte, alimentacao: acc.alimentacao + r.alimentacao,
    total: acc.total + r.total,
  }), { dias: 0, diarias: 0, transporte: 0, alimentacao: 0, total: 0 });

  const porFuncionarioFiltrado = useMemo(() => {
    const b = buscaNome.toLowerCase();
    return b ? porFuncionario.filter(r => r.nome.toLowerCase().includes(b) || r.funcao.toLowerCase().includes(b)) : porFuncionario;
  }, [porFuncionario, buscaNome]);

  const pg = usePagination(porFuncionarioFiltrado);

  const resumo = [
    { label: 'Total Diárias',     value: `R$ ${totais.diarias.toFixed(2)}`,     color: '#1e3a5f' },
    { label: 'Total Transporte',  value: `R$ ${totais.transporte.toFixed(2)}`,  color: '#d97706' },
    { label: 'Total Alimentação', value: `R$ ${totais.alimentacao.toFixed(2)}`, color: '#7c3aed' },
    { label: 'CUSTO TOTAL',       value: `R$ ${totais.total.toFixed(2)}`,       color: '#dc2626' },
  ];

  function buildTexto() {
    const obraNome = obraFiltro ? obras.find(o => o.id === obraFiltro)?.nome : 'Todas';
    const linhas = porFuncionario.map(r =>
      `• ${r.nome} (${r.funcao}) — ${r.dias} dia(s) | Diárias: R$${r.diarias.toFixed(2)} | Transp: R$${r.transporte.toFixed(2)} | Alim: R$${r.alimentacao.toFixed(2)} | Total: R$${r.total.toFixed(2)}`
    );
    return [
      `*Relatório de Custos*`,
      `Período: ${dataInicio} a ${dataFim} | Obra: ${obraNome}`,
      '',
      ...linhas,
      '',
      `TOTAL: R$${totais.total.toFixed(2)}`,
    ].join('\n');
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Relatório de Custos</h2>
        <ShareButton buildTexto={buildTexto} assunto={`Relatório de Custos ${dataInicio} a ${dataFim}`} adminEmail={adminEmail} />
      </div>

      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div className="form-grid" style={{ alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Data Início</label>
            <input type="date" className="form-input" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Data Fim</label>
            <input type="date" className="form-input" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div className="form-full">
            <label className="form-label">Obra</label>
            <select className="form-input" value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}>
              <option value="">Todas as obras</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <button onClick={buscar} disabled={carregando} className="btn btn-primary" style={{ width: '100%' }}>
              <Search size={15} /> {carregando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      <div className="dash-grid" style={{ marginBottom: 20 }}>
        {resumo.map(c => (
          <div key={c.label} className="dash-card" style={{ borderLeft: `4px solid ${c.color}` }}>
            <div className="dash-card-value" style={{ color: c.color, fontSize: 20 }}>{c.value}</div>
            <div className="dash-card-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={15} color="#94a3b8" />
          <input className="form-input" style={{ maxWidth: 260 }} placeholder="Filtrar por nome ou função..." value={buscaNome} onChange={e => setBuscaNome(e.target.value)} />
          {buscaNome && <button className="btn btn-secondary btn-sm" onClick={() => setBuscaNome('')}>Limpar</button>}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{['Funcionário', 'Função', 'Dias', 'Diárias', 'Transporte', 'Alimentação', 'Total'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {pg.paged.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>{porFuncionario.length === 0 ? 'Nenhum registro no período' : 'Nenhum resultado para o filtro'}</td></tr>
              )}
              {pg.paged.map(r => (
                <tr key={r.nome}>
                  <td style={{ fontWeight: 500 }}>{r.nome}</td>
                  <td style={{ color: '#64748b' }}>{r.funcao}</td>
                  <td>{r.dias}</td>
                  <td>R$ {r.diarias.toFixed(2)}</td>
                  <td>R$ {r.transporte.toFixed(2)}</td>
                  <td>R$ {r.alimentacao.toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: '#1e3a5f' }}>R$ {r.total.toFixed(2)}</td>
                </tr>
              ))}
              {porFuncionario.length > 0 && (
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={2}>TOTAL GERAL</td>
                  <td>{totais.dias}</td>
                  <td>R$ {totais.diarias.toFixed(2)}</td>
                  <td>R$ {totais.transporte.toFixed(2)}</td>
                  <td>R$ {totais.alimentacao.toFixed(2)}</td>
                  <td style={{ color: '#dc2626' }}>R$ {totais.total.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pg.page} totalPages={pg.totalPages} pageSize={pg.pageSize} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </div>
    </div>
  );
}
