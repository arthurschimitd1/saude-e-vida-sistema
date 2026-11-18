'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const fields = [
      ['meta_ativo', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }],
      ['meta_app_id', { type: Sequelize.STRING(120), allowNull: true }],
      ['meta_app_secret', { type: Sequelize.TEXT, allowNull: true }],
      ['meta_business_account_id', { type: Sequelize.STRING(120), allowNull: true }],
      ['meta_phone_number_id', { type: Sequelize.STRING(120), allowNull: true }],
      ['meta_access_token', { type: Sequelize.TEXT, allowNull: true }],
      ['meta_verify_token', { type: Sequelize.TEXT, allowNull: true }],
      ['meta_webhook_token', { type: Sequelize.STRING(64), allowNull: true }],
      ['meta_api_version', { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'v23.0' }],
      ['meta_status', { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'nao_configurado' }],
      ['meta_ultimo_teste_em', { type: Sequelize.DATE, allowNull: true }],
      ['meta_ultimo_erro', { type: Sequelize.STRING(500), allowNull: true }],
      ['meta_display_phone_number', { type: Sequelize.STRING(40), allowNull: true }],
      ['meta_verified_name', { type: Sequelize.STRING(255), allowNull: true }],
    ];

    for (const [name, definition] of fields) {
      const table = await queryInterface.describeTable('whatsapp_config');
      if (!table[name]) await queryInterface.addColumn('whatsapp_config', name, definition);
    }

    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS whatsapp_config_meta_phone_idx ON whatsapp_config (meta_phone_number_id)'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS whatsapp_config_meta_phone_idx');
    for (const name of [
      'meta_verified_name', 'meta_display_phone_number', 'meta_ultimo_erro',
      'meta_ultimo_teste_em', 'meta_status', 'meta_api_version', 'meta_webhook_token',
      'meta_verify_token', 'meta_access_token', 'meta_phone_number_id',
      'meta_business_account_id', 'meta_app_secret', 'meta_app_id', 'meta_ativo',
    ]) {
      await queryInterface.removeColumn('whatsapp_config', name);
    }
  },
};
