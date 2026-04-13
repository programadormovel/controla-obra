import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/storage';
import type { Presenca, Funcionario, Obra } from '../types';
import { Search, Clock, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import ShareButton from '../components/ShareButton';
import { useAdminEmail } from '../hooks/useAdminEmail';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { JORNADA_META_MINUTOS, formatarMinutos, minutosTrabalhados } from '../utils/jornada';
import { getAdicionalHE, multiplicadorHE } from '../hooks/useConfigHE';

function minutosEfetivos(p: Presenca): number {
  return p.minutosTrabalhados ?? p.minutosTrabalhadosTotal ?? (p.horaSaida ? minutosTrabalhados(p, '00:00:00') : 0);
}

function custoHoraExtra(f: Funcionario, minutosExtra: number, mult: number): number {
  return (f.diaria / 8) * mult * (minutosExtra / 60);
}

type LinhaFuncionario = {
  id: string;
  nome: string;
  funcao: string;
  diasPresente: number;
  diasHE: number;
  diasHEAutorizada: number;
  minutosExtra: number;
  minutosExtraAutorizado: number;
  custoHE: number;
  custoHEAutorizado: number;
  diarias: number;
  transporte: number;
  alimentacao: number;
  totalSemHE: number;
  totalComHE: number;
  presencas: Presenca[];
};

type LinhaDetalhe = {
  data: string;
  funcionarioNome: string;
  obraNome: string;
  horaEntrada: string;
  horaSaida: string;
  minutosTrabalhados: number;
  minutosExtra: number;
  autorizada: boolean;
  autorizadoPor: string;
  custoHE: number;
};

export default function RelatorioHorasExtras() {
  const hoje = new Date().toISOString().split('T')[0];
  const umMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(umMesAtras);
  const [dataFim, setDataFim] = useState(hoje);
  const [obraFiltro, setObraFiltro] = useState('');
  const [apenasHE, setApenasHE] = useState(true);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState<'resumo' | 'detalhe'>('resumo');
  const [buscaNome, setBuscaNome] = useState('');
  const { run } = useApi();
  const adminEmail = useAdminEmail();
  const [mult, setMult] = useState(() => multiplicadorHE());

  // relê a configuração sempre que a página recebe foco (ex: voltou de Configurações)
  useEffect(() => {
    function onFocus() { setMult(multiplicadorHE()); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

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

  // ── Resumo por funcionário ──────────────────────────────────────────────────
  const porFuncionario = useMemo<LinhaFuncionario[]>(() => {
    const map: Record<string, LinhaFuncionario> = {};

    presencas.forEach(p => {
      const f = funcionarios.find(x => x.id === p.funcionarioId);
      if (!f) return;

      if (!map[f.id]) {
        map[f.id] = {
          id: f.id, nome: f.nome, funcao: f.funcao,
          diasPresente: 0, diasHE: 0, diasHEAutorizada: 0,
          minutosExtra: 0, minutosExtraAutorizado: 0,
          custoHE: 0, custoHEAutorizado: 0,
          diarias: 0, transporte: 0, alimentacao: 0,
          totalSemHE: 0, totalComHE: 0,
          presencas: [],
        };
      }

      const linha = map[f.id];
      linha.presencas.push(p);

      if (p.status === 'presente' || p.status === 'meio-periodo') {
        const fator = p.status === 'meio-periodo' ? 0.5 : 1;
        linha.diasPresente += fator;
        linha.diarias += f.diaria * fator;
        linha.transporte += f.transporte;
        linha.alimentacao += f.alimentacao;
        linha.totalSemHE += f.diaria * fator + f.transporte + f.alimentacao;
      }

      const mins = minutosEfetivos(p);
      if (p.horaSaida && mins > JORNADA_META_MINUTOS) {
        const extra = mins - JORNADA_META_MINUTOS;
        const custo = custoHoraExtra(f, extra, mult);
        linha.diasHE += 1;
        linha.minutosExtra += extra;
        linha.custoHE += custo;
        if (p.horaExtraAutorizada) {
          linha.diasHEAutorizada += 1;
          linha.minutosExtraAutorizado += extra;
          linha.custoHEAutorizado += custo;
        }
      }

      linha.totalComHE = linha.totalSemHE + linha.custoHEAutorizado;
    });

    return Object.values(map).sort((a, b) => b.minutosExtra - a.minutosExtra);
  }, [presencas, funcionarios, mult]);

  const filtrado = useMemo(() => {
    const b = buscaNome.toLowerCase();
    return porFuncionario.filter(r =>
      (!apenasHE || r.diasHE > 0) &&
      (!b || r.nome.toLowerCase().includes(b) || r.funcao.toLowerCase().includes(b))
    );
  }, [porFuncionario, apenasHE, buscaNome]);

  // ── Detalhe por registro ────────────────────────────────────────────────────
  const linhasDetalhe = useMemo<LinhaDetalhe[]>(() => {
    return presencas
      .filter(p => {
        const mins = minutosEfetivos(p);
        return p.horaSaida && mins > JORNADA_META_MINUTOS;
      })
      .map(p => {
        const f = funcionarios.find(x => x.id === p.funcionarioId);
        const o = obras.find(x => x.id === p.obraId);
        const mins = minutosEfetivos(p);
        const extra = mins - JORNADA_META_MINUTOS;
        return {
          data: p.data,
          funcionarioNome: f?.nome ?? p.funcionarioId,
          obraNome: o?.nome ?? p.obraId,
          horaEntrada: p.horaEntrada,
          horaSaida: p.horaSaida ?? '',
          minutosTrabalhados: mins,
          minutosExtra: extra,
          autorizada: Boolean(p.horaExtraAutorizada),
          autorizadoPor: p.autorizadoPor ?? '',
          custoHE: f ? custoHoraExtra(f, extra, mult) : 0,
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [presencas, funcionarios, obras, mult]);

  // ── Totais ──────────────────────────────────────────────────────────────────
  const totais = useMemo(() => porFuncionario.reduce((acc, r) => ({
    diasHE: acc.diasHE + r.diasHE,
    diasHEAutorizada: acc.diasHEAutorizada + r.diasHEAutorizada,
    minutosExtra: acc.minutosExtra + r.minutosExtra,
    minutosExtraAutorizado: acc.minutosExtraAutorizado + r.minutosExtraAutorizado,
    custoHE: acc.custoHE + r.custoHE,
    custoHEAutorizado: acc.custoHEAutorizado + r.custoHEAutorizado,
    totalComHE: acc.totalComHE + r.totalComHE,
  }), { diasHE: 0, diasHEAutorizada: 0, minutosExtra: 0, minutosExtraAutorizado: 0, custoHE: 0, custoHEAutorizado: 0, totalComHE: 0 }), [porFuncionario]);

  const pg = usePagination(filtrado);
  const pgDetalhe = usePagination(linhasDetalhe);

  // ── Export ──────────────────────────────────────────────────────────────────
  function buildRows() {
    if (aba === 'detalhe') {
      return linhasDetalhe.map(r => ({
        'Data': r.data,
        'Funcionário': r.funcionarioNome,
        'Obra': r.obraNome,
        'Entrada': r.horaEntrada,
        'Saída': r.horaSaida,
        'Trabalhado': formatarMinutos(r.minutosTrabalhados),
        'HE': formatarMinutos(r.minutosExtra),
        'Autorizada': r.autorizada ? 'Sim' : 'Não',
        'Autorizado por': r.autorizadoPor,
        'Custo HE (R$)': +r.custoHE.toFixed(2),
      }));
    }
    const rows = porFuncionario.map(r => ({
      'Funcionário': r.nome,
      'Função': r.funcao,
      'Dias c/ HE': r.diasHE,
      'HE Autorizada (dias)': r.diasHEAutorizada,
      'Total HE': formatarMinutos(r.minutosExtra),
      'HE Autorizada': formatarMinutos(r.minutosExtraAutorizado),
      'Custo HE Total (R$)': +r.custoHE.toFixed(2),
      'Custo HE Autorizada (R$)': +r.custoHEAutorizado.toFixed(2),
      'Diárias (R$)': +r.diarias.toFixed(2),
      'Transporte (R$)': +r.transporte.toFixed(2),
      'Alimentação (R$)': +r.alimentacao.toFixed(2),
      'Total c/ HE (R$)': +r.totalComHE.toFixed(2),
    }));
    rows.push({
      'Funcionário': 'TOTAL GERAL',
      'Função': '',
      'Dias c/ HE': totais.diasHE,
      'HE Autorizada (dias)': totais.diasHEAutorizada,
      'Total HE': formatarMinutos(totais.minutosExtra),
      'HE Autorizada': formatarMinutos(totais.minutosExtraAutorizado),
      'Custo HE Total (R$)': +totais.custoHE.toFixed(2),
      'Custo HE Autorizada (R$)': +totais.custoHEAutorizado.toFixed(2),
      'Diárias (R$)': 0,
      'Transporte (R$)': 0,
      'Alimentação (R$)': 0,
      'Total c/ HE (R$)': +totais.totalComHE.toFixed(2),
    });
    return rows;
  }

  function buildTexto() {
    const obraNome = obraFiltro ? obras.find(o => o.id === obraFiltro)?.nome : 'Todas';
    const linhas = porFuncionario
      .filter(r => r.diasHE > 0)
      .map(r =>
        `• ${r.nome} (${r.funcao}) — ${r.diasHE} dia(s) c/ HE | ` +
        `HE total: ${formatarMinutos(r.minutosExtra)} | ` +
        `HE autorizada: ${formatarMinutos(r.minutosExtraAutorizado)} | ` +
        `Custo HE: R$${r.custoHEAutorizado.toFixed(2)}`
      );
    return [
      `*Relatório de Horas Extras*`,
      `Período: ${dataInicio} a ${dataFim} | Obra: ${obraNome}`,
      '',
      ...linhas,
      '',
      `Total HE: ${formatarMinutos(totais.minutosExtra)} | Custo HE autorizada: R$${totais.custoHEAutorizado.toFixed(2)}`,
    ].join('\n');
  }

  const cards = [
    { label: 'Dias com HE', value: String(totais.diasHE), sub: `${totais.diasHEAutorizada} autorizado(s)`, color: '#d97706', icon: <Clock size={18} /> },
    { label: 'Total HE', value: formatarMinutos(totais.minutosExtra), sub: `${formatarMinutos(totais.minutosExtraAutorizado)} autorizado`, color: '#7c3aed', icon: <AlertTriangle size={18} /> },
    { label: 'Custo HE (total)', value: `R$ ${totais.custoHE.toFixed(2)}`, sub: `R$ ${totais.custoHEAutorizado.toFixed(2)} autorizado`, color: '#dc2626', icon: <DollarSign size={18} /> },
    { label: 'Total c/ HE autorizada', value: `R$ ${totais.totalComHE.toFixed(2)}`, sub: `+${getAdicionalHE()}% adicional`, color: '#059669', icon: <CheckCircle size={18} /> },
  ];

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
    background: active ? '#1e3a5f' : '#f1f5f9', color: active ? '#fff' : '#64748b',
    border: 'none', borderRadius: 6, transition: 'all .15s',
  });

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Horas Extras</h2>
        <ShareButton
          buildTexto={buildTexto}
          assunto={`Horas Extras ${dataInicio} a ${dataFim}`}
          adminEmail={adminEmail}
          buildRows={buildRows}
          exportFilename={`horas_extras_${dataInicio}_${dataFim}`}
        />
      </div>

      {/* Filtros */}
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

      {/* Cards */}
      <div className="dash-grid" style={{ marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} className="dash-card" style={{ borderLeft: `4px solid ${c.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="dash-card-value" style={{ color: c.color, fontSize: 20 }}>{c.value}</div>
                <div className="dash-card-label">{c.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.sub}</div>
              </div>
              <div style={{ color: c.color, opacity: 0.4 }}>{c.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={tabStyle(aba === 'resumo')} onClick={() => setAba('resumo')}>Resumo por Funcionário</button>
        <button style={tabStyle(aba === 'detalhe')} onClick={() => setAba('detalhe')}>Detalhe por Registro</button>
      </div>

      {/* ── ABA RESUMO ── */}
      {aba === 'resumo' && (
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Search size={15} color="#94a3b8" />
            <input className="form-input" style={{ maxWidth: 220 }} placeholder="Filtrar por nome ou função..." value={buscaNome} onChange={e => setBuscaNome(e.target.value)} />
            {buscaNome && <button className="btn btn-secondary btn-sm" onClick={() => setBuscaNome('')}>Limpar</button>}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', marginLeft: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={apenasHE} onChange={e => setApenasHE(e.target.checked)} />
              Apenas com horas extras
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Função</th>
                  <th title="Dias com hora extra registrada">Dias c/ HE</th>
                  <th title="Dias com hora extra autorizada">HE Autorizada</th>
                  <th>Total HE</th>
                  <th>HE Autorizada</th>
                  <th>Custo HE</th>
                  <th>Custo HE Aut.</th>
                  <th>Diárias</th>
                  <th>Transp.</th>
                  <th>Alim.</th>
                  <th>Total c/ HE</th>
                </tr>
              </thead>
              <tbody>
                {pg.paged.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                    {porFuncionario.length === 0 ? 'Nenhum registro no período' : 'Nenhum funcionário com horas extras'}
                  </td></tr>
                )}
                {pg.paged.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.nome}</td>
                    <td style={{ color: '#64748b' }}>{r.funcao}</td>
                    <td style={{ textAlign: 'center' }}>
                      {r.diasHE > 0
                        ? <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 6px', fontSize: 12, fontWeight: 600 }}>{r.diasHE}</span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {r.diasHEAutorizada > 0
                        ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 4, padding: '2px 6px', fontSize: 12, fontWeight: 600 }}>{r.diasHEAutorizada}</span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ color: r.minutosExtra > 0 ? '#92400e' : '#94a3b8', fontWeight: r.minutosExtra > 0 ? 600 : 400 }}>
                      {r.minutosExtra > 0 ? formatarMinutos(r.minutosExtra) : '—'}
                    </td>
                    <td style={{ color: r.minutosExtraAutorizado > 0 ? '#166534' : '#94a3b8', fontWeight: r.minutosExtraAutorizado > 0 ? 600 : 400 }}>
                      {r.minutosExtraAutorizado > 0 ? formatarMinutos(r.minutosExtraAutorizado) : '—'}
                    </td>
                    <td style={{ color: r.custoHE > 0 ? '#dc2626' : '#94a3b8' }}>
                      {r.custoHE > 0 ? `R$ ${r.custoHE.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ color: r.custoHEAutorizado > 0 ? '#059669' : '#94a3b8', fontWeight: r.custoHEAutorizado > 0 ? 600 : 400 }}>
                      {r.custoHEAutorizado > 0 ? `R$ ${r.custoHEAutorizado.toFixed(2)}` : '—'}
                    </td>
                    <td>R$ {r.diarias.toFixed(2)}</td>
                    <td>R$ {r.transporte.toFixed(2)}</td>
                    <td>R$ {r.alimentacao.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: '#1e3a5f' }}>R$ {r.totalComHE.toFixed(2)}</td>
                  </tr>
                ))}
                {porFuncionario.length > 0 && (
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={2}>TOTAL GERAL</td>
                    <td style={{ textAlign: 'center' }}>{totais.diasHE}</td>
                    <td style={{ textAlign: 'center' }}>{totais.diasHEAutorizada}</td>
                    <td style={{ color: '#92400e' }}>{formatarMinutos(totais.minutosExtra)}</td>
                    <td style={{ color: '#166534' }}>{formatarMinutos(totais.minutosExtraAutorizado)}</td>
                    <td style={{ color: '#dc2626' }}>R$ {totais.custoHE.toFixed(2)}</td>
                    <td style={{ color: '#059669' }}>R$ {totais.custoHEAutorizado.toFixed(2)}</td>
                    <td colSpan={3} />
                    <td style={{ color: '#dc2626' }}>R$ {totais.totalComHE.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={pg.page} totalPages={pg.totalPages} pageSize={pg.pageSize} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </div>
      )}

      {/* ── ABA DETALHE ── */}
      {aba === 'detalhe' && (
        <div className="card">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#64748b' }}>
            {linhasDetalhe.length} registro{linhasDetalhe.length !== 1 ? 's' : ''} com hora extra no período
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Funcionário</th>
                  <th>Obra</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Trabalhado</th>
                  <th>HE</th>
                  <th>Autorizada</th>
                  <th>Custo HE</th>
                </tr>
              </thead>
              <tbody>
                {pgDetalhe.paged.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum registro com hora extra no período</td></tr>
                )}
                {pgDetalhe.paged.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{ fontWeight: 500 }}>{r.funcionarioNome}</td>
                    <td style={{ color: '#64748b' }}>{r.obraNome}</td>
                    <td>{r.horaEntrada}</td>
                    <td>{r.horaSaida}</td>
                    <td style={{ fontWeight: 600, color: '#1e3a5f' }}>{formatarMinutos(r.minutosTrabalhados)}</td>
                    <td style={{ fontWeight: 600, color: '#92400e' }}>+{formatarMinutos(r.minutosExtra)}</td>
                    <td>
                      {r.autorizada
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#166534', fontSize: 12, fontWeight: 600 }}>
                            <CheckCircle size={12} /> Sim{r.autorizadoPor ? ` · ${r.autorizadoPor}` : ''}
                          </span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 12 }}>
                            <AlertTriangle size={12} /> Não
                          </span>}
                    </td>
                    <td style={{ fontWeight: 600, color: r.autorizada ? '#059669' : '#94a3b8' }}>
                      {r.autorizada ? `R$ ${r.custoHE.toFixed(2)}` : <span title="Não autorizada — não contabilizada">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={pgDetalhe.page} totalPages={pgDetalhe.totalPages} pageSize={pgDetalhe.pageSize} total={pgDetalhe.total} start={pgDetalhe.start} end={pgDetalhe.end} onPage={pgDetalhe.setPage} onPageSize={pgDetalhe.setPageSize} />
        </div>
      )}
    </div>
  );
}
