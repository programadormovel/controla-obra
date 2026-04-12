const { Pool }   = require('pg');
const express    = require('express');
const multer     = require('multer');
const nodemailer = require('nodemailer');
const { createHash } = require('crypto');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function sha256(t) { return createHash('sha256').update(t).digest('hex'); }
function gerarSenhaAleatoria() { return Math.random().toString(36).slice(2, 10); }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
});

const q = (text, params) => pool.query(text, params);
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const router = express.Router();

const mapFuncionario = r => ({ Id: r.id, Nome: r.nome, Funcao: r.funcao, Diaria: r.diaria, Transporte: r.transporte, Alimentacao: r.alimentacao, Telefone: r.telefone, Ativo: r.ativo, ObraId: r.obraid });
const mapObra       = r => ({ Id: r.id, Nome: r.nome, Endereco: r.endereco, Lat: r.lat, Lng: r.lng, Ativa: r.ativa });
const mapUsuario    = r => ({ Id: r.id, Login: r.login, Email: r.email, Ativo: r.ativo, FuncionarioId: r.funcionarioid, Perfil: r.perfil, FuncionarioNome: r.funcionarionome });
const mapPresenca   = r => ({ Id: r.id, Data: r.data, HoraEntrada: r.horaentrada, HoraSaida: r.horasaida, Status: r.status, DistanciaObra: r.distanciaobra, Lat: r.lat, Lng: r.lng, FotoEntrada: r.fotoentrada, FotoSaida: r.fotosaida, FuncionarioId: r.funcionarioid, FuncionarioNome: r.funcionarionome, Funcao: r.funcao, Diaria: r.diaria, Transporte: r.transporte, Alimentacao: r.alimentacao, DiariaPaga: r.diariapaga, CustoTotal: r.custototal, ObraId: r.obraid, ObraNome: r.obranome, ObraEndereco: r.obraendereco });

// ── Login ────────────────────────────────────────────────────────────────────
router.get('/ping', (_req, res) => {
  res.json({ ok: true, hasDb: !!process.env.DATABASE_URL, dbPrefix: (process.env.DATABASE_URL || '').slice(0, 30) });
});

router.post('/login', wrap(async (req, res) => {
  const { login, senhaHash } = req.body;
  const r = await q(`
    SELECT u.id, u.login, u.funcionarioid,
           p.nome AS perfil, f.nome AS funcionarionome, f.funcao
    FROM usuario u
    JOIN perfil p ON p.id = u.perfilid
    LEFT JOIN funcionario f ON f.id = u.funcionarioid
    WHERE u.login=$1 AND u.senhahash=$2 AND u.ativo=TRUE
  `, [login, senhaHash]);
  if (!r.rows[0]) return res.status(401).json({ error: 'Credenciais invalidas' });
  const row = r.rows[0];
  res.json({ Id: row.id, Login: row.login, FuncionarioId: row.funcionarioid, Perfil: row.perfil, FuncionarioNome: row.funcionarionome, Funcao: row.funcao });
}));

// ── Cargos ───────────────────────────────────────────────────────────────────
router.get('/cargos', wrap(async (_req, res) => {
  const r = await q('SELECT * FROM cargo ORDER BY nome');
  res.json(r.rows.map(r => ({ id: r.id, nome: r.nome, diaria: Number(r.diaria), transporte: Number(r.transporte), alimentacao: Number(r.alimentacao) })));
}));

router.post('/cargos', wrap(async (req, res) => {
  const c = req.body;
  await q(`INSERT INTO cargo (id,nome,diaria,transporte,alimentacao) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (id) DO UPDATE SET nome=$2,diaria=$3,transporte=$4,alimentacao=$5`,
    [c.id, c.nome, c.diaria, c.transporte, c.alimentacao]);
  res.json({ ok: true });
}));

