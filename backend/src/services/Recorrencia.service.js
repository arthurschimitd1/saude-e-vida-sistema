// backend/src/services/RecorrenciaService.js
import Recorrencia from '../models/Recorrencia.js';
import Cliente from '../models/Cliente.js';
import HistoricoPagamentoService from './HistoricoPagamento.service.js';
import CaixaLancamento from '../models/CaixaLancamento.js';
import sequelize from '../config/database.js';
import { Op } from 'sequelize';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';
import AgendamentoServico from '../models/AgendamentoServico.js';
import { normalizarNomeServico, normalizarServicosInclusos } from '../utils/franquiaRecorrencia.js';
const CAMPOS_BANCARIOS_LEGADOS = ['bancoRecebimento', 'bancoNome', 'bancoAgencia', 'bancoConta', 'bancoPix'];

export const removerDadosBancariosLegados = (dados = {}) => {
    const limpos = { ...dados };
    for (const campo of CAMPOS_BANCARIOS_LEGADOS) delete limpos[campo];
    return limpos;
};

const validarServicosInclusos = async (servicos, empresaId) => {
    const normalizados = normalizarServicosInclusos(servicos);
    if (!normalizados) return null;
    if (!empresaId) {
        throw new Error('Selecione uma empresa antes de associar serviços à recorrência');
    }

    const catalogo = await AgendamentoServico.findAll({
        where: { empresa_id: empresaId, ativo: true },
        attributes: ['id', 'nome'],
    });
    const porId = new Map(catalogo.map(servico => [String(servico.id), servico]));
    const porNome = new Map();
    catalogo.forEach(servico => {
        const chave = normalizarNomeServico(servico.nome);
        const encontrados = porNome.get(chave) ?? [];
        encontrados.push(servico);
        porNome.set(chave, encontrados);
    });

    const resolvidos = normalizados.map(item => {
        let servico = item.servico_id ? porId.get(String(item.servico_id)) : null;
        if (item.servico_id && !servico) {
            throw new Error(`O serviço "${item.servico_nome}" não existe ou está inativo nesta empresa`);
        }
        if (!servico) {
            const encontrados = porNome.get(normalizarNomeServico(item.servico_nome)) ?? [];
            if (encontrados.length > 1) {
                throw new Error(`Existem serviços duplicados com o nome "${item.servico_nome}"; selecione o serviço correto pelo catálogo`);
            }
            servico = encontrados[0];
        }
        if (!servico) {
            throw new Error(`O serviço "${item.servico_nome}" não existe ou está inativo nesta empresa`);
        }
        return {
            ...item,
            servico_id: String(servico.id),
            servico_nome: servico.nome,
        };
    });
    return normalizarServicosInclusos(resolvidos);
};

class RecorrenciaService {
    
    /**
     * Calcular próximo vencimento baseado na recorrência
     */
    calcularProximoVencimento(dataBase, tempoRecorrencia, subtipoRecorrencia = null, dataFim = null) {
        if (!dataBase) return null;
        
        const proximaData = new Date(dataBase);
        let tipoEfetivo = tempoRecorrencia;
        
        // Se for personalizado, usa o subtipo
        if (tempoRecorrencia === 'PERSONALIZADO' && subtipoRecorrencia) {
            tipoEfetivo = subtipoRecorrencia;
        }
        
        switch (tipoEfetivo) {
            case 'MENSAL':
                proximaData.setMonth(proximaData.getMonth() + 1);
                break;
            case 'TRIMESTRAL':
                proximaData.setMonth(proximaData.getMonth() + 3);
                break;
            case 'SEMESTRAL':
                proximaData.setMonth(proximaData.getMonth() + 6);
                break;
            case 'ANUAL':
                proximaData.setFullYear(proximaData.getFullYear() + 1);
                break;
            case 'SEMANAL':
                proximaData.setDate(proximaData.getDate() + 7);
                break;
            case 'QUINZENAL':
                proximaData.setDate(proximaData.getDate() + 15);
                break;
            case 'DIARIO':
                proximaData.setDate(proximaData.getDate() + 1);
                break;
            default:
                proximaData.setMonth(proximaData.getMonth() + 1);
        }
        
        // Verificar se ultrapassou a data fim
        if (dataFim) {
            const dataFimDate = new Date(dataFim);
            if (proximaData > dataFimDate) {
                return null; // Finalizado
            }
        }
        
        return proximaData.toISOString().split('T')[0]; // Retorna YYYY-MM-DD
    }

