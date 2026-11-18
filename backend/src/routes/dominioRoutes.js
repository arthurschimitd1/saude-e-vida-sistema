import { Router } from 'express';
import { Op } from 'sequelize';
import crypto from 'crypto';
import sequelize from '../config/database.js';
import auth from '../middlewares/auth.js';
import ContadorCliente from '../models/ContadorCliente.js';
import NotaFiscalFocus from '../models/NotaFiscalFocus.js';

const router = Router();

router.use(auth);

const getEmpresaContexto = (req) => req.user?.empresa_id_override || req.user?.empresa_id || null;

const mapClienteDominio = (cliente) => ({
  id: Number(cliente.id),
  nome: cliente.nome || `Empresa ${cliente.id}`,
  cnpj: '',
  chaveContador: cliente.chave_contador || '',
  integrationKey: cliente.integration_key || '',
  status: cliente.status || 'pendente'
});

const buscarClientesDominio = async (req) => {
  const tipo = req.user?.tipo || 'USUARIO';
  const contadorId = req.user?.id;
  const empresaId = getEmpresaContexto(req);

  if (tipo === 'CONTADOR') {
    return sequelize.query(
      `SELECT e.id, e.nome, cc.chave_contador, cc.integration_key, cc.status
         FROM contador_clientes cc
         INNER JOIN empresas e ON e.id = cc.empresa_cliente_id
        WHERE cc.contador_id = :contadorId
        ORDER BY e.nome`,
      {
        replacements: { contadorId },
        type: sequelize.QueryTypes.SELECT
      }
    );
  }

  if (tipo === 'MASTER') {
    return sequelize.query(
      `SELECT e.id, e.nome, cc.chave_contador, cc.integration_key, cc.status
         FROM empresas e
         LEFT JOIN contador_clientes cc
           ON cc.empresa_cliente_id = e.id
          AND cc.contador_id = :contadorId
        ORDER BY e.nome`,
      {
        replacements: { contadorId },
        type: sequelize.QueryTypes.SELECT
      }
    );
  }

  if (!empresaId) return [];

  return sequelize.query(
    `SELECT e.id, e.nome, cc.chave_contador, cc.integration_key, cc.status
       FROM empresas e
       LEFT JOIN contador_clientes cc
         ON cc.empresa_cliente_id = e.id
        AND cc.contador_id = :contadorId
      WHERE e.id = :empresaId`,
    {
      replacements: { contadorId, empresaId },
      type: sequelize.QueryTypes.SELECT
    }
  );
};

router.get('/clientes', async (req, res) => {
  try {
    const clientes = await buscarClientesDominio(req);
    res.json(clientes.map(mapClienteDominio));
  } catch (error) {
    console.error('Erro ao listar clientes Domínio:', error);
    res.status(500).json({ error: 'Erro ao listar clientes da integração contábil' });
  }
});

router.put('/clientes/:id/chave', async (req, res) => {
  try {
    const empresaClienteId = Number(req.params.id);
    const contadorId = req.user?.id;
    const chaveContador = String(req.body?.chave_contador || '').trim();

    if (!empresaClienteId || !chaveContador) {
      return res.status(400).json({ error: 'Cliente e chave do contador são obrigatórios' });
    }

    const [registro] = await ContadorCliente.findOrCreate({
      where: { contador_id: contadorId, empresa_cliente_id: empresaClienteId },
      defaults: {
        contador_id: contadorId,
        empresa_cliente_id: empresaClienteId,
        chave_contador: chaveContador,
        status: 'pendente'
      }
    });

    registro.chave_contador = chaveContador;
    registro.status = 'pendente';
    registro.integration_key = null;
    await registro.save();

    res.json(registro);
  } catch (error) {
    console.error('Erro ao salvar chave Domínio:', error);
    res.status(500).json({ error: 'Erro ao salvar chave do contador' });
  }
});

