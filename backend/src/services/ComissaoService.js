import { Op } from 'sequelize';
import Comissao from '../models/Comissao.js';
import Venda from '../models/Venda.js';
import User from '../models/UserModel.js';
import ComissaoServico from '../models/ComissaoServico.js';
import Service from '../models/Service.js';
import AgendamentoServico from '../models/AgendamentoServico.js';
import VendaItem from '../models/VendaItem.js';
import Product from '../models/Product.js';
import Cliente from '../models/Cliente.js';
import sequelize from '../config/database.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';
import { normalizarNomeServico } from '../utils/calcularComissaoVenda.js';
import {
    aplicarEscopoComissoes,
    exigirGestaoComissoes,
    podeVerTodasComissoes
} from '../utils/comissaoAccess.js';
import { calcularComissoesVenda } from './ComissaoCalculo.js';

class ComissaoService {
    exigirEmpresa(currentUser) {
        const empresaId = empresaParaGravar(currentUser);
        if (!empresaId) {
            const error = new Error('Não foi possível identificar a empresa para consultar as comissões por serviço');
            error.status = 400;
            throw error;
        }
        return empresaId;
    }

    exigirMaster(currentUser) {
        if (currentUser?.tipo !== 'MASTER') {
            const error = new Error('Apenas o Master pode configurar comissões por serviço');
            error.status = 403;
            throw error;
        }
        const empresaId = empresaParaGravar(currentUser);
        if (!empresaId) {
            const error = new Error('Selecione uma empresa para configurar comissões por serviço');
            error.status = 400;
            throw error;
        }
        return empresaId;
    }

    async getAll(filters = {}, currentUser) {
        const where = {};
        if (filters.funcionario_id) where.funcionario_id = filters.funcionario_id;
        if (filters.status) where.status = filters.status;
        if (filters.dataInicio || filters.dataFim) {
            where.createdAt = {};
            if (filters.dataInicio) where.createdAt[Op.gte] = new Date(filters.dataInicio);
            if (filters.dataFim) where.createdAt[Op.lte] = new Date(filters.dataFim);
        }
        aplicarEmpresaScope(where, currentUser);
        aplicarEscopoComissoes(where, currentUser);

        return await Comissao.findAll({
            where,
            include: [
                { model: User, as: 'funcionario', attributes: ['id', 'nomeCompleto', 'email'] },
                { model: Venda, as: 'venda', attributes: ['id', 'valor_total', 'data'] }
            ],
            order: [['createdAt', 'DESC']]
        });
    }

    // Resumo agrupado por funcionário
    async getResumo(currentUser) {
        const where = {};
        aplicarEmpresaScope(where, currentUser);
        aplicarEscopoComissoes(where, currentUser);

        const lista = await Comissao.findAll({
            where,
            include: [{ model: User, as: 'funcionario', attributes: ['id', 'nomeCompleto'] }]
        });

        // Agrupa em memória por funcionário
        const map = new Map();
        for (const c of lista) {
            const fid = c.funcionario_id;
            if (!map.has(fid)) {
                map.set(fid, {
                    funcionario_id: fid,
                    funcionario_nome: c.funcionario?.nomeCompleto ?? 'Desconhecido',
                    total_a_receber: 0,
                    total_pago: 0,
                    total_geral: 0,
                    qtd_vendas: 0,
                    venda_ids: new Set()
                });
            }
            const item = map.get(fid);
            const valor = Number(c.valor);
            item.total_geral += valor;
            item.venda_ids.add(c.venda_id);
            if (c.status === 'pago') item.total_pago += valor;
            else item.total_a_receber += valor;
        }

        return Array.from(map.values()).map(({ venda_ids, ...item }) => ({
            ...item,
            qtd_vendas: venda_ids.size
        }));
    }

