import { DataTypes, Op } from 'sequelize';
import sequelize from '../config/database.js';

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING,
    allowNull: true,          // código opcional
    // unique: false removido – a unicidade será tratada pelo índice composto
  },
  fabricante: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fornecedor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'fornecedores', key: 'id' }
  },
  category: DataTypes.STRING,
  origem: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  is_materia_prima: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },

  unidade_medida: {
    type: DataTypes.STRING,
    allowNull: true
  },
  unidade_comercial: {
    type: DataTypes.STRING,
    allowNull: true
  },
  unidade_tributavel: {
    type: DataTypes.STRING,
    allowNull: true
  },
  unidades_por_caixa: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  preco_compra: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  tipo_preco_venda: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'valor'
  },
  percentual_lucro: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },

  minQuantity: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0
  },
  currentQuantity: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0
  },
  lote: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data_validade: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  peso_bruto: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true
  },
  peso_liquido: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true
  },

  ncm: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cfop: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cest: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cst_csosn: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cst_pis: {
    type: DataTypes.STRING,
    allowNull: true
  },

  cst_cofins: {
    type: DataTypes.STRING,
    allowNull: true
  },
  aliquota_icms: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  aliquota_pis: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  aliquota_cofins: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  aliquota_ipi: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  codigo_barras: {
    type: DataTypes.STRING,
    allowNull: true
  },

  ibs_cbs_situacao_tributaria: {
      type: DataTypes.STRING(3),
      allowNull: true,
  },

  ibs_cbs_classificacao_tributaria: {
      type: DataTypes.STRING(6),
      allowNull: true,
  },

  empresa_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'empresas', key: 'id' }
  },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  granel_origem_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  caixa_origem_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  loja_online_ativo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  loja_online_configurado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  loja_online_preco: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  loja_online_categoria: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  loja_online_descricao: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  loja_online_foto_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  loja_online_foto_public_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  loja_online_secoes: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  loja_online_ordem: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  loja_online_destaque: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  loja_online_promocao: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  loja_online_preco_original: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  loja_online_granel: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  loja_online_preco_kg: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  loja_online_nome: {
    type: DataTypes.STRING(200),
    allowNull: true
  }
}, {
  tableName: 'Products',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      unique: true,
      fields: ['empresa_id', 'code'],
      where: {
        code: { [Op.ne]: null }   // aplica apenas quando code NÃO é nulo
      },
      name: 'products_empresa_id_code_unique'
    },
    {
      unique: true,
      fields: ['empresa_id', 'caixa_origem_id'],
      where: {
        caixa_origem_id: { [Op.ne]: null }
      },
      name: 'products_empresa_caixa_origem_unique'
    }
  ],
  hooks: {
    beforeCreate: (product) => {
      if (!product.code) {
        product.code = `PROD-${Date.now()}`;
      }
    }
  }
});

export default Product;
