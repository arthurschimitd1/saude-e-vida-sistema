/* eslint-disable @next/next/no-img-element */

import React, { useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppMenuitem from './AppMenuitem';
import { LayoutContext } from './context/layoutcontext';
import { MenuProvider } from './context/menucontext';
import { AppMenuItem } from '@/types';
import api from '../app/(main)/services/api/baseApi';

const AppMenu = () => {
    const { layoutConfig } = useContext(LayoutContext);
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [userPermissoes, setUserPermissoes] = useState<string[] | null>(null); // null = ainda carregando
    const [empresaPermissoes, setEmpresaPermissoes] = useState<string[] | null>(null); // null = ainda carregando
    const [empresaNome, setEmpresaNome] = useState<string | null>(null);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const localDemo = !userStr && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? { id: 'local-demo-user', nome: 'Demonstração local', email: 'demo@saudeevida.local', tipo: 'MASTER', empresa_id: 1, permissoes: [], modo_local: true }
            : null;
        if (localDemo) {
            localStorage.setItem('token', 'local-demo-token');
            localStorage.setItem('user', JSON.stringify(localDemo));
            localStorage.setItem('modo_local', 'true');
        }
        if (userStr || localDemo) {
            try {
                const u = localDemo || JSON.parse(userStr as string);
                setUser(u);
                const ehMaster = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';

                if (!ehMaster && u?.id) {
                    api.get(`/access-control/users/${u.id}/effective`)
                        .then(res => {
                            setUserPermissoes(res.data?.permissions ?? []);
                        })
                        .catch(() => {
                            api.get(`/users/${u.id}`)
                                .then(res => {
                                    const userData = res.data?.data ?? res.data;
                                    setUserPermissoes(userData?.permissoes ?? []);
                                })
                                .catch(() => setUserPermissoes([]));
                        });
                }

                if (!ehMaster && u?.empresa_id) {
                    api.get(`/access-control/companies/${u.empresa_id}`)
                        .then(res => {
                            setEmpresaPermissoes(res.data?.permissions ?? []);
                        })
                        .catch(() => {
                            api.get(`/empresas/${u.empresa_id}`)
                                .then(res => setEmpresaPermissoes(res.data?.permissoes ?? []))
                                .catch(() => setEmpresaPermissoes([]));
                        });
                    api.get(`/empresas/${u.empresa_id}`)
                        .then(res => setEmpresaNome(res.data?.nomeEmpresa ?? res.data?.nome ?? null))
                        .catch(() => {});
                }
                // MASTER: tenta pegar nome da empresa selecionada no topbar
                if (ehMaster) {
                    const ec = localStorage.getItem('empresa_selecionada');
                    if (ec && !isNaN(Number(ec))) {
                        api.get(`/empresas/${Number(ec)}`)
                            .then(res => setEmpresaNome(res.data?.nomeEmpresa ?? res.data?.nome ?? null))
                            .catch(() => {});
                    }
                }
            } catch {}
        }
    }, []);

    const isMaster = user?.tipo === 'MASTER' || user?.email === 'admin@master.com';

    // Ainda aguardando fetch (não-MASTER)
    const precisaUserPerms = !isMaster;
    const carregandoPermissoes = !isMaster && user !== null && !!user?.empresa_id &&
        (precisaUserPerms && userPermissoes === null);

    // Calcula permissões efetivas:
    // - MASTER: tudo
    // - Usuários da empresa: somente permissões individuais/cargo definem o menu
    const permissoes: string[] = (() => {
        if (isMaster) return [];
        if (userPermissoes === null) return [];
        // Permissões vazias = sem acesso. Acesso deve ser explícito para qualquer usuário da empresa.
        if ((userPermissoes as string[]).length === 0) return [];
        return userPermissoes as string[];
    })();

    const handleLogout = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        // router.push('/auth/login');
        router.push('/');
    };

    const model: AppMenuItem[] = [
        {
            label: 'Central de Gestão',
            groupGuard: '/central-gestao',
            requiredInternalPermission: 'central_gestao:visualizar',
            items: [{ label: 'Visão Geral', icon: 'pi pi-fw pi-chart-line', to: '/central-gestao' }]
        },
        {
            label: 'Operacional',
            items: [
                { label: 'Estoque', icon: 'pi pi-fw pi-box', to: '/uikit/formlayout' },
                { label: 'Produção', icon: 'pi pi-fw pi-cog', to: '/uikit/producao' },
                { label: 'Relatórios de produtos', icon: 'pi pi-fw pi-chart-bar', to: '/uikit/relatorios-produtos' },
                { label: 'Pedidos', icon: 'pi pi-fw pi-shopping-cart', to: '/uikit/pedidos' },
                { label: 'Fornecedores', icon: 'pi pi-fw pi-truck', to: '/uikit/fornecedores' },
            ]
        },
        {
            label: 'Comercial',
            items: [
                { label: 'Clientes', icon: 'pi pi-fw pi-user', to: '/uikit/button' },
                { label: 'Caixa', icon: 'pi pi-fw pi-money-bill', to: '/uikit/input' },
                { label: 'Lojinha online', icon: 'pi pi-fw pi-shopping-bag', to: '/loja/gestao' },
                { label: 'Configurar lojinha', icon: 'pi pi-fw pi-sliders-h', to: '/loja/configuracao' },
                { label: 'WhatsApp da empresa', icon: 'pi pi-fw pi-whatsapp', to: '/uikit/automacao-whatsapp' },
            ]
        },
        {
            label: 'Financeiro',
            items: [
                { label: 'Custos por Funcionários',  icon: 'pi pi-fw pi-table',             to: '/uikit/table' },
                { label: 'Entradas',                 icon: 'pi pi-fw pi-arrow-circle-down', to: '/financeiro/entradas' },
                { label: 'Contas a Receber',          icon: 'pi pi-fw pi-wallet',             to: '/financeiro/contas-receber' },
                { label: 'Saídas',                   icon: 'pi pi-fw pi-arrow-circle-up',   to: '/financeiro/saidas' },
                { label: 'Relatórios Financeiros',   icon: 'pi pi-fw pi-file-export',       to: '/financeiro/relatorios' },
                { label: 'CRM / RFM',               icon: 'pi pi-fw pi-users',              to: '/uikit/crm' },
            ]
        },
        {
            label: 'Administração',
            items: [
                { label: 'Usuários', icon: 'pi pi-fw pi-user-plus', to: '/uikit/invalidstate' },
                { label: 'Gestão de Acessos', icon: 'pi pi-fw pi-shield', to: '/uikit/panel' },
                { label: 'Minha Empresa', icon: 'pi pi-fw pi-building', to: '/uikit/media' },
            ]
        },
    ];
    const modelFiltrado: AppMenuItem[] = isMaster
    ? model
    : model
        .filter(grupo => {
            const guard = (grupo as any).groupGuard as string | undefined;
            const requiredInternalPermission = (grupo as any).requiredInternalPermission as string | undefined;
            if (!guard) return true;
            return permissoes.some(r => r === guard || r.startsWith(`${guard}/`))
                && (!requiredInternalPermission || userPermissoes?.includes(requiredInternalPermission));
        })
        .map(grupo => {
            return {
                ...grupo,
                items: (grupo.items ?? []).filter(item =>
                    permissoes.includes(item.to as string)
                )
            };
        })
        .filter(grupo => (grupo.items ?? []).length > 0);

    return (
        <MenuProvider>
            {/* Nome da empresa no topo da sidebar */}
            {(empresaNome || isMaster) && (
                <div style={{
                    margin: '4px 12px 2px 12px',
                    padding: '8px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <i className={isMaster ? 'pi pi-star' : 'pi pi-building'} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isMaster ? (empresaNome ?? 'Visão Geral') : empresaNome}
                    </span>
                </div>
            )}
            <ul className="layout-menu">
                {carregandoPermissoes ? (
                    // Skeleton enquanto busca o pacote da empresa
                    Array.from({ length: 6 }).map((_, i) => (
                        <li key={i} style={{ padding: '10px 16px' }}>
                            <div style={{ height: '14px', borderRadius: '6px', background: 'rgba(128,128,128,0.15)', marginBottom: '6px', width: `${60 + (i % 3) * 15}%` }} />
                        </li>
                    ))
                ) : (
                    modelFiltrado.map((item, i) => (
                        !item?.seperator ? <AppMenuitem item={item} root={true} index={i} key={item.label} /> : <li className="menu-separator"></li>
                    ))
                )}
            </ul>

            {/* Botão de logout fixado no rodapé da sidebar */}
            <div className="sidebar-logout">
                <button onClick={handleLogout} className="logout-button" type="button">
                    <i className="pi pi-sign-out" />
                    <span>Sair</span>
                </button>
            </div>
        </MenuProvider>
    );
};

export default AppMenu;
