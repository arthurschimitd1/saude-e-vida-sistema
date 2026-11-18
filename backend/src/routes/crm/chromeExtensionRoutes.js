/**
 * Fase 8 — Chrome Extension endpoints
 *
 * Endpoints preparados para futura integração com extensão Chrome.
 * NÃO implementa disparos automáticos — apenas leitura/escrita de dados.
 * A extensão usará esses endpoints para:
 *   - Selecionar campanha ativa
 *   - Listar prospects para contato
 *   - Obter scripts da campanha
 *   - Registrar interações realizadas pelo vendedor
 */
import express from 'express';
import auth from '../../middlewares/auth.js';
import campanhaService from '../../services/crm/CampanhaService.js';
import prospectService from '../../services/crm/ProspectService.js';
import scriptService from '../../services/crm/ScriptService.js';
import interacaoService from '../../services/crm/InteracaoService.js';
import ApiResponse from '../../utils/apiResponse.js';

const router = express.Router();

// Lista campanhas disponíveis para a extensão selecionar
router.get('/campanhas', auth, async (req, res, next) => {
    try {
        const data = await campanhaService.listar(req.user);
        new ApiResponse(res).success(200, data);
    } catch (err) { next(err); }
});

// Lista prospects de uma campanha para a extensão iterar
router.get('/prospects/:campaign_id', auth, async (req, res, next) => {
    try {
        const data = await prospectService.listar(
            { campaign_id: req.params.campaign_id, status: req.query.status },
            req.user
        );
        new ApiResponse(res).success(200, data);
    } catch (err) { next(err); }
});

// Busca scripts de uma campanha para a extensão exibir ao vendedor
router.get('/scripts/:campaign_id', auth, async (req, res, next) => {
    try {
        const data = await scriptService.listar({ campaign_id: req.params.campaign_id }, req.user);
        new ApiResponse(res).success(200, data);
    } catch (err) { next(err); }
});

// Registra interação feita pelo vendedor via extensão
router.post('/interacoes', auth, async (req, res, next) => {
    try {
        const data = await interacaoService.criar(req.body, req.user);
        new ApiResponse(res).success(201, data, 'Interação registrada pela extensão');
    } catch (err) { next(err); }
});

export default router;
