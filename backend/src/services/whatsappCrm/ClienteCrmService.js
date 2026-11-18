import Cliente from '../../models/Cliente.js';
import WhatsappClienteCrm from '../../models/WhatsappClienteCrm.js';
import WhatsappClienteEtiqueta from '../../models/WhatsappClienteEtiqueta.js';
import WhatsappEtiqueta from '../../models/WhatsappEtiqueta.js';
import { calcularRfmDoCliente } from './RfmService.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';
import ApiError from '../../utils/apiError.js';
import catalogoService from './CatalogoService.js';

class ClienteCrmService {
    // Contrato principal que a futura extensão vai consumir: identifica o
    // cliente pelo telefone da conversa aberta e devolve RFM + CRM + etiquetas.
    async buscarPorTelefone(telefone, user) {
        const whereCliente = { telefone };
        aplicarEmpresaScope(whereCliente, user);

        const cliente = await Cliente.findOne({ where: whereCliente });
        if (!cliente) throw new ApiError(404, 'Cliente não encontrado para este telefone');

        return this._montarFicha(cliente, user);
    }

    async buscarPorClienteId(clienteId, user) {
        const whereCliente = { id: clienteId };
        aplicarEmpresaScope(whereCliente, user);

        const cliente = await Cliente.findOne({ where: whereCliente });
        if (!cliente) throw new ApiError(404, 'Cliente não encontrado');

        return this._montarFicha(cliente, user);
    }

    async _montarFicha(cliente, user) {
        const empresa_id = empresaParaGravar(user) ?? cliente.empresa_id;

        const [crm, rfm] = await Promise.all([
            this._obterOuCriarCrm(cliente.id, empresa_id),
            calcularRfmDoCliente(cliente.id, empresa_id),
        ]);

        const etiquetas = await WhatsappClienteEtiqueta.findAll({
            where: { cliente_crm_id: crm.id },
            include: [{ model: WhatsappEtiqueta, as: 'etiqueta' }],
            order: [['criado_em', 'DESC']],
        });

        return { cliente, crm, rfm, etiquetas };
    }

    async _obterOuCriarCrm(cliente_id, empresa_id) {
        const [crm] = await WhatsappClienteCrm.findOrCreate({
            where: { cliente_id },
            defaults: { cliente_id, empresa_id },
        });
        return crm;
    }

    async adicionarObservacao(clienteId, observacao, user) {
        const whereCliente = { id: clienteId };
        aplicarEmpresaScope(whereCliente, user);
        const cliente = await Cliente.findOne({ where: whereCliente });
        if (!cliente) throw new ApiError(404, 'Cliente não encontrado');

        const empresa_id = empresaParaGravar(user) ?? cliente.empresa_id;
        const crm = await this._obterOuCriarCrm(cliente.id, empresa_id);
        await crm.update({ observacoes: observacao });
        return crm;
    }

    async atualizarEstagio(clienteId, estagio, user) {
        const catalogo = await catalogoService.listar('estagio', user);
        if (!catalogo.some(item => item.chave === estagio)) throw new ApiError(400, `Estágio inválido: ${estagio}`);
        const whereCliente = { id: clienteId };
        aplicarEmpresaScope(whereCliente, user);
        const cliente = await Cliente.findOne({ where: whereCliente });
        if (!cliente) throw new ApiError(404, 'Cliente não encontrado');

        const empresa_id = empresaParaGravar(user) ?? cliente.empresa_id;
        const crm = await this._obterOuCriarCrm(cliente.id, empresa_id);
        await crm.update({ estagio });
        return crm;
    }

    async atualizarMotivoClinico(clienteId, motivoClinico, user) {
        if (motivoClinico) {
            const catalogo = await catalogoService.listar('motivo_clinico', user);
            if (!catalogo.some(item => item.chave === motivoClinico)) {
                throw new ApiError(400, `Assunto inválido: ${motivoClinico}`);
            }
        }
        const whereCliente = { id: clienteId };
        aplicarEmpresaScope(whereCliente, user);
        const cliente = await Cliente.findOne({ where: whereCliente });
        if (!cliente) throw new ApiError(404, 'Cliente não encontrado');

        const empresa_id = empresaParaGravar(user) ?? cliente.empresa_id;
        const crm = await this._obterOuCriarCrm(cliente.id, empresa_id);
        await crm.update({ motivo_clinico: motivoClinico });
        return crm;
    }

    async atualizarProfissional(clienteId, profissional, user) {
        // profissional aponta pra `chave` do catálogo tipo='profissional' (ou null pra desatribuir)
        if (profissional) {
            const catalogo = await catalogoService.listar('profissional', user);
            if (!catalogo.some(item => item.chave === profissional)) {
                throw new ApiError(400, `Profissional inválido: ${profissional}`);
            }
        }
        const whereCliente = { id: clienteId };
        aplicarEmpresaScope(whereCliente, user);
        const cliente = await Cliente.findOne({ where: whereCliente });
        if (!cliente) throw new ApiError(404, 'Cliente não encontrado');

        const empresa_id = empresaParaGravar(user) ?? cliente.empresa_id;
        const crm = await this._obterOuCriarCrm(cliente.id, empresa_id);
        await crm.update({ profissional: profissional || null });
        return crm;
    }

    async adicionarEtiqueta(clienteId, { etiqueta_id, sugerida_por_ia = false }, user) {
        const whereCliente = { id: clienteId };
        aplicarEmpresaScope(whereCliente, user);
        const cliente = await Cliente.findOne({ where: whereCliente });
        if (!cliente) throw new ApiError(404, 'Cliente não encontrado');

        const empresa_id = empresaParaGravar(user) ?? cliente.empresa_id;
        const crm = await this._obterOuCriarCrm(cliente.id, empresa_id);

        return WhatsappClienteEtiqueta.create({
            cliente_crm_id: crm.id,
            etiqueta_id,
            status: sugerida_por_ia ? 'sugerida' : 'aceita',
            sugerida_por_ia,
        });
    }
}

export default new ClienteCrmService();
