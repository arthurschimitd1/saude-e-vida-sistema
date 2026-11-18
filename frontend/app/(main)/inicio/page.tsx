'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../services/api/baseApi';

type Aba = { label: string; rota: string; icon: string; grupo: string };

const ABAS: Aba[] = [
    { label: 'Central de Gestão',       rota: '/central-gestao',                         icon: 'pi-chart-line',       grupo: 'Central de Gestão' },
    { label: 'Estoque',                 rota: '/uikit/formlayout',                     icon: 'pi-box',              grupo: 'Operacional' },
    { label: 'Produção',                rota: '/uikit/producao',                       icon: 'pi-cog',              grupo: 'Operacional' },
    { label: 'Relatórios de Produtos',  rota: '/uikit/relatorios-produtos',            icon: 'pi-chart-bar',        grupo: 'Operacional' },
    { label: 'Pedidos',                 rota: '/uikit/pedidos',                        icon: 'pi-truck',            grupo: 'Operacional' },
    { label: 'Fornecedores',            rota: '/uikit/fornecedores',                   icon: 'pi-truck',            grupo: 'Operacional' },

    { label: 'Clientes',                rota: '/uikit/button',                         icon: 'pi-users',            grupo: 'Comercial' },
    { label: 'Caixa',                   rota: '/uikit/input',                          icon: 'pi-money-bill',       grupo: 'Comercial' },

    { label: 'Custos por Funcionários', rota: '/uikit/table',                          icon: 'pi-id-card',          grupo: 'Financeiro' },
    { label: 'Entradas',                rota: '/financeiro/entradas',                 icon: 'pi-arrow-circle-down', grupo: 'Financeiro' },
    { label: 'Contas a Receber',        rota: '/financeiro/contas-receber',            icon: 'pi-wallet',            grupo: 'Financeiro' },
    { label: 'Saídas',                  rota: '/financeiro/saidas',                    icon: 'pi-arrow-circle-up',   grupo: 'Financeiro' },
    { label: 'Relatórios Financeiros',  rota: '/financeiro/relatorios',                icon: 'pi-file-export',       grupo: 'Financeiro' },
    { label: 'CRM / RFM',               rota: '/uikit/crm',                             icon: 'pi-users',              grupo: 'Financeiro' },

    { label: 'Usuários',                rota: '/uikit/invalidstate',                   icon: 'pi-user',             grupo: 'Administração' },
    { label: 'Gestão de Acessos',       rota: '/uikit/panel',                          icon: 'pi-shield',           grupo: 'Administração' },
    { label: 'Minha Empresa',           rota: '/uikit/media',                          icon: 'pi-building',         grupo: 'Administração' },
];

function saudacao(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
}

