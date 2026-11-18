'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { centralApi, chaveSessao, mensagemErro } from './api';
import { contextCache, overviewCache, emptyResource } from './resourceCache';
import type { Contexto, Filtros, Visao } from './types';

const subscribeSession = (listener: () => void) => {
  const onStorage = (event: StorageEvent) => { if (!event.key || ['token','user','empresa_selecionada'].includes(event.key)) listener(); };
  window.addEventListener('storage', onStorage); window.addEventListener('focus', listener);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('focus', listener); };
};
const noSession = () => '';
export function useContextoCentral() {
  const path = usePathname();
  const key = useSyncExternalStore(subscribeSession, chaveSessao, noSession);
  const read = useCallback(() => contextCache.read<Contexto>(key, 'contexto'), [key]);
  const state = useSyncExternalStore(contextCache.subscribe, read, emptyResource<Contexto>);
  const refresh = useCallback((force = false) => {
    if (!key || !localStorage.getItem('token')) { contextCache.clear(); overviewCache.clear(); return; }
    return contextCache.load(key, 'contexto', async signal => (await centralApi.contexto(signal)).data, 30000, force);
  }, [key]);
  useEffect(() => { overviewCache.setSession(key); void refresh(); }, [refresh, path, key]);
  useEffect(() => {
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  useEffect(() => {
    const status = (state.error as { status?: number })?.status;
    if (status === 401 || status === 403 || status === 404) overviewCache.clear();
  }, [state.error]);
  return { contexto: state.data, key, loading: !state.data && (!state.error || state.loading), refreshing: state.loading,
    error: state.error ? mensagemErro(state.error) : '', retry: () => { void refresh(true); } };
}

export function useVisaoCentral(contexto: Contexto | null, filters: Filtros, sessionKey: string) {
  const filterKey = JSON.stringify([filters.periodo, filters.carteira, filters.periodo === 'personalizado' ? filters.inicio : '', filters.periodo === 'personalizado' ? filters.fim : '']);
  const queryKey = `${contexto?.empresaId}:${filterKey}`;
  const read = useCallback(() => overviewCache.read<Visao>(sessionKey, queryKey), [sessionKey, queryKey]);
  const state = useSyncExternalStore(overviewCache.subscribe, read, emptyResource<Visao>);
  const refresh = useCallback((force = false) => {
    if (!contexto || !sessionKey || sessionKey !== chaveSessao()) return;
    return overviewCache.load(sessionKey, queryKey, async signal => {
      const { data } = await centralApi.visao(filters, signal);
      if (data.empresaId !== contexto.empresaId) throw { status: 403, message: 'O contexto da empresa mudou. Atualize a página.' };
      return data;
    }, 60000, force);
    // O filtro serializado é a identidade do recorte; objetos equivalentes não refazem a consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexto?.empresaId, sessionKey, queryKey]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  const valid = contexto && state.data?.empresaId === contexto.empresaId && sessionKey === chaveSessao();
  return { dados: valid ? state.data : null, error: state.error ? mensagemErro(state.error) : '',
    loading: !!contexto && !state.data && (!state.error || state.loading), refreshing: !!state.data && state.loading,
    retry: () => { void refresh(true); } };
}

