// backend/src/services/ClienteRecorrencia.service.js
import Recorrencia from '../models/Recorrencia.js';
import Cliente from '../models/Cliente.js';
import HistoricoPagamento from '../models/HistoricoPagamento.js';
import { Op, fn, col } from 'sequelize';
import { aplicarEmpresaScope } from '../utils/empresaScope.js';
import { matchesNormalizedText, normalizeSearchText } from '../utils/textSearch.js';
import sequelize from '../config/database.js';

class ClienteRecorrenciaService {
    
    /**
     * Listar clientes com suas recorrências agrupadas
     */
    async getClientesComRecorrencias(filters = {}, user) {
        try {
            const whereRecorrencia = {};
            aplicarEmpresaScope(whereRecorrencia, user);
            
            // Filtros nas recorrências
            if (filters.tipoRecorrencia) {
                whereRecorrencia.tempoRecorrencia = filters.tipoRecorrencia;
            }
            
            // ✅ CORREÇÃO: Buscar IDs de clientes que têm recorrências
            // Só busca cliente_id quando NÃO é null (cliente real)
            // e NÃO inclui empresas (que teriam empresa_id mas cliente_id null)
            const clientesIds = await Recorrencia.findAll({
                attributes: ['cliente_id'],
                where: {
                    ...whereRecorrencia,
                    cliente_id: { [Op.ne]: null }  // Apenas registros com cliente_id preenchido
                },
                group: ['cliente_id'],
                raw: true
            });
            
            const ids = clientesIds.map(r => r.cliente_id).filter(Boolean);
            
            if (ids.length === 0) {
                return [];
            }
            
            // Buscar dados dos clientes
            const whereCliente = {
                id: { [Op.in]: ids }
            };
            
            if (filters.cpf) {
                whereCliente.cpf = { [Op.like]: `%${filters.cpf}%` };
            }
            if (filters.telefone) {
                whereCliente.telefone = { [Op.like]: `%${filters.telefone}%` };
            }
            aplicarEmpresaScope(whereCliente, user);
            
            const clientesEncontrados = await Cliente.findAll({
                where: whereCliente,
                attributes: ['id', 'nomeCompleto', 'cpf', 'telefone', 'email'],
                order: [['nomeCompleto', 'ASC']]
            });

            // O PostgreSQL diferencia maiúsculas/minúsculas e acentos no LIKE.
            // Como esta consulta já carrega os clientes com recorrência da empresa,
            // filtramos o nome em memória para aceitar busca parcial e sem acentos.
            const nomeBuscado = normalizeSearchText(filters.nome);
            const clientes = nomeBuscado
                ? clientesEncontrados.filter(cliente => matchesNormalizedText(cliente.nomeCompleto, nomeBuscado))
                : clientesEncontrados;
            
            // Para cada cliente, buscar contagem de recorrências
            const resultado = await Promise.all(clientes.map(async (cliente) => {
                const countWhere = {
                    ...whereRecorrencia,
                    [Op.or]: [
                        { cliente_id: cliente.id },
                        { empresa_id: cliente.id }
                    ]
                };
                aplicarEmpresaScope(countWhere, user);
                
                const totalRecorrencias = await Recorrencia.count({ where: countWhere });
                
                const ativasCount = await Recorrencia.count({
                    where: { ...countWhere, ativo: true }
                });
                
                const valorTotal = await Recorrencia.sum('valor_mes', {
                    where: countWhere
                });
                
                return {
                    id: cliente.id,
                    nome: cliente.nomeCompleto,
                    cpf: cliente.cpf,
                    telefone: cliente.telefone,
                    email: cliente.email,
                    totalRecorrencias,
                    recorrenciasAtivas: ativasCount,
                    valorTotal: parseFloat(valorTotal || 0)
                };
            }));
            
            // Filtrar clientes sem recorrências
            return resultado.filter(c => c.totalRecorrencias > 0);
            
        } catch (error) {
            throw new Error(`Erro ao buscar clientes: ${error.message}`);
        }
    }

