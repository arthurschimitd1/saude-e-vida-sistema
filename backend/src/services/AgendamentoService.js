import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Agendamento from '../models/Agendamento.js';
import AgendamentoColaborador from '../models/AgendamentoColaborador.js';
import AgendamentoServico from '../models/AgendamentoServico.js';
import AgendamentoServicoUnidade from '../models/AgendamentoServicoUnidade.js';
import AgendamentoBloqueio from '../models/AgendamentoBloqueio.js';
import AgendamentoBloqueioRecorrente from '../models/AgendamentoBloqueioRecorrente.js';
import AgendamentoBloqueioRecorrenteExcecao from '../models/AgendamentoBloqueioRecorrenteExcecao.js';
import AgendamentoUnidade from '../models/AgendamentoUnidade.js';
import Cliente from '../models/Cliente.js';
import Empresa from '../models/Empresa.js';
import Recorrencia from '../models/Recorrencia.js';
import User from '../models/UserModel.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';
import { calcularBeneficiosRecorrencia, montarStatusFranquia, servicoInclusoCorresponde } from '../utils/franquiaRecorrencia.js';
import {
    deveNotificarAgendamentoWhatsapp,
    ehDomFerrazSape,
    montarMensagemAgendamentoWhatsapp,
} from '../utils/agendamentoWhatsapp.js';
import conversaWhatsappService from './whatsappCrm/ConversaService.js';
import mensagemWhatsappService from './whatsappCrm/MensagemService.js';
import comissaoAssinaturaService from './ComissaoAssinaturaService.js';
import {
    horarioPertenceConfiguracao,
    obterConfiguracaoAgendamento,
    salvarConfiguracaoAgendamento,
} from './AgendamentoConfiguracaoService.js';

const STATUS_VALIDOS = new Set([
    'aguardando',
    'confirmado',
    'em_atendimento',
    'finalizado',
    'cancelado',
    'reagendado',
]);

const SERVICOS_PADRAO = [
    { id: 'srv_corte', nome: 'Corte de Cabelo', duracaoMin: 30, preco: 45, cor: '#3b82f6' },
    { id: 'srv_barba', nome: 'Barba', duracaoMin: 20, preco: 30, cor: '#f59e0b' },
    { id: 'srv_combo', nome: 'Corte + Barba', duracaoMin: 50, preco: 65, cor: '#8b5cf6' },
    { id: 'srv_coloracao', nome: 'Coloração', duracaoMin: 60, preco: 90, cor: '#ec4899' },
    { id: 'srv_manicure', nome: 'Manicure', duracaoMin: 40, preco: 35, cor: '#10b981' },
    { id: 'srv_pedicure', nome: 'Pedicure', duracaoMin: 40, preco: 40, cor: '#06b6d4' },
    { id: 'srv_sobrancelha', nome: 'Design de Sobrancelha', duracaoMin: 20, preco: 25, cor: '#f97316' },
    { id: 'srv_massagem', nome: 'Massagem Relaxante', duracaoMin: 60, preco: 120, cor: '#6366f1' },
];

const dataOnly = (value) => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
};

export const diaSemanaDataCivil = (data) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? ''))) return null;
    const dia = new Date(`${data}T12:00:00.000Z`);
    return Number.isNaN(dia.getTime()) ? null : dia.getUTCDay();
};

export const regraRecorrenteAplicaNaData = (regra, data) => {
    if (!data || data < regra.data_inicio || (regra.data_fim && data > regra.data_fim)) return false;
    const diasSemana = Array.isArray(regra.dias_semana) ? regra.dias_semana.map(Number) : [];
    return diasSemana.includes(diaSemanaDataCivil(data));
};

export const filtrarRecorrenciasComExcecao = (recorrencias, excecoes = []) => {
    const idsExcluidos = new Set(excecoes.map((excecao) => Number(excecao.recorrente_id)));
    return recorrencias.filter((recorrencia) => !idsExcluidos.has(Number(recorrencia.id)));
};

const bloqueioToFront = (bloqueio, dataEfetiva = bloqueio.data) => {
    const recorrente = Boolean(bloqueio.data_inicio);
    return {
        id: bloqueio.id,
        colaboradorId: bloqueio.colaborador_id,
        data: dataEfetiva,
        diaInteiro: !bloqueio.hora_inicio || !bloqueio.hora_fim,
        horaInicio: bloqueio.hora_inicio ? String(bloqueio.hora_inicio).slice(0, 5) : null,
        horaFim: bloqueio.hora_fim ? String(bloqueio.hora_fim).slice(0, 5) : null,
        motivo: bloqueio.motivo ?? null,
        recorrente,
        recorrenteId: recorrente ? bloqueio.id : null,
        diasSemana: recorrente && Array.isArray(bloqueio.dias_semana) ? bloqueio.dias_semana.map(Number) : [],
        dataInicio: recorrente ? bloqueio.data_inicio : null,
        dataFim: recorrente ? bloqueio.data_fim : null,
    };
};

const normalizarSnapshotServico = (servico) => {
    const id = String(servico?.id ?? servico?.servicoId ?? servico?.servico_id ?? '').trim();
    const nome = String(servico?.nome ?? servico?.name ?? servico?.servicoNome ?? servico?.servico_nome ?? '').trim();
    if (!id && !nome) return null;
    const precoInformado = servico?.preco ?? servico?.price;
    const preco = precoInformado === null || precoInformado === undefined || !Number.isFinite(Number(precoInformado))
        ? null
        : Number(precoInformado);
    const duracao = Number(servico?.duracaoMin ?? servico?.duration ?? servico?.duracao_min ?? 30);
    return {
        id: id || null,
        nome,
        preco,
        precoTexto: servico?.precoTexto ?? servico?.priceLabel ?? servico?.preco_texto ?? null,
        duracaoMin: Number.isFinite(duracao) && duracao > 0 ? Math.round(duracao) : 30,
    };
};

export const extrairIdsServicosAgendamento = (data = {}) => {
    const fonte = Array.isArray(data.servicoIds)
        ? data.servicoIds
        : Array.isArray(data.servicos)
            ? data.servicos.map((servico) => typeof servico === 'object' ? servico?.id ?? servico?.servicoId ?? servico?.servico_id : servico)
            : data.servicoId !== undefined
                ? [data.servicoId]
                : [];
    return [...new Set(fonte.map((id) => String(id ?? '').trim()).filter(Boolean))];
};

export const resumirServicosAgendamento = (servicos = []) => {
    const lista = servicos.map(normalizarSnapshotServico).filter(Boolean);
    const possuiPrecoTexto = lista.some((servico) => servico.precoTexto);
    return {
        servicos: lista,
        servicoId: lista[0]?.id ?? null,
        servicoNome: lista.map((servico) => servico.nome).filter(Boolean).join(' + ') || null,
        servicoPreco: lista.length && !possuiPrecoTexto
            ? lista.reduce((total, servico) => total + Number(servico.preco ?? 0), 0)
            : null,
        servicoPrecoTexto: possuiPrecoTexto
            ? lista.map((servico) => servico.precoTexto || servico.nome).filter(Boolean).join(' + ')
            : null,
        servicoDuracaoMin: lista.length
            ? lista.reduce((total, servico) => total + Number(servico.duracaoMin || 30), 0)
            : null,
    };
};

const servicosDoAgendamento = (agendamento) => {
    if (Array.isArray(agendamento?.servicos) && agendamento.servicos.length) {
        return resumirServicosAgendamento(agendamento.servicos).servicos;
    }
    if (!agendamento?.servico_id && !agendamento?.servico_nome) return [];
    return resumirServicosAgendamento([{
        id: agendamento.servico_id,
        nome: agendamento.servico_nome,
        preco: agendamento.servico_preco,
        precoTexto: agendamento.servico_preco_texto,
        duracaoMin: agendamento.servico_duracao_min ?? 30,
    }]).servicos;
};

const colaboradorToFront = (colaborador) => ({
    id: String(colaborador.id),
    usuarioId: colaborador.usuario_id ?? null,
    usuarioNome: colaborador.usuario_nome,
    cor: colaborador.cor,
    ordem: colaborador.ordem,
    avatarUrl: colaborador.avatar_url ?? null,
    avatarPosition: colaborador.avatar_position ?? '50% 50%',
    unidadeId: colaborador.unidade_id ? String(colaborador.unidade_id) : null,
});

const unidadeToFront = (unidade) => ({
    id: String(unidade.id),
    nome: unidade.nome,
    endereco: unidade.endereco ?? '',
    telefone: unidade.telefone ?? '',
    principal: Boolean(unidade.principal),
    ativa: Boolean(unidade.ativa),
});

