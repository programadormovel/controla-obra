import type { Presenca } from '../types';

export const JORNADA_META_MINUTOS = 8 * 60;
export const INTERVALO_REFEICAO_MINIMO = 60;

const MINUTOS_DIA = 24 * 60;

export function horaParaMinutos(hora?: string): number | null {
  if (!hora) return null;
  const match = hora.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function diferencaMinutos(inicio?: string, fim?: string): number {
  const ini = horaParaMinutos(inicio);
  const end = horaParaMinutos(fim);
  if (ini == null || end == null) return 0;
  return end >= ini ? end - ini : end + MINUTOS_DIA - ini;
}

function intervaloMinutos(inicio?: string, fim?: string, agora?: string): number {
  if (!inicio) return 0;
  if (!fim && !agora) return 0;
  return diferencaMinutos(inicio, fim ?? agora);
}

export function minutosIntervaloAlmoco(p: Presenca, agora?: string): number {
  return intervaloMinutos(p.saidaAlmoco, p.retornoAlmoco, agora);
}

export function minutosIntervaloJantar(p: Presenca, agora?: string): number {
  return intervaloMinutos(p.saidaJantar, p.retornoJantar, agora);
}

export function minutosIntervaloRefeicao(p: Presenca, agora?: string): number {
  return minutosIntervaloAlmoco(p, agora) + minutosIntervaloJantar(p, agora);
}

export function intervaloObrigatorioCumprido(p: Presenca): boolean {
  const almocoOk = minutosIntervaloAlmoco(p) >= INTERVALO_REFEICAO_MINIMO;
  const jantarOk = minutosIntervaloJantar(p) >= INTERVALO_REFEICAO_MINIMO;
  return p.turnoNoturno ? almocoOk || jantarOk : almocoOk;
}

export function intervaloEmAberto(p: Presenca): boolean {
  const almocoAberto = Boolean(p.saidaAlmoco && !p.retornoAlmoco);
  const jantarAberto = Boolean(p.saidaJantar && !p.retornoJantar);
  return almocoAberto || jantarAberto;
}

export function minutosTrabalhados(p: Presenca, agora?: string): number {
  const fechamento = p.horaSaida ?? agora;
  if (!p.horaEntrada || !fechamento) return 0;
  const bruto = diferencaMinutos(p.horaEntrada, fechamento);
  const liquido = bruto - minutosIntervaloRefeicao(p, agora);
  return Math.max(liquido, 0);
}

export function minutosRestantesJornada(p: Presenca, agora?: string): number {
  return JORNADA_META_MINUTOS - minutosTrabalhados(p, agora);
}

export function formatarMinutos(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

