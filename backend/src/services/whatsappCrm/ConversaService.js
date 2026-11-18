import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import WhatsappConversa from '../../models/WhatsappConversa.js';
import WhatsappClienteCrm from '../../models/WhatsappClienteCrm.js';
import WhatsappClienteEtiqueta from '../../models/WhatsappClienteEtiqueta.js';
import Cliente from '../../models/Cliente.js';
import User from '../../models/UserModel.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';
import { variantesTelefone } from '../../utils/telefone.js';
import ApiError from '../../utils/apiError.js';

class ConversaService {
    async listar({ status, busca, estagio, motivo_clinico, profissional, etiqueta_id, responsavel_id } = {}, user) {
        const where = {};
        aplicarEmpresaScope(where, user);
        if (status && status !== 'todos') {
            if (status === 'nao_lidas') where.nao_lidas = { [Op.gt]: 0 };
            else where.status = status;
        }
        if (busca) {
            where[Op.or] = [
                { nome_contato: { [Op.iLike]: `%${busca}%` } },
                { telefone: { [Op.iLike]: `%${busca}%` } },
            ];
        }
        if (responsavel_id !== undefined && responsavel_id !== '' && responsavel_id !== null) {
            where.responsavel_id = responsavel_id === 'nenhum' ? null : responsavel_id;
        }

        const whatsappCrmWhere = {};
        if (estagio) whatsappCrmWhere.estagio = estagio;
        if (motivo_clinico) whatsappCrmWhere.motivo_clinico = motivo_clinico;
        if (profissional) whatsappCrmWhere.profissional = profissional;
        const filtrandoPorCrm = Object.keys(whatsappCrmWhere).length > 0;

        const whatsappCrmInclude = {
            model: WhatsappClienteCrm, as: 'whatsappCrm',
            ...(filtrandoPorCrm ? { where: whatsappCrmWhere, required: true } : {}),
        };
        if (etiqueta_id) {
            whatsappCrmInclude.include = [{
                model: WhatsappClienteEtiqueta, as: 'etiquetas',
                where: { etiqueta_id }, required: true,
            }];
        }

        const conversas = await WhatsappConversa.findAll({
            where,
            include: [
                { model: User, as: 'responsavel', attributes: ['id', 'nomeCompleto'] },
                {
                    model: Cliente, as: 'cliente', attributes: ['id', 'nomeCompleto', 'telefone'],
                    required: filtrandoPorCrm || !!etiqueta_id,
                    include: [whatsappCrmInclude],
                },
            ],
            order: [['ultima_mensagem_em', 'DESC']],
        });
        return conversas;
    }

    async buscarPorId(id, user) {
        const where = { id };
        aplicarEmpresaScope(where, user);
        const conversa = await WhatsappConversa.findOne({
            where,
            include: [
                { model: User, as: 'responsavel', attributes: ['id', 'nomeCompleto'] },
                {
                    model: Cliente, as: 'cliente',
                    include: [{ model: WhatsappClienteCrm, as: 'whatsappCrm' }],
                },
            ],
        });
        if (!conversa) throw new ApiError(404, 'Conversa não encontrada');
        return conversa;
    }

    async atualizarStatus(id, status, user) {
        const conversa = await this.buscarPorId(id, user);
        await conversa.update({ status });
        return conversa;
    }

    async atribuirResponsavel(id, responsavelId, user) {
        const conversa = await this.buscarPorId(id, user);
        await conversa.update({ responsavel_id: responsavelId });
        return conversa;
    }

