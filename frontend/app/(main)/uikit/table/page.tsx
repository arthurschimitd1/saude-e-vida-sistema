'use client';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { Toast } from 'primereact/toast';
import { classNames } from 'primereact/utils';
import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api/baseApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tipos de contrato disponíveis
const tiposContrato = [
    { label: 'CLT', value: 'CLT' },
    { label: 'PJ', value: 'PJ' },
    { label: 'Estágio', value: 'ESTAGIO' },
    { label: 'Contrato PF', value: 'FREELANCER' }
];

// Níveis de risco para RAT
const niveisRisco = [
    { label: 'Baixo (1%)', value: 1 },
    { label: 'Médio (2%)', value: 2 },
    { label: 'Alto (3%)', value: 3 }
];

// Departamentos
const departamentos = [
    'TI',
    'RH',
    'Financeiro',
    'Marketing',
    'Vendas',
    'Produção',
    'Logística'
];

// Status do funcionário
const statusOptions = [
    { label: 'ATIVO', value: 'ATIVO', color: 'success' },
    { label: 'FÉRIAS', value: 'FERIAS', color: 'warning' },
    { label: 'AFASTADO', value: 'AFASTADO', color: 'info' },
    { label: 'DEMITIDO', value: 'DEMITIDO', color: 'danger' }
];

// Tipo de jornada
const jornadaOptions = [
    { label: 'Presencial', value: 'PRESENCIAL' },
    { label: 'Home Office', value: 'HOME_OFFICE' },
    { label: 'Híbrido', value: 'HIBRIDO' }
];

// Interface para histórico salarial
interface HistoricoSalario {
    data: string;
    salarioAnterior: number;
    novoSalario: number;
    usuario: string;
}

interface HistoricoPromocao {
    id: string;
    data: string;
    cargoAnterior: string;
    cargoNovo: string;
    salarioAnterior: number;
    salarioNovo: number;
    motivo?: string;
}

interface PagamentoSalario {
    id: string;
    competencia: string; // "MM/YYYY"
    dataPagamento: string;
    salarioBruto: number;
    inssDesconto: number;
    irrfDesconto: number;
    salarioLiquido: number;
    observacao?: string;
}

interface HistoricoFerias {
    id: string;
    dataInicio: string;
    dataFim: string;
    diasGozados: number;
    diasVendidos: number;
    salarioFerias: number;
    adicionalTerco: number;
    abonoPecuniario: number;
    inssDesconto: number;
    irrfDesconto: number;
    totalReceber: number;
    registradoEm: string;
}

// Interface para o funcionário estendida
interface Funcionario {
    id?: number;
    nomeCompleto: string;
    cpf?: string;
    cargo: string;
    tipoContrato: string;
    salarioBruto: number | null;
    cargaHoraria: number | null;
    dataAdmissao: Date | null;
    nivelRisco: number;
    departamento: string;
    status: string;
    dependentes: number;
    gestorResponsavel: string;
    tipoJornada: string;
    observacoes: string;
    historicoSalarios: HistoricoSalario[];
    historicoPagamentos?: PagamentoSalario[];
    historicoPromocoes?: HistoricoPromocao[];
    historicoFerias?: HistoricoFerias[];
    dataPagamento?: string;
    beneficios: {
        valeTransporte: boolean;
        valeTransporteValor: number | null;
        valeRefeicao: boolean;
        valeRefeicaoValor: number | null;
        planoSaude: boolean;
        planoSaudeValor: number | null;
        planoOdontologico: boolean;
        planoOdontologicoValor: number | null;
        outros: string;
        outrosValor: number | null;
    };
    custos?: {
        inssPatronal: number;
        rat: number;
        terceiros: number;
        fgts: number;
        decimoTerceiro: number;
        ferias: number;
        totalBeneficios: number;
        custoTotalMensal: number;
        custoTotalAnual: number;
    };
}

// Funções de cálculo
const calcularEncargosCLT = (salarioBruto: number, nivelRisco: number) => {
    const inssPatronal = salarioBruto * 0.20;
    const rat = salarioBruto * (nivelRisco / 100);
    const terceiros = salarioBruto * 0.058;
    const fgts = salarioBruto * 0.08;
    const decimoTerceiro = salarioBruto * (1 / 12);
    const ferias = salarioBruto * (1 / 12 + 1 / 36);
    
    return { inssPatronal, rat, terceiros, fgts, decimoTerceiro, ferias };
};

const calcularTotalBeneficios = (beneficios: any) => {
    return (beneficios.valeTransporteValor || 0) +
           (beneficios.valeRefeicaoValor || 0) +
           (beneficios.planoSaudeValor || 0) +
           (beneficios.planoOdontologicoValor || 0) +
           (beneficios.outrosValor || 0);
};

const calcularCustoMensal = (salarioBruto: number, tipoContrato: string, nivelRisco: number, beneficios: any) => {
    if (tipoContrato !== 'CLT') {
        const totalBeneficios = calcularTotalBeneficios(beneficios);
        return salarioBruto + totalBeneficios;
    }
    
    const encargos = calcularEncargosCLT(salarioBruto, nivelRisco);
    const totalBeneficios = calcularTotalBeneficios(beneficios);
    
    return salarioBruto + encargos.inssPatronal + encargos.rat + encargos.terceiros + 
           encargos.fgts + encargos.decimoTerceiro + encargos.ferias + totalBeneficios;
};

const calcularCustoAnual = (custoMensal: number) => {
    return custoMensal * 12;
};

// INSS do empregado (tabela 2024)
const calcularINSS = (salario: number): number => {
    if (salario <= 1412.00) return salario * 0.075;
    if (salario <= 2666.68) return salario * 0.09;
    if (salario <= 4000.03) return salario * 0.12;
    if (salario <= 7786.02) return salario * 0.14;
    return 1083.91; // teto
};

// IRRF (tabela 2024)
const calcularIRRF = (baseCalculo: number, dependentes: number): number => {
    const deducaoDependente = dependentes * 189.59;
    const base = baseCalculo - deducaoDependente;
    if (base <= 2259.20) return 0;
    if (base <= 2826.65) return base * 0.075 - 169.44;
    if (base <= 3751.05) return base * 0.15 - 381.44;
    if (base <= 4664.68) return base * 0.225 - 662.77;
    return base * 0.275 - 896.00;
};

// Cálculo de férias CLT
const calcularFeriasCLT = (salarioBruto: number, diasGozados: number, diasVendidos: number, dependentes: number, tipoContrato: string) => {
    const salarioDia = salarioBruto / 30;

    // Férias gozadas
    const valorFeriasGozadas = salarioDia * diasGozados;
    const adicionalTercoGozado = valorFeriasGozadas / 3;
    const subtotalGozado = valorFeriasGozadas + adicionalTercoGozado;

    // Abono pecuniário (dias vendidos)
    const valorAbono = salarioDia * diasVendidos;
    const adicionalTercoAbono = valorAbono / 3;
    const subtotalAbono = valorAbono + adicionalTercoAbono;

    const totalBruto = subtotalGozado + subtotalAbono;
    const adicionalTercoTotal = adicionalTercoGozado + adicionalTercoAbono;

    let inssDesconto = 0;
    let irrfDesconto = 0;

    if (tipoContrato === 'CLT') {
        inssDesconto = calcularINSS(totalBruto);
        const baseIrrf = totalBruto - inssDesconto;
        irrfDesconto = calcularIRRF(baseIrrf, dependentes);
    }
    // Estagiário: sem descontos

    return {
        valorFeriasGozadas,
        adicionalTercoTotal,
        abonoPecuniario: subtotalAbono,
        totalBruto,
        inssDesconto,
        irrfDesconto,
        totalReceber: totalBruto - inssDesconto - irrfDesconto,
    };
};

// Calcular meses trabalhados desde admissão
const mesesTrabalhados = (dataAdmissao: Date | string | null): number => {
    if (!dataAdmissao) return 0;
    const admissao = new Date(dataAdmissao);
    const hoje = new Date();
    return (hoje.getFullYear() - admissao.getFullYear()) * 12 + (hoje.getMonth() - admissao.getMonth());
};

