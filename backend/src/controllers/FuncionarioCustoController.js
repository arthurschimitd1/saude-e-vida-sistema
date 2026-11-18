// backend/src/controllers/FuncionarioCustoController.js
import FuncionarioCusto from '../models/FuncionarioCusto.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

export const getFuncionarios = async (req, res) => {
    try {
        const where = {};
        aplicarEmpresaScope(where, req.user);

        const funcionarios = await FuncionarioCusto.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });
        res.json(funcionarios);
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createFuncionario = async (req, res) => {
    try {
        const data = {
            nomeCompleto: req.body.nomeCompleto,
            cpf: req.body.cpf,
            cargo: req.body.cargo,
            tipoContrato: req.body.tipoContrato,
            salarioBruto: req.body.salarioBruto,
            cargaHoraria: req.body.cargaHoraria,
            dataAdmissao: req.body.dataAdmissao,
            nivelRisco: req.body.nivelRisco,
            departamento: req.body.departamento,
            status: req.body.status || 'ATIVO',
            dependentes: req.body.dependentes || 0,
            gestorResponsavel: req.body.gestorResponsavel,
            tipoJornada: req.body.tipoJornada,
            observacoes: req.body.observacoes,
            beneficios: req.body.beneficios || {},
            custos: req.body.custos || {},
            empresa_id: empresaParaGravar(req.user)
        };

        const funcionario = await FuncionarioCusto.create(data);
        res.status(201).json(funcionario);
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getFuncionarioById = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const funcionario = await FuncionarioCusto.findOne({ where });
        if (!funcionario) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }
        res.json(funcionario);
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: error.message });
    }
};

export const updateFuncionario = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const funcionario = await FuncionarioCusto.findOne({ where });
        if (!funcionario) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        await funcionario.update(req.body);
        res.json(funcionario);
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteFuncionario = async (req, res) => {
    try {
        const where = { id: req.params.id };
        aplicarEmpresaScope(where, req.user);
        const funcionario = await FuncionarioCusto.findOne({ where });
        if (!funcionario) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        await funcionario.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: error.message });
    }
};