router.post('/clientes/ativar', async (req, res) => {
  try {
    const empresaClienteId = Number(req.body?.empresa_cliente_id);
    const contadorId = req.user?.id;
    const chaveContador = String(req.body?.chave_contador || '').trim();

    if (!empresaClienteId || !chaveContador) {
      return res.status(400).json({ error: 'Cliente e chave do contador são obrigatórios' });
    }

    const [registro] = await ContadorCliente.findOrCreate({
      where: { contador_id: contadorId, empresa_cliente_id: empresaClienteId },
      defaults: {
        contador_id: contadorId,
        empresa_cliente_id: empresaClienteId,
        chave_contador: chaveContador,
        integration_key: crypto.randomBytes(24).toString('hex'),
        status: 'ativo'
      }
    });

    registro.chave_contador = chaveContador;
    registro.integration_key = registro.integration_key || crypto.randomBytes(24).toString('hex');
    registro.status = 'ativo';
    await registro.save();

    res.json({ registro });
  } catch (error) {
    console.error('Erro ao ativar cliente Domínio:', error);
    res.status(500).json({ error: 'Erro ao gerar integration key' });
  }
});

router.get('/notas', async (req, res) => {
  try {
    const tipo = req.user?.tipo || 'USUARIO';
    const empresaId = getEmpresaContexto(req);
    let empresasPermitidas = [];

    if (tipo === 'CONTADOR') {
      const associacoes = await ContadorCliente.findAll({
        where: { contador_id: req.user.id, status: 'ativo' },
        attributes: ['empresa_cliente_id']
      });
      empresasPermitidas = associacoes.map((item) => item.empresa_cliente_id).filter(Boolean);
    } else if (tipo === 'MASTER') {
      empresasPermitidas = empresaId ? [empresaId] : null;
    } else if (empresaId) {
      empresasPermitidas = [empresaId];
    }

    if (Array.isArray(empresasPermitidas) && empresasPermitidas.length === 0) {
      return res.json([]);
    }

    const where = {
      enviado_para_dominio: false,
      xml_content: { [Op.ne]: null }
    };

    if (Array.isArray(empresasPermitidas)) {
      where.empresa_id = { [Op.in]: empresasPermitidas };
    }

    const notas = await NotaFiscalFocus.findAll({
      where,
      order: [['data_emissao', 'DESC']],
      limit: 100
    });

    res.json(notas.map((nota) => ({
      id: nota.id,
      chave_acesso: nota.chave_acesso || '',
      numero: nota.numero || '',
      serie: nota.serie || '',
      data_emissao: nota.data_emissao,
      valor_total: Number(nota.valor_total || 0),
      enviado_para_dominio: Boolean(nota.enviado_para_dominio),
      statusFocus: nota.status_focus || ''
    })));
  } catch (error) {
    console.error('Erro ao listar notas Domínio:', error);
    res.status(500).json({ error: 'Erro ao listar notas da integração contábil' });
  }
});

router.post('/notas/:id/enviar', async (req, res) => {
  res.status(501).json({
    error: 'Envio para Domínio ainda não configurado neste ambiente'
  });
});

router.get('/notas/:id/status', async (req, res) => {
  try {
    const nota = await NotaFiscalFocus.findByPk(req.params.id);
    if (!nota) return res.status(404).json({ error: 'Nota não encontrada' });

    res.json({
      id: nota.id,
      enviado_para_dominio: Boolean(nota.enviado_para_dominio),
      data_envio_dominio: nota.data_envio_dominio,
      integration_key_usada: nota.integration_key_usada,
      chave_acesso: nota.chave_acesso
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar status da nota' });
  }
});

router.get('/requests-status', async (req, res) => {
  res.json({ usado: 0, limite: 40, restante: 40 });
});

router.post('/sincronizar-focus', async (req, res) => {
  res.json({ message: 'Sincronização da Focus indisponível neste ambiente', iniciado: false });
});

router.post('/sincronizar', async (req, res) => {
  res.json({ message: 'Sincronização da Focus indisponível neste ambiente', iniciado: false });
});

export default router;
