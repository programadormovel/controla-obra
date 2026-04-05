import { useState, useEffect } from 'react';
import { db, distanciaMetros } from '../services/storage';
import type { Presenca as PresencaType } from '../types';
import { MapPin, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function Presenca() {
  const [funcionarios] = useState(() => db.getFuncionarios().filter(f => f.ativo));
  const [obras] = useState(() => db.getObras().filter(o => o.ativa));
  const [presencas, setPresencas] = useState(() => db.getPresencas());
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErro, setGeoErro] = useState(
    () => navigator.geolocation ? '' : 'Geolocalizacao nao suportada'
  );

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoErro('Nao foi possivel obter localizacao. Verifique as permissoes.')
    );
  }, []);
  const [form, setForm] = useState({ funcionarioId: '', obraId: '', status: 'presente' as PresencaType['status'] });
  const [msg, setMsg] = useState('');

  const hoje = new Date().toISOString().split('T')[0];
  const presencasHoje = presencas.filter(p => p.data === hoje);

  function registrar() {
    if (!form.funcionarioId || !form.obraId) { setMsg('Selecione funcionario e obra.'); return; }
    if (!geo) { setMsg('Aguardando localizacao GPS...'); return; }
    const jaRegistrado = presencasHoje.find(p => p.funcionarioId === form.funcionarioId);
    if (jaRegistrado) { setMsg('Funcionario ja registrado hoje.'); return; }
    const obra = obras.find(o => o.id === form.obraId)!;
    const dist = distanciaMetros(geo.lat, geo.lng, obra.lat, obra.lng);
    const nova: PresencaType = {
      id: `p${Date.now()}`,
      funcionarioId: form.funcionarioId,
      obraId: form.obraId,
      data: hoje,
      horaEntrada: new Date().toTimeString().slice(0, 5),
      lat: geo.lat,
      lng: geo.lng,
      distanciaObra: dist,
      status: form.status,
    };
    db.savePresenca(nova);
    setPresencas(db.getPresencas());
    setMsg(`Presenca registrada! Distancia da obra: ${dist}m`);
    setForm({ funcionarioId: '', obraId: '', status: 'presente' });
  }

  function registrarSaida(id: string) {
    const p = presencas.find(x => x.id === id)!;
    db.savePresenca({ ...p, horaSaida: new Date().toTimeString().slice(0, 5) });
    setPresencas(db.getPresencas());
  }

  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };
  const statusColor: Record<string, string> = { presente: '#059669', ausente: '#dc2626', 'meio-periodo': '#d97706' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px #0001' }}>
        <h3 style={{ margin: '0 0 20px', color: '#1e293b' }}>Registrar Presenca</h3>
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: geo ? '#f0fdf4' : '#fef9c3', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <MapPin size={16} color={geo ? '#059669' : '#d97706'} />
          {geo ? `GPS: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : geoErro || 'Obtendo localizacao...'}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Funcionario</label>
          <select style={inputStyle} value={form.funcionarioId} onChange={e => setForm(f => ({ ...f, funcionarioId: e.target.value }))}>
            <option value="">Selecione...</option>
            {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} - {f.funcao}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Obra</label>
          <select style={inputStyle} value={form.obraId} onChange={e => setForm(f => ({ ...f, obraId: e.target.value }))}>
            <option value="">Selecione...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Status</label>
          <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PresencaType['status'] }))}>
            <option value="presente">Presente</option>
            <option value="meio-periodo">Meio Periodo</option>
            <option value="ausente">Ausente</option>
          </select>
        </div>
        <button onClick={registrar} style={{ width: '100%', padding: '10px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <CheckCircle size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Registrar Presenca
        </button>
        {msg && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: msg.startsWith('Presenca') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('Presenca') ? '#059669' : '#dc2626', fontSize: 13 }}>
            {msg}
          </div>
        )}
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px #0001', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, color: '#1e293b' }}>Presencas de Hoje - {new Date().toLocaleDateString('pt-BR')}</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Funcionario', 'Obra', 'Entrada', 'Saida', 'Distancia', 'Status', 'Acao'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {presencasHoje.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhuma presenca hoje</td></tr>
            )}
            {presencasHoje.map(p => {
              const f = funcionarios.find(x => x.id === p.funcionarioId);
              const o = obras.find(x => x.id === p.obraId);
              const longe = p.distanciaObra > 200;
              const cor = statusColor[p.status];
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{f?.nome}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{o?.nome}</td>
                  <td style={{ padding: '10px 16px' }}>{p.horaEntrada}</td>
                  <td style={{ padding: '10px 16px' }}>{p.horaSaida || '-'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: longe ? '#dc2626' : '#059669' }}>
                      {longe && <AlertTriangle size={14} />}{p.distanciaObra}m
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: cor + '18', color: cor, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {p.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {!p.horaSaida && (
                      <button onClick={() => registrarSaida(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        <Clock size={12} /> Saida
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
