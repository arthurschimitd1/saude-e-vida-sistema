import sequelize from '../config/database.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

export const getConfig = async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);
        if (!where.empresa_id && req.query.empresa_id) {
            where.empresa_id = Number(req.query.empresa_id);
        }
        if (!where.empresa_id) return res.status(400).json({ error: 'empresa_id é obrigatório' });

        const [config] = await sequelize.query(
            `SELECT * FROM nfse_configs WHERE empresa_id = :empresa_id LIMIT 1`,
            { replacements: { empresa_id: where.empresa_id }, type: sequelize.QueryTypes.SELECT }
        );

        res.json(config || null);
    } catch (err) {
        console.error('Erro ao buscar config NFS-e:', err);
        res.status(500).json({ error: err.message });
    }
};

export const upsertConfig = async (req, res) => {
    try {
        const empresa_id = empresaParaGravar(req.user) ?? req.body.empresa_id ?? Number(req.query.empresa_id);
        if (!empresa_id) return res.status(400).json({ error: 'empresa_id é obrigatório' });

        const {
            inscricao_municipal,
            codigo_municipio,
            optante_simples_nacional,
            incentivador_cultural,
        } = req.body;

        await sequelize.query(
            `INSERT INTO nfse_configs (empresa_id, inscricao_municipal, codigo_municipio, optante_simples_nacional, incentivador_cultural, "createdAt", "updatedAt")
             VALUES (:empresa_id, :inscricao_municipal, :codigo_municipio, :optante_simples_nacional, :incentivador_cultural, NOW(), NOW())
             ON CONFLICT (empresa_id) DO UPDATE SET
                inscricao_municipal = :inscricao_municipal,
                codigo_municipio = :codigo_municipio,
                optante_simples_nacional = :optante_simples_nacional,
                incentivador_cultural = :incentivador_cultural,
                "updatedAt" = NOW()`,
            {
                replacements: {
                    empresa_id,
                    inscricao_municipal: inscricao_municipal || null,
                    codigo_municipio: codigo_municipio || null,
                    optante_simples_nacional: optante_simples_nacional ?? false,
                    incentivador_cultural: incentivador_cultural ?? false,
                },
                type: sequelize.QueryTypes.UPSERT,
            }
        );

        const [config] = await sequelize.query(
            `SELECT * FROM nfse_configs WHERE empresa_id = :empresa_id LIMIT 1`,
            { replacements: { empresa_id }, type: sequelize.QueryTypes.SELECT }
        );

        res.json(config);
    } catch (err) {
        console.error('Erro ao salvar config NFS-e:', err);
        res.status(500).json({ error: err.message });
    }
};
