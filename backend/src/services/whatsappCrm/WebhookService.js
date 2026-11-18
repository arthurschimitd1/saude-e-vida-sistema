import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import Cliente from '../../models/Cliente.js';
import WhatsappClienteCrm from '../../models/WhatsappClienteCrm.js';
import WhatsappConversa from '../../models/WhatsappConversa.js';
import WhatsappMensagem from '../../models/WhatsappMensagem.js';
import { variantesTelefone } from '../../utils/telefone.js';
import logService from './LogService.js';
import identificadorService, { ehLid, normalizarValor } from './IdentificadorService.js';
import mergeService from './MergeService.js';
import autoRespostaAgendamentoService from './AutoRespostaAgendamentoService.js';

// Mapeia o payload da Z-API (ver developer.z-api.io/webhooks) pro nosso
// formato interno de mensagem. Um único campo (text/image/document/audio)
// vem preenchido por vez, dependendo do tipo de conteúdo recebido.
function extrairConteudo(payload) {
    // CHAMADA (voz/vídeo perdida): não tem campo de conteúdo, o tipo vem no
    // `notification`. Antes virava "[mensagem não suportada]" e cada ligação
    // criava conversa nova (o @lid não casava). Agora é reconhecida como evento
    // de chamada e roteada por identificador (ver processarMensagemRecebida).
    if (/^CALL_/.test(payload.notification || '')) {
        const video = /VIDEO/.test(payload.notification) || payload.isVideo;
        return { tipo: 'chamada', conteudo_texto: video ? '📞 Chamada de vídeo perdida' : '📞 Chamada de voz perdida', midia_url: null, midia_mime: null, midia_nome: null };
    }
    if (payload.text) return { tipo: 'texto', conteudo_texto: payload.text.message, midia_url: null, midia_mime: null, midia_nome: null };
    if (payload.image) return { tipo: 'imagem', conteudo_texto: payload.image.caption || null, midia_url: payload.image.imageUrl, midia_mime: payload.image.mimeType, midia_nome: null };
    if (payload.document) return { tipo: 'documento', conteudo_texto: null, midia_url: payload.document.documentUrl, midia_mime: payload.document.mimeType, midia_nome: payload.document.fileName };
    if (payload.audio) return { tipo: 'audio', conteudo_texto: null, midia_url: payload.audio.audioUrl, midia_mime: payload.audio.mimeType, midia_nome: null };
    // Tipos que a Z-API também entrega e antes viravam "[mensagem não suportada]".
    // Cada um leva um rótulo-texto próprio (emoji + [tipo]) pra NUNCA ficar bolha
    // vazia nem "não suportada" feio: o front só renderiza mídia pra imagem/doc/áudio,
    // então vídeo/figurinha precisam de um preview textual de fallback.
    if (payload.video) return { tipo: 'video', conteudo_texto: payload.video.caption || '🎬 [vídeo]', midia_url: payload.video.videoUrl, midia_mime: payload.video.mimeType, midia_nome: null };
    if (payload.sticker) return { tipo: 'figurinha', conteudo_texto: '🎨 [figurinha]', midia_url: payload.sticker.stickerUrl, midia_mime: payload.sticker.mimeType, midia_nome: null };
    if (payload.location) {
        const l = payload.location;
        const rotulo = l.name || l.address || (l.latitude != null ? `${l.latitude}, ${l.longitude}` : 'localização');
        return { tipo: 'localizacao', conteudo_texto: `📍 ${rotulo}`, midia_url: null, midia_mime: null, midia_nome: null };
    }
    if (payload.contact || payload.contacts) {
        const c = payload.contact || (Array.isArray(payload.contacts) ? payload.contacts[0] : payload.contacts);
        return { tipo: 'contato', conteudo_texto: `👤 ${c?.displayName || c?.name || 'Contato compartilhado'}`, midia_url: null, midia_mime: null, midia_nome: null };
    }
    // Fallback digno pra qualquer tipo que a Z-API mande e a gente ainda não mapeou
    // (enquete, botão, produto, etc.) — melhor "mensagem de mídia" do que "não suportada".
    return { tipo: 'texto', conteudo_texto: '📎 [mensagem de mídia]', midia_url: null, midia_mime: null, midia_nome: null };
}

const STATUS_ZAPI_PARA_INTERNO = {
    SENT: 'enviada',
    RECEIVED: 'entregue',
    READ: 'lida',
    READ_BY_ME: 'lida',
    PLAYED: 'lida',
};