    async createRecorrencia(recorrenciaData, user) {
        try {
            // A conta recebedora pertence à integração do Asaas. Os campos
            // bancários antigos não são mais usados em novas recorrências.
            recorrenciaData = removerDadosBancariosLegados(recorrenciaData);
            // Isolamento por empresa
            // Só define empresa_id do user se não veio do frontend (MASTER pode enviar)
            if (!recorrenciaData.empresa_id) {
                const empresa = empresaParaGravar(user);
                if (empresa) recorrenciaData.empresa_id = empresa;
            }
            recorrenciaData.servicosInclusos = await validarServicosInclusos(
                recorrenciaData.servicosInclusos,
                recorrenciaData.empresa_id,
            );

            if (!recorrenciaData.formaPagamento) {
                recorrenciaData.formaPagamento = 'PIX';
            }
            
            // Se tem cliente_id, buscar e validar cliente
            if (recorrenciaData.cliente_id) {
                const whereCliente = { id: recorrenciaData.cliente_id };
                
                // Se usuário não for MASTER, verificar se cliente pertence à empresa
                if (user.tipo !== 'MASTER' && user.empresa_id) {
                    whereCliente.empresa_id = user.empresa_id;
                }
                
                const cliente = await Cliente.findOne({ where: whereCliente });
                
                if (!cliente) {
                    throw new Error('Cliente não encontrado ou não pertence à sua empresa');
                }
                
                recorrenciaData.nomeCliente = cliente.nomeCompleto;
            }
            
            // Calcular próximo vencimento automaticamente
            const dataBase = recorrenciaData.dataInicio;
            recorrenciaData.proximoVencimento = this.calcularProximoVencimento(
                dataBase,
                recorrenciaData.tempoRecorrencia,
                recorrenciaData.subtipoRecorrencia,
                recorrenciaData.dataFim
            );
            
            recorrenciaData.statusRecorrencia = recorrenciaData.ativo === false ? 'PAUSADA' : 'ATIVA';
            return await Recorrencia.create(recorrenciaData);
        } catch (error) {
            throw new Error(`Erro ao criar recorrência: ${error.message}`);
        }
    }

    async getAllRecorrencias(filters = {}, user) {
        try {
            const where = {};
            aplicarEmpresaScope(where, user);
            
            // Filtro por nome do cliente
            if (filters.nomeCliente) {
                where.nomeCliente = { [Op.like]: `%${filters.nomeCliente}%` };
            }
            // Filtro por produto
            if (filters.produto) {
                where.produto = { [Op.like]: `%${filters.produto}%` };
            }
            // Filtro por tipo de transação
            if (filters.tipoTransacao) {
                where.tipoTransacao = filters.tipoTransacao;
            }
            // Filtro por status (ativo/inativo)
            if (filters.ativo !== undefined) {
                where.ativo = filters.ativo === 'true' || filters.ativo === true;
            }
            // Filtro por banco
            if (filters.bancoRecebimento) {
                where.bancoRecebimento = { [Op.like]: `%${filters.bancoRecebimento}%` };
            }
            if (filters.formaPagamento) {
                where.formaPagamento = filters.formaPagamento;
            }
            
            return await Recorrencia.findAll({ 
                where,
                include: [{
                    model: Cliente,
                    as: 'cliente',
                    attributes: ['id', 'nomeCompleto', 'cpf', 'telefone'],
                    required: false
                }],
                order: [['created_at', 'DESC']]
            });
        } catch (error) {
            throw new Error(`Erro ao buscar recorrências: ${error.message}`);
        }
    }

    async getRecorrenciaById(id, user) {
        try {
            const where = { id };
            
            // Isolamento automático
            if (user && user.empresa_id) {
                where.empresa_id = user.empresa_id;
            }
            
            const recorrencia = await Recorrencia.findOne({ where });
            
            if (!recorrencia) throw new Error('Recorrência não encontrada');
            return recorrencia;
        } catch (error) {
            throw new Error(`Erro ao buscar recorrência: ${error.message}`);
        }
    }

