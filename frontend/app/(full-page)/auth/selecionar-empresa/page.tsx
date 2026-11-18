'use client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import api from '@/app/(main)/services/api/baseApi';

type OpcaoEmpresa = { empresa_id: number; nome: string; cargo: string };

const SelecionarEmpresaPage = () => {
    const router = useRouter();
    const toast = useRef<Toast>(null);
    const [empresas, setEmpresas] = useState<OpcaoEmpresa[]>([]);
    const [loading, setLoading] = useState<number | null>(null);

    useEffect(() => {
        const opcoes = sessionStorage.getItem('multiEmpresaOpcoes');
        if (!opcoes) { router.replace('/auth/login'); return; }
        try { setEmpresas(JSON.parse(opcoes)); } catch { router.replace('/auth/login'); }
    }, []);

    const entrar = async (empresa: OpcaoEmpresa) => {
        const credStr = sessionStorage.getItem('multiEmpresaCredenciais');
        const googleCredential = sessionStorage.getItem('multiEmpresaGoogle');

        if (!credStr && !googleCredential) { router.replace('/auth/login'); return; }

        setLoading(empresa.empresa_id);
        try {
            let response;

            if (googleCredential) {
                // Fluxo Google: revalida o token com a empresa selecionada
                response = await api.post('/auth/google', {
                    credential: googleCredential,
                    empresa_id: empresa.empresa_id
                }, { skipAuthInterceptor: true } as any);
            } else {
                // Fluxo tradicional (email/senha) — sem alterações
                const { email, senha } = JSON.parse(credStr!);
                response = await api.post('/auth/login', {
                    email,
                    senha,
                    empresa_id: empresa.empresa_id
                }, { skipAuthInterceptor: true } as any);
            }

            const data = response.data;

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            sessionStorage.removeItem('multiEmpresaOpcoes');
            sessionStorage.removeItem('multiEmpresaCredenciais');
            sessionStorage.removeItem('multiEmpresaGoogle');

            router.push('/dashboard');
        } catch (err: any) {
            toast.current?.show({
                severity: 'error',
                summary: 'Erro',
                detail: err.message,
                life: 3000
            });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="surface-ground flex align-items-center justify-content-center min-h-screen min-w-screen overflow-hidden">
            <Toast ref={toast} />
            <div className="flex flex-column align-items-center" style={{ maxWidth: '460px', width: '100%', padding: '0 16px' }}>
                {/* Ícone */}
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <i className="pi pi-building" style={{ fontSize: '28px', color: 'white' }} />
                </div>

                <h2 className="font-bold m-0 mb-2" style={{ fontSize: '22px' }}>Selecione a empresa</h2>
                <p className="text-color-secondary text-center m-0 mb-4" style={{ fontSize: '14px' }}>
                    Sua conta está vinculada a mais de uma empresa.<br />Em qual deseja entrar agora?
                </p>

                <div className="w-full flex flex-column gap-3">
                    {empresas.map(emp => (
                        <div
                            key={emp.empresa_id}
                            onClick={() => loading === null && entrar(emp)}
                            style={{
                                padding: '16px 20px',
                                borderRadius: '10px',
                                border: '2px solid var(--surface-border)',
                                cursor: loading !== null ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                background: 'var(--surface-card)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                opacity: loading !== null && loading !== emp.empresa_id ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { if (loading === null) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--primary-color)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--surface-border)'; }}
                        >
                            <div className="flex align-items-center gap-3">
                                <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <i className="pi pi-building" style={{ color: 'white', fontSize: '18px' }} />
                                </div>
                                <div>
                                    <div className="font-semibold" style={{ fontSize: '15px' }}>{emp.nome}</div>
                                    <div className="text-color-secondary" style={{ fontSize: '12px' }}>{emp.cargo}</div>
                                </div>
                            </div>
                            {loading === emp.empresa_id
                                ? <i className="pi pi-spin pi-spinner" style={{ color: 'var(--primary-color)', fontSize: '18px' }} />
                                : <i className="pi pi-chevron-right" style={{ color: 'var(--text-color-secondary)', fontSize: '14px' }} />
                            }
                        </div>
                    ))}
                </div>

                <Button
                    label="Usar outra conta"
                    icon="pi pi-arrow-left"
                    text
                    className="mt-4"
                    onClick={() => { sessionStorage.removeItem('multiEmpresaOpcoes'); sessionStorage.removeItem('multiEmpresaCredenciais'); sessionStorage.removeItem('multiEmpresaGoogle'); router.push('/auth/login'); }}
                />
            </div>
        </div>
    );
};

export default SelecionarEmpresaPage;
