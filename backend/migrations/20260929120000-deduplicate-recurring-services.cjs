'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      WITH itens AS (
        SELECT
          r.id AS recorrencia_id,
          item.value AS servico,
          item.ordinality,
          COALESCE(
            NULLIF(BTRIM(item.value ->> 'servico_id'), ''),
            'nome:' || LOWER(REGEXP_REPLACE(BTRIM(item.value ->> 'servico_nome'), '\\s+', ' ', 'g'))
          ) AS chave
        FROM recorrencias r
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(r.servicos_inclusos) = 'array' THEN r.servicos_inclusos
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS item(value, ordinality)
        WHERE BTRIM(COALESCE(item.value ->> 'servico_nome', '')) <> ''
          AND CASE
            WHEN (item.value ->> 'quantidade') ~ '^\\s*[0-9]+\\s*$'
            THEN (item.value ->> 'quantidade')::integer
            ELSE 0
          END > 0
      ), mantidos AS (
        SELECT DISTINCT ON (recorrencia_id, chave)
          recorrencia_id,
          servico,
          ordinality
        FROM itens
        ORDER BY recorrencia_id, chave, ordinality DESC
      ), agrupados AS (
        SELECT recorrencia_id, jsonb_agg(servico ORDER BY ordinality) AS servicos
        FROM mantidos
        GROUP BY recorrencia_id
      )
      UPDATE recorrencias r
      SET servicos_inclusos = agrupados.servicos,
          updated_at = NOW()
      FROM agrupados
      WHERE r.id = agrupados.recorrencia_id
        AND r.servicos_inclusos IS DISTINCT FROM agrupados.servicos
    `);
  },

  async down() {
    // A deduplicação é uma correção de dados; não há restauração segura dos
    // itens removidos sem um backup externo da tabela.
  },
};
