import WhatsappCatalogo from '../../models/WhatsappCatalogo.js';
import { empresaParaGravar } from '../../utils/empresaScope.js';
import ApiError from '../../utils/apiError.js';
import { SEEDS, TIPOS_VALIDOS } from './catalogoSeeds.js';

const slugify = (texto) => texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';

class CatalogoService {
    _validarTipo(tipo) {
        if (!TIPOS_VALIDOS.includes(tipo)) throw new ApiError(400, `Catálogo inválido: ${tipo}`);
    }

    async listar(tipo, user) {
        this._validarTipo(tipo);
        const empresa_id = empresaParaGravar(user);
        if (!empresa_id) return [];

        let itens = await WhatsappCatalogo.findAll({
            where: { empresa_id, tipo },
            order: [['ordem', 'ASC'], ['nome', 'ASC']],
        });

        if (itens.length === 0) {
            const seed = SEEDS[tipo] ?? [];
            if (seed.length) {
                await WhatsappCatalogo.bulkCreate(seed.map((s, i) => ({
                    empresa_id, tipo, chave: s.chave, nome: s.nome, cor: s.cor, ordem: i,
                })));
                itens = await WhatsappCatalogo.findAll({
                    where: { empresa_id, tipo },
                    order: [['ordem', 'ASC'], ['nome', 'ASC']],
                });
            }
        }
        return itens;
    }

    async _gerarChaveUnica(empresa_id, tipo, nome) {
        const base = slugify(nome);
        let chave = base;
        let contador = 2;
        while (await WhatsappCatalogo.findOne({ where: { empresa_id, tipo, chave } })) {
            chave = `${base}_${contador}`;
            contador += 1;
        }
        return chave;
    }

    async criar(tipo, { nome, cor }, user) {
        this._validarTipo(tipo);
        const empresa_id = empresaParaGravar(user);
        if (!empresa_id) throw new ApiError(400, 'Usuário sem empresa associada');
        if (!nome || !nome.trim()) throw new ApiError(400, 'Nome é obrigatório');

        // Garante que a lista (com seeds) já existe antes de calcular a próxima ordem
        const atuais = await this.listar(tipo, user);
        const chave = await this._gerarChaveUnica(empresa_id, tipo, nome.trim());
        const proximaOrdem = atuais.length ? Math.max(...atuais.map(i => i.ordem)) + 1 : 0;

        return WhatsappCatalogo.create({
            empresa_id, tipo, chave, nome: nome.trim(), cor: cor || '#64748b', ordem: proximaOrdem,
        });
    }

    async atualizar(tipo, id, { nome, cor }, user) {
        this._validarTipo(tipo);
        const empresa_id = empresaParaGravar(user);
        const item = await WhatsappCatalogo.findOne({ where: { id, tipo, empresa_id } });
        if (!item) throw new ApiError(404, 'Item de catálogo não encontrado');
        await item.update({ nome: nome ?? item.nome, cor: cor ?? item.cor });
        return item;
    }

    async remover(tipo, id, user) {
        this._validarTipo(tipo);
        const empresa_id = empresaParaGravar(user);
        const item = await WhatsappCatalogo.findOne({ where: { id, tipo, empresa_id } });
        if (!item) throw new ApiError(404, 'Item de catálogo não encontrado');
        await item.destroy();
        return { success: true };
    }
}

export default new CatalogoService();