const CustosFuncionariosPage = () => {
    const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
    const [funcionarioDialog, setFuncionarioDialog] = useState(false);
    const [visualizarDialog, setVisualizarDialog] = useState(false);
    const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<Funcionario | null>(null);
    const [funcionario, setFuncionario] = useState<Funcionario>({
        nomeCompleto: '',
        cpf: '',
        cargo: '',
        tipoContrato: 'CLT',
        salarioBruto: null,
        cargaHoraria: null,
        dataAdmissao: null,
        nivelRisco: 1,
        departamento: '',
        status: 'ATIVO',
        dependentes: 0,
        gestorResponsavel: '',
        tipoJornada: 'PRESENCIAL',
        observacoes: '',
        historicoSalarios: [],
        beneficios: {
            valeTransporte: false,
            valeTransporteValor: null,
            valeRefeicao: false,
            valeRefeicaoValor: null,
            planoSaude: false,
            planoSaudeValor: null,
            planoOdontologico: false,
            planoOdontologicoValor: null,
            outros: '',
            outrosValor: null
        }
    });
    const [submitted, setSubmitted] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeAccordion, setActiveAccordion] = useState<number[]>([0]);
    const toast = useRef<Toast>(null);

    // Promoção
    const [promocaoDialog, setPromocaoDialog] = useState(false);
    const [promocaoFuncionario, setPromocaoFuncionario] = useState<Funcionario | null>(null);
    const [promocaoForm, setPromocaoForm] = useState({ cargoNovo: '', salarioNovo: null as number | null, motivo: '' });
    const [histPromocaoDialog, setHistPromocaoDialog] = useState(false);

    // Pagamento
    const [pagamentoDialog, setPagamentoDialog] = useState(false);
    const [pagamentoFuncionario, setPagamentoFuncionario] = useState<Funcionario | null>(null);
    const [pagamentoForm, setPagamentoForm] = useState({ competencia: '', dataPagamento: '', observacao: '' });
    const [histPagamentoDialog, setHistPagamentoDialog] = useState(false);

    // Férias
    const [feriasDialog, setFeriasDialog] = useState(false);
    const [feriasFuncionario, setFeriasFuncionario] = useState<Funcionario | null>(null);
    const [feriasForm, setFeriasForm] = useState({ dataInicio: '', diasGozados: 30, diasVendidos: 0 });
    const [histFeriasDialog, setHistFeriasDialog] = useState(false);

    // Autenticação MASTER
    const [autenticado, setAutenticado] = useState(false);
    const [isMasterUser, setIsMasterUser] = useState(false);
    const [senhaInput, setSenhaInput] = useState('');
    const [senhaErro, setSenhaErro] = useState(false);
    const [senhaDialog, setSenhaDialog] = useState(false);
    
    // Importar de usuários do sistema
    const [importarDialog, setImportarDialog] = useState(false);
    const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
    const [usuarioImportBusca, setUsuarioImportBusca] = useState('');

    // Filtros
    const [filtroDepartamento, setFiltroDepartamento] = useState('');
    const [filtroTipoContrato, setFiltroTipoContrato] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [filtroSalarioMin, setFiltroSalarioMin] = useState<number | null>(null);
    const [filtroSalarioMax, setFiltroSalarioMax] = useState<number | null>(null);

    // Função para formatar CPF
    const formatarCPF = (cpf: string) => {
        if (!cpf) return null;
        const numeros = cpf.replace(/\D/g, '');
        if (numeros.length !== 11) return null;
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    // Formatar data
    const formatarData = (data: Date | string | null) => {
        if (!data) return 'Não informada';
        const d = new Date(data);
        if (isNaN(d.getTime())) return 'Data inválida';
        return d.toLocaleDateString('pt-BR');
    };

    // Formatar moeda de forma segura
    const formatCurrency = (value: number | string | null | undefined) => {
        let numValue = 0;
        if (typeof value === 'number') {
            numValue = value;
        } else if (typeof value === 'string') {
            numValue = parseFloat(value) || 0;
        } else if (value === null || value === undefined) {
            numValue = 0;
        } else {
            numValue = Number(value) || 0;
        }
        
        if (isNaN(numValue)) return 'R$ 0,00';
        return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Função para calcular o custo mensal real incluindo benefícios
    const calcularCustoMensalReal = (funcionario: Funcionario): number => {
        const salario = typeof funcionario.salarioBruto === 'number' ? funcionario.salarioBruto : Number(funcionario.salarioBruto) || 0;
        
        // Calcular total de benefícios
        const beneficios = funcionario.beneficios || {
            valeTransporte: false, valeTransporteValor: null,
            valeRefeicao: false, valeRefeicaoValor: null,
            planoSaude: false, planoSaudeValor: null,
            planoOdontologico: false, planoOdontologicoValor: null,
            outros: '', outrosValor: null
        };
        
        const totalBeneficios = (beneficios.valeTransporteValor || 0) +
                               (beneficios.valeRefeicaoValor || 0) +
                               (beneficios.planoSaudeValor || 0) +
                               (beneficios.planoOdontologicoValor || 0) +
                               (beneficios.outrosValor || 0);
        
        // Se for CLT, calcular encargos
        if (funcionario.tipoContrato === 'CLT') {
            const nivelRisco = funcionario.nivelRisco || 1;
            const inssPatronal = salario * 0.20;
            const rat = salario * (nivelRisco / 100);
            const terceiros = salario * 0.058;
            const fgts = salario * 0.08;
            const decimoTerceiro = salario * (1 / 12);
            const ferias = salario * (1 / 12 + 1 / 36);
            
            return salario + inssPatronal + rat + terceiros + fgts + decimoTerceiro + ferias + totalBeneficios;
        }
        
        // Para PJ e outros, apenas salário + benefícios
        return salario + totalBeneficios;
    };

    // Calcular métricas para dashboard
    const calcularMetricas = () => {
        const total = funcionarios.length;
        const clt = funcionarios.filter(f => f.tipoContrato === 'CLT').length;
        const pj = funcionarios.filter(f => f.tipoContrato === 'PJ').length;
        const folhaSalarial = funcionarios.reduce((acc, f) => {
            const salario = typeof f.salarioBruto === 'number' ? f.salarioBruto : Number(f.salarioBruto) || 0;
            return acc + salario;
        }, 0);
        const custoTotal = funcionarios.reduce((acc, f) => acc + calcularCustoMensalReal(f), 0);
        
        return { total, clt, pj, folhaSalarial, custoTotal };
    };

    // Carregar funcionários do backend
    const fetchFuncionarios = async () => {
        setLoading(true);
        try {
            const params: Record<string, any> = {};
            try {
                const u = JSON.parse(localStorage.getItem('user') ?? '{}');
                const isMaster = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
                const empresaSelecionada = localStorage.getItem('empresa_selecionada');
                if (isMaster && empresaSelecionada) {
                    params.empresa_id = Number(empresaSelecionada);
                } else if (u?.empresa_id) {
                    params.empresa_id = u.empresa_id;
                }
            } catch {}
            const response = await api.get('/funcionarios-custos', { params });
            const data = response.data || [];
            const dataFormatada = data.map((f: any) => ({
                ...f,
                salarioBruto: f.salarioBruto ? (typeof f.salarioBruto === 'number' ? f.salarioBruto : parseFloat(String(f.salarioBruto).replace(',', '.')) || 0) : 0,
                beneficios: f.beneficios || {
                    valeTransporte: false, valeTransporteValor: null,
                    valeRefeicao: false, valeRefeicaoValor: null,
                    planoSaude: false, planoSaudeValor: null,
                    planoOdontologico: false, planoOdontologicoValor: null,
                    outros: '', outrosValor: null
                }
            }));
            setFuncionarios(dataFormatada);
        } catch (error: any) {
            showError(error.response?.data?.error || 'Erro ao carregar funcionários');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            const master = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
            setIsMasterUser(master);
            if (master) {
                setSenhaDialog(true);
            } else {
                setAutenticado(true);
                fetchFuncionarios();
            }
        } catch {
            setAutenticado(true);
            fetchFuncionarios();
        }

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'empresa_selecionada') fetchFuncionarios();
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const confirmarSenha = () => {
        if (senhaInput === 'master123') {
            setAutenticado(true);
            setSenhaDialog(false);
            setSenhaErro(false);
            fetchFuncionarios();
        } else {
            setSenhaErro(true);
            setSenhaInput('');
        }
    };

    const showSuccess = (message: string) => {
        toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: message, life: 3000 });
    };

    const showError = (message: string) => {
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: message, life: 5000 });
    };

    const openNew = () => {
        setFuncionario({
            nomeCompleto: '',
            cpf: '',
            cargo: '',
            tipoContrato: 'CLT',
            salarioBruto: null,
            cargaHoraria: null,
            dataAdmissao: null,
            nivelRisco: 1,
            departamento: '',
            status: 'ATIVO',
            dependentes: 0,
            gestorResponsavel: '',
            tipoJornada: 'PRESENCIAL',
            observacoes: '',
            historicoSalarios: [],
            beneficios: {
                valeTransporte: false,
                valeTransporteValor: null,
                valeRefeicao: false,
                valeRefeicaoValor: null,
                planoSaude: false,
                planoSaudeValor: null,
                planoOdontologico: false,
                planoOdontologicoValor: null,
                outros: '',
                outrosValor: null
            }
        });
        setSubmitted(false);
        setActiveAccordion([0]);
        setFuncionarioDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setFuncionarioDialog(false);
    };

    const abrirImportar = async () => {
        try {
            const res = await api.get('/users');
            const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
            // Filtra usuários que ainda não foram cadastrados em funcionarios-custos
            const nomesExistentes = new Set(funcionarios.map((f: any) => (f.nomeCompleto || '').toLowerCase()));
            const disponiveis = data.filter((u: any) => {
                const nome = (u.nomeCompleto || u.nome || '').toLowerCase();
                return nome && !nomesExistentes.has(nome);
            });
            setUsuariosSistema(disponiveis);
            setUsuarioImportBusca('');
            setImportarDialog(true);
        } catch {
            showError('Erro ao carregar usuários');
        }
    };

    const importarUsuario = (u: any) => {
        const nome = u.nomeCompleto || u.nome || '';
        setFuncionario({
            nomeCompleto: nome,
            cpf: u.cpf || '',
            cargo: u.cargo || '',
            tipoContrato: 'CLT',
            salarioBruto: null,
            cargaHoraria: null,
            dataAdmissao: null,
            nivelRisco: 1,
            departamento: '',
            status: 'ATIVO',
            dependentes: 0,
            gestorResponsavel: '',
            tipoJornada: 'PRESENCIAL',
            observacoes: '',
            historicoSalarios: [],
            beneficios: {
                valeTransporte: false, valeTransporteValor: null,
                valeRefeicao: false, valeRefeicaoValor: null,
                planoSaude: false, planoSaudeValor: null,
                planoOdontologico: false, planoOdontologicoValor: null,
                outros: '', outrosValor: null
            }
        });
        setImportarDialog(false);
        setSubmitted(false);
        setActiveAccordion([0]);
        setFuncionarioDialog(true);
    };

    const hideVisualizarDialog = () => {
        setVisualizarDialog(false);
        setFuncionarioSelecionado(null);
    };

    const visualizarFuncionario = (funcionarioItem: Funcionario) => {
        setFuncionarioSelecionado(funcionarioItem);
        setVisualizarDialog(true);
    };

    const saveFuncionario = async () => {
        setSubmitted(true);

        if (!funcionario.nomeCompleto || !funcionario.cargo || !funcionario.tipoContrato) {
            showError('Preencha os campos obrigatórios: Nome, Cargo e Tipo de Contrato');
            return;
        }

        try {
            const totalBeneficios = calcularTotalBeneficios(funcionario.beneficios);
            let custosCalculados = {};
            
            if (funcionario.tipoContrato === 'CLT') {
                const encargos = calcularEncargosCLT(funcionario.salarioBruto || 0, funcionario.nivelRisco);
                const custoMensal = calcularCustoMensal(funcionario.salarioBruto || 0, funcionario.tipoContrato, funcionario.nivelRisco, funcionario.beneficios);
                custosCalculados = {
                    ...encargos,
                    totalBeneficios,
                    custoTotalMensal: custoMensal,
                    custoTotalAnual: custoMensal * 12
                };
            } else {
                custosCalculados = {
                    inssPatronal: 0,
                    rat: 0,
                    terceiros: 0,
                    fgts: 0,
                    decimoTerceiro: 0,
                    ferias: 0,
                    totalBeneficios,
                    custoTotalMensal: (funcionario.salarioBruto || 0) + totalBeneficios,
                    custoTotalAnual: ((funcionario.salarioBruto || 0) + totalBeneficios) * 12
                };
            }

            const getEmpresaIdLocal = (): number | null => {
                try {
                    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
                    const isMaster = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
                    const sel = localStorage.getItem('empresa_selecionada');
                    if (isMaster && sel) return Number(sel);
                    return u?.empresa_id ?? null;
                } catch { return null; }
            };

            const payload = {
                nomeCompleto: funcionario.nomeCompleto,
                cpf: funcionario.cpf ? formatarCPF(funcionario.cpf) : null,
                cargo: funcionario.cargo,
                tipoContrato: funcionario.tipoContrato,
                salarioBruto: funcionario.salarioBruto || 0,
                cargaHoraria: funcionario.cargaHoraria || 0,
                nivelRisco: funcionario.nivelRisco || 1,
                departamento: funcionario.departamento || null,
                dataAdmissao: funcionario.dataAdmissao ? funcionario.dataAdmissao.toISOString().split('T')[0] : null,
                status: funcionario.status,
                dependentes: funcionario.dependentes || 0,
                gestorResponsavel: funcionario.gestorResponsavel || null,
                tipoJornada: funcionario.tipoJornada,
                observacoes: funcionario.observacoes || null,
                beneficios: funcionario.beneficios,
                custos: custosCalculados,
                empresa_id: getEmpresaIdLocal()
            };

            if (funcionario.id) {
                await api.put(`/funcionarios-custos/${funcionario.id}`, payload);
            } else {
                await api.post('/funcionarios-custos', payload);
            }

            showSuccess(funcionario.id ? 'Funcionário atualizado com sucesso!' : 'Funcionário cadastrado com sucesso!');
            await fetchFuncionarios();
            setFuncionarioDialog(false);
        } catch (error: any) {
            showError(error.message || 'Erro ao salvar funcionário');
        }
    };

    const editFuncionario = async (funcionarioItem: Funcionario) => {
        try {
            const response = await api.get(`/funcionarios-custos/${funcionarioItem.id}`);
            const data = response.data;
            setFuncionario({
                ...data,
                salarioBruto: data.salarioBruto ? (typeof data.salarioBruto === 'number' ? data.salarioBruto : parseFloat(String(data.salarioBruto).replace(',', '.')) || 0) : 0,
                dataAdmissao: data.dataAdmissao ? new Date(data.dataAdmissao) : null
            });
            setActiveAccordion([0]);
            setFuncionarioDialog(true);
        } catch (error: any) {
            showError(error.response?.data?.error || 'Erro ao carregar dados do funcionário');
        }
    };

    const deleteFuncionario = async (funcionarioItem: Funcionario) => {
        try {
            await api.delete(`/funcionarios-custos/${funcionarioItem.id}`);
            showSuccess('Funcionário removido com sucesso');
            fetchFuncionarios();
        } catch (error: any) {
            showError(error.response?.data?.error || 'Erro ao remover funcionário');
        }
    };

    const confirmDelete = (funcionarioItem: Funcionario) => {
        if (window.confirm(`Deseja realmente excluir o funcionário "${funcionarioItem.nomeCompleto}"?`)) {
            deleteFuncionario(funcionarioItem);
        }
    };

    const onInputChange = (e: any, field: string) => {
        const newValue = e.target ? e.target.value : e.value;
        setFuncionario(prev => ({ ...prev, [field]: newValue }));
    };

    const onNumberChange = (e: any, field: string) => {
        setFuncionario(prev => ({ ...prev, [field]: e.value }));
    };

    const onDateChange = (e: any, field: string) => {
        setFuncionario(prev => ({ ...prev, [field]: e.value }));
    };

    const onBeneficioChange = (e: any, field: string) => {
        setFuncionario(prev => ({
            ...prev,
            beneficios: { ...prev.beneficios, [field]: e.checked }
        }));
    };

    const onBeneficioValorChange = (e: any, field: string) => {
        setFuncionario(prev => ({
            ...prev,
            beneficios: { ...prev.beneficios, [field]: e.value }
        }));
    };

    const onBeneficioTextChange = (e: any, field: string) => {
        setFuncionario(prev => ({
            ...prev,
            beneficios: { ...prev.beneficios, [field]: e.target.value }
        }));
    };

    const onObservacoesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFuncionario(prev => ({ ...prev, observacoes: e.target.value }));
    };

    const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGlobalFilter(e.target.value);
    };

    // Gerar contracheque PDF
    const gerarContracheque = (funcionarioItem: Funcionario) => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        // A4 landscape: 297 × 210 mm
        const PW = 297, PH = 210;
        const isEstagio = funcionarioItem.tipoContrato === 'ESTAGIO';
        const salarioBruto = typeof funcionarioItem.salarioBruto === 'number' ? funcionarioItem.salarioBruto : Number(funcionarioItem.salarioBruto) || 0;

        const inssDesc = isEstagio ? 0 : calcularINSS(salarioBruto);
        const baseIrrf = salarioBruto - inssDesc;
        const irrfDesc = isEstagio ? 0 : calcularIRRF(baseIrrf, funcionarioItem.dependentes || 0);
        const liquido = salarioBruto - inssDesc - irrfDesc;

        const competencia = funcionarioItem.dataPagamento || `${String(new Date().getMonth()+1).padStart(2,'0')}/${new Date().getFullYear()}`;

        // ── Right strip (signature) ──────────────────────────────────────────
        const stripX = 235;
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(stripX, 0, stripX, PH);

        // Rotated text in strip
        doc.saveGraphicsState();
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text('DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO.', PH/2, PW - 8, { angle: 90, align: 'center' });
        doc.text('ASSINATURA DO FUNCIONÁRIO', PH/2, PW - 18, { angle: 90, align: 'center' });
        doc.line(PH/2 - 25, PW - 20, PH/2 + 25, PW - 20);
        doc.text('DATA', PH/2, PW - 26, { angle: 90, align: 'center' });
        doc.text('___ / ___ / ______', PH/2 - 5, PW - 28, { angle: 90 });
        doc.restoreGraphicsState();

        // ── Header: EMPREGADOR (left) + Title (right center) ──────────────────
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('EMPREGADOR', 5, 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('Nome', 5, 13);
        doc.text('Endereço', 5, 17);
        doc.text('CNPJ', 5, 21);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Recibo de Pagamento de Salário', 155, 12, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Referente ao Mês / Ano: ${competencia}`, 155, 18, { align: 'center' });

        // ── Line separator ─────────────────────────────────────────────────────
        doc.setLineWidth(0.5);
        doc.line(5, 24, 232, 24);

        // ── Employee info row ──────────────────────────────────────────────────
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('CÓDIGO', 5, 28);
        doc.text('NOME DO FUNCIONÁRIO', 28, 28);
        doc.text('CBO', 145, 28);
        doc.text('FUNÇÃO', 175, 28);

        doc.setLineWidth(0.3);
        doc.rect(5, 24, 22, 10);  // código box
        doc.rect(27, 24, 116, 10); // nome box
        doc.rect(143, 24, 30, 10); // cbo box
        doc.rect(173, 24, 59, 10); // função box

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const codStr = String(funcionarioItem.id || '000').padStart(5, '0');
        doc.text(codStr, 16, 31, { align: 'center' });
        doc.text(funcionarioItem.nomeCompleto || '', 29, 31);
        doc.setFont('helvetica', 'bold');
        doc.text(funcionarioItem.cargo || '', 175, 31);

        // ── Items table header ─────────────────────────────────────────────────
        const tY = 35;
        doc.setFillColor(240, 240, 240);
        doc.rect(5, tY, 227, 6, 'FD');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Cód.', 7, tY + 4);
        doc.text('Descrição', 22, tY + 4);
        doc.text('Referência', 130, tY + 4);
        doc.text('Proventos', 163, tY + 4);
        doc.text('Descontos', 197, tY + 4);

        // ── Table rows ─────────────────────────────────────────────────────────
        const rows = [
            { cod: '001', desc: 'SALÁRIO BASE', ref: `${funcionarioItem.cargaHoraria || 220}:00`, provento: salarioBruto, desconto: null },
            { cod: '400', desc: 'COMISSÃO', ref: '', provento: null, desconto: null },
            { cod: '420', desc: 'REPOUSO SEMANAL REMUNERADO', ref: '', provento: 0, desconto: null },
            ...(!isEstagio ? [{ cod: '903', desc: 'INSS', ref: '', provento: null, desconto: inssDesc }] : []),
            ...(!isEstagio && irrfDesc > 0 ? [{ cod: '904', desc: 'IRRF', ref: '', provento: null, desconto: irrfDesc }] : []),
            ...(isEstagio ? [{ cod: '---', desc: 'ESTÁGIO — SEM DESCONTOS PREVIDENCIÁRIOS', ref: '', provento: null, desconto: null }] : []),
        ];

        let rowY = tY + 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const totalRows = 12;
        for (let i = 0; i < totalRows; i++) {
            const row = rows[i];
            const lineY = rowY + i * 7;
            doc.setLineWidth(0.1);
            doc.line(5, lineY + 6, 232, lineY + 6);
            if (row) {
                doc.setFont('helvetica', 'bold');
                doc.text(row.cod, 7, lineY + 4);
                doc.setFont('helvetica', 'normal');
                doc.text(row.desc, 22, lineY + 4);
                if (row.ref) doc.text(row.ref, 130, lineY + 4);
                if (row.provento != null) doc.text(formatCurrency(row.provento), 185, lineY + 4, { align: 'right' });
                if (row.desconto != null) doc.text(formatCurrency(row.desconto), 230, lineY + 4, { align: 'right' });
            }
        }

        // ── Summary ────────────────────────────────────────────────────────────
        const sumY = rowY + totalRows * 7;
        doc.setLineWidth(0.4);
        doc.line(5, sumY, 232, sumY);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text('MENSAGENS', 7, sumY + 4);
        doc.text('Total dos Vencimentos', 140, sumY + 4);
        doc.text('Total dos Descontos', 185, sumY + 4);
        doc.line(137, sumY, 137, sumY + 14);
        doc.line(182, sumY, 182, sumY + 14);
        doc.setFont('helvetica', 'normal');
        doc.text(formatCurrency(salarioBruto), 172, sumY + 10, { align: 'right' });
        doc.text(formatCurrency(inssDesc + irrfDesc), 230, sumY + 10, { align: 'right' });

        doc.setLineWidth(0.4);
        doc.line(5, sumY + 14, 232, sumY + 14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Líquido a Receber:', 140, sumY + 20);
        doc.text(formatCurrency(liquido), 230, sumY + 20, { align: 'right' });

        // ── Bottom info ────────────────────────────────────────────────────────
        doc.setLineWidth(0.4);
        doc.line(5, sumY + 24, 232, sumY + 24);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        const labels = ['Salário Base', 'Base Cálc. INSS', 'Base Cálc. FGTS', 'FGTS do Mês', 'Base Cálc. IRRF', 'Faixa IRRF'];
        const vals = [
            formatCurrency(salarioBruto),
            formatCurrency(isEstagio ? 0 : salarioBruto),
            formatCurrency(isEstagio ? 0 : salarioBruto),
            formatCurrency(isEstagio ? 0 : salarioBruto * 0.08),
            formatCurrency(isEstagio ? 0 : baseIrrf),
            isEstagio ? 'Isento' : (baseIrrf <= 2259.20 ? 'Isento' : baseIrrf <= 2826.65 ? '7,5%' : baseIrrf <= 3751.05 ? '15%' : baseIrrf <= 4664.68 ? '22,5%' : '27,5%'),
        ];
        const colW = 38;
        labels.forEach((lbl, i) => {
            const cx = 5 + i * colW;
            doc.text(lbl, cx + 1, sumY + 28);
            doc.setFont('helvetica', 'normal');
            doc.text(vals[i], cx + 1, sumY + 33);
            doc.setFont('helvetica', 'bold');
            if (i < 5) doc.line(cx + colW, sumY + 24, cx + colW, sumY + 36);
        });
        doc.line(5, sumY + 36, 232, sumY + 36);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('1ª VIA - EMPREGADOR', 7, sumY + 41);

        doc.save(`holerite_${funcionarioItem.nomeCompleto.replace(/\s/g,'_')}_${competencia.replace('/','_')}.pdf`);
    };

    // Promoção
    const abrirPromocaoDialog = (f: Funcionario) => {
        setPromocaoFuncionario(f);
        setPromocaoForm({ cargoNovo: f.cargo, salarioNovo: f.salarioBruto, motivo: '' });
        setPromocaoDialog(true);
    };

    const confirmarPromocao = async () => {
        if (!promocaoFuncionario || !promocaoForm.cargoNovo || !promocaoForm.salarioNovo) {
            showError('Preencha cargo e salário');
            return;
        }
        const novaPromocao: HistoricoPromocao = {
            id: Date.now().toString(),
            data: new Date().toISOString().split('T')[0],
            cargoAnterior: promocaoFuncionario.cargo,
            cargoNovo: promocaoForm.cargoNovo,
            salarioAnterior: promocaoFuncionario.salarioBruto || 0,
            salarioNovo: promocaoForm.salarioNovo,
            motivo: promocaoForm.motivo,
        };
        const historicoAtual = promocaoFuncionario.historicoPromocoes || [];
        const payload = {
            cargo: promocaoForm.cargoNovo,
            salarioBruto: promocaoForm.salarioNovo,
            historicoPromocoes: [novaPromocao, ...historicoAtual],
        };
        try {
            await api.put(`/funcionarios-custos/${promocaoFuncionario.id}`, payload);
            showSuccess(`Promoção registrada! ${promocaoFuncionario.cargo} → ${promocaoForm.cargoNovo}`);
            setPromocaoDialog(false);
            fetchFuncionarios();
        } catch (e: any) {
            showError(e.message || 'Erro ao registrar promoção');
        }
    };

    // Pagamento
    const abrirPagamentoDialog = (f: Funcionario) => {
        setPagamentoFuncionario(f);
        const agora = new Date();
        const competencia = `${String(agora.getMonth()+1).padStart(2,'0')}/${agora.getFullYear()}`;
        const dataHoje = agora.toISOString().split('T')[0];
        setPagamentoForm({ competencia, dataPagamento: dataHoje, observacao: '' });
        setPagamentoDialog(true);
    };

    const confirmarPagamento = async () => {
        if (!pagamentoFuncionario) return;
        const isEstagio = pagamentoFuncionario.tipoContrato === 'ESTAGIO';
        const salBruto = pagamentoFuncionario.salarioBruto || 0;
        const inssDesc = isEstagio ? 0 : calcularINSS(salBruto);
        const irrfDesc = isEstagio ? 0 : calcularIRRF(salBruto - inssDesc, pagamentoFuncionario.dependentes || 0);
        const novoPagamento: PagamentoSalario = {
            id: Date.now().toString(),
            competencia: pagamentoForm.competencia,
            dataPagamento: pagamentoForm.dataPagamento,
            salarioBruto: salBruto,
            inssDesconto: inssDesc,
            irrfDesconto: irrfDesc,
            salarioLiquido: salBruto - inssDesc - irrfDesc,
            observacao: pagamentoForm.observacao,
        };
        const historicoAtual = pagamentoFuncionario.historicoPagamentos || [];
        const payload = {
            dataPagamento: pagamentoForm.competencia,
            historicoPagamentos: [novoPagamento, ...historicoAtual],
        };
        try {
            await api.put(`/funcionarios-custos/${pagamentoFuncionario.id}`, payload);
            showSuccess('Pagamento registrado!');
            setPagamentoDialog(false);
            fetchFuncionarios();
        } catch (e: any) {
            showError(e.message || 'Erro ao registrar pagamento');
        }
    };

    // Férias
    const abrirFeriasDialog = (f: Funcionario) => {
        setFeriasFuncionario(f);
        const hoje = new Date();
        const dataInicio = hoje.toISOString().split('T')[0];
        setFeriasForm({ dataInicio, diasGozados: 30, diasVendidos: 0 });
        setFeriasDialog(true);
    };

    const confirmarFerias = async () => {
        if (!feriasFuncionario) return;
        const { diasGozados, diasVendidos, dataInicio } = feriasForm;
        if (diasGozados + diasVendidos > 30 || diasVendidos > 10) {
            showError('Máximo 30 dias totais, sendo no máximo 10 dias vendidos');
            return;
        }
        const calc = calcularFeriasCLT(
            feriasFuncionario.salarioBruto || 0,
            diasGozados, diasVendidos,
            feriasFuncionario.dependentes || 0,
            feriasFuncionario.tipoContrato
        );
        const inicio = new Date(dataInicio + 'T12:00:00');
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + diasGozados - 1);
        const novaFerias: HistoricoFerias = {
            id: Date.now().toString(),
            dataInicio,
            dataFim: fim.toISOString().split('T')[0],
            diasGozados,
            diasVendidos,
            salarioFerias: calc.valorFeriasGozadas,
            adicionalTerco: calc.adicionalTercoTotal,
            abonoPecuniario: calc.abonoPecuniario,
            inssDesconto: calc.inssDesconto,
            irrfDesconto: calc.irrfDesconto,
            totalReceber: calc.totalReceber,
            registradoEm: new Date().toISOString(),
        };
        const historicoAtual = feriasFuncionario.historicoFerias || [];
        const payload = {
            status: diasGozados > 0 ? 'FERIAS' : feriasFuncionario.status,
            historicoFerias: [novaFerias, ...historicoAtual],
        };
        try {
            await api.put(`/funcionarios-custos/${feriasFuncionario.id}`, payload);
            showSuccess(`Férias registradas! Total: ${formatCurrency(calc.totalReceber)}`);
            setFeriasDialog(false);
            fetchFuncionarios();
        } catch (e: any) {
            showError(e.message || 'Erro ao registrar férias');
        }
    };

    // Alerta de férias para estagiários
    const alertaFeriasEstagio = (f: Funcionario): string | null => {
        if (f.tipoContrato !== 'ESTAGIO' || !f.dataAdmissao) return null;
        const meses = mesesTrabalhados(f.dataAdmissao);
        if (meses >= 11 && meses < 12) return `Atenção: ${f.nomeCompleto} completa 1 ano em breve (${12 - meses} mês(es)).`;
        if (meses >= 12) return `Atenção: ${f.nomeCompleto} já completou ${Math.floor(meses/12)} ano(s) — verifique direito a férias.`;
        return null;
    };

    const funcionariosFiltrados = funcionarios.filter(f => {
        if (filtroDepartamento && f.departamento !== filtroDepartamento) return false;
        if (filtroTipoContrato && f.tipoContrato !== filtroTipoContrato) return false;
        if (filtroStatus && f.status !== filtroStatus) return false;
        if (filtroSalarioMin !== null && (f.salarioBruto || 0) < filtroSalarioMin) return false;
        if (filtroSalarioMax !== null && (f.salarioBruto || 0) > filtroSalarioMax) return false;
        return true;
    });

    const limparFiltros = () => {
        setFiltroDepartamento('');
        setFiltroTipoContrato('');
        setFiltroStatus('');
        setFiltroSalarioMin(null);
        setFiltroSalarioMax(null);
    };

    const statusBodyTemplate = (rowData: Funcionario) => {
        const status = statusOptions.find(s => s.value === rowData.status);
        return <Tag value={rowData.status} severity={status?.color as any} />;
    };

    const acoesBodyTemplate = (rowData: Funcionario) => {
        const alertaFerias = alertaFeriasEstagio(rowData);
        return (
            <div className="flex gap-1 flex-wrap">
                <Button icon="pi pi-eye" rounded outlined severity="info" size="small" tooltip="Visualizar" onClick={() => visualizarFuncionario(rowData)} />
                <Button icon="pi pi-file-pdf" rounded outlined severity="warning" size="small" tooltip="Holerite PDF" onClick={() => gerarContracheque(rowData)} />
                <Button icon="pi pi-dollar" rounded outlined severity="success" size="small" tooltip="Registrar Pagamento" onClick={() => abrirPagamentoDialog(rowData)} />
                <Button icon="pi pi-arrow-up" rounded outlined severity="help" size="small" tooltip="Promoção de Cargo" onClick={() => abrirPromocaoDialog(rowData)} />
                <Button icon="pi pi-sun" rounded outlined severity="warning" size="small"
                    tooltip={alertaFerias ? `⚠ ${alertaFerias}` : 'Registrar Férias'}
                    style={alertaFerias ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}}
                    onClick={() => abrirFeriasDialog(rowData)} />
                <Button icon="pi pi-pencil" rounded outlined size="small" onClick={() => editFuncionario(rowData)} tooltip="Editar" />
                <Button icon="pi pi-trash" rounded outlined severity="danger" size="small" onClick={() => confirmDelete(rowData)} tooltip="Excluir" />
            </div>
        );
    };

    const metricas = calcularMetricas();

    const CardsDashboard = () => (
        <div className="grid mb-4">
            {[
                { label: 'Total Funcionários', valor: metricas.total,                      icon: 'pi-users',       cor: '#6366f1' },
                { label: 'CLT / PJ',           valor: `${metricas.clt} / ${metricas.pj}`, icon: 'pi-briefcase',   cor: '#ec4899' },
                { label: 'Folha Salarial',     valor: formatCurrency(metricas.folhaSalarial), icon: 'pi-chart-line', cor: '#3b82f6' },
                { label: 'Custo Total Mensal', valor: formatCurrency(metricas.custoTotal),    icon: 'pi-dollar',     cor: '#10b981' },
            ].map((m, i) => (
                <div key={i} className="col-12 md:col-6 lg:col-3">
                    <Card className="p-3" style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div className="flex justify-content-between align-items-center">
                            <div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: m.cor }}>{m.valor}</div>
                            </div>
                            <i className={`pi ${m.icon}`} style={{ fontSize: 28, color: m.cor, opacity: 0.2 }} />
                        </div>
                    </Card>
                </div>
            ))}
        </div>
    );

    const FiltrosBar = () => (
        <div className="grid formgrid mb-4 p-3 surface-ground border-round">
            <div className="col-12 md:col-2 field">
                <label className="font-bold">Departamento</label>
                <Dropdown value={filtroDepartamento} options={departamentos.map(d => ({ label: d, value: d }))} onChange={e => setFiltroDepartamento(e.value)} placeholder="Todos" className="w-full" showClear />
            </div>
            <div className="col-12 md:col-2 field">
                <label className="font-bold">Tipo Contrato</label>
                <Dropdown value={filtroTipoContrato} options={tiposContrato} onChange={e => setFiltroTipoContrato(e.value)} placeholder="Todos" className="w-full" showClear />
            </div>
            <div className="col-12 md:col-2 field">
                <label className="font-bold">Status</label>
                <Dropdown value={filtroStatus} options={statusOptions} onChange={e => setFiltroStatus(e.value)} placeholder="Todos" className="w-full" showClear />
            </div>
            <div className="col-6 md:col-2 field">
                <label className="font-bold">Salário Min</label>
                <InputNumber value={filtroSalarioMin} onValueChange={e => setFiltroSalarioMin(e.value ?? null)} mode="currency" currency="BRL" locale="pt-BR" className="w-full" />
            </div>
            <div className="col-6 md:col-2 field">
                <label className="font-bold">Salário Max</label>
                <InputNumber value={filtroSalarioMax} onValueChange={e => setFiltroSalarioMax(e.value ?? null)} mode="currency" currency="BRL" locale="pt-BR" className="w-full" />
            </div>
            <div className="col-12 md:col-2 field">
                <label className="font-bold" style={{ visibility: 'hidden' }}>x</label>
                <Button icon="pi pi-times" severity="secondary" onClick={limparFiltros} label="Limpar" className="w-full" outlined />
            </div>
        </div>
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3">
            <h5 className="m-0">Gestão de Funcionários</h5>
            <div className="flex gap-2">
                <span className="p-input-icon-left">
                    <i className="pi pi-search" />
                    <InputText value={globalFilter} onChange={onGlobalFilterChange} placeholder="Pesquisar..." />
                </span>
                <Button label="Importar usuário" icon="pi pi-download" severity="secondary" onClick={abrirImportar} />
                <Button label="Novo Funcionário" icon="pi pi-plus" onClick={openNew} />
            </div>
        </div>
    );

    const funcionarioDialogFooter = (
        <div className="flex gap-2 justify-content-end">
            <Button label="Cancelar" icon="pi pi-times" outlined onClick={hideDialog} />
            <Button label="Salvar" icon="pi pi-check" onClick={saveFuncionario} />
        </div>
    );

    const custoMensal = calcularCustoMensal(funcionario.salarioBruto || 0, funcionario.tipoContrato, funcionario.nivelRisco, funcionario.beneficios);
    const custoAnual = custoMensal * 12;
    const totalBeneficios = calcularTotalBeneficios(funcionario.beneficios);
    const encargos = funcionario.tipoContrato === 'CLT' ? calcularEncargosCLT(funcionario.salarioBruto || 0, funcionario.nivelRisco) : null;

    return (
        <div className="grid">
            <Toast ref={toast} />

            {/* ── Dialog: importar usuário do sistema ───────────────────────── */}
            <Dialog
                visible={importarDialog}
                header="Importar usuário do sistema"
                style={{ width: 480 }}
                modal
                onHide={() => setImportarDialog(false)}
            >
                <div style={{ marginBottom: 12 }}>
                    <span className="p-input-icon-left w-full">
                        <i className="pi pi-search" />
                        <InputText
                            className="w-full"
                            placeholder="Buscar usuário..."
                            value={usuarioImportBusca}
                            onChange={e => setUsuarioImportBusca(e.target.value)}
                        />
                    </span>
                </div>
                {usuariosSistema.length === 0 ? (
                    <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem 0' }}>
                        Todos os usuários já foram cadastrados como funcionários.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                        {usuariosSistema
                            .filter((u: any) => {
                                const nome = (u.nomeCompleto || u.nome || '').toLowerCase();
                                return nome.includes(usuarioImportBusca.toLowerCase());
                            })
                            .map((u: any) => {
                                const nome = u.nomeCompleto || u.nome || u.email;
                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => importarUsuario(u)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                                            cursor: 'pointer', background: '#fff', transition: 'background .15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f9fafb'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{nome}</div>
                                            {u.cargo && <div style={{ fontSize: 12, color: '#6b7280' }}>{u.cargo}</div>}
                                            {u.email && <div style={{ fontSize: 11, color: '#9ca3af' }}>{u.email}</div>}
                                        </div>
                                        <i className="pi pi-arrow-right" style={{ color: '#6b7280', fontSize: 13 }} />
                                    </div>
                                );
                            })
                        }
                    </div>
                )}
            </Dialog>

            {/* ── Dialog de senha MASTER ─────────────────────────────────────── */}
            <Dialog
                visible={senhaDialog}
                onHide={() => {}} // não pode fechar sem senha
                closable={false}
                header={
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-lock" style={{ color: '#6366f1', fontSize: '1.2rem' }} />
                        <span className="font-bold">Área Restrita — Custo por Funcionário</span>
                    </div>
                }
                style={{ width: '420px' }}
                modal
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button
                            label="Acessar"
                            icon="pi pi-unlock"
                            severity="info"
                            onClick={confirmarSenha}
                        />
                    </div>
                }
            >
                <div className="p-3">
                    <p className="mb-3" style={{ color: 'var(--text-color-secondary)' }}>
                        Esta área requer autenticação. Informe a senha de acesso master.
                    </p>
                    <InputText
                        type="password"
                        value={senhaInput}
                        onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
                        onKeyDown={e => e.key === 'Enter' && confirmarSenha()}
                        placeholder="Senha de acesso"
                        className={`w-full ${senhaErro ? 'p-invalid' : ''}`}
                        autoFocus
                    />
                    {senhaErro && (
                        <small className="p-error mt-1 block">Senha incorreta. Tente novamente.</small>
                    )}
                </div>
            </Dialog>

            {/* ── Conteúdo protegido ────────────────────────────────────────── */}
            {!autenticado ? (
                <div className="col-12">
                    <div className="card flex flex-column align-items-center justify-content-center" style={{ minHeight: 300 }}>
                        <i className="pi pi-lock text-6xl mb-3" style={{ color: '#94a3b8' }} />
                        <p style={{ color: 'var(--text-color-secondary)', fontSize: '1.1rem' }}>
                            Autenticação necessária para acessar esta área.
                        </p>
                        <Button label="Inserir Senha" icon="pi pi-key" outlined onClick={() => setSenhaDialog(true)} />
                    </div>
                </div>
            ) : (
            <>
            <div className="col-12">
                <div className="card">
                    <CardsDashboard />
                    <FiltrosBar />
                    <DataTable
                        value={funcionariosFiltrados}
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        loading={loading}
                        globalFilter={globalFilter}
                        header={header}
                        emptyMessage="Nenhum funcionário encontrado."
                        className="p-datatable-sm"
                    >
                        <Column field="nomeCompleto" header="Nome" sortable style={{ minWidth: '200px' }} />
                        <Column field="cargo" header="Cargo" sortable style={{ minWidth: '150px' }} />
                        <Column field="tipoContrato" header="Contrato" sortable style={{ minWidth: '100px' }} />
                        <Column field="status" header="Status" body={statusBodyTemplate} sortable style={{ minWidth: '100px' }} />
                        <Column 
                            field="salarioBruto" 
                            header="Salário" 
                            body={(rowData) => formatCurrency(rowData.salarioBruto || 0)} 
                            sortable 
                            style={{ minWidth: '120px' }} 
                        />
                        <Column 
                            header="Custo Mensal" 
                            body={(rowData) => formatCurrency(calcularCustoMensalReal(rowData))} 
                            sortable 
                            style={{ minWidth: '130px' }} 
                        />
                        <Column body={acoesBodyTemplate} exportable={false} style={{ minWidth: '180px' }} />
                    </DataTable>
                </div>
            </div>

            {/* Dialog de Cadastro/Edição - Usando Accordion */}
            <Dialog
                visible={funcionarioDialog}
                style={{ width: '85vw', maxWidth: '1100px' }}
                breakpoints={{ '960px': '95vw', '641px': '98vw' }}
                header="Cadastro de Funcionário"
                modal
                className="p-fluid"
                footer={funcionarioDialogFooter}
                onHide={hideDialog}
                draggable={false}
                resizable={false}
            >
                <div className="p-3" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <Accordion 
                        activeIndex={activeAccordion} 
                        onTabChange={(e) => setActiveAccordion(e.index as number[])}
                        className="custom-accordion"
                    >
                        {/* Seção 1: Dados Pessoais */}
                        <AccordionTab header={
                            <div className="flex align-items-center gap-2">
                                <i className="pi pi-user" style={{ fontSize: '1.2rem' }} />
                                <span className="font-bold">Dados Pessoais e Contratuais</span>
                                {submitted && !funcionario.nomeCompleto && <i className="pi pi-exclamation-circle text-red-500 ml-2" />}
                            </div>
                        }>
                            <div className="grid p-3 mt-2">
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Nome Completo <span className="text-red-500">*</span></label>
                                    <InputText 
                                        value={funcionario.nomeCompleto || ''} 
                                        onChange={(e) => onInputChange(e, 'nomeCompleto')} 
                                        className={classNames('w-full', { 'p-invalid': submitted && !funcionario.nomeCompleto })} 
                                        placeholder="Digite o nome completo"
                                    />
                                    {submitted && !funcionario.nomeCompleto && <small className="p-error">Nome é obrigatório.</small>}
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">CPF</label>
                                    <InputText 
                                        value={funcionario.cpf || ''} 
                                        onChange={(e) => onInputChange(e, 'cpf')} 
                                        placeholder="000.000.000-00" 
                                        className="w-full" 
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Cargo <span className="text-red-500">*</span></label>
                                    <InputText 
                                        value={funcionario.cargo || ''} 
                                        onChange={(e) => onInputChange(e, 'cargo')} 
                                        className={classNames('w-full', { 'p-invalid': submitted && !funcionario.cargo })} 
                                        placeholder="Ex: Desenvolvedor, Analista, Gerente..."
                                    />
                                    {submitted && !funcionario.cargo && <small className="p-error">Cargo é obrigatório.</small>}
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Tipo de Contrato <span className="text-red-500">*</span></label>
                                    <Dropdown 
                                        value={funcionario.tipoContrato} 
                                        options={tiposContrato} 
                                        onChange={(e) => onInputChange(e, 'tipoContrato')} 
                                        className={classNames('w-full', { 'p-invalid': submitted && !funcionario.tipoContrato })} 
                                    />
                                    {submitted && !funcionario.tipoContrato && <small className="p-error">Tipo de contrato é obrigatório.</small>}
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Status</label>
                                    <Dropdown 
                                        value={funcionario.status} 
                                        options={statusOptions} 
                                        onChange={(e) => onInputChange(e, 'status')} 
                                        className="w-full" 
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Tipo de Jornada</label>
                                    <Dropdown 
                                        value={funcionario.tipoJornada} 
                                        options={jornadaOptions} 
                                        onChange={(e) => onInputChange(e, 'tipoJornada')} 
                                        className="w-full" 
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Departamento</label>
                                    <Dropdown 
                                        value={funcionario.departamento} 
                                        options={departamentos.map(d => ({ label: d, value: d }))} 
                                        onChange={(e) => onInputChange(e, 'departamento')} 
                                        placeholder="Selecione" 
                                        className="w-full"
                                        showClear
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Gestor Responsável</label>
                                    <InputText 
                                        value={funcionario.gestorResponsavel || ''} 
                                        onChange={(e) => onInputChange(e, 'gestorResponsavel')} 
                                        className="w-full" 
                                        placeholder="Nome do gestor"
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Nº Dependentes</label>
                                    <InputNumber 
                                        value={funcionario.dependentes} 
                                        onValueChange={(e) => onNumberChange(e, 'dependentes')} 
                                        min={0} 
                                        className="w-full" 
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Carga Horária Semanal</label>
                                    <InputNumber 
                                        value={funcionario.cargaHoraria} 
                                        onValueChange={(e) => onNumberChange(e, 'cargaHoraria')} 
                                        min={0} 
                                        max={44} 
                                        suffix=" horas" 
                                        className="w-full" 
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Salário Bruto</label>
                                    <InputNumber 
                                        value={funcionario.salarioBruto} 
                                        onValueChange={(e) => onNumberChange(e, 'salarioBruto')} 
                                        mode="currency" 
                                        currency="BRL" 
                                        locale="pt-BR" 
                                        className="w-full" 
                                        placeholder="R$ 0,00"
                                    />
                                </div>
                                <div className="col-12 md:col-6 field">
                                    <label className="font-bold">Data de Admissão</label>
                                    <Calendar 
                                        value={funcionario.dataAdmissao} 
                                        onChange={(e) => onDateChange(e, 'dataAdmissao')} 
                                        dateFormat="dd/mm/yy" 
                                        showIcon 
                                        className="w-full" 
                                    />
                                </div>
                                {funcionario.tipoContrato === 'CLT' && (
                                    <div className="col-12 md:col-6 field">
                                        <label className="font-bold">Nível de Risco (RAT)</label>
                                        <Dropdown 
                                            value={funcionario.nivelRisco} 
                                            options={niveisRisco} 
                                            onChange={(e) => onNumberChange(e, 'nivelRisco')} 
                                            className="w-full" 
                                        />
                                    </div>
                                )}
                            </div>
                        </AccordionTab>

                        {/* Seção 2: Benefícios */}
                        <AccordionTab header={
                            <div className="flex align-items-center gap-2">
                                <i className="pi pi-gift" style={{ fontSize: '1.2rem' }} />
                                <span className="font-bold">Benefícios</span>
                            </div>
                        }>
                            <div className="grid p-3 mt-2">
                                {[
                                    { key: 'valeTransporte',    valKey: 'valeTransporteValor',    label: 'Vale Transporte' },
                                    { key: 'valeRefeicao',      valKey: 'valeRefeicaoValor',      label: 'Vale Refeição/Alimentação' },
                                    { key: 'planoSaude',        valKey: 'planoSaudeValor',        label: 'Plano de Saúde' },
                                    { key: 'planoOdontologico', valKey: 'planoOdontologicoValor', label: 'Plano Odontológico' },
                                ].map(b => (
                                    <div key={b.key} className="col-12 md:col-6">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                                            <input
                                                type="checkbox"
                                                checked={!!(funcionario.beneficios as any)[b.key]}
                                                onChange={e => onBeneficioChange({ checked: e.target.checked } as any, b.key)}
                                                style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
                                            />
                                            {b.label}
                                        </label>
                                        {(funcionario.beneficios as any)[b.key] && (
                                            <InputNumber
                                                value={(funcionario.beneficios as any)[b.valKey]}
                                                onValueChange={e => onBeneficioValorChange(e, b.valKey)}
                                                mode="currency" currency="BRL" locale="pt-BR"
                                                placeholder="Valor"
                                                className="w-full mb-3"
                                            />
                                        )}
                                    </div>
                                ))}
                                <div className="col-12">
                                    <Divider />
                                    <div className="field">
                                        <label className="font-bold">Outros Benefícios</label>
                                        <InputText 
                                            value={funcionario.beneficios.outros || ''} 
                                            onChange={(e) => onBeneficioTextChange(e, 'outros')} 
                                            placeholder="Descrição" 
                                            className="w-full mb-2" 
                                        />
                                    </div>
                                    <InputNumber 
                                        value={funcionario.beneficios.outrosValor} 
                                        onValueChange={(e) => onBeneficioValorChange(e, 'outrosValor')} 
                                        mode="currency" 
                                        currency="BRL" 
                                        locale="pt-BR" 
                                        placeholder="Valor" 
                                        className="w-full" 
                                    />
                                </div>
                            </div>
                        </AccordionTab>

                        {/* Seção 3: Custos e Encargos */}
                        <AccordionTab header={
                            <div className="flex align-items-center gap-2">
                                <i className="pi pi-dollar" style={{ fontSize: '1.2rem' }} />
                                <span className="font-bold">Custos e Encargos</span>
                            </div>
                        }>
                            <div className="grid p-3 mt-2">
                                {funcionario.salarioBruto && funcionario.salarioBruto > 0 ? (
                                    <div className="col-12">
                                        <Card className="p-3">
                                            <div className="grid">
                                                <div className="col-12 text-center mb-3">
                                                    <h3 className="m-0">Resumo Financeiro</h3>
                                                </div>
                                                <div className="col-12 md:col-6">
                                                    <div className="p-3 surface-ground border-round">
                                                        <label className="font-bold">Salário Bruto:</label>
                                                        <div className="text-2xl font-bold text-primary">{formatCurrency(funcionario.salarioBruto)}</div>
                                                    </div>
                                                </div>
                                                {funcionario.tipoContrato === 'CLT' && encargos && (
                                                    <>
                                                        <div className="col-12 md:col-6">
                                                            <div className="p-2">
                                                                <label>INSS Patronal (20%):</label>
                                                                <div className="font-semibold">{formatCurrency(encargos.inssPatronal)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="col-12 md:col-6">
                                                            <div className="p-2">
                                                                <label>RAT ({funcionario.nivelRisco}%):</label>
                                                                <div className="font-semibold">{formatCurrency(encargos.rat)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="col-12 md:col-6">
                                                            <div className="p-2">
                                                                <label>Terceiros (5,8%):</label>
                                                                <div className="font-semibold">{formatCurrency(encargos.terceiros)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="col-12 md:col-6">
                                                            <div className="p-2">
                                                                <label>FGTS (8%):</label>
                                                                <div className="font-semibold">{formatCurrency(encargos.fgts)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="col-12 md:col-6">
                                                            <div className="p-2">
                                                                <label>13º Salário (8,33%):</label>
                                                                <div className="font-semibold">{formatCurrency(encargos.decimoTerceiro)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="col-12 md:col-6">
                                                            <div className="p-2">
                                                                <label>Férias + 1/3 (11,11%):</label>
                                                                <div className="font-semibold">{formatCurrency(encargos.ferias)}</div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                                <div className="col-12 md:col-6">
                                                    <div className="p-2">
                                                        <label>Total Benefícios:</label>
                                                        <div className="font-semibold">{formatCurrency(totalBeneficios)}</div>
                                                    </div>
                                                </div>
                                                <div className="col-12">
                                                    <Divider />
                                                </div>
                                                <div className="col-12 md:col-6">
                                                    <div className="p-3 surface-highlight border-round">
                                                        <label className="text-xl font-bold">Custo Total Mensal:</label>
                                                        <div className="text-2xl font-bold text-green-600">{formatCurrency(custoMensal)}</div>
                                                    </div>
                                                </div>
                                                <div className="col-12 md:col-6">
                                                    <div className="p-3 surface-highlight border-round">
                                                        <label className="text-xl font-bold">Custo Total Anual:</label>
                                                        <div className="text-2xl font-bold text-blue-600">{formatCurrency(custoAnual)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                ) : (
                                    <div className="col-12 text-center p-4">
                                        <i className="pi pi-info-circle text-4xl text-primary mb-2" />
                                        <p>Preencha o Salário Bruto na seção "Dados Pessoais e Contratuais" para visualizar os custos e encargos.</p>
                                    </div>
                                )}
                            </div>
                        </AccordionTab>

                        {/* Seção 4: Observações */}
                        <AccordionTab header={
                            <div className="flex align-items-center gap-2">
                                <i className="pi pi-file" style={{ fontSize: '1.2rem' }} />
                                <span className="font-bold">Observações</span>
                            </div>
                        }>
                            <div className="p-3 mt-2">
                                <div className="field">
                                    <label className="font-bold">Observações Internas</label>
                                    <InputTextarea 
                                        value={funcionario.observacoes || ''} 
                                        onChange={onObservacoesChange} 
                                        rows={5} 
                                        className="w-full" 
                                        placeholder="Digite observações sobre o funcionário, como histórico profissional, notas importantes, etc..."
                                        autoResize
                                    />
                                    <small className="text-muted">Campo livre para anotações internas da empresa.</small>
                                </div>
                            </div>
                        </AccordionTab>
                    </Accordion>
                </div>
            </Dialog>

            {/* Dialog de Visualização */}
            <Dialog
                visible={visualizarDialog}
                style={{ width: '70vw', maxWidth: '800px' }}
                breakpoints={{ '960px': '90vw', '641px': '95vw' }}
                header={<span><i className="pi pi-eye mr-2" />Visualizar Funcionário: {funcionarioSelecionado?.nomeCompleto || ''}</span>}
                modal
                className="p-fluid"
                onHide={hideVisualizarDialog}
                draggable={false}
                resizable={false}
                footer={
                    <div className="flex gap-2 justify-content-end">
                        <Button label="Fechar" icon="pi pi-times" onClick={hideVisualizarDialog} />
                        <Button label="Editar" icon="pi pi-pencil" onClick={() => {
                            if (funcionarioSelecionado) {
                                hideVisualizarDialog();
                                editFuncionario(funcionarioSelecionado);
                            }
                        }} />
                    </div>
                }
            >
                {funcionarioSelecionado && (
                    <div className="p-3">
                        <div className="grid">
                            <div className="col-12">
                                <Card className="p-2 mb-3">
                                    <div className="grid">
                                        <div className="col-12 md:col-6">
                                            <div className="p-2"><i className="pi pi-user mr-2 text-primary" /><strong>Nome:</strong> {funcionarioSelecionado.nomeCompleto}</div>
                                            <div className="p-2"><i className="pi pi-id-card mr-2 text-primary" /><strong>CPF:</strong> {funcionarioSelecionado.cpf || 'Não informado'}</div>
                                            <div className="p-2"><i className="pi pi-briefcase mr-2 text-primary" /><strong>Cargo:</strong> {funcionarioSelecionado.cargo}</div>
                                            <div className="p-2"><i className="pi pi-file mr-2 text-primary" /><strong>Tipo Contrato:</strong> {funcionarioSelecionado.tipoContrato}</div>
                                        </div>
                                        <div className="col-12 md:col-6">
                                            <div className="p-2"><i className="pi pi-tag mr-2 text-primary" /><strong>Status:</strong> <Tag value={funcionarioSelecionado.status} severity={statusOptions.find(s => s.value === funcionarioSelecionado.status)?.color as any} /></div>
                                            <div className="p-2"><i className="pi pi-building mr-2 text-primary" /><strong>Departamento:</strong> {funcionarioSelecionado.departamento || 'Não informado'}</div>
                                            <div className="p-2"><i className="pi pi-calendar mr-2 text-primary" /><strong>Data Admissão:</strong> {formatarData(funcionarioSelecionado.dataAdmissao)}</div>
                                            <div className="p-2"><i className="pi pi-user-edit mr-2 text-primary" /><strong>Gestor:</strong> {funcionarioSelecionado.gestorResponsavel || 'Não informado'}</div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                            <div className="col-12">
                                <Card className="p-2 mb-3">
                                    <h4 className="mt-0"><i className="pi pi-dollar mr-2 text-primary" />Financeiro</h4>
                                    <div className="grid">
                                        <div className="col-12 md:col-6">
                                            <div className="p-2"><strong>Salário Bruto:</strong> <span className="text-xl font-bold text-primary">{formatCurrency(funcionarioSelecionado.salarioBruto || 0)}</span></div>
                                            <div className="p-2"><strong>Carga Horária:</strong> {funcionarioSelecionado.cargaHoraria || 0} horas/semana</div>
                                            <div className="p-2"><strong>Dependentes:</strong> {funcionarioSelecionado.dependentes || 0}</div>
                                        </div>
                                        <div className="col-12 md:col-6">
                                            <div className="p-2"><strong>Custo Mensal:</strong> <span className="text-xl font-bold text-green-600">{formatCurrency(calcularCustoMensalReal(funcionarioSelecionado))}</span></div>
                                            <div className="p-2"><strong>Custo Anual:</strong> <span className="text-xl font-bold text-blue-600">{formatCurrency(calcularCustoMensalReal(funcionarioSelecionado) * 12)}</span></div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                            <div className="col-12">
                                <Card className="p-2">
                                    <h4 className="mt-0"><i className="pi pi-gift mr-2 text-primary" />Benefícios</h4>
                                    <div className="grid">
                                        <div className="col-12 md:col-6">
                                            {funcionarioSelecionado.beneficios?.valeTransporte && <div className="p-1"><i className="pi pi-bus mr-2 text-primary" />Vale Transporte: {formatCurrency(funcionarioSelecionado.beneficios.valeTransporteValor || 0)}</div>}
                                            {funcionarioSelecionado.beneficios?.valeRefeicao && <div className="p-1"><i className="pi pi-shopping-cart mr-2 text-primary" />Vale Refeição: {formatCurrency(funcionarioSelecionado.beneficios.valeRefeicaoValor || 0)}</div>}
                                            {funcionarioSelecionado.beneficios?.planoSaude && <div className="p-1"><i className="pi pi-heart mr-2 text-primary" />Plano de Saúde: {formatCurrency(funcionarioSelecionado.beneficios.planoSaudeValor || 0)}</div>}
                                        </div>
                                        <div className="col-12 md:col-6">
                                            {funcionarioSelecionado.beneficios?.planoOdontologico && <div className="p-1"><i className="pi pi-smile mr-2 text-primary" />Plano Odontológico: {formatCurrency(funcionarioSelecionado.beneficios.planoOdontologicoValor || 0)}</div>}
                                            {funcionarioSelecionado.beneficios?.outros && <div className="p-1"><i className="pi pi-tag mr-2 text-primary" />{funcionarioSelecionado.beneficios.outros}: {formatCurrency(funcionarioSelecionado.beneficios.outrosValor || 0)}</div>}
                                        </div>
                                    </div>
                                    {funcionarioSelecionado.observacoes && (
                                        <>
                                            <Divider />
                                            <div><i className="pi pi-info-circle mr-2 text-primary" /><strong>Observações:</strong> {funcionarioSelecionado.observacoes}</div>
                                        </>
                                    )}
                                </Card>
                            </div>
                            <div className="col-12">
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    <Button label={`Pagamentos (${funcionarioSelecionado?.historicoPagamentos?.length || 0})`} icon="pi pi-dollar" outlined severity="success" size="small" onClick={() => { setHistPagamentoDialog(true); setPagamentoFuncionario(funcionarioSelecionado); }} />
                                    <Button label={`Promoções (${funcionarioSelecionado?.historicoPromocoes?.length || 0})`} icon="pi pi-arrow-up" outlined severity="help" size="small" onClick={() => { setHistPromocaoDialog(true); setPromocaoFuncionario(funcionarioSelecionado); }} />
                                    <Button label={`Férias (${funcionarioSelecionado?.historicoFerias?.length || 0})`} icon="pi pi-sun" outlined severity="warning" size="small" onClick={() => { setHistFeriasDialog(true); setFeriasFuncionario(funcionarioSelecionado); }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Dialog Registrar Pagamento */}
            <Dialog visible={pagamentoDialog} style={{ width: '500px' }} header={
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-dollar" style={{ color: '#22c55e' }} />
                    <span className="font-bold">Registrar Pagamento — {pagamentoFuncionario?.nomeCompleto}</span>
                </div>
            } modal onHide={() => setPagamentoDialog(false)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" icon="pi pi-times" outlined onClick={() => setPagamentoDialog(false)} />
                        <Button label="Confirmar Pagamento" icon="pi pi-check" severity="success" onClick={confirmarPagamento} />
                    </div>
                }
            >
                {pagamentoFuncionario && (() => {
                    const isEstagio = pagamentoFuncionario.tipoContrato === 'ESTAGIO';
                    const sal = pagamentoFuncionario.salarioBruto || 0;
                    const inss = isEstagio ? 0 : calcularINSS(sal);
                    const irrf = isEstagio ? 0 : calcularIRRF(sal - inss, pagamentoFuncionario.dependentes || 0);
                    const liq = sal - inss - irrf;
                    return (
                        <div className="grid p-2">
                            <div className="col-12 md:col-6 field">
                                <label className="font-bold">Competência (MM/AAAA)</label>
                                <InputText value={pagamentoForm.competencia} onChange={e => setPagamentoForm(f => ({ ...f, competencia: e.target.value }))} className="w-full mt-1" placeholder="01/2025" />
                            </div>
                            <div className="col-12 md:col-6 field">
                                <label className="font-bold">Data de Pagamento</label>
                                <InputText type="date" value={pagamentoForm.dataPagamento} onChange={e => setPagamentoForm(f => ({ ...f, dataPagamento: e.target.value }))} className="w-full mt-1" />
                            </div>
                            <div className="col-12">
                                <div className="p-3 border-round surface-ground">
                                    <div className="grid text-sm">
                                        <div className="col-6">Salário Bruto:</div><div className="col-6 text-right font-bold">{formatCurrency(sal)}</div>
                                        <div className="col-6 text-red-500">(-) INSS:</div><div className="col-6 text-right text-red-500">{formatCurrency(inss)}</div>
                                        <div className="col-6 text-red-500">(-) IRRF:</div><div className="col-6 text-right text-red-500">{formatCurrency(irrf)}</div>
                                        {isEstagio && <div className="col-12 text-blue-600 text-xs mt-1">Estagiário — sem descontos previdenciários</div>}
                                        <div className="col-12"><hr /></div>
                                        <div className="col-6 font-bold text-green-600">Salário Líquido:</div><div className="col-6 text-right font-bold text-green-600">{formatCurrency(liq)}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 field">
                                <label className="font-bold">Observação</label>
                                <InputText value={pagamentoForm.observacao} onChange={e => setPagamentoForm(f => ({ ...f, observacao: e.target.value }))} className="w-full mt-1" placeholder="Opcional" />
                            </div>
                        </div>
                    );
                })()}
            </Dialog>

            {/* Dialog Promoção de Cargo */}
            <Dialog visible={promocaoDialog} style={{ width: '500px' }} header={
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-arrow-up" style={{ color: '#a855f7' }} />
                    <span className="font-bold">Promoção de Cargo — {promocaoFuncionario?.nomeCompleto}</span>
                </div>
            } modal onHide={() => setPromocaoDialog(false)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" icon="pi pi-times" outlined onClick={() => setPromocaoDialog(false)} />
                        <Button label="Confirmar Promoção" icon="pi pi-arrow-up" severity="help" onClick={confirmarPromocao} />
                    </div>
                }
            >
                <div className="grid p-2">
                    <div className="col-12">
                        <div className="p-3 border-round surface-ground mb-3">
                            <div className="text-sm text-color-secondary mb-1">Situação atual</div>
                            <div className="font-bold">{promocaoFuncionario?.cargo}</div>
                            <div className="text-green-600 font-bold">{formatCurrency(promocaoFuncionario?.salarioBruto || 0)}</div>
                        </div>
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label className="font-bold">Novo Cargo *</label>
                        <InputText value={promocaoForm.cargoNovo} onChange={e => setPromocaoForm(f => ({ ...f, cargoNovo: e.target.value }))} className="w-full mt-1" placeholder="Ex: Gerente de Vendas" />
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label className="font-bold">Novo Salário *</label>
                        <InputNumber value={promocaoForm.salarioNovo} onValueChange={e => setPromocaoForm(f => ({ ...f, salarioNovo: e.value ?? null }))} mode="currency" currency="BRL" locale="pt-BR" className="w-full mt-1" />
                    </div>
                    {promocaoForm.salarioNovo && promocaoFuncionario?.salarioBruto && (
                        <div className="col-12">
                            <div className="flex align-items-center gap-2 p-2 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <i className="pi pi-arrow-up text-green-600" />
                                <span className="text-green-700 text-sm">
                                    Aumento de {formatCurrency((promocaoForm.salarioNovo || 0) - (promocaoFuncionario?.salarioBruto || 0))}
                                    {' '}({(((promocaoForm.salarioNovo || 0) - (promocaoFuncionario?.salarioBruto || 0)) / (promocaoFuncionario?.salarioBruto || 1) * 100).toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="col-12 field">
                        <label className="font-bold">Motivo / Observação</label>
                        <InputText value={promocaoForm.motivo} onChange={e => setPromocaoForm(f => ({ ...f, motivo: e.target.value }))} className="w-full mt-1" placeholder="Ex: Avaliação de desempenho, expansão de equipe..." />
                    </div>
                </div>
            </Dialog>

            {/* Dialog Cálculo de Férias */}
            <Dialog visible={feriasDialog} style={{ width: '620px' }} header={
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-sun" style={{ color: '#f59e0b' }} />
                    <span className="font-bold">Registrar Férias — {feriasFuncionario?.nomeCompleto}</span>
                </div>
            } modal onHide={() => setFeriasDialog(false)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" icon="pi pi-times" outlined onClick={() => setFeriasDialog(false)} />
                        <Button label="Registrar Férias" icon="pi pi-check" severity="warning" onClick={confirmarFerias} />
                    </div>
                }
            >
                {feriasFuncionario && (() => {
                    const isEstagio = feriasFuncionario.tipoContrato === 'ESTAGIO';
                    const meses = mesesTrabalhados(feriasFuncionario.dataAdmissao);
                    const calc = calcularFeriasCLT(
                        feriasFuncionario.salarioBruto || 0,
                        feriasForm.diasGozados,
                        feriasForm.diasVendidos,
                        feriasFuncionario.dependentes || 0,
                        feriasFuncionario.tipoContrato
                    );
                    return (
                        <div className="grid p-2">
                            {isEstagio && (
                                <div className="col-12">
                                    <div className="p-3 border-round mb-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                        <i className="pi pi-info-circle text-blue-600 mr-2" />
                                        <span className="text-blue-700 text-sm font-semibold">
                                            Estagiário — {meses < 12
                                                ? `Faltam ${12 - meses} meses para completar 1 ano (direito a férias)`
                                                : `Já completou ${Math.floor(meses/12)} ano(s) de estágio — verifique direito a férias conforme contrato`}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="col-12 md:col-4 field">
                                <label className="font-bold">Data de Início</label>
                                <InputText type="date" value={feriasForm.dataInicio} onChange={e => setFeriasForm(f => ({ ...f, dataInicio: e.target.value }))} className="w-full mt-1" />
                            </div>
                            <div className="col-12 md:col-4 field">
                                <label className="font-bold">Dias Gozados</label>
                                <InputNumber value={feriasForm.diasGozados} onValueChange={e => setFeriasForm(f => ({ ...f, diasGozados: e.value ?? 30 }))} min={0} max={30} className="w-full mt-1" />
                            </div>
                            <div className="col-12 md:col-4 field">
                                <label className="font-bold">Dias Vendidos (abono)</label>
                                <InputNumber value={feriasForm.diasVendidos} onValueChange={e => setFeriasForm(f => ({ ...f, diasVendidos: e.value ?? 0 }))} min={0} max={10} className="w-full mt-1" />
                                <small className="text-color-secondary">Máx. 10 dias</small>
                            </div>
                            <div className="col-12">
                                <div className="p-3 border-round surface-ground">
                                    <div className="font-bold mb-3" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>Resumo do Cálculo — Fórmula: (Salário/30 × Dias) + 1/3</div>
                                    <div className="grid text-sm">
                                        <div className="col-8">Férias gozadas ({feriasForm.diasGozados} dias):</div>
                                        <div className="col-4 text-right">{formatCurrency(calc.valorFeriasGozadas)}</div>
                                        <div className="col-8">+ 1/3 constitucional:</div>
                                        <div className="col-4 text-right">{formatCurrency(calc.adicionalTercoTotal)}</div>
                                        {feriasForm.diasVendidos > 0 && <>
                                            <div className="col-8">+ Abono pecuniário ({feriasForm.diasVendidos} dias vendidos):</div>
                                            <div className="col-4 text-right">{formatCurrency(calc.abonoPecuniario)}</div>
                                        </>}
                                        <div className="col-8 font-bold">= Total Bruto:</div>
                                        <div className="col-4 text-right font-bold">{formatCurrency(calc.totalBruto)}</div>
                                        {!isEstagio && <>
                                            <div className="col-8 text-red-500">(-) INSS:</div>
                                            <div className="col-4 text-right text-red-500">{formatCurrency(calc.inssDesconto)}</div>
                                            <div className="col-8 text-red-500">(-) IRRF:</div>
                                            <div className="col-4 text-right text-red-500">{formatCurrency(calc.irrfDesconto)}</div>
                                        </>}
                                        {isEstagio && <div className="col-12 text-blue-600 text-xs">Estagiário — sem descontos previdenciários</div>}
                                        <div className="col-12"><hr /></div>
                                        <div className="col-8 font-bold text-green-600 text-base">Total a Receber:</div>
                                        <div className="col-4 text-right font-bold text-green-600 text-base">{formatCurrency(calc.totalReceber)}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 text-xs text-color-secondary mt-1">
                                {meses >= 0 && `Tempo de empresa: ${Math.floor(meses/12)} ano(s) e ${meses % 12} mês(es). `}
                                Pagamento deve ser feito até 2 dias antes do início das férias.
                            </div>
                        </div>
                    );
                })()}
            </Dialog>

            {/* Dialog Histórico de Pagamentos */}
            <Dialog visible={histPagamentoDialog} style={{ width: '750px' }} header={
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-history" style={{ color: '#22c55e' }} />
                    <span className="font-bold">Histórico de Pagamentos — {pagamentoFuncionario?.nomeCompleto}</span>
                </div>
            } modal onHide={() => setHistPagamentoDialog(false)}
                footer={<Button label="Fechar" icon="pi pi-times" outlined onClick={() => setHistPagamentoDialog(false)} />}
            >
                {(pagamentoFuncionario?.historicoPagamentos?.length ?? 0) === 0 ? (
                    <div className="text-center py-5 text-color-secondary"><i className="pi pi-inbox text-4xl mb-3 block" /><p>Nenhum pagamento registrado.</p></div>
                ) : (
                    <DataTable value={pagamentoFuncionario?.historicoPagamentos || []} paginator rows={8} emptyMessage="Sem registros.">
                        <Column field="competencia" header="Competência" style={{ width: '110px' }} />
                        <Column header="Data Pgto" body={(r: PagamentoSalario) => r.dataPagamento ? new Date(r.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} style={{ width: '110px' }} />
                        <Column header="Salário Bruto" body={(r: PagamentoSalario) => formatCurrency(r.salarioBruto)} />
                        <Column header="(-) INSS" body={(r: PagamentoSalario) => <span className="text-red-500">{formatCurrency(r.inssDesconto)}</span>} />
                        <Column header="(-) IRRF" body={(r: PagamentoSalario) => <span className="text-red-500">{formatCurrency(r.irrfDesconto)}</span>} />
                        <Column header="Líquido" body={(r: PagamentoSalario) => <span className="text-green-600 font-bold">{formatCurrency(r.salarioLiquido)}</span>} />
                        <Column field="observacao" header="Obs." />
                    </DataTable>
                )}
            </Dialog>

            {/* Dialog Histórico de Promoções */}
            <Dialog visible={histPromocaoDialog} style={{ width: '750px' }} header={
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-arrow-up" style={{ color: '#a855f7' }} />
                    <span className="font-bold">Histórico de Promoções — {promocaoFuncionario?.nomeCompleto}</span>
                </div>
            } modal onHide={() => setHistPromocaoDialog(false)}
                footer={<Button label="Fechar" icon="pi pi-times" outlined onClick={() => setHistPromocaoDialog(false)} />}
            >
                {(promocaoFuncionario?.historicoPromocoes?.length ?? 0) === 0 ? (
                    <div className="text-center py-5 text-color-secondary"><i className="pi pi-inbox text-4xl mb-3 block" /><p>Nenhuma promoção registrada.</p></div>
                ) : (
                    <DataTable value={promocaoFuncionario?.historicoPromocoes || []} paginator rows={8} emptyMessage="Sem registros.">
                        <Column header="Data" body={(r: HistoricoPromocao) => r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} style={{ width: '100px' }} />
                        <Column field="cargoAnterior" header="Cargo Anterior" />
                        <Column header="" body={() => <i className="pi pi-arrow-right" style={{ color: '#a855f7' }} />} style={{ width: '40px' }} />
                        <Column field="cargoNovo" header="Novo Cargo" body={(r: HistoricoPromocao) => <span className="font-bold">{r.cargoNovo}</span>} />
                        <Column header="Salário Anterior" body={(r: HistoricoPromocao) => formatCurrency(r.salarioAnterior)} />
                        <Column header="Novo Salário" body={(r: HistoricoPromocao) => <span className="text-green-600 font-bold">{formatCurrency(r.salarioNovo)}</span>} />
                        <Column field="motivo" header="Motivo" />
                    </DataTable>
                )}
            </Dialog>

            {/* Dialog Histórico de Férias */}
            <Dialog visible={histFeriasDialog} style={{ width: '850px' }} header={
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-sun" style={{ color: '#f59e0b' }} />
                    <span className="font-bold">Histórico de Férias — {feriasFuncionario?.nomeCompleto}</span>
                </div>
            } modal onHide={() => setHistFeriasDialog(false)}
                footer={<Button label="Fechar" icon="pi pi-times" outlined onClick={() => setHistFeriasDialog(false)} />}
            >
                {(feriasFuncionario?.historicoFerias?.length ?? 0) === 0 ? (
                    <div className="text-center py-5 text-color-secondary"><i className="pi pi-inbox text-4xl mb-3 block" /><p>Nenhuma férias registrada.</p></div>
                ) : (
                    <DataTable value={feriasFuncionario?.historicoFerias || []} paginator rows={8} emptyMessage="Sem registros.">
                        <Column header="Início" body={(r: HistoricoFerias) => r.dataInicio ? new Date(r.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} style={{ width: '90px' }} />
                        <Column header="Fim" body={(r: HistoricoFerias) => r.dataFim ? new Date(r.dataFim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} style={{ width: '90px' }} />
                        <Column header="Dias" body={(r: HistoricoFerias) => `${r.diasGozados}g + ${r.diasVendidos}v`} style={{ width: '80px' }} />
                        <Column header="Férias" body={(r: HistoricoFerias) => formatCurrency(r.salarioFerias)} />
                        <Column header="+ 1/3" body={(r: HistoricoFerias) => formatCurrency(r.adicionalTerco)} />
                        <Column header="(-) INSS" body={(r: HistoricoFerias) => <span className="text-red-500">{formatCurrency(r.inssDesconto)}</span>} />
                        <Column header="(-) IRRF" body={(r: HistoricoFerias) => <span className="text-red-500">{formatCurrency(r.irrfDesconto)}</span>} />
                        <Column header="Total" body={(r: HistoricoFerias) => <span className="text-green-600 font-bold">{formatCurrency(r.totalReceber)}</span>} />
                    </DataTable>
                )}
            </Dialog>

            </>
            )}{/* fim bloco autenticado */}

            <style jsx global>{`
                .custom-accordion .p-accordion-tab {
                    margin-bottom: 0.5rem;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .custom-accordion .p-accordion-header a {
                    padding: 1rem 1.25rem;
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    font-weight: 600;
                }
                .custom-accordion .p-accordion-header:not(.p-disabled).p-highlight a {
                    background: #e9ecef;
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                }
                .custom-accordion .p-accordion-content {
                    padding: 1rem;
                    border: 1px solid #dee2e6;
                    border-top: none;
                    border-bottom-left-radius: 8px;
                    border-bottom-right-radius: 8px;
                }
            `}</style>
        </div>
    );
};

export default CustosFuncionariosPage;