const agendamentoToFront = (agendamento) => ({
    id: String(agendamento.id),
    colaboradorId: String(agendamento.colaborador_id),
    unidadeId: agendamento.unidade_id ? String(agendamento.unidade_id) : null,
    clienteId: agendamento.cliente_id ? String(agendamento.cliente_id) : undefined,
    clienteNome: agendamento.cliente_nome,
    clienteTelefone: agendamento.cliente_telefone ?? '',
    clienteEmail: agendamento.cliente_email ?? undefined,
    clienteNascimento: agendamento.cliente_nascimento ?? undefined,
    servicoId: agendamento.servico_id ?? undefined,
    servicoNome: agendamento.servico_nome ?? undefined,
    servicoPreco: agendamento.servico_preco === null || agendamento.servico_preco === undefined
        ? undefined
        : Number(agendamento.servico_preco),
    servicoPrecoTexto: agendamento.servico_preco_texto ?? null,
    servicoDuracaoMin: agendamento.servico_duracao_min === null || agendamento.servico_duracao_min === undefined
        ? undefined
        : Number(agendamento.servico_duracao_min),
    servicos: servicosDoAgendamento(agendamento),
    data: agendamento.data,
    horario: agendamento.horario,
    observacao: agendamento.observacao ?? '',
    status: STATUS_VALIDOS.has(agendamento.status) ? agendamento.status : 'aguardando',
    criadoEm: agendamento.criado_em?.toISOString?.() ?? agendamento.criado_em,
    formaPagamento: agendamento.forma_pagamento ?? undefined,
    historico: Array.isArray(agendamento.historico) ? agendamento.historico : [],
    forcarEncaixe: Boolean(agendamento.encaixe_forcado),
});

export const usuarioPodeForcarEncaixe = (usuario) => Boolean(
    usuario?.tipo === 'MASTER'
    || usuario?.tipo === 'EMPRESA'
    || (Array.isArray(usuario?.permissoes) && usuario.permissoes.includes('agendamento:todos'))
);

export const deveRevalidarDisponibilidadeNaAtualizacao = ({
    alterouAgenda,
    statusAtual,
    statusDestino,
}) => Boolean(
    alterouAgenda
    || (statusAtual === 'cancelado' && statusDestino && statusDestino !== 'cancelado')
);

const clienteToFront = (cliente, index = 0) => ({
    id: String(cliente.id),
    nome: cliente.nomeCompleto,
    telefone: cliente.telefone,
    whatsapp: cliente.telefone,
    email: cliente.email ?? undefined,
    nascimento: cliente.data_nascimento ?? undefined,
    avatarCor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][index % 5],
});

const horarioParaMinutos = (horario) => {
    const [h, m] = String(horario || '').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const normalizarPeriodoBloqueio = ({ diaInteiro = true, horaInicio, horaFim }) => {
    const inicio = diaInteiro ? null : String(horaInicio || '').slice(0, 5);
    const fim = diaInteiro ? null : String(horaFim || '').slice(0, 5);
    const horarioValido = (valor) => {
        if (!/^\d{2}:\d{2}$/.test(valor)) return false;
        const [hora, minuto] = valor.split(':').map(Number);
        return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59 && minuto % 30 === 0;
    };
    if (!diaInteiro && (!horarioValido(inicio) || !horarioValido(fim))) {
        throw new Error('Informe os horários inicial e final em intervalos de 30 minutos.');
    }
    if (!diaInteiro && horarioParaMinutos(inicio) >= horarioParaMinutos(fim)) {
        throw new Error('O horário final deve ser posterior ao horário inicial.');
    }
    return { inicio, fim };
};

const normalizarRecorrenciaBloqueio = ({ diasSemana = [], dataFim = null }, dataInicio) => {
    const diasNormalizados = [...new Set((Array.isArray(diasSemana) ? diasSemana : []).map(Number))]
        .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6)
        .sort((a, b) => a - b);
    if (!diasNormalizados.length) throw new Error('Escolha pelo menos um dia da semana para o bloqueio recorrente.');

    const fimRecorrencia = dataFim ? dataOnly(dataFim) : null;
    if (dataFim && !fimRecorrencia) throw new Error('Informe uma data final válida para a recorrência.');
    if (fimRecorrencia && fimRecorrencia < dataInicio) {
        throw new Error('A data final da recorrência deve ser igual ou posterior à data inicial.');
    }
    return { diasNormalizados, fimRecorrencia };
};

const duracaoServico = (servicoId, duracoes = {}) => duracoes[servicoId] ?? 30;

export const duracaoEfetivaAgendamento = (agendamento, duracoes = {}) => {
    const duracaoSalva = Number(agendamento?.servico_duracao_min);
    return Number.isFinite(duracaoSalva) && duracaoSalva > 0
        ? duracaoSalva
        : duracaoServico(agendamento?.servico_id, duracoes);
};

