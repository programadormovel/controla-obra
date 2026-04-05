import type { Funcionario, Obra, Presenca } from '../types';

export const mockFuncionarios: Funcionario[] = [
  { id: 'f1', nome: 'Carlos Silva', funcao: 'Pedreiro', diaria: 180, transporte: 20, alimentacao: 25, telefone: '11999990001', ativo: true },
  { id: 'f2', nome: 'João Souza', funcao: 'Servente', diaria: 130, transporte: 20, alimentacao: 25, telefone: '11999990002', ativo: true },
  { id: 'f3', nome: 'Pedro Lima', funcao: 'Eletricista', diaria: 220, transporte: 25, alimentacao: 25, telefone: '11999990003', ativo: true },
  { id: 'f4', nome: 'Marcos Rocha', funcao: 'Encanador', diaria: 200, transporte: 25, alimentacao: 25, telefone: '11999990004', ativo: true },
  { id: 'f5', nome: 'André Costa', funcao: 'Pintor', diaria: 160, transporte: 20, alimentacao: 25, telefone: '11999990005', ativo: true },
];

export const mockObras: Obra[] = [
  { id: 'o1', nome: 'Residência Jardins', endereco: 'Rua das Flores, 123 - Jardins', lat: -23.5614, lng: -46.6558, ativa: true },
  { id: 'o2', nome: 'Comercial Centro', endereco: 'Av. Paulista, 456 - Centro', lat: -23.5629, lng: -46.6544, ativa: true },
  { id: 'o3', nome: 'Reforma Moema', endereco: 'Rua Iraí, 789 - Moema', lat: -23.6012, lng: -46.6658, ativa: true },
];

const hoje = new Date().toISOString().split('T')[0];
const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

export const mockPresencas: Presenca[] = [
  { id: 'p1', funcionarioId: 'f1', obraId: 'o1', data: hoje, horaEntrada: '07:30', lat: -23.5614, lng: -46.6558, distanciaObra: 45, status: 'presente' },
  { id: 'p2', funcionarioId: 'f2', obraId: 'o1', data: hoje, horaEntrada: '07:45', lat: -23.5615, lng: -46.6559, distanciaObra: 62, status: 'presente' },
  { id: 'p3', funcionarioId: 'f3', obraId: 'o2', data: hoje, horaEntrada: '08:00', lat: -23.5630, lng: -46.6545, distanciaObra: 30, status: 'presente' },
  { id: 'p4', funcionarioId: 'f1', obraId: 'o1', data: ontem, horaEntrada: '07:30', horaSaida: '17:00', lat: -23.5614, lng: -46.6558, distanciaObra: 40, status: 'presente' },
  { id: 'p5', funcionarioId: 'f2', obraId: 'o2', data: ontem, horaEntrada: '08:00', horaSaida: '12:00', lat: -23.5629, lng: -46.6544, distanciaObra: 55, status: 'meio-periodo' },
];
