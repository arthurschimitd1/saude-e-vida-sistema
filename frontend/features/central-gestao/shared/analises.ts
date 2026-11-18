'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/app/(main)/services/api/baseApi';
import { chaveSessao, mensagemErro } from '../api';
import { SessionResourceCache, emptyResource } from '../resourceCache';

export type View = 'comercial' | 'estoque';
export type Filters = { periodo: string; inicio?: string; fim?: string; cliente?: string; produto?: string; familia?: string; unidade?: string; status?: string; busca?: string; diasSem?: string; granularidade?: string };
export type Decimal = string | null;
export type Customer = { id: number; nome: string; compras: number; anteriores: number; valor: Decimal; ticket: Decimal; ultima: string | null; dias_sem: number | null };
export type Product = {
    chave: string;
    nome: string;
    codigo: string;
    unidade: string;
    familia: string;
    quantidade: Decimal;
    minimo: Decimal;
    necessidade: Decimal;
    infinito: boolean;
    status: string;
    valor: Decimal;
    vendido: Decimal;
    registros: number;
    ultima: string | null;
    dias_sem: number | null;
    idade: number;
    novo_no_periodo: boolean;
};
export type Page<T> = { empresaId: number; total: number; itens: T[]; pagina: number; tamanho: number };
export type Point = { dia: string; valor: Decimal; quantidade: number | string | null };
export type Commercial = {
    empresaId: number;
    atualizadoEm: string;
    periodo: { inicio: string; fim: string; anteriorInicio: string; anteriorFim: string; dias: number };
    resumo: { total: Decimal; anterior: Decimal; ticket: Decimal; quantidade: number; sem_cliente: number; vinculo_invalido: number };
    clientes: number;
    novosClientes: number;
    orcamentos: number;
    antesSemAgora: number;
    semCompra: number;
    semHistorico: number;
    serie: Point[];
    serieAnterior: Point[];
    abc: null | { classe: string; produtos: number; valor: string; percentual: string }[];
    abcSemValor: number;
    abcLimites: { a: number; b: number };
    itensSemCatalogo: number;
    rankingClientes: Customer[];
    rankingProdutos: Product[];
};
export type Stock = {
    empresaId: number;
    atualizadoEm: string;
    skus: number;
    normal: number;
    baixo: number;
    zero: number;
    infinito: number;
    indisponivel: number;
    reposicao: number;
    semVenda: number;
    novos: number;
    grupos: { familia: string; unidade: string; skus: number; quantidade: Decimal; necessidade: Decimal }[];
    familias: { familia: string; skus: number }[];
};
export type Options = { empresaId: number; produtos: { chave: string; nome: string; unidade: string }[]; clientes: { id: number; nome: string }[]; unidades: string[] };
export type Access = { empresaId: number; comercial: boolean; estoque: boolean };
const cache = new SessionResourceCache(40);
export function refreshAnalises(view: View) {
    window.dispatchEvent(new CustomEvent('central-analises-refresh', { detail: view }));
}
const subscribeSession = (listener: () => void) => {
    const storage = (e: StorageEvent) => {
        if (!e.key || ['token', 'user', 'empresa_selecionada'].includes(e.key)) listener();
    };
    window.addEventListener('storage', storage);
    window.addEventListener('focus', listener);
    return () => {
        window.removeEventListener('storage', storage);
        window.removeEventListener('focus', listener);
    };
};
export function useAnalise<T>(view: View | 'acesso', operation = '', params: object = {}, enabled = true) {
    const path = usePathname();
    const session = useSyncExternalStore(subscribeSession, chaveSessao, () => '');
    const endpoint = view === 'acesso' ? 'acesso' : `${view}/${operation}`;
    const serialized = JSON.stringify(params);
    const key = `${endpoint}:${serialized}`;
    const read = useCallback(() => cache.read<T>(session, key), [session, key]);
    const state = useSyncExternalStore(cache.subscribe, read, emptyResource<T>);
    const refresh = useCallback(
        (force = false) => {
            cache.setSession(session);
            if (!enabled || !session || !localStorage.getItem('token') || session !== chaveSessao()) return;
            return cache.load(
                session,
                key,
                async (signal) => {
                    const result = await api.get<T>(`/central-gestao/analises/${endpoint}`, { params: JSON.parse(serialized), signal });
                    return result.data;
                },
                view === 'acesso' ? 15000 : 60000,
                force
            );
        },
        [session, key, endpoint, serialized, enabled, view]
    );
    useEffect(() => {
        void refresh();
    }, [refresh, path]);
    useEffect(() => {
        const focus = () => {
            void refresh();
        };
        window.addEventListener('focus', focus);
        return () => window.removeEventListener('focus', focus);
    }, [refresh]);
    useEffect(() => {
        const update = (event: Event) => {
            if ((event as CustomEvent).detail === view) void refresh(true);
        };
        window.addEventListener('central-analises-refresh', update);
        return () => window.removeEventListener('central-analises-refresh', update);
    }, [refresh, view]);
    return {
        data: enabled ? state.data : null,
        error: state.error ? mensagemErro(state.error) : '',
        loading: enabled && !state.data && (!state.error || state.loading),
        refreshing: state.loading,
        retry: () => {
            void refresh(true);
        },
        session
    };
}

