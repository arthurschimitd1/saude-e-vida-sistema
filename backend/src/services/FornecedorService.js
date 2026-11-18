import { Op } from 'sequelize';
import Fornecedor from '../models/Fornecedor.js';
import FiscalStockImport from '../models/FiscalStockImport.js';
import ApiError from '../utils/apiError.js';
import { aplicarEmpresaScope, empresaParaGravar } from '../utils/empresaScope.js';

const CAMPOS_PERMITIDOS = [
    'nomeCompleto',
    'cpf',
    'cnpj',
    'email',
    'telefone',
    'cep',
    'rua',
    'bairro',
    'cidade',
    'estado',
    'pais',
    'numero',
    'complemento',
    'pontoReferencia',
    'inscricao_estadual'
];

const selecionarCampos = (dados) => Object.fromEntries(
    CAMPOS_PERMITIDOS
        .filter((campo) => Object.prototype.hasOwnProperty.call(dados, campo))
        .map((campo) => [campo, dados[campo]])
);

const somenteDigitos = (value) => String(value ?? '').replace(/\D/g, '');
const formatarCpf = (value) => {
    const digits = somenteDigitos(value);
    return digits.length === 11
        ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        : digits;
};
const formatarCnpj = (value) => {
    const digits = somenteDigitos(value);
    return digits.length === 14
        ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        : digits;
};
const formatarCep = (value) => {
    const digits = somenteDigitos(value);
    return digits.length === 8 ? digits.replace(/(\d{5})(\d{3})/, '$1-$2') : digits;
};
const normalizarValorSugestao = (key, value) => {
    if (key === 'cep') return formatarCep(value);
    if (key === 'telefone') return somenteDigitos(value);
    if (key === 'cpf') return formatarCpf(value);
    if (key === 'cnpj') return formatarCnpj(value);
    return value;
};

export const montarSugestoesFornecedorXml = (imports, fornecedores) => {
    const documentosCadastrados = new Set(
        fornecedores.flatMap(item => [somenteDigitos(item.cnpj), somenteDigitos(item.cpf)]).filter(Boolean)
    );
    const suggestions = new Map();

    for (const record of imports) {
        const plain = typeof record.toJSON === 'function' ? record.toJSON() : record;
        const document = somenteDigitos(plain.supplier_document);
        if (!document || documentosCadastrados.has(document)) continue;

        const snapshot = plain.supplier_snapshot ?? {};
        const current = suggestions.get(document);
        if (current) {
            current.invoice_count += 1;
            for (const [key, value] of Object.entries(snapshot)) {
                if (!current[key] && value) current[key] = normalizarValorSugestao(key, value);
            }
            continue;
        }

        suggestions.set(document, {
            source_import_id: Number(plain.id),
            document,
            nomeCompleto: snapshot.nomeCompleto || plain.supplier_name || '',
            cpf: document.length === 11 ? formatarCpf(snapshot.cpf || document) : null,
            cnpj: document.length === 14 ? formatarCnpj(snapshot.cnpj || document) : null,
            email: snapshot.email || null,
            telefone: somenteDigitos(snapshot.telefone) || '',
            cep: formatarCep(snapshot.cep) || null,
            rua: snapshot.rua || null,
            bairro: snapshot.bairro || null,
            cidade: snapshot.cidade || null,
            estado: snapshot.estado || null,
            pais: snapshot.pais || 'Brasil',
            numero: snapshot.numero || null,
            complemento: snapshot.complemento || null,
            pontoReferencia: null,
            inscricao_estadual: snapshot.inscricao_estadual || null,
            invoice_count: 1,
            last_imported_at: plain.imported_at || plain.created_at || null
        });
    }

    return [...suggestions.values()];
};

const normalizarDados = (dados) => {
    const normalizados = selecionarCampos(dados);

    for (const [campo, valor] of Object.entries(normalizados)) {
        if (typeof valor === 'string') {
            const limpo = valor.trim();
            normalizados[campo] = limpo || null;
        }
    }

    if (normalizados.nomeCompleto) normalizados.nomeCompleto = normalizados.nomeCompleto.trim();
    if (normalizados.telefone) normalizados.telefone = normalizados.telefone.trim();
    if (normalizados.email) normalizados.email = normalizados.email.toLowerCase();
    if (normalizados.estado) normalizados.estado = normalizados.estado.toUpperCase();
    if (Object.prototype.hasOwnProperty.call(normalizados, 'pais') && !normalizados.pais) {
        normalizados.pais = 'Brasil';
    }

    return normalizados;
};

const tratarErroBanco = (error) => {
    if (error instanceof ApiError) throw error;

    if (error.name === 'SequelizeUniqueConstraintError') {
        throw new ApiError(409, 'Já existe um fornecedor com este CPF ou CNPJ nesta empresa');
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
        throw new ApiError(409, 'Fornecedor possui registros vinculados e não pode ser excluído');
    }

    throw error;
};

class FornecedorService {
    async listar(filters, currentUser) {
        const where = {};
        aplicarEmpresaScope(where, currentUser);

        if (filters.busca) {
            where[Op.or] = [
                { nomeCompleto: { [Op.iLike]: `%${filters.busca}%` } },
                { cpf: { [Op.iLike]: `%${filters.busca}%` } },
                { cnpj: { [Op.iLike]: `%${filters.busca}%` } },
                { telefone: { [Op.iLike]: `%${filters.busca}%` } }
            ];
        }

        return Fornecedor.findAll({ where, order: [['nomeCompleto', 'ASC']] });
    }

    async buscarPorId(id, currentUser) {
        const where = { id };
        aplicarEmpresaScope(where, currentUser);

        const fornecedor = await Fornecedor.findOne({ where });
        if (!fornecedor) throw new ApiError(404, 'Fornecedor não encontrado');
        return fornecedor;
    }

    async listarSugestoesXml(currentUser) {
        const empresaId = empresaParaGravar(currentUser);
        if (!empresaId) {
            throw new ApiError(400, 'Selecione uma empresa para consultar sugestões de fornecedores');
        }

        const [imports, fornecedores] = await Promise.all([
            FiscalStockImport.findAll({
                where: {
                    empresa_id: empresaId,
                    supplier_document: { [Op.ne]: null }
                },
                order: [['imported_at', 'DESC']]
            }),
            Fornecedor.findAll({
                where: { empresa_id: empresaId },
                attributes: ['cpf', 'cnpj']
            })
        ]);

        return montarSugestoesFornecedorXml(imports, fornecedores);
    }

    async criar(dados, currentUser) {
        const empresaId = empresaParaGravar(currentUser);
        if (!empresaId) {
            throw new ApiError(400, 'Selecione uma empresa para cadastrar o fornecedor');
        }

        try {
            return await Fornecedor.create({
                ...normalizarDados(dados),
                empresa_id: empresaId
            });
        } catch (error) {
            tratarErroBanco(error);
        }
    }

    async atualizar(id, dados, currentUser) {
        try {
            const fornecedor = await this.buscarPorId(id, currentUser);
            await fornecedor.update(normalizarDados(dados));
            return fornecedor;
        } catch (error) {
            tratarErroBanco(error);
        }
    }

    async excluir(id, currentUser) {
        try {
            const fornecedor = await this.buscarPorId(id, currentUser);
            await fornecedor.destroy();
        } catch (error) {
            tratarErroBanco(error);
        }
    }
}

export default new FornecedorService();
