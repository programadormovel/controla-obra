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
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const q = (text, params) => pool.query(text, params);

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const router = express.Router();

// ── Login ────────────────────────────────────────────────────────────────────
router.post('/login', wrap(async (req, res) => {
  const { login, senhaHash } = req.body;
  const r = await q(`
    SELECT u."Id", u."Login", u."FuncionarioId",
           p."Nome" AS "Perfil", f."Nome" AS "FuncionarioNome", f."Funcao"
    FROM "Usuario" u
    JOIN "Perfil" p ON p."Id" = u."PerfilId"
    LEFT JOIN "Funcionario" f ON f."Id" = u."FuncionarioId"
    WHERE u."Login" = $1 AND u."SenhaHash" = $2 AND u."Ativo" = TRUE
  `, [login, senhaHash]);
  if (!r.rows[0]) return res.status(401).json({ error: 'Credenciais invalidas' });
  res.json(r.rows[0]);
}));

// ── Funcionários ─────────────────────────────────────────────────────────────
router.get('/funcionarios', wrap(async (_req, res) => {
  const r = await q('SELECT * FROM "Funcionario" ORDER BY "Nome"');
  res.json(r.rows);
}));

router.post('/funcionarios', wrap(async (req, res) => {
  const f = req.body;
  await q(`
    INSERT INTO "Funcionario" ("Id","Nome","Funcao","Diaria","Transporte","Alimentacao","Telefone","Ativo","ObraId")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT ("Id") DO UPDATE SET
      "Nome"=$2,"Funcao"=$3,"Diaria"=$4,"Transporte"=$5,"Alimentacao"=$6,
      "Telefone"=$7,"Ativo"=$8,"ObraId"=$9
  `, [f.id, f.nome, f.funcao, f.diaria, f.transporte, f.alimentacao, f.telefone, f.ativo, f.obraId || null]);
  res.json({ ok: true });
}));