    // "Modo monitoria": se um gestor (Dono/Gerente/Administrador ou MASTER)
    // abre a conversa de OUTRO atendente só pra auditar, não zeramos nao_lidas
    // — senão a conversa some da fila de "Não lidas" de quem é responsável de
    // verdade por ela. Quem já é o próprio responsável (ou não é gestor)
    // continua marcando como lida normalmente, sem nenhuma mudança de comportamento.
    async marcarComoLida(id, user) {
        const conversa = await this.buscarPorId(id, user);
        const ehGestor = user?.tipo === 'MASTER' || ['Dono', 'Gerente', 'Administrador'].includes(user?.cargo);
        const monitorandoConversaAlheia = ehGestor && conversa.responsavel_id && conversa.responsavel_id !== user?.id;
        if (monitorandoConversaAlheia) return conversa;
        await conversa.update({ nao_lidas: 0 });
        return conversa;
    }

    // Renomeia o contato (ex: WhatsApp trouxe um apelido/emoji como nome).
    // Também atualiza o Cliente vinculado, pra não deixar o nome divergente
    // entre a conversa e a ficha do paciente.
    async renomearContato(id, nomeContato, user) {
        if (!nomeContato || !nomeContato.trim()) throw new ApiError(400, 'Informe um nome válido');
        const conversa = await this.buscarPorId(id, user);
        await conversa.update({ nome_contato: nomeContato.trim(), nome_editado_manualmente: true });
        if (conversa.cliente_id) {
            await Cliente.update({ nomeCompleto: nomeContato.trim() }, { where: { id: conversa.cliente_id } });
        }
        return this.buscarPorId(id, user);
    }

    // Inicia uma conversa por fora de um webhook (o atendente puxa o primeiro
    // contato) — a partir de um cliente já cadastrado ou de telefone/nome
    // novos. Reaproveita a mesma resolução de Cliente/CRM do WebhookService,
    // e nunca duplica conversa pro mesmo telefone (findOrCreate por telefone).
    async iniciarConversa({ cliente_id, telefone, nome_contato }, user) {
        const empresa_id = empresaParaGravar(user);
        if (!empresa_id) throw new ApiError(400, 'Usuário sem empresa associada');

        const t = await sequelize.transaction();
        try {
            let cliente;
            if (cliente_id) {
                const whereCliente = { id: cliente_id };
                aplicarEmpresaScope(whereCliente, user);
                cliente = await Cliente.findOne({ where: whereCliente, transaction: t });
                if (!cliente) throw new ApiError(404, 'Cliente não encontrado');
            } else {
                const telefoneLimpo = (telefone || '').replace(/\D/g, '');
                if (!telefoneLimpo) throw new ApiError(400, 'Informe um telefone válido ou selecione um cliente');
                // Busca por qualquer variante conhecida (com/sem o "9" do celular) antes de
                // criar — evita duplicar cliente/conversa quando o número já existe só que
                // digitado num formato ligeiramente diferente do que está salvo.
                cliente = await Cliente.findOne({
                    where: { telefone: { [Op.in]: variantesTelefone(telefoneLimpo) }, empresa_id },
                    transaction: t,
                });
                if (!cliente) {
                    cliente = await Cliente.create({
                        telefone: telefoneLimpo, nomeCompleto: nome_contato || telefoneLimpo, empresa_id,
                    }, { transaction: t });
                }
            }

            await WhatsappClienteCrm.findOrCreate({
                where: { cliente_id: cliente.id },
                defaults: { cliente_id: cliente.id, empresa_id, estagio: 'novo_lead' },
                transaction: t,
            });

            let conversa = await WhatsappConversa.findOne({
                where: { telefone: { [Op.in]: variantesTelefone(cliente.telefone) }, empresa_id },
                transaction: t,
            });
            if (!conversa) {
                conversa = await WhatsappConversa.create({
                    empresa_id, cliente_id: cliente.id, telefone: cliente.telefone,
                    nome_contato: nome_contato || cliente.nomeCompleto, status: 'aberta',
                }, { transaction: t });
            } else if (!conversa.cliente_id) {
                await conversa.update({ cliente_id: cliente.id }, { transaction: t });
            }

            await t.commit();
            return this.buscarPorId(conversa.id, user);
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }
}

export default new ConversaService();
