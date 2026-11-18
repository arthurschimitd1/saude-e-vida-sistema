'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DiagnosisAnswers, recommendPlan } from './diagnosisRules';

type Question = {
    key: keyof DiagnosisAnswers;
    title: string;
    options: { value: string; label: string; description: string }[];
};

const questions: Question[] = [
    {
        key: 'operation', title: 'Como é sua operação hoje?',
        options: [
            { value: 'one', label: 'Uma empresa, operação enxuta', description: 'Quero organizar o básico e ganhar controle.' },
            { value: 'team', label: 'Uma empresa com equipe', description: 'Preciso acompanhar pessoas e crescer com mais gestão.' },
            { value: 'complex', label: 'Múltiplas unidades ou operação complexa', description: 'Tenho processos diferentes ou preciso de uma solução específica.' },
        ],
    },
    {
        key: 'priority', title: 'Qual é sua prioridade agora?',
        options: [
            { value: 'operations', label: 'Operação e financeiro', description: 'Estoque, produção, pedidos, fornecedores e contas.' },
            { value: 'management', label: 'Gestão da equipe', description: 'Quero organizar também o departamento pessoal.' },
            { value: 'intelligence', label: 'Estratégia e relacionamento', description: 'Preciso de análises e WhatsApp CRM.' },
            { value: 'integrations', label: 'Integrações e processos próprios', description: 'Meu negócio precisa de adaptações além dos módulos prontos.' },
        ],
    },
    {
        key: 'implementation', title: 'Como você imagina a implantação?',
        options: [
            { value: 'standard', label: 'Padrão', description: 'Os módulos prontos atendem bem minha necessidade.' },
            { value: 'tailored', label: 'Sob medida', description: 'Preciso adaptar fluxos ou integrar ferramentas específicas.' },
        ],
    },
];

type DiagnosisPlan = {
    key: 'plano1' | 'plano2';
    name: string;
    monthly: number;
    annual: number;
    items: readonly string[];
};

type Props = { onClose: () => void; plans: readonly DiagnosisPlan[]; detailedDiagnosisUrl: string };

