/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { classNames } from 'primereact/utils';
import { Dropdown } from 'primereact/dropdown';
import { Toast } from 'primereact/toast';
import React, { forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppTopbarRef } from '@/types';
import { LayoutContext } from './context/layoutcontext';
import api from '../app/(main)/services/api/baseApi';

const EMPRESA_KEY = 'empresa_selecionada';
const NOTIFICACOES_CONHECIDAS_PREFIX = 'pedidos_notificados_';

const AppTopbar = forwardRef<AppTopbarRef>((props, ref) => {
    const { layoutConfig, layoutState, onMenuToggle, showProfileSidebar } = useContext(LayoutContext);
    const router = useRouter();
    const menubuttonRef = useRef(null);
    const topbarmenuRef = useRef(null);
    const topbarmenubuttonRef = useRef(null);
    const toastRef = useRef<Toast>(null);
    const notificacoesConhecidas = useRef<Set<number>>(new Set());
    const audioContextRef = useRef<AudioContext | null>(null);

    // Estado: usuário logado + empresas (só MASTER vê o seletor)
    const [user, setUser] = useState<any>(null);
    const [empresas, setEmpresas] = useState<{ id: number; nome: string }[]>([]);
    const [empresaSelecionada, setEmpresaSelecionada] = useState<number | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                setUser(u);
                // Inicializa com a empresa salva (se houver)
                const saved = localStorage.getItem(EMPRESA_KEY);
                if (saved && !isNaN(Number(saved))) setEmpresaSelecionada(Number(saved));
            } catch { /* ignore */ }
        }
    }, []);

    // Consulta as notificações da empresa enquanto o sistema está aberto.
    // Os IDs já exibidos ficam salvos por usuário, então um pedido que chegou
    // enquanto o painel estava fechado ainda aparece quando ele for aberto.
    useEffect(() => {
        const ehMaster = user?.tipo === 'MASTER' || user?.email === 'admin@master.com';
        // MASTER pode estar em “Todas as empresas”, portanto não depende de
        // user.empresa_id para manter o polling ativo.
        if (!user?.id || (!user?.empresa_id && !ehMaster)) return;
        let ativo = true;
        const notificacoesConhecidasKey = `${NOTIFICACOES_CONHECIDAS_PREFIX}${user.id}`;

        try {
            const salvas = JSON.parse(localStorage.getItem(notificacoesConhecidasKey) || '[]');
            notificacoesConhecidas.current = new Set(
                Array.isArray(salvas) ? salvas.map(Number).filter(Number.isFinite) : [],
            );
        } catch {
            notificacoesConhecidas.current = new Set();
        }

        const tocarSomPedido = () => {
            try {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioContextClass) return;
                const contexto = audioContextRef.current || new AudioContextClass();
                audioContextRef.current = contexto;
                void contexto.resume();
                const inicio = contexto.currentTime;
                [
                    { frequencia: 880, inicio: 0, duracao: 0.16 },
                    { frequencia: 1175, inicio: 0.18, duracao: 0.22 },
                ].forEach(({ frequencia, inicio: atraso, duracao }) => {
                    const oscilador = contexto.createOscillator();
                    const volume = contexto.createGain();
                    oscilador.type = 'sine';
                    oscilador.frequency.value = frequencia;
                    volume.gain.setValueAtTime(0.0001, inicio + atraso);
                    volume.gain.exponentialRampToValueAtTime(0.16, inicio + atraso + 0.025);
                    volume.gain.exponentialRampToValueAtTime(0.0001, inicio + atraso + duracao);
                    oscilador.connect(volume);
                    volume.connect(contexto.destination);
                    oscilador.start(inicio + atraso);
                    oscilador.stop(inicio + atraso + duracao + 0.02);
                });
            } catch { /* o aviso visual continua mesmo se o navegador bloquear áudio */ }
        };

        const consultarNotificacoes = async () => {
            try {
                const res = await api.get('/automacao/notificacoes');
                const dados = res.data?.data ?? res.data;
                const lista = Array.isArray(dados) ? dados : [];
                if (!ativo) return;

                const idsAtuais = new Set<number>(lista.map((item: any) => Number(item.id)).filter(Number.isFinite));
                const novas = lista
                    .filter((item: any) => !notificacoesConhecidas.current.has(Number(item.id)))
                    .filter((item: any) => String(item.titulo || '').toLowerCase().includes('pedido'))
                    .reverse();

                novas.forEach((item: any) => {
                    tocarSomPedido();
                    toastRef.current?.show({
                        severity: 'info',
                        summary: 'Novo pedido recebido',
                        detail: item.mensagem || `Pedido #${item.id} chegou pela lojinha.`,
                        life: 12000,
                        icon: 'pi pi-shopping-bag',
                        onClick: () => router.push('/loja/gestao'),
                    });
                });

                const idsPersistidos = Array.from(new Set([
                    ...notificacoesConhecidas.current,
                    ...idsAtuais,
                ])).slice(-200);
                notificacoesConhecidas.current = new Set(idsPersistidos);
                localStorage.setItem(notificacoesConhecidasKey, JSON.stringify(idsPersistidos));
            } catch { /* notificações não devem interromper a navegação */ }
        };

        void consultarNotificacoes();
        const intervalo = window.setInterval(() => { void consultarNotificacoes(); }, 10000);
        return () => {
            ativo = false;
            window.clearInterval(intervalo);
        };
    }, [router, user?.id, user?.empresa_id, user?.tipo, user?.email]);

    // Quando o usuário for MASTER, carrega a lista de empresas
    useEffect(() => {
        const ehMaster = user?.tipo === 'MASTER' || user?.email === 'admin@master.com';
        if (!ehMaster) return;
        api.get('/empresas')
            .then(res => setEmpresas(Array.isArray(res.data) ? res.data : []))
            .catch(() => setEmpresas([]));
    }, [user]);

    const onTrocarEmpresa = (id: number | null) => {
        setEmpresaSelecionada(id);
        if (id == null) localStorage.removeItem(EMPRESA_KEY);
        else localStorage.setItem(EMPRESA_KEY, String(id));
        // Recarrega a página pra todas as listagens atualizarem com o novo filtro
        window.location.reload();
    };

    useImperativeHandle(ref, () => ({
        menubutton: menubuttonRef.current,
        topbarmenu: topbarmenuRef.current,
        topbarmenubutton: topbarmenubuttonRef.current
    }));

    const ehMaster = user?.tipo === 'MASTER' || user?.email === 'admin@master.com';

    return (
        <>
            <Toast ref={toastRef} position="top-right" />
            <div className="layout-topbar">
           <Link href="/central-gestao" className="layout-topbar-logo">
                <span className="saude-vida-brand" aria-label="Saúde e Vida">
                    <span className="saude-vida-brand-mark" aria-hidden="true"><i className="pi pi-leaf" /></span>
                    <span>Saúde e Vida</span>
                </span>
            </Link>

            <button ref={menubuttonRef} type="button" className="p-link layout-menu-button layout-topbar-button" onClick={onMenuToggle}>
                <i className="pi pi-bars" />
            </button>

            {/* Seletor de empresa — só aparece pro MASTER, ao lado do hambúrguer */}
            {ehMaster && (
                <div className="layout-company-selector" style={{ marginLeft: '0.75rem', minWidth: '220px' }}>
                    <Dropdown
                        value={empresaSelecionada}
                        options={[
                            { label: 'Todas as empresas', value: null },
                            ...empresas.map(e => ({ label: e.nome, value: e.id }))
                        ]}
                        onChange={(e) => onTrocarEmpresa(e.value)}
                        placeholder="Selecione a empresa"
                        className="w-full"
                    />
                </div>
            )}

            <button ref={topbarmenubuttonRef} type="button" className="p-link layout-topbar-menu-button layout-topbar-button" onClick={showProfileSidebar}>
                <i className="pi pi-ellipsis-v" />
            </button>

            <div ref={topbarmenuRef} className={classNames('layout-topbar-menu', { 'layout-topbar-menu-mobile-active': layoutState.profileSidebarVisible })}>
                <button type="button" className="p-link layout-topbar-button">
                    <i className="pi pi-calendar"></i>
                    <span>Calendar</span>
                </button>
                <button type="button" className="p-link layout-topbar-button">
                    <i className="pi pi-user"></i>
                    <span>Profile</span>
                </button>
            </div>
            </div>
        </>
    );
});

AppTopbar.displayName = 'AppTopbar';

export default AppTopbar;
