import { createContext, useContext, useState } from 'react';

type LoadingCtx = { loading: boolean; setLoading: (v: boolean) => void };
const Ctx = createContext<LoadingCtx>({ loading: false, setLoading: () => {} });

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  return <Ctx.Provider value={{ loading, setLoading }}>{children}</Ctx.Provider>;
}

export const useLoading = () => useContext(Ctx);
