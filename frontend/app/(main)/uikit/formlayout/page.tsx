'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AutoComplete } from 'primereact/autocomplete';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { InputSwitch } from 'primereact/inputswitch';
import { Calendar } from 'primereact/calendar';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';
import { Divider } from 'primereact/divider';
import { InputTextarea } from 'primereact/inputtextarea';
import { SelectButton } from 'primereact/selectbutton';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { productService } from './../../services/api/productService';
import api from './../../services/api/baseApi';
import FiscalProductLinkDialog from '../../components/FiscalProductLinkDialog';
import StockLocationsDialog from '../../components/StockLocationsDialog';
import {
    FiscalImportDecision,
    FiscalImportPreview,
    fiscalStockImportService
} from '../../services/api/fiscalStockImportService';

interface Product {
    id: number;
    name: string;
    code?: string | null;
    fabricante?: string | null;
    fornecedor_id?: number | null;
    category?: string;
    origem?: number;
    is_materia_prima?: boolean;
    unidade_medida?: string | null;
    unidade_comercial?: string | null;
    unidade_tributavel?: string | null;
    unidades_por_caixa?: number | null;
    price: number;
    preco_compra?: number;
    tipo_preco_venda?: TipoPrecoVenda;
    percentual_lucro?: number | null;
    minQuantity: number;
    currentQuantity: number;
    lote?: string | null;
    data_validade?: string | null;
    peso_bruto?: number;
    peso_liquido?: number;
    ncm?: string;
    cfop?: string;
    cest?: string;
    cst_csosn?: string;
    aliquota_icms?: number;
    aliquota_pis?: number;
    aliquota_cofins?: number;
    aliquota_ipi?: number;
    codigo_barras?: string;
    // NOVOS CAMPOS
    cst_pis?: string;
    cst_cofins?: string;
    granel_origem_id?: number | null;
    caixa_origem_id?: number | null;
    // Reforma Tributária
    ibs_cbs_situacao_tributaria?: string | null;
    ibs_cbs_classificacao_tributaria?: string | null;
}

interface Movimento {
    id: number;
    produto_id: number;
    tipo: 'entrada' | 'saida';
    quantidade: number;
    motivo: string;
    data: string;
    createdAt?: string;
    origem_tipo?: string | null;
    origem_id?: number | null;
    produto?: { id: number; name: string; code?: string; unidade_medida?: string };
}

interface HistoricoCustoEntrada {
    id: number;
    quantidade: number;
    preco_unitario: number | null;
    preco_anterior: number | null;
    estoque_anterior: number | null;
    estoque_posterior: number | null;
    data_entrada: string;
    origem_tipo: string;
    documento?: string | null;
    observacao?: string | null;
}

interface DesperdicioItem {
    id: number;
    data: string;
    quantidade: number;
    custoUnitario: number;
    custoEstimado: number;
    produtoId: number | null;
    produtoNome: string;
    unidade: string;
    ordemId: number | null;
    receitaNome: string;
    motivo: string;
    classificacao: 'rendimento_excedente' | 'desperdicio_real' | 'outro';
    classificacaoLabel: string;
    observacao: string | null;
}

interface DesperdicioRelatorio {
    periodo: string;
    dataInicio: string;
    dataFim: string;
    resumo: {
        totalQuantidade: number;
        totalCustoEstimado: number;
        totalOcorrencias: number;
        totalProdutos: number;
        totalSemCusto: number;
        totalRendimentoExcedente: number;
        totalDesperdicioReal: number;
        porProduto: {
            produtoId: number | null;
            produtoNome: string;
            unidade: string;
            quantidade: number;
            custoUnitario: number;
            custoEstimado: number;
            ocorrencias: number;
        }[];
    };
    itens: DesperdicioItem[];
}

const labelClassificacaoDesperdicio = (value?: string | null) => ({
    rendimento_excedente: 'Rendimento excedente',
    desperdicio_real: 'Desperdício real',
    outro: 'Outro'
}[value || 'desperdicio_real'] || 'Desperdício real');

type TipoPrecoVenda = 'valor' | 'percentual';

interface ProdutoUnitarioPendente {
    dadosCaixa: Omit<Product, 'id'>;
    caixaOrigemId: number;
    quantidadePorCaixa: number;
    custoUnitario: number;
}

const initialForm: Omit<Product, 'id'> = {
    name: '', code: '', fornecedor_id: null, category: '', origem: 0, is_materia_prima: false,
    unidade_medida: '', unidade_comercial: '', unidade_tributavel: '',
    unidades_por_caixa: null,
    price: 0, preco_compra: 0,
    tipo_preco_venda: 'valor', percentual_lucro: null,
    minQuantity: 0, currentQuantity: 0,
    lote: '', data_validade: null, peso_bruto: 0, peso_liquido: 0,
    ncm: '', cfop: '', cest: '', cst_csosn: '',
    aliquota_icms: 0, aliquota_pis: 0, aliquota_cofins: 0, aliquota_ipi: 0,
    codigo_barras: '',
    // NOVOS CAMPOS COM VALOR PADRÃO
    cst_pis: '07',
    cst_cofins: '07',
    // Reforma Tributária
    ibs_cbs_situacao_tributaria: '',
    ibs_cbs_classificacao_tributaria: '',
};

interface Fornecedor {
    id: number;
    nomeCompleto: string;
    cpf?: string | null;
    cnpj?: string | null;
}

const stockStatusOptions = [
    { label: 'Todos', value: null },
    { label: 'Abaixo do mínimo', value: 'below' },
    { label: 'OK', value: 'ok' },
];

const tipoPrecoVendaOpcoes = [
    { label: 'Valor em R$', value: 'valor', icon: 'pi pi-dollar' },
    { label: '% de margem de lucro', value: 'percentual', icon: 'pi pi-percentage' },
];

const calcularPrecoComLucro = (precoCompra: number | null | undefined, percentual: number | null | undefined) => {
    const custo = Number(precoCompra || 0);
    const margem = Number(percentual || 0);
    if (margem >= 100) return custo;
    return Number((custo / (1 - margem / 100)).toFixed(2));
};

const numeroSeguro = (valor: unknown, padrao = 0) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : padrao;
};

const normalizarBuscaProduto = (valor: string) => valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const unidadesOpcoes = [
    { label: 'UN – Unidade', value: 'UN' },
    { label: 'KG – Quilograma', value: 'KG' },
    { label: 'ML – Mililitro', value: 'ML' },
    { label: 'LT – Litro', value: 'LT' },
    { label: 'MT – Metro', value: 'MT' },
    { label: 'M2 – Metro Quadrado', value: 'M2' },
    { label: 'M3 – Metro Cúbico', value: 'M3' },
    { label: 'CX – Caixa', value: 'CX' },
    { label: 'PCT – Pacote', value: 'PCT' },
    { label: 'PC – Peça', value: 'PC' },
    { label: 'DZ – Dúzia', value: 'DZ' },
    { label: 'CT – Cento', value: 'CT' },
    { label: 'GL – Galão', value: 'GL' },
    { label: 'TON – Tonelada', value: 'TON' },
];

const origemOpcoes = [
    { label: '0 – Nacional', value: 0 },
    { label: '1 – Estrangeira (Importação direta)', value: 1 },
    { label: '2 – Estrangeira (Mercado interno)', value: 2 },
    { label: '3 – Nacional (>40% conteúdo importado)', value: 3 },
    { label: '4 – Nacional (conformidade PPB)', value: 4 },
    { label: '5 – Nacional (<40% conteúdo importado)', value: 5 },
    { label: '6 – Estrangeira direta s/ similar nacional', value: 6 },
    { label: '7 – Estrangeira mercado interno s/ similar', value: 7 },
    { label: '8 – Nacional (>70% conteúdo importado)', value: 8 },
];

// Opções para CST PIS e COFINS
const cstPisCofinsOpcoes = [
    { label: '01 - Operação Tributável (Alíquota Básica)', value: '01' },
    { label: '02 - Operação Tributável (Alíquota Diferenciada)', value: '02' },
    { label: '03 - Operação Tributável (Alíquota por Unidade)', value: '03' },
    { label: '04 - Operação Tributável Monofásica', value: '04' },
    { label: '05 - Operação Tributável por Substituição', value: '05' },
    { label: '06 - Operação Tributável a Alíquota Zero', value: '06' },
    { label: '07 - Isenta da Contribuição', value: '07' },
    { label: '08 - Sem Incidência da Contribuição', value: '08' },
    { label: '09 - Suspensão da Contribuição', value: '09' },
    { label: '49 - Outras Operações de Saída', value: '49' },
    { label: '99 - Outras Operações', value: '99' },
];

// ── Tipos de etiqueta ──────────────────────────────────────────────────────
type TamanhoEtiqueta = '60x60' | '40x40' | '60x40' | '80x80' | '100x150';
type TipoEtiqueta = 'comum' | 'alimento';
type TipoAlimento = 'solido' | 'liquido';
type CampoNutricional = { por100g: string; porPorcao: string; vd: string };
type TabelaNutricional = Record<string, CampoNutricional>;
type TipoDeclaracaoAlergeno = 'contem' | 'derivados' | 'pode_conter';

const alergenicosPrincipais = [
    'TRIGO', 'LEITE', 'OVOS', 'SOJA', 'AMENDOIM', 'CASTANHAS', 'PEIXES', 'CRUSTÁCEOS',
];

const formatarListaAlergenicos = (itens: string[]) => {
    if (itens.length <= 1) return itens[0] || '';
    return `${itens.slice(0, -1).join(', ')} E ${itens[itens.length - 1]}`;
};
const gerarTextoAlergenicos = (
    marcados: Record<string, TipoDeclaracaoAlergeno>,
    outros: string,
    tipoOutros: TipoDeclaracaoAlergeno
) => {
    const grupos: Record<TipoDeclaracaoAlergeno, string[]> = { contem: [], derivados: [], pode_conter: [] };
    Object.entries(marcados).forEach(([nome, tipo]) => grupos[tipo]?.push(nome));
    if (outros.trim()) grupos[tipoOutros].push(outros.trim().toUpperCase());
    const partes: string[] = [];
    if (grupos.contem.length) partes.push(`CONTÉM ${formatarListaAlergenicos(grupos.contem)}`);
    if (grupos.derivados.length) partes.push(`CONTÉM DERIVADOS DE ${formatarListaAlergenicos(grupos.derivados)}`);
    if (grupos.pode_conter.length) partes.push(`PODE CONTER ${formatarListaAlergenicos(grupos.pode_conter)}`);
    return partes.join('. ');
};

const nutrientesPadrao = [
    { key: 'valorEnergetico', label: 'Valor energético', unidade: 'kcal' },
    { key: 'carboidratos', label: 'Carboidratos', unidade: 'g' },
    { key: 'acucaresTotais', label: 'Açúcares totais', unidade: 'g' },
    { key: 'acucaresAdicionados', label: 'Açúcares adicionados', unidade: 'g' },
    { key: 'proteinas', label: 'Proteínas', unidade: 'g' },
    { key: 'gordurasTotais', label: 'Gorduras totais', unidade: 'g' },
    { key: 'gordurasSaturadas', label: 'Gorduras saturadas', unidade: 'g' },
    { key: 'gordurasTrans', label: 'Gorduras trans', unidade: 'g' },
    { key: 'fibraAlimentar', label: 'Fibra alimentar', unidade: 'g' },
    { key: 'sodio', label: 'Sódio', unidade: 'mg' },
] as const;

const tabelaNutricionalVazia = (): TabelaNutricional => Object.fromEntries(
    nutrientesPadrao.map(({ key }) => [key, { por100g: '', porPorcao: '', vd: '' }])
);

const valoresDiariosReferencia: Record<string, number | null> = {
    valorEnergetico: 2000,
    carboidratos: 300,
    acucaresTotais: null,
    acucaresAdicionados: 50,
    proteinas: 50,
    gordurasTotais: 65,
    gordurasSaturadas: 20,
    gordurasTrans: 2,
    fibraAlimentar: 25,
    sodio: 2000,
};

const numeroNutricional = (valor: string) => {
    const encontrado = valor.trim().replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    const numero = Number(encontrado?.[0] ?? 0);
    return Number.isFinite(numero) ? numero : 0;
};
const formatarNutricional = (valor: number) => {
    const arredondado = Math.round(valor * 10) / 10;
    return Number.isInteger(arredondado) ? String(arredondado) : arredondado.toFixed(1).replace('.', ',');
};
const recalcularTabelaNutricional = (tabela: TabelaNutricional, porcao: string): TabelaNutricional => {
    const resultado = { ...tabela };
    const quantidadePorcao = numeroNutricional(porcao);
    const fatorPorcao = quantidadePorcao > 0 ? quantidadePorcao / 100 : 0;

    nutrientesPadrao.forEach(({ key }) => {
        resultado[key] = { ...(resultado[key] || { por100g: '', porPorcao: '', vd: '' }) };
    });

    const carboidratos = numeroNutricional(resultado.carboidratos.por100g);
    const proteinas = numeroNutricional(resultado.proteinas.por100g);
    const gorduras = numeroNutricional(resultado.gordurasTotais.por100g);
    const kcal100g = carboidratos * 4 + proteinas * 4 + gorduras * 9;
    resultado.valorEnergetico.por100g = formatarNutricional(kcal100g);

    nutrientesPadrao.forEach(({ key }) => {
        const valor100g = numeroNutricional(resultado[key].por100g);
        const valorPorcao = fatorPorcao > 0 ? valor100g * fatorPorcao : 0;
        resultado[key].porPorcao = fatorPorcao > 0 ? formatarNutricional(valorPorcao) : '';
        const referencia = valoresDiariosReferencia[key];
        resultado[key].vd = referencia === null ? '—' : (fatorPorcao > 0 ? String(Math.round((valorPorcao / referencia) * 100)) : '');
    });

    return resultado;
};

interface Etiqueta {
    id: string;
    empresa_id: number;
    produto_id: number;
    nomeProduto: string;
    sku: string;
    codigoBarras: string;
    usarCodigoBarrasProduto: boolean;
    categoria: string;
    preco?: string;
    dataImpressao: string;
    validade: string;
    tamanho: TamanhoEtiqueta;
    tipo?: TipoEtiqueta;
    pesoLiquido?: string;
    porcao?: string;
    medidaCaseira?: string;
    porcoesPorEmbalagem?: string;
    ingredientes?: string;
    alergenicos?: string;
    alergenicosMarcados?: Record<string, TipoDeclaracaoAlergeno>;
    outrosAlergenicos?: string;
    outrosAlergenicosTipo?: TipoDeclaracaoAlergeno;
    contemGluten?: boolean;
    conservacao?: string;
    modoPreparo?: string;
    fabricante?: string;
    tipoAlimento?: TipoAlimento;
    tabelaNutricional?: TabelaNutricional;
    createdAt: string;
}

const ETIQUETA_KEY_PREFIX = 'saudevida_historico_etiquetas_empresa';
const obterEmpresaIdAtual = (): number | null => {
    if (typeof window === 'undefined') return null;
    try {
        const usuario = JSON.parse(localStorage.getItem('user') ?? '{}');
        const ehMaster = usuario?.tipo === 'MASTER' || usuario?.email === 'admin@master.com';
        const selecionada = localStorage.getItem('empresa_selecionada');
        const id = ehMaster ? Number(selecionada) : Number(usuario?.empresa_id);
        return Number.isInteger(id) && id > 0 ? id : null;
    } catch {
        return null;
    }
};
const chaveHistoricoEtiquetas = () => {
    const empresaId = obterEmpresaIdAtual();
    return empresaId ? `${ETIQUETA_KEY_PREFIX}_${empresaId}` : null;
};
const tamanhoOpcoes = [
    { label: '60 × 60 mm', value: '60x60' },
    { label: '40 × 40 mm', value: '40x40' },
    { label: '60 × 40 mm', value: '60x40' },
];
const tamanhoOpcoesAlimento = [
    { label: '80 × 80 mm', value: '80x80' },
    { label: '100 × 150 mm', value: '100x150' },
];
interface EtiquetaForm {
    nomeProduto: string;
    sku: string;
    codigoBarras: string;
    usarCodigoBarrasProduto: boolean;
    categoria: string;
    preco: string;
    dataImpressao: string;
    validade: string;
    tamanho: TamanhoEtiqueta;
    tipo: TipoEtiqueta;
    pesoLiquido: string;
    porcao: string;
    medidaCaseira: string;
    porcoesPorEmbalagem: string;
    ingredientes: string;
    alergenicos: string;
    alergenicosMarcados: Record<string, TipoDeclaracaoAlergeno>;
    outrosAlergenicos: string;
    outrosAlergenicosTipo: TipoDeclaracaoAlergeno;
    contemGluten: boolean;
    conservacao: string;
    modoPreparo: string;
    fabricante: string;
    tipoAlimento: TipoAlimento;
    tabelaNutricional: TabelaNutricional;
}
const etiquetaVazia: EtiquetaForm = {
    nomeProduto: '', sku: '', codigoBarras: '', usarCodigoBarrasProduto: false,
    categoria: '', preco: '', dataImpressao: '', validade: '', tamanho: '60x40',
    tipo: 'comum', pesoLiquido: '', porcao: '', medidaCaseira: '', porcoesPorEmbalagem: '',
    ingredientes: '', alergenicos: '', alergenicosMarcados: {}, outrosAlergenicos: '', outrosAlergenicosTipo: 'contem',
    contemGluten: false, conservacao: '', modoPreparo: '', fabricante: '', tipoAlimento: 'solido',
    tabelaNutricional: tabelaNutricionalVazia(),
};
const normalizarEtiqueta = (dados: Partial<EtiquetaForm>): EtiquetaForm => {
    const tabela = { ...tabelaNutricionalVazia(), ...(dados.tabelaNutricional ?? {}) };
    return {
        ...etiquetaVazia,
        ...dados,
        tipo: dados.tipo ?? 'comum',
        tabelaNutricional: recalcularTabelaNutricional(tabela, dados.porcao ?? ''),
    };
};

// ── Gerador de barras de código de barras (Code 128 estilo visual) ─────────
const gerarBarras = (texto: string): { w: number; dark: boolean }[] => {
    const seed = texto || '0000000';
    const barras: { w: number; dark: boolean }[] = [];
    // Guarda inicial
    barras.push({ w: 2, dark: true }, { w: 1, dark: false }, { w: 2, dark: true }, { w: 1, dark: false });
    for (let i = 0; i < seed.length; i++) {
        const c = seed.charCodeAt(i);
        const pattern = [
            (c >> 5) & 1 ? 2 : 1, (c >> 4) & 1 ? 1 : 2, (c >> 3) & 1 ? 2 : 1,
            (c >> 2) & 1 ? 1 : 2, (c >> 1) & 1 ? 2 : 1, (c) & 1 ? 1 : 2,
        ];
        pattern.forEach((w, idx) => barras.push({ w, dark: idx % 2 === 0 }));
    }
    // Guarda final
    barras.push({ w: 2, dark: true }, { w: 1, dark: false }, { w: 2, dark: true }, { w: 3, dark: false });
    return barras;
};

const gerarSvgBarras = (barras: { w: number; dark: boolean }[], classe: string) => {
    const altura = 100;
    const largura = barras.reduce((total, barra) => total + barra.w, 0);
    let x = 0;
    const retangulos = barras.map(barra => {
        const inicio = x;
        x += barra.w;
        return barra.dark ? `<rect x="${inicio}" y="0" width="${barra.w}" height="${altura}" fill="#000"/>` : '';
    }).join('');
    return `<svg class="${classe}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" aria-label="Código de barras">${retangulos}</svg>`;
};

const escaparHtml = (valor: string | undefined) => (valor || '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const obterAlertasFrontais = (dados: EtiquetaForm) => {
    const numero = (valor: string) => Number(valor.replace(',', '.')) || 0;
    const liquido = dados.tipoAlimento === 'liquido';
    const alertas: string[] = [];
    if (numero(dados.tabelaNutricional.acucaresAdicionados?.por100g || '') >= (liquido ? 7.5 : 15)) alertas.push('AÇÚCAR ADICIONADO');
    if (numero(dados.tabelaNutricional.gordurasSaturadas?.por100g || '') >= (liquido ? 3 : 6)) alertas.push('GORDURA SATURADA');
    if (numero(dados.tabelaNutricional.sodio?.por100g || '') >= (liquido ? 300 : 600)) alertas.push('SÓDIO');
    return alertas;
};

