'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE crm_whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_url TEXT');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE crm_whatsapp_mensagens DROP COLUMN IF EXISTS media_url');
  },
};
