'use strict';

const migrationKey = 'lucromais:20260904114500-repair-sape-commissions';
const repairOrigin = 'reparo_sape_0904';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('${migrationKey}'))`,
        { transaction },
      );

      // O histórico de Sapé confirma 40% como regra de produtos para os
      // profissionais. Atualizamos apenas os dois cadastros atualmente zerados;
      // qualquer configuração diferente de zero é preservada.
      await queryInterface.sequelize.query(`
        UPDATE users u
           SET comissao_tipo = 'percent',
               comissao_valor = 40,
               updated_at = NOW()
          FROM empresas e
         WHERE e.id = u.empresa_id
           AND LOWER(e.nome) = LOWER('Dom Ferraz - Sapé')
           AND u."nomeCompleto" IN ('ALYSSON HENRIQUE ALVES - SAPE', 'JEAN CARLOS FRANCISCO - SAPE')
           AND COALESCE(u.comissao_valor, 0) = 0
      `, { transaction });

      // Corrige somente as reconciliações pendentes criadas pelo backfill anterior.
      // O valor anterior permanece dentro dos detalhes para auditoria e rollback.
      await queryInterface.sequelize.query(`
        WITH servicos_esperados AS (
          SELECT v.id AS venda_id,
                 v.empresa_id,
                 v.funcionario_id,
                 SUM(vi.valor_total)::numeric(10,2) AS base_calculo,
                 ROUND(SUM(vi.valor_total * COALESCE(cs.percentual, 40) / 100), 2)::numeric(10,2) AS valor_esperado,
                 jsonb_agg(jsonb_build_object(
                   'item_id', vi.id,
                   'servico_id', vi.agendamento_servico_id,
                   'servico', vi.nome_item,
                   'percentual', COALESCE(cs.percentual, 40),
                   'base', vi.valor_total,
                   'valor', ROUND(vi.valor_total * COALESCE(cs.percentual, 40) / 100, 2)
                 ) ORDER BY vi.id) AS itens
            FROM vendas v
            JOIN empresas e ON e.id = v.empresa_id
            JOIN users u ON u.id = v.funcionario_id AND u.empresa_id = v.empresa_id
            JOIN venda_itens vi ON vi.venda_id = v.id
            LEFT JOIN comissao_servicos cs
              ON cs.empresa_id = v.empresa_id
             AND cs.funcionario_id = v.funcionario_id
             AND LOWER(TRIM(cs.servico_nome)) = LOWER(TRIM(vi.nome_item))
           WHERE LOWER(e.nome) = LOWER('Dom Ferraz - Sapé')
             AND u."nomeCompleto" IN ('ALYSSON HENRIQUE ALVES - SAPE', 'JEAN CARLOS FRANCISCO - SAPE')
             AND vi.tipo = 'servico'
             AND vi.agendamento_id IS NOT NULL
             AND v.data >= TIMESTAMPTZ '2026-09-01 00:00:00-03:00'
             AND v.data < TIMESTAMPTZ '2026-09-05 00:00:00-03:00'
           GROUP BY v.id, v.empresa_id, v.funcionario_id
        )
        UPDATE comissoes c
           SET valor = esperado.valor_esperado,
               tipo = 'percent',
               valor_origem = NULL,
               base_calculo = esperado.base_calculo,
               origem_calculo = '${repairOrigin}',
               descricao = 'Comissão de serviços corrigida pelas regras específicas',
               detalhes_calculo = jsonb_build_object(
                 'reparo', '${migrationKey}',
                 'tipo', 'ajuste_legado',
                 'valor_anterior', c.valor,
                 'valor_origem_anterior', c.valor_origem,
                 'base_anterior', c.base_calculo,
                 'origem_calculo_anterior', c.origem_calculo,
                 'descricao_anterior', c.descricao,
                 'detalhes_anteriores', c.detalhes_calculo,
                 'itens', esperado.itens
               ),
               "updatedAt" = NOW()
          FROM servicos_esperados esperado
         WHERE c.venda_id = esperado.venda_id
           AND c.funcionario_id = esperado.funcionario_id
           AND c.origem = 'venda_servicos'
           AND c.status = 'pendente'
           AND c.origem_calculo = 'backfill_controlado'
      `, { transaction });

      // Vendas que não possuíam qualquer reconciliação recebem uma comissão
      // separada por serviço. NOT EXISTS + índice existente tornam a operação
      // segura para repetição e para inicializações serverless concorrentes.
      await queryInterface.sequelize.query(`
        WITH servicos_esperados AS (
          SELECT v.id AS venda_id,
                 v.data,
                 v.empresa_id,
                 v.funcionario_id,
                 vi.id AS item_id,
                 vi.agendamento_id,
                 vi.agendamento_servico_id AS servico_id,
                 vi.nome_item AS servico_nome,
                 vi.valor_total::numeric(10,2) AS base_calculo,
                 COALESCE(cs.percentual, 40)::numeric(7,4) AS percentual,
                 ROUND(vi.valor_total * COALESCE(cs.percentual, 40) / 100, 2)::numeric(10,2) AS valor_esperado
            FROM vendas v
            JOIN empresas e ON e.id = v.empresa_id
            JOIN users u ON u.id = v.funcionario_id AND u.empresa_id = v.empresa_id
            JOIN venda_itens vi ON vi.venda_id = v.id
            LEFT JOIN comissao_servicos cs
              ON cs.empresa_id = v.empresa_id
             AND cs.funcionario_id = v.funcionario_id
             AND LOWER(TRIM(cs.servico_nome)) = LOWER(TRIM(vi.nome_item))
           WHERE LOWER(e.nome) = LOWER('Dom Ferraz - Sapé')
             AND u."nomeCompleto" IN ('ALYSSON HENRIQUE ALVES - SAPE', 'JEAN CARLOS FRANCISCO - SAPE')
             AND vi.tipo = 'servico'
             AND vi.agendamento_id IS NOT NULL
             AND vi.agendamento_servico_id IS NOT NULL
             AND v.data >= TIMESTAMPTZ '2026-09-01 00:00:00-03:00'
             AND v.data < TIMESTAMPTZ '2026-09-05 00:00:00-03:00'
        )
        INSERT INTO comissoes
          (venda_id, funcionario_id, empresa_id, valor, tipo, valor_origem,
           origem, base_calculo, agendamento_id, servico_id, descricao, status,
           origem_calculo, detalhes_calculo, "createdAt", "updatedAt")
        SELECT esperado.venda_id,
               esperado.funcionario_id,
               esperado.empresa_id,
               esperado.valor_esperado,
               'percent',
               esperado.percentual,
               'servico_agendamento',
               esperado.base_calculo,
               esperado.agendamento_id,
               esperado.servico_id,
               'Serviço: ' || esperado.servico_nome,
               'pendente',
               '${repairOrigin}',
               jsonb_build_object(
                 'reparo', '${migrationKey}',
                 'tipo', 'comissao_ausente',
                 'item_id', esperado.item_id
               ),
               esperado.data,
               NOW()
          FROM servicos_esperados esperado
         WHERE NOT EXISTS (
                 SELECT 1 FROM comissoes legado
                  WHERE legado.venda_id = esperado.venda_id
                    AND legado.funcionario_id = esperado.funcionario_id
                    AND legado.origem = 'venda_servicos'
               )
           AND NOT EXISTS (
                 SELECT 1 FROM comissoes atual
                  WHERE atual.venda_id = esperado.venda_id
                    AND atual.funcionario_id = esperado.funcionario_id
                    AND atual.origem = 'servico_agendamento'
                    AND COALESCE(atual.servico_id, '') = COALESCE(esperado.servico_id, '')
               )
        ON CONFLICT DO NOTHING
      `, { transaction });

      // A única venda de produto de Jean sem comissão no período recebe a
      // mesma regra padrão de 40% usada pelos demais profissionais de Sapé.
      await queryInterface.sequelize.query(`
        WITH produto_esperado AS (
          SELECT v.id AS venda_id,
                 v.data,
                 v.empresa_id,
                 v.funcionario_id,
                 SUM(vi.valor_total)::numeric(10,2) AS base_calculo
            FROM vendas v
            JOIN empresas e ON e.id = v.empresa_id
            JOIN users u ON u.id = v.funcionario_id AND u.empresa_id = v.empresa_id
            JOIN venda_itens vi ON vi.venda_id = v.id AND vi.tipo = 'produto'
           WHERE LOWER(e.nome) = LOWER('Dom Ferraz - Sapé')
             AND u."nomeCompleto" = 'JEAN CARLOS FRANCISCO - SAPE'
             AND v.id = 8270
             AND COALESCE(v.desconto, 0) = 0
           GROUP BY v.id, v.data, v.empresa_id, v.funcionario_id
        )
        INSERT INTO comissoes
          (venda_id, funcionario_id, empresa_id, valor, tipo, valor_origem,
           origem, base_calculo, descricao, status, origem_calculo,
           detalhes_calculo, "createdAt", "updatedAt")
        SELECT esperado.venda_id,
               esperado.funcionario_id,
               esperado.empresa_id,
               ROUND(esperado.base_calculo * 0.40, 2),
               'percent',
               40,
               'venda_produtos',
               esperado.base_calculo,
               'Comissão sobre produtos da venda',
               'pendente',
               '${repairOrigin}',
               jsonb_build_object('reparo', '${migrationKey}', 'tipo', 'produto_ausente'),
               esperado.data,
               NOW()
          FROM produto_esperado esperado
         WHERE NOT EXISTS (
                 SELECT 1 FROM comissoes atual
                  WHERE atual.venda_id = esperado.venda_id
                    AND atual.funcionario_id = esperado.funcionario_id
                    AND atual.origem IN ('venda_produtos', 'venda')
               )
        ON CONFLICT DO NOTHING
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        UPDATE comissoes
           SET valor = (detalhes_calculo->>'valor_anterior')::numeric,
               valor_origem = (detalhes_calculo->>'valor_origem_anterior')::numeric,
               base_calculo = (detalhes_calculo->>'base_anterior')::numeric,
               origem_calculo = detalhes_calculo->>'origem_calculo_anterior',
               descricao = detalhes_calculo->>'descricao_anterior',
               detalhes_calculo = detalhes_calculo->'detalhes_anteriores',
               "updatedAt" = NOW()
         WHERE origem_calculo = '${repairOrigin}'
           AND detalhes_calculo->>'reparo' = '${migrationKey}'
           AND detalhes_calculo->>'tipo' = 'ajuste_legado'
      `, { transaction });
      await queryInterface.sequelize.query(`
        DELETE FROM comissoes
         WHERE origem_calculo = '${repairOrigin}'
           AND detalhes_calculo->>'reparo' = '${migrationKey}'
           AND detalhes_calculo->>'tipo' IN ('comissao_ausente', 'produto_ausente')
      `, { transaction });
      // A comissão padrão não é zerada no rollback: ela é uma configuração
      // financeira atual e pode ter sido confirmada ou alterada após o reparo.
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
