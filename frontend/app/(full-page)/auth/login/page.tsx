/* eslint-disable @next/next/no-img-element */
'use client';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { Password } from 'primereact/password';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import api from '@/app/(main)/services/api/baseApi';

// Acesso temporário para desenvolvimento local quando o backend/PostgreSQL
// ainda não foi configurado. Nunca é habilitado em produção.
const LOCAL_DEMO_MODE = process.env.NODE_ENV !== 'production';
const LOCAL_DEMO_EMAIL = 'demo@saudeevida.local';
const LOCAL_DEMO_PASSWORD = 'demo123';

function startLocalDemoSession(email: string) {
    localStorage.setItem('token', 'local-demo-token');
    localStorage.setItem('user', JSON.stringify({
        id: 'local-demo-user',
        nome: 'Demonstração local',
        email,
        tipo: 'MASTER',
        empresa_id: 1,
        permissoes: [],
        modo_local: true,
    }));
    localStorage.setItem('modo_local', 'true');
}

const features = [
    { icon: 'pi-wallet',     label: 'Financeiro e fluxo de caixa em tempo real' },
    { icon: 'pi-chart-line', label: 'Relatórios e dashboards avançados' },
    { icon: 'pi-shield',     label: 'Segurança e conformidade total' },
];

const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: '10px',
    border: '1.5px solid #e5e7eb',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color .18s',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    fontFamily: '"Inter", -apple-system, sans-serif',
    color: '#111827',
};

