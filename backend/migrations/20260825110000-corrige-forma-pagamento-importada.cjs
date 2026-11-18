'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE recorrencias
         SET forma_pagamento = 'NAO_INFORMADO', updated_at = NOW()
       WHERE forma_pagamento = 'PIX'
         AND observacoes LIKE 'Importado do AppBarber | linha %'
         AND observacoes LIKE '%Forma de pagamento: não informada%'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE recorrencias
         SET forma_pagamento = 'PIX', updated_at = NOW()
       WHERE forma_pagamento = 'NAO_INFORMADO'
         AND observacoes LIKE 'Importado do AppBarber | linha %'
         AND observacoes LIKE '%Forma de pagamento: não informada%'
    `);
  },
};
