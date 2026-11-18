'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'services',
            'codigo_indicador_operacao',
            {
                type: Sequelize.STRING(6),
                allowNull: true
            }
        );

        await queryInterface.addColumn(
            'services',
            'ibs_cbs_situacao_tributaria',
            {
                type: Sequelize.STRING(3),
                allowNull: true
            }
        );

        await queryInterface.addColumn(
            'services',
            'ibs_cbs_classificacao_tributaria',
            {
                type: Sequelize.STRING(6),
                allowNull: true
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'services',
            'ibs_cbs_classificacao_tributaria'
        );

        await queryInterface.removeColumn(
            'services',
            'ibs_cbs_situacao_tributaria'
        );

        await queryInterface.removeColumn(
            'services',
            'codigo_indicador_operacao'
        );
    }
};