    async getRecorrenciasPorCliente(clienteId, filters = {}, user) {
        try {
            const where = {};
            aplicarEmpresaScope(where, user);
            
            // Busca apenas recorrências vinculadas ao cliente
            where.cliente_id = clienteId;
            
            // Filtros adicionais
            if (filters.ativo !== undefined && filters.ativo !== '') {
                where.ativo = filters.ativo === 'true' || filters.ativo === true;
            }
            if (filters.tipoTransacao) {
                where.tipoTransacao = filters.tipoTransacao;
            }
            if (filters.tempoRecorrencia) {
                where.tempoRecorrencia = filters.tempoRecorrencia;
            }
            
            const recorrencias = await Recorrencia.findAll({
                where,
                include: [{
                    model: Cliente,
                    as: 'cliente',
                    attributes: ['id', 'nomeCompleto', 'cpf', 'telefone'],
                    required: false
                }],
                order: [['created_at', 'DESC']]
            });
            
            // Calcular quantidade restante
            const hoje = new Date();
            return recorrencias.map(rec => {
                const recJSON = rec.toJSON();
                let quantidadeRestante = null;
                if (rec.dataFim) {
                    const dataFim = new Date(rec.dataFim);
                    if (dataFim > hoje) {
                        const mesesRestantes = 
                            (dataFim.getFullYear() - hoje.getFullYear()) * 12 + 
                            (dataFim.getMonth() - hoje.getMonth());
                        quantidadeRestante = Math.max(0, mesesRestantes);
                    } else {
                        quantidadeRestante = 0;
                    }
                }
                return { ...recJSON, quantidadeRestante };
            });
            
        } catch (error) {
            throw new Error(`Erro ao buscar recorrências do cliente: ${error.message}`);
        }
    }

    /**
     * Dashboard de faturamento (apenas gerente/dono)
     */
    async getDashboardFaturamento(user) {
        try {
            // Verificar permissão
            if (!user || (user.cargo !== 'GERENTE' && user.cargo !== 'DONO' && user.tipo !== 'MASTER')) {
                throw new Error('Acesso não autorizado. Apenas gerentes e donos podem acessar o dashboard.');
            }
            
            const where = {};
            aplicarEmpresaScope(where, user);
            
            const hoje = new Date();
            const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
            
            // Total faturado no mês atual
            const pagosMesAtual = await HistoricoPagamento.findOne({
                where: { ...where, status: 'PAGO', mesReferencia: mesAtual },
                attributes: [[fn('COALESCE', fn('SUM', col('valor')), 0), 'total']]
            });
            
            // Total de recorrências ativas
            const totalAtivas = await Recorrencia.count({
                where: { ...where, ativo: true }
            });
            
            // Valor total previsto (todas recorrências ativas)
            const valorPrevisto = await Recorrencia.findOne({
                where: { ...where, ativo: true },
                attributes: [[fn('COALESCE', fn('SUM', col('valor_mes')), 0), 'total']]
            });
            
            // Por tipo de transação
            const porTipo = await Recorrencia.findAll({
                where: { ...where, ativo: true },
                attributes: [
                    'tipoTransacao',
                    [fn('COUNT', col('id')), 'quantidade'],
                    [fn('COALESCE', fn('SUM', col('valor_mes')), 0), 'total']
                ],
                group: ['tipoTransacao'],
                raw: true
            });
            
            // Por forma de pagamento
            const porFormaPagamento = await Recorrencia.findAll({
                where: { ...where, ativo: true },
                attributes: [
                    'formaPagamento',
                    [fn('COUNT', col('id')), 'quantidade']
                ],
                group: ['formaPagamento'],
                raw: true
            });
            
            return {
                faturamentoMesAtual: parseFloat(pagosMesAtual?.get('total') || 0),
                valorPrevisto: parseFloat(valorPrevisto?.get('total') || 0),
                totalRecorrenciasAtivas: totalAtivas,
                porTipo: porTipo.map(t => ({
                    tipo: t.tipoTransacao,
                    quantidade: parseInt(t.quantidade),
                    total: parseFloat(t.total)
                })),
                porFormaPagamento: porFormaPagamento.map(f => ({
                    forma: f.formaPagamento,
                    quantidade: parseInt(f.quantidade)
                })),
                mesReferencia: mesAtual
            };
        } catch (error) {
            throw new Error(`Erro ao gerar dashboard: ${error.message}`);
        }
    }
    
    /**
     * Buscar cliente para auto-complete
     */
    async buscarCliente(termo, user) {
        try {
            const where = {};
            
            // ✅ Se termo vazio, retorna todos (sem filtro de nome/CPF/telefone)
            if (termo && termo.trim() !== '') {
                where[Op.or] = [
                    { nomeCompleto: { [Op.like]: `%${termo}%` } },
                    { cpf: { [Op.like]: `%${termo}%` } },
                    { telefone: { [Op.like]: `%${termo}%` } }
                ];
            }
            
            aplicarEmpresaScope(where, user);
            
            return await Cliente.findAll({
                where,
                attributes: ['id', 'nomeCompleto', 'cpf', 'telefone', 'empresa_id'],
                // O dropdown da recorrência faz o filtro localmente. Sem termo,
                // não limitar a 100 evita esconder clientes cadastrados depois
                // do primeiro lote; com termo, mantemos uma resposta pequena.
                ...(termo && termo.trim() !== '' ? { limit: 20 } : {}),
                order: [['nomeCompleto', 'ASC']]
            });
        } catch (error) {
            throw new Error(`Erro ao buscar cliente: ${error.message}`);
        }
    }
}

export default new ClienteRecorrenciaService();
