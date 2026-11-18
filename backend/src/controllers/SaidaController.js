import Saida from '../models/Saida.js';
import TurnoCaixa from '../models/TurnoCaixa.js';
import { prepararSaidaPagamento } from '../utils/saidaPagamento.js';
import ApiResponse from '../utils/apiResponse.js';
import CloudinaryService from '../utils/CloudinaryService.js';
import AutomacaoEngine from '../services/AutomacaoEngine.js';
import { Op } from 'sequelize';
import CentroCusto from '../models/CentroCusto.js';
import sequelize from '../config/database.js';
import { empresaParaGravar } from '../utils/empresaScope.js';

const empresaDaRequisicao = req => {
    const empresaId = empresaParaGravar(req.user);
    if (!empresaId) throw { status: 400, message: 'Selecione uma empresa para acessar as saídas' };
    return Number(empresaId);
};

async function verificarBudgetCentroCusto(centro_custo_id, empresa_id) {
    if (!centro_custo_id || !empresa_id) return;

    const centro = await CentroCusto.findOne({ where: { id: centro_custo_id, empresa_id } });
    if (!centro) return;

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

    const [resultado] = await sequelize.query(
        `SELECT COALESCE(SUM(valor), 0) AS total_gasto
         FROM saidas
         WHERE centro_custo_id = :centroId
           AND empresa_id = :empresa_id
           AND natureza = 'SAIDA'
           AND status != 'cancelado'
           AND data BETWEEN :inicioMes AND :fimMes`,
        { replacements: { centroId: centro_custo_id, empresa_id, inicioMes, fimMes }, type: sequelize.QueryTypes.SELECT }
    );

    const totalGasto = parseFloat(resultado?.total_gasto || 0);
    const budget = parseFloat(centro.budget);
    if (budget <= 0) return;

    const percentual = (totalGasto / budget) * 100;

    AutomacaoEngine.dispararEvento('budget_atingido', empresa_id, {
        centro_custo_id: centro.id,
        nome: centro.nome,
        budget,
        total_gasto: totalGasto,
        percentual_atingido: Math.round(percentual * 100) / 100,
    });
}

const getResourceTypeFromUrl = (url) => {
    if (!url) return 'raw';
    if (url.includes('/image/upload/')) return 'image';
    if (url.includes('/video/upload/')) return 'video';
    return 'raw';
};

class SaidaController {

    async getAll(req, res, next) {
        try {
            const empresa_id = empresaDaRequisicao(req);
            const { natureza, categoria, status, data_inicio, data_fim } = req.query;

            const where = { empresa_id };
            if (natureza) where.natureza = natureza;
            if (categoria) where.categoria = categoria;
            if (status) where.status = status;
            if (data_inicio && data_fim) {
                where.data = { [Op.between]: [new Date(data_inicio), new Date(data_fim)] };
            }

            const lancamentos = await Saida.findAll({ where, order: [['data', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']] });
            new ApiResponse(res).success(200, lancamentos);
        } catch (error) {
            next(error);
        }
    }

    async create(req, res, next) {
        try {
            const empresa_id = empresaDaRequisicao(req);

            const pagamento = await prepararSaidaPagamento(req.body, null, empresa_id, options => TurnoCaixa.findOne(options));
            let anexoData = {};
            if (req.file) {
                const result = await CloudinaryService.uploadFile(
                    req.file.buffer,
                    req.file.originalname,
                    'lucromais/comprovantes'
                );
                anexoData = { comprovante_url: result.secure_url, comprovante_public_id: result.public_id };
            }

            const lancamento = await Saida.create({ ...req.body, ...anexoData, empresa_id, ...pagamento });

            // Automação: dispara evento de saída criada
            if (lancamento.natureza === 'SAIDA' && lancamento.data) {
                const diasParaVencer = Math.ceil((new Date(lancamento.data).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                AutomacaoEngine.dispararEvento('conta_pagar_vence', empresa_id, { lancamento, dias_para_vencer: diasParaVencer });
            }

            // Automação: verifica budget do centro de custo
            if (lancamento.centro_custo_id && lancamento.natureza === 'SAIDA') {
                verificarBudgetCentroCusto(lancamento.centro_custo_id, empresa_id).catch(() => { });
            }

            new ApiResponse(res).success(201, lancamento, 'Lançamento criado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            const empresa_id = empresaDaRequisicao(req);
            const lancamento = await Saida.findOne({ where: { id: req.params.id, empresa_id } });
            if (!lancamento) throw { status: 404, message: 'Lançamento não encontrado' };

            const pagamento = await prepararSaidaPagamento(req.body, lancamento, empresa_id, options => TurnoCaixa.findOne(options));
            let anexoData = {};
            if (req.file) {
                if (lancamento.comprovante_public_id) {
                    const resourceType = getResourceTypeFromUrl(lancamento.comprovante_url);
                    await CloudinaryService.deleteFile(lancamento.comprovante_public_id, resourceType);
                }
                const result = await CloudinaryService.uploadFile(
                    req.file.buffer,
                    req.file.originalname,
                    'lucromais/comprovantes'
                );
                anexoData = { comprovante_url: result.secure_url, comprovante_public_id: result.public_id };
            }

            await lancamento.update({ ...req.body, ...anexoData, empresa_id, ...pagamento });

            // Automação: verifica budget do centro de custo
            if (lancamento.centro_custo_id && lancamento.natureza === 'SAIDA') {
                verificarBudgetCentroCusto(lancamento.centro_custo_id, empresa_id).catch(() => { });
            }

            new ApiResponse(res).success(200, lancamento, 'Lançamento atualizado com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async marcarPago(req, res, next) {
        try {
            const empresa_id = empresaDaRequisicao(req);
            const lancamento = await Saida.findOne({ where: { id: req.params.id, empresa_id } });
            if (!lancamento) throw { status: 404, message: 'Lançamento não encontrado' };
            await lancamento.update({ status: 'pago' });
            new ApiResponse(res).success(200, lancamento, 'Lançamento marcado como pago');
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            const empresa_id = empresaDaRequisicao(req);
            const lancamento = await Saida.findOne({ where: { id: req.params.id, empresa_id } });
            if (!lancamento) throw { status: 404, message: 'Lançamento não encontrado' };

            if (lancamento.comprovante_public_id) {
                const resourceType = getResourceTypeFromUrl(lancamento.comprovante_url);
                await CloudinaryService.deleteFile(lancamento.comprovante_public_id, resourceType);
            }

            await lancamento.destroy();
            new ApiResponse(res).success(200, null, 'Lançamento excluído com sucesso');
        } catch (error) {
            next(error);
        }
    }

    async downloadComprovante(req, res, next) {
        try {
            const empresa_id = empresaDaRequisicao(req);
            const lancamento = await Saida.findOne({ where: { id: req.params.id, empresa_id } });
            if (!lancamento) throw { status: 404, message: 'Lançamento não encontrado' };
            if (!lancamento.comprovante_url) return res.status(404).json({ message: 'Lançamento sem comprovante' });

            const credentials = Buffer.from(
                `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
            ).toString('base64');

            const response = await fetch(lancamento.comprovante_url, {
                headers: { 'Authorization': `Basic ${credentials}` }
            });

            const buffer = await response.arrayBuffer();
            const nomeArquivo = `comprovante_${(lancamento.descricao || lancamento.id).toString().replace(/\s+/g, '_').toLowerCase()}.pdf`;

            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
            res.send(Buffer.from(buffer));
        } catch (error) {
            next(error);
        }
    }
}

export default new SaidaController();