const chaveServico = (nome) => String(nome ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

const primeiroNomeNormalizado = (nome) => chaveServico(nome).split(' ')[0] || '';

export const servicoDisponivelNoEscopo = ({ somenteAtivos, unidadeId, configuracao }) =>
    !somenteAtivos || !unidadeId || configuracao?.ativo === true;

export const deveAplicarFiltroLegadoPorColaborador = ({ unidadeId, colaboradorId }) =>
    Boolean(colaboradorId && !unidadeId);

/**
 * Alguns catálogos antigos identificam o profissional no próprio nome do
 * serviço (por exemplo, "Corte com Suzane"). Mantemos esse legado compatível
 * e usamos o colaborador selecionado apenas como filtro de leitura. Assim,
 * não é necessário duplicar serviços nem alterar agendamentos existentes.
 */
const filtrarServicosPorColaborador = (servicos, colaboradores, colaboradorSelecionado) => {
    if (!colaboradorSelecionado) return servicos;

    const tokens = colaboradores
        .map((colaborador) => primeiroNomeNormalizado(colaborador.usuario_nome))
        .filter((token) => token.length >= 4);
    const selecionado = primeiroNomeNormalizado(colaboradorSelecionado.usuario_nome);
    if (!selecionado || !tokens.includes(selecionado)) return servicos;

    const servicosComProfissional = servicos.filter((servico) =>
        chaveServico(servico.nome).includes(selecionado)
    );

    // Sem serviços personalizados para este profissional, preserva o catálogo
    // completo para não esconder serviços de empresas que ainda usam o modelo
    // global.
    if (servicosComProfissional.length === 0) {
        return servicos.filter((servico) => !tokens.some((token) =>
            token !== selecionado && chaveServico(servico.nome).includes(token)
        ));
    }

    // Quando existe um catálogo personalizado para o profissional, ele é a
    // fonte de verdade dos preços exibidos na landing. Isso evita misturar os
    // preços da equipe com os preços especiais da Suzane.
    return servicosComProfissional;
};

const periodoMensal = (data) => {
    const [ano, mes] = String(data).split('-').map(Number);
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    return {
        inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
        fim: `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    };
};

const intervalosSobrepoem = (inicioA, duracaoA, inicioB, duracaoB) =>
    inicioA < inicioB + duracaoB && inicioB < inicioA + duracaoA;

const dataPorExtenso = (data) => {
    const [ano, mes, dia] = String(data).split('-').map(Number);
    if (!ano || !mes || !dia) return String(data);
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
    }).format(new Date(Date.UTC(ano, mes - 1, dia, 12)));
};

// Garante coluna preco_texto na tabela agendamento_servicos
sequelize.query(`ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS preco_texto VARCHAR(200)`).catch(() => {});

const servicoToFront = (servico, override = null, unidadeId = null) => {
    const possuiPrecoOverride = override
        && (override.preco !== null && override.preco !== undefined
            || override.preco_texto !== null && override.preco_texto !== undefined);
    return ({
    id: String(servico.id),
    nome: servico.nome,
    unidadeId: unidadeId ? String(unidadeId) : null,
    ativo: override ? Boolean(override.ativo) : Boolean(servico.ativo),
    duracaoMin: Number(override?.duracao_min ?? servico.duracao_min ?? 30),
    preco: Number(possuiPrecoOverride ? (override.preco ?? 0) : (servico.preco ?? 0)),
    precoTexto: possuiPrecoOverride ? (override.preco_texto ?? null) : (servico.preco_texto ?? null),
    comissaoTipo: servico.comissao_tipo ?? null,
    comissaoValor: Number(servico.comissao_valor ?? 0),
    cor: servico.cor,
    });
};

const normalizarComissaoServico = (data, atual = {}) => {
    const tipoInformado = data.comissaoTipo !== undefined || data.comissao_tipo !== undefined;
    const valorInformado = data.comissaoValor !== undefined || data.comissao_valor !== undefined;
    const tipo = tipoInformado
        ? (data.comissaoTipo ?? data.comissao_tipo ?? null)
        : (atual.comissao_tipo ?? null);
    const valor = valorInformado
        ? Number(data.comissaoValor ?? data.comissao_valor ?? 0)
        : Number(atual.comissao_valor ?? 0);

    if (tipo !== null && tipo !== '' && !['percent', 'valor'].includes(tipo)) {
        throw new Error('Tipo de comissão do serviço inválido');
    }
    if (!Number.isFinite(valor) || valor < 0) {
        throw new Error('O valor da comissão do serviço deve ser válido e positivo');
    }
    if (tipo === 'percent' && valor > 100) {
        throw new Error('A comissão percentual do serviço não pode ultrapassar 100%');
    }
    return {
        comissao_tipo: tipo || null,
        comissao_valor: tipo ? valor : 0,
    };
};

class AgendamentoService {
    async obterBeneficioRecorrencia(agendamento) {
        if (!agendamento.cliente_id || !agendamento.servico_nome || !agendamento.data) return null;
        const recorrencias = await Recorrencia.findAll({
            where: {
                empresa_id: agendamento.empresa_id,
                cliente_id: agendamento.cliente_id,
                ativo: true,
                dataInicio: { [Op.lte]: agendamento.data },
                [Op.or]: [{ dataFim: null }, { dataFim: { [Op.gte]: agendamento.data } }]
            },
            order: [['dataInicio', 'DESC']]
        });
        const servicoId = String(agendamento.servico_id ?? '');
        let recorrenciaEncontrada = null;
        let franquia = null;
        for (const recorrencia of recorrencias) {
            const servicos = Array.isArray(recorrencia.servicosInclusos) ? recorrencia.servicosInclusos : [];
            const item = servicos.find(servico => servicoInclusoCorresponde(
                { id: servicoId, nome: agendamento.servico_nome },
                servico,
            ));
            if (item) {
                recorrenciaEncontrada = recorrencia;
                franquia = item;
                break;
            }
        }
        if (!recorrenciaEncontrada || !franquia) return null;

        const periodo = periodoMensal(agendamento.data);
        const consumos = await Agendamento.findAll({
            where: {
                empresa_id: agendamento.empresa_id,
                cliente_id: agendamento.cliente_id,
                data: { [Op.between]: [periodo.inicio, periodo.fim] },
                status: { [Op.in]: ['confirmado', 'em_atendimento', 'finalizado'] },
                id: { [Op.ne]: agendamento.id }
            },
            attributes: ['servico_id', 'servico_nome'],
            raw: true
        });
        const utilizadosAntes = consumos.filter(item => servicoInclusoCorresponde(
            { id: servicoId, nome: agendamento.servico_nome },
            { servico_id: item.servico_id, servico_nome: item.servico_nome },
        )).length;
        return montarStatusFranquia({
            limite: franquia.quantidade,
            utilizadosAntes,
            servicoNome: franquia.servico_nome,
            recorrenciaId: recorrenciaEncontrada.id
        });
    }

    async calcularBeneficiosParaAgendamentos(agendamentos, empresaId) {
        if (!agendamentos.length) return new Map();
        const clienteIds = [...new Set(agendamentos
            .map(agendamento => Number(agendamento.cliente_id))
            .filter(Number.isInteger))];
        const datas = agendamentos.map(agendamento => dataOnly(agendamento.data)).filter(Boolean).sort();
        if (!clienteIds.length || !datas.length) return new Map();

        const inicio = periodoMensal(datas[0]).inicio;
        const fim = periodoMensal(datas[datas.length - 1]).fim;
        const [recorrencias, consumos] = await Promise.all([
            Recorrencia.findAll({
                where: { empresa_id: empresaId, cliente_id: { [Op.in]: clienteIds }, ativo: true },
                order: [['dataInicio', 'DESC']],
            }),
            Agendamento.findAll({
                where: {
                    empresa_id: empresaId,
                    cliente_id: { [Op.in]: clienteIds },
                    data: { [Op.between]: [inicio, fim] },
                    status: { [Op.in]: ['confirmado', 'em_atendimento', 'finalizado'] },
                },
            }),
        ]);
        const universo = new Map(consumos.map(consumo => [String(consumo.id), consumo]));
        agendamentos.forEach(agendamento => universo.set(String(agendamento.id), agendamento));
        return calcularBeneficiosRecorrencia([...universo.values()], recorrencias);
    }

    async obterBeneficioRecorrenciaAtualizado(agendamento) {
        const beneficios = await this.calcularBeneficiosParaAgendamentos([agendamento], agendamento.empresa_id);
        return beneficios.get(String(agendamento.id)) ?? null;
    }

    empresaObrigatoria(currentUser) {
        const empresaId = empresaParaGravar(currentUser);
        if (!empresaId) throw new Error('Selecione uma empresa para usar a agenda');
        return empresaId;
    }

    async garantirUnidadePadrao(empresaId) {
        let unidade = await AgendamentoUnidade.findOne({
            where: { empresa_id: empresaId, ativa: true },
            order: [['principal', 'DESC'], ['id', 'ASC']],
        });
        if (!unidade) {
            [unidade] = await AgendamentoUnidade.findOrCreate({
                where: { empresa_id: empresaId, nome: 'Unidade principal' },
                defaults: { principal: true, ativa: true },
            });
        }
        await AgendamentoColaborador.update(
            { unidade_id: unidade.id },
            { where: { empresa_id: empresaId, unidade_id: null } }
        );
        await Agendamento.update(
            { unidade_id: unidade.id },
            { where: { empresa_id: empresaId, unidade_id: null } }
        );
        return unidade;
    }

    async validarUnidade(unidadeId, empresaId) {
        const id = Number(unidadeId);
        if (!id) return this.garantirUnidadePadrao(empresaId);
        const unidade = await AgendamentoUnidade.findOne({ where: { id, empresa_id: empresaId, ativa: true } });
        if (!unidade) throw new Error('Unidade não encontrada nesta empresa');
        return unidade;
    }

    async listarUnidades(currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        await this.garantirUnidadePadrao(empresaId);
        const unidades = await AgendamentoUnidade.findAll({
            where: { empresa_id: empresaId, ativa: true },
            order: [['principal', 'DESC'], ['nome', 'ASC']],
        });
        return unidades.map(unidadeToFront);
    }

    async criarUnidade(data, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        if (!data.nome?.trim()) throw new Error('Nome da unidade é obrigatório');
        const repetida = await AgendamentoUnidade.findOne({ where: { empresa_id: empresaId, nome: data.nome.trim(), ativa: true } });
        if (repetida) throw new Error('Já existe uma unidade com este nome');
        const total = await AgendamentoUnidade.count({ where: { empresa_id: empresaId, ativa: true } });
        const unidade = await AgendamentoUnidade.create({
            empresa_id: empresaId,
            nome: data.nome.trim(),
            endereco: data.endereco?.trim() || null,
            telefone: data.telefone?.trim() || null,
            ativa: true,
            principal: total === 0,
        });
        // Novas unidades recebem o catálogo legado normalmente. Serviços que
        // já possuem alguma exceção explícita por unidade começam desativados
        // para evitar publicar acidentalmente um serviço exclusivo em outra
        // unidade; o gestor pode ativá-los no catálogo da nova unidade.
        const servicos = await AgendamentoServico.findAll({ where: { empresa_id: empresaId, ativo: true }, attributes: ['id'] });
        for (const servico of servicos) {
            const configuracoes = await AgendamentoServicoUnidade.findAll({
                where: { empresa_id: empresaId, servico_id: String(servico.id) },
                attributes: ['ativo'],
            });
            await this.salvarConfiguracaoServicoUnidade(empresaId, unidade.id, servico.id, {
                ativo: configuracoes.some(configuracao => !configuracao.ativo) ? false : true,
            });
        }
        return unidadeToFront(unidade);
    }

    async atualizarUnidade(id, data, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const unidade = await AgendamentoUnidade.findOne({ where: { id, empresa_id: empresaId, ativa: true } });
        if (!unidade) throw new Error('Unidade não encontrada');
        if (data.nome !== undefined && !data.nome.trim()) throw new Error('Nome da unidade é obrigatório');
        await unidade.update({
            ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
            ...(data.endereco !== undefined ? { endereco: data.endereco?.trim() || null } : {}),
            ...(data.telefone !== undefined ? { telefone: data.telefone?.trim() || null } : {}),
        });
        return unidadeToFront(unidade);
    }

    async excluirUnidade(id, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const unidades = await AgendamentoUnidade.findAll({ where: { empresa_id: empresaId, ativa: true } });
        const unidade = unidades.find(u => String(u.id) === String(id));
        if (!unidade) throw new Error('Unidade não encontrada');
        if (unidades.length === 1) throw new Error('A unidade principal não pode ser excluída. Toda empresa precisa ter pelo menos uma unidade.');
        const profissionais = await AgendamentoColaborador.count({ where: { empresa_id: empresaId, unidade_id: unidade.id } });
        if (profissionais > 0) throw new Error('Transfira os profissionais desta unidade antes de excluí-la.');
        await unidade.update({ ativa: false, principal: false });
        return true;
    }

    async validarCliente(clienteId, empresaId) {
        if (!clienteId || Number.isNaN(Number(clienteId))) return null;
        const cliente = await Cliente.findOne({ where: { id: Number(clienteId), empresa_id: empresaId } });
        if (!cliente) throw new Error('Cliente não encontrado nesta empresa');
        return Number(clienteId);
    }

    async garantirCliente({ clienteId, clienteNome, clienteTelefone, clienteEmail, clienteNascimento }, empresaId) {
        if (clienteId && !Number.isNaN(Number(clienteId))) {
            const existente = await Cliente.findOne({ where: { id: Number(clienteId), empresa_id: empresaId } });
            if (existente) return existente.id;
        }

        if (!clienteNome?.trim() || !clienteTelefone?.trim()) return null;

        if (clienteTelefone?.trim()) {
            const porTelefone = await Cliente.findOne({ where: { telefone: clienteTelefone.trim(), empresa_id: empresaId } });
            if (porTelefone) return porTelefone.id;
        }

        const novo = await Cliente.create({
            nomeCompleto: clienteNome.trim(),
            telefone: clienteTelefone.trim(),
            email: clienteEmail ?? null,
            data_nascimento: clienteNascimento ?? null,
            empresa_id: empresaId,
        });
        return novo.id;
    }

    async enviarConfirmacaoWhatsapp(agendamento, currentUser, { confirmado = false } = {}) {
        let telefone = agendamento.cliente_telefone?.trim();
        if (!telefone && agendamento.cliente_id) {
            const cliente = await Cliente.findOne({
                where: { id: agendamento.cliente_id, empresa_id: agendamento.empresa_id },
                attributes: ['id', 'telefone'],
            });
            telefone = cliente?.telefone?.trim();
        }
        if (!telefone) return { status: 'sem_telefone', mensagem: 'Cliente sem telefone cadastrado' };

        const conversa = await conversaWhatsappService.iniciarConversa({
            cliente_id: agendamento.cliente_id || undefined,
            telefone,
            nome_contato: agendamento.cliente_nome,
        }, currentUser);
        const texto = montarMensagemAgendamentoWhatsapp(agendamento, {
            confirmado,
            dataFormatada: dataPorExtenso(agendamento.data),
        });

        const mensagem = await mensagemWhatsappService.enviarTexto(conversa.id, texto, currentUser);
        return mensagem.status === 'falha'
            ? { status: 'falha', mensagem: 'A Z-API não confirmou o envio' }
            : { status: 'enviada', mensagem: 'Confirmação enviada pelo WhatsApp' };
    }

    async garantirServicosPadrao(empresaId) {
        const total = await AgendamentoServico.count({ where: { empresa_id: empresaId } });
        if (total > 0) return;
        await AgendamentoServico.bulkCreate(SERVICOS_PADRAO.map(s => ({
            id: s.id,
            empresa_id: empresaId,
            nome: s.nome,
            duracao_min: s.duracaoMin,
            preco: s.preco,
            cor: s.cor,
            ativo: true,
        })), { ignoreDuplicates: true });
    }

    async configuracoesServicosPorUnidade(empresaId, unidadeId) {
        if (!unidadeId) return new Map();
        const configuracoes = await AgendamentoServicoUnidade.findAll({
            where: { empresa_id: empresaId, unidade_id: unidadeId },
        });
        return new Map(configuracoes.map(configuracao => [String(configuracao.servico_id), configuracao]));
    }

    async servicosDaEmpresa(empresaId, { unidadeId = null, somenteAtivos = true } = {}) {
        await this.garantirServicosPadrao(empresaId);
        const servicos = await AgendamentoServico.findAll({
            where: { empresa_id: empresaId, ...(somenteAtivos ? { ativo: true } : {}) },
            order: [['nome', 'ASC']],
        });
        const configuracoes = await this.configuracoesServicosPorUnidade(empresaId, unidadeId);
        return servicos
            .filter(servico => servicoDisponivelNoEscopo({
                somenteAtivos,
                unidadeId,
                configuracao: configuracoes.get(String(servico.id)),
            }))
            .map(servico => ({ servico, configuracao: configuracoes.get(String(servico.id)) ?? null }));
    }

    async obterServicoParaUnidade(empresaId, servicoId, unidadeId, { exigirAtivo = true } = {}) {
        if (!servicoId) return null;
        const servico = await AgendamentoServico.findOne({ where: { id: String(servicoId), empresa_id: empresaId } });
        if (!servico) throw new Error('Serviço não encontrado nesta empresa');
        const configuracao = unidadeId
            ? await AgendamentoServicoUnidade.findOne({ where: { empresa_id: empresaId, unidade_id: unidadeId, servico_id: String(servicoId) } })
            : null;
        if (exigirAtivo && (!servico.ativo || configuracao && !configuracao.ativo)) {
            throw new Error('Este serviço não está disponível na unidade selecionada');
        }
        return { servico, configuracao };
    }

    async resolverServicosParaUnidade(empresaId, servicoIds, unidadeId) {
        const ids = [...new Set((Array.isArray(servicoIds) ? servicoIds : []).map((id) => String(id ?? '').trim()).filter(Boolean))];
        const efetivos = await Promise.all(ids.map((id) => this.obterServicoParaUnidade(empresaId, id, unidadeId)));
        return resumirServicosAgendamento(efetivos.map(({ servico, configuracao }) => ({
            id: servico.id,
            nome: servico.nome,
            preco: configuracao?.preco_texto ? null : Number(configuracao?.preco ?? servico.preco ?? 0),
            precoTexto: configuracao?.preco_texto ?? servico.preco_texto ?? null,
            duracaoMin: Number(configuracao?.duracao_min ?? servico.duracao_min ?? 30),
        })));
    }

    async salvarConfiguracaoServicoUnidade(empresaId, unidadeId, servicoId, data = {}) {
        let configuracao = await AgendamentoServicoUnidade.findOne({ where: { empresa_id: empresaId, unidade_id: unidadeId, servico_id: String(servicoId) } });
        const updateData = {};
        if (data.ativo !== undefined) updateData.ativo = Boolean(data.ativo);
        if (data.duracaoMin !== undefined || data.duracao_min !== undefined) {
            const duracao = Number(data.duracaoMin ?? data.duracao_min);
            if (!Number.isFinite(duracao) || duracao < 1) throw new Error('A duração do serviço deve ser maior que zero');
            updateData.duracao_min = Math.round(duracao);
        }
        if (data.precoTexto !== undefined) {
            updateData.preco_texto = data.precoTexto?.trim() || null;
            updateData.preco = updateData.preco_texto ? 0 : Math.max(0, Number(data.preco ?? 0));
        } else if (data.preco !== undefined) {
            const preco = Number(data.preco);
            if (!Number.isFinite(preco) || preco < 0) throw new Error('O preço do serviço deve ser válido e positivo');
            updateData.preco = preco;
            updateData.preco_texto = null;
        }

        if (!configuracao) {
            configuracao = await AgendamentoServicoUnidade.create({
                empresa_id: empresaId,
                unidade_id: unidadeId,
                servico_id: String(servicoId),
                ativo: updateData.ativo ?? true,
                duracao_min: updateData.duracao_min ?? null,
                preco: updateData.preco ?? null,
                preco_texto: updateData.preco_texto ?? null,
            });
        } else if (Object.keys(updateData).length > 0) {
            await configuracao.update(updateData);
        }
        return configuracao;
    }

    async duracoesPorServico(empresaId, unidadeId = null) {
        const pares = await this.servicosDaEmpresa(empresaId, { unidadeId, somenteAtivos: false });
        return Object.fromEntries(pares.map(({ servico, configuracao }) => [
            servico.id,
            Number(configuracao?.duracao_min ?? servico.duracao_min ?? 30),
        ]));
    }

    async listarServicos(currentUser, options = {}) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const unidadeId = options.unidadeId || options.unidade_id ? Number(options.unidadeId ?? options.unidade_id) : null;
        if (unidadeId) await this.validarUnidade(unidadeId, empresaId);
        const pares = await this.servicosDaEmpresa(empresaId, {
            unidadeId,
            somenteAtivos: options.incluirInativos !== true,
        });
        const servicos = pares.map(({ servico, configuracao }) => ({ servico, configuracao }));

        const colaboradorId = options.colaboradorId ? Number(options.colaboradorId) : null;
        if (!deveAplicarFiltroLegadoPorColaborador({ unidadeId, colaboradorId })) {
            return servicos.map(({ servico, configuracao }) => servicoToFront(servico, configuracao, unidadeId));
        }

        const [colaboradorSelecionado, colaboradores] = await Promise.all([
            AgendamentoColaborador.findOne({ where: { id: colaboradorId, empresa_id: empresaId } }),
            AgendamentoColaborador.findAll({ where: { empresa_id: empresaId }, attributes: ['id', 'usuario_nome'] }),
        ]);
        if (!colaboradorSelecionado) throw new Error('Colaborador não encontrado');

        const filtrados = filtrarServicosPorColaborador(servicos.map(({ servico }) => servico), colaboradores, colaboradorSelecionado);
        return filtrados.map(servico => {
            const configuracao = servicos.find(item => item.servico.id === servico.id)?.configuracao ?? null;
            return servicoToFront(servico, configuracao, unidadeId);
        });
    }

    async criarServico(data, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        if (!data.nome?.trim()) throw new Error('Nome do serviço é obrigatório');
        const unidadeId = data.unidadeId ?? data.unidade_id;
        const unidade = unidadeId ? await this.validarUnidade(unidadeId, empresaId) : null;
        const comissao = normalizarComissaoServico(data);
        const duracao = Math.max(1, Number(data.duracaoMin ?? data.duracao_min ?? 30));
        const precoTexto = data.precoTexto?.trim() || null;
        const servico = await AgendamentoServico.create({
            id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            empresa_id: empresaId,
            nome: data.nome.trim(),
            duracao_min: duracao,
            preco: precoTexto ? 0 : Math.max(0, Number(data.preco ?? 0)),
            preco_texto: precoTexto,
            ...comissao,
            cor: data.cor || '#3b82f6',
            ativo: true,
        });
        const configuracao = unidade
            ? await this.salvarConfiguracaoServicoUnidade(empresaId, unidade.id, servico.id, data)
            : null;
        if (unidade) {
            const demaisUnidades = await AgendamentoUnidade.findAll({
                where: { empresa_id: empresaId, ativa: true, id: { [Op.ne]: unidade.id } },
                attributes: ['id'],
            });
            for (const outraUnidade of demaisUnidades) {
                await this.salvarConfiguracaoServicoUnidade(empresaId, outraUnidade.id, servico.id, { ativo: false });
            }
        }
        return servicoToFront(servico, configuracao, unidade?.id ?? null);
    }

    async atualizarServico(id, data, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const servico = await AgendamentoServico.findOne({ where: { id, empresa_id: empresaId } });
        if (!servico) throw new Error('Serviço não encontrado');
        const unidadeId = data.unidadeId ?? data.unidade_id;
        const unidade = unidadeId ? await this.validarUnidade(unidadeId, empresaId) : null;
        const comissao = normalizarComissaoServico(data, servico);
        const atualizacaoBase = {
            ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
            ...(unidade ? {} : data.duracaoMin !== undefined || data.duracao_min !== undefined ? { duracao_min: Math.max(1, Number(data.duracaoMin ?? data.duracao_min)) } : {}),
            ...(unidade ? {} : data.precoTexto !== undefined ? {
                preco_texto: data.precoTexto?.trim() || null,
                preco: data.precoTexto ? 0 : Math.max(0, Number(data.preco ?? 0)),
            } : data.preco !== undefined ? { preco: Math.max(0, Number(data.preco)), preco_texto: null } : {}),
            ...(data.cor !== undefined ? { cor: data.cor || '#3b82f6' } : {}),
            ...comissao,
        };
        if (Object.keys(atualizacaoBase).length > 0) await servico.update(atualizacaoBase);
        const configuracao = unidade
            ? await this.salvarConfiguracaoServicoUnidade(empresaId, unidade.id, servico.id, data)
            : null;
        return servicoToFront(servico, configuracao, unidade?.id ?? null);
    }

    async excluirServico(id, currentUser, options = {}) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const unidadeId = options.unidadeId || options.unidade_id ? Number(options.unidadeId ?? options.unidade_id) : null;
        if (unidadeId) {
            await this.validarUnidade(unidadeId, empresaId);
            const servico = await AgendamentoServico.findOne({ where: { id, empresa_id: empresaId } });
            if (!servico) throw new Error('Serviço não encontrado');
            await this.salvarConfiguracaoServicoUnidade(empresaId, unidadeId, id, { ativo: false });
            return true;
        }
        const servico = await AgendamentoServico.findOne({ where: { id, empresa_id: empresaId } });
        if (!servico) throw new Error('Serviço não encontrado');
        const emUso = await Agendamento.count({ where: { empresa_id: empresaId, servico_id: id } });
        if (emUso > 0) await servico.update({ ativo: false });
        else await servico.destroy();
        return true;
    }

    async validarDisponibilidade({ empresaId, unidadeId = null, colaboradorId, data, horario, servicoId, duracaoMin = null, ignorarId = null, status = 'aguardando', exigirGrade = false, permitirConflito = false }) {
        if (status === 'cancelado') return;

        const duracoes = await this.duracoesPorServico(empresaId, unidadeId);
        const inicioNovo = horarioParaMinutos(horario);
        const duracaoInformada = Number(duracaoMin);
        const duracaoNova = Number.isFinite(duracaoInformada) && duracaoInformada > 0
            ? duracaoInformada
            : duracaoServico(servicoId, duracoes);

        if (exigirGrade) {
            const configuracao = await obterConfiguracaoAgendamento(empresaId);
            if (!horarioPertenceConfiguracao(horario, duracaoNova, configuracao)) {
                throw new Error(`Escolha um horário disponível entre ${configuracao.horaInicio} e ${configuracao.horaFim}, em intervalos de ${configuracao.intervaloMin} minutos.`);
            }
        }

        const bloqueios = await this.buscarBloqueiosEfetivos(empresaId, { data, colaboradorId });
        for (const bloqueio of bloqueios) {
            const diaInteiro = !bloqueio.hora_inicio || !bloqueio.hora_fim;
            const inicioBloqueio = horarioParaMinutos(bloqueio.hora_inicio);
            const fimBloqueio = horarioParaMinutos(bloqueio.hora_fim);
            const sobrepoeBloqueio = diaInteiro || (inicioNovo < fimBloqueio && inicioBloqueio < inicioNovo + duracaoNova);
            if (sobrepoeBloqueio) {
                const periodo = diaInteiro
                    ? 'o dia bloqueado'
                    : `o período bloqueado das ${String(bloqueio.hora_inicio).slice(0, 5)} às ${String(bloqueio.hora_fim).slice(0, 5)}`;
                throw new Error(`Este colaborador está com ${periodo}. Escolha outro horário ou colaborador.`);
            }
        }

        const where = {
            empresa_id: empresaId,
            colaborador_id: colaboradorId,
            data,
            status: { [Op.ne]: 'cancelado' },
        };
        if (ignorarId) where.id = { [Op.ne]: ignorarId };

        const existentes = await Agendamento.findAll({ where });
        const conflito = existentes.find((ag) => intervalosSobrepoem(
            inicioNovo,
            duracaoNova,
            horarioParaMinutos(ag.horario),
            duracaoEfetivaAgendamento(ag, duracoes)
        ));

        if (conflito && !permitirConflito) {
            const fimConflito = horarioParaMinutos(conflito.horario) + duracaoEfetivaAgendamento(conflito, duracoes);
            const fimHora = `${String(Math.floor(fimConflito / 60)).padStart(2, '0')}:${String(fimConflito % 60).padStart(2, '0')}`;
            throw new Error(`A duração desse serviço não cabe nesse horário. Já existe um agendamento das ${conflito.horario} às ${fimHora}. Escolha um horário livre após esse intervalo.`);
        }
    }

    async listarColaboradores(currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        await this.garantirUnidadePadrao(empresaId);
        const lista = await sequelize.query(
            `SELECT ac.*, u.avatar_url, u.avatar_position
             FROM agendamento_colaboradores ac
             LEFT JOIN users u ON u.id = ac.usuario_id
             WHERE ac.empresa_id = :empresaId
             ORDER BY ac.ordem ASC, ac.id ASC`,
            { replacements: { empresaId }, type: sequelize.QueryTypes.SELECT }
        );
        return lista.map(colaboradorToFront);
    }

    async obterConfiguracao(currentUser) {
        return obterConfiguracaoAgendamento(this.empresaObrigatoria(currentUser));
    }

    async salvarConfiguracao(data, currentUser) {
        const podeConfigurar = currentUser?.tipo === 'MASTER'
            || currentUser?.tipo === 'EMPRESA'
            || (Array.isArray(currentUser?.permissoes) && currentUser.permissoes.includes('agendamento:todos'));
        if (!podeConfigurar) throw new Error('Você não tem permissão para alterar os horários da agenda.');
        return salvarConfiguracaoAgendamento(this.empresaObrigatoria(currentUser), data);
    }

    async criarColaborador(data, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const nome = data.usuarioNome || data.nome || data.nomeCompleto;
        if (!nome?.trim()) throw new Error('Nome do colaborador é obrigatório');

        const unidade = await this.validarUnidade(data.unidadeId ?? data.unidade_id, empresaId);
        const colaborador = await AgendamentoColaborador.create({
            empresa_id: empresaId,
            unidade_id: unidade.id,
            usuario_id: data.usuarioId ?? data.usuario_id ?? null,
            usuario_nome: nome.trim(),
            cor: data.cor || '#3b82f6',
            ordem: Number.isInteger(data.ordem) ? data.ordem : 0,
        });

        return colaboradorToFront(colaborador);
    }

    async atualizarColaborador(id, data, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const colaborador = await AgendamentoColaborador.findOne({ where: { id, empresa_id: empresaId } });
        if (!colaborador) throw new Error('Colaborador não encontrado');
        const updateData = {};
        if (data.unidadeId !== undefined || data.unidade_id !== undefined) {
            const unidade = await this.validarUnidade(data.unidadeId ?? data.unidade_id, empresaId);
            updateData.unidade_id = unidade.id;
        }
        const nome = data.usuarioNome ?? data.usuario_nome;
        if (nome !== undefined) {
            if (!nome.trim()) throw new Error('Nome do colaborador é obrigatório');
            updateData.usuario_nome = nome.trim();
        }
        if (Object.prototype.hasOwnProperty.call(data, 'usuarioId') || Object.prototype.hasOwnProperty.call(data, 'usuario_id')) {
            const valorInformado = data.usuarioId ?? data.usuario_id;
            const usuarioId = valorInformado === null || valorInformado === '' ? null : Number(valorInformado);
            if (usuarioId !== null && (!Number.isInteger(usuarioId) || usuarioId <= 0)) {
                throw new Error('Usuário inválido para o profissional');
            }
            if (usuarioId !== null) {
                const usuario = await User.findOne({
                    where: {
                        id: usuarioId,
                        empresa_id: empresaId,
                        tipo: { [Op.ne]: 'MASTER' },
                    },
                    attributes: ['id'],
                });
                if (!usuario) throw new Error('Usuário não encontrado nesta empresa');

                const vinculoExistente = await AgendamentoColaborador.findOne({
                    where: {
                        empresa_id: empresaId,
                        usuario_id: usuarioId,
                        id: { [Op.ne]: colaborador.id },
                    },
                    attributes: ['id'],
                });
                if (vinculoExistente) throw new Error('Este usuário já está vinculado a outro profissional');
            }
            updateData.usuario_id = usuarioId;
        }
        if (data.cor !== undefined) updateData.cor = data.cor || '#3b82f6';
        await colaborador.update(updateData);
        return colaboradorToFront(colaborador);
    }

    async excluirColaborador(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const colaborador = await AgendamentoColaborador.findOne({ where });
        if (!colaborador) throw new Error('Colaborador não encontrado');

        await Agendamento.destroy({ where: { colaborador_id: colaborador.id, empresa_id: colaborador.empresa_id } });
        await colaborador.destroy();
        return true;
    }

    async listarAgendamentos(filters = {}, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        await this.garantirUnidadePadrao(empresaId);
        const where = { empresa_id: empresaId };

        if (filters.inicio && filters.fim) {
            where.data = { [Op.between]: [dataOnly(filters.inicio), dataOnly(filters.fim)] };
        }
        if (filters.colaboradorId) where.colaborador_id = Number(filters.colaboradorId);
        if (filters.status) where.status = filters.status;
        if (filters.unidadeId) where.unidade_id = Number(filters.unidadeId);

        // Restringe ao próprio colaborador se não tiver permissão para ver todos
        const isGestor = currentUser?.tipo === 'MASTER'
            || currentUser?.tipo === 'EMPRESA'
            || (Array.isArray(currentUser?.permissoes) && currentUser.permissoes.includes('agendamento:todos'));

        if (!isGestor && currentUser?.id && !filters.colaboradorId) {
            const meusColabs = await AgendamentoColaborador.findAll({
                where: { empresa_id: empresaId, usuario_id: currentUser.id },
                attributes: ['id'],
            }).catch(() => []);
            where.colaborador_id = meusColabs.length > 0
                ? { [Op.in]: meusColabs.map(c => c.id) }
                : -1; // nenhum colaborador vinculado → retorna vazio
        }

        const lista = await Agendamento.findAll({
            where,
            order: [['data', 'ASC'], ['horario', 'ASC'], ['id', 'ASC']],
        });
        const beneficios = await this.calcularBeneficiosParaAgendamentos(lista, empresaId);
        return lista.map(agendamento => ({
            ...agendamentoToFront(agendamento),
            beneficioRecorrencia: beneficios.get(String(agendamento.id)) ?? null,
        }));
    }

    async criarAgendamento(data, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        if (data.forcarEncaixe === true && !usuarioPodeForcarEncaixe(currentUser)) {
            throw new Error('Sem permissão para forçar encaixe na agenda');
        }
        const colaboradorId = Number(data.colaboradorId ?? data.colaborador_id);
        if (!colaboradorId) throw new Error('Colaborador é obrigatório');

        const colaborador = await AgendamentoColaborador.findOne({ where: { id: colaboradorId, empresa_id: empresaId } });
        if (!colaborador) throw new Error('Colaborador não encontrado');
        const unidade = await this.validarUnidade(data.unidadeId ?? colaborador.unidade_id, empresaId);
        if (colaborador.unidade_id && Number(colaborador.unidade_id) !== Number(unidade.id)) {
            throw new Error('Este profissional não atende na unidade selecionada');
        }

        const dataAgenda = dataOnly(data.data);
        if (!dataAgenda) throw new Error('Data inválida');
        if (!data.horario) throw new Error('Horário é obrigatório');
        if (!data.clienteNome?.trim()) throw new Error('Cliente é obrigatório');
        const clienteId = await this.garantirCliente({
            clienteId: data.clienteId,
            clienteNome: data.clienteNome,
            clienteTelefone: data.clienteTelefone,
            clienteEmail: data.clienteEmail,
            clienteNascimento: data.clienteNascimento,
        }, empresaId);
        const status = STATUS_VALIDOS.has(data.status) ? data.status : 'aguardando';
        const servicoIds = extrairIdsServicosAgendamento(data);
        const resumoServicos = servicoIds.length
            ? await this.resolverServicosParaUnidade(empresaId, servicoIds, unidade.id)
            : resumirServicosAgendamento(data.servicoNome ? [{
                id: data.servicoId,
                nome: data.servicoNome,
                preco: data.servicoPreco,
                precoTexto: data.servicoPrecoTexto,
                duracaoMin: data.servicoDuracaoMin,
            }] : []);

        await this.validarDisponibilidade({
            empresaId,
            unidadeId: unidade.id,
            colaboradorId,
            data: dataAgenda,
            horario: data.horario,
            servicoId: resumoServicos.servicoId,
            duracaoMin: resumoServicos.servicoDuracaoMin,
            status,
            exigirGrade: true,
            permitirConflito: data.forcarEncaixe === true,
        });

        const historico = Array.isArray(data.historico)
            ? [...data.historico]
            : [{ data: new Date().toISOString(), acao: 'Agendamento criado' }];
        if (data.forcarEncaixe === true) {
            historico.push({
                data: new Date().toISOString(),
                acao: `Encaixe forçado por ${currentUser?.nomeCompleto || currentUser?.email || `usuário #${currentUser?.id ?? '?'}`}`,
            });
        }

        const agendamento = await Agendamento.create({
            empresa_id: empresaId,
            unidade_id: unidade.id,
            cliente_id: clienteId,
            colaborador_id: colaboradorId,
            servico_id: resumoServicos.servicoId,
            servico_nome: resumoServicos.servicoNome,
            servico_preco: resumoServicos.servicoPreco,
            servico_preco_texto: resumoServicos.servicoPrecoTexto,
            servico_duracao_min: resumoServicos.servicoDuracaoMin,
            servicos: resumoServicos.servicos,
            data: dataAgenda,
            horario: data.horario,
            observacao: data.observacao ?? '',
            status,
            criado_em: data.criadoEm ? new Date(data.criadoEm) : new Date(),
            forma_pagamento: data.formaPagamento ?? null,
            cliente_nome: data.clienteNome.trim(),
            cliente_telefone: data.clienteTelefone ?? null,
            cliente_email: data.clienteEmail ?? null,
            cliente_nascimento: data.clienteNascimento ?? null,
            historico,
            encaixe_forcado: data.forcarEncaixe === true,
        });

        const empresa = await Empresa.findByPk(empresaId, { attributes: ['nome'] });
        const notificacaoObrigatoria = ehDomFerrazSape(empresa?.nome);
        let notificacaoWhatsapp = { status: 'nao_solicitada', mensagem: 'Envio automático desativado para esta origem' };
        if (deveNotificarAgendamentoWhatsapp(empresa?.nome, data.notificarWhatsapp)) {
            try {
                notificacaoWhatsapp = await this.enviarConfirmacaoWhatsapp(agendamento, currentUser, {
                    confirmado: notificacaoObrigatoria,
                });
            } catch (error) {
                notificacaoWhatsapp = { status: 'falha', mensagem: error?.message || 'Falha ao enviar confirmação' };
            }

            const historico = Array.isArray(agendamento.historico) ? [...agendamento.historico] : [];
            historico.push({
                data: new Date().toISOString(),
                acao: notificacaoWhatsapp.status === 'enviada'
                    ? 'Confirmação enviada automaticamente pelo WhatsApp'
                    : `Confirmação do WhatsApp não enviada: ${notificacaoWhatsapp.mensagem}`,
            });
            await agendamento.update({ historico });
        }

        const beneficioRecorrencia = status === 'confirmado'
            ? await this.obterBeneficioRecorrenciaAtualizado(agendamento)
            : null;
        return { ...agendamentoToFront(agendamento), notificacaoWhatsapp, beneficioRecorrencia };
    }

    async atualizarAgendamento(id, data, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const agendamento = await Agendamento.findOne({ where });
        if (!agendamento) throw new Error('Agendamento não encontrado');
        const empresaId = agendamento.empresa_id;

        const updateData = {};
        if (data.colaboradorId || data.colaborador_id) {
            const colaboradorId = Number(data.colaboradorId ?? data.colaborador_id);
            const colWhere = { id: colaboradorId };
            aplicarEmpresaScope(colWhere, currentUser);
            const colaborador = await AgendamentoColaborador.findOne({ where: colWhere });
            if (!colaborador) throw new Error('Colaborador não encontrado');
            updateData.colaborador_id = colaboradorId;
            if (Number(colaboradorId) !== Number(agendamento.colaborador_id)) {
                updateData.unidade_id = colaborador.unidade_id ?? (await this.garantirUnidadePadrao(empresaId)).id;
            }
        }
        if (data.unidadeId !== undefined || data.unidade_id !== undefined) {
            const unidade = await this.validarUnidade(data.unidadeId ?? data.unidade_id, empresaId);
            const colaboradorId = updateData.colaborador_id ?? agendamento.colaborador_id;
            const colaborador = await AgendamentoColaborador.findOne({ where: { id: colaboradorId, empresa_id: empresaId } });
            const preservandoVinculoExistente = Number(colaboradorId) === Number(agendamento.colaborador_id)
                && Number(unidade.id) === Number(agendamento.unidade_id);
            if (colaborador?.unidade_id && Number(colaborador.unidade_id) !== Number(unidade.id) && !preservandoVinculoExistente) {
                throw new Error('Este profissional não atende na unidade selecionada');
            }
            updateData.unidade_id = unidade.id;
        }
        if (data.clienteId !== undefined) updateData.cliente_id = await this.validarCliente(data.clienteId, empresaId);
        if (data.data !== undefined) {
            const d = dataOnly(data.data);
            if (!d) throw new Error('Data inválida');
            updateData.data = d;
        }
        if (data.horario !== undefined) updateData.horario = data.horario;
        if (data.observacao !== undefined) updateData.observacao = data.observacao;
        if (data.status !== undefined) {
            if (!STATUS_VALIDOS.has(data.status)) throw new Error('Status inválido');
            updateData.status = data.status;
        }
        if (data.formaPagamento !== undefined) updateData.forma_pagamento = data.formaPagamento || null;
        if (data.clienteNome !== undefined) updateData.cliente_nome = data.clienteNome;
        if (data.clienteTelefone !== undefined) updateData.cliente_telefone = data.clienteTelefone || null;
        if (data.clienteEmail !== undefined) updateData.cliente_email = data.clienteEmail || null;
        if (data.clienteNascimento !== undefined) updateData.cliente_nascimento = data.clienteNascimento || null;
        if (Array.isArray(data.historico)) updateData.historico = [...data.historico];
        if (data.forcarEncaixe !== undefined) updateData.encaixe_forcado = data.forcarEncaixe === true;

        const unidadeDestinoId = updateData.unidade_id ?? agendamento.unidade_id;
        const idsAtuais = servicosDoAgendamento(agendamento).map((servico) => servico.id).filter(Boolean);
        const informouServicos = data.servicoIds !== undefined
            || data.servicos !== undefined
            || data.servicoId !== undefined
            || data.servicoNome !== undefined;
        const unidadeFoiAlterada = Object.prototype.hasOwnProperty.call(updateData, 'unidade_id')
            && Number(updateData.unidade_id) !== Number(agendamento.unidade_id);
        let resumoServicos = null;
        if (informouServicos || unidadeFoiAlterada) {
            const idsDestino = informouServicos ? extrairIdsServicosAgendamento(data) : idsAtuais;
            resumoServicos = idsDestino.length
                ? await this.resolverServicosParaUnidade(empresaId, idsDestino, unidadeDestinoId)
                : resumirServicosAgendamento(data.servicoNome ? [{
                    id: data.servicoId,
                    nome: data.servicoNome,
                    preco: data.servicoPreco,
                    precoTexto: data.servicoPrecoTexto,
                    duracaoMin: data.servicoDuracaoMin,
                }] : []);
            Object.assign(updateData, {
                servico_id: resumoServicos.servicoId,
                servico_nome: resumoServicos.servicoNome,
                servico_preco: resumoServicos.servicoPreco,
                servico_preco_texto: resumoServicos.servicoPrecoTexto,
                servico_duracao_min: resumoServicos.servicoDuracaoMin,
                servicos: resumoServicos.servicos,
            });
        }

        const proximo = {
            empresaId,
            unidadeId: updateData.unidade_id ?? agendamento.unidade_id,
            colaboradorId: updateData.colaborador_id ?? agendamento.colaborador_id,
            data: updateData.data ?? agendamento.data,
            horario: updateData.horario ?? agendamento.horario,
            servicoId: updateData.servico_id ?? agendamento.servico_id,
            status: updateData.status ?? agendamento.status,
        };
        const alterouHorario = data.horario !== undefined && String(data.horario).slice(0, 5) !== String(agendamento.horario).slice(0, 5);
        const alterouData = data.data !== undefined && updateData.data !== agendamento.data;
        const alterouColaborador = Object.prototype.hasOwnProperty.call(updateData, 'colaborador_id')
            && Number(updateData.colaborador_id) !== Number(agendamento.colaborador_id);
        const alterouUnidade = unidadeFoiAlterada;
        const idsDestino = resumoServicos?.servicos.map((servico) => servico.id).filter(Boolean) ?? idsAtuais;
        const alterouServico = informouServicos
            && (idsDestino.length !== idsAtuais.length || idsDestino.some((id, indice) => id !== idsAtuais[indice]));

        const alterouAgenda = alterouHorario || alterouData || alterouColaborador || alterouUnidade || alterouServico;
        const podeForcarEncaixe = usuarioPodeForcarEncaixe(currentUser);
        const mantendoEncaixeExistente = Boolean(agendamento.encaixe_forcado) && !alterouAgenda;
        const solicitouNovoEncaixe = data.forcarEncaixe === true
            && !mantendoEncaixeExistente
            && podeForcarEncaixe;
        if (data.forcarEncaixe === true && !podeForcarEncaixe && !mantendoEncaixeExistente) {
            // Um usuário restrito pode mover um encaixe antigo para um horário livre,
            // mas não pode carregar a autorização de conflito para o novo horário.
            updateData.encaixe_forcado = false;
        }
        if (solicitouNovoEncaixe) {
            const historico = Array.isArray(updateData.historico)
                ? updateData.historico
                : Array.isArray(agendamento.historico) ? [...agendamento.historico] : [];
            historico.push({
                data: new Date().toISOString(),
                acao: `Encaixe forçado por ${currentUser?.nomeCompleto || currentUser?.email || `usuário #${currentUser?.id ?? '?'}`}`,
            });
            updateData.historico = historico;
        }

        const duracaoPreservada = resumoServicos?.servicoDuracaoMin ?? agendamento.servico_duracao_min;

        const deveRevalidar = deveRevalidarDisponibilidadeNaAtualizacao({
            alterouAgenda,
            statusAtual: agendamento.status,
            statusDestino: proximo.status,
        });
        if (deveRevalidar) {
            await this.validarDisponibilidade({
                ...proximo,
                duracaoMin: duracaoPreservada,
                ignorarId: agendamento.id,
                exigirGrade: alterouAgenda,
                permitirConflito: (data.forcarEncaixe === true && (podeForcarEncaixe || mantendoEncaixeExistente))
                    || (data.forcarEncaixe === undefined && mantendoEncaixeExistente),
            });
        }

        await agendamento.update(updateData);
        if (data.status !== undefined) {
            await comissaoAssinaturaService.sincronizarAtendimento(agendamento.id, currentUser);
        }
        const beneficioRecorrencia = updateData.status === 'confirmado'
            ? await this.obterBeneficioRecorrenciaAtualizado(agendamento)
            : null;
        return { ...agendamentoToFront(agendamento), beneficioRecorrencia };
    }

    async excluirAgendamento(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const agendamento = await Agendamento.findOne({ where });
        if (!agendamento) throw new Error('Agendamento não encontrado');
        await agendamento.destroy();
        return true;
    }

    async listarClientes(currentUser) {
        const where = { empresa_id: this.empresaObrigatoria(currentUser) };
        const clientes = await Cliente.findAll({ where, order: [['nomeCompleto', 'ASC']] });
        return clientes.map(clienteToFront);
    }

    async buscarBloqueiosEfetivos(empresaId, filters = {}) {
        const where = { empresa_id: empresaId };
        if (filters.data) where.data = filters.data;
        if (filters.colaboradorId) where.colaborador_id = Number(filters.colaboradorId);
        const avulsos = await AgendamentoBloqueio.findAll({ where });

        if (!filters.data) return avulsos;

        const whereRecorrente = {
            empresa_id: empresaId,
            ativo: true,
            data_inicio: { [Op.lte]: filters.data },
            [Op.or]: [
                { data_fim: null },
                { data_fim: { [Op.gte]: filters.data } },
            ],
        };
        if (filters.colaboradorId) whereRecorrente.colaborador_id = Number(filters.colaboradorId);

        const recorrentes = await AgendamentoBloqueioRecorrente.findAll({ where: whereRecorrente });
        const recorrentesAplicaveis = recorrentes.filter((regra) => regraRecorrenteAplicaNaData(regra, filters.data));
        if (!recorrentesAplicaveis.length) return avulsos;

        const excecoes = await AgendamentoBloqueioRecorrenteExcecao.findAll({
            where: {
                empresa_id: empresaId,
                data: filters.data,
                recorrente_id: { [Op.in]: recorrentesAplicaveis.map((regra) => regra.id) },
            },
            attributes: ['recorrente_id'],
        });
        return [
            ...avulsos,
            ...filtrarRecorrenciasComExcecao(recorrentesAplicaveis, excecoes),
        ];
    }

    async listarBloqueios(filters = {}, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const lista = await this.buscarBloqueiosEfetivos(empresaId, filters);
        return lista.map((bloqueio) => bloqueioToFront(bloqueio, filters.data ?? bloqueio.data));
    }

    async bloquearDia({ colaboradorId, data, diaInteiro = true, horaInicio, horaFim, motivo, recorrente = false, diasSemana = [], dataFim = null }, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const colaborador = await AgendamentoColaborador.findOne({ where: { id: Number(colaboradorId), empresa_id: empresaId } });
        if (!colaborador) throw new Error('Colaborador não encontrado');

        const dataInicio = dataOnly(data);
        if (!dataInicio) throw new Error('Informe uma data inicial válida.');

        const { inicio, fim } = normalizarPeriodoBloqueio({ diaInteiro, horaInicio, horaFim });

        if (recorrente) {
            const { diasNormalizados, fimRecorrencia } = normalizarRecorrenciaBloqueio({ diasSemana, dataFim }, dataInicio);

            const bloqueio = await AgendamentoBloqueioRecorrente.create({
                empresa_id: empresaId,
                colaborador_id: Number(colaboradorId),
                data_inicio: dataInicio,
                data_fim: fimRecorrencia,
                dias_semana: diasNormalizados,
                hora_inicio: inicio,
                hora_fim: fim,
                motivo: motivo?.trim() || null,
            });
            return bloqueioToFront(bloqueio, dataInicio);
        }

        const bloqueio = await AgendamentoBloqueio.create({
            empresa_id: empresaId,
            colaborador_id: Number(colaboradorId),
            data: dataInicio,
            hora_inicio: inicio,
            hora_fim: fim,
            motivo: motivo?.trim() || null,
        });
        return bloqueioToFront(bloqueio);
    }

    async atualizarBloqueio({ colaboradorId, data, bloqueioId, recorrenteId, diaInteiro = true, horaInicio, horaFim, motivo, diasSemana = [], dataFim = null }, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const escopo = { empresa_id: empresaId, colaborador_id: Number(colaboradorId) };
        const { inicio, fim } = normalizarPeriodoBloqueio({ diaInteiro, horaInicio, horaFim });

        if (recorrenteId) {
            const bloqueio = await AgendamentoBloqueioRecorrente.findOne({ where: { ...escopo, id: Number(recorrenteId) } });
            if (!bloqueio) throw new Error('Bloqueio recorrente não encontrado.');
            const dataInicio = dataOnly(data) ?? bloqueio.data_inicio;
            const { diasNormalizados, fimRecorrencia } = normalizarRecorrenciaBloqueio({ diasSemana, dataFim }, dataInicio);
            await bloqueio.update({
                dias_semana: diasNormalizados,
                data_fim: fimRecorrencia,
                hora_inicio: inicio,
                hora_fim: fim,
                motivo: motivo?.trim() || null,
            });
            return bloqueioToFront(bloqueio, dataInicio);
        }

        const bloqueio = await AgendamentoBloqueio.findOne({ where: { ...escopo, id: Number(bloqueioId) } });
        if (!bloqueio) throw new Error('Bloqueio não encontrado.');
        await bloqueio.update({ hora_inicio: inicio, hora_fim: fim, motivo: motivo?.trim() || null });
        return bloqueioToFront(bloqueio);
    }

    async desbloquearDia({ colaboradorId, data, bloqueioId, recorrenteId, somenteOcorrencia = false }, currentUser) {
        const empresaId = this.empresaObrigatoria(currentUser);
        const escopo = { empresa_id: empresaId, colaborador_id: Number(colaboradorId) };
        if (recorrenteId) {
            if (somenteOcorrencia) {
                const dataExcecao = dataOnly(data);
                if (!dataExcecao) throw new Error('Informe a data da ocorrência que será removida.');
                const recorrencia = await AgendamentoBloqueioRecorrente.findOne({ where: { ...escopo, id: Number(recorrenteId), ativo: true } });
                if (!recorrencia || !regraRecorrenteAplicaNaData(recorrencia, dataExcecao)) {
                    throw new Error('Ocorrência recorrente não encontrada nesta data.');
                }
                await AgendamentoBloqueioRecorrenteExcecao.findOrCreate({
                    where: { recorrente_id: Number(recorrenteId), data: dataExcecao },
                    defaults: { ...escopo },
                });
                return true;
            }
            await AgendamentoBloqueioRecorrente.destroy({ where: { ...escopo, id: Number(recorrenteId) } });
            return true;
        }
        if (bloqueioId) {
            await AgendamentoBloqueio.destroy({ where: { ...escopo, id: Number(bloqueioId) } });
            return true;
        }
        await AgendamentoBloqueio.destroy({ where: { ...escopo, data } });
        return true;
    }
}

export default new AgendamentoService();
