import Product from './Product.js';
import Inventario from './Inventario.js';
import Venda from './Venda.js';
import VendaItem from './VendaItem.js';
import Cliente from './Cliente.js';
import User from './UserModel.js';
import Contador from './ContadorModel.js';
import Comissao from './Comissao.js';
import ComissaoServico from './ComissaoServico.js';
import Orcamento from './Orcamento.js';
import OrcamentoItem from './OrcamentoItem.js';
import Movimento from './Movimento.js';
import TurnoCaixa from './TurnoCaixa.js';
import Marketing from './Marketing.js';
import Tarefa from './Tarefa.js';
import Subtarefa from './Subtarefa.js';
import TarefaStatusLog from './TarefaStatusLog.js';
import KanbanColuna from './KanbanColuna.js';
import SetorPlanejamento from './SetorPlanejamento.js';
import Pedido from './Pedido.js';
import Receita from './Receita.js';
import ReceitaItem from './ReceitaItem.js';
import OrdemProducao from './OrdemProducao.js';
import RawMaterial from './RawMaterial.js';
import EntradaInsumoSemNota from './EntradaInsumoSemNota.js';
import Recorrencia from './Recorrencia.js';
import HistoricoPagamento from './HistoricoPagamento.js';
import RecorrenciaConfiguracao from './RecorrenciaConfiguracao.js';
import RecorrenciaPlano from './RecorrenciaPlano.js';
import RecorrenciaAuditoria from './RecorrenciaAuditoria.js';
import NotaFiscal from './NotaFiscal.js';
import EstoqueRoupa from './EstoqueRoupa.js';
import EstoqueRoupaVariacao from './EstoqueRoupaVariacao.js';
import EstoqueRoupaFoto from './EstoqueRoupaFoto.js';
import EstoqueRoupaMovimento from './EstoqueRoupaMovimento.js';
import EstoqueRoupaInventario from './EstoqueRoupaInventario.js';
import NuvemshopIntegracao from './NuvemshopIntegracao.js';
import NuvemshopProdutoVinculo from './NuvemshopProdutoVinculo.js';
import Contrato from './Contrato.js';
import ContratoHistorico from './ContratoHistorico.js';
import Procuracao from './Procuracao.js';
import Departamento from './Departamento.js';
import LancamentoVinculo from './LancamentoVinculo.js';
import OrcamentoFinanceiro from './OrcamentoFinanceiro.js';
import CrmCampanha from './CrmCampanha.js';
import CrmProspect from './CrmProspect.js';
import CrmInteracao from './CrmInteracao.js';
import CrmScript from './CrmScript.js';
import CrmCampanhaFiltro from './CrmCampanhaFiltro.js';
import AutomacaoRegra from './Automacaoregra.js';
import AutomacaoExecucao from './AutomacaoExecucao.js';
import AutomacaoNotificacao from './AutomacaoNotificacao.js';
import Agendamento from './Agendamento.js';
import AgendamentoColaborador from './AgendamentoColaborador.js';
import AgendamentoServico from './AgendamentoServico.js';
import AgendamentoServicoUnidade from './AgendamentoServicoUnidade.js';
import AgendamentoUnidade from './AgendamentoUnidade.js';
import CentroCusto from './CentroCusto.js';
import CentroCustoDepartamento from './CentroCustoDepartamento.js';
import CentroCustoProjeto from './CentroCustoProjeto.js';
import RateioAutomatico from './RateioAutomatico.js';
import AgendamentoBloqueio from './AgendamentoBloqueio.js';
import PortalContadorDocumento from './PortalContadorDocumento.js';
import PortalContadorDocumentoLeitura from './PortalContadorDocumentoLeitura.js';
import PortalContadorDocumentoSolicitacao from './PortalContadorDocumentoSolicitacao.js';
import LojaPremio from './LojaPremio.js';
import LojaRoletaLead from './LojaRoletaLead.js';
import LojaPontosMovimento from './LojaPontosMovimento.js';
import LojaPontosResgate from './LojaPontosResgate.js';

// ── Contador ↔ User ──
User.hasOne(Contador, { foreignKey: 'user_id', as: 'contador' });
Contador.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });

Inventario.belongsTo(Product, { foreignKey: 'produto_id', as: 'produto' });
Product.hasMany(Inventario, { foreignKey: 'produto_id', as: 'inventarios' });

Venda.hasMany(VendaItem, { foreignKey: 'venda_id', as: 'itens' });
VendaItem.belongsTo(Venda, { foreignKey: 'venda_id', as: 'venda' });

// ASSOCIAÇÕES SIMPLIFICADAS - SEM 'as' PARA EVITAR CONFLITOS
VendaItem.belongsTo(Product, { foreignKey: 'produto_id' });
VendaItem.belongsTo(RawMaterial, { foreignKey: 'raw_material_id', as: 'rawMaterial' });
RawMaterial.hasMany(VendaItem, { foreignKey: 'raw_material_id' });
Product.hasMany(VendaItem, { foreignKey: 'produto_id' });

Venda.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasMany(Venda, { foreignKey: 'cliente_id', as: 'vendas' });

Venda.belongsTo(User, { foreignKey: 'funcionario_id', as: 'funcionario' });
User.hasMany(Venda, { foreignKey: 'funcionario_id', as: 'vendasRealizadas' });
Venda.belongsTo(Orcamento, { foreignKey: 'orcamento_id', as: 'orcamento' });
Orcamento.hasMany(Venda, { foreignKey: 'orcamento_id', as: 'vendas' });

// ── Comissão ↔ Venda / Funcionário ──
Comissao.belongsTo(Venda, { foreignKey: 'venda_id', as: 'venda' });
Venda.hasMany(Comissao, { foreignKey: 'venda_id', as: 'comissoes' });
Comissao.belongsTo(User, { foreignKey: 'funcionario_id', as: 'funcionario' });
User.hasMany(Comissao, { foreignKey: 'funcionario_id', as: 'comissoes' });
ComissaoServico.belongsTo(User, { foreignKey: 'funcionario_id', as: 'funcionario' });
User.hasMany(ComissaoServico, { foreignKey: 'funcionario_id', as: 'comissoesServico' });

// ── Orçamento ↔ Itens / Cliente / Funcionário ──
Orcamento.hasMany(OrcamentoItem, { foreignKey: 'orcamento_id', as: 'itens' });
OrcamentoItem.belongsTo(Orcamento, { foreignKey: 'orcamento_id', as: 'orcamento' });
OrcamentoItem.belongsTo(Product, { foreignKey: 'produto_id', as: 'produto' });
Orcamento.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasMany(Orcamento, { foreignKey: 'cliente_id', as: 'orcamentos' });
Orcamento.belongsTo(User, { foreignKey: 'funcionario_id', as: 'funcionario' });
User.hasMany(Orcamento, { foreignKey: 'funcionario_id', as: 'orcamentos' });

