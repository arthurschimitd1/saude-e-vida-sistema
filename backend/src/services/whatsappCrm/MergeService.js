import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import Cliente from '../../models/Cliente.js';
import WhatsappConversa from '../../models/WhatsappConversa.js';
import WhatsappMensagem from '../../models/WhatsappMensagem.js';
import WhatsappMergeCandidato from '../../models/WhatsappMergeCandidato.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../../utils/empresaScope.js';
import ApiError from '../../utils/apiError.js';
import identificadorService, { ehLid } from './IdentificadorService.js';
import logService from './LogService.js';

// MERGE NA TELA (opção B aprovada pelo Iago). Quando um evento @lid puro não
// casa com segurança, o sistema NÃO junta automático — registra um "candidato"
// (palpite) e mostra na tela pro atendente confirmar. Zero risco de fundir
// paciente errado. Ver DIAGNOSTICO-duplicacao-chamada-e-match.md §3.

class MergeService {
    // Registra (idempotente) um palpite "origem (@lid) pode ser a mesma pessoa
    // da conversa alvo (número real)". Chamado pelo WebhookService quando não
    // conseguiu casar automático. Não repete par já pendente/descartado.
    async registrarCandidato({ empresa_id, conversa_origem_id, conversa_alvo_id, motivo }, transaction) {
        if (!conversa_origem_id || !conversa_alvo_id || conversa_origem_id === conversa_alvo_id) return null;

        const jaExiste = await WhatsappMergeCandidato.findOne({
            where: { empresa_id, conversa_origem_id, conversa_alvo_id },
            transaction,
        });
        if (jaExiste) return jaExiste; // já sugerido (pendente) ou já resolvido — não duplica

        return WhatsappMergeCandidato.create(
            { empresa_id, conversa_origem_id, conversa_alvo_id, motivo, status: 'pendente' },
            { transaction }
        );
    }

    // Lista os palpites pendentes com as duas pontas (origem/alvo) pra a tela
    // montar o banner "estes dois são a mesma pessoa? juntar".
    async listarPendentes(user) {
        const where = { status: 'pendente' };
        aplicarEmpresaScope(where, user);
        return WhatsappMergeCandidato.findAll({
            where,
            include: [
                { model: WhatsappConversa, as: 'conversaOrigem', attributes: ['id', 'nome_contato', 'telefone', 'ultima_mensagem_preview', 'ultima_mensagem_em'] },
                { model: WhatsappConversa, as: 'conversaAlvo', attributes: ['id', 'nome_contato', 'telefone', 'ultima_mensagem_preview', 'ultima_mensagem_em'] },
            ],
            order: [['criado_em', 'DESC']],
        });
    }

    // MOTOR GENÉRICO de junção (usado pelo automático E pelo manual). Funde a
    // conversa `origem` na conversa `alvo` (alvo é a que FICA), dentro de uma
    // transação já aberta:
    // (1) reamarra o identificador da origem (@lid OU número) ao Cliente do alvo
    //     (confirmado=true) → dali pra frente todo evento por aquele identificador
    //     cai na conversa certa;
    // (2) move as mensagens da origem pra conversa alvo (reparent — a ordem se
    //     preserva porque as mensagens guardam o próprio criado_em);
    // (3) o alvo herda não-lidas + preview mais recente da origem;
    // (4) descarta candidatos pendentes que apontem pra origem e apaga a origem.
    // Pré-condição: alvo.cliente_id preenchido (quem chama garante isso).
    async _fundir(origem, alvo, t) {
        // (1a) se a origem tinha um Cliente PRÓPRIO (diferente do alvo), migra
        // TODAS as âncoras dele pro Cliente do alvo — senão o identificador antigo
        // ficaria apontando pro cliente da origem e um evento futuro cairia no
        // cliente errado (achado do QA 2026-07-12). Só acontece no merge manual de
        // duas conversas que já tinham cliente cada.
        if (origem.cliente_id && origem.cliente_id !== alvo.cliente_id) {
            await identificadorService.reamarrarIdentificadores(
                { empresa_id: alvo.empresa_id, cliente_origem_id: origem.cliente_id, cliente_alvo_id: alvo.cliente_id },
                t
            );
        }

        // (1b) reamarra o identificador da CONVERSA origem ao Cliente do alvo. O
        // telefone da órfã pode ser um @lid puro (caso automático) ou um número
        // real (manual). Cobre o caso em que a origem NÃO tinha cliente próprio.
        const tipoIdent = ehLid(origem.telefone) ? 'lid' : 'numero';
        await identificadorService.amarrar(
            { empresa_id: alvo.empresa_id, cliente_id: alvo.cliente_id, tipo: tipoIdent, valor: origem.telefone, confirmado: true },
            t
        );

        // (2) move as mensagens da origem pra conversa alvo.
        await WhatsappMensagem.update(
            { conversa_id: alvo.id },
            { where: { conversa_id: origem.id }, transaction: t }
        );

        // (3) alvo herda o "não lidas" da origem e o preview mais recente, se a
        // origem for a que tem a última mensagem.
        const camposAlvo = { nao_lidas: alvo.nao_lidas + origem.nao_lidas };
        if (origem.resposta_agendamento_em && (!alvo.resposta_agendamento_em || origem.resposta_agendamento_em > alvo.resposta_agendamento_em)) {
            camposAlvo.resposta_agendamento_em = origem.resposta_agendamento_em;
        }
        if (origem.ultima_mensagem_em && (!alvo.ultima_mensagem_em || origem.ultima_mensagem_em > alvo.ultima_mensagem_em)) {
            camposAlvo.ultima_mensagem_preview = origem.ultima_mensagem_preview;
            camposAlvo.ultima_mensagem_em = origem.ultima_mensagem_em;
            camposAlvo.ultima_mensagem_direcao = origem.ultima_mensagem_direcao;
        }
        await alvo.update(camposAlvo, { transaction: t });

        // (4) descarta candidatos pendentes que apontem pra origem (somem da tela)
        // e apaga a conversa órfã.
        await WhatsappMergeCandidato.update(
            { status: 'descartado' },
            {
                where: {
                    empresa_id: alvo.empresa_id,
                    status: 'pendente',
                    [Op.or]: [{ conversa_origem_id: origem.id }, { conversa_alvo_id: origem.id }],
                },
                transaction: t,
            }
        );
        await origem.destroy({ transaction: t });

        return { conversaId: alvo.id };
    }

