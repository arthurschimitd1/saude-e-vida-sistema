import Cliente from '../models/Cliente.js';
import { Op } from 'sequelize';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';
import FocusMunicipioService from './focus/FocusMunicipioService.js';
import { variantesTelefone } from '../utils/telefone.js';
import sequelize from '../config/database.js';

const somenteDigitos = valor => String(valor ?? '').replace(/\D/g, '');

export const construirFiltroClienteExistente = (clienteData, empresaId) => {
    const identificadores = [];
    const cpf = somenteDigitos(clienteData?.cpf);
    const cnpj = somenteDigitos(clienteData?.cnpj);
    const telefones = variantesTelefone(clienteData?.telefone);

    if (cpf) identificadores.push(sequelize.where(
        sequelize.fn('regexp_replace', sequelize.col('cpf'), '\\D', '', 'g'),
        cpf
    ));
    if (cnpj) identificadores.push(sequelize.where(
        sequelize.fn('regexp_replace', sequelize.col('cnpj'), '\\D', '', 'g'),
        cnpj
    ));
    if (telefones.length) identificadores.push(sequelize.where(
        sequelize.fn('regexp_replace', sequelize.col('telefone'), '\\D', '', 'g'),
        { [Op.in]: telefones }
    ));

    if (!identificadores.length) return null;
    return { empresa_id: Number(empresaId), [Op.or]: identificadores };
};

class ClienteService {
    async createCliente(clienteData, user) {
        try {
            const empresa = Number(empresaParaGravar(user) ?? clienteData.empresa_id);
            if (!Number.isInteger(empresa) || empresa <= 0) {
                const error = new Error('Selecione uma empresa para cadastrar o cliente');
                error.status = 400;
                throw error;
            }

            const filtroExistente = construirFiltroClienteExistente(clienteData, empresa);
            if (filtroExistente) {
                const clienteExistente = await Cliente.findOne({ where: filtroExistente });
                if (clienteExistente) {
                    const error = new Error('Este cliente já está cadastrado nesta empresa');
                    error.status = 409;
                    throw error;
                }
            }

            let codigoMunicipio = null;

            if (clienteData.cidade && clienteData.estado) {
                try {
                    codigoMunicipio =
                        await FocusMunicipioService.buscarCodigoMunicipio(
                            clienteData.cidade,
                            clienteData.estado
                        );
                } catch (focusError) {
                    console.error('Falha ao buscar código do município na Focus:', {
                        message: focusError.message,
                        status: focusError.response?.status,
                        data: focusError.response?.data
                    });
                }
            }

            return await Cliente.create({
                ...clienteData,
                empresa_id: empresa,
                codigo_municipio: codigoMunicipio
            });
        } catch (error) {
            if (error.status) throw error;
            console.error('Erro ao criar cliente:', error.message);
            throw new Error(`Erro ao criar cliente: ${error.message}`);
        }
}

    async getAllClientes(filters = {}, user) {
        try {
            const where = {};

            if (filters.bairro) {
                where.bairro = {
                    [Op.like]: `%${filters.bairro}%`
                };
            }

            aplicarEmpresaScope(where, user);

            return await Cliente.findAll({ where });
        } catch (error) {
            throw new Error(`Erro ao buscar clientes: ${error.message}`);
        }
    }

    async getClienteById(id, user) {
        try {
            const where = { id };

            aplicarEmpresaScope(where, user);

            const cliente = await Cliente.findOne({ where });

            if (!cliente) {
                throw new Error('Cliente não encontrado');
            }

            return cliente;
        } catch (error) {
            throw new Error(`Erro ao buscar cliente: ${error.message}`);
        }
    }

    async updateCliente(id, clienteData, user) {
        try {
            const where = { id };

            aplicarEmpresaScope(where, user);

            const cliente = await Cliente.findOne({ where });

            if (!cliente) {
                throw new Error('Cliente não encontrado');
            }

            const cidade = clienteData.cidade ?? cliente.cidade;
            const estado = clienteData.estado ?? cliente.estado;

            const enderecoMunicipalAlterado =
                cidade !== cliente.cidade ||
                estado !== cliente.estado;

            let codigoMunicipio = cliente.codigo_municipio;

            if (
                (enderecoMunicipalAlterado || !codigoMunicipio) &&
                cidade &&
                estado
            ) {
                try {
                    codigoMunicipio =
                        await FocusMunicipioService.buscarCodigoMunicipio(
                            cidade,
                            estado
                        );
                } catch (focusError) {
                    console.error('Falha ao atualizar código do município na Focus:', {
                        message: focusError.message,
                        status: focusError.response?.status,
                        data: focusError.response?.data
                    });

                    // Mantém o código anterior, caso já exista
                    codigoMunicipio = cliente.codigo_municipio || null;
                }
            }

            await cliente.update({
                ...clienteData,
                codigo_municipio: codigoMunicipio
            });

            return cliente;
        } catch (error) {
            throw new Error(`Erro ao atualizar cliente: ${error.message}`);
        }
    }

    async deleteCliente(id, user) {
        try {
            const where = { id };

            aplicarEmpresaScope(where, user);

            const deleted = await Cliente.destroy({ where });

            if (!deleted) {
                throw new Error('Cliente não encontrado');
            }

            return { success: true };
        } catch (error) {
            throw new Error(`Erro ao deletar cliente: ${error.message}`);
        }
    }
}

export default new ClienteService();
