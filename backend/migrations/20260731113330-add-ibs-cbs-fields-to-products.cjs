'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const columns = await queryInterface.describeTable('Products');
        if (!columns.ibs_cbs_situacao_tributaria) {
            await queryInterface.addColumn('Products', 'ibs_cbs_situacao_tributaria', {
                type: Sequelize.STRING(3),
                allowNull: true,
                comment: 'CST do IBS/CBS',
            });
        }
        if (!columns.ibs_cbs_classificacao_tributaria) {
            await queryInterface.addColumn('Products', 'ibs_cbs_classificacao_tributaria', {
                type: Sequelize.STRING(6),
                allowNull: true,
                comment: 'Código de classificação tributária do IBS/CBS',
            });
        }
    },

    async down(queryInterface) {
        const columns = await queryInterface.describeTable('Products');
        if (columns.ibs_cbs_classificacao_tributaria) {
            await queryInterface.removeColumn('Products', 'ibs_cbs_classificacao_tributaria');
        }
        if (columns.ibs_cbs_situacao_tributaria) {
            await queryInterface.removeColumn('Products', 'ibs_cbs_situacao_tributaria');
        }
    },
};