export default function PlanDiagnosis({ onClose, plans, detailedDiagnosisUrl }: Props) {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Partial<DiagnosisAnswers>>({});
    const [showAllFeatures, setShowAllFeatures] = useState(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const question = questions[step];
    const result = step === questions.length && answers.operation && answers.priority && answers.implementation
        ? recommendPlan(answers as DiagnosisAnswers) : null;
    const selectedPlan = result?.plan === 'personalizado' ? null : plans.find(plan => plan.key === result?.plan);
    const allFeatures = result?.plan === 'personalizado'
        ? ['Diagnóstico do seu negócio', 'Módulos e condições personalizados', 'Implantação alinhada à sua operação']
        : selectedPlan?.key === 'plano2'
            ? [...(plans.find(plan => plan.key === 'plano1')?.items ?? []), ...selectedPlan.items.filter(item => item !== 'Tudo do Plano Essencial')]
            : [...(selectedPlan?.items ?? [])];
    const highlights = result?.plan === 'plano1'
        ? ['Estoque', 'Produção', 'Financeiro completo', 'Relatórios de produtos']
        : result?.plan === 'plano2'
            ? ['Tudo do Plano Essencial', 'Departamento Pessoal (DP)', 'Estratégia', 'WhatsApp CRM']
            : allFeatures;
    const visibleFeatures = showAllFeatures ? allFeatures : highlights;
    const whatsappUrl = result
        ? `https://wa.me/5583998545395?text=${encodeURIComponent(`Olá! Fiz o diagnóstico na landing da Saúde e Vida e tenho interesse no ${result.title}. Gostaria de conversar sobre a solução personalizada.`)}`
        : '';

    useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [step]);

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key !== 'Tab') return;
            const dialog = closeRef.current?.closest('[role="dialog"]');
            const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
            if (!focusable?.length) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [onClose]);

    const choose = (value: string) => setAnswers(current => ({ ...current, [question.key]: value }));
    const goToPlan = () => {
        if (!result) return;
        onClose();
        window.setTimeout(() => document.getElementById(result.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    };

    return (
        <div className="diagnosis-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="diagnosis-title" aria-describedby="diagnosis-description" className="diagnosis-dialog">
                <div className="diagnosis-top">
                    <span className="diagnosis-kicker"><i className="pi pi-sparkles" aria-hidden="true" /> DIAGNÓSTICO SAÚDE E VIDA</span>
                    <button type="button" ref={closeRef} onClick={onClose} className="diagnosis-close" aria-label="Fechar diagnóstico">×</button>
                </div>
                <div ref={contentRef} className={`diagnosis-content ${result ? 'diagnosis-content-result' : ''}`}>
                    {!result && <>
                        <h2 id="diagnosis-title">Descubra o plano ideal para o seu negócio</h2>
                        <p id="diagnosis-description">Responda 3 perguntas rápidas. Sem cadastro e sem compromisso.</p>
                    </>}
                    {!result && question && (
                        <>
                            <div className="diagnosis-progress" aria-label={`Pergunta ${step + 1} de ${questions.length}`}>
                                {questions.map((_, index) => <span key={index} className={index <= step ? 'active' : ''} />)}
                            </div>
                            <div className="diagnosis-count">PERGUNTA {step + 1} DE {questions.length}</div>
                            <h3>{question.title}</h3>
                            <div className="diagnosis-options" role="radiogroup" aria-label={question.title}>
                                {question.options.map(option => (
                                    <button key={option.value} type="button" role="radio" aria-checked={answers[question.key] === option.value}
                                        onClick={() => choose(option.value)} className={`diagnosis-option ${answers[question.key] === option.value ? 'selected' : ''}`}>
                                        <span className="diagnosis-radio" aria-hidden="true" />
                                        <span><strong>{option.label}</strong><small>{option.description}</small></span>
                                    </button>
                                ))}
                            </div>
                            <div className="diagnosis-actions">
                                {step > 0 ? <button type="button" className="diagnosis-back" onClick={() => setStep(step - 1)}>Voltar</button> : <button type="button" className="diagnosis-back" onClick={onClose}>Agora não</button>}
                                <button type="button" className="diagnosis-primary" disabled={!answers[question.key]} onClick={() => setStep(step + 1)}>
                                    {step === questions.length - 1 ? 'Ver meu plano' : 'Continuar'} <i className="pi pi-arrow-right" aria-hidden="true" />
                                </button>
                            </div>
                        </>
                    )}
                    {result && (
                        <div className={`diagnosis-result diagnosis-result-${result.plan}`}>
                            <div className="diagnosis-result-intro">
                                <div className="diagnosis-result-badge"><i className="pi pi-check-circle" aria-hidden="true" /> PLANO INDICADO PARA VOCÊ</div>
                                <div className="diagnosis-count">{result.plan === 'personalizado' ? 'SOLUÇÃO PERSONALIZADA' : result.plan === 'plano2' ? 'PLANO 2' : 'PLANO 1'}</div>
                                <h2 id="diagnosis-title">{result.title}</h2>
                                <p id="diagnosis-description">{result.reason}</p>
                            </div>
                            <div className="diagnosis-price">
                                {selectedPlan ? (
                                    <>
                                        <span className="diagnosis-price-label">VALOR DO PLANO</span>
                                        <div><strong>R$ {selectedPlan.monthly.toLocaleString('pt-BR')}</strong><span>/mês</span></div>
                                        <small>Ou R$ {selectedPlan.annual.toLocaleString('pt-BR')} na contratação anual</small>
                                    </>
                                ) : (
                                    <>
                                        <span className="diagnosis-price-label">VALOR PERSONALIZADO</span>
                                        <div><strong>Sob consulta</strong></div>
                                        <small>Escopo e condições definidos após conversar com a equipe.</small>
                                    </>
                                )}
                            </div>
                            <div className="diagnosis-features">
                                <h4>{result.plan === 'personalizado' ? 'Como será montado' : 'Funcionalidades incluídas'}</h4>
                                <ul>
                                    {visibleFeatures.map(item => <li key={item}><i className="pi pi-check" aria-hidden="true" />{item}</li>)}
                                </ul>
                                {allFeatures.length > highlights.length && (
                                    <button type="button" className="diagnosis-more" onClick={() => setShowAllFeatures(value => !value)}>
                                        {showAllFeatures ? 'Mostrar principais funcionalidades' : `Ver todas as ${allFeatures.length} funcionalidades`}
                                    </button>
                                )}
                            </div>
                            <div className="diagnosis-result-links">
                                <button type="button" className="diagnosis-plan-link" onClick={goToPlan}>Ver detalhes do plano na página</button>
                                {result.plan === 'personalizado' && <a href={detailedDiagnosisUrl} target="_blank" rel="noopener noreferrer" className="diagnosis-plan-link">Realizar diagnóstico detalhado</a>}
                                <button type="button" className="diagnosis-back diagnosis-restart" onClick={() => { setStep(0); setAnswers({}); setShowAllFeatures(false); }}>Refazer respostas</button>
                            </div>
                        </div>
                    )}
                </div>
                {result && <div className="diagnosis-contact">
                    <div className="diagnosis-contact-label"><i className="pi pi-whatsapp" aria-hidden="true" /> CONTRATAÇÃO ASSISTIDA PELO WHATSAPP</div>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="diagnosis-whatsapp">
                        Conversar sobre {result.plan === 'personalizado' ? 'minha solução' : 'este plano'} <i className="pi pi-arrow-right" aria-hidden="true" />
                    </a>
                    <small>A equipe confirma as condições e orienta sobre o pagamento. Não há cobrança automática nesta página.</small>
                </div>}
            </div>
            <style>{`
                @keyframes diagnosisOverlayIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes diagnosisCardIn { from { opacity: 0; transform: translateY(20px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .diagnosis-overlay { position: fixed; inset: 0; z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(4,13,30,.72); backdrop-filter: blur(8px); font-family: Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; animation: diagnosisOverlayIn .42s ease-out both; }
                .diagnosis-dialog { width: 100%; max-width: 580px; max-height: min(760px, calc(100dvh - 36px)); display: flex; flex-direction: column; overflow: hidden; border-radius: 24px; background: #fff; box-shadow: 0 30px 90px rgba(4,13,30,.36); color: #0f172a; transform-origin: center center; animation: diagnosisCardIn .52s cubic-bezier(.22,1,.36,1) .05s both; }
                .diagnosis-top { background: linear-gradient(120deg,#0d1b2e,#1e40af); padding: 24px 30px; display: flex; justify-content: space-between; align-items: center; }
                .diagnosis-kicker { color: #bfdbfe; font-size: 12px; font-weight: 800; letter-spacing: .1em; display: inline-flex; gap: 8px; align-items: center; }
                .diagnosis-close { border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.12); color: #fff; width: 36px; height: 36px; border-radius: 10px; font-size: 23px; line-height: 1; cursor: pointer; }
                .diagnosis-content { padding: 30px; overflow-y: auto; min-height: 0; }
                .diagnosis-content-result { padding-top: 18px; padding-bottom: 18px; }
                .diagnosis-content h2 { font-size: clamp(23px,4vw,30px); line-height: 1.2; letter-spacing: -.025em; margin: 0 0 10px; }
                .diagnosis-content > p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
                .diagnosis-progress { display: flex; gap: 7px; margin-bottom: 24px; }
                .diagnosis-progress span { height: 5px; background: #e2e8f0; flex: 1; border-radius: 12px; }
                .diagnosis-progress span.active { background: #3b82f6; }
                .diagnosis-count { font-size: 11px; font-weight: 800; letter-spacing: .1em; color: #2563eb; margin-bottom: 9px; }
                .diagnosis-content h3 { font-size: 21px; line-height: 1.3; margin: 0 0 19px; }
                .diagnosis-options { display: grid; gap: 10px; }
                .diagnosis-option { width: 100%; text-align: left; display: flex; gap: 13px; align-items: flex-start; padding: 15px; background: #fff; border: 1.5px solid #dbe3ee; border-radius: 13px; cursor: pointer; color: #0f172a; font: inherit; }
                .diagnosis-option:hover { border-color: #93c5fd; background: #f8fbff; }
                .diagnosis-option.selected { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 2px rgba(37,99,235,.08); }
                .diagnosis-radio { width: 17px; height: 17px; flex: 0 0 17px; border-radius: 50%; border: 2px solid #94a3b8; margin-top: 2px; }
                .selected .diagnosis-radio { border: 5px solid #2563eb; }
                .diagnosis-option strong { display: block; font-size: 14px; margin-bottom: 4px; }
                .diagnosis-option small { display: block; color: #64748b; font-size: 12px; line-height: 1.5; }
                .diagnosis-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 26px; }
                .diagnosis-primary { border: 0; background: #2563eb; color: #fff; border-radius: 11px; padding: 13px 20px; min-height: 44px; font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 9px; }
                .diagnosis-primary:hover:not(:disabled) { background: #1d4ed8; }
                .diagnosis-primary:disabled { opacity: .45; cursor: not-allowed; }
                .diagnosis-back { border: 0; background: transparent; color: #475569; min-height: 44px; padding: 10px 4px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
                .diagnosis-result { border: 1px solid #dbeafe; border-radius: 18px; overflow: hidden; background: #fff; }
                .diagnosis-result-intro { padding: 23px 24px 20px; background: linear-gradient(135deg,#0d1b2e,#1e40af); color: #fff; }
                .diagnosis-result-personalizado .diagnosis-result-intro { background: linear-gradient(135deg,#0d1b2e,#6b3c13); }
                .diagnosis-result-badge { display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 100px; background: rgba(255,255,255,.14); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .07em; margin-bottom: 16px; }
                .diagnosis-result-intro .diagnosis-count { color: #bfdbfe; }
                .diagnosis-result-personalizado .diagnosis-result-intro .diagnosis-count { color: #fde68a; }
                .diagnosis-result-intro h2 { margin: 0 0 8px; font-size: 27px; color: #fff; }
                .diagnosis-result-intro p { margin: 0; color: rgba(255,255,255,.76); font-size: 13px; line-height: 1.55; }
                .diagnosis-price { padding: 19px 24px; background: #eff6ff; border-bottom: 1px solid #dbeafe; }
                .diagnosis-result-personalizado .diagnosis-price { background: #fff7ed; border-color: #ffedd5; }
                .diagnosis-price-label { color: #1d4ed8; font-size: 10px; font-weight: 800; letter-spacing: .1em; }
                .diagnosis-result-personalizado .diagnosis-price-label { color: #92400e; }
                .diagnosis-price div { display: flex; align-items: baseline; gap: 5px; margin: 5px 0 4px; }
                .diagnosis-price strong { color: #102a43; font-size: 30px; letter-spacing: -.035em; }
                .diagnosis-price div span { color: #64748b; font-size: 14px; }
                .diagnosis-price small { display: block; color: #475569; font-size: 12px; }
                .diagnosis-features { padding: 21px 24px; }
                .diagnosis-features h4 { margin: 0 0 13px; font-size: 14px; color: #102a43; }
                .diagnosis-features ul { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px 14px; }
                .diagnosis-features li { display: flex; align-items: flex-start; gap: 8px; color: #334155; font-size: 12px; line-height: 1.45; }
                .diagnosis-features li i { color: #2563eb; font-size: 12px; margin-top: 2px; flex-shrink: 0; }
                .diagnosis-more { margin-top: 14px; border: 0; background: transparent; color: #1d4ed8; padding: 4px 0; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
                .diagnosis-result-links { border-top: 1px solid #e2e8f0; padding: 14px 18px 10px; background: #f8fafc; text-align: center; }
                .diagnosis-contact { border-top: 1px solid #dbeafe; padding: 12px 24px 14px; background: #f8fafc; text-align: center; flex-shrink: 0; box-shadow: 0 -8px 20px rgba(15,23,42,.07); }
                .diagnosis-contact-label { display: flex; align-items: center; justify-content: center; gap: 7px; color: #1e3a5f; font-size: 10px; font-weight: 800; letter-spacing: .065em; margin-bottom: 10px; }
                .diagnosis-contact-label i { color: #16a34a; font-size: 16px; }
                .diagnosis-whatsapp { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 46px; border-radius: 11px; background: #1e3a5f; color: #fff; font-size: 14px; font-weight: 800; text-decoration: none; }
                .diagnosis-whatsapp:hover { background: #1d4ed8; }
                .diagnosis-contact small { display: block; color: #64748b; font-size: 11px; line-height: 1.45; margin: 8px 0 0; }
                .diagnosis-plan-link { display: inline-block; border: 0; background: transparent; color: #1d4ed8; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: underline; margin: 0 5px; }
                .diagnosis-restart { display: block; margin: 6px auto 0; }
                .diagnosis-dialog button:focus-visible, .diagnosis-dialog a:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
                @media (max-width: 600px) { .diagnosis-top { padding: 17px 20px; } .diagnosis-content { padding: 22px 20px; } .diagnosis-dialog { max-height: calc(100dvh - 24px); } .diagnosis-overlay { padding: 12px; } }
                @media (max-width: 460px) { .diagnosis-result-intro, .diagnosis-price, .diagnosis-features, .diagnosis-contact { padding-left: 18px; padding-right: 18px; } .diagnosis-features ul { grid-template-columns: 1fr; } }
                @media (prefers-reduced-motion: reduce) { .diagnosis-overlay, .diagnosis-dialog { animation: none; } }
            `}</style>
        </div>
    );
}