const InicioPage = () => {
    const router = useRouter();
    const [nome, setNome] = useState('');
    const [empresa, setEmpresa] = useState('');
    const [tipo, setTipo] = useState('');
    const [permissoes, setPermissoes] = useState<string[]>([]);
    const [empresaPerms, setEmpresaPerms] = useState<string[] | null>(null);

    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            setNome(u.nomeCompleto || u.nome || u.email || '');
            setTipo(u.tipo || '');

            const ehMaster = u.tipo === 'MASTER' || u.email === 'admin@master.com';
            const sel = localStorage.getItem('empresa_selecionada');
            const eid = ehMaster ? (sel ? Number(sel) : null) : u.empresa_id;

            if (eid) {
                api.get(`/access-control/companies/${eid}`)
                    .then(res => {
                        setEmpresa(res.data?.company?.nomeEmpresa ?? res.data?.company?.nome ?? res.data?.nomeEmpresa ?? res.data?.nome ?? '');
                        setEmpresaPerms(res.data?.permissions ?? res.data?.modules ?? []);
                    })
                    .catch(() => api.get(`/empresas/${eid}`)
                        .then(res => {
                            setEmpresa(res.data?.nomeEmpresa ?? res.data?.nome ?? '');
                            setEmpresaPerms(res.data?.permissoes ?? []);
                        })
                        .catch(() => setEmpresaPerms([])));
            } else {
                setEmpresaPerms(ehMaster ? null : []);
            }

            if (!ehMaster && u.id) {
                api.get(`/users/${u.id}`)
                    .then(res => {
                        const d = res.data?.data ?? res.data;
                        setPermissoes(d?.permissoes ?? []);
                    })
                    .catch(() => setPermissoes(u.permissoes ?? []));
            }
        } catch {}
    }, []);

    const isMaster = tipo === 'MASTER';
    const abasVisiveis = ABAS.filter(a => {
        if (isMaster) return empresaPerms === null || empresaPerms.includes(a.rota);
        return permissoes.includes(a.rota) &&
            (Array.isArray(empresaPerms) ? empresaPerms.includes(a.rota) : true);
    });

    const grupos = Array.from(new Set(abasVisiveis.map(a => a.grupo)));
    const primeiroNome = nome.split(' ')[0];

    return (
        <div className="inicio-page">
            <style>{`
                .inicio-page {
                    max-width: 960px;
                    margin: 0 auto;
                    padding: 1.5rem;
                }
                .inicio-header {
                    margin-bottom: 2rem;
                }
                .inicio-greeting {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: var(--text-color);
                    margin: 0;
                }
                .inicio-empresa {
                    font-size: 0.82rem;
                    color: var(--text-color-secondary);
                    margin-top: 0.25rem;
                }
                .inicio-grupo {
                    margin-bottom: 1.75rem;
                }
                .inicio-grupo-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--text-color-secondary);
                    margin-bottom: 0.6rem;
                    padding-bottom: 0.4rem;
                    border-bottom: 1px solid var(--surface-border);
                }
                .inicio-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
                    gap: 0.5rem;
                }
                .inicio-item {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.65rem 0.85rem;
                    border-radius: 8px;
                    cursor: pointer;
                    border: 1px solid var(--surface-border);
                    background: var(--surface-card);
                    transition: background 0.15s, border-color 0.15s;
                    text-decoration: none;
                }
                .inicio-item:hover {
                    background: var(--surface-hover);
                    border-color: var(--primary-color);
                }
                .inicio-item-icon {
                    font-size: 0.95rem;
                    color: var(--primary-color);
                    flex-shrink: 0;
                    width: 1.2rem;
                    text-align: center;
                }
                .inicio-item-label {
                    font-size: 0.82rem;
                    font-weight: 500;
                    color: var(--text-color);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .inicio-empty {
                    text-align: center;
                    color: var(--text-color-secondary);
                    padding: 3rem 0;
                }
                .inicio-empty i {
                    font-size: 2rem;
                    margin-bottom: 0.75rem;
                    display: block;
                    opacity: 0.5;
                }
            `}</style>

            <div className="inicio-header">
                <h1 className="inicio-greeting">{saudacao()}, {primeiroNome || 'Usuário'}</h1>
                {empresa && (
                    <div className="inicio-empresa">
                        <i className="pi pi-building" style={{ marginRight: 4, fontSize: '0.75rem' }} />
                        {empresa}
                    </div>
                )}
            </div>

            {grupos.map(grupo => {
                const abas = abasVisiveis.filter(a => a.grupo === grupo);
                return (
                    <div key={grupo} className="inicio-grupo">
                        <div className="inicio-grupo-label">{grupo}</div>
                        <div className="inicio-grid">
                            {abas.map(aba => (
                                <div
                                    key={aba.rota}
                                    className="inicio-item"
                                    onClick={() => router.push(aba.rota)}
                                >
                                    <i className={`pi ${aba.icon} inicio-item-icon`} />
                                    <span className="inicio-item-label">{aba.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {abasVisiveis.length === 0 && empresaPerms !== null && (
                <div className="inicio-empty">
                    <i className="pi pi-lock" />
                    Nenhum módulo disponível. Entre em contato com o administrador.
                </div>
            )}
        </div>
    );
};

export default InicioPage;