// ── Movimento ↔ Produto ──
Movimento.belongsTo(Product, { foreignKey: 'produto_id', as: 'produto' });
Product.hasMany(Movimento, { foreignKey: 'produto_id', as: 'movimentos' });

// ── TurnoCaixa ↔ User (abertura / fechamento) ──
TurnoCaixa.belongsTo(User, { foreignKey: 'func_abertura_id', as: 'funcionarioAbertura' });
TurnoCaixa.belongsTo(User, { foreignKey: 'func_fechamento_id', as: 'funcionarioFechamento' });

// ── Produção ──
Receita.hasMany(ReceitaItem, { foreignKey: 'receita_id', as: 'itens' });
ReceitaItem.belongsTo(Receita, { foreignKey: 'receita_id', as: 'receita' });
ReceitaItem.belongsTo(RawMaterial, { foreignKey: 'raw_material_id', as: 'materiaPrima' });
RawMaterial.hasMany(ReceitaItem, { foreignKey: 'raw_material_id', as: 'receitaItens' });
RawMaterial.hasMany(EntradaInsumoSemNota, { foreignKey: 'raw_material_id', as: 'entradasSemNota' });
EntradaInsumoSemNota.belongsTo(RawMaterial, { foreignKey: 'raw_material_id', as: 'insumo' });
Product.hasMany(EntradaInsumoSemNota, { foreignKey: 'produto_id', as: 'entradasInsumoSemNota' });
EntradaInsumoSemNota.belongsTo(Product, { foreignKey: 'produto_id', as: 'produto' });
User.hasMany(EntradaInsumoSemNota, { foreignKey: 'usuario_id', as: 'entradasInsumoSemNota' });
EntradaInsumoSemNota.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
ReceitaItem.belongsTo(Product, { foreignKey: 'produto_id', as: 'produtoMP' });
Product.hasMany(ReceitaItem, { foreignKey: 'produto_id', as: 'receitaItens' });
Receita.belongsTo(Product, { foreignKey: 'produto_id', as: 'produto' });
Product.hasMany(Receita, { foreignKey: 'produto_id', as: 'receitas' });
OrdemProducao.belongsTo(Receita, { foreignKey: 'receita_id', as: 'receita' });
Receita.hasMany(OrdemProducao, { foreignKey: 'receita_id', as: 'ordens' });

// Associações de Recorrência
Recorrencia.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasMany(Recorrencia, { foreignKey: 'cliente_id', as: 'recorrencias' });

HistoricoPagamento.belongsTo(Recorrencia, { foreignKey: 'recorrencia_id', as: 'recorrencia' });
Recorrencia.hasMany(HistoricoPagamento, { foreignKey: 'recorrencia_id', as: 'historicoPagamentos' });

RecorrenciaAuditoria.belongsTo(Recorrencia, { foreignKey: 'recorrencia_id', as: 'recorrencia' });
Recorrencia.hasMany(RecorrenciaAuditoria, { foreignKey: 'recorrencia_id', as: 'auditoria' });

// ── NotaFiscal ↔ Venda / Cliente ──
NotaFiscal.belongsTo(Venda, { foreignKey: 'venda_id', as: 'venda' });
Venda.hasMany(NotaFiscal, { foreignKey: 'venda_id', as: 'notasFiscais' });

// -- Contratos ↔ Empresa / Histórico
Contrato.hasMany(ContratoHistorico, { foreignKey: 'contrato_id', as: 'historico' });
ContratoHistorico.belongsTo(Contrato, { foreignKey: 'contrato_id', as: 'contrato' });

// -- Procurações ↔ Cliente / Contrato
Procuracao.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Procuracao.belongsTo(Contrato, { foreignKey: 'contrato_id', as: 'contrato' });

// -- Estoque de roupas foto --
EstoqueRoupa.hasMany(EstoqueRoupaVariacao, { foreignKey: 'roupa_id', as: 'variacoes' });
EstoqueRoupaVariacao.belongsTo(EstoqueRoupa, { foreignKey: 'roupa_id', as: 'roupa' });
EstoqueRoupaVariacao.hasMany(EstoqueRoupaFoto, { foreignKey: 'variacao_id', as: 'fotos', onDelete: 'CASCADE' });
EstoqueRoupaFoto.belongsTo(EstoqueRoupaVariacao, { foreignKey: 'variacao_id', as: 'variacao' });
EstoqueRoupa.hasMany(EstoqueRoupaMovimento, { foreignKey: 'roupa_id', as: 'movimentos' });
EstoqueRoupaMovimento.belongsTo(EstoqueRoupa, { foreignKey: 'roupa_id', as: 'roupa' });
EstoqueRoupaVariacao.hasMany(EstoqueRoupaMovimento, { foreignKey: 'variacao_id', as: 'movimentos' });
EstoqueRoupaMovimento.belongsTo(EstoqueRoupaVariacao, { foreignKey: 'variacao_id', as: 'variacao' });
EstoqueRoupa.hasMany(EstoqueRoupaInventario, { foreignKey: 'roupa_id', as: 'inventarios' });
EstoqueRoupaInventario.belongsTo(EstoqueRoupa, { foreignKey: 'roupa_id', as: 'roupa' });
EstoqueRoupaVariacao.hasMany(EstoqueRoupaInventario, { foreignKey: 'variacao_id', as: 'inventarios' });
EstoqueRoupaInventario.belongsTo(EstoqueRoupaVariacao, { foreignKey: 'variacao_id', as: 'variacao' });
NuvemshopIntegracao.hasMany(NuvemshopProdutoVinculo, { foreignKey: 'integracao_id', as: 'produtoVinculos', onDelete: 'CASCADE' });
NuvemshopProdutoVinculo.belongsTo(NuvemshopIntegracao, { foreignKey: 'integracao_id', as: 'integracao' });
EstoqueRoupa.hasMany(NuvemshopProdutoVinculo, { foreignKey: 'roupa_id', as: 'nuvemshopVinculos', onDelete: 'CASCADE' });
NuvemshopProdutoVinculo.belongsTo(EstoqueRoupa, { foreignKey: 'roupa_id', as: 'roupa' });
EstoqueRoupaVariacao.hasOne(NuvemshopProdutoVinculo, { foreignKey: 'variacao_id', as: 'nuvemshopVinculo', onDelete: 'SET NULL' });
NuvemshopProdutoVinculo.belongsTo(EstoqueRoupaVariacao, { foreignKey: 'variacao_id', as: 'variacao' });

