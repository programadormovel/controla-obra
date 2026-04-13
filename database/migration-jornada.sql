-- ============================================================
-- MIGRACAO: Controle de Jornada e Intervalos
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Mantem apenas um registro por funcionario/dia.
-- Se a constraint existir com nome antigo, remove para recriar.
ALTER TABLE presenca DROP CONSTRAINT IF EXISTS uq_presenca_dia;
ALTER TABLE presenca
  ADD CONSTRAINT uq_presenca_dia UNIQUE (funcionarioid, data);

-- Novas colunas para jornada e refeicoes.
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS tiporegistro VARCHAR(20) NOT NULL DEFAULT 'entrada'
  CHECK (tiporegistro IN ('entrada','saida-almoco','retorno-almoco','saida-jantar','retorno-jantar','saida'));
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS minutostrabalhados INT NULL;
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS horaextraautorizada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS turnonoturno BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS saidaalmoco TIME NULL;
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS retornoalmoco TIME NULL;
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS saidajantar TIME NULL;
ALTER TABLE presenca ADD COLUMN IF NOT EXISTS retornojantar TIME NULL;

CREATE INDEX IF NOT EXISTS ix_presenca_funcdata ON presenca (funcionarioid, data);

CREATE OR REPLACE VIEW vw_presencacompleta AS
SELECT
  p.id, p.data, p.horaentrada, p.horasaida, p.status,
  p.tiporegistro, p.minutostrabalhados, p.horaextraautorizada, p.turnonoturno,
  p.saidaalmoco, p.retornoalmoco, p.saidajantar, p.retornojantar,
  p.distanciaobra, p.lat, p.lng, p.fotoentrada, p.fotosaida,
  f.id AS funcionarioid, f.nome AS funcionarionome, f.funcao,
  f.diaria, f.transporte, f.alimentacao,
  CASE p.status WHEN 'meio-periodo' THEN f.diaria / 2 ELSE f.diaria END AS diariapaga,
  CASE p.status WHEN 'meio-periodo' THEN (f.diaria / 2) + f.transporte + f.alimentacao
                ELSE f.diaria + f.transporte + f.alimentacao END AS custototal,
  o.id AS obraid, o.nome AS obranome, o.endereco AS obraendereco
FROM presenca p
JOIN funcionario f ON f.id = p.funcionarioid
JOIN obra o ON o.id = p.obraid;

