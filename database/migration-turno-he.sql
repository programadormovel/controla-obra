-- ============================================================
-- MIGRACAO: Turno Noturno em Obra + AutorizadoPor em Presenca
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE obra ADD COLUMN IF NOT EXISTS TurnoNoturno BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE presenca ADD COLUMN IF NOT EXISTS AutorizadoPor VARCHAR(50) NULL;