// ── CRM Prospecção Comercial ──
CrmCampanha.hasMany(CrmProspect, { foreignKey: 'campaign_id', as: 'prospects', onDelete: 'CASCADE' });
CrmProspect.belongsTo(CrmCampanha, { foreignKey: 'campaign_id', as: 'campanha' });

CrmProspect.hasMany(CrmInteracao, { foreignKey: 'prospect_id', as: 'interacoes', onDelete: 'CASCADE' });
CrmInteracao.belongsTo(CrmProspect, { foreignKey: 'prospect_id', as: 'prospect' });

CrmCampanha.hasMany(CrmScript, { foreignKey: 'campaign_id', as: 'scripts', onDelete: 'SET NULL' });
CrmScript.belongsTo(CrmCampanha, { foreignKey: 'campaign_id', as: 'campanha' });

CrmCampanha.hasMany(CrmCampanhaFiltro, { foreignKey: 'campaign_id', as: 'filtros', onDelete: 'CASCADE' });
CrmCampanhaFiltro.belongsTo(CrmCampanha, { foreignKey: 'campaign_id', as: 'campanha' });

// ── Agenda ──
AgendamentoColaborador.hasMany(Agendamento, { foreignKey: 'colaborador_id', as: 'agendamentos', onDelete: 'CASCADE' });
Agendamento.belongsTo(AgendamentoColaborador, { foreignKey: 'colaborador_id', as: 'colaborador' });
Agendamento.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
AgendamentoServicoUnidade.belongsTo(AgendamentoServico, { foreignKey: 'servico_id', targetKey: 'id', as: 'servico' });
AgendamentoServicoUnidade.belongsTo(AgendamentoUnidade, { foreignKey: 'unidade_id', as: 'unidade' });

// ── Tarefa ↔ Subtarefas / StatusLogs ──
Tarefa.hasMany(Subtarefa, { foreignKey: 'tarefa_id', as: 'subtarefas', onDelete: 'CASCADE' });
Subtarefa.belongsTo(Tarefa, { foreignKey: 'tarefa_id' });
Tarefa.hasMany(TarefaStatusLog, { foreignKey: 'tarefa_id', as: 'statusLogs', onDelete: 'CASCADE' });
TarefaStatusLog.belongsTo(Tarefa, { foreignKey: 'tarefa_id' });

// ── Centro de Custos ──
CentroCusto.hasMany(CentroCustoDepartamento, { foreignKey: 'centro_custo_id', as: 'departamentos', onDelete: 'CASCADE' });
CentroCustoDepartamento.belongsTo(CentroCusto, { foreignKey: 'centro_custo_id', as: 'centroCusto' });

CentroCustoDepartamento.belongsTo(Departamento, { foreignKey: 'departamento_id', as: 'departamento' });
Departamento.hasMany(CentroCustoDepartamento, { foreignKey: 'departamento_id', as: 'centrosCusto' });

CentroCusto.hasMany(CentroCustoProjeto, { foreignKey: 'centro_custo_id', as: 'projetos', onDelete: 'CASCADE' });
CentroCustoProjeto.belongsTo(CentroCusto, { foreignKey: 'centro_custo_id', as: 'centroCusto' });

CentroCusto.hasOne(RateioAutomatico, { foreignKey: 'centro_custo_id', as: 'rateio', onDelete: 'CASCADE' });
RateioAutomatico.belongsTo(CentroCusto, { foreignKey: 'centro_custo_id', as: 'centroCusto' });

import ProductCategory from './ProductCategory.js';
ProductCategory.sync({ alter: false }).catch(() => ProductCategory.sync());