export class WebhookService {
    async processarMensagemRecebida(empresaId, payload) {
        if (payload.isGroup) return { ignorado: 'grupo não suportado na v1' };
        // Canais/Newsletters e listas de transmissão não são atendimento 1:1 —
        // a Z-API entrega figurinha/post de canal pela mesma URL e isso criava
        // "cliente/conversa" lixo (ex.: canal de figurinhas) no CRM.
        if (payload.isNewsletter) return { ignorado: 'newsletter/canal não é atendimento' };
        if (payload.broadcast) return { ignorado: 'lista de transmissão ignorada' };

        const telefone = payload.phone;
        if (!telefone || /@(newsletter|broadcast|g\.us)$/.test(telefone)) {
            return { ignorado: 'telefone ausente ou não-individual' };
        }
        const fromMe = !!payload.fromMe;
        const ehChamada = /^CALL_/.test(payload.notification || '');
        // O `phone` da Z-API pode ser o número real OU um @lid privado (msg do
        // celular OU chamada). São "portas" diferentes do MESMO paciente — por
        // isso o match agora é por IDENTIFICADOR, não só por telefone.
        const tipoIdent = identificadorService.tipoDoPhone(telefone);

        // Nome do CONTATO (não de quem enviou). Em mensagem fromMe o senderName é
        // o próprio atendente, então o nome do contato vem do chatName. Nos demais
        // casos, senderName é o contato. Telefone é o último recurso.
        const nomeContato = fromMe
            ? (payload.chatName || telefone || 'Contato').trim() || telefone
            : (payload.senderName || payload.chatName || telefone || 'Contato').trim() || telefone;
        const conteudo = extrairConteudo(payload);

        // A Z-API pode reenviar o mesmo evento mais de uma vez. Como o ID da
        // mensagem é único por empresa, encerra cedo antes de criar/alterar
        // cliente, conversa ou contadores novamente.
        const mensagemExistente = await this._acharMensagemJaProcessada(empresaId, payload.messageId);
        if (mensagemExistente) {
            return {
                conversaId: mensagemExistente.conversa_id,
                mensagemId: mensagemExistente.id,
                duplicada: true,
            };
        }

        const t = await sequelize.transaction();
        try {
            // ── MATCH POR IDENTIFICADOR ──────────────────────────────────────
            // 1) tenta casar por âncora confirmada (número via variantes, @lid ou callId).
            let cliente = await identificadorService.acharClientePorIdentificador(
                { empresa_id: empresaId, tipo: tipoIdent, valor: telefone },
                t
            );
            // 2) fallback: acervo antigo pode não ter âncora ainda — pra número,
            //    casa pela coluna telefone do Cliente (retrocompatível). Ao achar,
            //    a âncora 'numero' é garantida logo abaixo.
            if (!cliente && tipoIdent === 'numero') {
                cliente = await Cliente.findOne({
                    where: { telefone: { [Op.in]: variantesTelefone(telefone) }, empresa_id: empresaId },
                    transaction: t,
                });
            }

            // ── @LID QUE NÃO CASOU: não fragmenta + oferece merge na tela ─────
            // Se é @lid e não achou o paciente, NÃO criamos um Cliente novo por
            // número (o @lid não é número). Mantemos UMA conversa própria pro
            // @lid (não multiplica — era a "7 Ruth numa hora") e registramos um
            // palpite de junção pro atendente confirmar (opção B).
            if (!cliente && tipoIdent === 'lid') {
                const resultado = await this._registrarEventoLidOrfao(empresaId, telefone, nomeContato, conteudo, fromMe, payload, t);
                await t.commit();

                await this._logWebhook(empresaId, resultado.conversaId, telefone, fromMe, payload);
                if (!resultado.duplicada) {
                    await this._processarAutoRespostaAgendamento({
                        empresaId,
                        conversaId: resultado.conversaId,
                        texto: conteudo.tipo === 'texto' ? conteudo.conteudo_texto : null,
                        fromMe,
                    });
                }
                return resultado;
            }

            // ── Número (ou @lid já vinculado a um Cliente) ───────────────────
            if (!cliente) {
                // Só cria Cliente novo pra número real (não pra @lid puro).
                cliente = await Cliente.create({ telefone, nomeCompleto: nomeContato, empresa_id: empresaId }, { transaction: t });
            }
            // Garante a âncora do identificador que trouxe o evento (número OU o
            // @lid já vinculado) — dali pra frente casa direto por ela.
            await identificadorService.amarrar(
                { empresa_id: empresaId, cliente_id: cliente.id, tipo: tipoIdent, valor: telefone, confirmado: true },
                t
            );
            // E, se o Cliente tem número salvo, garante também a âncora 'numero'
            // (cobre o acervo antigo achado pelo fallback da coluna telefone).
            if (cliente.telefone && !ehLid(cliente.telefone)) {
                await identificadorService.garantirAncoraNumero(
                    { empresa_id: empresaId, cliente_id: cliente.id, telefone: cliente.telefone }, t
                );
            }

            await WhatsappClienteCrm.findOrCreate({
                where: { cliente_id: cliente.id },
                defaults: { cliente_id: cliente.id, empresa_id: empresaId, estagio: 'novo_lead' },
                transaction: t,
            });

            // A conversa é resolvida pelo CLIENTE (não só pelo telefone) — assim
            // um @lid já vinculado cai na conversa do número, sem duplicar.
            let conversa = await this._acharConversaDoCliente(empresaId, cliente.id, telefone, t);
            if (!conversa) {
                conversa = await WhatsappConversa.create({
                    empresa_id: empresaId, cliente_id: cliente.id, telefone, nome_contato: nomeContato, status: 'aberta',
                }, { transaction: t });
            }
            if (!conversa.cliente_id) await conversa.update({ cliente_id: cliente.id }, { transaction: t });

            const { mensagem, duplicada } = await this._gravarMensagem(empresaId, conversa, conteudo, fromMe, payload, nomeContato, ehChamada, t);
            await t.commit();

            await this._logWebhook(empresaId, conversa.id, telefone, fromMe, payload);
            if (!duplicada) {
                await this._processarAutoRespostaAgendamento({
                    empresaId,
                    conversaId: conversa.id,
                    texto: conteudo.tipo === 'texto' ? conteudo.conteudo_texto : null,
                    fromMe,
                });
            }
            return {
                conversaId: duplicada ? mensagem.conversa_id : conversa.id,
                mensagemId: mensagem.id,
                duplicada,
            };
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    // Acha a conversa de um cliente. Primeiro pelo cliente_id (fonte da verdade
    // depois do match); cai pro telefone/variantes só como retaguarda do acervo.
    async _acharConversaDoCliente(empresaId, clienteId, telefone, t) {
        let conversa = await WhatsappConversa.findOne({
            where: { cliente_id: clienteId, empresa_id: empresaId, telefone: { [Op.notLike]: '%@lid' } },
            order: [['ultima_mensagem_em', 'DESC']],
            transaction: t,
        });
        if (conversa) return conversa;
        if (!ehLid(telefone)) {
            conversa = await WhatsappConversa.findOne({
                where: { telefone: { [Op.in]: variantesTelefone(telefone) }, empresa_id: empresaId },
                transaction: t,
            });
        }
        return conversa;
    }

    // Evento @lid sem paciente conhecido: conversa única pro @lid (não duplica) +
    // palpite de merge por nome exato do chatName/senderName numa janela recente.
    async _registrarEventoLidOrfao(empresaId, lid, nomeContato, conteudo, fromMe, payload, t) {
        const lidNorm = normalizarValor('lid', lid);
        // UMA conversa por @lid (idempotente) — é o que estanca a multiplicação.
        let conversa = await WhatsappConversa.findOne({
            where: { telefone: lidNorm, empresa_id: empresaId },
            transaction: t,
        });
        if (!conversa) {
            conversa = await WhatsappConversa.create({
                empresa_id: empresaId, cliente_id: null, telefone: lidNorm, nome_contato: nomeContato, status: 'aberta',
            }, { transaction: t });
        }

        const { mensagem, duplicada } = await this._gravarMensagem(
            empresaId,
            conversa,
            conteudo,
            fromMe,
            payload,
            nomeContato,
            /^CALL_/.test(payload.notification || ''),
            t
        );

        if (duplicada) {
            return {
                conversaId: mensagem.conversa_id,
                mensagemId: mensagem.id,
                lidOrfao: true,
                mergeSugerido: false,
                duplicada: true,
            };
        }

        // Palpite de junção: procura uma conversa de NÚMERO real com o mesmo nome
        // exato (chatName/senderName), atualizada nas últimas 72h. Se achar,
        // oferece o merge na tela — NUNCA junta automático (opção B).
        const alvo = await this._palpiteConversaAlvo(empresaId, nomeContato, conversa.id, t);
        if (alvo) {
            await mergeService.registrarCandidato(
                { empresa_id: empresaId, conversa_origem_id: conversa.id, conversa_alvo_id: alvo.id, motivo: `Mesmo nome "${nomeContato}" (evento por @lid)` },
                t
            );
        }
        return { conversaId: conversa.id, mensagemId: mensagem.id, lidOrfao: true, mergeSugerido: !!alvo, duplicada: false };
    }

    // Palpite: conversa de número real (não-@lid), mesmo nome exato, mexida
    // recentemente. Retorna a candidata ou null. Só palpita com um nome DE
    // VERDADE — se a Z-API não mandou nome, o "nome" cai no telefone/@lid (só
    // dígitos ou termina em @lid); casar por isso geraria palpite lixo.
    async _palpiteConversaAlvo(empresaId, nomeContato, conversaOrigemId, t) {
        const nome = (nomeContato || '').trim();
        // rejeita "nome" que é na verdade um identificador: vazio, só dígitos
        // (telefone) ou terminado em @lid.
        if (!nome || /@lid$/i.test(nome) || /^\d+$/.test(nome)) return null;
        const desde = new Date(Date.now() - 72 * 60 * 60 * 1000);
        return WhatsappConversa.findOne({
            where: {
                empresa_id: empresaId,
                id: { [Op.ne]: conversaOrigemId },
                cliente_id: { [Op.ne]: null },
                nome_contato: nome,
                telefone: { [Op.notLike]: '%@lid' },
                ultima_mensagem_em: { [Op.gte]: desde },
            },
            order: [['ultima_mensagem_em', 'DESC']],
            transaction: t,
        });
    }

    // Grava a mensagem + atualiza os campos de "última mensagem" da conversa
    // (preview, direção — que alimenta o indicador de "visto" na lista, nome).
    async _gravarMensagem(empresaId, conversa, conteudo, fromMe, payload, nomeContato, ehChamada, t) {
        const dadosMensagem = {
            conversa_id: conversa.id,
            empresa_id: empresaId,
            direcao: fromMe ? 'enviada' : 'recebida',
            tipo: conteudo.tipo,
            conteudo_texto: conteudo.conteudo_texto,
            midia_url: conteudo.midia_url,
            midia_mime: conteudo.midia_mime,
            midia_nome: conteudo.midia_nome,
            zapi_message_id: payload.messageId ?? null,
            status: fromMe ? 'enviada' : 'entregue',
        };

        let mensagem;
        let criada = true;
        if (payload.messageId) {
            [mensagem, criada] = await WhatsappMensagem.findOrCreate({
                where: { empresa_id: empresaId, zapi_message_id: payload.messageId },
                defaults: dadosMensagem,
                transaction: t,
            });
        } else {
            mensagem = await WhatsappMensagem.create(dadosMensagem, { transaction: t });
        }

        // Proteção para dois eventos iguais processados ao mesmo tempo. O
        // findOrCreate respeita o índice único e só o primeiro atualiza a
        // conversa e pode disparar automações.
        if (!criada) return { mensagem, duplicada: true };

        const preview = conteudo.tipo === 'texto' ? conteudo.conteudo_texto : (conteudo.conteudo_texto || `[${conteudo.tipo}]`);
        const camposAtualizar = {
            ultima_mensagem_preview: (preview ?? '').slice(0, 250),
            ultima_mensagem_em: new Date(),
            ultima_mensagem_direcao: fromMe ? 'enviada' : 'recebida',
            // Chamada perdida não incrementa "não lidas" (não é mensagem a responder).
            nao_lidas: (fromMe || ehChamada) ? conversa.nao_lidas : conversa.nao_lidas + 1,
        };
        // Só aplica o nome que a Z-API mandou se o atendente nunca renomeou esse
        // contato manualmente — senão toda mensagem nova revertia o nome ajustado
        // (era a causa do "nome não sincroniza entre atendentes" reportado).
        if (!conversa.nome_editado_manualmente) camposAtualizar.nome_contato = nomeContato;
        await conversa.update(camposAtualizar, { transaction: t });
        return { mensagem, duplicada: false };
    }

    async _acharMensagemJaProcessada(empresaId, messageId) {
        if (!messageId) return null;
        return WhatsappMensagem.findOne({
            where: { empresa_id: empresaId, zapi_message_id: messageId },
            attributes: ['id', 'conversa_id'],
        });
    }

    async _logWebhook(empresaId, conversaId, telefone, fromMe, payload) {
        await logService.registrar(
            { tipo: 'webhook_recebido', mensagem: `Mensagem ${fromMe ? 'enviada' : 'recebida'} — ${telefone}`, conversa_id: conversaId, metadata: payload },
            { tipo: 'EMPRESA', empresa_id: empresaId }
        ).catch(() => {});
    }

    // A automação é complementar ao webhook: qualquer indisponibilidade da
    // Z-API ou da configuração não pode desfazer a mensagem recebida nem fazer
    // a Z-API reenviar o evento em loop.
    async _processarAutoRespostaAgendamento(dados) {
        try {
            return await autoRespostaAgendamentoService.processar(dados);
        } catch (error) {
            console.warn('[WhatsApp CRM] Falha isolada na resposta automática de agendamento:', error?.message || error);
            return { enviada: false, motivo: 'erro_isolado' };
        }
    }

    async processarStatusMensagem(empresaId, payload) {
        const statusInterno = STATUS_ZAPI_PARA_INTERNO[payload.status];
        if (!statusInterno || !Array.isArray(payload.ids)) return { ignorado: true };

        await WhatsappMensagem.update(
            { status: statusInterno },
            { where: { zapi_message_id: payload.ids, empresa_id: empresaId } }
        );
        return { atualizado: payload.ids.length };
    }
}

export default new WebhookService();