router.delete('/cargos/:id', wrap(async (req, res) => {
  await q('DELETE FROM cargo WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ── Funcionários ─────────────────────────────────────────────────────────────
router.get('/funcionarios', wrap(async (_req, res) => {
  const r = await q('SELECT * FROM funcionario ORDER BY nome');
  res.json(r.rows.map(mapFuncionario));
}));

router.post('/funcionarios', wrap(async (req, res) => {
  const f = req.body;
  await q(`
    INSERT INTO funcionario (id,nome,funcao,diaria,transporte,alimentacao,telefone,ativo,obraid)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      nome=$2,funcao=$3,diaria=$4,transporte=$5,alimentacao=$6,telefone=$7,ativo=$8,obraid=$9
  `, [f.id, f.nome, f.funcao, f.diaria, f.transporte, f.alimentacao, f.telefone, f.ativo, f.obraId || null]);
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
  res.json({ ok: true });
}));

router.delete('/funcionarios/:id', wrap(async (req, res) => {
  const c = await q('SELECT COUNT(*) FROM presenca WHERE funcionarioid=$1', [req.params.id]);
  if (Number(c.rows[0].count) > 0)
    return res.status(409).json({ error: 'Funcionario possui presencas cadastradas.' });
  await q('UPDATE usuario SET funcionarioid=NULL WHERE funcionarioid=$1', [req.params.id]);
  await q('DELETE FROM funcionario WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ── Obras ────────────────────────────────────────────────────────────────────
router.get('/obras', wrap(async (_req, res) => {
  const r = await q('SELECT * FROM obra ORDER BY nome');
  res.json(r.rows.map(mapObra));
}));

router.post('/obras', wrap(async (req, res) => {
  const o = req.body;
  await q(`INSERT INTO obra (id,nome,endereco,lat,lng,ativa) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (id) DO UPDATE SET nome=$2,endereco=$3,lat=$4,lng=$5,ativa=$6`,
    [o.id, o.nome, o.endereco, o.lat, o.lng, o.ativa]);
  res.json({ ok: true });
}));

router.delete('/obras/:id', wrap(async (req, res) => {
  const c = await q('SELECT COUNT(*) FROM presenca WHERE obraid=$1', [req.params.id]);
  if (Number(c.rows[0].count) > 0)
    return res.status(409).json({ error: 'Obra possui presencas cadastradas.' });
  await q('DELETE FROM obra WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ── Presenças ────────────────────────────────────────────────────────────────
router.get('/presencas', wrap(async (req, res) => {
  const { data, funcionarioId, de, ate } = req.query;
  let sql = 'SELECT * FROM vw_presencacompleta WHERE 1=1';
  const params = [];
  if (data)          { params.push(data);         sql += ` AND data=$${params.length}`; }
  if (de)            { params.push(de);            sql += ` AND data>=$${params.length}`; }
  if (ate)           { params.push(ate);           sql += ` AND data<=$${params.length}`; }
  if (funcionarioId) { params.push(funcionarioId); sql += ` AND funcionarioid=$${params.length}`; }
  sql += ' ORDER BY data DESC, horaentrada';
  const r = await q(sql, params);
  res.json(r.rows.map(mapPresenca));
}));

router.post('/presencas', wrap(async (req, res) => {
  const b = req.body;
  const existe = await q('SELECT id FROM presenca WHERE id=$1', [b.id]);
  if (existe.rows.length > 0) {
    await q('UPDATE presenca SET horasaida=$2,status=$3,distanciaobra=$4 WHERE id=$1',
      [b.id, b.horaSaida || null, b.status, b.distanciaObra]);
  } else {
    await q(`INSERT INTO presenca (id,funcionarioid,obraid,data,horaentrada,lat,lng,distanciaobra,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [b.id, b.funcionarioId, b.obraId, b.data, b.horaEntrada, b.lat, b.lng, b.distanciaObra, b.status]);
  }
  res.json({ ok: true });
}));

router.delete('/presencas/:id', wrap(async (req, res) => {
  await q('DELETE FROM presenca WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/presencas/:id/foto', upload.single('foto'), wrap(async (req, res) => {
  const tipo = req.body.tipo || 'entrada';
  if (!req.file) return res.status(400).json({ error: 'Foto ausente' });
  const dataUrl = `data:image/jpeg;base64,${req.file.buffer.toString('base64')}`;
  const col = tipo === 'entrada' ? 'fotoentrada' : 'fotosaida';
  await q(`UPDATE presenca SET ${col}=$2 WHERE id=$1`, [req.params.id, dataUrl]);
  res.json({ url: dataUrl });
}));

// ── Usuários ─────────────────────────────────────────────────────────────────
router.get('/usuarios', wrap(async (_req, res) => {
  const r = await q(`
    SELECT u.id, u.login, u.email, u.ativo, u.funcionarioid,
           p.nome AS perfil, f.nome AS funcionarionome
    FROM usuario u
    JOIN perfil p ON p.id = u.perfilid
    LEFT JOIN funcionario f ON f.id = u.funcionarioid
    ORDER BY u.login
  `);
  res.json(r.rows.map(mapUsuario));
}));

router.post('/usuarios', wrap(async (req, res) => {
  const b = req.body;
  const perfilId = b.perfil === 'admin' ? 1 : 2;
  await q(`
    INSERT INTO usuario (id,login,email,perfilid,funcionarioid,senhahash,ativo)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET
      login=$2,email=$3,perfilid=$4,funcionarioid=$5,ativo=$7,
      senhahash=CASE WHEN $6 IS NOT NULL THEN $6 ELSE usuario.senhahash END
  `, [b.id, b.login, b.email || null, perfilId, b.funcionarioId || null, b.senhaHash || null, b.ativo]);
  res.json({ ok: true });
}));

router.delete('/usuarios/:id', wrap(async (req, res) => {
  await q('DELETE FROM usuario WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/usuarios/:id/reset-senha', wrap(async (req, res) => {
  const r = await q('SELECT login,email FROM usuario WHERE id=$1 AND ativo=TRUE', [req.params.id]);
  const user = r.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (!user.email) return res.status(400).json({ error: 'Usuário não possui e-mail cadastrado.' });
  const novaSenha = gerarSenhaAleatoria();
  await q('UPDATE usuario SET senhahash=$2 WHERE id=$1', [req.params.id, sha256(novaSenha)]);
  await mailer.sendMail({
    from: `"Controla Obra" <${process.env.SMTP_USER}>`, to: user.email,
    subject: 'Sua nova senha - Controla Obra',
    html: `<p>Olá <strong>${user.login}</strong>, sua nova senha: <strong>${novaSenha}</strong></p>`,
  });
  res.json({ ok: true });
}));

// ── Relatório ────────────────────────────────────────────────────────────────
router.get('/relatorio', wrap(async (req, res) => {
  const { dataInicio, dataFim, obraId } = req.query;
  const r = await q(`
    SELECT f.nome AS funcionario, f.funcao,
           COUNT(*) AS diaspresente,
           SUM(CASE p.status WHEN 'meio-periodo' THEN 0.5 ELSE 1 END) AS diasefetivos,
           SUM(CASE p.status WHEN 'meio-periodo' THEN f.diaria/2 ELSE f.diaria END) AS totaldiarias,
           SUM(f.transporte) AS totaltransporte,
           SUM(f.alimentacao) AS totalalimentacao,
           SUM(CASE p.status WHEN 'meio-periodo' THEN (f.diaria/2)+f.transporte+f.alimentacao
                             ELSE f.diaria+f.transporte+f.alimentacao END) AS custototal
    FROM presenca p
    JOIN funcionario f ON f.id = p.funcionarioid
    JOIN obra o ON o.id = p.obraid
    WHERE p.data BETWEEN $1 AND $2
      AND p.status <> 'ausente'
      AND ($3::varchar IS NULL OR p.obraid = $3)
    GROUP BY f.id, f.nome, f.funcao
    ORDER BY custototal DESC
  `, [dataInicio, dataFim, obraId || null]);
  res.json(r.rows.map(r => ({
    Funcionario: r.funcionario, Funcao: r.funcao,
    DiasPresente: r.diaspresente, DiasEfetivos: r.diasefetivos,
    TotalDiarias: r.totaldiarias, TotalTransporte: r.totaltransporte,
    TotalAlimentacao: r.totalalimentacao, CustoTotal: r.custototal,
  })));
}));

app.use('/api', router);
app.use('/', router);

app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: err.message });
});

module.exports = serverless(app);
