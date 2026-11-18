import HistoricoPagamento from '../models/HistoricoPagamento.js';
import Recorrencia from '../models/Recorrencia.js';
import { Op } from 'sequelize';

class HistoricoPagamentoService {
    
    async getHistoricoByRecorrenciaId(recorrenciaId, user) {
        try {
            const where = { recorrencia_id: recorrenciaId };
            
            if (user && user.empresa_id) {
                where.empresa_id = user.empresa_id;
            }
            
            // ✅ Atualizar status de pendentes para atrasados
            const hoje = new Date().toISOString().split('T')[0];
            await HistoricoPagamento.update(
                { status: 'ATRASADO' },
                { 
                    where: { 
                        ...where, 
                        status: 'PENDENTE',
                        dataVencimento: { [Op.lt]: hoje }
                    } 
                }
            );
            
            return await HistoricoPagamento.findAll({
                where,
                order: [['dataVencimento', 'ASC']] // ✅ Ordenar por vencimento
            });
        } catch (error) {
            throw new Error(`Erro ao buscar histórico: ${error.message}`);
        }
    }
    
    async gerarPagamentosPendentes(recorrenciaId, user) {
        try {
            const recorrencia = await Recorrencia.findByPk(recorrenciaId);
            if (!recorrencia) throw new Error('Recorrência não encontrada');
            if (!recorrencia.ativo) return []; // Não gera para inativas
            
            const hoje = new Date();
            const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

            // console.log('📅 Data hoje:', hojeStr);
            
            const dataInicio = new Date(recorrencia.dataInicio + 'T12:00:00');
            // console.log('📅 Data início original:', recorrencia.dataInicio);
            // console.log('📅 Data início parseada:', dataInicio);
            
            const dataFim = recorrencia.dataFim ? new Date(recorrencia.dataFim + 'T12:00:00') : null;
            
            // Buscar registros existentes para não duplicar
            const existentes = await HistoricoPagamento.findAll({
                where: { recorrencia_id: recorrenciaId },
                attributes: ['dataVencimento'],
                raw: true
            });
            
            const datasExistentes = new Set(
                existentes.map(e => {
                    const d = new Date(e.dataVencimento);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                })
            );
            
            let dataLimite;
            if (dataFim) {
                // Se tem dataFim, gera até a dataFim
                dataLimite = new Date(dataFim);
            } else {
                // Se não tem dataFim (contínuo), gera até hoje + 3 meses
                dataLimite = new Date(hoje);
                dataLimite.setMonth(dataLimite.getMonth() + 3);
            }

            console.log('📅 Data limite:', dataLimite);

            let dataAtual = new Date(dataInicio);
            const registrosParaCriar = [];

            while (dataAtual <= dataLimite) {
                // ✅ Parar se atingiu a dataFim (já é controlado pelo while, mas mantém segurança)
                if (dataFim && dataAtual > dataFim) break;
                
                const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                
                // Só cria se não existir
                if (!datasExistentes.has(mesRef)) {
                    const dataVencimento = new Date(dataAtual.getTime());
                    const dataVencimentoStr = `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}-${String(dataVencimento.getDate()).padStart(2, '0')}`;
                    
                    // Determinar status
                    let status = 'PENDENTE';
                    if (dataVencimentoStr < hojeStr) {
                        status = 'ATRASADO';
                    }

                    // Formatar data local (evitar timezone)
                    const dataFormatada = `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}-${String(dataVencimento.getDate()).padStart(2, '0')}`;
                    
                    registrosParaCriar.push({
                        recorrencia_id: recorrenciaId,
                        dataVencimento: dataFormatada,
                        dataPagamento: null,
                        valor: recorrencia.valorMes,
                        status,
                        mesReferencia: mesRef,
                        empresa_id: user?.empresa_id || null
                    });
                }
                
                // Avançar para próxima data
                dataAtual = this.calcularProximaData(
                    dataAtual, 
                    recorrencia.tempoRecorrencia, 
                    recorrencia.subtipoRecorrencia
                );
            }
            
            if (registrosParaCriar.length > 0) {
                await HistoricoPagamento.bulkCreate(registrosParaCriar);
            }
            
            return registrosParaCriar;
            
        } catch (error) {
            throw new Error(`Erro ao gerar pagamentos: ${error.message}`);
        }
    }
    
    calcularProximaData(dataBase, tempoRecorrencia, subtipoRecorrencia = null) {
        const proximaData = new Date(dataBase);
        let tipoEfetivo = tempoRecorrencia;
        
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
        
        return proximaData;
    }
    
