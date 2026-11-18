// backend/src/services/FuncionarioCustoService.js
import FuncionarioCusto from '../models/FuncionarioCusto.js';
import { Op } from 'sequelize';

class FuncionarioCustoService {
    /**
     * Criar um novo funcionário
     */
    async create(data) {
        try {
            console.log('🏢 [SERVICE CREATE] Criando funcionário...');
            
            // Verificar se CPF já existe
            if (data.cpf) {
                const existing = await FuncionarioCusto.findOne({ 
                    where: { cpf: data.cpf } 
                });
                if (existing) {
                    throw new Error('CPF já cadastrado no sistema');
                }
            }
            
            const funcionario = await FuncionarioCusto.create(data);
            console.log(`✅ Funcionário criado: ID ${funcionario.id}`);
            return funcionario;
            
        } catch (error) {
            console.error('❌ Erro no service create:', error.message);
            throw error;
        }
    }

    /**
     * Buscar todos os funcionários com filtros
     */
    async getAll(filters = {}) {
        try {
            console.log('🏢 [SERVICE GET_ALL] Buscando funcionários...');

            const where = {};

            if (filters.empresa_id) {
                where.empresa_id = filters.empresa_id;
            }
            if (filters.nome) {
                where.nomeCompleto = { [Op.iLike]: `%${filters.nome}%` };
            }
            if (filters.cargo) {
                where.cargo = { [Op.iLike]: `%${filters.cargo}%` };
            }
            if (filters.tipoContrato) {
                where.tipoContrato = filters.tipoContrato;
            }
            if (filters.departamento) {
                where.departamento = filters.departamento;
            }
            if (filters.status) {
                where.status = filters.status;
            }

            const funcionarios = await FuncionarioCusto.findAll({
                where,
                order: [['createdAt', 'DESC']]
            });
            
            console.log(`✅ Encontrados ${funcionarios.length} funcionários`);
            return funcionarios;
            
        } catch (error) {
            console.error('❌ Erro no service getAll:', error.message);
            throw error;
        }
    }

    /**
     * Buscar funcionário por ID
     */
    async getById(id) {
        try {
            const funcionario = await FuncionarioCusto.findByPk(id);
            
            if (!funcionario) {
                throw new Error('Funcionário não encontrado');
            }
            
            return funcionario;
            
        } catch (error) {
            console.error('❌ Erro no service getById:', error.message);
            throw error;
        }
    }

    /**
     * Atualizar funcionário
     */
    async update(id, data) {
        try {
            const funcionario = await this.getById(id);
            
            // Verificar se CPF já existe (excluindo o próprio registro)
            if (data.cpf) {
                const existing = await FuncionarioCusto.findOne({ 
                    where: { 
                        cpf: data.cpf,
                        id: { [Op.ne]: id }
                    } 
                });
                if (existing) {
                    throw new Error('CPF já cadastrado para outro funcionário');
                }
            }
            
            await funcionario.update(data);
            console.log(`✅ Funcionário atualizado: ID ${id}`);
            return funcionario;
            
        } catch (error) {
            console.error('❌ Erro no service update:', error.message);
            throw error;
        }
    }

    /**
     * Remover funcionário
     */
    async delete(id) {
        try {
            const funcionario = await this.getById(id);
            await funcionario.destroy();
            console.log(`✅ Funcionário removido: ID ${id}`);
            return true;
            
        } catch (error) {
            console.error('❌ Erro no service delete:', error.message);
            throw error;
        }
    }
}

export default new FuncionarioCustoService();