import Tarefa from '../models/Tarefa.js';
import Subtarefa from '../models/Subtarefa.js';
import TarefaStatusLog from '../models/TarefaStatusLog.js';
import SetorPlanejamento from '../models/SetorPlanejamento.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

async function logarMudancaStatus(tarefaId, statusAnterior, novoStatus, responsavel) {
    if (statusAnterior === novoStatus) return;

    // Fecha o log aberto do status anterior
    const logAberto = await TarefaStatusLog.findOne({
        where: { tarefa_id: tarefaId, status: statusAnterior, finalizado_em: null },
        order: [['iniciado_em', 'DESC']]
    });
    if (logAberto) {
        const agora = new Date();
        const duracaoMin = Math.round((agora - new Date(logAberto.iniciado_em)) / 60000);
        await logAberto.update({ finalizado_em: agora, duracao_min: duracaoMin });
    }

    // Abre novo log para o status novo
    await TarefaStatusLog.create({
        tarefa_id: tarefaId,
        status: novoStatus,
        responsavel: responsavel || null,
        iniciado_em: new Date()
    });
}

class TarefaService {
    async getAll(filters = {}, currentUser) {
        const where = {};
        if (filters.status) where.status = filters.status;
        if (filters.prioridade) where.prioridade = filters.prioridade;
        if (filters.setor_id !== undefined) {
            where.setor_id = filters.setor_id === 'null' ? null : Number(filters.setor_id);
        }

        if (filters.responsavel) {
            where[Op.or] = [
                { responsavel: filters.responsavel },
                sequelize.where(
                    sequelize.fn('jsonb_exists', sequelize.cast(sequelize.col('responsaveis'), 'jsonb'), filters.responsavel),
                    true
                )
            ];
        }

        aplicarEmpresaScope(where, currentUser);

        const tarefas = await Tarefa.findAll({
            where,
            include: [{ model: Subtarefa, as: 'subtarefas', order: [['ordem', 'ASC']] }],
            order: [['ordem', 'ASC'], ['created_at', 'DESC']]
        });

        // Aplica filtro de acesso a setores para não-gestores
        // MASTER, EMPRESA (dono) e quem tem permissão planejamento:todos veem tudo
        const isGestor = currentUser?.tipo === 'MASTER'
            || currentUser?.tipo === 'EMPRESA'
            || (Array.isArray(currentUser?.permissoes) && currentUser.permissoes.includes('planejamento:todos'));

        if (!isGestor && currentUser?.id) {
            // Busca os setores que este usuário é membro
            const setoresMembro = await SetorPlanejamento.findAll({
                where: {
                    empresa_id: currentUser.empresa_id,
                    membros: { [Op.contains]: [currentUser.id] }
                },
                attributes: ['id'],
            }).catch(() => []);
            const setorIdsPermitidos = setoresMembro.map(s => s.id);

            // Filtra: pode ver tarefas sem setor (geral) ou de setores que é membro
            return tarefas.filter(t => {
                if (!t.setor_id) return true; // setor geral — todos veem
                return setorIdsPermitidos.includes(t.setor_id);
            });
        }

        return tarefas;
    }

    async getById(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);
        const tarefa = await Tarefa.findOne({
            where,
            include: [{ model: Subtarefa, as: 'subtarefas', order: [['ordem', 'ASC']] }]
        });
        if (!tarefa) throw new Error('Tarefa não encontrada');
        return tarefa;
    }

    async create(data, currentUser) {
        const { subtarefas: subtarefasData, ...tarefaData } = data;

        const tarefa = await Tarefa.create({
            ...tarefaData,
            empresa_id: empresaParaGravar(currentUser)
        });

        if (Array.isArray(subtarefasData) && subtarefasData.length > 0) {
            await Subtarefa.bulkCreate(
                subtarefasData.map((s, i) => ({
                    tarefa_id: tarefa.id,
                    titulo: s.titulo,
                    descricao: s.descricao || null,
                    peso: s.peso || 0,
                    concluida: s.concluida || false,
                    ordem: i
                }))
            );
        }

        // Loga status inicial
        await TarefaStatusLog.create({
            tarefa_id: tarefa.id,
            status: tarefa.status,
            responsavel: Array.isArray(tarefaData.responsaveis) ? tarefaData.responsaveis[0] || null : tarefaData.responsavel || null,
            iniciado_em: new Date()
        });

        return this.getById(tarefa.id, currentUser);
    }

    async update(id, data, currentUser) {
        const tarefa = await this.getById(id, currentUser);
        const { subtarefas: subtarefasData, ...tarefaData } = data;

        // Registra data de conclusão
        if (tarefaData.status === 'concluido' && tarefa.status !== 'concluido') {
            tarefaData.data_conclusao = new Date();
        }
        if (tarefaData.status && tarefaData.status !== 'concluido' && tarefa.status === 'concluido') {
            tarefaData.data_conclusao = null;
        }

        // Loga mudança de status
        if (tarefaData.status && tarefaData.status !== tarefa.status) {
            const responsavel = Array.isArray(tarefaData.responsaveis)
                ? tarefaData.responsaveis[0] || null
                : tarefaData.responsavel || null;
            await logarMudancaStatus(tarefa.id, tarefa.status, tarefaData.status, responsavel);
        }

        await tarefa.update(tarefaData);

        // Atualiza subtarefas: remove as antigas e recria
        if (Array.isArray(subtarefasData)) {
            await Subtarefa.destroy({ where: { tarefa_id: id } });
            if (subtarefasData.length > 0) {
                await Subtarefa.bulkCreate(
                    subtarefasData.map((s, i) => ({
                        tarefa_id: id,
                        titulo: s.titulo,
                        descricao: s.descricao || null,
                        peso: s.peso || 0,
                        concluida: s.concluida || false,
                        ordem: i
                    }))
                );
            }
        }

        return this.getById(id, currentUser);
    }

    async delete(id, currentUser) {
        const tarefa = await this.getById(id, currentUser);
        await tarefa.destroy();
        return true;
    }
}

export default new TarefaService();