    async registrarPagamento(recorrenciaId, dataPagamento, valor, referenciaId, user, transaction = null) {
        try {
            // Garantir que dataPagamento está no formato correto
            const dataPagamentoStr = typeof dataPagamento === 'string' 
                ? dataPagamento.split('T')[0] 
                : dataPagamento;
            
            console.log('💰 Registrar pagamento:', { recorrenciaId, dataPagamentoStr, valor, referenciaId });

            // ✅ Se foi especificado um referenciaId, pagar exatamente aquele registro
            if (referenciaId) {
                const registroEspecifico = await HistoricoPagamento.findOne({
                    where: {
                        id: referenciaId,
                        recorrencia_id: recorrenciaId
                    },
                    transaction,
                    lock: transaction ? transaction.LOCK.UPDATE : undefined
                });
                
                if (registroEspecifico) {
                    if (['PAGO', 'PAGO_ATRASADO'].includes(registroEspecifico.status)) {
                        return registroEspecifico;
                    }
                    console.log('✅ Pagando referência específica:', registroEspecifico.dataVencimento);
                    
                    const dataVencimento = registroEspecifico.dataVencimento;
                    const dataPagamentoDate = new Date(dataPagamentoStr + 'T12:00:00');
                    const dataVencimentoDate = new Date(dataVencimento + 'T12:00:00');
                    
                    registroEspecifico.status = dataPagamentoDate > dataVencimentoDate ? 'PAGO_ATRASADO' : 'PAGO';
                    registroEspecifico.dataPagamento = dataPagamentoStr;
                    registroEspecifico.valor = valor || registroEspecifico.valor;
                    await registroEspecifico.save({ transaction });
                    return registroEspecifico;
                }
            }
            
            // ✅ PRIMEIRO: Buscar registro ATRASADO mais antigo
            const registroAtrasado = await HistoricoPagamento.findOne({
                where: {
                    recorrencia_id: recorrenciaId,
                    status: 'ATRASADO'
                },
                order: [['dataVencimento', 'ASC']],
                transaction,
                lock: transaction ? transaction.LOCK.UPDATE : undefined
            });
            
            if (registroAtrasado) {
                console.log('✅ Pagando ATRASADO:', registroAtrasado.dataVencimento);
                registroAtrasado.status = 'PAGO_ATRASADO';
                registroAtrasado.dataPagamento = dataPagamentoStr;
                registroAtrasado.valor = valor || registroAtrasado.valor;
                await registroAtrasado.save({ transaction });
                return registroAtrasado;
            }
            
            // ✅ SEGUNDO: Se não tem atrasado, buscar PENDENTE do mês correto
            // Buscar o pendente com vencimento mais próximo da data de pagamento
            const registroPendente = await HistoricoPagamento.findOne({
                where: {
                    recorrencia_id: recorrenciaId,
                    status: 'PENDENTE',
                    dataVencimento: {
                        [Op.lte]: dataPagamentoStr // Vencimento menor ou igual à data de pagamento
                    }
                },
                order: [['dataVencimento', 'DESC']],
                transaction,
                lock: transaction ? transaction.LOCK.UPDATE : undefined
            });
            
            if (registroPendente) {
                console.log('✅ Pagando PENDENTE:', registroPendente.dataVencimento);
                
                // Verificar se é pagamento em dia ou atrasado
                const dataVencimento = registroPendente.dataVencimento;
                const dataPagamentoDate = new Date(dataPagamentoStr + 'T12:00:00');
                const dataVencimentoDate = new Date(dataVencimento + 'T12:00:00');
                
                if (dataPagamentoDate > dataVencimentoDate) {
                    registroPendente.status = 'PAGO_ATRASADO';
                } else {
                    registroPendente.status = 'PAGO';
                }
                
                registroPendente.dataPagamento = dataPagamentoStr;
                registroPendente.valor = valor || registroPendente.valor;
                await registroPendente.save({ transaction });
                return registroPendente;
            }
            
            // ✅ TERCEIRO: Buscar próximo pendente (adiantamento)
            const proximoPendente = await HistoricoPagamento.findOne({
                where: {
                    recorrencia_id: recorrenciaId,
                    status: 'PENDENTE',
                    dataVencimento: {
                        [Op.gt]: dataPagamentoStr
                    }
                },
                order: [['dataVencimento', 'ASC']],
                transaction,
                lock: transaction ? transaction.LOCK.UPDATE : undefined
            });
            
            if (proximoPendente) {
                console.log('✅ Pagando adiantado:', proximoPendente.dataVencimento);
                proximoPendente.status = 'PAGO';
                proximoPendente.dataPagamento = dataPagamentoStr;
                proximoPendente.valor = valor || proximoPendente.valor;
                await proximoPendente.save({ transaction });
                return proximoPendente;
            }
            
            // ✅ QUARTO: Se não encontrou nenhum, cria um novo registro
            console.log('📝 Criando novo registro de pagamento');
            const dataPagamentoDate = new Date(dataPagamentoStr + 'T12:00:00');
            const mesRef = `${dataPagamentoDate.getFullYear()}-${String(dataPagamentoDate.getMonth() + 1).padStart(2, '0')}`;
            
            return await HistoricoPagamento.create({
                recorrencia_id: recorrenciaId,
                dataPagamento: dataPagamentoStr,
                dataVencimento: dataPagamentoStr,
                valor,
                status: 'PAGO',
                mesReferencia: mesRef,
                empresa_id: user?.empresa_id || null
            }, { transaction });
            
        } catch (error) {
            throw new Error(`Erro ao registrar pagamento: ${error.message}`);
        }
    }

    async excluirHistoricoPorRecorrencia(recorrenciaId) {
        try {
            await HistoricoPagamento.destroy({
                where: { recorrencia_id: recorrenciaId }
            });
        } catch (error) {
            throw new Error(`Erro ao excluir histórico: ${error.message}`);
        }
    }
}

export default new HistoricoPagamentoService();
