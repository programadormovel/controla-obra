export type Funcionario = {
  id: string;
  nome: string;
  funcao: string;
  diaria: number;
  transporte: number;
  alimentacao: number;
  telefone: string;
  ativo: boolean;
};

export type Obra = {
  id: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  ativa: boolean;
};

export type Presenca = {
  id: string;
  funcionarioId: string;
  obraId: string;
  data: string;
  horaEntrada: string;
  horaSaida?: string;
  lat: number;
  lng: number;
  distanciaObra: number;
  status: "presente" | "ausente" | "meio-periodo";
};