    // Auditoria somente leitura. Serviços ligados à agenda ficam fora desta
    // conferência porque possuem comissão própria por profissional/serviço.
    async getInconsistencias(filters = {}, currentUser) {
        const where = {};
        if (filters.funcionario_id) where.funcionario_id = filters.funcionario_id;
        if (filters.dataInicio || filters.dataFim) {
            where.data = {};
            if (filters.dataInicio) where.data[Op.gte] = new Date(filters.dataInicio);
            if (filters.dataFim) where.data[Op.lte] = new Date(filters.dataFim);
        }
        aplicarEmpresaScope(where, currentUser);
        aplicarEscopoComissoes(where, currentUser);

        const vendas = await Venda.findAll({
            where,
            include: [
                { model: VendaItem, as: 'itens' },
                { model: User, as: 'funcionario', attributes: ['id', 'nomeCompleto', 'comissao_tipo', 'comissao_valor'] },
                { model: Cliente, as: 'cliente', attributes: ['id', 'nomeCompleto'] },
                { model: Comissao, as: 'comissoes', attributes: ['id', 'origem', 'status', 'valor', 'base_calculo'] }
            ],
            order: [['data', 'DESC']]
        });

        const inconsistencias = [];
        for (const venda of vendas) {
            const funcionario = venda.funcionario;
            if (!funcionario?.comissao_tipo || Number(funcionario.comissao_valor) <= 0) continue;
            const itensDiretos = (venda.itens ?? []).filter(item => !item.agendamento_id);
            const totalServicosAgenda = (venda.itens ?? [])
                .filter(item => item.agendamento_id)
                .reduce((total, item) => total + Number(item.valor_total || 0), 0);
            const calculos = calcularComissoesVenda({
                itens: itensDiretos,
                desconto: venda.desconto,
                totalVenda: Math.max(0, Number(venda.valor_total || 0) - totalServicosAgenda),
                tipo: funcionario.comissao_tipo,
                valor: funcionario.comissao_valor
            });
            const existentes = new Set((venda.comissoes ?? []).map(comissao => comissao.origem));
            for (const calculo of calculos) {
                if (existentes.has(calculo.origem)) continue;
                inconsistencias.push({
                    venda_id: venda.id,
                    data: venda.data,
                    funcionario_id: funcionario.id,
                    funcionario_nome: funcionario.nomeCompleto,
                    cliente: venda.cliente?.nomeCompleto ?? null,
                    origem: calculo.origem,
                    base_calculo: calculo.base_calculo,
                    percentual_ou_valor: Number(funcionario.comissao_valor),
                    tipo: funcionario.comissao_tipo,
                    comissao_prevista: calculo.valor,
                    observacao: 'Prévia somente leitura; nenhuma comissão foi criada.'
                });
            }
        }
        return inconsistencias;
    }

    async getProdutosPorProfissional(filters = {}, currentUser) {
        const where = {};
        if (filters.funcionario_id) where.funcionario_id = filters.funcionario_id;
        if (filters.dataInicio || filters.dataFim) {
            where.data = {};
            if (filters.dataInicio) where.data[Op.gte] = new Date(filters.dataInicio);
            if (filters.dataFim) where.data[Op.lte] = new Date(filters.dataFim);
        }
        aplicarEmpresaScope(where, currentUser);
        aplicarEscopoComissoes(where, currentUser);

        const vendas = await Venda.findAll({
            where,
            include: [
                { model: User, as: 'funcionario', attributes: ['id', 'nomeCompleto'] },
                { model: Cliente, as: 'cliente', attributes: ['id', 'nomeCompleto'] },
                {
                    model: VendaItem,
                    as: 'itens',
                    where: { tipo: 'produto' },
                    required: true,
                    include: [{ model: Product, attributes: ['id', 'name'], required: false }]
                }
            ],
            order: [['data', 'DESC']]
        });

        return vendas.flatMap(venda => venda.itens.map(item => ({
            venda_id: venda.id,
            data: venda.data,
            funcionario_id: venda.funcionario_id,
            funcionario_nome: venda.funcionario?.nomeCompleto ?? 'Não informado',
            cliente: venda.cliente?.nomeCompleto ?? null,
            produto_id: item.produto_id,
            produto: item.Product?.name ?? item.nome_item ?? 'Produto removido',
            quantidade: Number(item.quantidade),
            valor_unitario: Number(item.valor_unitario),
            valor_total: Number(item.valor_total),
            atribuicao: 'funcionario_da_venda'
        })));
    }

