const { Pool } = require('pg');
const { createHash } = require('crypto');

function sha256(t) { return createHash('sha256').update(t).digest('hex'); }
function gerarSenhaAleatoria() { return Math.random().toString(36).slice(2, 10); }

let _pool = null;
function getPool() {
  if (!_pool) _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  return _pool;
}
const q = (text, params) => getPool().query(text, params);

let _jornadaSchemaReady = false;
async function ensureJornadaSchema() {
  if (_jornadaSchemaReady) return;
  const steps = [
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS tiporegistro VARCHAR(20) NOT NULL DEFAULT 'entrada'`,
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS minutostrabalhados INT NULL`,
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS horaextraautorizada BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS turnonoturno BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS saidaalmoco TIME NULL`,
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS retornoalmoco TIME NULL`,
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS saidajantar TIME NULL`,
    `ALTER TABLE presenca ADD COLUMN IF NOT EXISTS retornojantar TIME NULL`,
  ];
  for (const sql of steps) await q(sql);
  _jornadaSchemaReady = true;
}

function isJornadaSchemaError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('column') && (
    msg.includes('horaextraautorizada') ||
    msg.includes('tiporegistro') ||
    msg.includes('turnonoturno') ||
    msg.includes('saidaalmoco') ||
    msg.includes('retornoalmoco') ||
    msg.includes('saidajantar') ||
    msg.includes('retornojantar') ||
    msg.includes('minutostrabalhados')
  );
}

async function withJornadaSchemaRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (!isJornadaSchemaError(err)) throw err;
    try {
      await ensureJornadaSchema();
    } catch (schemaErr) {
      throw new Error(`Schema de jornada ausente e nao foi possivel aplicar automaticamente: ${schemaErr.message}`);
    }
    return await fn();
  }
}

const mapFuncionario = r => ({ Id: r.id, Nome: r.nome, Funcao: r.funcao, Diaria: r.diaria, Transporte: r.transporte, Alimentacao: r.alimentacao, Telefone: r.telefone, Ativo: r.ativo, ObraId: r.obraid });
const mapObra       = r => ({ Id: r.id, Nome: r.nome, Endereco: r.endereco, Lat: r.lat, Lng: r.lng, Ativa: r.ativa, TurnoNoturno: r.turnonoturno ?? false });
const mapUsuario    = r => ({ Id: r.id, Login: r.login, Email: r.email, Ativo: r.ativo, FuncionarioId: r.funcionarioid, Perfil: r.perfil, FuncionarioNome: r.funcionarionome });
const mapPresenca   = r => ({
  Id: r.id, Data: r.data, HoraEntrada: r.horaentrada, HoraSaida: r.horasaida, Status: r.status,
  TipoRegistro: r.tiporegistro, MinutosTrabalhados: r.minutostrabalhados, HoraExtraAutorizada: r.horaextraautorizada, TurnoNoturno: r.turnonoturno,
  SaidaAlmoco: r.saidaalmoco, RetornoAlmoco: r.retornoalmoco, SaidaJantar: r.saidajantar, RetornoJantar: r.retornojantar,
  DistanciaObra: r.distanciaobra, Lat: r.lat, Lng: r.lng, FotoEntrada: r.fotoentrada, FotoSaida: r.fotosaida,
  FuncionarioId: r.funcionarioid, FuncionarioNome: r.funcionarionome, Funcao: r.funcao, Diaria: r.diaria, Transporte: r.transporte,
  Alimentacao: r.alimentacao, DiariaPaga: r.diariapaga, CustoTotal: r.custototal, ObraId: r.obraid, ObraNome: r.obranome, ObraEndereco: r.obraendereco
});

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => (d += c));
    req.on('end', () => resolve(d ? JSON.parse(d) : {}));
  });
}

module.exports = async (req, res) => {
  const url = (req.url || '').replace(/^\/api/, '').split('?')[0] || '/';
  const method = req.method;

  try {
    if (method === 'GET' && url === '/ping') {
      return send(res, 200, { ok: true });
    }

    if (method === 'POST' && url === '/login') {
      const { login, senhaHash } = await readBody(req);
      const r = await q(`
        SELECT u.id, u.login, u.funcionarioid,
               p.nome AS perfil, f.nome AS funcionarionome, f.funcao
        FROM usuario u
        JOIN perfil p ON p.id = u.perfilid
        LEFT JOIN funcionario f ON f.id = u.funcionarioid
        WHERE u.login=$1 AND u.senhahash=$2 AND u.ativo=TRUE
      `, [login, senhaHash]);
      if (!r.rows[0]) return send(res, 401, { error: 'Credenciais invalidas' });
      const row = r.rows[0];
      return send(res, 200, { Id: row.id, Login: row.login, FuncionarioId: row.funcionarioid, Perfil: row.perfil, FuncionarioNome: row.funcionarionome, Funcao: row.funcao });
    }

    if (method === 'GET' && url === '/cargos') {
      const r = await q('SELECT * FROM cargo ORDER BY nome');
      return send(res, 200, r.rows.map(r => ({ id: r.id, nome: r.nome, diaria: Number(r.diaria), transporte: Number(r.transporte), alimentacao: Number(r.alimentacao) })));
    }

    if (method === 'POST' && url === '/cargos') {
      const c = await readBody(req);
      await q(`INSERT INTO cargo (id,nome,diaria,transporte,alimentacao) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET nome=$2,diaria=$3,transporte=$4,alimentacao=$5`,
        [c.id, c.nome, c.diaria, c.transporte, c.alimentacao]);
      return send(res, 200, { ok: true });
    }

    if (method === 'DELETE' && url.startsWith('/cargos/')) {
      await q('DELETE FROM cargo WHERE id=$1', [url.split('/')[2]]);
      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && url === '/funcionarios') {
      const r = await q('SELECT * FROM funcionario ORDER BY nome');
      return send(res, 200, r.rows.map(mapFuncionario));
    }

    if (method === 'POST' && url === '/funcionarios') {
      const f = await readBody(req);
      await q(`INSERT INTO funcionario (id,nome,funcao,diaria,transporte,alimentacao,telefone,ativo,obraid)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET nome=$2,funcao=$3,diaria=$4,transporte=$5,alimentacao=$6,telefone=$7,ativo=$8,obraid=$9`,
        [f.id, f.nome, f.funcao, f.diaria, f.transporte, f.alimentacao, f.telefone, f.ativo, f.obraId || null]);
      if (f.usuario) {
        const { id: uid, login, senhaHash, email } = f.usuario;
        const existe = await q('SELECT id FROM usuario WHERE id=$1', [uid]);
        if (existe.rows.length > 0) {
          const sql = senhaHash
            ? 'UPDATE usuario SET login=$2,email=$3,funcionarioid=$4,senhahash=$5 WHERE id=$1'
            : 'UPDATE usuario SET login=$2,email=$3,funcionarioid=$4 WHERE id=$1';
          await q(sql, senhaHash ? [uid, login, email || null, f.id, senhaHash] : [uid, login, email || null, f.id]);
        } else if (senhaHash) {
          await q(`INSERT INTO usuario (id,login,email,perfilid,funcionarioid,senhahash,ativo) VALUES ($1,$2,$3,2,$4,$5,TRUE)`,
            [uid, login, email || null, f.id, senhaHash]);
        }
      }
      return send(res, 200, { ok: true });
    }

    if (method === 'DELETE' && url.startsWith('/funcionarios/')) {
      const id = url.split('/')[2];
      const c = await q('SELECT COUNT(*) FROM presenca WHERE funcionarioid=$1', [id]);
      if (Number(c.rows[0].count) > 0) return send(res, 409, { error: 'Funcionario possui presencas cadastradas.' });
      await q('UPDATE usuario SET funcionarioid=NULL WHERE funcionarioid=$1', [id]);
      await q('DELETE FROM funcionario WHERE id=$1', [id]);
      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && url === '/obras') {
      const r = await q('SELECT * FROM obra ORDER BY nome');
      return send(res, 200, r.rows.map(mapObra));
    }

    if (method === 'POST' && url === '/obras') {
      const o = await readBody(req);
      await q(`INSERT INTO obra (id,nome,endereco,lat,lng,ativa,turnonoturno) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET nome=$2,endereco=$3,lat=$4,lng=$5,ativa=$6,turnonoturno=$7`,
        [o.id, o.nome, o.endereco, o.lat, o.lng, o.ativa, o.turnoNoturno ?? false]);
      return send(res, 200, { ok: true });
    }

    if (method === 'DELETE' && url.startsWith('/obras/')) {
      const id = url.split('/')[2];
      const c = await q('SELECT COUNT(*) FROM presenca WHERE obraid=$1', [id]);
      if (Number(c.rows[0].count) > 0) return send(res, 409, { error: 'Obra possui presencas cadastradas.' });
      await q('DELETE FROM obra WHERE id=$1', [id]);
      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && url.startsWith('/presencas') && !url.includes('/foto')) {
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const data = qs.get('data'), funcionarioId = qs.get('funcionarioId'), de = qs.get('de'), ate = qs.get('ate');
      let sql = 'SELECT * FROM vw_presencacompleta WHERE 1=1';
      const params = [];
      if (data)          { params.push(data);         sql += ` AND data=$${params.length}`; }
      if (de)            { params.push(de);            sql += ` AND data>=$${params.length}`; }
      if (ate)           { params.push(ate);           sql += ` AND data<=$${params.length}`; }
      if (funcionarioId) { params.push(funcionarioId); sql += ` AND funcionarioid=$${params.length}`; }
      sql += ' ORDER BY data DESC, horaentrada';
      const r = await q(sql, params);
      return send(res, 200, r.rows.map(mapPresenca));
    }

    if (method === 'POST' && url === '/presencas') {
      const b = await readBody(req);
      await withJornadaSchemaRetry(async () => {
        const existe = await q('SELECT id FROM presenca WHERE id=$1', [b.id]);
        if (existe.rows.length > 0) {
          await q(`
            UPDATE presenca
               SET horasaida=$2,status=$3,distanciaobra=$4,minutostrabalhados=$5,horaextraautorizada=$6,
                   tiporegistro=$7,turnonoturno=$8,saidaalmoco=$9,retornoalmoco=$10,saidajantar=$11,retornojantar=$12
             WHERE id=$1
          `, [
            b.id,
            b.horaSaida || null,
            b.status,
            b.distanciaObra,
            b.minutosTrabalhados || null,
            b.horaExtraAutorizada || false,
            b.tipoRegistro || 'entrada',
            b.turnoNoturno || false,
            b.saidaAlmoco || null,
            b.retornoAlmoco || null,
            b.saidaJantar || null,
            b.retornoJantar || null,
          ]);
        } else {
          await q(`
            INSERT INTO presenca (
              id,funcionarioid,obraid,data,horaentrada,horasaida,lat,lng,distanciaobra,status,tiporegistro,turnonoturno,
              saidaalmoco,retornoalmoco,saidajantar,retornojantar,minutostrabalhados,horaextraautorizada
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          `, [
            b.id,
            b.funcionarioId,
            b.obraId,
            b.data,
            b.horaEntrada,
            b.horaSaida || null,
            b.lat,
            b.lng,
            b.distanciaObra,
            b.status,
            b.tipoRegistro || 'entrada',
            b.turnoNoturno || false,
            b.saidaAlmoco || null,
            b.retornoAlmoco || null,
            b.saidaJantar || null,
            b.retornoJantar || null,
            b.minutosTrabalhados || null,
            b.horaExtraAutorizada || false,
          ]);
        }
      });
      return send(res, 200, { ok: true });
    }

    // PATCH /presencas/:id/autorizar-hora-extra
    if (method === 'POST' && url.match(/^\/presencas\/[^/]+\/autorizar-hora-extra$/)) {
      const id = url.split('/')[2];
      const body = await readBody(req);
      const autorizadoPor = body?.autorizadoPor || null;
      await withJornadaSchemaRetry(() => q('UPDATE presenca SET horaextraautorizada=TRUE, autorizadopor=$2 WHERE id=$1', [id, autorizadoPor]));
      return send(res, 200, { ok: true });
    }

    if (method === 'DELETE' && url.match(/^\/presencas\/[^/]+$/)) {
      await q('DELETE FROM presenca WHERE id=$1', [url.split('/')[2]]);
      return send(res, 200, { ok: true });
    }

    if (method === 'POST' && url.match(/^\/presencas\/[^/]+\/foto$/)) {
      const presencaId = url.split('/')[2];
      const chunks = [];
      await new Promise(resolve => { req.on('data', c => chunks.push(c)); req.on('end', resolve); });
      const buf = Buffer.concat(chunks);
      const boundary = (req.headers['content-type'] || '').split('boundary=')[1];
      if (!boundary) return send(res, 400, { error: 'Boundary ausente' });
      const sep = Buffer.from('--' + boundary);
      let tipo = 'entrada', fotoBuffer = null;
      let start = buf.indexOf(sep) + sep.length + 2;
      while (start < buf.length) {
        const end = buf.indexOf(sep, start);
        if (end === -1) break;
        const part = buf.slice(start, end - 2);
        const headerEnd = part.indexOf('\r\n\r\n');
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        if (headers.includes('name="tipo"')) tipo = body.toString().trim();
        if (headers.includes('name="foto"')) fotoBuffer = body;
        start = end + sep.length + 2;
      }
      if (!fotoBuffer) return send(res, 400, { error: 'Foto ausente' });
      const dataUrl = `data:image/jpeg;base64,${fotoBuffer.toString('base64')}`;
      await q(`UPDATE presenca SET ${tipo === 'entrada' ? 'fotoentrada' : 'fotosaida'}=$2 WHERE id=$1`, [presencaId, dataUrl]);
      return send(res, 200, { url: dataUrl });
    }

    if (method === 'GET' && url === '/usuarios') {
      const r = await q(`
        SELECT u.id, u.login, u.email, u.ativo, u.funcionarioid,
               p.nome AS perfil, f.nome AS funcionarionome
        FROM usuario u
        JOIN perfil p ON p.id = u.perfilid
        LEFT JOIN funcionario f ON f.id = u.funcionarioid
        ORDER BY u.login
      `);
      return send(res, 200, r.rows.map(mapUsuario));
    }

    if (method === 'POST' && url === '/usuarios') {
      const b = await readBody(req);
      const perfilId = b.perfil === 'admin' ? 1 : 2;
      await q(`INSERT INTO usuario (id,login,email,perfilid,funcionarioid,senhahash,ativo) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET login=$2,email=$3,perfilid=$4,funcionarioid=$5,ativo=$7,
        senhahash=CASE WHEN $6 IS NOT NULL THEN $6 ELSE usuario.senhahash END`,
        [b.id, b.login, b.email || null, perfilId, b.funcionarioId || null, b.senhaHash || null, b.ativo]);
      return send(res, 200, { ok: true });
    }

    if (method === 'DELETE' && url.match(/^\/usuarios\/[^/]+$/) && !url.includes('/reset-senha')) {
      await q('DELETE FROM usuario WHERE id=$1', [url.split('/')[2]]);
      return send(res, 200, { ok: true });
    }

    if (method === 'POST' && url.match(/^\/usuarios\/[^/]+\/reset-senha$/)) {
      const id = url.split('/')[2];
      const r = await q('SELECT login,email FROM usuario WHERE id=$1 AND ativo=TRUE', [id]);
      const user = r.rows[0];
      if (!user) return send(res, 404, { error: 'Usuário não encontrado.' });
      if (!user.email) return send(res, 400, { error: 'Usuário não possui e-mail cadastrado.' });
      const novaSenha = gerarSenhaAleatoria();
      await q('UPDATE usuario SET senhahash=$2 WHERE id=$1', [id, sha256(novaSenha)]);
      const nodemailer = require('nodemailer');
      const mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await mailer.sendMail({ from: `"Controla Obra" <${process.env.SMTP_USER}>`, to: user.email, subject: 'Sua nova senha - Controla Obra', html: `<p>Olá <strong>${user.login}</strong>, sua nova senha: <strong>${novaSenha}</strong></p>` });
      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && url === '/relatorio') {
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const r = await q(`
        SELECT f.nome AS funcionario, f.funcao,
               COUNT(*) AS diaspresente,
               SUM(CASE p.status WHEN 'meio-periodo' THEN 0.5 ELSE 1 END) AS diasefetivos,
               SUM(CASE p.status WHEN 'meio-periodo' THEN f.diaria/2 ELSE f.diaria END) AS totaldiarias,
               SUM(f.transporte) AS totaltransporte, SUM(f.alimentacao) AS totalalimentacao,
               SUM(CASE p.status WHEN 'meio-periodo' THEN (f.diaria/2)+f.transporte+f.alimentacao
                                 ELSE f.diaria+f.transporte+f.alimentacao END) AS custototal
        FROM presenca p
        JOIN funcionario f ON f.id = p.funcionarioid
        JOIN obra o ON o.id = p.obraid
        WHERE p.data BETWEEN $1 AND $2 AND p.status <> 'ausente'
          AND ($3::varchar IS NULL OR p.obraid = $3)
        GROUP BY f.id, f.nome, f.funcao ORDER BY custototal DESC
      `, [qs.get('dataInicio'), qs.get('dataFim'), qs.get('obraId') || null]);
      return send(res, 200, r.rows.map(r => ({ Funcionario: r.funcionario, Funcao: r.funcao, DiasPresente: r.diaspresente, DiasEfetivos: r.diasefetivos, TotalDiarias: r.totaldiarias, TotalTransporte: r.totaltransporte, TotalAlimentacao: r.totalalimentacao, CustoTotal: r.custototal })));
    }

    return send(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('[API Error]', err.message);
    return send(res, 500, { error: err.message });
  }
};
