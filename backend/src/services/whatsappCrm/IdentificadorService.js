import { Op } from 'sequelize';
import Cliente from '../../models/Cliente.js';
import WhatsappContatoIdentificador from '../../models/WhatsappContatoIdentificador.js';
import { variantesTelefone } from '../../utils/telefone.js';

// Serviço de MATCH por identificador — o miolo aprovado (opção B, ClickUp 86e27yv74).
//
// Hoje o CRM casa contato só por número de telefone. Isso quebra sempre que o
// evento entra por outra "porta": um @lid privado (msg do celular OU chamada) ou
// um callId. Aqui a gente agrega N identificadores por Cliente e resolve o
// Cliente por QUALQUER um deles. Ver DIAGNOSTICO-duplicacao-chamada-e-match.md.

// Um `phone` da Z-API pode ser: número real ("5583996464513"), um @lid privado
// ("65575661383689@lid") ou (fora do phone) um callId. Classifica pra saber como
// tratar. @lid NÃO é conversível em número (privacidade do WhatsApp) — por isso
// vira uma âncora própria de tipo 'lid'.
export function ehLid(valor) {
    return typeof valor === 'string' && /@lid$/i.test(valor.trim());
}

// Normaliza o valor de uma âncora pro que a gente guarda/compara:
// - lid: o @lid cru em minúsculo (é estável, é a própria chave)
// - numero: só os dígitos (mesma regra do variantesTelefone)
// - callId: o id cru (Z-API já manda estável)
export function normalizarValor(tipo, valorBruto) {
    const v = (valorBruto || '').toString().trim();
    if (tipo === 'lid') return v.toLowerCase();
    if (tipo === 'numero') return v.replace(/\D/g, '');
    return v; // callId
}

class IdentificadorService {
    // Descobre o TIPO de identificador a partir do phone da Z-API.
    tipoDoPhone(phone) {
        return ehLid(phone) ? 'lid' : 'numero';
    }

    // Acha o Cliente ancorado por um identificador (número/@lid/callId), dentro
    // de uma transação. Pra número, casa por qualquer variante (com/sem o "9").
    // Retorna o Cliente ou null. Só usa âncoras CONFIRMADAS pra casar automático.
    async acharClientePorIdentificador({ empresa_id, tipo, valor }, transaction) {
        const valores = tipo === 'numero'
            ? variantesTelefone(valor)
            : [normalizarValor(tipo, valor)];
        if (!valores.length || !valores[0]) return null;

        const ident = await WhatsappContatoIdentificador.findOne({
            where: { empresa_id, tipo, valor: { [Op.in]: valores }, confirmado: true },
            transaction,
        });
        if (!ident) return null;
        return Cliente.findOne({ where: { id: ident.cliente_id, empresa_id }, transaction });
    }

    // Amarra um identificador a um Cliente (idempotente). confirmado=true quer
    // dizer "esta âncora é fonte de match daqui pra frente". Usa a unique
    // (empresa_id,tipo,valor) — se já existe, garante o vínculo/confirmação.
    async amarrar({ empresa_id, cliente_id, tipo, valor, confirmado = true }, transaction) {
        const valorNorm = normalizarValor(tipo, valor);
        if (!valorNorm) return null;

        const [ident, criado] = await WhatsappContatoIdentificador.findOrCreate({
            where: { empresa_id, tipo, valor: valorNorm },
            defaults: { empresa_id, cliente_id, tipo, valor: valorNorm, confirmado },
            transaction,
        });
        // Se já existia apontando pro mesmo cliente mas sem confirmação, confirma.
        if (!criado && ident.cliente_id === cliente_id && confirmado && !ident.confirmado) {
            await ident.update({ confirmado: true }, { transaction });
        }
        return ident;
    }

    // MERGE de dois clientes: reaponta TODOS os identificadores do cliente de
    // ORIGEM pro cliente ALVO (usado quando o atendente funde duas conversas que
    // já tinham cliente cada — sem isso o identificador antigo continuaria
    // apontando pro cliente da origem, e um evento futuro cairia no cliente
    // errado). Idempotente: se o alvo já tem uma âncora igual (mesmo tipo+valor),
    // a duplicada da origem é removida (a unique não deixa as duas coexistirem).
    async reamarrarIdentificadores({ empresa_id, cliente_origem_id, cliente_alvo_id }, transaction) {
        if (!cliente_origem_id || !cliente_alvo_id || cliente_origem_id === cliente_alvo_id) return;
        const daOrigem = await WhatsappContatoIdentificador.findAll({
            where: { empresa_id, cliente_id: cliente_origem_id },
            transaction,
        });
        for (const ident of daOrigem) {
            const jaNoAlvo = await WhatsappContatoIdentificador.findOne({
                where: { empresa_id, tipo: ident.tipo, valor: ident.valor, cliente_id: cliente_alvo_id },
                transaction,
            });
            if (jaNoAlvo) {
                // o alvo já tem essa âncora — a da origem é redundante, apaga.
                await ident.destroy({ transaction });
            } else {
                await ident.update({ cliente_id: cliente_alvo_id }, { transaction });
            }
        }
    }

    // Conveniência: garante a âncora 'numero' confirmada de um Cliente que
    // acabou de ser criado/achado por telefone (mantém o acervo coerente).
    async garantirAncoraNumero({ empresa_id, cliente_id, telefone }, transaction) {
        const digits = normalizarValor('numero', telefone);
        if (!digits) return null;
        return this.amarrar({ empresa_id, cliente_id, tipo: 'numero', valor: digits, confirmado: true }, transaction);
    }
}

export default new IdentificadorService();