    async pagar(id, currentUser) {
        exigirGestaoComissoes(currentUser);
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const comissao = await Comissao.findOne({ where });
        if (!comissao) throw new Error('Comissão não encontrada');
        await comissao.update({ status: 'pago', data_pagamento: new Date() });
        return comissao;
    }

    async pagarTodasPendentes(funcionario_id, currentUser) {
        exigirGestaoComissoes(currentUser);
        const where = { funcionario_id, status: 'pendente' };
        aplicarEmpresaScope(where, currentUser);
        const [count] = await Comissao.update(
            { status: 'pago', data_pagamento: new Date() },
            { where }
        );
        return { atualizados: count };
    }

    async delete(id, currentUser) {
        exigirGestaoComissoes(currentUser);
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const c = await Comissao.findOne({ where });
        if (!c) throw new Error('Comissão não encontrada');
        await c.destroy();
        return true;
    }

    getEscopo(currentUser) {
        return {
            podeVerTodas: podeVerTodasComissoes(currentUser),
            podeVisualizarServicos: true,
            podeConfigurarServicos: true,
            usuarioId: Number(currentUser?.id) || null
        };
    }

    async getConfiguracoesServico(currentUser) {
        const empresaId = this.exigirEmpresa(currentUser);
        return ComissaoServico.findAll({
            where: { empresa_id: empresaId },
            include: [{ model: User, as: 'funcionario', attributes: ['id', 'nomeCompleto', 'email'] }],
            order: [['servico_nome', 'ASC'], ['funcionario_id', 'ASC']]
        });
    }

    async getCatalogoServicos(currentUser) {
        const empresaId = this.exigirEmpresa(currentUser);
        const [servicosFiscais, servicosAgenda] = await Promise.all([
            Service.findAll({ where: { empresa_id: empresaId, ativo: true }, attributes: ['name'], raw: true }),
            AgendamentoServico.findAll({ where: { empresa_id: empresaId, ativo: true }, attributes: ['nome'], raw: true })
        ]);
        const nomes = [...servicosAgenda.map(item => item.nome), ...servicosFiscais.map(item => item.name)]
            .map(nome => String(nome ?? '').trim())
            .filter(Boolean);
        return Array.from(new Map(nomes.map(nome => [normalizarNomeServico(nome), nome])).values())
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    async salvarConfiguracaoServico(data, currentUser) {
        const empresaId = this.exigirEmpresa(currentUser);
        const funcionarioId = Number(data.funcionario_id);
        const servicoNome = String(data.servico_nome ?? '').trim();
        const percentual = Number(data.percentual);
        if (!funcionarioId || !servicoNome) throw new Error('Funcionário e serviço são obrigatórios');
        if (!(percentual > 0 && percentual <= 100)) throw new Error('O percentual deve ser maior que 0 e menor ou igual a 100');

        const funcionario = await User.findOne({ where: { id: funcionarioId, empresa_id: empresaId } });
        if (!funcionario) throw new Error('Funcionário não encontrado nesta empresa');

        const servicoChave = normalizarNomeServico(servicoNome);
        const [configuracao, criado] = await ComissaoServico.findOrCreate({
            where: { empresa_id: empresaId, funcionario_id: funcionarioId, servico_chave: servicoChave },
            defaults: { servico_nome: servicoNome, percentual }
        });
        if (!criado) await configuracao.update({ servico_nome: servicoNome, percentual });
        return configuracao;
    }

    async excluirConfiguracaoServico(id, currentUser) {
        const empresaId = this.exigirEmpresa(currentUser);
        const configuracao = await ComissaoServico.findOne({ where: { id, empresa_id: empresaId } });
        if (!configuracao) throw new Error('Configuração de serviço não encontrada');
        await configuracao.destroy();
    }
}

export default new ComissaoService();