// ── Preview da etiqueta ────────────────────────────────────────────────────
const EtiquetaPreview = ({ dados }: { dados: EtiquetaForm }) => {
    const dims: Record<string, { w: number; h: number }> = {
        '60x60': { w: 220, h: 220 },
        '40x40': { w: 170, h: 170 },
        '60x40': { w: 240, h: 160 },
        '80x80': { w: 300, h: 300 },
        '100x150': { w: 300, h: 450 },
    };
    const { w, h } = dims[dados.tamanho] ?? dims['60x40'];
    const is40 = dados.tamanho === '40x40';
    const barHeight = is40 ? 28 : 34;
    const codigoExibido = (dados.usarCodigoBarrasProduto && dados.codigoBarras)
        ? dados.codigoBarras
        : (dados.sku || '');
    const barras = gerarBarras(codigoExibido || 'PREVIEW');

    if (dados.tipo === 'alimento') {
        const compacto = dados.tamanho === '80x80';
        const alertasFrontais = obterAlertasFrontais(dados);
        const codigoAlimento = dados.codigoBarras || dados.sku || '';
        const barrasAlimento = gerarBarras(codigoAlimento || 'PREVIEW');
        const totalBarrasAlimento = barrasAlimento.reduce((total, barra) => total + barra.w, 0);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-color-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Pré-visualização — {compacto ? '80 × 80 mm' : '100 × 150 mm'}
                </span>
                <div style={{ width: w, height: h, padding: compacto ? 7 : 12, border: '2px solid #111', borderRadius: 4, background: '#fff', color: '#111', overflow: 'hidden', fontFamily: 'Arial, sans-serif', fontSize: compacto ? 5.5 : 8, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: compacto ? 10 : 15, fontWeight: 800, textAlign: 'center', marginBottom: compacto ? 2 : 4 }}>{dados.nomeProduto || 'Nome do alimento'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111', paddingBottom: compacto ? 2 : 5, marginBottom: compacto ? 2 : 5 }}>
                        <span>{dados.fabricante || 'Fabricante'}</span>
                        <strong>PESO LÍQ. {dados.pesoLiquido || '--'}</strong>
                    </div>
                    {alertasFrontais.length > 0 && <div style={{ display: 'flex', gap: compacto ? 2 : 4, marginBottom: compacto ? 2 : 5 }}>{alertasFrontais.map(alerta => <div key={alerta} style={{ border: '2px solid #111', padding: compacto ? '1px 3px' : '3px 5px', fontWeight: 900, fontSize: compacto ? 5 : 7 }}>ALTO EM<br />{alerta}</div>)}</div>}
                    <div style={{ marginBottom: compacto ? 2 : 4 }}><strong>INGREDIENTES:</strong> {dados.ingredientes || 'Informe os ingredientes em ordem decrescente.'}</div>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>ALÉRGICOS: {dados.alergenicos || 'INFORMAR'}</div>
                    <div style={{ fontWeight: 800, marginBottom: compacto ? 2 : 6 }}>{dados.contemGluten ? 'CONTÉM GLÚTEN.' : 'NÃO CONTÉM GLÚTEN.'}</div>
                    <div style={{ border: '2px solid #111' }}>
                        <div style={{ fontSize: compacto ? 9 : 16, fontWeight: 900, padding: compacto ? '1px 3px' : '3px 5px', borderBottom: compacto ? '3px solid #111' : '5px solid #111' }}>INFORMAÇÃO NUTRICIONAL</div>
                        <div style={{ padding: compacto ? '1px 3px' : '3px 5px', borderBottom: '1px solid #111' }}>
                            Porções por embalagem: {dados.porcoesPorEmbalagem || '--'}<br />
                            Porção: {dados.porcao || '--'} {dados.medidaCaseira ? `(${dados.medidaCaseira})` : ''}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compacto ? 4.7 : 7 }}>
                            <thead><tr style={{ borderBottom: '2px solid #111' }}><th style={{ textAlign: 'left', padding: compacto ? 0.5 : 2 }}></th><th>100 g/ml</th><th>Porção</th><th>%VD*</th></tr></thead>
                            <tbody>
                                {nutrientesPadrao.map(n => {
                                    const valor = dados.tabelaNutricional[n.key] || { por100g: '', porPorcao: '', vd: '' };
                                    return <tr key={n.key} style={{ borderBottom: '1px solid #777' }}><td style={{ padding: compacto ? 0.5 : 2, fontWeight: 600 }}>{n.label} ({n.unidade})</td><td style={{ textAlign: 'center' }}>{valor.por100g || '0'}</td><td style={{ textAlign: 'center' }}>{valor.porPorcao || '0'}</td><td style={{ textAlign: 'center' }}>{valor.vd || '0'}</td></tr>;
                                })}
                            </tbody>
                        </table>
                        <div style={{ padding: compacto ? 1 : 3, fontSize: compacto ? 4.5 : 6.5 }}>*Percentual de valores diários fornecidos pela porção.</div>
                    </div>
                    {dados.modoPreparo && <div style={{ marginTop: compacto ? 2 : 5, lineHeight: 1.2 }}><strong>MODO DE PREPARO:</strong> {dados.modoPreparo}</div>}
                    {dados.conservacao && <div style={{ marginTop: compacto ? 2 : 5 }}><strong>CONSERVAÇÃO:</strong> {dados.conservacao}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: compacto ? 2 : 5, paddingTop: compacto ? 2 : 4, borderTop: '1px solid #111' }}>
                        <span>Fab.: {dados.dataImpressao ? new Date(dados.dataImpressao + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}</span>
                        <strong>Val.: {dados.validade ? new Date(dados.validade + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}</strong>
                        <span>Lote: {dados.sku || '--'}</span>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ display: 'flex', height: compacto ? 14 : 28, width: '90%', justifyContent: 'center', overflow: 'hidden' }}>
                            {barrasAlimento.map((barra, index) => <div key={index} style={{ width: `${(barra.w / totalBarrasAlimento) * 100}%`, flexShrink: 0, background: barra.dark ? '#111' : 'transparent' }} />)}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 7, letterSpacing: '0.16em' }}>{codigoAlimento || 'CÓDIGO DE BARRAS'}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-color-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Pré-visualização — {dados.tamanho} mm
            </span>
            <div style={{
                width: w, height: h, border: '2px solid #cbd5e1', borderRadius: 8,
                background: '#fff', display: 'flex', flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                fontFamily: '"Courier New", monospace', overflow: 'hidden', position: 'relative',
            }}>
                {/* Faixa azul topo */}
                <div style={{ background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)', padding: is40 ? '5px 8px' : '7px 10px', flexShrink: 0 }}>
                    <div style={{ color: '#fff', fontSize: is40 ? '0.62rem' : '0.72rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.01em' }}>
                        {dados.nomeProduto || 'Nome do Produto'}
                    </div>
                    {dados.categoria && (
                        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: is40 ? '0.5rem' : '0.58rem', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {dados.categoria}
                        </div>
                    )}
                </div>

                {/* Corpo */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: is40 ? '5px 8px' : '7px 10px', justifyContent: 'space-between' }}>
                    {/* SKU + Preço */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                        {dados.sku && (
                            <div>
                                <div style={{ fontSize: is40 ? '0.46rem' : '0.52rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU</div>
                                <div style={{ fontSize: is40 ? '0.56rem' : '0.64rem', fontWeight: 700, color: '#334155' }}>{dados.sku}</div>
                            </div>
                        )}
                        {dados.preco && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: is40 ? '0.46rem' : '0.52rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preço</div>
                                <div style={{ fontSize: is40 ? '0.72rem' : '0.84rem', fontWeight: 800, color: '#1976d2' }}>
                                    {Number(dados.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Código de barras */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center', margin: '2px 0' }}>
                        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', height: barHeight, overflow: 'hidden', width: '100%', justifyContent: 'center' }}>
                            {barras.map((b, i) => (
                                <div key={i} style={{ width: b.w, flexShrink: 0, background: b.dark ? '#111827' : 'transparent' }} />
                            ))}
                        </div>
                        <div style={{ fontSize: is40 ? '0.46rem' : '0.52rem', color: '#475569', letterSpacing: '0.12em', marginTop: 2, textAlign: 'center' }}>
                            {codigoExibido || (dados.sku ? dados.sku : '· · · · · ·')}
                        </div>
                        {dados.usarCodigoBarrasProduto && dados.codigoBarras && (
                            <div style={{ fontSize: is40 ? '0.4rem' : '0.46rem', color: '#1976d2', marginTop: 1, fontWeight: 600, letterSpacing: '0.04em' }}>
                                ✓ Cód. produto vinculado
                            </div>
                        )}
                    </div>

                    {/* Rodapé datas */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: 3, marginTop: 2 }}>
                        <span style={{ fontSize: is40 ? '0.44rem' : '0.5rem', color: '#94a3b8' }}>
                            Imp: {dados.dataImpressao ? new Date(dados.dataImpressao + 'T12:00:00').toLocaleDateString('pt-BR') : 'dd/mm/aaaa'}
                        </span>
                        {dados.validade && (
                            <span style={{ fontSize: is40 ? '0.44rem' : '0.5rem', color: '#ef4444', fontWeight: 700 }}>
                                Val: {new Date(dados.validade + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const UNIDADES_INTEIRAS_FULL = ['UN', 'CX', 'PC', 'DZ', 'CT', 'PCT', 'G', ''];
const isUnidadeInteira = (un?: string | null) => UNIDADES_INTEIRAS_FULL.includes((un ?? '').toUpperCase().trim());
const isUnidadeEmbalagem = (un?: string | null) => ['CX', 'CAIXA', 'CAIXAS', 'PCT', 'PACOTE', 'PACOTES'].includes((un ?? '').toUpperCase().trim());
const rotuloEmbalagem = (un?: string | null) =>
    ['PCT', 'PACOTE', 'PACOTES'].includes((un ?? '').toUpperCase().trim()) ? 'pacote' : 'caixa';
const pluralEmbalagem = (un?: string | null) => rotuloEmbalagem(un) === 'pacote' ? 'pacotes' : 'caixas';
const perguntaQuantidadeEmbalagem = (un?: string | null) =>
    rotuloEmbalagem(un) === 'pacote' ? 'Quantos pacotes' : 'Quantas caixas';
const artigoEmbalagem = (un?: string | null) => rotuloEmbalagem(un) === 'pacote' ? 'o pacote' : 'a caixa';
const posseEmbalagem = (un?: string | null) => rotuloEmbalagem(un) === 'pacote' ? 'do pacote' : 'da caixa';
const referenciaEmbalagem = (un?: string | null) => rotuloEmbalagem(un) === 'pacote' ? 'deste pacote' : 'desta caixa';
const produtoEhEmbalagemCadastrada = (produto: Product) => [
    produto.unidade_medida,
    produto.unidade_comercial,
    produto.unidade_tributavel,
].some(isUnidadeEmbalagem);
const fmtQtd = (v: number | string | undefined | null, unidade?: string | null) => {
    const n = Number(v ?? 0);
    if (isNaN(n)) return String(v ?? '');
    if (isUnidadeInteira(unidade)) return Math.round(n).toLocaleString('pt-BR');
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};
const dataIsoParaDate = (valor?: string | null) => {
    if (!valor) return null;
    const [ano, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!ano || !mes || !dia) return null;
    return new Date(ano, mes - 1, dia, 12, 0, 0);
};

const EstoquePage = () => {
    const toast = useRef<Toast>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);
    const precoCompraInputRef = useRef<HTMLInputElement>(null);
    const minQtyInputRef = useRef<HTMLInputElement>(null);
    const curQtyInputRef = useRef<HTMLInputElement>(null);

    // Reposiciona cursor antes da vírgula decimal após re-render do InputNumber controlado.
    // Sem isso, ao digitar "3" o cursor vai para o final de "3,00" e o "0" seguinte não produz efeito.
    const fixCursor = (ref: React.RefObject<HTMLInputElement>) => {
        // O campo mobile mantém o texto sem máscara enquanto está focado. Aplicar
        // este ajuste nele move o cursor para uma posição inválida e interrompe a
        // digitação após o primeiro caractere.
        if (typeof window !== 'undefined' && (
            navigator.maxTouchPoints > 0
            || 'ontouchstart' in window
            || window.matchMedia?.('(pointer: coarse)').matches
        )) return;
        requestAnimationFrame(() => {
            const el = ref.current;
            if (!el || document.activeElement !== el) return;
            const comma = el.value.lastIndexOf(',');
            if (comma > 0) el.setSelectionRange(comma, comma);
        });
    };

    const [products, setProducts] = useState<Product[]>([]);
    const [stockLocationsDialog, setStockLocationsDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [xmlFile, setXmlFile] = useState<File | null>(null);
    const [xmlPreview, setXmlPreview] = useState<FiscalImportPreview | null>(null);
    const [xmlLinkDialog, setXmlLinkDialog] = useState(false);
    const [xmlImportando, setXmlImportando] = useState(false);
    const [formDialog, setFormDialog] = useState(false);
    const [form, setForm] = useState<Omit<Product, 'id'>>(initialForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [sugestoesProdutosMesmoNome, setSugestoesProdutosMesmoNome] = useState<Product[]>([]);
    const [tipoPrecoVenda, setTipoPrecoVenda] = useState<TipoPrecoVenda>('valor');
    const [percentualLucro, setPercentualLucro] = useState<number | null>(null);

    const unidadeSelecionada = form.unidade_medida
        || form.unidade_comercial
        || form.unidade_tributavel
        || '';
    const produtoEhEmbalagem = [
        form.unidade_medida,
        form.unidade_comercial,
        form.unidade_tributavel,
    ].some(isUnidadeEmbalagem);
    const tipoEmbalagemSelecionada = rotuloEmbalagem(unidadeSelecionada);
    const isUnitInteger = isUnidadeInteira(unidadeSelecionada);
    const produtoComMesmoNome = form.name.trim()
        ? products.find(produto =>
            produto.id !== editingId
            && normalizarBuscaProduto(produto.name) === normalizarBuscaProduto(form.name)
        )
        : undefined;
    const qtyDecimals = isUnitInteger ? 0 : 3;
    const qtyStep = isUnitInteger ? 1 : 0.001;
    const showPeso = !isUnitInteger;

    const [caixaQtdUnidades, setCaixaQtdUnidades] = useState<number | null>(null);
    const custoCompraCaixa = form.is_materia_prima ? Number(form.price || 0) : Number(form.preco_compra || 0);
    const caixaCustoUnitario = (caixaQtdUnidades && caixaQtdUnidades > 0 && custoCompraCaixa > 0)
        ? Number((custoCompraCaixa / caixaQtdUnidades).toFixed(2)) : null;
    const caixaPrecoVendaUnitario = (
        !form.is_materia_prima
        && caixaQtdUnidades
        && caixaQtdUnidades > 0
        && Number(form.price) > 0
    ) ? Number((Number(form.price) / caixaQtdUnidades).toFixed(2)) : null;
    const [produtoUnitarioPendente, setProdutoUnitarioPendente] = useState<ProdutoUnitarioPendente | null>(null);
    const [produtoUnitarioDialog, setProdutoUnitarioDialog] = useState(false);
    const [nomeProdutoUnitario, setNomeProdutoUnitario] = useState('');
    const [tipoPrecoVendaUnitario, setTipoPrecoVendaUnitario] = useState<TipoPrecoVenda>('valor');
    const [precoVendaUnitarioInformado, setPrecoVendaUnitarioInformado] = useState<number | null>(null);
    const [percentualLucroUnitario, setPercentualLucroUnitario] = useState<number | null>(null);
    const [salvandoProdutoUnitario, setSalvandoProdutoUnitario] = useState(false);
    const produtoUnitarioSubmitRef = useRef(false);
    const precoVendaUnitario = tipoPrecoVendaUnitario === 'percentual'
        ? calcularPrecoComLucro(produtoUnitarioPendente?.custoUnitario, percentualLucroUnitario)
        : Number(precoVendaUnitarioInformado || 0);
    const precoVendaUnitarioValido = precoVendaUnitario > 0
        && (tipoPrecoVendaUnitario === 'valor' || percentualLucroUnitario !== null);

    const [nameFilter, setNameFilter] = useState('');
    const [codeFilter, setCodeFilter] = useState('');
    const [minPrice, setMinPrice] = useState<number | null>(null);
    const [maxPrice, setMaxPrice] = useState<number | null>(null);
    const [stockStatusFilter, setStockStatusFilter] = useState<string | null>(null);

    const [movimentos, setMovimentos] = useState<Movimento[]>([]);
    const [inventarioDialog, setInventarioDialog] = useState(false);
    const [contagem, setContagem] = useState<Record<number, number>>({});
    const [inventarioSearch, setInventarioSearch] = useState('');

    // ── Histórico por produto ─────────────────────────────────────────────────
    const [histProdDialog, setHistProdDialog] = useState(false);
    const [histProdNome, setHistProdNome] = useState('');
    const [histProdUnidade, setHistProdUnidade] = useState<string | null>(null);
    const [histProdSaldoAtual, setHistProdSaldoAtual] = useState<number | null>(null);
    const [histProdMovs, setHistProdMovs] = useState<Movimento[]>([]);
    const [histProdCustos, setHistProdCustos] = useState<HistoricoCustoEntrada[]>([]);
    const [histProdCustoAtual, setHistProdCustoAtual] = useState<number | null>(null);
    const [histProdLoading, setHistProdLoading] = useState(false);

    // ── Alerta estoque mínimo ─────────────────────────────────────────────────
    const [alertaEstoqueVisivel, setAlertaEstoqueVisivel] = useState(false);

    // ── Categorias ────────────────────────────────────────────────────────────
    const [categorias, setCategorias] = useState<{ id: number; nome: string }[]>([]);
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loadingFornecedores, setLoadingFornecedores] = useState(false);
    const [novaCatDialog, setNovaCatDialog] = useState(false);
    const [novaCatNome, setNovaCatNome] = useState('');
    const [novaCatDestino, setNovaCatDestino] = useState<'produto' | 'etiqueta'>('produto');
    const [catManagerDialog, setCatManagerDialog] = useState(false);
    const [editCatId, setEditCatId] = useState<number | null>(null);
    const [editCatNome, setEditCatNome] = useState('');

    // ── Relatório de giro ─────────────────────────────────────────────────────
    const [giroDialog, setGiroDialog] = useState(false);
    const [giroPeriodo, setGiroPeriodo] = useState<'semana' | 'mes' | 'ano' | 'custom'>('mes');
    const [giroDataInicio, setGiroDataInicio] = useState<Date | null>(null);
    const [giroDataFim, setGiroDataFim] = useState<Date | null>(null);

    // ── Relatório de desperdícios ───────────────────────────────────────────
    const [desperdicioDialog, setDesperdicioDialog] = useState(false);
    const [desperdicioPeriodo, setDesperdicioPeriodo] = useState<'dia' | 'semana' | 'mes' | 'personalizado'>('mes');
    const [desperdicioDataInicio, setDesperdicioDataInicio] = useState('');
    const [desperdicioDataFim, setDesperdicioDataFim] = useState('');
    const [desperdicioRelatorio, setDesperdicioRelatorio] = useState<DesperdicioRelatorio | null>(null);
    const [desperdicioLoading, setDesperdicioLoading] = useState(false);

    // ── Justificativas de ajuste de inventário ────────────────────────────────
    const [justificativas, setJustificativas] = useState<Record<number, string>>({});

    // ── Autenticação do responsável pelo inventário ───────────────────────────
    const [invAuthDialog, setInvAuthDialog] = useState(false);
    const [invResponsavelId, setInvResponsavelId] = useState<number | null>(null);
    const [invResponsavelNome, setInvResponsavelNome] = useState('');
    const [invSenha, setInvSenha] = useState('');
    const [invVerificando, setInvVerificando] = useState(false);
    const [invUsuarios, setInvUsuarios] = useState<{ id: number; nome: string }[]>([]);

    // ── Etiquetas ──
    const [etiquetaDialog, setEtiquetaDialog] = useState(false);
    const [historicoDialog, setHistoricoDialog] = useState(false);
    const [etiquetaForm, setEtiquetaForm] = useState(etiquetaVazia);
    const [historicoEtiquetas, setHistoricoEtiquetas] = useState<Etiqueta[]>([]);
    const [etiquetaEditando, setEtiquetaEditando] = useState<Etiqueta | null>(null);
    const [etiquetaProdutoId, setEtiquetaProdutoId] = useState(0);

    // ── Granel ──
    const [granelDialog, setGranelDialog] = useState(false);
    const [granelProduto, setGranelProduto] = useState<Product | null>(null);
    const [granelNome, setGranelNome] = useState('');
    const [granelUnidade, setGranelUnidade] = useState<string>('ML');
    const [granelPreco100, setGranelPreco100] = useState<number>(0);
    const [granelSalvando, setGranelSalvando] = useState(false);

    // ── Transferência Granel ──
    const [transDialog, setTransDialog] = useState(false);
    const [transProdutoGranel, setTransProdutoGranel] = useState<Product | null>(null);
    const [transProdutoOrigem, setTransProdutoOrigem] = useState<Product | null>(null);
    const [transQtdSaida, setTransQtdSaida] = useState<number>(0);
    const [transQtdEntrada, setTransQtdEntrada] = useState<number>(0);
    const [transSalvando, setTransSalvando] = useState(false);

    // ── Transferência Caixa → Unidade ──
    const [transCaixaDialog, setTransCaixaDialog] = useState(false);
    const [transProdutoCaixa, setTransProdutoCaixa] = useState<Product | null>(null);
    const [transProdutoUnidade, setTransProdutoUnidade] = useState<Product | null>(null);
    const [transQtdCaixas, setTransQtdCaixas] = useState<number | null>(null);
    const [transCaixaSalvando, setTransCaixaSalvando] = useState(false);
    const transCaixaSubmitRef = useRef(false);
    const transCaixasDisponiveis = Math.floor(Number(transProdutoCaixa?.currentQuantity || 0));
    const transCaixasExcedeEstoque = Number(transQtdCaixas || 0) > transCaixasDisponiveis;

    const carregarHistoricoEtiquetas = () => {
        const empresaId = obterEmpresaIdAtual();
        const chave = chaveHistoricoEtiquetas();
        if (!empresaId || !chave) {
            setHistoricoEtiquetas([]);
            return;
        }
        try {
            const lista = JSON.parse(localStorage.getItem(chave) ?? '[]') as Etiqueta[];
            setHistoricoEtiquetas(lista.filter(etiqueta => Number(etiqueta.empresa_id) === empresaId));
        } catch {
            setHistoricoEtiquetas([]);
        }
    };

    const salvarHistoricoEtiquetas = (lista: Etiqueta[]) => {
        const empresaId = obterEmpresaIdAtual();
        const chave = chaveHistoricoEtiquetas();
        if (!empresaId || !chave) return false;
        const listaDaEmpresa = lista.filter(etiqueta => Number(etiqueta.empresa_id) === empresaId);
        localStorage.setItem(chave, JSON.stringify(listaDaEmpresa));
        setHistoricoEtiquetas(listaDaEmpresa);
        return true;
    };

    const abrirHistoricoEtiquetas = () => {
        if (!obterEmpresaIdAtual()) {
            toast.current?.show({ severity: 'warn', summary: 'Selecione uma empresa', detail: 'Escolha uma empresa para acessar o histórico de etiquetas.', life: 3500 });
            return;
        }
        carregarHistoricoEtiquetas();
        setHistoricoDialog(true);
    };

    useEffect(() => { fetchProducts(); fetchMovimentos(); carregarHistoricoEtiquetas(); fetchCategorias(); fetchFornecedores(); }, []);

    const fetchFornecedores = async () => {
        setLoadingFornecedores(true);
        try {
            const res = await api.get('/fornecedores');
            const lista = res.data?.data ?? res.data ?? [];
            setFornecedores(Array.isArray(lista) ? lista : []);
        } catch {
            setFornecedores([]);
        } finally {
            setLoadingFornecedores(false);
        }
    };

    const fetchCategorias = async () => {
        try {
            const res = await api.get('/product-categories');
            setCategorias(Array.isArray(res.data) ? res.data : []);
        } catch { /* silencioso */ }
    };

    const salvarNovaCategoria = async () => {
        if (!novaCatNome.trim()) return;
        try {
            const res = await api.post('/product-categories', { nome: novaCatNome.trim() });
            const nova = res.data;
            setCategorias(prev => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
            if (novaCatDestino === 'etiqueta') {
                setEtiquetaForm(prev => ({ ...prev, categoria: nova.nome }));
            } else {
                f('category', nova.nome);
            }
            setNovaCatNome('');
            setNovaCatDialog(false);
            showSuccess(`Categoria "${nova.nome}" criada!`);
        } catch (err: any) {
            showError(err?.response?.data?.error || 'Erro ao criar categoria');
        }
    };

    const salvarEdicaoCategoria = async () => {
        if (!editCatNome.trim() || editCatId === null) return;
        try {
            const res = await api.put(`/product-categories/${editCatId}`, { nome: editCatNome.trim() });
            setCategorias(prev => prev.map(c => c.id === editCatId ? res.data : c).sort((a, b) => a.nome.localeCompare(b.nome)));
            setEditCatId(null);
            setEditCatNome('');
            showSuccess('Categoria atualizada!');
        } catch (err: any) {
            showError(err?.response?.data?.error || 'Erro ao atualizar categoria');
        }
    };

    const excluirCategoria = (cat: { id: number; nome: string }) => {
        confirmDialog({
            message: `Excluir a categoria "${cat.nome}"? Os produtos com essa categoria não serão afetados.`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Excluir',
            rejectLabel: 'Cancelar',
            accept: async () => {
                try {
                    await api.delete(`/product-categories/${cat.id}`);
                    setCategorias(prev => prev.filter(c => c.id !== cat.id));
                    showSuccess(`Categoria "${cat.nome}" excluída!`);
                } catch (err: any) {
                    showError(err?.response?.data?.error || 'Erro ao excluir categoria');
                }
            }
        });
    };

    const adicionarCategoriaNoManager = async () => {
        if (!novaCatNome.trim()) return;
        try {
            const res = await api.post('/product-categories', { nome: novaCatNome.trim() });
            setCategorias(prev => [...prev, res.data].sort((a, b) => a.nome.localeCompare(b.nome)));
            setNovaCatNome('');
            showSuccess(`Categoria "${res.data.nome}" criada!`);
        } catch (err: any) {
            showError(err?.response?.data?.error || 'Erro ao criar categoria');
        }
    };

    const fetchProducts = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await productService.getAll();
            setProducts(Array.isArray(data) ? data : []);
        } catch (err: any) {
            showError(err?.message || 'Erro ao carregar produtos');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchMovimentos = async () => {
        try {
            const res = await api.get('/movimentos');
            setMovimentos(Array.isArray(res.data) ? res.data : []);
        } catch { /* silencioso */ }
    };

    const sincronizarEstoque = async () => {
        await Promise.all([fetchProducts(true), fetchMovimentos()]);
    };

    const registrarMovimento = (_m: any) => { /* no-op — backend cria automaticamente */ };

    const showSuccess = (m: string) => toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: m, life: 3000 });
    const showError = (m: string) => toast.current?.show({ severity: 'error', summary: 'Erro', detail: m, life: 3000 });
    const fmtMoeda = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtData = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const toDateOnly = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const consultarDesperdicios = async () => {
        if (desperdicioPeriodo === 'personalizado' && (!desperdicioDataInicio || !desperdicioDataFim)) {
            showError('Informe a data inicial e a data final');
            return;
        }
        setDesperdicioLoading(true);
        try {
            const params: Record<string, string> = { periodo: desperdicioPeriodo };
            if (desperdicioPeriodo === 'personalizado') {
                params.dataInicio = desperdicioDataInicio;
                params.dataFim = desperdicioDataFim;
            }
            const res = await api.get('/producao/relatorios/desperdicios', { params });
            setDesperdicioRelatorio(res.data);
        } catch (err: any) {
            setDesperdicioRelatorio(null);
            showError(err?.response?.data?.error || 'Erro ao carregar relatório de desperdícios');
        } finally {
            setDesperdicioLoading(false);
        }
    };

    const abrirRelatorioDesperdicios = () => {
        setDesperdicioDialog(true);
        void consultarDesperdicios();
    };

    const baixarPdfDesperdicios = (relatorio: DesperdicioRelatorio | null) => {
        if (!relatorio) return;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18);
        doc.text('Relatorio de Desperdicios', 14, 18);
        doc.setFontSize(10);
        doc.text(`Periodo: ${relatorio.dataInicio.split('-').reverse().join('/')} a ${relatorio.dataFim.split('-').reverse().join('/')}`, 14, 26);
        doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);
        doc.setFontSize(11);
        doc.text(`Custo estimado dos excedentes: ${fmtMoeda(relatorio.resumo.totalCustoEstimado)} | Ocorrencias: ${relatorio.resumo.totalOcorrencias} | Quantidade: ${relatorio.resumo.totalQuantidade.toLocaleString('pt-BR')}`, 14, 42);

        autoTable(doc, {
            startY: 48,
            head: [['Produto / MP', 'Qtd.', 'Custo unitario', 'Custo estimado', 'Ocorrencias']],
            body: relatorio.resumo.porProduto.map(item => [
                item.produtoNome,
                `${item.quantidade.toLocaleString('pt-BR')} ${item.unidade}`,
                item.custoUnitario > 0 ? fmtMoeda(item.custoUnitario) : 'Sem custo',
                item.custoEstimado > 0 ? fmtMoeda(item.custoEstimado) : 'R$ 0,00',
                String(item.ocorrencias),
            ]),
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28], textColor: 255 },
            styles: { fontSize: 8 },
        });

        const resumoFinalY = (doc as any).lastAutoTable?.finalY ?? 56;
        autoTable(doc, {
            startY: resumoFinalY + 10,
            head: [['Data', 'Produto / MP', 'Qtd.', 'Custo unitario', 'Custo estimado', 'Receita', 'Ordem', 'Classificacao', 'Observacao']],
            body: relatorio.itens.map(item => [
                fmtData(item.data),
                item.produtoNome,
                `${item.quantidade.toLocaleString('pt-BR')} ${item.unidade}`,
                item.custoUnitario > 0 ? fmtMoeda(item.custoUnitario) : 'Sem custo',
                item.custoEstimado > 0 ? fmtMoeda(item.custoEstimado) : 'R$ 0,00',
                item.receitaNome,
                item.ordemId ? `#${item.ordemId}` : '-',
                item.classificacaoLabel || labelClassificacaoDesperdicio(item.classificacao),
                item.observacao || item.motivo,
            ]),
            theme: 'striped',
            headStyles: { fillColor: [55, 65, 81], textColor: 255 },
            styles: { fontSize: 7 },
        });
        doc.save(`relatorio_desperdicios_${relatorio.dataInicio}_${relatorio.dataFim}.pdf`);
    };
    const f = (k: keyof typeof initialForm, v: any) => {
        setForm(prev => ({ ...prev, [k]: v }));
        if (formErrors[k]) setFormErrors(prev => ({ ...prev, [k]: '' }));
    };

    const buscarProdutosMesmoNome = (query: string) => {
        const busca = normalizarBuscaProduto(query);
        if (!busca) {
            setSugestoesProdutosMesmoNome([]);
            return;
        }

        const termos = busca.split(/\s+/).filter(Boolean);
        setSugestoesProdutosMesmoNome(
            products
                .filter(produto => {
                    if (produto.id === editingId) return false;
                    const nome = normalizarBuscaProduto(produto.name);
                    return termos.every(termo => nome.includes(termo));
                })
                .sort((a, b) => {
                    const nomeA = normalizarBuscaProduto(a.name);
                    const nomeB = normalizarBuscaProduto(b.name);
                    const aComeca = nomeA.startsWith(busca) ? 0 : 1;
                    const bComeca = nomeB.startsWith(busca) ? 0 : 1;
                    return aComeca - bComeca || nomeA.localeCompare(nomeB, 'pt-BR');
                })
                .slice(0, 8)
        );
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!form.name || form.name.trim() === '') errors.name = 'Nome é obrigatório';
        const precoObrigatorio = form.is_materia_prima || !produtoEhEmbalagem;
        if (precoObrigatorio && (form.price === undefined || form.price === null || form.price <= 0)) {
            errors.price = 'Preço de venda deve ser maior que zero';
        }
        if (form.preco_compra !== undefined && form.preco_compra < 0) errors.preco_compra = 'Preço de compra não pode ser negativo';
        if (!produtoEhEmbalagem && !form.is_materia_prima && tipoPrecoVenda === 'percentual' && percentualLucro === null) {
            errors.percentualLucro = 'Informe o percentual de margem de lucro';
        }
        if (!produtoEhEmbalagem && !form.is_materia_prima && tipoPrecoVenda === 'percentual' && percentualLucro !== null && percentualLucro >= 100) {
            errors.percentualLucro = 'A margem de lucro deve ser menor que 100%';
        }
        if (form.currentQuantity < 0) errors.currentQuantity = 'Quantidade atual não pode ser negativa';
        if (form.minQuantity < 0) errors.minQuantity = 'Quantidade mínima não pode ser negativa';
        if (form.peso_bruto !== undefined && form.peso_bruto < 0) errors.peso_bruto = 'Peso bruto não pode ser negativo';
        if (form.peso_liquido !== undefined && form.peso_liquido < 0) errors.peso_liquido = 'Peso líquido não pode ser negativo';

        const validateAliquota = (value: number | undefined, field: string) => {
            if (value !== undefined && (value < 0 || value > 100)) errors[field] = 'Deve estar entre 0 e 100';
        };
        validateAliquota(form.aliquota_icms, 'aliquota_icms');
        validateAliquota(form.aliquota_pis, 'aliquota_pis');
        validateAliquota(form.aliquota_cofins, 'aliquota_cofins');
        validateAliquota(form.aliquota_ipi, 'aliquota_ipi');

        if (form.ncm && !/^\d{8}$/.test(form.ncm)) errors.ncm = 'NCM deve ter 8 dígitos numéricos';
        if (form.cfop && !/^\d{4}$/.test(form.cfop)) errors.cfop = 'CFOP deve ter 4 dígitos numéricos';
        if (form.cest && !/^\d{7}$/.test(form.cest)) errors.cest = 'CEST deve ter 7 dígitos numéricos';
        if (form.ibs_cbs_situacao_tributaria && !/^\d{3}$/.test(form.ibs_cbs_situacao_tributaria)) 
            { errors.ibs_cbs_situacao_tributaria = 'CST IBS/CBS deve ter exatamente 3 dígitos'; }
        if (form.ibs_cbs_classificacao_tributaria && !/^\d{6}$/.test(form.ibs_cbs_classificacao_tributaria)) 
            { errors.ibs_cbs_classificacao_tributaria = 'Classificação IBS/CBS deve ter exatamente 6 dígitos'; }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const abrirNovoProduto = () => {
        setForm(initialForm);
        setSugestoesProdutosMesmoNome([]);
        setPercentualLucro(null);
        setEditingId(null);
        setFormErrors({});
        setCaixaQtdUnidades(null);
        setTipoPrecoVenda('valor');
        setPercentualLucro(null);
        setFormDialog(true);
    };

    const editarProduto = (p: Product) => {
        setSugestoesProdutosMesmoNome([]);
        const modoPreco: TipoPrecoVenda = p.tipo_preco_venda === 'percentual' ? 'percentual' : 'valor';
        const lucroSalvo = p.percentual_lucro === null || p.percentual_lucro === undefined
            ? null
            : numeroSeguro(p.percentual_lucro);
        setCaixaQtdUnidades(p.unidades_por_caixa ? numeroSeguro(p.unidades_por_caixa) : null);
        setTipoPrecoVenda(modoPreco);
        setPercentualLucro(lucroSalvo);
        setForm({
            name: p.name, code: p.code || '', fornecedor_id: p.fornecedor_id ?? null,
            category: p.category || '', origem: p.origem ?? 0,
            is_materia_prima: p.is_materia_prima ?? false,
            unidade_medida: p.unidade_medida || '', unidade_comercial: p.unidade_comercial || '',
            unidade_tributavel: p.unidade_tributavel || '',
            unidades_por_caixa: p.unidades_por_caixa ? numeroSeguro(p.unidades_por_caixa) : null,
            price: numeroSeguro(p.price), preco_compra: numeroSeguro(p.preco_compra),
            tipo_preco_venda: modoPreco, percentual_lucro: lucroSalvo,
            minQuantity: numeroSeguro(p.minQuantity), currentQuantity: numeroSeguro(p.currentQuantity),
            lote: p.lote || '', data_validade: p.data_validade || null,
            peso_bruto: numeroSeguro(p.peso_bruto), peso_liquido: numeroSeguro(p.peso_liquido),
            ncm: p.ncm || '', cfop: p.cfop || '', cest: p.cest || '',
            cst_csosn: p.cst_csosn || '',
            aliquota_icms: numeroSeguro(p.aliquota_icms), aliquota_pis: numeroSeguro(p.aliquota_pis),
            aliquota_cofins: numeroSeguro(p.aliquota_cofins), aliquota_ipi: numeroSeguro(p.aliquota_ipi),
            codigo_barras: p.codigo_barras || '',
            cst_pis: p.cst_pis || '07',
            cst_cofins: p.cst_cofins || '07',
            ibs_cbs_situacao_tributaria: p.ibs_cbs_situacao_tributaria || '',
            ibs_cbs_classificacao_tributaria: p.ibs_cbs_classificacao_tributaria || '',
        });
        setEditingId(p.id);
        setFormErrors({});
        setFormDialog(true);
    };

    const atualizarPrecoCompra = (valor: number | null) => {
        setForm(prev => ({
            ...prev,
            preco_compra: valor ?? 0,
            price: !prev.is_materia_prima && tipoPrecoVenda === 'percentual'
                ? calcularPrecoComLucro(valor, percentualLucro)
                : prev.price,
            tipo_preco_venda: tipoPrecoVenda,
            percentual_lucro: tipoPrecoVenda === 'percentual' ? percentualLucro : null,
        }));
        setFormErrors(prev => ({ ...prev, preco_compra: '', price: '' }));
    };

    const atualizarUnidadeProduto = (unidade: string | null) => {
        const valor = unidade || '';
        setForm(prev => ({
            ...prev,
            unidade_medida: valor,
            unidade_comercial: valor,
            unidade_tributavel: valor,
            unidades_por_caixa: isUnidadeEmbalagem(valor) ? prev.unidades_por_caixa : null,
        }));
        if (!isUnidadeEmbalagem(valor)) setCaixaQtdUnidades(null);
    };

    const alterarTipoPrecoVenda = (tipo: TipoPrecoVenda) => {
        setTipoPrecoVenda(tipo);
        setForm(prev => ({
            ...prev,
            tipo_preco_venda: tipo,
            percentual_lucro: tipo === 'percentual' ? percentualLucro : null,
            ...(tipo === 'percentual' ? {
                price: calcularPrecoComLucro(prev.preco_compra, percentualLucro),
            } : {}),
        }));
        setFormErrors(prev => ({ ...prev, price: '' }));
    };

    const atualizarPercentualLucro = (percentual: number | null) => {
        setPercentualLucro(percentual);
        setForm(prev => ({
            ...prev,
            price: calcularPrecoComLucro(prev.preco_compra, percentual),
            tipo_preco_venda: 'percentual',
            percentual_lucro: percentual,
        }));
        setFormErrors(prev => ({ ...prev, price: '', percentualLucro: '' }));
    };

    const fecharProdutoUnitario = () => {
        setProdutoUnitarioDialog(false);
        setProdutoUnitarioPendente(null);
        setNomeProdutoUnitario('');
        setTipoPrecoVendaUnitario('valor');
        setPrecoVendaUnitarioInformado(null);
        setPercentualLucroUnitario(null);
    };

    const abrirProdutoUnitario = async (caixa: Product) => {
        const unidadeOrigem = caixa.unidade_medida || caixa.unidade_comercial || caixa.unidade_tributavel;
        const tipoOrigem = rotuloEmbalagem(unidadeOrigem);
        const quantidadePorCaixa = Number(caixa.unidades_por_caixa);
        if (!Number.isInteger(quantidadePorCaixa) || quantidadePorCaixa <= 0) {
            showError(`Edite ${artigoEmbalagem(unidadeOrigem)} e informe quantas unidades existem ${tipoOrigem === 'pacote' ? 'nele' : 'nela'} antes de criar o produto unitário.`);
            return;
        }

        const produtoUnitarioExistente = products.find(
            produto => Number(produto.caixa_origem_id) === caixa.id
        );
        if (produtoUnitarioExistente) {
            abrirTransferenciaCaixa(produtoUnitarioExistente);
            return;
        }

        const codigoUnitarioLegado = caixa.code ? `${caixa.code}-UN` : null;
        const nomeUnitarioLegado = `${caixa.name} (UN)`.trim().toLocaleLowerCase('pt-BR');
        const produtoUnitarioLegado = products.find(produto =>
            (codigoUnitarioLegado && produto.code === codigoUnitarioLegado)
            || produto.name.trim().toLocaleLowerCase('pt-BR') === nomeUnitarioLegado
        );
        if (produtoUnitarioLegado) {
            try {
                const res = await api.post('/products/vincular-unidade-caixa', {
                    origem_id: caixa.id,
                    unidade_id: produtoUnitarioLegado.id,
                });
                const unidadeVinculada = res.data as Product;
                setProducts(prev => prev.map(produto =>
                    produto.id === unidadeVinculada.id ? unidadeVinculada : produto
                ));
                showSuccess(`Produto unitário existente vinculado ${tipoOrigem === 'pacote' ? 'ao pacote' : 'à caixa'}. O estoque anterior foi preservado.`);
                setTransProdutoCaixa(caixa);
                setTransProdutoUnidade(unidadeVinculada);
                setTransQtdCaixas(null);
                setTransCaixaDialog(true);
                void sincronizarEstoque();
                return;
            } catch (err: any) {
                showError(err?.response?.data?.error || 'Erro ao vincular o produto unitário existente');
                return;
            }
        }

        const { id, ...dadosCaixa } = caixa;
        const custoCaixa = caixa.is_materia_prima
            ? Number(caixa.price || 0)
            : Number(caixa.preco_compra || 0);
        setProdutoUnitarioPendente({
            dadosCaixa,
            caixaOrigemId: id,
            quantidadePorCaixa,
            custoUnitario: Number((custoCaixa / quantidadePorCaixa).toFixed(2)),
        });
        setNomeProdutoUnitario(`${caixa.name} (UN)`);
        setTipoPrecoVendaUnitario('valor');
        setPrecoVendaUnitarioInformado(null);
        setPercentualLucroUnitario(null);
        setProdutoUnitarioDialog(true);
    };

    const criarProdutoUnitario = async () => {
        if (produtoUnitarioSubmitRef.current) return;
        if (!produtoUnitarioPendente || !nomeProdutoUnitario.trim() || !precoVendaUnitarioValido) {
            showError('Informe o nome e um preço de venda válido para o produto unitário.');
            return;
        }

        const { dadosCaixa, caixaOrigemId, quantidadePorCaixa, custoUnitario } = produtoUnitarioPendente;
        produtoUnitarioSubmitRef.current = true;
        setSalvandoProdutoUnitario(true);
        try {
            const payloadUn = {
                ...dadosCaixa,
                name: nomeProdutoUnitario.trim(),
                code: dadosCaixa.code ? `${dadosCaixa.code}-UN` : null,
                unidade_medida: 'UN',
                unidade_comercial: 'UN',
                unidade_tributavel: 'UN',
                unidades_por_caixa: null,
                caixa_origem_id: caixaOrigemId,
                price: precoVendaUnitario,
                preco_compra: custoUnitario,
                tipo_preco_venda: tipoPrecoVendaUnitario,
                percentual_lucro: tipoPrecoVendaUnitario === 'percentual' ? percentualLucroUnitario : null,
                currentQuantity: 0,
                minQuantity: 0,
                peso_bruto: dadosCaixa.peso_bruto ? Number((dadosCaixa.peso_bruto / quantidadePorCaixa).toFixed(4)) : 0,
                peso_liquido: dadosCaixa.peso_liquido ? Number((dadosCaixa.peso_liquido / quantidadePorCaixa).toFixed(4)) : 0,
                fabricante: dadosCaixa.fabricante?.trim() || null,
                lote: dadosCaixa.lote?.trim() || null,
                codigo_barras: '',
            };
            const produtoUnitarioSalvo = await productService.create(payloadUn);
            setProducts(prev => [...prev, produtoUnitarioSalvo]);
            const unidadeOrigem = dadosCaixa.unidade_medida || dadosCaixa.unidade_comercial || dadosCaixa.unidade_tributavel;
            showSuccess(`Produto unitário "${produtoUnitarioSalvo.name}" criado! Agora transfira ${pluralEmbalagem(unidadeOrigem)} que deseja abrir.`);
            fecharProdutoUnitario();
            void sincronizarEstoque();
        } catch (err: any) {
            showError(err?.response?.data?.error || err?.message || 'Erro ao criar produto unitário');
        } finally {
            produtoUnitarioSubmitRef.current = false;
            setSalvandoProdutoUnitario(false);
        }
    };

    const salvarProduto = async () => {
        if (!validateForm()) {
            showError('Corrija os erros do formulário antes de salvar.');
            return;
        }
        // Normaliza campos antes de enviar: string vazia → null para campos com unique index
        const payload = {
            ...form,
            code: form.code?.trim() || null,
            lote: form.lote?.trim() || null,
            fornecedor_id: form.fornecedor_id || null,
            unidade_medida: form.unidade_medida || null,
            unidade_comercial: form.unidade_comercial || null,
            unidade_tributavel: form.unidade_tributavel || null,
            unidades_por_caixa: produtoEhEmbalagem ? caixaQtdUnidades : null,
            price: form.price ?? 0,
            preco_compra: form.is_materia_prima ? (form.price ?? 0) : (form.preco_compra ?? 0),
            tipo_preco_venda: tipoPrecoVenda,
            percentual_lucro: tipoPrecoVenda === 'percentual' ? percentualLucro : null,
            minQuantity: form.minQuantity ?? 0,
            currentQuantity: form.currentQuantity ?? 0,
            peso_bruto: form.peso_bruto ?? 0,
            peso_liquido: form.peso_liquido ?? 0,
            aliquota_icms: form.aliquota_icms ?? 0,
            aliquota_pis: form.aliquota_pis ?? 0,
            aliquota_cofins: form.aliquota_cofins ?? 0,
            aliquota_ipi: form.aliquota_ipi ?? 0,
            ibs_cbs_situacao_tributaria: form.ibs_cbs_situacao_tributaria?.trim() || null,
            ibs_cbs_classificacao_tributaria: form.ibs_cbs_classificacao_tributaria?.trim() || null,
        };
        try {
            if (editingId) {
                const original = products.find(p => p.id === editingId);
                const atualizado = await productService.update(editingId, payload);
                setProducts(products.map(p => p.id === editingId ? atualizado : p));
                if (original && Number(original.currentQuantity) !== Number(form.currentQuantity)) {
                    const diff = Number(form.currentQuantity) - Number(original.currentQuantity);
                    registrarMovimento({
                        productId: editingId, productName: form.name, productCode: form.code,
                        tipo: diff > 0 ? 'entrada' : 'saida',
                        quantidade: Math.abs(diff), motivo: 'Edição manual',
                    });
                }
                showSuccess('Produto atualizado!');
            } else {
                const novo = await productService.create(payload);
                setProducts([...products, novo]);
                if (form.currentQuantity > 0) {
                    registrarMovimento({
                        productId: novo.id, productName: novo.name, productCode: novo.code,
                        tipo: 'entrada', quantidade: form.currentQuantity, motivo: 'Cadastro inicial',
                    });
                }
                showSuccess('Produto cadastrado!');
            }
            setFormDialog(false);
            setForm(initialForm);
            setPercentualLucro(null);
            setEditingId(null);
            setFormErrors({});

            setCaixaQtdUnidades(null);
            setTipoPrecoVenda('valor');
            setPercentualLucro(null);
            void sincronizarEstoque();
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || 'Erro ao salvar';
            showError(msg);
        }
    };

    const excluirProduto = (p: Product) => {
        confirmDialog({
            message: `Excluir o produto "${p.name}"?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sim, excluir', rejectLabel: 'Cancelar',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await productService.delete(p.id);
                    setProducts(products.filter(x => x.id !== p.id));
                    showSuccess('Produto excluído');
                    void sincronizarEstoque();
                } catch (err: any) { showError(err?.message || 'Erro ao excluir'); }
            }
        });
    };

    const abrirModalGranel = (p: Product) => {
        setGranelProduto(p);
        setGranelNome(`${p.name} (a granel)`);
        setGranelUnidade(p.unidade_medida || 'ML');
        setGranelPreco100(0);
        setGranelDialog(true);
    };

    const abrirGranel = (p: Product) => {
        const graneisExistentes = products.filter(
            produto => Number(produto.granel_origem_id) === Number(p.id)
        );

        if (graneisExistentes.length === 0) {
            abrirModalGranel(p);
            return;
        }

        const nomes = graneisExistentes
            .map(produto => `"${produto.name}"`)
            .join(', ');
        confirmDialog({
            header: 'Produto a granel já cadastrado',
            message: `Já existe ${graneisExistentes.length === 1 ? 'um produto a granel' : `${graneisExistentes.length} produtos a granel`} vinculado a "${p.name}": ${nomes}. Deseja criar outro mesmo assim?`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sim, criar outro',
            rejectLabel: 'Cancelar',
            acceptClassName: 'p-button-warning',
            accept: () => abrirModalGranel(p),
        });
    };

    const granelPrecoPorUm = ['KG', 'LT', 'MT'].includes(granelUnidade);
    const granelUnidadeAbreviada = granelUnidade.toLowerCase();
    const granelQuantidadePreco = granelPrecoPorUm ? 1 : 100;
    const granelLabelPreco = granelPrecoPorUm
        ? `Preço de venda por 1 ${granelUnidadeAbreviada}`
        : `Preço de venda por 100 ${granelUnidadeAbreviada}`;

    const salvarGranel = async () => {
        if (!granelProduto) return;
        const nomeGranel = granelNome.trim();
        if (!nomeGranel) return showError('Informe o nome do produto a granel');
        if (granelPreco100 <= 0) {
            return showError(`Informe o preço por ${granelQuantidadePreco} ${granelUnidadeAbreviada}`);
        }

        setGranelSalvando(true);
        try {
            const sufixoUn = granelUnidade.toLowerCase();
            const precoFinal = granelPrecoPorUm ? granelPreco100 : granelPreco100 / 100;
            const payload = {
                name: nomeGranel,
                code: null,
                fornecedor_id: granelProduto.fornecedor_id,
                category: granelProduto.category || '',
                origem: granelProduto.origem ?? 0,
                is_materia_prima: false,
                unidade_medida: granelUnidade,
                unidade_comercial: granelUnidade,
                unidade_tributavel: granelUnidade,
                price: precoFinal,
                preco_compra: 0,
                minQuantity: 0,
                currentQuantity: 0,
                lote: null,
                data_validade: granelProduto.data_validade || null,
                peso_bruto: 0,
                peso_liquido: 0,
                ncm: granelProduto.ncm || '',
                cfop: granelProduto.cfop || '',
                cest: granelProduto.cest || '',
                cst_csosn: granelProduto.cst_csosn || '',
                aliquota_icms: granelProduto.aliquota_icms || 0,
                aliquota_pis: granelProduto.aliquota_pis || 0,
                aliquota_cofins: granelProduto.aliquota_cofins || 0,
                aliquota_ipi: granelProduto.aliquota_ipi || 0,
                codigo_barras: '',
                cst_pis: granelProduto.cst_pis || '07',
                cst_cofins: granelProduto.cst_cofins || '07',
                granel_origem_id: granelProduto.id,
                ibs_cbs_situacao_tributaria: granelProduto.ibs_cbs_situacao_tributaria || null,
                ibs_cbs_classificacao_tributaria: granelProduto.ibs_cbs_classificacao_tributaria || null,
            };
            const novo = await productService.create(payload);
            setProducts(prev => [...prev, novo]);
            showSuccess(`Produto a granel "${novo.name}" criado com sucesso!`);
            setGranelDialog(false);
            void sincronizarEstoque();
        } catch (err: any) {
            showError(err?.response?.data?.error || err?.message || 'Erro ao criar produto a granel');
        } finally {
            setGranelSalvando(false);
        }
    };

    const abrirTransferenciaGranel = (granel: Product) => {
        const origem = products.find(p => p.id === granel.granel_origem_id);
        if (!origem) {
            showError('Produto de origem não encontrado no estoque');
            return;
        }
        setTransProdutoGranel(granel);
        setTransProdutoOrigem(origem);
        setTransQtdSaida(0);
        setTransQtdEntrada(0);
        setTransDialog(true);
    };

    const salvarTransferenciaGranel = async () => {
        if (!transProdutoOrigem || !transProdutoGranel) return;
        if (transQtdSaida <= 0) return showError('Informe a quantidade de saída do produto original');
        if (transQtdEntrada <= 0) return showError('Informe a quantidade de entrada no granel');

        setTransSalvando(true);
        try {
            const res = await api.post('/products/transferir-granel', {
                origem_id: transProdutoOrigem.id,
                granel_id: transProdutoGranel.id,
                quantidade_saida: transQtdSaida,
                quantidade_entrada: transQtdEntrada,
            });
            setProducts(prev => prev.map(p => {
                if (p.id === transProdutoOrigem!.id) return { ...p, currentQuantity: res.data.origem.currentQuantity };
                if (p.id === transProdutoGranel!.id) return { ...p, currentQuantity: res.data.granel.currentQuantity };
                return p;
            }));
            showSuccess('Transferência realizada com sucesso!');
            setTransDialog(false);
            void sincronizarEstoque();
        } catch (err: any) {
            showError(err?.response?.data?.error || err?.message || 'Erro na transferência');
        } finally {
            setTransSalvando(false);
        }
    };

    const abrirTransferenciaCaixa = (unidade: Product) => {
        const caixa = products.find(produto => produto.id === Number(unidade.caixa_origem_id));
        if (!caixa) {
            showError('Caixa ou pacote de origem não encontrado no estoque');
            return;
        }
        setTransProdutoCaixa(caixa);
        setTransProdutoUnidade(unidade);
        setTransQtdCaixas(null);
        setTransCaixaDialog(true);
    };

    const salvarTransferenciaCaixa = async () => {
        if (transCaixaSubmitRef.current) return;
        if (!transProdutoCaixa || !transProdutoUnidade) return;
        if (!Number.isInteger(transQtdCaixas) || Number(transQtdCaixas) <= 0) {
            showError(`Informe uma quantidade inteira de ${pluralEmbalagem(transProdutoCaixa.unidade_medida)}`);
            return;
        }
        if (transCaixasExcedeEstoque) {
            showError(`Estoque insuficiente. Existem apenas ${transCaixasDisponiveis} ${pluralEmbalagem(transProdutoCaixa.unidade_medida)} disponíveis.`);
            return;
        }

        transCaixaSubmitRef.current = true;
        setTransCaixaSalvando(true);
        try {
            const res = await api.post('/products/transferir-caixa', {
                origem_id: transProdutoCaixa.id,
                unidade_id: transProdutoUnidade.id,
                quantidade_caixas: transQtdCaixas,
            });
            setProducts(prev => prev.map(produto => {
                if (produto.id === transProdutoCaixa.id) {
                    return { ...produto, currentQuantity: res.data.origem.currentQuantity };
                }
                if (produto.id === transProdutoUnidade.id) {
                    return { ...produto, currentQuantity: res.data.unidade.currentQuantity };
                }
                return produto;
            }));
            showSuccess(
                `${res.data.quantidade_caixas} ${pluralEmbalagem(transProdutoCaixa.unidade_medida)} convertidos em ${res.data.quantidade_unidades} unidades.`
            );
            setTransCaixaDialog(false);
            void sincronizarEstoque();
        } catch (err: any) {
            showError(err?.response?.data?.error || err?.message || 'Erro ao transferir a embalagem para unidades');
        } finally {
            transCaixaSubmitRef.current = false;
            setTransCaixaSalvando(false);
        }
    };

    const abrirSeletorXML = () => fileInputRef.current?.click();

    const processarXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setXmlImportando(true);
            const preview = await fiscalStockImportService.previewFile(file);
            setXmlFile(file);
            setXmlPreview(preview);
            setXmlLinkDialog(true);
        } catch (err: any) {
            showError(err?.response?.data?.error || err?.message || 'Erro ao processar XML');
        } finally {
            setXmlImportando(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmarImportacaoXML = async (decisions: FiscalImportDecision[]) => {
        if (!xmlFile) return;
        try {
            setXmlImportando(true);
            const result = await fiscalStockImportService.applyFile(xmlFile, decisions);
            showSuccess(
                `Entrada concluída: ${result.linked} vinculado(s), ${result.created} criado(s)`
                + (result.skipped ? `, ${result.skipped} ignorado(s)` : '')
            );
            setXmlLinkDialog(false);
            setXmlFile(null);
            setXmlPreview(null);
            await sincronizarEstoque();
        } catch (err: any) {
            showError(err?.response?.data?.error || err?.message || 'Erro ao importar produtos da nota');
        } finally {
            setXmlImportando(false);
        }
    };

    const abrirInventario = async () => {
        // Carrega lista de usuários ativos para o step de autenticação
        try {
            const res = await api.get('/users');
            const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
            setInvUsuarios(raw.filter((u: any) => u.status !== 'bloqueado').map((u: any) => ({
                id: u.id,
                nome: u.nomeCompleto ?? u.nome ?? u.email,
            })));
        } catch { setInvUsuarios([]); }

        setInvResponsavelId(null);
        setInvResponsavelNome('');
        setInvSenha('');
        setInvAuthDialog(true);
    };

    const confirmarAuthInventario = async () => {
        if (!invResponsavelId) return showError('Selecione o responsável pela contagem');
        if (!invSenha.trim()) return showError('Informe a senha do responsável');
        setInvVerificando(true);
        try {
            await api.post('/auth/verificar-senha', { user_id: invResponsavelId, senha: invSenha });
            setInvAuthDialog(false);
            // Abre o inventário propriamente dito
            const ini: Record<number, number> = {};
            products.forEach(p => { ini[p.id] = p.currentQuantity; });
            setContagem(ini);
            setJustificativas({});
            setInventarioSearch('');
            setInventarioDialog(true);
        } catch {
            showError('Senha incorreta. Tente novamente.');
        } finally {
            setInvVerificando(false);
        }
    };

    const aplicarInventario = async () => {
        const ajustes = products.filter(p => contagem[p.id] !== p.currentQuantity);
        if (ajustes.length === 0) { setInventarioDialog(false); return showSuccess('Nenhuma diferença encontrada'); }
        try {
            const itens = ajustes.map(p => ({
                produto_id: p.id,
                quantidade_contada: contagem[p.id],
                justificativa: justificativas[p.id]?.trim() || '',
                responsavel_id: invResponsavelId ?? undefined,
                responsavel_nome: invResponsavelNome || undefined,
            }));
            const { data } = await api.post('/inventarios/aplicar-lote', { itens });
            await sincronizarEstoque();
            showSuccess(`Inventário aplicado: ${data?.total ?? ajustes.length} ajustes`);
            setInventarioDialog(false);
        } catch (err: any) { showError(err?.message || 'Erro ao aplicar inventário'); }
    };

    // ── Histórico por produto ─────────────────────────────────────────────────
    const abrirHistProduto = async (p: Product) => {
        setHistProdNome(p.name);
        setHistProdUnidade(p.unidade_medida || null);
        setHistProdSaldoAtual(Number.isFinite(Number(p.currentQuantity)) ? Number(p.currentQuantity) : null);
        setHistProdMovs([]);
        setHistProdCustos([]);
        setHistProdCustoAtual(Number(p.preco_compra ?? p.price ?? 0));
        setHistProdLoading(true);
        setHistProdDialog(true);
        const [movimentosResultado, custosResultado] = await Promise.allSettled([
            api.get('/movimentos', { params: { produto_id: p.id } }),
            api.get(`/products/${p.id}/historico-custos`)
        ]);
        if (movimentosResultado.status === 'fulfilled') {
            setHistProdMovs(Array.isArray(movimentosResultado.value.data) ? movimentosResultado.value.data : []);
        } else {
            // fallback: filtra do estado local com conversão de tipo
            const movs = movimentos.filter(m =>
                Number(m.produto_id) === Number(p.id) || Number(m.produto?.id) === Number(p.id)
            );
            setHistProdMovs(movs);
        }
        if (custosResultado.status === 'fulfilled') {
            const dados = custosResultado.value.data;
            setHistProdCustos(Array.isArray(dados?.entradas) ? dados.entradas : []);
            if (Number.isFinite(Number(dados?.produto?.custo_atual))) {
                setHistProdCustoAtual(Number(dados.produto.custo_atual));
            }
        }
        setHistProdLoading(false);
    };

    // ── Calcular giro de estoque ──────────────────────────────────────────────
    const calcularGiro = (movsFiltrados: typeof movimentos) => {
        const contadorSaida: Record<number, { nome: string; qtd: number; vezes: number; unidade: string }> = {};
        const vendasCanceladas = new Set(
            movsFiltrados
                .filter(m => m.origem_tipo === 'venda_cancelada' && m.origem_id != null)
                .map(m => `${m.produto_id}:${m.origem_id}`)
        );
        movsFiltrados.forEach(m => {
            const id = m.produto_id ?? m.produto?.id;
            if (!id) return;
            const produto = products.find(p => p.id === id);
            const unidade = produto?.unidade_medida || m.produto?.unidade_medida || 'un';
            if (!contadorSaida[id]) contadorSaida[id] = { nome: m.produto?.name ?? `#${id}`, qtd: 0, vezes: 0, unidade };
            const vendaFoiCancelada = m.origem_tipo === 'venda'
                && m.origem_id != null
                && vendasCanceladas.has(`${id}:${m.origem_id}`);
            if (m.tipo === 'saida' && !vendaFoiCancelada) {
                contadorSaida[id].qtd += Number(m.quantidade);
                contadorSaida[id].vezes += 1;
            }
        });

        // Apenas produtos com saída real (vezes > 0)
        const comGiro = Object.entries(contadorSaida)
            .map(([id, v]) => ({ id: Number(id), ...v }))
            .filter(p => p.vezes > 0)
            .sort((a, b) => b.qtd - a.qtd);

        // Produtos parados = todos os que NÃO têm nenhuma saída registrada (sem duplicatas)
        const idsComSaida = new Set(comGiro.map(p => p.id));
        const semGiro = products
            .filter(p => !idsComSaida.has(p.id))
            .map(p => ({ id: p.id, nome: p.name, qtd: 0, vezes: 0, unidade: p.unidade_medida || 'un' }));

        return { comGiro, semGiro };
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Relatório de Estoque', 14, 22);
        doc.setFontSize(10);
        doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
        autoTable(doc, {
            startY: 38,
            head: [['SKU', 'Nome', 'Categoria', 'Un.', 'P. Compra', 'P. Venda', 'Mín.', 'Atual', 'Status']],
            body: filteredProducts.map(p => [
                p.code || '-', p.name, p.category || '-', p.unidade_medida || '-',
                fmtMoeda(p.preco_compra || 0), fmtMoeda(p.price),
                fmtQtd(p.minQuantity, p.unidade_medida), fmtQtd(p.currentQuantity, p.unidade_medida),
                Number(p.currentQuantity) < Number(p.minQuantity) ? 'Baixo' : 'OK',
            ]),
            theme: 'grid',
            headStyles: { fillColor: [30, 136, 229], textColor: 255 },
        });
        doc.save('relatorio_estoque.pdf');
    };

    const filteredProducts = products.filter(p => {
        if (nameFilter && !(p.name ?? '').toLowerCase().includes(nameFilter.toLowerCase())) return false;
        if (codeFilter && !(p.code ?? '').toLowerCase().includes(codeFilter.toLowerCase())) return false;
        if (minPrice !== null && p.price < minPrice) return false;
        if (maxPrice !== null && p.price > maxPrice) return false;
        if (stockStatusFilter === 'below' && Number(p.currentQuantity) >= Number(p.minQuantity)) return false;
        if (stockStatusFilter === 'ok' && Number(p.currentQuantity) < Number(p.minQuantity)) return false;
        return true;
    });

    const limparFiltros = () => {
        setNameFilter('');
        setCodeFilter('');
        setMinPrice(null);
        setMaxPrice(null);
        setStockStatusFilter(null);
    };

    const statusBody = (p: Product) => (
        <Tag value={Number(p.currentQuantity) < Number(p.minQuantity) ? 'Abaixo' : 'OK'}
            severity={Number(p.currentQuantity) < Number(p.minQuantity) ? 'danger' : 'success'} />
    );

    const nomeBody = (p: Product) => (
        <div>
            <div className="flex align-items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {p.is_materia_prima && <Tag value="MP" severity="info" style={{ fontSize: '0.65rem', padding: '1px 6px' }} />}
                {p.caixa_origem_id && <Tag value="Unidade" severity="success" style={{ fontSize: '0.65rem', padding: '1px 6px' }} />}
                {p.granel_origem_id && <Tag value="Granel" severity="warning" style={{ fontSize: '0.65rem', padding: '1px 6px' }} />}
            </div>
            {p.code && <div className="text-xs text-color-secondary">{p.code}</div>}
        </div>
    );

    // ── Funções de Etiqueta ────────────────────────────────────────────────
    const atualizarAlergeno = (nome: string, tipo: TipoDeclaracaoAlergeno) => {
        setEtiquetaForm(prev => {
            const marcados = { ...prev.alergenicosMarcados };
            if (marcados[nome] === tipo) delete marcados[nome];
            else marcados[nome] = tipo;
            return { ...prev, alergenicosMarcados: marcados, alergenicos: gerarTextoAlergenicos(marcados, prev.outrosAlergenicos, prev.outrosAlergenicosTipo) };
        });
    };

    const atualizarOutrosAlergenicos = (valor: string, tipo?: TipoDeclaracaoAlergeno) => {
        setEtiquetaForm(prev => {
            const tipoAtualizado = tipo ?? prev.outrosAlergenicosTipo;
            return {
                ...prev,
                outrosAlergenicos: valor,
                outrosAlergenicosTipo: tipoAtualizado,
                alergenicos: gerarTextoAlergenicos(prev.alergenicosMarcados, valor, tipoAtualizado),
            };
        });
    };

    const abrirEtiqueta = (p: Product) => {
        if (!obterEmpresaIdAtual()) {
            toast.current?.show({ severity: 'warn', summary: 'Selecione uma empresa', detail: 'Escolha uma empresa antes de gerar a etiqueta.', life: 3500 });
            return;
        }
        const temCodigoBarras = !!(p.codigo_barras && p.codigo_barras.trim());
        setEtiquetaForm({
            ...etiquetaVazia,
            nomeProduto: p.name,
            sku: p.code ?? '',
            codigoBarras: p.codigo_barras ?? '',
            usarCodigoBarrasProduto: temCodigoBarras,
            categoria: p.category ?? '',
            preco: p.price != null ? String(p.price) : '',
            dataImpressao: new Date().toISOString().split('T')[0],
            validade: p.data_validade ?? '',
            tamanho: '60x40',
            fabricante: p.fabricante ?? '',
        });
        setEtiquetaProdutoId(p.id);
        setEtiquetaEditando(null);
        setEtiquetaDialog(true);
    };

    const imprimirEtiqueta = (dados: EtiquetaForm) => {
        const dims: Record<string, string> = { '60x60': '60mm 60mm', '40x40': '40mm 40mm', '60x40': '60mm 40mm', '80x80': '80mm 80mm', '100x150': '100mm 150mm' };
        const dataFmt = dados.dataImpressao ? new Date(dados.dataImpressao + 'T12:00:00').toLocaleDateString('pt-BR') : '';
        const valFmt = dados.validade ? new Date(dados.validade + 'T12:00:00').toLocaleDateString('pt-BR') : '';
        const codigoFinal = (dados.usarCodigoBarrasProduto && dados.codigoBarras) ? dados.codigoBarras : (dados.sku || '');
        if (dados.tipo === 'alimento') {
            const compacto = dados.tamanho === '80x80';
            const alertasFrontais = obterAlertasFrontais(dados);
            const codigoAlimento = dados.codigoBarras || dados.sku || '';
            const barrasAlimento = gerarBarras(codigoAlimento || 'PREVIEW');
            const barrasAlimentoSvg = gerarSvgBarras(barrasAlimento, 'bars-food');
            const linhas = nutrientesPadrao.map(n => {
                const v = dados.tabelaNutricional[n.key] || { por100g: '', porPorcao: '', vd: '' };
                return `<tr><td>${n.label} (${n.unidade})</td><td>${escaparHtml(v.por100g) || '0'}</td><td>${escaparHtml(v.porPorcao) || '0'}</td><td>${escaparHtml(v.vd) || '0'}</td></tr>`;
            }).join('');
            const htmlAlimento = `<html><head><style>
                @page{size:${dims[dados.tamanho]};margin:0}*{box-sizing:border-box}body{width:${compacto ? '80mm' : '100mm'};height:${compacto ? '80mm' : '150mm'};margin:0;padding:${compacto ? '2.5mm' : '5mm'};font-family:Arial,sans-serif;color:#000;font-size:${compacto ? '4.5pt' : '7pt'};overflow:hidden;display:flex;flex-direction:column}
                h1{text-align:center;font-size:${compacto ? '9pt' : '14pt'};margin:0 0 ${compacto ? '.7mm' : '2mm'}}.meta{display:flex;justify-content:space-between;border-bottom:1pt solid #000;padding-bottom:${compacto ? '.7mm' : '2mm'};margin-bottom:${compacto ? '.7mm' : '2mm'}}.alertas{display:flex;gap:${compacto ? '.5mm' : '1mm'};margin-bottom:${compacto ? '.7mm' : '2mm'}}.alerta{border:1.5pt solid #000;padding:${compacto ? '.4mm 1mm' : '1mm 2mm'};font-weight:900;font-size:${compacto ? '4pt' : '6pt'}}.texto{margin:0 0 ${compacto ? '.45mm' : '1.5mm'};line-height:${compacto ? '1.12' : '1.3'}}.forte{font-weight:800}.nutri{border:1.5pt solid #000}.nutri h2{font-size:${compacto ? '9pt' : '15pt'};margin:0;padding:${compacto ? '.5mm' : '1.5mm'};border-bottom:${compacto ? '2.5pt' : '4pt'} solid #000}.porcao{padding:${compacto ? '.45mm' : '1.5mm'};border-bottom:1pt solid #000;line-height:${compacto ? '1.15' : '1.35'}}table{width:100%;border-collapse:collapse;font-size:${compacto ? '4.2pt' : '7pt'}}th,td{padding:${compacto ? '.3mm' : '1mm'};text-align:center;border-bottom:.5pt solid #555}th:first-child,td:first-child{text-align:left;font-weight:600}.nota{padding:${compacto ? '.35mm' : '1mm'};font-size:${compacto ? '3.8pt' : '6pt'}}.rodape{display:flex;justify-content:space-between;border-top:.5pt solid #000;margin-top:${compacto ? '.6mm' : '2mm'};padding-top:${compacto ? '.5mm' : '1.5mm'}}.barcode{margin-top:auto;padding-top:${compacto ? '.6mm' : '2mm'};display:flex;flex-direction:column;align-items:center}.bars-food{display:block;height:${compacto ? '5mm' : '10mm'};width:90%;overflow:hidden}.barcode-code{font-size:${compacto ? '4pt' : '6pt'};letter-spacing:.15em;margin-top:${compacto ? '.4mm' : '1mm'}}
            </style></head><body>
                <h1>${escaparHtml(dados.nomeProduto)}</h1><div class="meta"><span>${escaparHtml(dados.fabricante)}</span><strong>PESO LÍQ. ${escaparHtml(dados.pesoLiquido)}</strong></div>
                ${alertasFrontais.length ? `<div class="alertas">${alertasFrontais.map(a => `<div class="alerta">ALTO EM<br>${a}</div>`).join('')}</div>` : ''}
                <p class="texto"><strong>INGREDIENTES:</strong> ${escaparHtml(dados.ingredientes)}</p><p class="texto forte">ALÉRGICOS: ${escaparHtml(dados.alergenicos)}</p><p class="texto forte">${dados.contemGluten ? 'CONTÉM GLÚTEN.' : 'NÃO CONTÉM GLÚTEN.'}</p>
                <section class="nutri"><h2>INFORMAÇÃO NUTRICIONAL</h2><div class="porcao">Porções por embalagem: ${escaparHtml(dados.porcoesPorEmbalagem)}<br>Porção: ${escaparHtml(dados.porcao)} ${dados.medidaCaseira ? `(${escaparHtml(dados.medidaCaseira)})` : ''}</div>
                <table><thead><tr><th></th><th>100 g/ml</th><th>Porção</th><th>%VD*</th></tr></thead><tbody>${linhas}</tbody></table><div class="nota">*Percentual de valores diários fornecidos pela porção.</div></section>
                ${dados.modoPreparo ? `<p class="texto" style="margin-top:${compacto ? '.7mm' : '2mm'}"><strong>MODO DE PREPARO:</strong> ${escaparHtml(dados.modoPreparo)}</p>` : ''}
                ${dados.conservacao ? `<p class="texto"><strong>CONSERVAÇÃO:</strong> ${escaparHtml(dados.conservacao)}</p>` : ''}
                <div class="rodape"><span>Fab.: ${dataFmt}</span><strong>Val.: ${valFmt}</strong><span>Lote: ${escaparHtml(dados.sku)}</span></div>
                <div class="barcode">${barrasAlimentoSvg}<div class="barcode-code">${escaparHtml(codigoAlimento)}</div></div>
            </body></html>`;
            const winAlimento = window.open('', '_blank', 'width=600,height=800');
            if (!winAlimento) return;
            winAlimento.document.write(htmlAlimento);
            winAlimento.document.close();
            winAlimento.onload = () => { winAlimento.print(); winAlimento.close(); };
            return;
        }
        // Gerar barras para impressão
        const seed = codigoFinal || 'PREVIEW';
        const barObjs: { w: number; dark: boolean }[] = [];
        barObjs.push({ w: 2, dark: true }, { w: 1, dark: false }, { w: 2, dark: true }, { w: 1, dark: false });
        for (let i = 0; i < seed.length; i++) {
            const c = seed.charCodeAt(i);
            const p = [(c >> 5) & 1 ? 2 : 1, (c >> 4) & 1 ? 1 : 2, (c >> 3) & 1 ? 2 : 1, (c >> 2) & 1 ? 1 : 2, (c >> 1) & 1 ? 2 : 1, (c) & 1 ? 1 : 2];
            p.forEach((ww, idx) => barObjs.push({ w: ww, dark: idx % 2 === 0 }));
        }
        barObjs.push({ w: 2, dark: true }, { w: 1, dark: false }, { w: 2, dark: true }, { w: 3, dark: false });
        const barrasSvg = gerarSvgBarras(barObjs, 'bars');
        const precoFmt = dados.preco ? Number(dados.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
        const is40print = dados.tamanho === '40x40';
        const fBase = is40print ? '6pt' : '7pt';
        const fNome = is40print ? '7.5pt' : '9pt';
        const fPreco = is40print ? '8pt' : '10pt';
        const html = `
            <html><head><style>
                @page { size: ${dims[dados.tamanho]}; margin: 0; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { width: 100%; height: 100%; font-family: "Courier New", monospace; display: flex; flex-direction: column; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .top { background: #1565c0; padding: ${is40print ? '4px 7px' : '6px 10px'}; flex-shrink: 0; }
                .top .nome { color:#fff; font-size:${fNome}; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
                .top .cat { color:rgba(255,255,255,0.8); font-size:${fBase}; text-transform:uppercase; letter-spacing:.05em; margin-top:1px; display:block; }
                .body { flex:1; display:flex; flex-direction:column; padding:${is40print ? '4px 7px' : '6px 10px'}; min-height:0; }
                .meta { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; flex-shrink:0; }
                .lbl { font-size:${is40print ? '4pt' : '4.5pt'}; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; display:block; }
                .sku-val { font-size:${fBase}; font-weight:700; color:#1e293b; }
                .preco-block { text-align:right; }
                .preco-val { font-size:${fPreco}; font-weight:800; color:#1565c0; }
                .barcode-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; margin:2px 0; min-height:0; }
                .bars { height:${is40print ? '22px' : '28px'}; display:block; width:100%; overflow:hidden; }
                .cod { font-size:${is40print ? '4pt' : '4.5pt'}; color:#334155; letter-spacing:.12em; margin-top:2px; text-align:center; }
                .footer { display:flex; justify-content:space-between; border-top:1px dashed #94a3b8; padding-top:3px; margin-top:2px; flex-shrink:0; font-size:${is40print ? '4pt' : '4.5pt'}; color:#94a3b8; }
                .footer .red { color:#dc2626; font-weight:700; }
            </style></head><body>
                <div class="top">
                    <span class="nome">${dados.nomeProduto}</span>
                    ${dados.categoria ? `<span class="cat">${dados.categoria}</span>` : ''}
                </div>
                <div class="body">
                    <div class="meta">
                        <div>
                            ${dados.sku ? `<span class="lbl">SKU</span><span class="sku-val">${dados.sku}</span>` : ''}
                        </div>
                        <div class="preco-block">
                            ${precoFmt ? `<span class="lbl">Preço</span><span class="preco-val">${precoFmt}</span>` : ''}
                        </div>
                    </div>
                    <div class="barcode-wrap">
                        ${barrasSvg}
                        <div class="cod">${codigoFinal}</div>
                    </div>
                    <div class="footer">
                        <span>Imp: ${dataFmt}</span>
                        ${valFmt ? `<span class="red">Val: ${valFmt}</span>` : ''}
                    </div>
                </div>
            </body></html>`;
        const win = window.open('', '_blank', 'width=400,height=400');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.onload = () => { win.print(); win.close(); };
    };

    const confirmarEtiqueta = () => {
        if (!etiquetaForm.nomeProduto) {
            toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Nome do produto é obrigatório', life: 3000 });
            return;
        }
        if (etiquetaForm.tipo === 'alimento' && (!etiquetaForm.ingredientes.trim() || !etiquetaForm.porcao.trim() || !etiquetaForm.pesoLiquido.trim())) {
            toast.current?.show({ severity: 'error', summary: 'Dados obrigatórios', detail: 'Informe peso líquido, porção e ingredientes do alimento.', life: 4000 });
            return;
        }
        const empresaId = obterEmpresaIdAtual();
        const chave = chaveHistoricoEtiquetas();
        if (!empresaId || !chave) {
            toast.current?.show({ severity: 'warn', summary: 'Selecione uma empresa', detail: 'Não foi possível identificar a empresa da etiqueta.', life: 3500 });
            return;
        }
        const lista = JSON.parse(localStorage.getItem(chave) ?? '[]') as Etiqueta[];

        if (etiquetaEditando) {
            const atualizada = lista.map(e => e.id === etiquetaEditando.id ? { ...etiquetaEditando, ...etiquetaForm } : e);
            salvarHistoricoEtiquetas(atualizada);
            toast.current?.show({ severity: 'success', summary: 'Salvo', detail: 'Etiqueta atualizada', life: 2500 });
        } else {
            const nova: Etiqueta = {
                id: Date.now().toString(),
                empresa_id: empresaId,
                produto_id: etiquetaProdutoId,
                ...etiquetaForm,
                createdAt: new Date().toISOString(),
            };
            salvarHistoricoEtiquetas([nova, ...lista]);
            toast.current?.show({ severity: 'success', summary: 'Emitida', detail: 'Etiqueta registrada no histórico', life: 2500 });
        }
        imprimirEtiqueta(etiquetaForm);
        setEtiquetaDialog(false);
    };

    const baixarPdfEtiqueta = (dados: EtiquetaForm) => {
        const dimsMm: Record<string, [number, number]> = { '60x60': [60, 60], '40x40': [40, 40], '60x40': [60, 40], '80x80': [80, 80], '100x150': [100, 150] };
        const [pw, ph] = dimsMm[dados.tamanho] ?? [60, 40];
        const doc = new jsPDF({ orientation: pw >= ph ? 'landscape' : 'portrait', unit: 'mm', format: [pw, ph] });

        const codigoFinal = (dados.usarCodigoBarrasProduto && dados.codigoBarras) ? dados.codigoBarras : (dados.sku || '');
        const dataFmt = dados.dataImpressao ? new Date(dados.dataImpressao + 'T12:00:00').toLocaleDateString('pt-BR') : '';
        const valFmt = dados.validade ? new Date(dados.validade + 'T12:00:00').toLocaleDateString('pt-BR') : '';
        const precoFmt = dados.preco ? Number(dados.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
        const is40 = dados.tamanho === '40x40';

        if (dados.tipo === 'alimento') {
            const compacto = dados.tamanho === '80x80';
            const margem = compacto ? 2.5 : 4;
            const alertasFrontais = obterAlertasFrontais(dados);
            const codigoAlimento = dados.codigoBarras || dados.sku || '';
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(compacto ? 8 : 14);
            doc.text(dados.nomeProduto || 'Alimento', pw / 2, compacto ? 4.5 : 8, { align: 'center', maxWidth: pw - margem * 2 });
            doc.setFontSize(compacto ? 4.2 : 7);
            doc.setFont('helvetica', 'normal');
            doc.text(dados.fabricante || '', margem, compacto ? 7 : 13);
            doc.setFont('helvetica', 'bold');
            doc.text(`PESO LÍQ. ${dados.pesoLiquido || ''}`, pw - margem, compacto ? 7 : 13, { align: 'right' });
            doc.setDrawColor(0, 0, 0);
            doc.line(margem, compacto ? 8 : 15, pw - margem, compacto ? 8 : 15);
            let inicioTexto = compacto ? 10 : 19;
            if (alertasFrontais.length) {
                doc.setFontSize(compacto ? 3.5 : 5.5);
                alertasFrontais.forEach((alerta, index) => {
                    const larguraAlerta = compacto ? 23 : 27;
                    const x = margem + index * (larguraAlerta + (compacto ? 1 : 2));
                    doc.rect(x, compacto ? 9 : 17, larguraAlerta, compacto ? 5 : 7);
                    doc.text(`ALTO EM\n${alerta}`, x + (compacto ? .8 : 1.5), compacto ? 10.7 : 19.5);
                });
                inicioTexto = compacto ? 16 : 28;
            }
            doc.setFontSize(compacto ? 3.8 : 6.5);
            const ingredientes = doc.splitTextToSize(`INGREDIENTES: ${dados.ingredientes}`, pw - margem * 2).slice(0, compacto ? 2 : undefined);
            doc.text(ingredientes, margem, inicioTexto);
            let y = inicioTexto + ingredientes.length * (compacto ? 1.7 : 3);
            doc.setFont('helvetica', 'bold');
            const alergicos = doc.splitTextToSize(`ALÉRGICOS: ${dados.alergenicos || 'NÃO INFORMADO'}`, pw - margem * 2).slice(0, compacto ? 2 : undefined);
            doc.text(alergicos, margem, y);
            y += alergicos.length * (compacto ? 1.7 : 3);
            doc.text(dados.contemGluten ? 'CONTÉM GLÚTEN.' : 'NÃO CONTÉM GLÚTEN.', margem, y);
            y += compacto ? 1.7 : 3;
            doc.setFontSize(compacto ? 8 : 14);
            doc.text('INFORMAÇÃO NUTRICIONAL', margem, y + (compacto ? 3 : 5));
            y += compacto ? 4.5 : 8;
            doc.setLineWidth(compacto ? .8 : 1.2);
            doc.line(margem, y, pw - margem, y);
            doc.setLineWidth(0.2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(compacto ? 3.8 : 6.5);
            doc.text(`Porções por embalagem: ${dados.porcoesPorEmbalagem || '--'}`, margem, y + (compacto ? 1.8 : 4));
            doc.text(`Porção: ${dados.porcao || '--'}${dados.medidaCaseira ? ` (${dados.medidaCaseira})` : ''}`, margem, y + (compacto ? 3.5 : 7));
            autoTable(doc, {
                startY: y + (compacto ? 4.5 : 9),
                margin: { left: margem, right: margem },
                head: [['', '100 g/ml', 'Porção', '%VD*']],
                body: nutrientesPadrao.map(n => {
                    const v = dados.tabelaNutricional[n.key] || { por100g: '', porPorcao: '', vd: '' };
                    return [`${n.label} (${n.unidade})`, v.por100g || '0', v.porPorcao || '0', v.vd || '0'];
                }),
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: compacto ? 3.5 : 5.5, cellPadding: compacto ? .35 : 1, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
                headStyles: { fillColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: compacto ? 36 : 47, fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
            });
            const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + (compacto ? 1 : 3);
            doc.setFontSize(compacto ? 3.2 : 5.5);
            doc.text('*Percentual de valores diários fornecidos pela porção.', margem, finalY);
            let rodapeY = finalY + (compacto ? 1.8 : 4);
            if (dados.modoPreparo) {
                const modoPreparo = doc.splitTextToSize(`MODO DE PREPARO: ${dados.modoPreparo}`, pw - margem * 2).slice(0, compacto ? 2 : 4);
                doc.setFont('helvetica', 'bold');
                doc.text(modoPreparo, margem, rodapeY);
                rodapeY += modoPreparo.length * (compacto ? 1.5 : 2.5);
            }
            if (dados.conservacao) {
                const conservacao = doc.splitTextToSize(`CONSERVAÇÃO: ${dados.conservacao}`, pw - margem * 2).slice(0, compacto ? 1 : undefined);
                doc.setFont('helvetica', 'bold');
                doc.text(conservacao, margem, rodapeY);
                rodapeY += conservacao.length * (compacto ? 1.5 : 2.5);
            }
            const infoY = compacto ? Math.min(Math.max(rodapeY + 1.5, 65), ph - 13) : Math.max(rodapeY + 3, ph - 22);
            doc.setFontSize(compacto ? 3.8 : 6);
            doc.text(`Fab.: ${dataFmt || '--'}`, margem, infoY);
            doc.text(`Val.: ${valFmt || '--'}`, pw / 2, infoY, { align: 'center' });
            doc.text(`Lote: ${dados.sku || '--'}`, pw - margem, infoY, { align: 'right' });

            const barrasPdf = gerarBarras(codigoAlimento || 'PREVIEW');
            const totalBarras = barrasPdf.reduce((total, barra) => total + barra.w, 0);
            const larguraArea = pw - (compacto ? 14 : 20);
            const unidadeBarra = larguraArea / totalBarras;
            const barcodeY = ph - (compacto ? 10 : 16);
            const alturaBarcode = compacto ? 6 : 10;
            let barcodeX = compacto ? 7 : 10;
            barrasPdf.forEach(barra => {
                if (barra.dark) {
                    doc.setFillColor(0, 0, 0);
                    doc.rect(barcodeX, barcodeY, barra.w * unidadeBarra, alturaBarcode, 'F');
                }
                barcodeX += barra.w * unidadeBarra;
            });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(compacto ? 4 : 6);
            doc.text(codigoAlimento, pw / 2, ph - (compacto ? 1.5 : 3), { align: 'center' });
            const nomeArq = (dados.nomeProduto || 'etiqueta').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            doc.save(`etiqueta_nutricional_${nomeArq}.pdf`);
            return;
        }

        // ── Cabeçalho azul ──
        const headerH = is40 ? 8 : 10;
        doc.setFillColor(21, 101, 192);
        doc.rect(0, 0, pw, headerH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('courier', 'bold');
        doc.setFontSize(is40 ? 6.5 : 8);
        doc.text(dados.nomeProduto || 'Produto', 2, is40 ? 4.5 : 5.5, { maxWidth: pw - 4 });
        if (dados.categoria) {
            doc.setFontSize(is40 ? 4.5 : 5.5);
            doc.setFont('courier', 'normal');
            doc.text(dados.categoria.toUpperCase(), 2, is40 ? 7 : 8.5, { maxWidth: pw - 4 });
        }

        // ── SKU + Preço ──
        let curY = headerH + 3;
        doc.setTextColor(30, 41, 59);
        if (dados.sku) {
            doc.setFontSize(is40 ? 4 : 4.5);
            doc.setFont('courier', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text('SKU', 2, curY);
            doc.setFontSize(is40 ? 5 : 6);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(dados.sku, 2, curY + 2.5);
        }
        if (precoFmt) {
            doc.setFontSize(is40 ? 4 : 4.5);
            doc.setFont('courier', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text('PREÇO', pw - 2, curY, { align: 'right' });
            doc.setFontSize(is40 ? 7 : 8.5);
            doc.setFont('courier', 'bold');
            doc.setTextColor(21, 101, 192);
            doc.text(precoFmt, pw - 2, curY + 3.5, { align: 'right' });
        }
        curY += dados.sku || precoFmt ? 7 : 0;

        // ── Código de barras (barras desenhadas com jsPDF) ──
        const barH = is40 ? 10 : 13;
        const barAreaW = pw - 8;
        const seed = codigoFinal || 'PREVIEW';
        const barObjs2: { w: number; dark: boolean }[] = [];
        barObjs2.push({ w: 2, dark: true }, { w: 1, dark: false }, { w: 2, dark: true }, { w: 1, dark: false });
        for (let i = 0; i < seed.length; i++) {
            const c = seed.charCodeAt(i);
            const ptns = [(c >> 5) & 1 ? 2 : 1, (c >> 4) & 1 ? 1 : 2, (c >> 3) & 1 ? 2 : 1, (c >> 2) & 1 ? 1 : 2, (c >> 1) & 1 ? 2 : 1, (c) & 1 ? 1 : 2];
            ptns.forEach((ww, idx) => barObjs2.push({ w: ww, dark: idx % 2 === 0 }));
        }
        barObjs2.push({ w: 2, dark: true }, { w: 1, dark: false }, { w: 2, dark: true }, { w: 3, dark: false });
        const totalUnits = barObjs2.reduce((s, b) => s + b.w, 0);
        const unitW = barAreaW / totalUnits;
        let bx = 4;
        barObjs2.forEach(b => {
            if (b.dark) {
                doc.setFillColor(17, 24, 39);
                doc.rect(bx, curY, b.w * unitW, barH, 'F');
            }
            bx += b.w * unitW;
        });
        curY += barH + 1.5;

        // Código texto abaixo das barras
        if (codigoFinal) {
            doc.setFont('courier', 'normal');
            doc.setFontSize(is40 ? 3.5 : 4);
            doc.setTextColor(71, 85, 105);
            doc.text(codigoFinal, pw / 2, curY, { align: 'center' });
            curY += 3;
        }

        // ── Rodapé ──
        const footerY = ph - 3;
        doc.setDrawColor(148, 163, 184);
        doc.setLineDashPattern([0.5, 0.5], 0);
        doc.line(2, footerY - 2, pw - 2, footerY - 2);
        doc.setLineDashPattern([], 0);
        doc.setFont('courier', 'normal');
        doc.setFontSize(is40 ? 3.5 : 4);
        doc.setTextColor(148, 163, 184);
        if (dataFmt) doc.text(`Imp: ${dataFmt}`, 2, footerY);
        if (valFmt) {
            doc.setTextColor(220, 38, 38);
            doc.setFont('courier', 'bold');
            doc.text(`Val: ${valFmt}`, pw - 2, footerY, { align: 'right' });
        }

        const nomeArq = (dados.nomeProduto || 'etiqueta').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        doc.save(`etiqueta_${nomeArq}_${dados.tamanho}.pdf`);
    };

    const excluirEtiquetaHistorico = (id: string) => {
        const chave = chaveHistoricoEtiquetas();
        if (!chave) return;
        const lista = JSON.parse(localStorage.getItem(chave) ?? '[]') as Etiqueta[];
        const atualizada = lista.filter(e => e.id !== id);
        salvarHistoricoEtiquetas(atualizada);
        toast.current?.show({ severity: 'warn', summary: 'Removida', detail: 'Etiqueta excluída do histórico', life: 2500 });
    };

    const editarEtiquetaHistorico = (e: Etiqueta) => {
        setEtiquetaEditando(e);
        setEtiquetaProdutoId(e.produto_id);
        setEtiquetaForm(normalizarEtiqueta({ ...e, preco: e.preco ?? '', codigoBarras: e.codigoBarras ?? '', usarCodigoBarrasProduto: e.usarCodigoBarrasProduto ?? false }));
        setHistoricoDialog(false);
        setEtiquetaDialog(true);
    };

    const acoesBody = (p: Product) => (
        <div className="flex gap-2">
            {p.granel_origem_id && (
                <Button icon="pi pi-plus" rounded severity="success"
                    tooltip="Dar entrada (transferir do original)" tooltipOptions={{ position: 'top' }} onClick={() => abrirTransferenciaGranel(p)} />
            )}
            <Button icon="pi pi-pencil" rounded outlined severity="info"
                tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => editarProduto(p)} />
            <Button icon="pi pi-history" rounded outlined severity="secondary"
                tooltip="Histórico de movimentações" tooltipOptions={{ position: 'top' }} onClick={() => abrirHistProduto(p)} />
            {produtoEhEmbalagemCadastrada(p) && !p.granel_origem_id ? (
                <Button
                    icon={products.some(produto => Number(produto.caixa_origem_id) === p.id) ? 'pi pi-box' : 'pi pi-clone'}
                    rounded
                    outlined
                    severity="help"
                    tooltip={products.some(produto => Number(produto.caixa_origem_id) === p.id)
                        ? `Transferir ${pluralEmbalagem(p.unidade_medida)} para o produto unitário`
                        : `Criar produto unitário ${referenciaEmbalagem(p.unidade_medida)}`}
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => abrirProdutoUnitario(p)}
                />
            ) : !p.granel_origem_id ? (
                <Button icon="pi pi-sliders-h" rounded outlined severity="help"
                    tooltip={p.caixa_origem_id ? 'Criar versão a granel desta unidade' : 'Criar versão a granel'}
                    tooltipOptions={{ position: 'top' }} onClick={() => abrirGranel(p)} />
            ) : null}
            {p.caixa_origem_id && (
                <Button icon="pi pi-box" rounded severity="success"
                    tooltip={`Transferir ${pluralEmbalagem(products.find(origem => origem.id === Number(p.caixa_origem_id))?.unidade_medida)} para unidades`}
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => abrirTransferenciaCaixa(p)} />
            )}
            <Button icon="pi pi-tag" rounded outlined severity="warning"
                tooltip="Gerar Etiqueta" tooltipOptions={{ position: 'top' }} onClick={() => abrirEtiqueta(p)} />
            <Button icon="pi pi-trash" rounded outlined severity="danger"
                tooltip="Excluir" tooltipOptions={{ position: 'top' }} onClick={() => excluirProduto(p)} />
        </div>
    );

    const tipoMovBody = (m: Movimento) => (
        <Tag value={m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
            severity={m.tipo === 'entrada' ? 'success' : 'danger'}
            icon={m.tipo === 'entrada' ? 'pi pi-arrow-down' : 'pi pi-arrow-up'} />
    );

    const formFooter = (
        <div className="flex gap-2 justify-content-end">
            <Button label="Cancelar" icon="pi pi-times" className="p-button-text"
                onClick={() => { setFormDialog(false); setEditingId(null); setForm(initialForm); setFormErrors({}); }} />
            <Button label={editingId ? 'Salvar Alterações' : 'Cadastrar'} icon="pi pi-check" onClick={salvarProduto} />
        </div>
    );

    const inventarioFooter = (
        <div className="flex gap-2 justify-content-end">
            <Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={() => setInventarioDialog(false)} />
            <Button label="Aplicar Ajustes" icon="pi pi-check" onClick={aplicarInventario} />
        </div>
    );

    return (
        <div className="grid stock-page">
            <Toast ref={toast} />
            <ConfirmDialog />
            <input ref={fileInputRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={processarXML} />

            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                        <h5 className="m-0">Estoque</h5>
                        <div className="flex gap-2 flex-wrap">
                            <Button label="Importar XML"   icon="pi pi-upload"      severity="secondary" outlined onClick={abrirSeletorXML} />
                            <Button label="Gerar PDF"      icon="pi pi-file-pdf"    severity="secondary" outlined onClick={generatePDF} />
                            <Button label="Giro de Estoque" icon="pi pi-chart-bar" severity="info"      outlined onClick={() => setGiroDialog(true)} />
                            <Button label="Desperdícios" icon="pi pi-exclamation-triangle" severity="danger" outlined onClick={abrirRelatorioDesperdicios} />
                            <Button label="Etiquetas"      icon="pi pi-tags"        severity="warning"   outlined onClick={abrirHistoricoEtiquetas} />
                            <Button label="Inventário"     icon="pi pi-list-check"  outlined disabled={products.length === 0} onClick={abrirInventario} />
                            <Button label="Gestão de unidades" icon="pi pi-building" severity="help"
                                tooltip="Cadastre filiais, depósitos ou produção e transfira estoque entre unidades"
                                tooltipOptions={{ position: 'bottom' }} onClick={() => setStockLocationsDialog(true)} />
                            <Button label="Categorias"     icon="pi pi-th-large"    severity="secondary" outlined onClick={() => { setNovaCatNome(''); setEditCatId(null); setCatManagerDialog(true); }} />
                            <Button label="Novo Produto"   icon="pi pi-plus"        onClick={abrirNovoProduto} />
                        </div>
                    </div>

                    <div className="grid formgrid mb-3">
                        <div className="col-12 lg:col-3 md:col-6 field">
                            <label className="text-sm">Nome</label>
                            <InputText value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="Filtrar por nome" className="w-full p-inputtext-sm" />
                        </div>
                        <div className="col-6 lg:col-2 md:col-3 field">
                            <label className="text-sm">SKU</label>
                            <InputText value={codeFilter} onChange={e => setCodeFilter(e.target.value)} placeholder="SKU" className="w-full p-inputtext-sm" />
                        </div>
                        <div className="col-12 lg:col-4 md:col-6 field">
                            <label className="text-sm">Faixa de Preço</label>
                            <div className="flex gap-2">
                                <InputNumber value={minPrice} onValueChange={e => setMinPrice(e.value ?? null)} mode="currency" currency="BRL" locale="pt-BR" className="w-full p-inputtext-sm" placeholder="Mín." />
                                <InputNumber value={maxPrice} onValueChange={e => setMaxPrice(e.value ?? null)} mode="currency" currency="BRL" locale="pt-BR" className="w-full p-inputtext-sm" placeholder="Máx." />
                            </div>
                        </div>
                        <div className="col-6 lg:col-2 md:col-3 field pl-6">
                            <label className="text-sm">Status</label>
                            <Dropdown value={stockStatusFilter} options={stockStatusOptions} onChange={e => setStockStatusFilter(e.value)} placeholder="Todos" className="w-full p-inputtext-sm" />
                        </div>
                        <div className="col-fixed field flex align-items-end" style={{ width: '3rem' }}>
                            <Button icon="pi pi-times" severity="secondary" tooltip="Limpar filtros" tooltipOptions={{ position: 'top' }} onClick={limparFiltros} className="p-button-sm" style={{ height: 36, width: 36 }} />
                        </div>
                    </div>

                    {/* ── Alerta estoque mínimo ── */}
                    {(() => {
                        const abaixo = products.filter(p => Number(p.currentQuantity) < Number(p.minQuantity) && Number(p.minQuantity) > 0);
                        if (abaixo.length === 0) return null;
                        return (
                            <div style={{ background: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '1px solid #fca5a5', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                                <div className="flex justify-content-between align-items-center"
                                    style={{ padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => setAlertaEstoqueVisivel(v => !v)}>
                                    <div className="flex align-items-center gap-2">
                                        <i className="pi pi-exclamation-triangle" style={{ color: '#dc2626', fontSize: 16 }} />
                                        <span style={{ fontWeight: 700, fontSize: 14, color: '#7f1d1d' }}>
                                            {abaixo.length} produto{abaixo.length > 1 ? 's' : ''} abaixo do estoque mínimo
                                        </span>
                                    </div>
                                    <i className={`pi pi-chevron-${alertaEstoqueVisivel ? 'up' : 'down'}`} style={{ color: '#dc2626', fontSize: 13 }} />
                                </div>
                                {alertaEstoqueVisivel && (
                                    <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {abaixo.map(p => (
                                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid #fca5a533' }}>
                                                <div className="flex align-items-center gap-2">
                                                    <i className="pi pi-box" style={{ color: '#dc2626', fontSize: 13 }} />
                                                    <div>
                                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                                                        {p.code && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>SKU: {p.code}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex align-items-center gap-3">
                                                    <span style={{ fontSize: 12, color: '#6b7280' }}>Mín: <strong>{fmtQtd(p.minQuantity, p.unidade_medida)}</strong></span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Atual: {fmtQtd(p.currentQuantity, p.unidade_medida)}</span>
                                                    <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                                                        -{fmtQtd(Number(p.minQuantity) - Number(p.currentQuantity), p.unidade_medida)} {(p.unidade_medida || 'un').toLowerCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <DataTable value={filteredProducts} loading={loading} paginator rows={10} rowsPerPageOptions={[5, 10, 25, 50]} emptyMessage="Nenhum produto encontrado" tableStyle={{ minWidth: '50rem' }}>
                        <Column header="Nome / SKU" body={nomeBody} sortable sortField="name" />
                        <Column field="category" header="Categoria" sortable />
                        <Column field="unidade_medida" header="Un." sortable style={{ width: '5rem' }} />
                        <Column header="P. Compra" sortable body={(p: Product) => fmtMoeda(p.is_materia_prima ? (p.preco_compra || p.price || 0) : (p.preco_compra || 0))} />
                        <Column header="P. Venda" sortable body={(p: Product) => p.is_materia_prima ? <span style={{ color: '#9ca3af' }}>—</span> : fmtMoeda(p.price)} />
                        <Column header="Mín." sortable sortField="minQuantity" style={{ width: '5rem' }} body={(p: Product) => fmtQtd(p.minQuantity, p.unidade_medida)} />
                        <Column header="Atual" sortable sortField="currentQuantity" style={{ width: '5rem' }} body={(p: Product) => fmtQtd(p.currentQuantity, p.unidade_medida)} />
                        <Column header="Status" body={statusBody} style={{ width: '7rem' }} />
                        <Column body={acoesBody} style={{ minWidth: '12rem' }} />
                    </DataTable>
                </div>
            </div>

            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-4">
                        <h5 className="m-0">Histórico de Movimentações</h5>
                        {movimentos.length > 0 && (
                            <Button label="Limpar histórico" icon="pi pi-trash" severity="secondary"
                                onClick={() => confirmDialog({
                                    message: 'Limpar todo o histórico de movimentações?',
                                    header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
                                    acceptLabel: 'Sim', rejectLabel: 'Cancelar',
                                    acceptClassName: 'p-button-danger',
                                    accept: async () => {
                                        try {
                                            await Promise.all(movimentos.map(m => api.delete(`/movimentos/${m.id}`)));
                                            fetchMovimentos();
                                            showSuccess('Histórico limpo');
                                        } catch { showError('Erro ao limpar histórico'); }
                                    },
                                })} />
                        )}
                    </div>
                    <DataTable value={movimentos} paginator rows={10} rowsPerPageOptions={[5, 10, 25]} emptyMessage="Nenhuma movimentação ainda." tableStyle={{ minWidth: '50rem' }}>
                        <Column header="Tipo" body={tipoMovBody} style={{ width: '8rem' }} />
                        <Column header="Produto" body={(m: Movimento) => m.produto?.name ?? '-'} sortable />
                        <Column header="SKU" body={(m: Movimento) => m.produto?.code || '-'} />
                        <Column header="Qtd." sortable sortField="quantidade" style={{ width: '6rem' }} body={(m: any) => fmtQtd(m.quantidade, m.produto?.unidade_medida)} />
                        <Column field="motivo" header="Motivo" sortable />
                        <Column header="Data/Hora" body={(m: Movimento) => fmtData(m.data)} sortable />
                    </DataTable>
                </div>
            </div>

            <Dialog header={editingId ? 'Editar Produto' : 'Novo Produto'}
                visible={formDialog}
                style={{ width: '92vw', maxWidth: '820px' }}
                breakpoints={{ '960px': '95vw' }}
                className="produto-dialog-compacto"
                modal
                onHide={() => {
                    setFormDialog(false);
                    setEditingId(null);
                    setForm(initialForm);
                    setFormErrors({});
                    setTipoPrecoVenda('valor');
                    setPercentualLucro(null);
                }}
                footer={formFooter}>

                <style jsx global>{`
                    .produto-dialog-compacto .p-dialog-content {
                        overflow-x: hidden;
                    }
                    .produto-dialog-compacto .produto-form-grid {
                        margin-left: 0;
                        margin-right: 0;
                        row-gap: .1rem;
                    }
                    .produto-dialog-compacto .produto-form-grid > .field {
                        min-width: 0;
                        padding: .35rem .45rem;
                        margin-bottom: .25rem;
                    }
                    .produto-dialog-compacto .produto-form-grid .p-divider {
                        margin: .7rem 0 .45rem;
                        padding: 0 .45rem;
                    }
                    .produto-dialog-compacto .produto-form-grid label {
                        display: block;
                        margin-bottom: .35rem;
                        font-size: .86rem;
                    }
                    .produto-dialog-compacto .produto-form-grid .p-inputtext,
                    .produto-dialog-compacto .produto-form-grid .p-inputnumber,
                    .produto-dialog-compacto .produto-form-grid .p-dropdown,
                    .produto-dialog-compacto .produto-form-grid .p-calendar {
                        width: 100%;
                        min-width: 0;
                    }
                    .produto-dialog-compacto .produto-form-grid .p-calendar {
                        display: flex;
                    }
                    .produto-dialog-compacto .produto-form-grid .p-calendar .p-inputtext {
                        min-width: 0;
                    }
                    .produto-dialog-compacto .produto-form-grid .p-calendar .p-datepicker-trigger {
                        width: 2.6rem;
                        flex: 0 0 2.6rem;
                    }
                `}</style>

                <div className="grid formgrid produto-form-grid">
                    <Divider className="col-12" align="left"><span className="font-semibold text-color-secondary text-sm">Identificação</span></Divider>
                    <div className="col-12 field">
                        <label>Nome *</label>
                        <AutoComplete
                            value={form.name}
                            suggestions={sugestoesProdutosMesmoNome}
                            completeMethod={event => buscarProdutosMesmoNome(event.query)}
                            field="name"
                            minLength={1}
                            delay={120}
                            className="w-full"
                            inputClassName={`w-full ${formErrors.name ? 'p-invalid' : ''}`}
                            placeholder="Digite para buscar produtos semelhantes"
                            onChange={event => {
                                const valor = typeof event.value === 'string'
                                    ? event.value
                                    : event.value?.name || '';
                                f('name', valor);
                            }}
                            onSelect={event => f('name', event.value.name)}
                            itemTemplate={(produto: Product) => (
                                <div className="flex justify-content-between align-items-center gap-4 py-1 w-full">
                                    <div className="min-w-0">
                                        <div className="font-semibold white-space-normal">{produto.name}</div>
                                        <small className="text-color-secondary">
                                            {produto.code || 'Sem SKU'}
                                            {produto.category ? ` · ${produto.category}` : ''}
                                        </small>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <Tag value="Já cadastrado" severity="warning" />
                                        <small className="text-color-secondary block mt-1">
                                            Estoque: {fmtQtd(produto.currentQuantity, produto.unidade_medida)}
                                        </small>
                                    </div>
                                </div>
                            )}
                            emptyMessage="Nenhum produto semelhante encontrado"
                        />
                        {formErrors.name && <small className="p-error">{formErrors.name}</small>}
                        {!formErrors.name && produtoComMesmoNome && (
                            <small className="block mt-2" style={{ color: '#b45309' }}>
                                <i className="pi pi-exclamation-triangle mr-1" />
                                Já existe um produto com este nome: {produtoComMesmoNome.name}
                                {produtoComMesmoNome.code ? ` (${produtoComMesmoNome.code})` : ''}.
                            </small>
                        )}
                    </div>
                    <div className="col-12 md:col-4 field">
                        <label>Código SKU</label>
                        <InputText value={form.code} onChange={e => f('code', e.target.value)} className="w-full" placeholder="Ex: PROD-001" />
                    </div>
                    <div className="col-12 md:col-4 field">
                        <label>Fornecedor <span className="text-color-secondary font-normal">(opcional)</span></label>
                        <Dropdown
                            value={form.fornecedor_id}
                            options={fornecedores}
                            optionLabel="nomeCompleto"
                            optionValue="id"
                            onChange={e => f('fornecedor_id', e.value)}
                            placeholder={loadingFornecedores ? 'Carregando...' : 'Selecione...'}
                            loading={loadingFornecedores}
                            showClear
                            filter
                            filterBy="nomeCompleto,cpf,cnpj"
                            emptyMessage="Nenhum fornecedor cadastrado"
                            className={`w-full ${formErrors.fornecedor_id ? 'p-invalid' : ''}`}
                        />
                        {formErrors.fornecedor_id && <small className="p-error">{formErrors.fornecedor_id}</small>}
                        <small className="text-color-secondary">Preencha somente quando quiser vincular o produto a um fornecedor.</small>
                    </div>
                    <div className="col-12 md:col-4 field">
                        <label>Categoria</label>
                        <div className="flex gap-2">
                            <Dropdown
                                value={form.category}
                                options={categorias.map(c => ({ label: c.nome, value: c.nome }))}
                                onChange={e => f('category', e.value)}
                                placeholder="Selecione..."
                                className="w-full"
                                showClear
                                filter
                                emptyMessage="Nenhuma categoria"
                            />
                            <Button
                                icon="pi pi-plus"
                                severity="secondary"
                                outlined
                                tooltip="Nova categoria"
                                tooltipOptions={{ position: 'top' }}
                                onClick={() => { setNovaCatDestino('produto'); setNovaCatNome(''); setNovaCatDialog(true); }}
                                style={{ flexShrink: 0 }}
                            />
                        </div>
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label>Origem do Produto</label>
                        <Dropdown value={form.origem} options={origemOpcoes} onChange={e => f('origem', e.value)} className="w-full" />
                    </div>
                    <div className="col-12 md:col-6 field">
                        <label>Matéria Prima</label>
                        <div className="flex align-items-center gap-2 mt-1">
                            <InputSwitch checked={form.is_materia_prima ?? false} onChange={e => f('is_materia_prima', !!e.value)} />
                            <span className="text-sm text-color-secondary">{form.is_materia_prima ? 'Sim — disponível como ingrediente na Produção' : 'Não'}</span>
                        </div>
                    </div>

                    <Divider className="col-12" align="left"><span className="font-semibold text-color-secondary text-sm">Unidades</span></Divider>
                    <div className="col-12 field">
                        <label>Unidade de Medida</label>
                        <Dropdown
                            value={unidadeSelecionada}
                            options={unidadesOpcoes}
                            onChange={e => atualizarUnidadeProduto(e.value)}
                            placeholder="Selecione..."
                            className="w-full"
                            showClear
                            filter
                        />
                    </div>

                    {produtoEhEmbalagem && (
                        <div className="col-12">
                            <div className="p-3 border-round" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                                <div className="flex align-items-center gap-2 mb-2">
                                    <i className="pi pi-box" style={{ color: '#0284c7' }} />
                                    <span className="font-semibold text-sm" style={{ color: '#0284c7' }}>
                                        Configuração de {tipoEmbalagemSelecionada === 'pacote' ? 'Pacote' : 'Caixa'}
                                    </span>
                                </div>
                                <div className="flex align-items-center gap-3 flex-wrap">
                                    <div className="field mb-0" style={{ width: 180 }}>
                                        <label className="text-sm">Unidades por {tipoEmbalagemSelecionada}</label>
                                        <InputNumber value={caixaQtdUnidades} onValueChange={e => setCaixaQtdUnidades(e.value ?? null)}
                                            min={1} placeholder="Ex: 12" className="w-full" inputClassName="w-full" />
                                    </div>
                                    {caixaCustoUnitario !== null && (
                                        <div className="flex align-items-center gap-2 mt-3">
                                            <i className="pi pi-arrow-right" style={{ color: '#0284c7' }} />
                                            <span className="text-sm">Custo de compra por unidade: <strong style={{ color: '#16a34a', fontSize: 15 }}>
                                                {caixaCustoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </strong></span>
                                        </div>
                                    )}
                                    {caixaPrecoVendaUnitario !== null && (
                                        <div className="flex align-items-center gap-2 mt-3">
                                            <i className="pi pi-tag" style={{ color: '#7c3aed' }} />
                                            <span className="text-sm">Preço de venda por unidade: <strong style={{ color: '#7c3aed', fontSize: 15 }}>
                                                {caixaPrecoVendaUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </strong></span>
                                        </div>
                                    )}
                                </div>
                                <small className="text-color-secondary block mt-2">
                                    Após salvar, use a ação de produto unitário na lista para criar e transferir unidades {referenciaEmbalagem(unidadeSelecionada)}.
                                </small>
                            </div>
                        </div>
                    )}

                    <Divider className="col-12" align="left"><span className="font-semibold text-color-secondary text-sm">Preços</span></Divider>
                    {!form.is_materia_prima && (
                        <div className="col-12 field">
                            <label>Como deseja definir o preço de venda?</label>
                            <SelectButton
                                value={tipoPrecoVenda}
                                options={tipoPrecoVendaOpcoes}
                                onChange={e => e.value && alterarTipoPrecoVenda(e.value)}
                                optionLabel="label"
                                optionValue="value"
                                className="w-full"
                            />
                        </div>
                    )}
                    {!form.is_materia_prima && (
                        <div className="col-12 md:col-4 field">
                            <label>Preço de Compra</label>
                            <InputNumber inputRef={precoCompraInputRef} value={form.preco_compra} onValueChange={e => { atualizarPrecoCompra(e.value ?? null); fixCursor(precoCompraInputRef); }} mode="currency" currency="BRL" locale="pt-BR" className="w-full" min={0} allowEmpty />
                            {formErrors.preco_compra && <small className="p-error">{formErrors.preco_compra}</small>}
                        </div>
                    )}
                    {!form.is_materia_prima && tipoPrecoVenda === 'percentual' && (
                        <div className="col-12 md:col-4 field">
                            <label>Lucro sobre a compra (%)</label>
                            <InputNumber
                                value={percentualLucro}
                                onValueChange={e => atualizarPercentualLucro(e.value ?? null)}
                                suffix="%"
                                locale="pt-BR"
                                min={0}
                                minFractionDigits={0}
                                maxFractionDigits={2}
                                className="w-full"
                                placeholder="Ex: 30"
                                allowEmpty
                            />
                            {formErrors.percentualLucro && <small className="p-error">{formErrors.percentualLucro}</small>}
                        </div>
                    )}
                    <div className={`${form.is_materia_prima ? 'col-12' : 'col-12 md:col-4'} field`}>
                        <label>
                            {form.is_materia_prima
                                ? 'Custo / Preço de Compra *'
                                : tipoPrecoVenda === 'percentual'
                                    ? `Preço de Venda Calculado${produtoEhEmbalagem ? ' (opcional)' : ' *'}`
                                    : `Preço de Venda${produtoEhEmbalagem ? ' (opcional)' : ' *'}`}
                        </label>
                        <InputNumber
                            inputRef={priceInputRef}
                            value={form.price}
                            onValueChange={e => { f('price', e.value ?? null); fixCursor(priceInputRef); }}
                            mode="currency"
                            currency="BRL"
                            locale="pt-BR"
                            className={`w-full ${formErrors.price ? 'p-invalid' : ''}`}
                            min={0}
                            allowEmpty
                            readOnly={!form.is_materia_prima && tipoPrecoVenda === 'percentual'}
                        />
                        {formErrors.price && <small className="p-error">{formErrors.price}</small>}
                        {!form.is_materia_prima && tipoPrecoVenda === 'percentual' && (
                            <small className="text-color-secondary">
                                Compra + {Number(percentualLucro || 0).toLocaleString('pt-BR')}% de lucro.
                            </small>
                        )}
                        {!form.is_materia_prima && produtoEhEmbalagem && (
                            <small className="text-color-secondary block">
                                A venda {posseEmbalagem(unidadeSelecionada)} pode ficar sem preço; o valor da unidade será definido após o cadastro.
                            </small>
                        )}
                    </div>

                    <Divider className="col-12" align="left"><span className="font-semibold text-color-secondary text-sm">Estoque</span></Divider>
                    <div className="col-6 md:col-3 field">
                        <label>Qtd. Mínima</label>
                        <InputNumber inputRef={minQtyInputRef} value={form.minQuantity} onValueChange={e => { f('minQuantity', e.value ?? null); fixCursor(minQtyInputRef); }} min={0} minFractionDigits={0} maxFractionDigits={qtyDecimals} step={qtyStep} locale="pt-BR" className={`w-full ${formErrors.minQuantity ? 'p-invalid' : ''}`} allowEmpty />
                        {formErrors.minQuantity && <small className="p-error">{formErrors.minQuantity}</small>}
                    </div>
                    <div className="col-6 md:col-3 field">
                        <label>Qtd. Atual</label>
                        <InputNumber inputRef={curQtyInputRef} value={form.currentQuantity} onValueChange={e => { f('currentQuantity', e.value ?? null); fixCursor(curQtyInputRef); }} min={0} minFractionDigits={0} maxFractionDigits={qtyDecimals} step={qtyStep} locale="pt-BR" className={`w-full ${formErrors.currentQuantity ? 'p-invalid' : ''}`} allowEmpty />
                        {formErrors.currentQuantity && <small className="p-error">{formErrors.currentQuantity}</small>}
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label>Lote</label>
                        <InputText value={form.lote} onChange={e => f('lote', e.target.value)} placeholder="Nº do lote" className="w-full" />
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label>Data de Validade</label>
                        <Calendar
                            value={dataIsoParaDate(form.data_validade)}
                            onChange={e => {
                                if (!e.value) { f('data_validade', null); return; }
                                const d = e.value as Date;
                                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                f('data_validade', iso);
                            }}
                            dateFormat="dd/mm/yy"
                            mask="99/99/9999"
                            maskSlotChar="_"
                            placeholder="DD/MM/AAAA"
                            keepInvalid
                            readOnlyInput={false}
                            showIcon
                            className="w-full"
                        />
                    </div>
                    {showPeso && (
                        <div className="col-12 md:col-6 field">
                            <label>Peso Bruto (kg)</label>
                            <InputNumber value={form.peso_bruto} onValueChange={e => f('peso_bruto', e.value ?? null)} minFractionDigits={3} maxFractionDigits={3} className={`w-full ${formErrors.peso_bruto ? 'p-invalid' : ''}`} suffix=" kg" allowEmpty />
                            {formErrors.peso_bruto && <small className="p-error">{formErrors.peso_bruto}</small>}
                        </div>
                    )}
                    {showPeso && (
                        <div className="col-12 md:col-6 field">
                            <label>Peso Líquido (kg)</label>
                            <InputNumber value={form.peso_liquido} onValueChange={e => f('peso_liquido', e.value ?? null)} minFractionDigits={3} maxFractionDigits={3} className={`w-full ${formErrors.peso_liquido ? 'p-invalid' : ''}`} suffix=" kg" allowEmpty />
                            {formErrors.peso_liquido && <small className="p-error">{formErrors.peso_liquido}</small>}
                        </div>
                    )}

                    <Divider className="col-12" align="left"><span className="font-semibold text-color-secondary text-sm">Fiscal</span></Divider>
                    <div className="col-12 md:col-3 field">
                        <label>NCM</label>
                        <InputText value={form.ncm} onChange={e => f('ncm', e.target.value)} keyfilter="alphanum" placeholder="00000000" maxLength={8} className={`w-full ${formErrors.ncm ? 'p-invalid' : ''}`} />
                        {formErrors.ncm && <small className="p-error">{formErrors.ncm}</small>}
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label>CFOP</label>
                        <InputText value={form.cfop} onChange={e => f('cfop', e.target.value)} keyfilter="num" placeholder="0000" maxLength={4} className={`w-full ${formErrors.cfop ? 'p-invalid' : ''}`} />
                        {formErrors.cfop && <small className="p-error">{formErrors.cfop}</small>}
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label>CEST</label>
                        <InputText value={form.cest} onChange={e => f('cest', e.target.value)} keyfilter="num" placeholder="0000000" maxLength={7} className={`w-full ${formErrors.cest ? 'p-invalid' : ''}`} />
                        {formErrors.cest && <small className="p-error">{formErrors.cest}</small>}
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label>CST / CSOSN</label>
                        <InputText value={form.cst_csosn} onChange={e => f('cst_csosn', e.target.value)} placeholder="Ex: 00, 400" className="w-full" />
                    </div>

                    <div className="col-6 md:col-3 field">
                        <label>Alíq. ICMS (%)</label>
                        <InputNumber value={form.aliquota_icms} onValueChange={e => f('aliquota_icms', e.value ?? null)} minFractionDigits={2} maxFractionDigits={2} suffix="%" className={`w-full ${formErrors.aliquota_icms ? 'p-invalid' : ''}`} min={0} max={100} allowEmpty />
                        {formErrors.aliquota_icms && <small className="p-error">{formErrors.aliquota_icms}</small>}
                    </div>
                    <div className="col-6 md:col-3 field">
                        <label>Alíq. PIS (%)</label>
                        <InputNumber value={form.aliquota_pis} onValueChange={e => f('aliquota_pis', e.value ?? null)} minFractionDigits={2} maxFractionDigits={2} suffix="%" className={`w-full ${formErrors.aliquota_pis ? 'p-invalid' : ''}`} min={0} max={100} allowEmpty />
                        {formErrors.aliquota_pis && <small className="p-error">{formErrors.aliquota_pis}</small>}
                    </div>
                    <div className="col-6 md:col-3 field">
                        <label>Alíq. COFINS (%)</label>
                        <InputNumber value={form.aliquota_cofins} onValueChange={e => f('aliquota_cofins', e.value ?? null)} minFractionDigits={2} maxFractionDigits={2} suffix="%" className={`w-full ${formErrors.aliquota_cofins ? 'p-invalid' : ''}`} min={0} max={100} allowEmpty />
                        {formErrors.aliquota_cofins && <small className="p-error">{formErrors.aliquota_cofins}</small>}
                    </div>
                    <div className="col-6 md:col-3 field">
                        <label>Alíq. IPI (%)</label>
                        <InputNumber value={form.aliquota_ipi} onValueChange={e => f('aliquota_ipi', e.value ?? null)} minFractionDigits={2} maxFractionDigits={2} suffix="%" className={`w-full ${formErrors.aliquota_ipi ? 'p-invalid' : ''}`} min={0} max={100} allowEmpty />
                        {formErrors.aliquota_ipi && <small className="p-error">{formErrors.aliquota_ipi}</small>}
                    </div>

                    <div className="col-12 field">
                        <label>Código de Barras</label>
                        <InputText value={form.codigo_barras} onChange={e => f('codigo_barras', e.target.value)} placeholder="Escaneie ou digite o código de barras" className="w-full" />
                    </div>

                    <Divider
                        className="col-12"
                        align="left"
                    >
                        <span className="font-semibold text-color-secondary text-sm">
                            Reforma Tributária — IBS/CBS
                        </span>
                    </Divider>

                    <div className="col-12 md:col-6 field">
                        <label htmlFor="ibs_cbs_situacao_tributaria">
                            CST IBS/CBS
                        </label>

                        <InputText
                            id="ibs_cbs_situacao_tributaria"
                            value={
                                form.ibs_cbs_situacao_tributaria || ''
                            }
                            onChange={e =>
                                f(
                                    'ibs_cbs_situacao_tributaria',
                                    e.target.value.replace(/\D/g, '')
                                )
                            }
                            keyfilter="num"
                            placeholder="000"
                            maxLength={3}
                            className={`w-full ${
                                formErrors.ibs_cbs_situacao_tributaria
                                    ? 'p-invalid'
                                    : ''
                            }`}
                        />

                        {formErrors.ibs_cbs_situacao_tributaria && (
                            <small className="p-error">
                                {formErrors.ibs_cbs_situacao_tributaria}
                            </small>
                        )}

                        <small className="text-color-secondary">
                            Código da Situação Tributária do IBS/CBS.
                        </small>
                    </div>

                    <div className="col-12 md:col-6 field">
                        <label htmlFor="ibs_cbs_classificacao_tributaria">
                            Classificação Tributária IBS/CBS
                        </label>

                        <InputText
                            id="ibs_cbs_classificacao_tributaria"
                            value={
                                form.ibs_cbs_classificacao_tributaria || ''
                            }
                            onChange={e =>
                                f(
                                    'ibs_cbs_classificacao_tributaria',
                                    e.target.value.replace(/\D/g, '')
                                )
                            }
                            keyfilter="num"
                            placeholder="000000"
                            maxLength={6}
                            className={`w-full ${
                                formErrors.ibs_cbs_classificacao_tributaria
                                    ? 'p-invalid'
                                    : ''
                            }`}
                        />

                        {formErrors.ibs_cbs_classificacao_tributaria && (
                            <small className="p-error">
                                {formErrors.ibs_cbs_classificacao_tributaria}
                            </small>
                        )}

                        <small className="text-color-secondary">
                            Código de classificação tributária do IBS/CBS.
                        </small>
                    </div>

                    {/* Situação Tributária PIS e COFINS */}
                    <Divider className="col-12" align="left"><span className="font-semibold text-color-secondary text-sm">Situação Tributária PIS/COFINS</span></Divider>

                    <div className="col-12 md:col-6 field">
                        <label>CST PIS</label>
                        <Dropdown
                            value={form.cst_pis || '07'}
                            options={cstPisCofinsOpcoes}
                            onChange={e => f('cst_pis', e.value)}
                            placeholder="Selecione o CST PIS"
                            className="w-full"
                            showClear
                        />
                        <small className="text-color-secondary">Código de Situação Tributária do PIS (padrão: 07 - Isenta)</small>
                    </div>

                    <div className="col-12 md:col-6 field">
                        <label>CST COFINS</label>
                        <Dropdown
                            value={form.cst_cofins || '07'}
                            options={cstPisCofinsOpcoes}
                            onChange={e => f('cst_cofins', e.value)}
                            placeholder="Selecione o CST COFINS"
                            className="w-full"
                            showClear
                        />
                        <small className="text-color-secondary">Código de Situação Tributária do COFINS (padrão: 07 - Isenta)</small>
                    </div>
                </div>
            </Dialog>

            <Dialog
                header="Criar produto unitário"
                visible={produtoUnitarioDialog}
                onHide={fecharProdutoUnitario}
                style={{ width: '94vw', maxWidth: '620px' }}
                modal
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" icon="pi pi-times" text onClick={fecharProdutoUnitario} disabled={salvandoProdutoUnitario} />
                        <Button
                            label="Criar produto unitário"
                            icon="pi pi-check"
                            onClick={criarProdutoUnitario}
                            loading={salvandoProdutoUnitario}
                            disabled={salvandoProdutoUnitario || !nomeProdutoUnitario.trim() || !precoVendaUnitarioValido}
                        />
                    </div>
                }
            >
                {produtoUnitarioPendente && (
                    <div className="flex flex-column gap-4">
                        <div className="surface-50 border-1 surface-border border-round p-3">
                            <div className="font-semibold mb-2">{produtoUnitarioPendente.dadosCaixa.name}</div>
                            <div className="grid">
                                <div className="col-6">
                                    <small className="text-color-secondary block">
                                        Unidades por {rotuloEmbalagem(
                                            produtoUnitarioPendente.dadosCaixa.unidade_medida
                                            || produtoUnitarioPendente.dadosCaixa.unidade_comercial
                                            || produtoUnitarioPendente.dadosCaixa.unidade_tributavel
                                        )}
                                    </small>
                                    <strong>{produtoUnitarioPendente.quantidadePorCaixa}</strong>
                                </div>
                                <div className="col-6">
                                    <small className="text-color-secondary block">Custo de compra unitário</small>
                                    <strong className="text-green-600">{fmtMoeda(produtoUnitarioPendente.custoUnitario)}</strong>
                                </div>
                            </div>
                            <small className="text-color-secondary">
                                Calculado pelo preço de compra da embalagem, sem usar o preço de venda dela. O estoque começa zerado e recebe unidades pela transferência.
                            </small>
                        </div>

                        <div className="field mb-0">
                            <label className="font-semibold block mb-2">Nome do novo produto</label>
                            <InputText
                                value={nomeProdutoUnitario}
                                onChange={e => setNomeProdutoUnitario(e.target.value)}
                                className="w-full"
                                placeholder="Ex: Refrigerante 350 ml"
                                autoFocus
                            />
                        </div>

                        <div className="field mb-0">
                            <label className="font-semibold block mb-2">Como deseja definir o preço de venda da unidade?</label>
                            <SelectButton
                                value={tipoPrecoVendaUnitario}
                                options={tipoPrecoVendaOpcoes}
                                onChange={e => e.value && setTipoPrecoVendaUnitario(e.value)}
                                optionLabel="label"
                                optionValue="value"
                                className="w-full"
                            />
                        </div>

                        {tipoPrecoVendaUnitario === 'valor' ? (
                            <div className="field mb-0">
                                <label className="block mb-2">Preço de venda da unidade</label>
                                <InputNumber
                                    value={precoVendaUnitarioInformado}
                                    onValueChange={e => setPrecoVendaUnitarioInformado(e.value ?? null)}
                                    mode="currency"
                                    currency="BRL"
                                    locale="pt-BR"
                                    min={0}
                                    className="w-full"
                                    inputClassName="w-full"
                                    placeholder="Informe o valor"
                                    autoFocus
                                    allowEmpty
                                />
                            </div>
                        ) : (
                            <div className="grid">
                                <div className="col-12 md:col-6 field mb-0">
                                    <label className="block mb-2">Lucro sobre a compra (%)</label>
                                    <InputNumber
                                        value={percentualLucroUnitario}
                                        onValueChange={e => setPercentualLucroUnitario(e.value ?? null)}
                                        suffix="%"
                                        locale="pt-BR"
                                        min={0}
                                        minFractionDigits={0}
                                        maxFractionDigits={2}
                                        className="w-full"
                                        inputClassName="w-full"
                                        placeholder="Ex: 30"
                                        autoFocus
                                        allowEmpty
                                    />
                                </div>
                                <div className="col-12 md:col-6 field mb-0">
                                    <label className="block mb-2">Preço de venda calculado</label>
                                    <InputNumber
                                        value={precoVendaUnitario}
                                        mode="currency"
                                        currency="BRL"
                                        locale="pt-BR"
                                        className="w-full"
                                        inputClassName="w-full"
                                        readOnly
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Dialog>

            {/* ── Dialog: Autenticação do responsável pelo inventário ── */}
            <Dialog
                visible={invAuthDialog}
                onHide={() => setInvAuthDialog(false)}
                header={
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-shield" style={{ color: '#6366f1', fontSize: '1.2rem' }} />
                        <span className="font-bold">Autenticação — Inventário</span>
                    </div>
                }
                style={{ width: '420px' }} modal
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" icon="pi pi-times" text onClick={() => setInvAuthDialog(false)} />
                        <Button
                            label="Confirmar e Abrir Inventário"
                            icon="pi pi-check"
                            loading={invVerificando}
                            onClick={confirmarAuthInventario}
                        />
                    </div>
                }
            >
                <div className="flex flex-column gap-3 p-2">
                    <p className="text-sm m-0" style={{ color: 'var(--text-color-secondary)' }}>
                        Selecione o responsável pela contagem e confirme com a senha para iniciar o inventário.
                    </p>
                    <div className="field m-0">
                        <label className="font-medium block mb-1">Responsável *</label>
                        <Dropdown
                            value={invResponsavelId}
                            options={invUsuarios.map(u => ({ label: u.nome, value: u.id }))}
                            onChange={e => {
                                setInvResponsavelId(e.value);
                                setInvResponsavelNome(invUsuarios.find(u => u.id === e.value)?.nome ?? '');
                            }}
                            placeholder="Selecione o usuário..."
                            filter
                            className="w-full"
                        />
                    </div>
                    <div className="field m-0">
                        <label className="font-medium block mb-1">Senha *</label>
                        <InputText
                            type="password"
                            value={invSenha}
                            onChange={e => setInvSenha(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmarAuthInventario()}
                            placeholder="Senha do responsável"
                            className="w-full"
                        />
                    </div>
                </div>
            </Dialog>

            <Dialog
                header={
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-list-check" style={{ color: '#6366f1', fontSize: '1.1rem' }} />
                        <span className="font-bold">Inventário — Conferência de Estoque</span>
                        {invResponsavelNome && (
                            <span style={{ fontSize: 12, background: '#eef2ff', color: '#4338ca', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
                                <i className="pi pi-user mr-1" style={{ fontSize: 10 }} />{invResponsavelNome}
                            </span>
                        )}
                    </div>
                }
                visible={inventarioDialog} style={{ width: '800px' }} modal
                onHide={() => setInventarioDialog(false)} footer={inventarioFooter}>
                <p className="text-sm text-color-secondary mb-3">
                    Informe a quantidade contada de cada produto. Ao aplicar, o sistema registra
                    movimentos de entrada/saída para igualar o estoque.
                </p>
                <span className="p-input-icon-left w-full mb-3 block">
                    <i className="pi pi-search" />
                    <InputText value={inventarioSearch} onChange={e => setInventarioSearch(e.target.value)} placeholder="Pesquisar produto por nome..." className="w-full" />
                </span>
                {(() => {
                    // Embutir contagem e justificativa nos dados para forçar re-render do DataTable
                    type InvRow = Product & { _contado: number; _diff: number; _just: string };
                    const invRows: InvRow[] = products
                        .filter(p => p.name.toLowerCase().includes(inventarioSearch.toLowerCase()))
                        .map(p => ({
                            ...p,
                            _contado: contagem[p.id] ?? p.currentQuantity,
                            _diff: (contagem[p.id] ?? p.currentQuantity) - p.currentQuantity,
                            _just: justificativas[p.id] ?? '',
                        }));
                    return (
                        <DataTable value={invRows} className="p-datatable-sm" tableStyle={{ minWidth: '40rem' }} emptyMessage="Nenhum produto encontrado">
                            <Column header="Produto" body={(p: InvRow) => (
                                <div>
                                    <div className="font-medium">{p.name}</div>
                                    {p.code && <div className="text-xs text-color-secondary">{p.code}</div>}
                                </div>
                            )} />
                            <Column header="Sistema" style={{ width: '7rem' }} body={(p: InvRow) => fmtQtd(p.currentQuantity, p.unidade_medida)} />
                            <Column header="Contado" style={{ width: '9rem' }} body={(p: InvRow) => (
                                <input type="number"
                                    value={p._contado}
                                    onChange={e => { const v = e.target.value; setContagem(prev => ({ ...prev, [p.id]: v === '' ? 0 : Number(v) })); }}
                                    min={0}
                                    step={isUnidadeInteira(p.unidade_medida) ? 1 : 0.001}
                                    className="p-inputtext p-component w-full" />
                            )} />
                            <Column header="Diferença" style={{ width: '7rem' }} body={(p: InvRow) => {
                                if (p._diff === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
                                const fmtDiff = fmtQtd(p._diff, p.unidade_medida);
                                return <span style={{ fontWeight: 700, color: p._diff > 0 ? '#16a34a' : '#dc2626' }}>{p._diff > 0 ? '+' : ''}{fmtDiff}</span>;
                            }} />
                            <Column header="Justificativa" body={(p: InvRow) => {
                                if (p._diff === 0) return <span style={{ color: '#9ca3af', fontSize: 12 }}>Sem ajuste</span>;
                                return (
                                    <InputTextarea
                                        value={p._just}
                                        onChange={e => setJustificativas(prev => ({ ...prev, [p.id]: e.target.value }))}
                                        rows={1} autoResize
                                        placeholder="Motivo do ajuste..."
                                        className="w-full" style={{ fontSize: 12 }}
                                    />
                                );
                            }} />
                        </DataTable>
                    );
                })()}
            </Dialog>

            {/* ── Dialog: Histórico por Produto ── */}
            <Dialog visible={histProdDialog} onHide={() => setHistProdDialog(false)}
                header={<div className="flex align-items-center gap-2"><i className="pi pi-history" style={{ color: '#6366f1', fontSize: '1.2rem' }} /><span className="font-bold">Histórico — {histProdNome}</span></div>}
                style={{ width: '700px' }} breakpoints={{ '960px': '95vw' }} modal maximizable>
                {histProdLoading ? (
                    <div className="flex justify-content-center align-items-center py-5 gap-2" style={{ color: 'var(--text-color-secondary)' }}>
                        <i className="pi pi-spin pi-spinner" style={{ fontSize: 22 }} />
                        <span>Carregando movimentações...</span>
                    </div>
                ) : histProdMovs.length === 0 ? (
                    <div className="flex flex-column align-items-center justify-content-center py-5 gap-2" style={{ color: 'var(--text-color-secondary)' }}>
                        <i className="pi pi-inbox" style={{ fontSize: 32 }} />
                        <span>Nenhuma movimentação registrada para este produto.</span>
                    </div>
                ) : (
                    <>
                        {(() => {
                            const entradas = histProdMovs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.quantidade), 0);
                            const saidas = histProdMovs.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.quantidade), 0);
                            const saldo = entradas - saidas;
                            const cards = [
                                { label: 'Ocorrências', val: histProdMovs.length.toLocaleString('pt-BR'), cor: '#6366f1', icon: 'pi-list' },
                                { label: 'Entradas brutas', val: fmtQtd(entradas, histProdUnidade), cor: '#16a34a', icon: 'pi-arrow-down' },
                                { label: 'Saídas brutas', val: fmtQtd(saidas, histProdUnidade), cor: '#dc2626', icon: 'pi-arrow-up' },
                                { label: 'Saldo líquido', val: `${saldo > 0 ? '+' : ''}${fmtQtd(saldo, histProdUnidade)}`, cor: saldo >= 0 ? '#0284c7' : '#dc2626', icon: 'pi-calculator' },
                            ];
                            return (
                        <div className="grid mb-3">
                            {cards.map((c, i) => (
                                <div key={i} className="col-6 md:col-3">
                                    <div className="p-3 border-round text-center" style={{ background: '#f9fafb', border: `1px solid ${c.cor}22` }}>
                                        <i className={`pi ${c.icon} mb-1 block`} style={{ color: c.cor, fontSize: 18 }} />
                                        <div style={{ fontSize: 22, fontWeight: 800, color: c.cor }}>{c.val}</div>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>{c.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                            );
                        })()}
                        <small className="block text-color-secondary mb-3">
                            Os saldos são reconstituídos a partir do estoque atual, para manter o histórico correto mesmo em produtos com movimentações antigas incompletas.
                        </small>
                        {(() => {
                            const movimentosOrdenados = [...histProdMovs].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
                            const variacaoTotal = movimentosOrdenados.reduce((total, movimento) => (
                                total + (movimento.tipo === 'entrada'
                                    ? Number(movimento.quantidade)
                                    : -Number(movimento.quantidade))
                            ), 0);
                            let saldoAcumulado = (histProdSaldoAtual ?? 0) - variacaoTotal;
                            const dadosComSaldo = movimentosOrdenados.map((m) => {
                                const delta = m.tipo === 'entrada' ? Number(m.quantidade) : -Number(m.quantidade);
                                const saldoAntes = saldoAcumulado;
                                saldoAcumulado += delta;
                                return {
                                    ...m,
                                    saldoAntes,
                                    saldoDepois: saldoAcumulado,
                                };
                            });

                            return (
                                <DataTable value={dadosComSaldo} paginator rows={10} className="p-datatable-sm" sortField="data" sortOrder={-1}>
                                    <Column header="Tipo" style={{ width: '8rem' }} body={(m: Movimento & { saldoAntes: number; saldoDepois: number }) => (
                                        <Tag value={m.tipo === 'entrada' ? 'Entrada' : 'Saída'} severity={m.tipo === 'entrada' ? 'success' : 'danger'} icon={m.tipo === 'entrada' ? 'pi pi-arrow-down' : 'pi pi-arrow-up'} />
                                    )} />
                                    <Column header="Qtd." sortable sortField="quantidade" style={{ width: '6rem' }} body={(m: Movimento & { saldoAntes: number; saldoDepois: number }) => fmtQtd(m.quantidade, histProdUnidade)} />
                                    <Column header="Saldo antes" style={{ width: '8rem' }} body={(m: Movimento & { saldoAntes: number; saldoDepois: number }) => fmtQtd(m.saldoAntes, histProdUnidade)} />
                                    <Column header="Saldo depois" style={{ width: '8rem' }} body={(m: Movimento & { saldoAntes: number; saldoDepois: number }) => fmtQtd(m.saldoDepois, histProdUnidade)} />
                                    <Column field="motivo" header="Motivo" />
                                    <Column header="Data/Hora" sortable sortField="data" body={(m: Movimento & { saldoAntes: number; saldoDepois: number }) => fmtData(m.data)} />
                                </DataTable>
                            );
                        })()}
                        <Divider align="left"><span className="font-semibold text-color-secondary text-sm">Evolução do custo de compra</span></Divider>
                        <div className="flex justify-content-between align-items-center mb-3">
                            <small className="text-color-secondary">Entradas por XML/NF e entradas manuais registram o custo praticado em cada compra.</small>
                            <strong>{fmtMoeda(histProdCustoAtual ?? 0)}</strong>
                        </div>
                        {histProdCustos.length === 0 ? (
                            <div className="surface-50 border-round p-3 text-center text-color-secondary">
                                Nenhuma entrada com custo registrada para este produto.
                            </div>
                        ) : (
                            <DataTable value={histProdCustos} paginator rows={10} className="p-datatable-sm" sortField="data_entrada" sortOrder={-1} responsiveLayout="scroll">
                                <Column header="Data" sortable sortField="data_entrada" body={(entrada: HistoricoCustoEntrada) => fmtData(entrada.data_entrada)} />
                                <Column header="Origem" body={(entrada: HistoricoCustoEntrada) => entrada.origem_tipo === 'nota_fiscal_entrada' ? <Tag value="NF / XML" severity="info" /> : <Tag value="Manual" severity="success" />} />
                                <Column header="Quantidade" body={(entrada: HistoricoCustoEntrada) => fmtQtd(entrada.quantidade, histProdUnidade)} />
                                <Column header="Custo anterior" body={(entrada: HistoricoCustoEntrada) => entrada.preco_anterior === null ? <span className="text-color-secondary">Não registrado</span> : fmtMoeda(entrada.preco_anterior)} />
                                <Column header="Novo custo" body={(entrada: HistoricoCustoEntrada) => entrada.preco_unitario === null ? <span className="text-color-secondary">Mantido</span> : fmtMoeda(entrada.preco_unitario)} />
                                <Column header="Documento" body={(entrada: HistoricoCustoEntrada) => entrada.documento || '—'} />
                            </DataTable>
                        )}
                    </>
                )}
            </Dialog>

            {/* ── Dialog: Relatório de Desperdícios ── */}
            <Dialog
                visible={desperdicioDialog}
                onHide={() => setDesperdicioDialog(false)}
                header={<div className="flex align-items-center gap-2"><i className="pi pi-exclamation-triangle" style={{ color: '#dc2626', fontSize: '1.2rem' }} /><span className="font-bold">Relatório de Desperdícios - Estoque</span></div>}
                style={{ width: '1120px' }}
                breakpoints={{ '1100px': '96vw' }}
                modal
                maximizable
            >
                <div className="flex align-items-end gap-2 flex-wrap mb-3">
                    <div className="field m-0">
                        <label className="block text-sm font-semibold mb-1">Período</label>
                        <Dropdown
                            value={desperdicioPeriodo}
                            options={[
                                { label: 'Dia atual', value: 'dia' },
                                { label: 'Semana atual', value: 'semana' },
                                { label: 'Mês atual', value: 'mes' },
                                { label: 'Personalizado', value: 'personalizado' },
                            ]}
                            onChange={e => setDesperdicioPeriodo(e.value)}
                            style={{ minWidth: 170 }}
                        />
                    </div>
                    {desperdicioPeriodo === 'personalizado' && (
                        <>
                            <div className="field m-0">
                                <label className="block text-sm font-semibold mb-1">Início</label>
                                <Calendar
                                    value={desperdicioDataInicio ? new Date(`${desperdicioDataInicio}T12:00:00`) : null}
                                    onChange={e => setDesperdicioDataInicio(e.value ? toDateOnly(e.value as Date) : '')}
                                    dateFormat="dd/mm/yy" showIcon placeholder="Data inicial"
                                />
                            </div>
                            <div className="field m-0">
                                <label className="block text-sm font-semibold mb-1">Fim</label>
                                <Calendar
                                    value={desperdicioDataFim ? new Date(`${desperdicioDataFim}T12:00:00`) : null}
                                    onChange={e => setDesperdicioDataFim(e.value ? toDateOnly(e.value as Date) : '')}
                                    dateFormat="dd/mm/yy" showIcon placeholder="Data final"
                                />
                            </div>
                        </>
                    )}
                    <Button label="Consultar" icon="pi pi-search" onClick={() => void consultarDesperdicios()} loading={desperdicioLoading} />
                    <Button label="Baixar PDF" icon="pi pi-file-pdf" severity="danger" outlined disabled={!desperdicioRelatorio} onClick={() => baixarPdfDesperdicios(desperdicioRelatorio)} />
                </div>

                {desperdicioRelatorio && (
                    <>
                        <div className="grid mb-2">
                            <div className="col-12 md:col-3">
                                <div className="p-3 border-round" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                                    <div className="text-sm text-color-secondary">Custo dos excedentes</div>
                                    <div className="text-2xl font-bold" style={{ color: '#b91c1c' }}>{fmtMoeda(desperdicioRelatorio.resumo.totalCustoEstimado)}</div>
                                    <small className="text-color-secondary">Custo de compra/reposição</small>
                                </div>
                            </div>
                            <div className="col-12 md:col-3">
                                <div className="p-3 border-round" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                                    <div className="text-sm text-color-secondary">Quantidade excedente</div>
                                    <div className="text-2xl font-bold" style={{ color: '#c2410c' }}>{desperdicioRelatorio.resumo.totalQuantidade.toLocaleString('pt-BR')}</div>
                                    <small className="text-color-secondary">Somatório das unidades</small>
                                </div>
                            </div>
                            <div className="col-12 md:col-3">
                                <div className="p-3 border-round" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                                    <div className="text-sm text-color-secondary">Ocorrências</div>
                                    <div className="text-2xl font-bold" style={{ color: '#334155' }}>{desperdicioRelatorio.resumo.totalOcorrencias}</div>
                                    <small className="text-color-secondary">Registros encontrados</small>
                                </div>
                            </div>
                            <div className="col-12 md:col-3">
                                <div className="p-3 border-round" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                    <div className="text-sm text-color-secondary">Produtos afetados</div>
                                    <div className="text-2xl font-bold" style={{ color: '#1d4ed8' }}>{desperdicioRelatorio.resumo.totalProdutos}</div>
                                    <small className="text-color-secondary">No período consultado</small>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                            <div className="text-sm text-color-secondary">
                                Período: <strong>{desperdicioRelatorio.dataInicio.split('-').reverse().join('/')} a {desperdicioRelatorio.dataFim.split('-').reverse().join('/')}</strong>
                            </div>
                            {desperdicioRelatorio.resumo.totalSemCusto > 0 && (
                                <Tag severity="warning" value={`${desperdicioRelatorio.resumo.totalSemCusto} registro(s) sem custo cadastrado`} />
                            )}
                        </div>

                        <h6 className="mt-2 mb-2">Resumo por produto</h6>
                        <DataTable value={desperdicioRelatorio.resumo.porProduto} className="p-datatable-sm mb-4" emptyMessage="Nenhum desperdício encontrado no período">
                            <Column field="produtoNome" header="Produto / MP" />
                            <Column header="Quantidade" body={(item: DesperdicioRelatorio['resumo']['porProduto'][number]) => `${item.quantidade.toLocaleString('pt-BR')} ${item.unidade}`} />
                            <Column header="Custo unitário" body={(item: DesperdicioRelatorio['resumo']['porProduto'][number]) => item.custoUnitario > 0 ? fmtMoeda(item.custoUnitario) : 'Sem custo'} />
                            <Column header="Perda estimada" body={(item: DesperdicioRelatorio['resumo']['porProduto'][number]) => <span className="font-bold" style={{ color: '#b91c1c' }}>{fmtMoeda(item.custoEstimado)}</span>} />
                            <Column field="ocorrencias" header="Ocorrências" />
                        </DataTable>

                        <h6 className="mb-2">Detalhamento</h6>
                        <DataTable value={desperdicioRelatorio.itens} paginator rows={8} rowsPerPageOptions={[8, 15, 30]} className="p-datatable-sm" emptyMessage="Nenhum desperdício encontrado no período" tableStyle={{ minWidth: '980px' }}>
                            <Column header="Data" body={(item: DesperdicioItem) => fmtData(item.data)} />
                            <Column header="Produto / MP" body={(item: DesperdicioItem) => <span className="font-semibold">{item.produtoNome}</span>} />
                            <Column header="Qtd." body={(item: DesperdicioItem) => `${item.quantidade.toLocaleString('pt-BR')} ${item.unidade}`} />
                            <Column header="Custo unit." body={(item: DesperdicioItem) => item.custoUnitario > 0 ? fmtMoeda(item.custoUnitario) : 'Sem custo'} />
                            <Column header="Perda estimada" body={(item: DesperdicioItem) => <span className="font-bold" style={{ color: '#b91c1c' }}>{fmtMoeda(item.custoEstimado)}</span>} />
                            <Column header="Receita" body={(item: DesperdicioItem) => item.receitaNome} />
                            <Column header="Ordem" body={(item: DesperdicioItem) => item.ordemId ? `#${item.ordemId}` : '-'} />
                            <Column header="Classificação" body={(item: DesperdicioItem) => (
                                <Tag value={item.classificacaoLabel || labelClassificacaoDesperdicio(item.classificacao)} severity={item.classificacao === 'rendimento_excedente' ? 'info' : item.classificacao === 'outro' ? 'warning' : 'danger'} />
                            )} />
                            <Column field="motivo" header="Motivo" />
                            <Column header="Observação" body={(item: DesperdicioItem) => item.observacao || '—'} />
                        </DataTable>
                        <small className="block text-color-secondary mt-3">
                            O custo é uma estimativa baseada na quantidade excedente multiplicada pelo custo de compra/reposição cadastrado. A classificação separa rendimento excedente de desperdício real; não representa emissão fiscal nem baixa adicional de estoque.
                        </small>
                    </>
                )}
                {!desperdicioRelatorio && !desperdicioLoading && (
                    <div className="text-center text-color-secondary py-5">Consulte um período para visualizar o relatório.</div>
                )}
            </Dialog>

            {/* ── Dialog: Giro de Estoque ── */}
            <Dialog visible={giroDialog} onHide={() => setGiroDialog(false)}
                header={<div className="flex align-items-center gap-2"><i className="pi pi-chart-bar" style={{ color: '#3b82f6', fontSize: '1.2rem' }} /><span className="font-bold">Relatório de Giro de Estoque</span></div>}
                style={{ width: '780px' }} breakpoints={{ '960px': '95vw' }} modal maximizable>
                {(() => {
                    // ── Filtro por período ──────────────────────────────────
                    const agora = new Date();
                    let giroInicio: Date | null = null;
                    let giroFim: Date | null = new Date(agora);
                    giroFim.setHours(23, 59, 59, 999);
                    if (giroPeriodo === 'semana') { giroInicio = new Date(agora); giroInicio.setDate(agora.getDate() - 6); giroInicio.setHours(0, 0, 0, 0); }
                    else if (giroPeriodo === 'mes') { giroInicio = new Date(agora.getFullYear(), agora.getMonth(), 1); }
                    else if (giroPeriodo === 'ano') { giroInicio = new Date(agora.getFullYear(), 0, 1); }
                    else { giroInicio = giroDataInicio ? new Date(giroDataInicio) : null; giroFim = giroDataFim ? (() => { const d = new Date(giroDataFim); d.setHours(23, 59, 59, 999); return d; })() : null; }
                    const movsFiltrados = movimentos.filter(m => {
                        const d = new Date(m.data ?? m.createdAt);
                        if (giroInicio && d < giroInicio) return false;
                        if (giroFim && d > giroFim) return false;
                        return true;
                    });

                    const { comGiro, semGiro } = calcularGiro(movsFiltrados);
                    const top = comGiro.slice(0, 10);
                    const parados = [...comGiro.filter(p => p.vezes === 0), ...semGiro].slice(0, 10);
                    return (
                        <div className="flex flex-column gap-4">
                            {/* Barra de filtro */}
                            <div className="flex align-items-center gap-2 flex-wrap">
                                {(['semana', 'mes', 'ano', 'custom'] as const).map(p => {
                                    const labels: Record<string, string> = { semana: 'Semana', mes: 'Mês', ano: 'Ano', custom: 'Personalizado' };
                                    return (
                                        <Button key={p} label={labels[p]} size="small"
                                            outlined={giroPeriodo !== p}
                                            onClick={() => setGiroPeriodo(p)}
                                            style={{ borderColor: '#1e3a5f', color: giroPeriodo === p ? '#fff' : '#1e3a5f', background: giroPeriodo === p ? '#1e3a5f' : 'transparent' }}
                                        />
                                    );
                                })}
                                {giroPeriodo === 'custom' && (
                                    <>
                                        <Calendar value={giroDataInicio} onChange={e => setGiroDataInicio(e.value as Date | null)} dateFormat="dd/mm/yy" showIcon placeholder="Data inicial" style={{ width: 170 }} />
                                        <Calendar value={giroDataFim} onChange={e => setGiroDataFim(e.value as Date | null)} dateFormat="dd/mm/yy" showIcon placeholder="Data final" style={{ width: 170 }} />
                                    </>
                                )}
                            </div>
                            <Divider className="my-0" />
                            <div>
                                <div className="flex align-items-center gap-2 mb-3">
                                    <i className="pi pi-arrow-up-right" style={{ color: '#16a34a', fontSize: 16 }} />
                                    <span className="font-bold" style={{ fontSize: '0.95rem', color: '#166534' }}>Produtos com mais saída</span>
                                    <span className="text-xs" style={{ color: '#9ca3af' }}>— baseado nas movimentações</span>
                                </div>
                                {top.length === 0 ? (
                                    <div className="text-center text-color-secondary py-3 border-round" style={{ background: 'var(--surface-ground)' }}>Nenhuma saída registrada ainda.</div>
                                ) : (
                                    <div className="flex flex-column gap-2">
                                        {top.map((p, i) => {
                                            const pct = Math.round((p.qtd / (top[0]?.qtd || 1)) * 100);
                                            return (
                                                <div key={p.id} className="flex align-items-center gap-3 p-2 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div className="font-semibold text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                                                        <div style={{ marginTop: 4, height: 6, background: '#dcfce7', borderRadius: 4 }}>
                                                            <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', borderRadius: 4 }} />
                                                        </div>
                                                    </div>
                                                    <div className="text-right" style={{ flexShrink: 0 }}>
                                                        <div style={{ fontWeight: 800, color: '#16a34a', fontSize: 14 }}>{Number(p.qtd).toLocaleString('pt-BR')} {p.unidade}.</div>
                                                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{p.vezes}x mov.</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <Divider className="my-1" />
                            <div>
                                <div className="flex align-items-center gap-2 mb-3">
                                    <i className="pi pi-clock" style={{ color: '#dc2626', fontSize: 16 }} />
                                    <span className="font-bold" style={{ fontSize: '0.95rem', color: '#7f1d1d' }}>Produtos parados</span>
                                    <span className="text-xs" style={{ color: '#9ca3af' }}>— sem nenhuma saída registrada</span>
                                </div>
                                {parados.length === 0 ? (
                                    <div className="text-center text-color-secondary py-3 border-round" style={{ background: 'var(--surface-ground)' }}>Todos os produtos têm movimentação.</div>
                                ) : (
                                    <div className="flex flex-column gap-2">
                                        {parados.map(p => (
                                            <div key={p.id} className="flex align-items-center justify-content-between p-2 border-round" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                                                <div className="flex align-items-center gap-2">
                                                    <i className="pi pi-box" style={{ color: '#dc2626', fontSize: 13 }} />
                                                    <span className="font-semibold text-sm">{p.nome}</span>
                                                </div>
                                                <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>Sem saída</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Dialog>

            {/* ── Dialog: Gerar Etiqueta ── */}
            <Dialog
                visible={etiquetaDialog}
                style={{ width: etiquetaForm.tipo === 'alimento' ? '1100px' : '780px' }}
                breakpoints={{ '960px': '90vw', '641px': '96vw' }}
                header={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="pi pi-tag" style={{ color: '#f59e0b', fontSize: '1.2rem' }} />
                        <span style={{ fontWeight: 700 }}>{etiquetaEditando ? 'Editar Etiqueta' : 'Gerar Etiqueta'}</span>
                    </div>
                }
                modal
                onHide={() => { setEtiquetaDialog(false); setEtiquetaEditando(null); }}
                footer={
                    <div className="flex justify-content-between align-items-center">
                        <Button label="Baixar PDF" icon="pi pi-file-pdf" severity="secondary" outlined
                            onClick={() => baixarPdfEtiqueta(etiquetaForm)} />
                        <div className="flex gap-2">
                            <Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={() => { setEtiquetaDialog(false); setEtiquetaEditando(null); }} />
                            <Button label={etiquetaEditando ? 'Salvar e Imprimir' : 'Emitir e Imprimir'} icon="pi pi-print" onClick={confirmarEtiqueta} />
                        </div>
                    </div>
                }
            >
                <div className="grid">
                    {/* Formulário */}
                    <div className="col-12 md:col-7">
                        <div className="grid formgrid">
                            <div className="col-12 field">
                                <label className="font-semibold block mb-2">Tipo de etiqueta</label>
                                <div className="flex gap-2 flex-wrap">
                                    {([
                                        { value: 'comum', label: 'Produto comum', icon: 'pi-tag' },
                                        { value: 'alimento', label: 'Alimento com tabela nutricional', icon: 'pi-book' },
                                    ] as const).map(op => (
                                        <Button key={op.value} type="button" label={op.label} icon={`pi ${op.icon}`}
                                            outlined={etiquetaForm.tipo !== op.value}
                                            severity={etiquetaForm.tipo === op.value ? 'info' : 'secondary'}
                                            onClick={() => setEtiquetaForm(f => ({
                                                ...f, tipo: op.value,
                                                tamanho: op.value === 'alimento' ? '80x80' : (['80x80', '100x150'].includes(f.tamanho) ? '60x40' : f.tamanho),
                                            }))} />
                                    ))}
                                </div>
                            </div>
                            <div className="col-12 field">
                                <label className="font-semibold">Nome do Produto *</label>
                                <InputText value={etiquetaForm.nomeProduto} onChange={e => setEtiquetaForm(f => ({ ...f, nomeProduto: e.target.value }))} className="w-full mt-1" placeholder="Ex: Arroz Integral 1kg" />
                            </div>
                            <div className="col-12 md:col-6 field">
                                <label className="font-semibold">SKU / Código Interno</label>
                                <InputText value={etiquetaForm.sku} onChange={e => setEtiquetaForm(f => ({ ...f, sku: e.target.value }))} className="w-full mt-1" placeholder="Ex: ARR-001" />
                            </div>
                            <div className="col-12 md:col-6 field">
                                <label className="font-semibold">Categoria</label>
                                <div className="flex gap-2 mt-1">
                                    <Dropdown
                                        value={etiquetaForm.categoria}
                                        options={categorias.map(c => ({ label: c.nome, value: c.nome }))}
                                        onChange={e => setEtiquetaForm(f => ({ ...f, categoria: e.value ?? '' }))}
                                        placeholder="Selecione..."
                                        className="w-full"
                                        showClear
                                        filter
                                        emptyMessage="Nenhuma categoria cadastrada"
                                    />
                                    <Button
                                        type="button"
                                        icon="pi pi-plus"
                                        severity="secondary"
                                        outlined
                                        tooltip="Criar categoria"
                                        tooltipOptions={{ position: 'top' }}
                                        onClick={() => { setNovaCatDestino('etiqueta'); setNovaCatNome(''); setNovaCatDialog(true); }}
                                        style={{ flexShrink: 0 }}
                                    />
                                </div>
                            </div>

                            {/* Bloco de código de barras */}
                            <div className="col-12 field">
                                <div style={{
                                    border: etiquetaForm.usarCodigoBarrasProduto ? '1.5px solid #1976d2' : '1.5px solid #e2e8f0',
                                    borderRadius: 10, padding: '12px 14px',
                                    background: etiquetaForm.usarCodigoBarrasProduto ? '#eff6ff' : 'var(--surface-ground)',
                                    transition: 'all 0.2s',
                                }}>
                                    <div className="flex align-items-center justify-content-between mb-2">
                                        <div className="flex align-items-center gap-2">
                                            <i className="pi pi-barcode" style={{ color: etiquetaForm.usarCodigoBarrasProduto ? '#1976d2' : 'var(--text-color-secondary)', fontSize: '1rem' }} />
                                            <span className="font-semibold" style={{ fontSize: '0.9rem' }}>Código de Barras do Produto</span>
                                        </div>
                                        <div className="flex align-items-center gap-2">
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-color-secondary)' }}>
                                                {etiquetaForm.usarCodigoBarrasProduto ? 'Vinculado' : 'Desvinculado'}
                                            </span>
                                            <InputSwitch
                                                checked={etiquetaForm.usarCodigoBarrasProduto}
                                                onChange={e => setEtiquetaForm(f => ({ ...f, usarCodigoBarrasProduto: !!e.value }))}
                                                disabled={!etiquetaForm.codigoBarras}
                                            />
                                        </div>
                                    </div>
                                    {etiquetaForm.codigoBarras && etiquetaForm.usarCodigoBarrasProduto ? (
                                        <div className="flex align-items-center gap-2">
                                            <div style={{
                                                flex: 1, fontFamily: '"Courier New", monospace',
                                                fontSize: '0.85rem', fontWeight: 700,
                                                color: '#1565c0',
                                                letterSpacing: '0.08em', padding: '4px 0',
                                            }}>
                                                {etiquetaForm.codigoBarras}
                                            </div>
                                            <Tag icon="pi pi-check" severity="info" value="Será impresso" style={{ fontSize: '0.72rem' }} />
                                        </div>
                                    ) : (
                                        <div>
                                            {!etiquetaForm.codigoBarras && (
                                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6 }}>
                                                    Produto sem código de barras cadastrado. Informe abaixo:
                                                </div>
                                            )}
                                            <InputText
                                                value={etiquetaForm.codigoBarras}
                                                onChange={e => setEtiquetaForm(f => ({ ...f, codigoBarras: e.target.value }))}
                                                className="w-full"
                                                placeholder="Digite ou escaneie o código de barras"
                                                style={{ fontFamily: '"Courier New", monospace', letterSpacing: '0.08em' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="col-12 md:col-6 field">
                                <label className="font-semibold">Preço <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400 }}>(opcional)</span></label>
                                <InputText value={etiquetaForm.preco} onChange={e => setEtiquetaForm(f => ({ ...f, preco: e.target.value }))} className="w-full mt-1" placeholder="Ex: 29.90" type="number" step="0.01" />
                            </div>
                            <div className="col-12 md:col-6 field">
                                <label className="font-semibold">Data de Impressão *</label>
                                <InputText type="date" value={etiquetaForm.dataImpressao} onChange={e => setEtiquetaForm(f => ({ ...f, dataImpressao: e.target.value }))} className="w-full mt-1" />
                            </div>
                            <div className="col-12 md:col-6 field">
                                <label className="font-semibold">Validade <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400 }}>(opcional)</span></label>
                                <InputText type="date" value={etiquetaForm.validade} onChange={e => setEtiquetaForm(f => ({ ...f, validade: e.target.value }))} className="w-full mt-1" />
                            </div>

                            {etiquetaForm.tipo === 'alimento' && (
                                <div className="col-12">
                                    <Divider align="left"><span className="font-semibold text-sm">Identificação do alimento</span></Divider>
                                    <div className="grid formgrid">
                                        <div className="col-12 md:col-3 field"><label className="font-semibold">Tipo do alimento</label><Dropdown value={etiquetaForm.tipoAlimento} options={[{ label: 'Sólido / semissólido', value: 'solido' }, { label: 'Líquido', value: 'liquido' }]} onChange={e => setEtiquetaForm(f => ({ ...f, tipoAlimento: e.value }))} className="w-full mt-1" /></div>
                                        <div className="col-12 md:col-3 field"><label className="font-semibold">Peso líquido *</label><InputText value={etiquetaForm.pesoLiquido} onChange={e => setEtiquetaForm(f => ({ ...f, pesoLiquido: e.target.value }))} className="w-full mt-1" placeholder="Ex: 500 g" /></div>
                                        <div className="col-12 md:col-3 field"><label className="font-semibold">Porção *</label><InputText value={etiquetaForm.porcao} onChange={e => setEtiquetaForm(f => ({ ...f, porcao: e.target.value, tabelaNutricional: recalcularTabelaNutricional(f.tabelaNutricional, e.target.value) }))} className="w-full mt-1" placeholder="Ex: 30 g" /></div>
                                        <div className="col-12 md:col-3 field"><label className="font-semibold">Medida caseira</label><InputText value={etiquetaForm.medidaCaseira} onChange={e => setEtiquetaForm(f => ({ ...f, medidaCaseira: e.target.value }))} className="w-full mt-1" placeholder="Ex: 2 colheres" /></div>
                                        <div className="col-12 md:col-6 field"><label className="font-semibold">Porções por embalagem</label><InputText value={etiquetaForm.porcoesPorEmbalagem} onChange={e => setEtiquetaForm(f => ({ ...f, porcoesPorEmbalagem: e.target.value }))} className="w-full mt-1" placeholder="Ex: Cerca de 16" /></div>
                                        <div className="col-12 md:col-6 field"><label className="font-semibold">Fabricante / responsável</label><InputText value={etiquetaForm.fabricante} onChange={e => setEtiquetaForm(f => ({ ...f, fabricante: e.target.value }))} className="w-full mt-1" placeholder="Nome ou razão social" /></div>
                                        <div className="col-12 field"><label className="font-semibold">Ingredientes *</label><InputTextarea autoResize rows={2} value={etiquetaForm.ingredientes} onChange={e => setEtiquetaForm(f => ({ ...f, ingredientes: e.target.value }))} className="w-full mt-1" placeholder="Liste em ordem decrescente de quantidade" /></div>
                                        <div className="col-12 field">
                                            <label className="font-semibold block mb-2">Principais alergênicos</label>
                                            <div style={{ border: '1px solid var(--surface-border)', borderRadius: 6, overflow: 'hidden' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))' }}>
                                                    {alergenicosPrincipais.map(nome => (
                                                        <div key={nome} className="px-3 py-2" style={{ borderBottom: '1px solid var(--surface-border)', borderRight: '1px solid var(--surface-border)' }}>
                                                            <div className="text-xs font-semibold mb-2">{nome}</div>
                                                            <div className="flex align-items-center gap-3 flex-wrap">
                                                                {(['contem', 'derivados', 'pode_conter'] as TipoDeclaracaoAlergeno[]).map(tipo => (
                                                                    <label key={tipo} className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            aria-label={`${nome} ${tipo}`}
                                                                            checked={etiquetaForm.alergenicosMarcados[nome] === tipo}
                                                                            onChange={() => atualizarAlergeno(nome, tipo)}
                                                                            style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#1976d2' }}
                                                                        />
                                                                        {tipo === 'contem' ? 'Contém' : tipo === 'derivados' ? 'Derivados' : 'Pode conter'}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="grid m-0 px-3 pt-3 pb-2" style={{ borderTop: '1px solid var(--surface-border)', background: 'var(--surface-ground)' }}>
                                                    <div className="col-12 md:col-8 field mb-2">
                                                        <label className="text-xs font-semibold block">Outros alergênicos</label>
                                                        <InputText value={etiquetaForm.outrosAlergenicos} onChange={e => atualizarOutrosAlergenicos(e.target.value)} className="w-full mt-1" placeholder="Separe vários itens por vírgula" />
                                                    </div>
                                                    <div className="col-12 md:col-4 field mb-2">
                                                        <label className="text-xs font-semibold block">Tipo de declaração</label>
                                                        <Dropdown value={etiquetaForm.outrosAlergenicosTipo} options={[{ label: 'Contém', value: 'contem' }, { label: 'Contém derivados', value: 'derivados' }, { label: 'Pode conter', value: 'pode_conter' }]} onChange={e => atualizarOutrosAlergenicos(etiquetaForm.outrosAlergenicos, e.value)} className="w-full mt-1" />
                                                    </div>
                                                    <div className="col-12 pt-0 pb-1 text-xs text-color-secondary">Para itens que não estejam na lista principal. Separe vários nomes por vírgula.</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 p-2 border-round text-xs" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontWeight: 700 }}>
                                                ALÉRGICOS: {etiquetaForm.alergenicos || 'NENHUM SELECIONADO'}
                                            </div>
                                        </div>
                                        <div className="col-12 md:col-5 field flex align-items-center gap-3 pt-3"><InputSwitch checked={etiquetaForm.contemGluten} onChange={e => setEtiquetaForm(f => ({ ...f, contemGluten: !!e.value }))} /><label className="font-semibold mb-0">Contém glúten</label></div>
                                        <div className="col-12 md:col-7 field"><label className="font-semibold">Conservação</label><InputText value={etiquetaForm.conservacao} onChange={e => setEtiquetaForm(f => ({ ...f, conservacao: e.target.value }))} className="w-full mt-1" placeholder="Ex: Manter em local seco e fresco" /></div>
                                    </div>

                                    <Divider align="left"><span className="font-semibold text-sm">Informação nutricional</span></Divider>
                                    <div style={{ overflowX: 'auto', border: '1px solid var(--surface-border)', borderRadius: 6 }}>
                                        <table style={{ width: '100%', minWidth: 590, borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ background: 'var(--surface-ground)' }}><th style={{ textAlign: 'left', padding: 8 }}>Componente</th><th style={{ padding: 8 }}>Por 100 g/ml</th><th style={{ padding: 8 }}>Por porção <small className="block font-normal">automático</small></th><th style={{ padding: 8 }}>%VD* <small className="block font-normal">automático</small></th></tr></thead>
                                            <tbody>{nutrientesPadrao.map(n => {
                                                const valor = etiquetaForm.tabelaNutricional[n.key];
                                                const valorEnergetico = n.key === 'valorEnergetico';
                                                const atualizarValor100g = (novoValor: string) => setEtiquetaForm(f => {
                                                    const tabelaAtualizada = { ...f.tabelaNutricional, [n.key]: { ...f.tabelaNutricional[n.key], por100g: novoValor } };
                                                    return { ...f, tabelaNutricional: recalcularTabelaNutricional(tabelaAtualizada, f.porcao) };
                                                });
                                                return (
                                                    <tr key={n.key} style={{ borderTop: '1px solid var(--surface-border)' }}>
                                                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{n.label} <small className="text-color-secondary">({n.unidade})</small>{valorEnergetico && <Tag value="Calculado" severity="info" className="ml-2" style={{ fontSize: '0.62rem' }} />}</td>
                                                        <td style={{ padding: 5 }}>
                                                            <InputText
                                                                aria-label={`${n.label} por 100 g/ml`}
                                                                data-nutricional-editavel={valorEnergetico ? undefined : 'true'}
                                                                value={valor.por100g}
                                                                onChange={e => atualizarValor100g(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key !== 'Enter' || valorEnergetico) return;
                                                                    e.preventDefault();
                                                                    const tabela = e.currentTarget.closest('table');
                                                                    const campos = Array.from(tabela?.querySelectorAll<HTMLInputElement>('input[data-nutricional-editavel="true"]') ?? []);
                                                                    const proximoCampo = campos[campos.indexOf(e.currentTarget) + 1];
                                                                    if (proximoCampo) {
                                                                        proximoCampo.focus();
                                                                        proximoCampo.select();
                                                                    }
                                                                }}
                                                                className="w-full"
                                                                inputMode="decimal"
                                                                readOnly={valorEnergetico}
                                                                style={valorEnergetico ? { background: 'var(--surface-ground)' } : undefined}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 5 }}><InputText aria-label={`${n.label} por porção`} value={valor.porPorcao} className="w-full" readOnly style={{ background: 'var(--surface-ground)' }} /></td>
                                                        <td style={{ padding: 5 }}><InputText aria-label={`${n.label} percentual diário`} value={valor.vd} className="w-full" readOnly style={{ background: 'var(--surface-ground)' }} /></td>
                                                    </tr>
                                                );
                                            })}</tbody>
                                        </table>
                                    </div>
                                    <small className="text-color-secondary block mt-2">Calorias: carboidratos × 4 + proteínas × 4 + gorduras totais × 9. A porção e o %VD são recalculados ao digitar. * Percentual de valores diários fornecidos pela porção.</small>
                                    <div className="field mt-3 mb-0">
                                        <label className="font-semibold">Modo de preparo <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400 }}>(opcional)</span></label>
                                        <InputTextarea autoResize rows={3} value={etiquetaForm.modoPreparo} onChange={e => setEtiquetaForm(f => ({ ...f, modoPreparo: e.target.value }))} className="w-full mt-1" placeholder="Ex: Misture o conteúdo em 200 ml de água e aqueça por 3 minutos." />
                                        <small className="text-color-secondary">Quando preenchido, será exibido abaixo da tabela nutricional.</small>
                                    </div>
                                </div>
                            )}
                            <div className="col-12 field">
                                <label className="font-semibold">Tamanho de Impressão</label>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {(etiquetaForm.tipo === 'alimento' ? tamanhoOpcoesAlimento : tamanhoOpcoes).map(op => (
                                        <div
                                            key={op.value}
                                            onClick={() => setEtiquetaForm(f => ({ ...f, tamanho: op.value as any }))}
                                            style={{
                                                padding: '8px 16px', borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                                                border: etiquetaForm.tamanho === op.value ? '2px solid #1976d2' : '2px solid #e2e8f0',
                                                background: etiquetaForm.tamanho === op.value ? '#eff6ff' : 'var(--surface-card)',
                                                color: etiquetaForm.tamanho === op.value ? '#1976d2' : 'var(--text-color)',
                                                fontWeight: etiquetaForm.tamanho === op.value ? 700 : 400,
                                                fontSize: '0.85rem', transition: 'all 0.15s',
                                            }}
                                        >
                                            {op.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pré-visualização */}
                    <div className="col-12 md:col-5 flex align-items-start justify-content-center">
                        <div style={{ background: 'var(--surface-ground)', borderRadius: 8, padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: etiquetaForm.tipo === 'alimento' ? 500 : 260, width: '100%', position: 'sticky', top: 0 }}>
                            <EtiquetaPreview dados={etiquetaForm} />
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* ── Dialog: Histórico de Etiquetas ── */}
            <Dialog
                visible={historicoDialog}
                style={{ width: '750px' }}
                breakpoints={{ '960px': '90vw', '641px': '96vw' }}
                header={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <i className="pi pi-tags" style={{ color: '#f59e0b', fontSize: '1.2rem' }} />
                            <span style={{ fontWeight: 700 }}>Histórico de Etiquetas</span>
                        </div>
                        <div style={{
                            background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 99,
                            padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            <i className="pi pi-tag" style={{ color: '#1976d2', fontSize: '0.85rem' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1976d2' }}>
                                {historicoEtiquetas.length} etiqueta{historicoEtiquetas.length !== 1 ? 's' : ''} emitida{historicoEtiquetas.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                }
                modal
                onHide={() => setHistoricoDialog(false)}
                footer={<Button label="Fechar" icon="pi pi-times" className="p-button-text" onClick={() => setHistoricoDialog(false)} />}
            >
                {historicoEtiquetas.length === 0 ? (
                    <div className="text-center py-5" style={{ color: 'var(--text-color-secondary)' }}>
                        <i className="pi pi-inbox" style={{ fontSize: '2.5rem', marginBottom: 12, display: 'block' }} />
                        <p>Nenhuma etiqueta emitida ainda.</p>
                    </div>
                ) : (
                    <DataTable value={historicoEtiquetas} paginator rows={8} rowsPerPageOptions={[8, 16, 32]} emptyMessage="Nenhuma etiqueta encontrada.">
                        <Column header="Produto" body={(e: Etiqueta) => (
                            <div>
                                <div className="font-semibold">{e.nomeProduto}</div>
                                <small style={{ color: 'var(--text-color-secondary)' }}>{e.sku}</small>
                            </div>
                        )} />
                        <Column header="Categoria" field="categoria" style={{ width: '120px' }} />
                        <Column header="Tamanho" body={(e: Etiqueta) => (
                            <span style={{ background: '#eff6ff', color: '#1976d2', borderRadius: 99, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                                {e.tamanho} mm
                            </span>
                        )} style={{ width: '110px' }} />
                        <Column header="Impressão" body={(e: Etiqueta) => e.dataImpressao ? new Date(e.dataImpressao + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} style={{ width: '110px' }} />
                        <Column header="Validade" body={(e: Etiqueta) => e.validade ? (
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{new Date(e.validade + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        ) : <span style={{ color: 'var(--text-color-secondary)' }}>—</span>} style={{ width: '100px' }} />
                        <Column header="Ações" style={{ width: '170px' }} body={(e: Etiqueta) => {
                            const form = normalizarEtiqueta({ ...e, preco: e.preco ?? '', codigoBarras: e.codigoBarras ?? '', usarCodigoBarrasProduto: e.usarCodigoBarrasProduto ?? false });
                            return (
                                <div className="flex gap-2">
                                    <Button icon="pi pi-pencil" rounded outlined severity="info" size="small"
                                        tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => editarEtiquetaHistorico(e)} />
                                    <Button icon="pi pi-print" rounded outlined severity="success" size="small"
                                        tooltip="Imprimir" tooltipOptions={{ position: 'top' }} onClick={() => imprimirEtiqueta(form)} />
                                    <Button icon="pi pi-file-pdf" rounded outlined severity="secondary" size="small"
                                        tooltip="Baixar PDF" tooltipOptions={{ position: 'top' }} onClick={() => baixarPdfEtiqueta(form)} />
                                    <Button icon="pi pi-trash" rounded outlined severity="danger" size="small"
                                        tooltip="Excluir" tooltipOptions={{ position: 'top' }} onClick={() => excluirEtiquetaHistorico(e.id)} />
                                </div>
                            );
                        }} />
                    </DataTable>
                )}
            </Dialog>
            {/* ── Dialog gerenciar categorias ── */}
            <Dialog
                visible={catManagerDialog}
                onHide={() => { setCatManagerDialog(false); setEditCatId(null); setNovaCatNome(''); }}
                header="Gerenciar Categorias"
                style={{ width: '480px' }}
                footer={<Button label="Fechar" severity="secondary" outlined onClick={() => setCatManagerDialog(false)} />}
            >
                {/* Adicionar nova */}
                <div className="flex gap-2 mb-4">
                    <InputText
                        value={novaCatNome}
                        onChange={e => setNovaCatNome(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && adicionarCategoriaNoManager()}
                        className="w-full"
                        placeholder="Nome da nova categoria..."
                    />
                    <Button icon="pi pi-plus" onClick={adicionarCategoriaNoManager} disabled={!novaCatNome.trim()} style={{ flexShrink: 0 }} />
                </div>

                {/* Lista de categorias */}
                {categorias.length === 0 ? (
                    <p className="text-color-secondary text-center py-3">Nenhuma categoria cadastrada.</p>
                ) : (
                    <div className="flex flex-column gap-2">
                        {categorias.map(cat => (
                            <div key={cat.id} className="flex align-items-center gap-2 p-2 border-round surface-border border-1">
                                {editCatId === cat.id ? (
                                    <>
                                        <InputText
                                            value={editCatNome}
                                            onChange={e => setEditCatNome(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && salvarEdicaoCategoria()}
                                            className="w-full"
                                            autoFocus
                                        />
                                        <Button icon="pi pi-check" severity="success" text onClick={salvarEdicaoCategoria} style={{ flexShrink: 0 }} />
                                        <Button icon="pi pi-times" severity="secondary" text onClick={() => { setEditCatId(null); setEditCatNome(''); }} style={{ flexShrink: 0 }} />
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 font-medium">{cat.nome}</span>
                                        <Button icon="pi pi-pencil" severity="secondary" text size="small" onClick={() => { setEditCatId(cat.id); setEditCatNome(cat.nome); }} />
                                        <Button icon="pi pi-trash" severity="danger" text size="small" onClick={() => excluirCategoria(cat)} />
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Dialog>

            {/* ── Dialog nova categoria (a partir do form de produto) ── */}
            <Dialog
                visible={novaCatDialog}
                onHide={() => setNovaCatDialog(false)}
                header="Nova Categoria"
                style={{ width: '380px' }}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" severity="secondary" outlined onClick={() => setNovaCatDialog(false)} />
                        <Button label="Criar" icon="pi pi-check" onClick={salvarNovaCategoria} disabled={!novaCatNome.trim()} />
                    </div>
                }
            >
                <div className="field">
                    <label className="block mb-2">Nome da categoria</label>
                    <InputText
                        value={novaCatNome}
                        onChange={e => setNovaCatNome(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && salvarNovaCategoria()}
                        className="w-full"
                        autoFocus
                        placeholder="Ex: Bebidas, Limpeza, Eletrônicos..."
                    />
                </div>
            </Dialog>

            {/* ══ DIALOG: Criar versão a granel ══ */}
            <Dialog
                visible={granelDialog}
                onHide={() => setGranelDialog(false)}
                header="Criar versão a granel"
                style={{ width: '440px' }}
                modal
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" severity="secondary" outlined onClick={() => setGranelDialog(false)} disabled={granelSalvando} />
                        <Button
                            label="Criar Produto"
                            icon="pi pi-plus"
                            onClick={salvarGranel}
                            loading={granelSalvando}
                            disabled={!granelNome.trim() || granelPreco100 <= 0}
                        />
                    </div>
                }
            >
                {granelProduto && (
                    <div className="flex flex-column gap-3 pt-2">
                        <div className="p-3 border-round" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div className="text-sm text-color-secondary mb-1">Produto original</div>
                            <div className="font-semibold">{granelProduto.name}</div>
                            {granelProduto.code && <div className="text-xs text-color-secondary">{granelProduto.code}</div>}
                        </div>

                        <div className="field">
                            <label htmlFor="granel-nome" className="font-semibold block mb-2">Nome do novo produto</label>
                            <InputText
                                id="granel-nome"
                                value={granelNome}
                                onChange={event => setGranelNome(event.target.value)}
                                className="w-full"
                                maxLength={255}
                                placeholder="Ex: Nutella a granel"
                            />
                            <small className="text-color-secondary block mt-1">
                                Você pode trocar a sugestão por um nome mais adequado para a venda.
                            </small>
                        </div>

                        <div className="field">
                            <label className="font-semibold block mb-2">Unidade de venda a granel</label>
                            <Dropdown
                                value={granelUnidade}
                                options={[
                                    { label: 'ML – Mililitro', value: 'ML' },
                                    { label: 'G – Grama', value: 'G' },
                                    { label: 'KG – Quilograma', value: 'KG' },
                                    { label: 'LT – Litro', value: 'LT' },
                                    { label: 'CM – Centímetro', value: 'CM' },
                                    { label: 'MT – Metro', value: 'MT' },
                                ]}
                                onChange={e => setGranelUnidade(e.value)}
                                className="w-full"
                            />
                        </div>

                        <div className="field">
                            <label className="font-semibold block mb-2">
                                {granelLabelPreco}
                            </label>
                            <InputNumber
                                value={granelPreco100}
                                onValueChange={e => setGranelPreco100(e.value ?? 0)}
                                mode="currency" currency="BRL" locale="pt-BR"
                                className="w-full" min={0}
                                placeholder="Ex: R$ 5,00"
                                allowEmpty
                            />
                            {!granelPrecoPorUm && (
                                <small className="text-color-secondary block mt-1">
                                    Preço calculado para 1 {granelUnidadeAbreviada}: {fmtMoeda(granelPreco100 / 100)}.
                                </small>
                            )}
                        </div>

                        <div className="p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div className="text-sm font-semibold" style={{ color: '#16a34a' }}>
                                <i className="pi pi-check-circle mr-1" />
                                Será criado como novo produto
                            </div>
                            <div className="text-sm mt-1" style={{ color: '#15803d' }}>
                                &quot;{granelNome.trim() || 'Informe o nome do produto'}&quot; — vendido por {granelUnidade.toLowerCase()}, com todas as informações fiscais do produto original.
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* ══ DIALOG: Transferência Granel ══ */}
            <Dialog
                visible={transDialog}
                onHide={() => setTransDialog(false)}
                header="Transferir para Granel"
                style={{ width: '480px' }}
                modal
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" severity="secondary" outlined onClick={() => setTransDialog(false)} disabled={transSalvando} />
                        <Button label="Transferir" icon="pi pi-arrow-right" onClick={salvarTransferenciaGranel} loading={transSalvando}
                            disabled={transQtdSaida <= 0 || transQtdEntrada <= 0} />
                    </div>
                }
            >
                {transProdutoOrigem && transProdutoGranel && (
                    <div className="flex flex-column gap-3 pt-2">
                        {/* Produto original */}
                        <div className="p-3 border-round" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                            <div className="flex justify-content-between align-items-center mb-2">
                                <div>
                                    <div className="text-xs text-color-secondary">Produto original (saída)</div>
                                    <div className="font-semibold">{transProdutoOrigem.name}</div>
                                </div>
                                <Tag value={`Estoque: ${Number(transProdutoOrigem.currentQuantity).toLocaleString('pt-BR')} ${(transProdutoOrigem.unidade_medida || 'UN').toLowerCase()}`}
                                    severity={Number(transProdutoOrigem.currentQuantity) > 0 ? 'info' : 'danger'} />
                            </div>
                            <div className="field mb-0">
                                <label className="font-semibold text-sm block mb-1">
                                    Quanto sai do original? ({(transProdutoOrigem.unidade_medida || 'UN').toLowerCase()})
                                </label>
                                <InputNumber
                                    value={transQtdSaida}
                                    onValueChange={e => setTransQtdSaida(e.value ?? 0)}
                                    min={0}
                                    max={Number(transProdutoOrigem.currentQuantity)}
                                    minFractionDigits={0}
                                    maxFractionDigits={isUnidadeInteira(transProdutoOrigem.unidade_medida) ? 0 : 3}
                                    useGrouping={false}
                                    className="w-full"
                                    placeholder="Ex: 1"
                                    allowEmpty
                                />
                            </div>
                        </div>

                        {/* Seta */}
                        <div className="flex justify-content-center">
                            <i className="pi pi-arrow-down" style={{ fontSize: '1.5rem', color: '#6366f1' }} />
                        </div>

                        {/* Produto granel */}
                        <div className="p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div className="flex justify-content-between align-items-center mb-2">
                                <div>
                                    <div className="text-xs text-color-secondary">Produto a granel (entrada)</div>
                                    <div className="font-semibold">{transProdutoGranel.name}</div>
                                </div>
                                <Tag value={`Estoque: ${Number(transProdutoGranel.currentQuantity).toLocaleString('pt-BR')} ${(transProdutoGranel.unidade_medida || 'UN').toLowerCase()}`}
                                    severity="info" />
                            </div>
                            <div className="field mb-0">
                                <label className="font-semibold text-sm block mb-1">
                                    Quanto entra no granel? ({(transProdutoGranel.unidade_medida || 'UN').toLowerCase()})
                                </label>
                                <InputNumber
                                    value={transQtdEntrada}
                                    onValueChange={e => setTransQtdEntrada(e.value ?? 0)}
                                    min={0}
                                    minFractionDigits={0}
                                    maxFractionDigits={isUnidadeInteira(transProdutoGranel.unidade_medida) ? 0 : 3}
                                    useGrouping={false}
                                    className="w-full"
                                    placeholder={`Ex: 500`}
                                    allowEmpty
                                />
                            </div>
                        </div>

                        {/* Resumo */}
                        {transQtdSaida > 0 && transQtdEntrada > 0 && (
                            <div className="p-3 border-round" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <div className="text-sm font-semibold mb-1"><i className="pi pi-info-circle mr-1" style={{ color: '#6366f1' }} />Resumo da transferência</div>
                                <div className="text-sm">
                                    <span style={{ color: '#dc2626', fontWeight: 700 }}>-{transQtdSaida} {(transProdutoOrigem.unidade_medida || 'UN').toLowerCase()}</span>
                                    {' '}de &quot;{transProdutoOrigem.name}&quot;
                                </div>
                                <div className="text-sm">
                                    <span style={{ color: '#16a34a', fontWeight: 700 }}>+{transQtdEntrada} {(transProdutoGranel.unidade_medida || 'UN').toLowerCase()}</span>
                                    {' '}em &quot;{transProdutoGranel.name}&quot;
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Dialog>

            {/* ══ DIALOG: Transferência de embalagem → Unidade ══ */}
            <Dialog
                visible={transCaixaDialog}
                onHide={() => setTransCaixaDialog(false)}
                header={`Transferir ${pluralEmbalagem(transProdutoCaixa?.unidade_medida)} para unidades`}
                style={{ width: '94vw', maxWidth: '520px' }}
                modal
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button
                            label="Cancelar"
                            severity="secondary"
                            outlined
                            onClick={() => setTransCaixaDialog(false)}
                            disabled={transCaixaSalvando}
                        />
                        <Button
                            label="Confirmar transferência"
                            icon="pi pi-arrow-right"
                            onClick={salvarTransferenciaCaixa}
                            loading={transCaixaSalvando}
                            disabled={
                                transCaixaSalvando
                                || !Number.isInteger(transQtdCaixas)
                                || Number(transQtdCaixas) <= 0
                                || transCaixasExcedeEstoque
                            }
                        />
                    </div>
                }
            >
                {transProdutoCaixa && transProdutoUnidade && (
                    <div className="flex flex-column gap-3 pt-2">
                        <div className="p-3 border-round" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                            <div className="flex justify-content-between align-items-center gap-3">
                                <div>
                                    <small className="text-color-secondary block">
                                        {rotuloEmbalagem(transProdutoCaixa.unidade_medida) === 'pacote' ? 'Pacote' : 'Caixa'} de origem
                                    </small>
                                    <strong>{transProdutoCaixa.name}</strong>
                                </div>
                                <Tag
                                    value={`${fmtQtd(transProdutoCaixa.currentQuantity, transProdutoCaixa.unidade_medida)} ${pluralEmbalagem(transProdutoCaixa.unidade_medida)}`}
                                    severity={Number(transProdutoCaixa.currentQuantity) > 0 ? 'info' : 'danger'}
                                />
                            </div>
                        </div>

                        <div className="field mb-0">
                            <label className="font-semibold block mb-2">
                                {perguntaQuantidadeEmbalagem(transProdutoCaixa.unidade_medida)} deseja abrir?
                            </label>
                            <InputNumber
                                value={transQtdCaixas}
                                onValueChange={e => setTransQtdCaixas(e.value ?? null)}
                                min={1}
                                maxFractionDigits={0}
                                useGrouping={false}
                                showButtons={false}
                                className="w-full"
                                inputClassName={`w-full${transCaixasExcedeEstoque ? ' p-invalid' : ''}`}
                                placeholder="Ex: 2"
                                allowEmpty
                                onWheel={event => {
                                    event.preventDefault();
                                    (event.target as HTMLInputElement).blur();
                                }}
                                onKeyDown={event => {
                                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault();
                                }}
                            />
                            {transCaixasExcedeEstoque ? (
                                <small className="p-error block mt-2">
                                    Estoque insuficiente: existem somente {transCaixasDisponiveis} {pluralEmbalagem(transProdutoCaixa.unidade_medida)} disponíveis.
                                </small>
                            ) : (
                                <small className="text-color-secondary block mt-2">
                                    Disponível para transferência: {transCaixasDisponiveis} {pluralEmbalagem(transProdutoCaixa.unidade_medida)}.
                                </small>
                            )}
                        </div>

                        <div className="flex justify-content-center">
                            <i className="pi pi-arrow-down" style={{ fontSize: '1.5rem', color: '#6366f1' }} />
                        </div>

                        <div className="p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div className="flex justify-content-between align-items-center gap-3">
                                <div>
                                    <small className="text-color-secondary block">Produto unitário</small>
                                    <strong>{transProdutoUnidade.name}</strong>
                                </div>
                                <Tag value={`${fmtQtd(transProdutoUnidade.currentQuantity, 'UN')} un`} severity="success" />
                            </div>
                            <Divider className="my-3" />
                            <div className="flex justify-content-between align-items-center">
                                <span className="text-sm">Unidades por {rotuloEmbalagem(transProdutoCaixa.unidade_medida)}</span>
                                <strong>{Number(transProdutoCaixa.unidades_por_caixa || 0)}</strong>
                            </div>
                            <div className="flex justify-content-between align-items-center mt-2">
                                <span className="text-sm">Entrada calculada</span>
                                <strong style={{ color: '#16a34a' }}>
                                    +{Number(transQtdCaixas || 0) * Number(transProdutoCaixa.unidades_por_caixa || 0)} un
                                </strong>
                            </div>
                        </div>

                        <small className="text-color-secondary">
                            A operação retira {pluralEmbalagem(transProdutoCaixa.unidade_medida)} do produto de origem e adiciona automaticamente a quantidade equivalente ao produto unitário.
                        </small>
                    </div>
                )}
            </Dialog>

            <FiscalProductLinkDialog
                visible={xmlLinkDialog}
                preview={xmlPreview}
                saving={xmlImportando}
                onHide={() => {
                    if (xmlImportando) return;
                    setXmlLinkDialog(false);
                    setXmlFile(null);
                    setXmlPreview(null);
                }}
                onConfirm={confirmarImportacaoXML}
            />

            <StockLocationsDialog
                visible={stockLocationsDialog}
                onHide={() => setStockLocationsDialog(false)}
                onTransferred={sincronizarEstoque}
            />

        </div>
    );
};

export default EstoquePage;
