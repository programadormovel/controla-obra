import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function useAdminEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    api.getUsuarios().then(lista => {
      setEmail(lista.find(u => u.perfil === 'admin')?.email ?? null);
    }).catch(() => {});
  }, []);
  return email;
}
