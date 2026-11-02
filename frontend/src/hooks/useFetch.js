import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage, getList, isCancel } from '@/utils/request';

/**
 * Hook fetch sederhana (GET) dengan loading, error, dan reload.
 * `body` berisi response mentah { success, data, pagination? }.
 */
export default function useFetch(endpoint, params, { enabled = true, refreshKey } = {}) {
  const [state, setState] = useState({ body: null, loading: enabled, error: null });
  const [tick, setTick] = useState(0);
  const paramsKey = JSON.stringify(params || {});

  useEffect(() => {
    if (!enabled || !endpoint) return undefined;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    getList(endpoint, params, controller.signal)
      .then((body) => setState({ body, loading: false, error: null }))
      .catch((err) => {
        if (isCancel(err)) return;
        setState({ body: null, loading: false, error: getErrorMessage(err) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey, enabled, refreshKey, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { ...state, data: state.body?.data ?? null, reload };
}
