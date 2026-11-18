'use strict';

const migrationKey = 'lucromais:20260914183000-repair-tito-underwear-pack-variations';
// Mantido dentro da migration para que o empacotador serverless da Vercel
// inclua todos os dados necessários na função que executa as migrations.
const valoresConfiguracao = [
  ['pack-3-cuecas-reserva-124b8', { marca: 'RESERVA', composicao: 'Azul / Preta / Branca' }],
  ['pack-3-cuecas-reserva-1c0c0', { marca: 'RESERVA', composicao: 'Preta / Branca / Preta' }],
  ['pack-3-cuecas-nike-dypdl', { marca: 'NIKE', composicao: 'Branca / Preta / Cinza' }],
  ['pack-3-cuecas-zara-1h2yn', { marca: 'ZARA', composicao: 'Branca / Azul / Cinza' }],
  ['pack-3-cuecas-calvin-klein-fxy85', { marca: 'CALVIN KLEIN', composicao: 'Azul / Preta / Cinza' }],
  ['pack-3-cuecas-calvin-klein-czp0n', { marca: 'CALVIN KLEIN', composicao: 'Branca / Preta / Cinza' }],
  ['pack-3-cuecas-hugo-boss-14jm4', { marca: 'HUGO BOSS', composicao: 'Azul / Preta / Cinza' }],
  ['pack-3-cuecas-hugo-boss-cfmee', { marca: 'HUGO BOSS', composicao: 'Preta / Branca / Azul' }],
  ['pack-3-cuecas-adidas-17jw0', { marca: 'ADIDAS', composicao: 'Branca / Cinza / Preta' }],
  ['pack-3-cuecas-diesel-19a79', { marca: 'DIESEL', composicao: 'Preta / Azul / Branca' }],
  ['pack-3-cuecas-diesel-dhaw3', { marca: 'DIESEL', composicao: 'Preta / Branca / Cinza' }],
  ['pack-3-cuecas-diesel-1bonb', { marca: 'DIESEL', composicao: 'Azul / Azul / Branca' }],
  ['pack-3-cuecas-tommy-hilfiger-y6ltw', { marca: 'TOMMY HILFIGER', composicao: 'Branca / Cinza / Preta' }],
  ['pack-3-cuecas-tommy-hilfiger-1h4zu', { marca: 'TOMMY HILFIGER', composicao: 'Azul / Branca / Preta' }],
];

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtext('${migrationKey}'))`,
        { transaction },
      );

      const replacements = {};
      const valuesSql = valoresConfiguracao.map(([slug, dados], indice) => {
        replacements[`slug${indice}`] = slug;
        replacements[`marca${indice}`] = dados.marca;
        replacements[`cor${indice}`] = dados.composicao;
        return `(:slug${indice}, :marca${indice}, :cor${indice})`;
      }).join(',\n          ');

      await queryInterface.sequelize.query(`
        WITH configuracao(slug, marca, composicao) AS (
          VALUES ${valuesSql}
        )
        UPDATE estoque_roupas AS roupa
           SET marca = configuracao.marca,
               "updatedAt" = NOW()
          FROM configuracao
         WHERE roupa.observacao = 'Origem Nuvemshop: ' || configuracao.slug
      `, { replacements, transaction });

      await queryInterface.sequelize.query(`
        WITH configuracao(slug, marca, composicao) AS (
          VALUES ${valuesSql}
        )
        UPDATE estoque_roupas_variacoes AS variacao
           SET cor = configuracao.composicao,
               "updatedAt" = NOW()
          FROM estoque_roupas AS roupa,
               configuracao
         WHERE variacao.roupa_id = roupa.id
           AND roupa.observacao = 'Origem Nuvemshop: ' || configuracao.slug
      `, { replacements, transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  // Reparo de dados: o rollback não apaga composições para preservar ajustes
  // que o cliente possa fazer depois da aplicação.
  async down() {},
};
