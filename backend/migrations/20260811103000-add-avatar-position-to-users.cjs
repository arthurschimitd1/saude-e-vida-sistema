'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.avatar_position) {
      await queryInterface.addColumn('users', 'avatar_position', {
        type: Sequelize.STRING(32),
        allowNull: true,
        defaultValue: '50% 50%',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');

    if (table.avatar_position) {
      await queryInterface.removeColumn('users', 'avatar_position');
    }
  },
};
