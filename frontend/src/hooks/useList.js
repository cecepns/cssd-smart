import { useCallback, useEffect, useMemo, useState } from 'react';
import useDebounce from '@/hooks/useDebounce';
import { getErrorMessage, getList, isCancel } from '@/utils/request';
import { DEFAULT_LIMIT, SEARCH_DEBOUNCE_MS } from '@/utils/constants';

const EMPTY_PAGINATION = { page: 1, limit: DEFAULT_LIMIT, total: 0, totalPages: 1 };

/**
 * Hook list data dari API backend: pagination, limit, search (debounce), sorting, filter.
 */
export default function useList(endpoint, { fixedParams, defaultSort = 'id', defaultOrder = 'desc' } = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState({ by: defaultSort, order: defaultOrder });
  const [filters, setFilters] = useState({});
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ rows: [], pagination: EMPTY_PAGINATION, loading: true, error: null });

  const search = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const fixedKey = JSON.stringify(fixedParams || {});
  const filterKey = JSON.stringify(filters);

  // Parameter filter tanpa pagination (dipakai juga untuk export)
  const queryParams = useMemo(
    () => ({ search, sort_by: sort.by, order: sort.order, ...filters, ...(fixedParams || {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, sort, filterKey, fixedKey]
  );

  const params = useMemo(() => ({ page, limit, ...queryParams }), [page, limit, queryParams]);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    getList(endpoint, params, controller.signal)
      .then((body) => setState({ rows: body.data, pagination: body.pagination, loading: false, error: null }))
      .catch((err) => {
        if (isCancel(err)) return;
        setState((prev) => ({ ...prev, loading: false, error: getErrorMessage(err) }));
      });

    return () => controller.abort();
  }, [endpoint, params, tick]);

  // Jika halaman saat ini kosong (mis. setelah hapus data terakhir) mundur satu halaman
  useEffect(() => {
    if (!state.loading && !state.error && state.rows.length === 0 && page > 1) {
      setPage((p) => Math.max(1, Math.min(p - 1, state.pagination.totalPages)));
    }
  }, [state.loading, state.error, state.rows.length, state.pagination.totalPages, page]);

  const changeSearch = useCallback((value) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const changeLimit = useCallback((value) => {
    setLimit(Number(value));
    setPage(1);
  }, []);

  const changeFilter = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setSearchInput('');
    setPage(1);
  }, []);

  const toggleSort = useCallback((key) => {
    setSort((prev) =>
      prev.by === key ? { by: key, order: prev.order === 'asc' ? 'desc' : 'asc' } : { by: key, order: 'asc' }
    );
    setPage(1);
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return {
    ...state,
    page,
    limit,
    searchInput,
    sort,
    filters,
    queryParams,
    setPage,
    changeSearch,
    changeLimit,
    changeFilter,
    resetFilters,
    toggleSort,
    reload,
  };
}
