import { useLoading } from '../context/LoadingContext';

export function useApi() {
  const { setLoading } = useLoading();

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }

  return { run };
}