Marketing.sync({ alter: false }).catch(() => Marketing.sync());
Tarefa.sync({ alter: false }).catch(() => Tarefa.sync());
Subtarefa.sync({ alter: false }).catch(() => Subtarefa.sync());
TarefaStatusLog.sync({ alter: false }).catch(() => TarefaStatusLog.sync());
Pedido.sync({ alter: false }).catch(() => Pedido.sync());
NotaFiscal.sync({ alter: false }).catch(() => NotaFiscal.sync());
EstoqueRoupa.sync({ alter: false }).catch(() => EstoqueRoupa.sync());
EstoqueRoupaVariacao.sync({ alter: false }).catch(() => EstoqueRoupaVariacao.sync());
EstoqueRoupaFoto.sync({ alter: false }).catch(() => EstoqueRoupaFoto.sync());
VendaItem.sync({ alter: false }).catch(() => {});
Movimento.sync({ alter: false }).catch(() => {});
OrcamentoItem.sync({ alter: false }).catch(() => {});
Inventario.sync({ alter: false }).catch(() => {});
PortalContadorDocumento.sync({ alter: false }).catch(() => PortalContadorDocumento.sync());
PortalContadorDocumentoLeitura.sync({ alter: false }).catch(() => PortalContadorDocumentoLeitura.sync());
PortalContadorDocumentoSolicitacao.sync({ alter: false }).catch(() => PortalContadorDocumentoSolicitacao.sync());
(async () => {
    try {
        await AgendamentoColaborador.sync({ alter: false });
        await AgendamentoServico.sync({ alter: false });
        await Agendamento.sync({ alter: false });
    } catch {
        try {
            await AgendamentoColaborador.sync();
            await AgendamentoServico.sync();
            await Agendamento.sync();
        } catch { }
    }
})();
// Garante colunas novas em Products (executa no boot, sem travar)
import('../config/database.js').then(({ default: sequelize }) => {
    const cols = [
        `ALTER TABLE vendas ADD COLUMN IF NOT EXISTS origem VARCHAR(30) NOT NULL DEFAULT 'caixa'`,
        `ALTER TABLE vendas ADD COLUMN IF NOT EXISTS status_loja VARCHAR(30)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_ativo BOOLEAN NOT NULL DEFAULT false`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_preco DECIMAL(10,2)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_categoria VARCHAR(120)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_descricao TEXT`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_foto_url TEXT`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_foto_public_id VARCHAR(255)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_secoes JSONB NOT NULL DEFAULT '[]'::jsonb`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_ordem INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_destaque BOOLEAN NOT NULL DEFAULT false`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_promocao BOOLEAN NOT NULL DEFAULT false`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_preco_original DECIMAL(10,2)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_granel BOOLEAN NOT NULL DEFAULT false`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS loja_online_preco_kg DECIMAL(10,2)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS preco_compra DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS tipo_preco_venda VARCHAR(20) DEFAULT 'valor'`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS percentual_lucro DECIMAL(10,2)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS fabricante VARCHAR(255)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS is_materia_prima BOOLEAN DEFAULT false`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidade_medida VARCHAR(50)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidade_comercial VARCHAR(50)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidade_tributavel VARCHAR(50)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS unidades_por_caixa INTEGER`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS lote VARCHAR(100)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS data_validade DATE`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS peso_bruto DECIMAL(10,3)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS peso_liquido DECIMAL(10,3)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cest VARCHAR(20)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cst_csosn VARCHAR(10)`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_icms DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_pis DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_cofins DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS aliquota_ipi DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cst_pis VARCHAR(2) DEFAULT '07'`,
        `ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS cst_cofins VARCHAR(2) DEFAULT '07'`,
    ];
    cols.forEach(sql => sequelize.query(sql).catch(() => { }));

    const colsFuncionario = [
        `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS historicopagamentos JSONB DEFAULT '[]'`,
        `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS historicopromocoes JSONB DEFAULT '[]'`,
        `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS historicoferias JSONB DEFAULT '[]'`,
        `ALTER TABLE funcionarios_custos ADD COLUMN IF NOT EXISTS datapagamento VARCHAR(7)`,
    ];
    colsFuncionario.forEach(sql => sequelize.query(sql).catch(() => { }));

    const colsRawMaterial = [
        `ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS min_quantity DECIMAL(10,3) DEFAULT 0`
    ]
    colsRawMaterial.forEach(sql => sequelize.query(sql).catch(() => { }));

    // Coluna que liga Product → RawMaterial (para MPs espelhadas no estoque)
    sequelize.query(`ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS raw_material_id INTEGER`).catch(() => { });
    sequelize.query(`ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS granel_origem_id INTEGER`).catch(() => { });
    sequelize.query(`ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS caixa_origem_id INTEGER`).catch(() => { });

    // Planejamento: setor_id e coluna_custom_id nas tarefas
    sequelize.query(`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS setor_id INTEGER`).catch(() => { });
    sequelize.query(`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS coluna_custom_id INTEGER`).catch(() => { });

    // Planejamento: tabelas de colunas customizadas e setores
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS kanban_colunas (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            nome VARCHAR(80) NOT NULL,
            cor VARCHAR(20) DEFAULT '#6b7280',
            ordem INTEGER NOT NULL DEFAULT 99,
            integra_ponto BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS setores_planejamento (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            nome VARCHAR(100) NOT NULL,
            descricao TEXT,
            cor VARCHAR(20) DEFAULT '#3b82f6',
            criado_por INTEGER,
            membros JSONB DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => { });

    // Agenda: tabelas reais usadas pela aba /uikit/agendamentos
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS agendamento_colaboradores (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            usuario_id INTEGER,
            usuario_nome VARCHAR(200) NOT NULL,
            cor VARCHAR(20) DEFAULT '#3b82f6',
            ordem INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS agendamento_servicos (
            id VARCHAR(80) NOT NULL,
            empresa_id INTEGER NOT NULL,
            nome VARCHAR(200) NOT NULL,
            duracao_min INTEGER NOT NULL DEFAULT 30,
            preco DECIMAL(10,2) NOT NULL DEFAULT 0,
            cor VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
            ativo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (id, empresa_id)
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS agendamentos (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            cliente_id INTEGER,
            colaborador_id INTEGER NOT NULL,
            servico_id VARCHAR(80),
            servico_nome VARCHAR(200),
            data DATE NOT NULL,
            horario VARCHAR(5) NOT NULL,
            observacao TEXT,
            status VARCHAR(30) NOT NULL DEFAULT 'aguardando',
            criado_em TIMESTAMPTZ DEFAULT NOW(),
            forma_pagamento VARCHAR(50),
            cliente_nome VARCHAR(200) NOT NULL,
            cliente_telefone VARCHAR(30),
            cliente_email VARCHAR(200),
            cliente_nascimento DATE,
            historico JSONB DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => { });

    [
        `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS empresa_id INTEGER`,
        `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS usuario_id INTEGER`,
        `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR(200)`,
        `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT '#3b82f6'`,
        `ALTER TABLE agendamento_colaboradores ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0`,
        `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS empresa_id INTEGER`,
        `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS nome VARCHAR(200)`,
        `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS duracao_min INTEGER DEFAULT 30`,
        `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT '#3b82f6'`,
        `ALTER TABLE agendamento_servicos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS empresa_id INTEGER`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_id INTEGER`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS colaborador_id INTEGER`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS servico_id VARCHAR(80)`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS servico_nome VARCHAR(200)`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS servicos JSONB NOT NULL DEFAULT '[]'::jsonb`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS data DATE`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS horario VARCHAR(5)`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS observacao TEXT`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'aguardando'`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW()`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(50)`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(200)`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(30)`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(200)`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_nascimento DATE`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'`,
        `ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS encaixe_forcado BOOLEAN NOT NULL DEFAULT false`,
    ].forEach(sql => sequelize.query(sql).catch(() => { }));

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS agendamento_bloqueios (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            colaborador_id INTEGER NOT NULL,
            data DATE NOT NULL,
            hora_inicio TIME,
            hora_fim TIME,
            motivo VARCHAR(300),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => {});
    sequelize.query(`CREATE INDEX IF NOT EXISTS idx_agendamento_bloqueios_consulta ON agendamento_bloqueios (empresa_id, colaborador_id, data)`).catch(() => {});
    sequelize.query(`ALTER TABLE agendamento_bloqueios ADD COLUMN IF NOT EXISTS hora_inicio TIME`).catch(() => {});
    sequelize.query(`ALTER TABLE agendamento_bloqueios ADD COLUMN IF NOT EXISTS hora_fim TIME`).catch(() => {});

    sequelize.query(`ALTER TABLE crm_prospects ADD COLUMN IF NOT EXISTS landline VARCHAR(50)`).catch(() => {});
    sequelize.query(`ALTER TABLE crm_prospects ADD COLUMN IF NOT EXISTS linkedin VARCHAR(500)`).catch(() => {});
    sequelize.query(`ALTER TABLE crm_prospects ADD COLUMN IF NOT EXISTS youtube VARCHAR(500)`).catch(() => {});
    sequelize.query(`ALTER TABLE crm_prospects ADD COLUMN IF NOT EXISTS tiktok VARCHAR(500)`).catch(() => {});
    sequelize.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE`).catch(() => { });
    sequelize.query(`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS endereco_entrega VARCHAR(500)`).catch(() => { });
    sequelize.query(`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS endereco_entrega VARCHAR(500)`).catch(() => {});

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS portal_contador_documentos (
            id SERIAL PRIMARY KEY,
            contador_empresa_id INTEGER,
            empresa_cliente_id INTEGER NOT NULL,
            nome VARCHAR(255) NOT NULL,
            tipo VARCHAR(80) NOT NULL DEFAULT 'documento',
            competencia VARCHAR(7),
            descricao TEXT,
            arquivo_url TEXT NOT NULL,
            arquivo_public_id VARCHAR(500) NOT NULL,
            arquivo_nome_original VARCHAR(255) NOT NULL,
            arquivo_mime_type VARCHAR(120),
            arquivo_tamanho INTEGER,
            enviado_por INTEGER,
            status_leitura VARCHAR(20) NOT NULL DEFAULT 'novo',
            baixado_em TIMESTAMPTZ,
            baixado_por INTEGER,
            baixado_por_nome VARCHAR(255),
            baixado_por_tipo VARCHAR(30),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => {});

    [
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS contador_empresa_id INTEGER`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS empresa_cliente_id INTEGER`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS nome VARCHAR(255)`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS tipo VARCHAR(80) DEFAULT 'documento'`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS competencia VARCHAR(7)`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS descricao TEXT`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS arquivo_url TEXT`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS arquivo_public_id VARCHAR(500)`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS arquivo_nome_original VARCHAR(255)`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS arquivo_mime_type VARCHAR(120)`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS arquivo_tamanho INTEGER`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS enviado_por INTEGER`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS status_leitura VARCHAR(20) DEFAULT 'novo'`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS baixado_em TIMESTAMPTZ`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS baixado_por INTEGER`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS baixado_por_nome VARCHAR(255)`,
        `ALTER TABLE portal_contador_documentos ADD COLUMN IF NOT EXISTS baixado_por_tipo VARCHAR(30)`,
    ].forEach(sql => sequelize.query(sql).catch(() => {}));

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS portal_contador_documento_leituras (
            id SERIAL PRIMARY KEY,
            documento_id INTEGER NOT NULL,
            usuario_id INTEGER,
            usuario_nome VARCHAR(255),
            usuario_tipo VARCHAR(30) NOT NULL DEFAULT 'empresa',
            acao VARCHAR(30) NOT NULL DEFAULT 'download',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => {});

    [
        `ALTER TABLE portal_contador_documento_leituras ADD COLUMN IF NOT EXISTS documento_id INTEGER`,
        `ALTER TABLE portal_contador_documento_leituras ADD COLUMN IF NOT EXISTS usuario_id INTEGER`,
        `ALTER TABLE portal_contador_documento_leituras ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR(255)`,
        `ALTER TABLE portal_contador_documento_leituras ADD COLUMN IF NOT EXISTS usuario_tipo VARCHAR(30) DEFAULT 'empresa'`,
        `ALTER TABLE portal_contador_documento_leituras ADD COLUMN IF NOT EXISTS acao VARCHAR(30) DEFAULT 'download'`,
        `ALTER TABLE portal_contador_documento_leituras ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    ].forEach(sql => sequelize.query(sql).catch(() => {}));

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS portal_contador_documento_solicitacoes (
            id SERIAL PRIMARY KEY,
            contador_empresa_id INTEGER,
            empresa_cliente_id INTEGER NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            tipo VARCHAR(80) NOT NULL DEFAULT 'documento',
            competencia VARCHAR(7),
            descricao TEXT,
            prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',
            status VARCHAR(30) NOT NULL DEFAULT 'aberta',
            solicitado_por INTEGER,
            solicitado_por_nome VARCHAR(255),
            solicitado_por_tipo VARCHAR(30) NOT NULL DEFAULT 'empresa',
            atendido_em TIMESTAMPTZ,
            historico JSONB DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => {});

    [
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS contador_empresa_id INTEGER`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS empresa_cliente_id INTEGER`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS titulo VARCHAR(255)`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS tipo VARCHAR(80) DEFAULT 'documento'`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS competencia VARCHAR(7)`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS descricao TEXT`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'normal'`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'aberta'`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS solicitado_por INTEGER`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS solicitado_por_nome VARCHAR(255)`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS solicitado_por_tipo VARCHAR(30) DEFAULT 'empresa'`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS atendido_em TIMESTAMPTZ`,
        `ALTER TABLE portal_contador_documento_solicitacoes ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'`,
    ].forEach(sql => sequelize.query(sql).catch(() => {}));

    // Garante que datas de tarefas sejam TIMESTAMP (não DATE), para preservar horário
    [
        `ALTER TABLE tarefas ALTER COLUMN data_inicio TYPE TIMESTAMP WITH TIME ZONE USING data_inicio::TIMESTAMP WITH TIME ZONE`,
        `ALTER TABLE tarefas ALTER COLUMN data_entrega TYPE TIMESTAMP WITH TIME ZONE USING data_entrega::TIMESTAMP WITH TIME ZONE`,
        `ALTER TABLE tarefas ALTER COLUMN data_conclusao TYPE TIMESTAMP WITH TIME ZONE USING data_conclusao::TIMESTAMP WITH TIME ZONE`,
        `ALTER TABLE tarefas ALTER COLUMN data_limite_retorno TYPE TIMESTAMP WITH TIME ZONE USING data_limite_retorno::TIMESTAMP WITH TIME ZONE`,
    ].forEach(sql => sequelize.query(sql).catch(() => { }));

    // NÃO usar Product.sync({ alter: true }) — causa remoção de colunas via pooler do Neon
    // Colunas novas são adicionadas via ALTER TABLE IF NOT EXISTS acima
    VendaItem.sync({ alter: false }).catch(() => { }); // alter:true dropa colunas no Neon pooler — usar ALTER TABLE IF NOT EXISTS
    Movimento.sync({ alter: false }).catch(() => { });
    OrcamentoItem.sync({ alter: false }).catch(() => { });
    Inventario.sync({ alter: false }).catch(() => { });

    // Adiciona /dashboard nas permissões de todas as empresas que ainda não têm
    sequelize.query(`
        UPDATE empresas
        SET permissoes = permissoes || '["/dashboard"]'::jsonb
        WHERE NOT (permissoes @> '["/dashboard"]'::jsonb)
        AND permissoes IS NOT NULL
    `).catch(() => { });

    // Adiciona /dashboard nas permissões dos donos de empresa (tipo EMPRESA ou cargo Dono)
    sequelize.query(`
        UPDATE users
        SET permissoes = COALESCE(permissoes, '[]'::jsonb) || '["/dashboard"]'::jsonb
        WHERE (tipo = 'EMPRESA' OR cargo = 'Dono')
        AND NOT (COALESCE(permissoes, '[]'::jsonb) @> '["/dashboard"]'::jsonb)
    `).catch(() => { });

    // Tabela de Notas Fiscais (garante criação mesmo se sync() falhar)
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS notas_fiscais (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER,
            venda_id INTEGER,
            referencia VARCHAR(100),
            tipo VARCHAR(10) NOT NULL DEFAULT 'nfe',
            status VARCHAR(20) NOT NULL DEFAULT 'processando',
            chave_acesso VARCHAR(50),
            numero VARCHAR(20),
            serie VARCHAR(5),
            caminho_xml TEXT,
            caminho_danfe TEXT,
            qrcode_url TEXT,
            protocolo_sefaz VARCHAR(50),
            mensagem_sefaz TEXT,
            data_emissao TIMESTAMPTZ,
            payload_enviado JSONB,
            resposta_api JSONB,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    // Tabela de ponto eletrônico
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS attendance_records (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER,
            employee_id INTEGER,
            employee_name VARCHAR(255) NOT NULL,
            employee_cargo VARCHAR(100),
            date DATE NOT NULL,
            check_in VARCHAR(8),
            lunch_out VARCHAR(8),
            lunch_return VARCHAR(8),
            check_out VARCHAR(8),
            total_hours DECIMAL(5,2),
            extra_hours DECIMAL(5,2),
            late_minutes INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'AUSENTE',
            observation TEXT,
            imported BOOLEAN DEFAULT false,
            imported_file VARCHAR(255),
            imported_at TIMESTAMP,
            audit_log JSONB DEFAULT '[]',
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    // Tabelas NFS-e
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS services (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            value DECIMAL(15,2) DEFAULT 0,
            item_lista_servico VARCHAR(10),
            codigo_tributacao_municipio VARCHAR(20),
            codigo_cnae VARCHAR(10),
            aliquota DECIMAL(5,2) DEFAULT 0,
            codigo_municipio VARCHAR(10),
            discriminacao_padrao TEXT,
            percentual_tributos DECIMAL(5,2) DEFAULT 0,
            ativo BOOLEAN DEFAULT true,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS service_invoices (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER,
            reference VARCHAR(100) UNIQUE,
            rps_numero INTEGER,
            service_id INTEGER,
            service_name VARCHAR(255),
            service_description TEXT,
            customer_name VARCHAR(255),
            customer_cpf_cnpj VARCHAR(20),
            customer_email VARCHAR(255),
            customer_phone VARCHAR(20),
            customer_inscricao_municipal VARCHAR(30),
            customer_logradouro VARCHAR(255),
            customer_numero VARCHAR(20),
            customer_complemento VARCHAR(100),
            customer_bairro VARCHAR(100),
            customer_cidade VARCHAR(100),
            customer_uf VARCHAR(2),
            customer_cep VARCHAR(10),
            customer_codigo_municipio VARCHAR(10),
            valor_servicos DECIMAL(15,2) DEFAULT 0,
            desconto DECIMAL(15,2) DEFAULT 0,
            deducoes DECIMAL(15,2) DEFAULT 0,
            valor_liquido DECIMAL(15,2) DEFAULT 0,
            pis DECIMAL(15,2) DEFAULT 0,
            cofins DECIMAL(15,2) DEFAULT 0,
            inss DECIMAL(15,2) DEFAULT 0,
            irrf DECIMAL(15,2) DEFAULT 0,
            csll DECIMAL(15,2) DEFAULT 0,
            iss DECIMAL(15,2) DEFAULT 0,
            iss_retido BOOLEAN DEFAULT false,
            outras_retencoes DECIMAL(15,2) DEFAULT 0,
            item_lista_servico VARCHAR(10),
            codigo_tributacao_municipio VARCHAR(20),
            codigo_cnae VARCHAR(10),
            aliquota DECIMAL(5,2) DEFAULT 0,
            natureza_operacao INTEGER DEFAULT 1,
            optante_simples_nacional BOOLEAN DEFAULT false,
            status VARCHAR(50) DEFAULT 'pendente',
            nfse_number VARCHAR(50),
            verification_code VARCHAR(100),
            xml_url TEXT,
            pdf_url TEXT,
            focus_response JSONB,
            error_messages JSONB,
            cancelamento_justificativa TEXT,
            email_enviado_em TIMESTAMP,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS nfse_configs (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER UNIQUE,
            inscricao_municipal VARCHAR(30),
            codigo_municipio VARCHAR(10),
            optante_simples_nacional BOOLEAN DEFAULT false,
            incentivador_cultural BOOLEAN DEFAULT false,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    // Coluna cargos na tabela empresas (persiste definições de cargos no banco)
    sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cargos JSONB DEFAULT '[]'`).catch(() => { });
    sequelize.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS configuracoes JSONB DEFAULT '{}'`).catch(() => { });

    sequelize.query(`ALTER TABLE estoque_roupas ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500)`).catch(() => { });
    sequelize.query(`ALTER TABLE estoque_roupas ALTER COLUMN tamanho DROP NOT NULL`).catch(() => { });

    sequelize.query(`ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'produto'`).catch(() => { });
    sequelize.query(`ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS roupa_id INTEGER`).catch(() => { });
    sequelize.query(`ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS variacao_id INTEGER`).catch(() => { });
    sequelize.query(`ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS raw_material_id INTEGER`).catch(() => { });
    sequelize.query(`ALTER TABLE venda_itens ALTER COLUMN produto_id DROP NOT NULL`).catch(() => { });
    // Permite deletar usuário sem perder histórico de comissões
    sequelize.query(`ALTER TABLE comissoes ALTER COLUMN funcionario_id DROP NOT NULL`).catch(() => { });

    // Coluna responsaveis (array JSONB) em tarefas
    sequelize.query(`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS responsaveis JSONB DEFAULT '[]'`).catch(() => { });
    // Coluna data_conclusao em tarefas
    sequelize.query(`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ`).catch(() => { });

    // Corrige funcionarios_custos criados com empresa_id = 1 hardcoded
    // Reassina para a empresa correta quando há apenas uma empresa no sistema
    sequelize.query(`
        UPDATE funcionarios_custos
        SET empresa_id = (SELECT id FROM empresas ORDER BY id LIMIT 1)
        WHERE empresa_id = 1
          AND (SELECT COUNT(*) FROM empresas) = 1
    `).catch(() => { });
    // Se houver mais de uma empresa, distribui baseado em qual empresa tem mais funcionários
    sequelize.query(`
        UPDATE funcionarios_custos f
        SET empresa_id = (
            SELECT e.id FROM empresas e
            ORDER BY (SELECT COUNT(*) FROM funcionarios_custos f2 WHERE f2.empresa_id = e.id AND f2.empresa_id != 1) DESC
            LIMIT 1
        )
        WHERE f.empresa_id = 1
          AND (SELECT COUNT(*) FROM empresas) > 1
    `).catch(() => { });

    // Tabela de eventos do calendário de planejamento
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS calendario_eventos (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER,
            titulo VARCHAR(300) NOT NULL,
            descricao TEXT,
            data_inicio TIMESTAMPTZ NOT NULL,
            data_fim TIMESTAMPTZ,
            responsavel VARCHAR(200),
            tipo VARCHAR(20) NOT NULL DEFAULT 'evento',
            cor VARCHAR(20) DEFAULT '#3b82f6',
            dia_todo BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    // Tabela de contratos
    sequelize.query(`
    CREATE TABLE IF NOT EXISTS contratos (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        partes_envolvidas VARCHAR(255) NOT NULL,
        tipo_parte VARCHAR(50) NOT NULL,
        tipo_contrato VARCHAR(50) NOT NULL,
        valor DECIMAL(15,2),
        data_inicio DATE NOT NULL,
        data_vencimento DATE NOT NULL,
        periodicidade VARCHAR(20) NOT NULL DEFAULT 'sem_renovacao',
        status VARCHAR(20) NOT NULL DEFAULT 'em_analise',
        responsavel_interno VARCHAR(255),
        observacoes TEXT,
        corpo_contrato TEXT,
        pdf_url TEXT,
        empresa_id INTEGER NOT NULL,
        criado_por INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
        )
        `).catch(() => { });

    sequelize.query(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS observacoes_tipo  VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS contratante VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS contratado VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE contratos ALTER COLUMN partes_envolvidas TYPE JSONB USING partes_envolvidas::jsonb`).catch(() => { });
    sequelize.query(`ALTER TABLE contratos ALTER COLUMN tipo_parte TYPE JSONB USING NULL`).catch(() => { });
    sequelize.query(`ALTER TABLE procuracoes ADD COLUMN IF NOT EXISTS contrato_id INTEGER`).catch(() => { });
    sequelize.query(`ALTER TABLE procuracoes ADD COLUMN IF NOT EXISTS anexo_url VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE procuracoes ADD COLUMN IF NOT EXISTS anexo_public_id VARCHAR(255)`).catch(() => { });
    // Tabela de histórico de contratos
    sequelize.query(`
    CREATE TABLE IF NOT EXISTS contratos_historico (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL,
        usuario_id INTEGER,
        usuario_nome VARCHAR(255),
        campo_alterado VARCHAR(255) NOT NULL,
        valor_anterior TEXT,
        valor_novo TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )
`).catch(() => { });

    sequelize.query(`
    CREATE TABLE IF NOT EXISTS procuracoes (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(20) NOT NULL,
        outorgante_nome VARCHAR(255) NOT NULL,
        outorgante_documento VARCHAR(20),
        outorgado_nome VARCHAR(255) NOT NULL,
        outorgado_documento VARCHAR(20),
        data_emissao DATE NOT NULL,
        data_validade DATE,
        numero_referencia VARCHAR(100),
        poderes TEXT,
        observacoes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'ativa',
        data_revogacao DATE,
        motivo_revogacao TEXT,
        cliente_id INTEGER,
        empresa_id INTEGER NOT NULL,
        criado_por INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )
`).catch(() => { });

    // Tabelas do módulo CRM Prospecção Comercial
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS crm_campanhas (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            segment VARCHAR(255),
            description TEXT,
            states JSONB DEFAULT '[]',
            cities JSONB DEFAULT '[]',
            neighborhoods JSONB DEFAULT '[]',
            radius INTEGER DEFAULT 5,
            created_by INTEGER,
            empresa_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS crm_prospects (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER,
            empresa_id INTEGER,
            company_name VARCHAR(255) NOT NULL,
            responsible_name VARCHAR(255),
            phone VARCHAR(50),
            email VARCHAR(255),
            instagram VARCHAR(255),
            website VARCHAR(500),
            address TEXT,
            city VARCHAR(255),
            state VARCHAR(50),
            google_place_id VARCHAR(255),
            google_rating DECIMAL(3,1),
            google_reviews INTEGER DEFAULT 0,
            lead_score INTEGER DEFAULT 0,
            status VARCHAR(50) DEFAULT 'Novo',
            observations TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS crm_interacoes (
            id SERIAL PRIMARY KEY,
            prospect_id INTEGER NOT NULL,
            user_id INTEGER,
            empresa_id INTEGER,
            interaction_type VARCHAR(100),
            content TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS crm_scripts (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER,
            empresa_id INTEGER,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            script_type VARCHAR(100) DEFAULT 'primeiro_contato',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS crm_campanha_filtros (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER NOT NULL,
            state VARCHAR(50),
            city VARCHAR(255),
            neighborhood VARCHAR(255),
            radius INTEGER DEFAULT 5,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    // Novas colunas para o sistema de ponto por botões
    const colsAttendance = [
        `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS pauses JSONB DEFAULT '[]'`,
        `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS total_pause_minutes DECIMAL(8,2) DEFAULT 0`,
        `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS extra_inicio VARCHAR(8)`,
    ];
    colsAttendance.forEach(sql => sequelize.query(sql).catch(() => { }));

    // Correção de dados órfãos: funcionários e registros de ponto sem empresa_id
    // Atribui à empresa com menor ID (mais antiga) para evitar orphans
    sequelize.query(`
        UPDATE funcionarios_custos
        SET empresa_id = (SELECT MIN(id) FROM empresas)
        WHERE empresa_id IS NULL
          AND (SELECT COUNT(*) FROM empresas) = 1
    `).catch(() => { });

    sequelize.query(`
        UPDATE attendance_records
        SET empresa_id = (SELECT MIN(id) FROM empresas)
        WHERE empresa_id IS NULL
          AND (SELECT COUNT(*) FROM empresas) = 1
    `).catch(() => { });

    // Coluna natureza (ENTRADA/SAIDA) na tabela saidas — generaliza para lançamentos manuais
    sequelize.query(`ALTER TABLE saidas ADD COLUMN IF NOT EXISTS natureza VARCHAR(10) NOT NULL DEFAULT 'SAIDA'`).catch(() => { });
    sequelize.query(`ALTER TABLE saidas ADD COLUMN IF NOT EXISTS categoria VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE saidas ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendente'`).catch(() => { });
    sequelize.query(`ALTER TABLE saidas ADD COLUMN IF NOT EXISTS comprovante_url VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE saidas ADD COLUMN IF NOT EXISTS comprovante_public_id VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE saidas ADD COLUMN IF NOT EXISTS comprovante_url VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS anexo_public_id VARCHAR(255)`).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS departamentos (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            empresa_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS orcamentos_financeiros (
            id SERIAL PRIMARY KEY,
            mes INTEGER NOT NULL,
            ano INTEGER NOT NULL,
            categoria VARCHAR(255) NOT NULL,
            tipo VARCHAR(10) NOT NULL,
            valor_previsto DECIMAL(15,2) NOT NULL DEFAULT 0,
            empresa_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS lancamento_vinculos (
            id SERIAL PRIMARY KEY,
            saida_id INTEGER NOT NULL,
            produto_id INTEGER,
            rateio JSONB,
            responsavel VARCHAR(255),
            empresa_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    // Google OAuth: colunas adicionais na tabela users (idempotente, não afeta registros antigos)
    sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`).catch(() => { });
    sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`).catch(() => { });

    // Automação Inteligente
    sequelize.query(`
        CREATE TABLE IF NOT EXISTS automacao_regras (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            descricao TEXT,
            evento_gatilho VARCHAR(100) NOT NULL,
            parametros_gatilho JSONB DEFAULT '{}',
            acoes JSONB DEFAULT '[]',
            status VARCHAR(20) NOT NULL DEFAULT 'ativo',
            total_execucoes INTEGER NOT NULL DEFAULT 0,
            ultima_execucao TIMESTAMP,
            falhas_consecutivas INTEGER NOT NULL DEFAULT 0,
            empresa_id INTEGER NOT NULL,
            criado_por INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS automacao_execucoes (
            id SERIAL PRIMARY KEY,
            regra_id INTEGER NOT NULL,
            evento VARCHAR(100) NOT NULL,
            resultado VARCHAR(20) NOT NULL,
            duracao_ms INTEGER,
            detalhes JSONB DEFAULT '{}',
            erro_mensagem TEXT,
            empresa_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    sequelize.query(`
        CREATE TABLE IF NOT EXISTS automacao_notificacoes (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            regra_id INTEGER,
            tipo VARCHAR(20) NOT NULL DEFAULT 'info',
            titulo VARCHAR(255) NOT NULL,
            mensagem TEXT NOT NULL,
            lida BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => { });

    // Centro de Custos
    sequelize.query(`
    CREATE TABLE IF NOT EXISTS centros_de_custos (
        id          SERIAL PRIMARY KEY,
        nome        VARCHAR(255) NOT NULL,
        descricao   TEXT,
        budget      DECIMAL(10,2) NOT NULL DEFAULT 0,
        empresa_id  INTEGER NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
    )
`).catch(() => { });

    // Vincula saídas a centros de custo (idempotente)
    sequelize.query(`
    ALTER TABLE saidas ADD COLUMN IF NOT EXISTS centro_custo_id INTEGER REFERENCES centros_de_custos(id) ON DELETE SET NULL
`).catch(() => { });

    // Vincula centros de custo a departamentos
    sequelize.query(`
    CREATE TABLE IF NOT EXISTS centro_custo_departamentos (
        id                SERIAL PRIMARY KEY,
        centro_custo_id   INTEGER NOT NULL REFERENCES centros_de_custos(id) ON DELETE CASCADE,
        departamento_id   INTEGER NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
        empresa_id        INTEGER NOT NULL,
        created_at        TIMESTAMP DEFAULT NOW(),
        UNIQUE(centro_custo_id, departamento_id)
    )
`).catch(() => { });

    // Projetos vinculados a centros de custo
    sequelize.query(`
    CREATE TABLE IF NOT EXISTS centro_custo_projetos (
        id                SERIAL PRIMARY KEY,
        centro_custo_id   INTEGER NOT NULL REFERENCES centros_de_custos(id) ON DELETE CASCADE,
        nome              VARCHAR(255) NOT NULL,
        descricao         TEXT,
        budget            DECIMAL(10,2) NOT NULL DEFAULT 0,
        empresa_id        INTEGER NOT NULL,
        created_at        TIMESTAMP DEFAULT NOW(),
        updated_at        TIMESTAMP DEFAULT NOW()
    )
`).catch(() => { });

    // Configuração de rateio automático por centro de custo
    sequelize.query(`
    CREATE TABLE IF NOT EXISTS rateio_automatico (
        id                SERIAL PRIMARY KEY,
        centro_custo_id   INTEGER NOT NULL REFERENCES centros_de_custos(id) ON DELETE CASCADE,
        metodo            VARCHAR(50) NOT NULL CHECK (metodo IN ('proporcional_area', 'por_usuario', 'por_departamento', 'personalizado')),
        configuracao      JSONB DEFAULT '{}',
        ativo             BOOLEAN NOT NULL DEFAULT true,
        empresa_id        INTEGER NOT NULL,
        created_at        TIMESTAMP DEFAULT NOW(),
        updated_at        TIMESTAMP DEFAULT NOW()
    )
`).catch(() => { });

});

    LojaPremio.hasMany(LojaRoletaLead, { foreignKey: 'premio_id', as: 'leads' });
    LojaRoletaLead.belongsTo(LojaPremio, { foreignKey: 'premio_id', as: 'premio' });
    LojaPontosMovimento.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
    LojaPontosMovimento.belongsTo(Venda, { foreignKey: 'venda_id', as: 'venda' });
    LojaPontosResgate.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
    LojaPontosResgate.belongsTo(LojaPremio, { foreignKey: 'premio_id', as: 'premio' });

    // sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`).catch(() => {});
    // sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`).catch(() => {});

export { Product, Inventario, Venda, VendaItem, Cliente, User, Comissao, Orcamento, OrcamentoItem, Movimento, TurnoCaixa, Marketing, Pedido, Recorrencia, HistoricoPagamento, RecorrenciaConfiguracao, RecorrenciaPlano, RecorrenciaAuditoria, Contrato, ContratoHistorico, EstoqueRoupaVariacao, Procuracao, CrmCampanha, CrmProspect, CrmInteracao, CrmScript, CrmCampanhaFiltro, AutomacaoRegra, AutomacaoExecucao, AutomacaoNotificacao, CentroCusto, CentroCustoDepartamento, CentroCustoProjeto, RateioAutomatico, Contador };