    // Atendente clicou "juntar" num PALPITE do sistema (automático). Valida o
    // candidato e delega a fusão ao motor genérico. A órfã (@lid) é a origem, a
    // conversa de número real é o alvo — mantido do comportamento original.
    async confirmar(candidatoId, user) {
        const empresa_id = empresaParaGravar(user);
        const t = await sequelize.transaction();
        try {
            const where = { id: candidatoId };
            aplicarEmpresaScope(where, user);
            const candidato = await WhatsappMergeCandidato.findOne({ where, transaction: t });
            if (!candidato) throw new ApiError(404, 'Sugestão de junção não encontrada');
            if (candidato.status !== 'pendente') throw new ApiError(409, 'Essa sugestão já foi resolvida');

            const [origem, alvo] = await Promise.all([
                WhatsappConversa.findByPk(candidato.conversa_origem_id, { transaction: t }),
                WhatsappConversa.findByPk(candidato.conversa_alvo_id, { transaction: t }),
            ]);
            if (!origem || !alvo) throw new ApiError(404, 'Conversa da junção não existe mais');
            if (!alvo.cliente_id) throw new ApiError(409, 'A conversa alvo ainda não tem cliente vinculado');

            const res = await this._fundir(origem, alvo, t);
            await candidato.update({ status: 'confirmado' }, { transaction: t });

            await t.commit();

            await logService.registrar(
                { tipo: 'merge_confirmado', mensagem: `Conversa ${origem.id} juntada em ${alvo.id}`, conversa_id: alvo.id, metadata: { candidatoId } },
                { tipo: 'EMPRESA', empresa_id }
            ).catch(() => {});

            return res;
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    // Atendente escolheu DUAS conversas na mão ("são a mesma pessoa, junta") —
    // sem depender de palpite do sistema. Regra do produto (Lucas): a conversa
    // MAIS ANTIGA vira a principal (costuma ter o histórico + a ficha do paciente
    // preenchida). Valida same-empresa (não deixa cruzar empresas) e delega ao
    // motor genérico. Se só a mais nova tem paciente vinculado, o principal herda
    // esse Cliente antes de fundir (senão a fusão não teria a quem ancorar).
    async fundirManual(conversaAId, conversaBId, user) {
        const empresa_id = empresaParaGravar(user);
        if (!conversaAId || !conversaBId || String(conversaAId) === String(conversaBId)) {
            throw new ApiError(400, 'Escolha duas conversas diferentes para juntar');
        }
        const t = await sequelize.transaction();
        try {
            const scope = {};
            aplicarEmpresaScope(scope, user);
            const [a, b] = await Promise.all([
                WhatsappConversa.findOne({ where: { id: conversaAId, ...scope }, transaction: t }),
                WhatsappConversa.findOne({ where: { id: conversaBId, ...scope }, transaction: t }),
            ]);
            if (!a || !b) throw new ApiError(404, 'Conversa não encontrada');
            // same-empresa: as duas TÊM que ser da mesma empresa (segurança).
            if (a.empresa_id !== b.empresa_id) {
                throw new ApiError(403, 'Não é possível juntar contatos de empresas diferentes');
            }

            // A MAIS ANTIGA (menor criado_em) fica como principal = alvo.
            const [alvo, origem] = (a.criado_em <= b.criado_em) ? [a, b] : [b, a];

            // O alvo precisa de um Cliente pra ancorar os identificadores. Se o
            // alvo (mais antigo) não tem mas a origem tem, o alvo herda o Cliente
            // da origem. Se nenhum tem, a fusão junta as conversas/mensagens mas
            // não cria vínculo de identificador (não há paciente pra amarrar).
            if (!alvo.cliente_id && origem.cliente_id) {
                await alvo.update({ cliente_id: origem.cliente_id }, { transaction: t });
            }

            let res;
            if (alvo.cliente_id) {
                res = await this._fundir(origem, alvo, t);
            } else {
                // Sem paciente em nenhuma: só junta mensagens + apaga a órfã, sem
                // reamarrar identificador (não há Cliente destino).
                await WhatsappMensagem.update({ conversa_id: alvo.id }, { where: { conversa_id: origem.id }, transaction: t });
                const campos = { nao_lidas: alvo.nao_lidas + origem.nao_lidas };
                if (origem.resposta_agendamento_em && (!alvo.resposta_agendamento_em || origem.resposta_agendamento_em > alvo.resposta_agendamento_em)) {
                    campos.resposta_agendamento_em = origem.resposta_agendamento_em;
                }
                if (origem.ultima_mensagem_em && (!alvo.ultima_mensagem_em || origem.ultima_mensagem_em > alvo.ultima_mensagem_em)) {
                    campos.ultima_mensagem_preview = origem.ultima_mensagem_preview;
                    campos.ultima_mensagem_em = origem.ultima_mensagem_em;
                    campos.ultima_mensagem_direcao = origem.ultima_mensagem_direcao;
                }
                await alvo.update(campos, { transaction: t });
                await WhatsappMergeCandidato.update(
                    { status: 'descartado' },
                    { where: { empresa_id: alvo.empresa_id, status: 'pendente', [Op.or]: [{ conversa_origem_id: origem.id }, { conversa_alvo_id: origem.id }] }, transaction: t }
                );
                await origem.destroy({ transaction: t });
                res = { conversaId: alvo.id };
            }

            await t.commit();

            await logService.registrar(
                { tipo: 'merge_manual', mensagem: `Junção manual: conversa ${origem.id} juntada em ${alvo.id}`, conversa_id: alvo.id, metadata: { origem: origem.id, alvo: alvo.id } },
                { tipo: 'EMPRESA', empresa_id }
            ).catch(() => {});

            return res;
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    // Busca conversas por nome ou telefone pra a telinha de "juntar contato".
    // Exclui a própria conversa de origem. Só da empresa do atendente.
    async buscarContatos(q, user, excluirId) {
        const termo = (q || '').trim();
        if (termo.length < 2) return [];
        const where = {
            [Op.or]: [
                { nome_contato: { [Op.iLike]: `%${termo}%` } },
                { telefone: { [Op.iLike]: `%${termo.replace(/\D/g, '') || termo}%` } },
            ],
        };
        aplicarEmpresaScope(where, user);
        if (excluirId) where.id = { [Op.ne]: excluirId };
        return WhatsappConversa.findAll({
            where,
            attributes: ['id', 'nome_contato', 'telefone', 'cliente_id', 'ultima_mensagem_preview', 'ultima_mensagem_em', 'criado_em'],
            order: [[sequelize.literal('ultima_mensagem_em DESC NULLS LAST')]],
            limit: 12,
        });
    }

    // Atendente clicou "não é a mesma pessoa". Só marca o candidato como
    // descartado — nunca mais sugere esse par (a unique cuida disso).
    async descartar(candidatoId, user) {
        const where = { id: candidatoId };
        aplicarEmpresaScope(where, user);
        const candidato = await WhatsappMergeCandidato.findOne({ where });
        if (!candidato) throw new ApiError(404, 'Sugestão de junção não encontrada');
        if (candidato.status === 'pendente') await candidato.update({ status: 'descartado' });
        return { ok: true };
    }
}

export default new MergeService();