    async updateRecorrencia(id, recorrenciaData, user) {
        try {
            recorrenciaData = removerDadosBancariosLegados(recorrenciaData);
            const where = { id };
            if (recorrenciaData.servicosInclusos !== undefined) {
                const atual = await Recorrencia.findOne({ where });
                if (!atual) throw new Error('Recorrência não encontrada');
                recorrenciaData.servicosInclusos = await validarServicosInclusos(
                    recorrenciaData.servicosInclusos,
                    atual.empresa_id ?? empresaParaGravar(user),
                );
            }
            
            // Isolamento automático
            if (user && user.empresa_id) {
                where.empresa_id = user.empresa_id;
            }
            
            // Recalcular próximo vencimento se campos relevantes foram alterados
            if (recorrenciaData.dataInicio || 
                recorrenciaData.tempoRecorrencia || 
                recorrenciaData.subtipoRecorrencia !== undefined ||
                recorrenciaData.dataFim !== undefined ||
                recorrenciaData.ultimoPagamento) {
                
                // Buscar dados atuais para mesclar
                const current = await Recorrencia.findOne({ where });
                if (current) {
                    const dataBase = recorrenciaData.ultimoPagamento || 
                                    recorrenciaData.dataInicio || 
                                    current.dataInicio;
                    const tempoRecorrencia = recorrenciaData.tempoRecorrencia || current.tempoRecorrencia;
                    const subtipoRecorrencia = recorrenciaData.subtipoRecorrencia !== undefined ? 
                                              recorrenciaData.subtipoRecorrencia : 
                                              current.subtipoRecorrencia;
                    const dataFim = recorrenciaData.dataFim !== undefined ? 
                                   recorrenciaData.dataFim : 
                                   current.dataFim;
                    
                    recorrenciaData.proximoVencimento = this.calcularProximoVencimento(
                        dataBase,
                        tempoRecorrencia,
                        subtipoRecorrencia,
                        dataFim
                    );
                }
            }
            
            const [updated] = await Recorrencia.update(recorrenciaData, { where });
            
            if (!updated) throw new Error('Recorrência não encontrada');
            return await this.getRecorrenciaById(id, user);
        } catch (error) {
            throw new Error(`Erro ao atualizar recorrência: ${error.message}`);
        }
    }

    async deleteRecorrencia(id, user) {
        try {
            const where = { id };
            
            // Isolamento automático
            if (user && user.empresa_id) {
                where.empresa_id = user.empresa_id;
            }
            
            // Verificar se a recorrência existe
            const recorrencia = await Recorrencia.findOne({ where });
            if (!recorrencia) throw new Error('Recorrência não encontrada');
            
            // ✅ Excluir histórico de pagamentos vinculado
            await HistoricoPagamentoService.excluirHistoricoPorRecorrencia(id);
            
            // Excluir a recorrência
            await Recorrencia.destroy({ where });
            
            return { success: true };
        } catch (error) {
            throw new Error(`Erro ao deletar recorrência: ${error.message}`);
        }
    }

    async toggleStatus(id, user) {
        try {
            const where = { id };
            
            if (user && user.empresa_id) {
                where.empresa_id = user.empresa_id;
            }
            
            const recorrencia = await Recorrencia.findOne({ where });
            if (!recorrencia) throw new Error('Recorrência não encontrada');
            
            recorrencia.ativo = !recorrencia.ativo;
            recorrencia.statusRecorrencia = recorrencia.ativo ? 'ATIVA' : 'PAUSADA';
            await recorrencia.save();
            
            return recorrencia;
        } catch (error) {
            throw new Error(`Erro ao alternar status: ${error.message}`);
        }
    }

    async confirmarPagamento(id, dataPagamento, valor, referenciaId, user) {
        const transaction = await sequelize.transaction();
        try {
            const where = { id };
            aplicarEmpresaScope(where, user);
            
            const recorrencia = await Recorrencia.findOne({
                where,
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!recorrencia) throw new Error('Recorrência não encontrada');
            
            // Atualizar último pagamento e valor
            recorrencia.ultimoPagamento = dataPagamento;
            recorrencia.valorMes = valor || recorrencia.valorMes;
            
            // Recalcular próximo vencimento
            recorrencia.proximoVencimento = this.calcularProximoVencimento(
                dataPagamento,
                recorrencia.tempoRecorrencia,
                recorrencia.subtipoRecorrencia,
                recorrencia.dataFim
            );
            
            await recorrencia.save({ transaction });
            
            // Registrar no histórico de pagamentos
            const historico = await HistoricoPagamentoService.registrarPagamento(
                id,
                dataPagamento,
                valor,
                referenciaId,
                user,
                transaction
            );

            await CaixaLancamento.findOrCreate({
                where: {
                    empresa_id: recorrencia.empresa_id,
                    origem_tipo: 'recorrencia_pagamento',
                    origem_id: historico.id
                },
                defaults: {
                    empresa_id: recorrencia.empresa_id,
                    turno_id: null,
                    tipo: recorrencia.tipoTransacao === 'SAIDA' ? 'saida' : 'entrada',
                    origem_tipo: 'recorrencia_pagamento',
                    origem_id: historico.id,
                    descricao: `Pagamento recorrente - ${recorrencia.nomeCliente} - ${historico.mesReferencia}`,
                    valor: historico.valor,
                    forma_pagamento: recorrencia.formaPagamento,
                    data: new Date(`${String(dataPagamento).split('T')[0]}T12:00:00-03:00`)
                },
                transaction
            });

            await transaction.commit();
            
            return recorrencia;
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Erro ao confirmar pagamento: ${error.message}`);
        }
    }
}

export default new RecorrenciaService();
