/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEventListener, useMountEffect, useUnmountEffect } from 'primereact/hooks';
import React, { useContext, useEffect, useRef } from 'react';
import { classNames } from 'primereact/utils';
import AppFooter from './AppFooter';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import AppConfig from './AppConfig';
import { LayoutContext } from './context/layoutcontext';
import { PrimeReactContext } from 'primereact/api';
import { ChildContainerProps, LayoutState, AppTopbarRef } from '@/types';
import { usePathname, useSearchParams } from 'next/navigation';
import api from '../app/(main)/services/api/baseApi';

const Layout = ({ children }: ChildContainerProps) => {
    const { layoutConfig, layoutState, setLayoutState } = useContext(LayoutContext);
    const { setRipple } = useContext(PrimeReactContext);
    const topbarRef = useRef<AppTopbarRef>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [bindMenuOutsideClickListener, unbindMenuOutsideClickListener] = useEventListener({
        type: 'click',
        listener: (event) => {
            const isOutsideClicked = !(
                sidebarRef.current?.isSameNode(event.target as Node) ||
                sidebarRef.current?.contains(event.target as Node) ||
                topbarRef.current?.menubutton?.isSameNode(event.target as Node) ||
                topbarRef.current?.menubutton?.contains(event.target as Node)
            );

            if (isOutsideClicked) {
                hideMenu();
            }
        }
    });

    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [rotaAutorizada, setRotaAutorizada] = React.useState(false);
    const [guardVerificado, setGuardVerificado] = React.useState(false);
    useEffect(() => {
        hideMenu();
        hideProfileMenu();
    }, [pathname, searchParams]);

    // A navegação entre abas depende apenas de uma sessão autenticada.
    // As APIs continuam responsáveis por autenticação e escopo dos dados.
    useEffect(() => {
        let ativo = true;
        setGuardVerificado(false);

        // Páginas de auth nunca são bloqueadas pelo guard
        if (pathname.startsWith('/auth/')) {
            setRotaAutorizada(true);
            setGuardVerificado(true);
            return () => { ativo = false; };
        }

        try {
            const token = localStorage.getItem('token');
            const rawUser = localStorage.getItem('user');
            let u = null;
            try { u = rawUser ? JSON.parse(rawUser) : null; } catch { u = null; }
            if (ativo) setRotaAutorizada(false);

            // Durante o desenvolvimento local, a interface pode ser explorada
            // sem banco. A liberação é limitada a localhost/127.0.0.1.
            const hostLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (hostLocal) {
                const usuarioLocal = { id: 'local-demo-user', nome: 'Demonstração local', email: 'demo@saudeevida.local', tipo: 'MASTER', empresa_id: 1, permissoes: [], modo_local: true };
                if (!token || !u?.id) {
                    localStorage.setItem('token', 'local-demo-token');
                    localStorage.setItem('user', JSON.stringify(usuarioLocal));
                    // useSyncExternalStore não recebe o evento `storage` quando
                    // a alteração é feita na própria aba. Avisamos os módulos
                    // que dependem da sessão para que a Central e o menu façam
                    // a primeira consulta imediatamente no modo local.
                    window.dispatchEvent(new StorageEvent('storage', { key: 'token' }));
                }
                localStorage.setItem('modo_local', 'true');
                if (ativo) {
                    setRotaAutorizada(true);
                    setGuardVerificado(true);
                }
                return () => { ativo = false; };
            }

            // Sem sessão ativa → login (evita loop /inicio quando o token expirou)
            if (!token || !u?.id) {
                window.location.replace('/auth/login');
                return;
            }

            if (ativo) {
                setRotaAutorizada(true);
                setGuardVerificado(true);
            }
        } catch {
            // Dados antigos ou inválidos de sessão não podem deixar a tela presa
            // indefinidamente em "Verificando acesso...".
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.replace('/auth/login');
        }

        return () => { ativo = false; };
    }, [pathname]);

    // Telemetria agregada de navegação: não registra páginas de autenticação nem acessos do MASTER.
    useEffect(() => {
        if (!pathname || pathname.startsWith('/auth/')) return;
        try {
            const token = localStorage.getItem('token');
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            if (!token || !u?.id || u?.tipo === 'MASTER') return;
            void api.post('/usage', { route: pathname }).catch(() => undefined);
        } catch {}
    }, [pathname]);

    const [bindProfileMenuOutsideClickListener, unbindProfileMenuOutsideClickListener] = useEventListener({
        type: 'click',
        listener: (event) => {
            const isOutsideClicked = !(
                topbarRef.current?.topbarmenu?.isSameNode(event.target as Node) ||
                topbarRef.current?.topbarmenu?.contains(event.target as Node) ||
                topbarRef.current?.topbarmenubutton?.isSameNode(event.target as Node) ||
                topbarRef.current?.topbarmenubutton?.contains(event.target as Node)
            );

            if (isOutsideClicked) {
                hideProfileMenu();
            }
        }
    });

    const hideMenu = () => {
        setLayoutState((prevLayoutState: LayoutState) => ({
            ...prevLayoutState,
            overlayMenuActive: false,
            staticMenuMobileActive: false,
            menuHoverActive: false
        }));
        unbindMenuOutsideClickListener();
        unblockBodyScroll();
    };

    const hideProfileMenu = () => {
        setLayoutState((prevLayoutState: LayoutState) => ({
            ...prevLayoutState,
            profileSidebarVisible: false
        }));
        unbindProfileMenuOutsideClickListener();
    };

    const blockBodyScroll = (): void => {
        if (document.body.classList) {
            document.body.classList.add('blocked-scroll');
        } else {
            document.body.className += ' blocked-scroll';
        }
    };

    const unblockBodyScroll = (): void => {
        if (document.body.classList) {
            document.body.classList.remove('blocked-scroll');
        } else {
            document.body.className = document.body.className.replace(new RegExp('(^|\\b)' + 'blocked-scroll'.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
        }
    };

    useEffect(() => {
        if (layoutState.overlayMenuActive || layoutState.staticMenuMobileActive) {
            bindMenuOutsideClickListener();
        }

        layoutState.staticMenuMobileActive && blockBodyScroll();
    }, [layoutState.overlayMenuActive, layoutState.staticMenuMobileActive]);

    useEffect(() => {
        if (layoutState.profileSidebarVisible) {
            bindProfileMenuOutsideClickListener();
        }
    }, [layoutState.profileSidebarVisible]);

    useUnmountEffect(() => {
        unbindMenuOutsideClickListener();
        unbindProfileMenuOutsideClickListener();
    });

    const containerClass = classNames('layout-wrapper', {
        'layout-overlay': layoutConfig.menuMode === 'overlay',
        'layout-static': layoutConfig.menuMode === 'static',
        'layout-static-inactive': layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive,
        'layout-mobile-active': layoutState.staticMenuMobileActive,
        'p-input-filled': layoutConfig.inputStyle === 'filled',
        'p-ripple-disabled': !layoutConfig.ripple
    });

    // O primeiro render precisa ser igual no servidor e no cliente. Em localhost
    // o guard é liberado pelo useEffect acima, mas não podemos ignorá-lo aqui:
    // isso fazia o cliente montar o layout completo enquanto o servidor entregava
    // "Verificando acesso...", causando erro de hidratação no Next.js.
    if (!guardVerificado || !rotaAutorizada) {
        return (
            <div className="flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                <span className="text-color-secondary">Verificando acesso...</span>
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className={containerClass}>
                <AppTopbar ref={topbarRef} />
                <div ref={sidebarRef} className="layout-sidebar">
                    <AppSidebar />
                </div>
                <div className="layout-main-container">
                    <div className="layout-main">{children}</div>
                    <AppFooter />
                </div>
                <AppConfig />
                <div className="layout-mask"></div>
            </div>
        </React.Fragment>
    );
};

export default Layout;