const LoginPage = () => {
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading]   = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const toast = useRef<Toast>(null);
    const router = useRouter();

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const emailNormalizado = email.trim().toLowerCase();
        if (!emailNormalizado || !password) {
            toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Preencha todos os campos obrigatórios', life: 3000 });
            return;
        }

        // Conta local não depende de API nem de banco. Isso deixa a interface
        // navegável enquanto a infraestrutura de dados ainda está sendo preparada.
        if (
            LOCAL_DEMO_MODE &&
            emailNormalizado === LOCAL_DEMO_EMAIL &&
            password === LOCAL_DEMO_PASSWORD
        ) {
            startLocalDemoSession(emailNormalizado);
            router.replace('/central-gestao');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email: emailNormalizado, senha: password }, { skipAuthInterceptor: true } as any);
            const data = response.data;
            if (data.multiEmpresa) {
                sessionStorage.setItem('multiEmpresaOpcoes', JSON.stringify(data.empresas));
                sessionStorage.setItem('multiEmpresaCredenciais', JSON.stringify({ email: emailNormalizado, senha: password }));
                router.push('/auth/selecionar-empresa');
                return;
            }
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: 'Login realizado com sucesso', life: 3000 });
            // Recarrega a área autenticada para que o guard leia a sessão recém-salva.
            window.location.assign('/central-gestao');
        } catch (error: any) {
            // Permite testar a interface local sem banco. O modo é restrito ao
            // desenvolvimento e só aceita a conta de demonstração divulgada na tela.
            const isNetworkError = !error?.response;
            if (
                LOCAL_DEMO_MODE &&
                isNetworkError &&
                emailNormalizado === LOCAL_DEMO_EMAIL &&
                password === LOCAL_DEMO_PASSWORD
            ) {
                startLocalDemoSession(emailNormalizado);
                router.replace('/central-gestao');
                return;
            }
            toast.current?.show({ severity: 'error', summary: 'Erro', detail: error.message || 'Falha no login', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const form = (
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 6, fontFamily: '"Inter", -apple-system, sans-serif', letterSpacing: '.01em' }}>
                    E-mail
                </label>
                <InputText
                    type="email"
                    placeholder="seu@email.com.br"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    style={inputBase}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#16a34a')}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = '#e5e7eb')}
                />
            </div>

            <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 6, fontFamily: '"Inter", -apple-system, sans-serif', letterSpacing: '.01em' }}>
                    Senha
                </label>
                <Password
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    toggleMask
                    disabled={loading}
                    feedback={false}
                    pt={{
                        root:     { style: { width: '100%', display: 'block' } },
                        input:    { style: { ...inputBase, paddingRight: 44 } },
                        showIcon: { style: { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', cursor: 'pointer', zIndex: 10 } },
                    }}
                />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 28 }}>
                <span style={{ fontSize: '0.82rem', color: '#15803d', cursor: 'pointer', fontFamily: '"Inter", -apple-system, sans-serif', fontWeight: 500 }}>
                    Esqueceu sua senha?
                </span>
            </div>

            <button
                type="submit"
                disabled={loading}
                style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 10,
                    border: 'none',
                    background: loading ? '#86efac' : '#16a34a',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: '"Inter", -apple-system, sans-serif',
                    letterSpacing: '.01em',
                    transition: 'opacity .15s',
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
                {loading ? 'Entrando…' : 'Entrar'}
            </button>

        </form>
    );

    // ── MOBILE ──────────────────────────────────────────────────
    if (isMobile) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                <Toast ref={toast} position="top-right" />
                <div style={{ width: '100%', maxWidth: 420 }}>
                    <div style={{ marginBottom: 32, textAlign: 'center' }}>
                        <div style={{ fontSize: 25, fontWeight: 700, color: '#176044', marginBottom: 28 }}>✦ Saúde e Vida</div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em', fontFamily: '"Inter", -apple-system, sans-serif' }}>
                            Acesse sua conta
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, fontFamily: '"Inter", -apple-system, sans-serif' }}>
                            Bem-vindo de volta à Saúde e Vida
                        </p>
                    </div>
            {form}
                    {LOCAL_DEMO_MODE && (
                        <div style={{ marginTop: 18, padding: '11px 13px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.78rem', lineHeight: 1.5, fontFamily: '"Inter", -apple-system, sans-serif' }}>
                            <strong>Modo local temporário</strong><br />
                            E-mail: {LOCAL_DEMO_EMAIL}<br />
                            Senha: {LOCAL_DEMO_PASSWORD}
                            <a href="/central-gestao" onClick={() => startLocalDemoSession(LOCAL_DEMO_EMAIL)} style={{ display: 'inline-block', marginTop: 9, borderRadius: 7, padding: '8px 10px', background: '#166534', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'none' }}>
                                Entrar no modo local
                            </a>
                        </div>
                    )}
                    <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.75rem', marginTop: 36, fontFamily: '"Inter", -apple-system, sans-serif' }}>
                        © 2026 Saúde e Vida · Ambiente privado
                    </p>
                </div>
            </div>
        );
    }

    // ── DESKTOP ─────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', width: '100%', minHeight: '100vh', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' }}>
            <Toast ref={toast} position="top-right" />

            <style suppressHydrationWarning>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            `}</style>

            {/* ── LEFT – dark aurora ── */}
            <div style={{
                flex: '0 0 48%',
                background: 'linear-gradient(160deg, #052e16 0%, #064e3b 55%, #052e16 100%)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem',
            }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(74,222,128,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-15%', right: '-8%', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(34,197,94,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 10, maxWidth: 460, textAlign: 'center' }}>
                    <div style={{ fontSize: 25, fontWeight: 700, color: '#fff', marginBottom: 48 }}>✦ Saúde e Vida</div>

                    <h1 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 2.6vw, 2.6rem)', fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2, letterSpacing: '-0.022em' }}>
                        Gestão que multiplica<br />
                        <span style={{ color: '#bceac9' }}>seu equilíbrio.</span>
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 40px' }}>
                        Financeiro, CRM, RH e IA integrados.<br />Tudo que você precisa em um só lugar.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start', textAlign: 'left' }}>
                        {features.map((f, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <i className={`pi ${f.icon}`} style={{ color: '#93c5fd', fontSize: 15 }} />
                                </div>
                                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', fontWeight: 500 }}>{f.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 10, color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: 56 }}>
                    © 2026 Saúde e Vida · Ambiente privado
                </div>
            </div>

            {/* ── RIGHT – form ── */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f8fafc' }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: '48px 44px', boxShadow: '0 4px 32px rgba(0,0,0,0.07)', width: '100%', maxWidth: 440 }}>
                    <div style={{ marginBottom: 32, textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em', fontFamily: '"Inter", -apple-system, sans-serif' }}>
                            Acesse sua conta
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, fontFamily: '"Inter", -apple-system, sans-serif' }}>
                            Bem-vindo de volta à Saúde e Vida
                        </p>
                    </div>
                    {form}
                    {LOCAL_DEMO_MODE && (
                        <div style={{ marginTop: 18, padding: '11px 13px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.78rem', lineHeight: 1.5, fontFamily: '"Inter", -apple-system, sans-serif' }}>
                            <strong>Modo local temporário</strong><br />
                            E-mail: {LOCAL_DEMO_EMAIL}<br />
                            Senha: {LOCAL_DEMO_PASSWORD}
                            <a href="/central-gestao" onClick={() => startLocalDemoSession(LOCAL_DEMO_EMAIL)} style={{ display: 'inline-block', marginTop: 9, borderRadius: 7, padding: '8px 10px', background: '#166534', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'none' }}>
                                Entrar no modo local
                            </a>
                        </div>
                    )}
                    <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.75rem', marginTop: 36, fontFamily: '"Inter", -apple-system, sans-serif' }}>
                        © 2026 Saúde e Vida · Ambiente privado
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