router.delete('/funcionarios/:id', wrap(async (req, res) => {
  const c = await q('SELECT COUNT(*) FROM "Presenca" WHERE "FuncionarioId"=$1', [req.params.id]);
  if (Number(c.rows[0].count) > 0)
    return res.status(409).json({ error: 'Funcionario possui presencas cadastradas.' });
  await q('DELETE FROM "Funcionario" WHERE "Id"=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ── Obras ────────────────────────────────────────────────────────────────────
router.get('/obras', wrap(async (_req, res) => {
  const r = await q('SELECT * FROM "Obra" ORDER BY "Nome"');
  res.json(r.rows);
}));

router.post('/obras', wrap(async (req, res) => {
  const o = req.body;
  await q(`
    INSERT INTO "Obra" ("Id","Nome","Endereco","Lat","Lng","Ativa")
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT ("Id") DO UPDATE SET "Nome"=$2,"Endereco"=$3,"Lat"=$4,"Lng"=$5,"Ativa"=$6
  `, [o.id, o.nome, o.endereco, o.lat, o.lng, o.ativa]);
  res.json({ ok: true });
}));

router.delete('/obras/:id', wrap(async (req, res) => {
  const c = await q('SELECT COUNT(*) FROM "Presenca" WHERE "ObraId"=$1', [req.params.id]);
  if (Number(c.rows[0].count) > 0)
    return res.status(409).json({ error: 'Obra possui presencas cadastradas.' });
  await q('DELETE FROM "Obra" WHERE "Id"=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ── Presenças ────────────────────────────────────────────────────────────────
router.get('/presencas', wrap(async (req, res) => {
  const { data, funcionarioId, de, ate } = req.query;
  let sql = 'SELECT * FROM "vw_PresencaCompleta" WHERE 1=1';
  const params = [];
  if (data)          { params.push(data);          sql += ` AND "Data"=$${params.length}`; }
  if (de)            { params.push(de);             sql += ` AND "Data">=$${params.length}`; }
  if (ate)           { params.push(ate);            sql += ` AND "Data"<=$${params.length}`; }
  if (funcionarioId) { params.push(funcionarioId);  sql += ` AND "FuncionarioId"=$${params.length}`; }
  sql += ' ORDER BY "Data" DESC, "HoraEntrada"';
  const r = await q(sql, params);
  res.json(r.rows);
}));

router.post('/presencas', wrap(async (req, res) => {
  const b = req.body;
  const existe = await q('SELECT "Id" FROM "Presenca" WHERE "Id"=$1', [b.id]);
  if (existe.rows.length > 0) {
    await q(`UPDATE "Presenca" SET "HoraSaida"=$2,"Status"=$3,"DistanciaObra"=$4 WHERE "Id"=$1`,
      [b.id, b.horaSaida || null, b.status, b.distanciaObra]);
  } else {
    await q(`
      INSERT INTO "Presenca" ("Id","FuncionarioId","ObraId","Data","HoraEntrada","Lat","Lng","DistanciaObra","Status")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [b.id, b.funcionarioId, b.obraId, b.data, b.horaEntrada, b.lat, b.lng, b.distanciaObra, b.status]);
  }
  res.json({ ok: true });
}));

router.delete('/presencas/:id', wrap(async (req, res) => {
  await q('DELETE FROM "Presenca" WHERE "Id"=$1', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/presencas/:id/foto', upload.single('foto'), wrap(async (req, res) => {
  const { id } = req.params;
  const tipo = req.body.tipo || 'entrada';
  if (!req.file) return res.status(400).json({ error: 'Foto ausente' });
  const dataUrl = `data:image/jpeg;base64,${req.file.buffer.toString('base64')}`;
  const col = tipo === 'entrada' ? '"FotoEntrada"' : '"FotoSaida"';
  await q(`UPDATE "Presenca" SET ${col}=$2 WHERE "Id"=$1`, [id, dataUrl]);
  res.json({ url: dataUrl });
}));

// ── Usuários ─────────────────────────────────────────────────────────────────
router.get('/usuarios', wrap(async (_req, res) => {
  const r = await q(`
    SELECT u."Id", u."Login", u."Email", u."Ativo", u."FuncionarioId",
           p."Nome" AS "Perfil", f."Nome" AS "FuncionarioNome"
    FROM "Usuario" u
    JOIN "Perfil" p ON p."Id" = u."PerfilId"
    LEFT JOIN "Funcionario" f ON f."Id" = u."FuncionarioId"
    ORDER BY u."Login"
  `);
  res.json(r.rows);
}));

router.post('/usuarios', wrap(async (req, res) => {
  const b = req.body;
  const perfilId = b.perfil === 'admin' ? 1 : 2;
  await q(`
    INSERT INTO "Usuario" ("Id","Login","Email","PerfilId","FuncionarioId","SenhaHash","Ativo")
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT ("Id") DO UPDATE SET
      "Login"=$2,"Email"=$3,"PerfilId"=$4,"FuncionarioId"=$5,"Ativo"=$7,
      "SenhaHash"=CASE WHEN $6 IS NOT NULL THEN $6 ELSE "Usuario"."SenhaHash" END
  `, [b.id, b.login, b.email || null, perfilId, b.funcionarioId || null, b.senhaHash || null, b.ativo]);
  res.json({ ok: true });
}));

router.delete('/usuarios/:id', wrap(async (req, res) => {
  await q('DELETE FROM "Usuario" WHERE "Id"=$1', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/usuarios/:id/reset-senha', wrap(async (req, res) => {
  const r = await q('SELECT "Login","Email" FROM "Usuario" WHERE "Id"=$1 AND "Ativo"=TRUE', [req.params.id]);
  const user = r.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (!user.Email) return res.status(400).json({ error: 'Usuário não possui e-mail cadastrado.' });
  const novaSenha = gerarSenhaAleatoria();
  await q('UPDATE "Usuario" SET "SenhaHash"=$2 WHERE "Id"=$1', [req.params.id, sha256(novaSenha)]);
  await mailer.sendMail({
    from: `"Controla Obra" <${process.env.SMTP_USER}>`, to: user.Email,
    subject: 'Sua nova senha - Controla Obra',
    html: `<p>Olá <strong>${user.Login}</strong>, sua nova senha: <strong>${novaSenha}</strong></p>`,
  });
  res.json({ ok: true });
}));

// ── Relatório ────────────────────────────────────────────────────────────────
router.get('/relatorio', wrap(async (req, res) => {
  const { dataInicio, dataFim, obraId } = req.query;
  const r = await q(`
    SELECT f."Nome" AS "Funcionario", f."Funcao",
           COUNT(*) AS "DiasPresente",
           SUM(CASE p."Status" WHEN 'meio-periodo' THEN 0.5 ELSE 1 END) AS "DiasEfetivos",
           SUM(CASE p."Status" WHEN 'meio-periodo' THEN f."Diaria"/2 ELSE f."Diaria" END) AS "TotalDiarias",
           SUM(f."Transporte") AS "TotalTransporte",
           SUM(f."Alimentacao") AS "TotalAlimentacao",
           SUM(CASE p."Status" WHEN 'meio-periodo' THEN (f."Diaria"/2)+f."Transporte"+f."Alimentacao"
                               ELSE f."Diaria"+f."Transporte"+f."Alimentacao" END) AS "CustoTotal"
    FROM "Presenca" p
    JOIN "Funcionario" f ON f."Id" = p."FuncionarioId"
    JOIN "Obra" o ON o."Id" = p."ObraId"
    WHERE p."Data" BETWEEN $1 AND $2
      AND p."Status" <> 'ausente'
      AND ($3::varchar IS NULL OR p."ObraId" = $3)
    GROUP BY f."Id", f."Nome", f."Funcao"
    ORDER BY "CustoTotal" DESC
  `, [dataInicio, dataFim, obraId || null]);
  res.json(r.rows);
}));

app.use('/api', router);
app.use('/',    router);

app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: err.message });
});

module.exports = serverless(app);
