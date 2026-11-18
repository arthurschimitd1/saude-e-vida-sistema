import AutomacaoRegra from '../models/Automacaoregra.js';
import AutomacaoExecucao from '../models/AutomacaoExecucao.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

const TEMPLATES = [
    {
        id: 'tpl_nf_recebida',
        nome: 'Notificar ao receber Nota Fiscal',
        descricao: 'Envia uma notificação no sistema sempre que uma nota fiscal for recebida.',
        evento_gatilho: 'nota_fiscal_recebida',
        parametros_gatilho: {},
        acoes: [{ tipo: 'notificacao_sistema', parametros: { mensagem: 'Nova nota fiscal recebida.' } }]
    },
    {
        id: 'tpl_estoque_minimo',
        nome: 'Alerta de estoque abaixo do mínimo',
        descricao: 'Notifica quando um produto atingir o estoque mínimo.',
        evento_gatilho: 'estoque_abaixo_minimo',
        parametros_gatilho: {},
        acoes: [{ tipo: 'notificacao_sistema', parametros: { mensagem: 'Produto com estoque abaixo do mínimo.' } }]
    },
    {
        id: 'tpl_conta_vencendo',
        nome: 'Alerta de conta a pagar vencendo',
        descricao: 'Notifica 5 dias antes de uma conta a pagar vencer.',
        evento_gatilho: 'conta_pagar_vence',
        parametros_gatilho: { dias: 5 },
        acoes: [{ tipo: 'notificacao_sistema', parametros: { mensagem: 'Conta a pagar vence em breve.' } }]
    },
    {
        id: 'tpl_novo_cliente',
        nome: 'Boas-vindas ao novo cliente',
        descricao: 'Envia e-mail de boas-vindas quando um novo cliente for cadastrado.',
        evento_gatilho: 'novo_cliente',
        parametros_gatilho: {},
        acoes: [{ tipo: 'enviar_email', parametros: { assunto: 'Bem-vindo!', mensagem: 'Obrigado por se cadastrar.' } }]
    },
    {
        id: 'tpl_budget',
        nome: 'Alerta de budget atingido',
        descricao: 'Notifica quando um centro de custo atingir 80% do budget.',
        evento_gatilho: 'budget_atingido',
        parametros_gatilho: { percentual: 80 },
        acoes: [{ tipo: 'notificacao_sistema', parametros: { mensagem: 'Centro de custo atingiu 80% do budget.' } }]
    }
];

class AutomacaoService {

    getEmpresaId(user) {
        return user?.empresa_id_override ?? user?.empresa_id;
    }

    async getAll(empresa_id, filters = {}) {
        const where = { empresa_id };
        if (filters.status) where.status = filters.status;
        if (filters.evento_gatilho) where.evento_gatilho = filters.evento_gatilho;
        if (filters.nome) where.nome = { [Op.iLike]: `%${filters.nome}%` };

        return await AutomacaoRegra.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
    }

    async getById(id, empresa_id) {
        const regra = await AutomacaoRegra.findOne({ where: { id, empresa_id } });
        if (!regra) throw { status: 404, message: 'Regra não encontrada' };
        return regra;
    }

    async create(data, user) {
        const empresa_id = this.getEmpresaId(user);
        if (!empresa_id) throw { status: 400, message: 'empresa_id não encontrado' };
        return await AutomacaoRegra.create({ ...data, empresa_id, criado_por: user?.id });
    }

    async update(id, data, user) {
        const empresa_id = this.getEmpresaId(user);
        const regra = await this.getById(id, empresa_id);
        await regra.update(data);
        return regra;
    }

    async toggleStatus(id, user) {
        const empresa_id = this.getEmpresaId(user);
        const regra = await this.getById(id, empresa_id);
        const novoStatus = regra.status === 'ativo' ? 'inativo' : 'ativo';
        await regra.update({ status: novoStatus, falhas_consecutivas: 0 });
        return regra;
    }

    async duplicar(id, user) {
        const empresa_id = this.getEmpresaId(user);
        const regra = await this.getById(id, empresa_id);
        const nova = await AutomacaoRegra.create({
            nome: `${regra.nome} (cópia)`,
            descricao: regra.descricao,
            evento_gatilho: regra.evento_gatilho,
            parametros_gatilho: regra.parametros_gatilho,
            acoes: regra.acoes,
            status: 'inativo',
            empresa_id,
            criado_por: user?.id
        });
        return nova;
    }

    async delete(id, user) {
        const empresa_id = this.getEmpresaId(user);
        const regra = await this.getById(id, empresa_id);
        await AutomacaoExecucao.destroy({ where: { regra_id: id } });
        await regra.destroy();
    }

    async getHistorico(regra_id, user) {
        const empresa_id = this.getEmpresaId(user);
        await this.getById(regra_id, empresa_id);
        return await AutomacaoExecucao.findAll({
            where: { regra_id, empresa_id },
            order: [['created_at', 'DESC']],
            limit: 100
        });
    }

    async getResumo(empresa_id) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const [totalAtivas, totalInativas, execucoesHoje, execucoesSucesso, totalExecucoes] = await Promise.all([
            AutomacaoRegra.count({ where: { empresa_id, status: 'ativo' } }),
            AutomacaoRegra.count({ where: { empresa_id, status: 'inativo' } }),
            AutomacaoExecucao.count({ where: { empresa_id, created_at: { [Op.gte]: hoje } } }),
            AutomacaoExecucao.count({ where: { empresa_id, resultado: 'sucesso' } }),
            AutomacaoExecucao.count({ where: { empresa_id } })
        ]);

        const taxaSucesso = totalExecucoes > 0
            ? Math.round((execucoesSucesso / totalExecucoes) * 100)
            : 0;

        // Estimativa: cada execução economiza ~5 minutos de trabalho manual
        const economiaHorasMes = Math.round(execucoesHoje * 5 / 60 * 30);

        return {
            regras_ativas: totalAtivas,
            regras_inativas: totalInativas,
            execucoes_hoje: execucoesHoje,
            economia_horas_mes: economiaHorasMes,
            taxa_sucesso: taxaSucesso
        };
    }

    getTemplates() {
        return TEMPLATES;
    }
}

export default new AutomacaoService();
