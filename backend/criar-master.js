// criar-master.js
import sequelize from './src/config/database.js';
import bcrypt from 'bcryptjs';

async function createMaster() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');

    // Garante que todas as colunas necessárias existem
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS senha_texto TEXT`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ativo'`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissoes TEXT[] DEFAULT '{}'`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS comissao_tipo VARCHAR(20)`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS comissao_valor DECIMAL(10,2) DEFAULT 0`);

    const senha = 'master123';
    const hash = await bcrypt.hash(senha, 10);

    // Atualiza se já existe, senão insere
    const existing = await sequelize.query(
      `SELECT id FROM users WHERE email = 'admin@master.com'`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (existing.length) {
      await sequelize.query(
        `UPDATE users SET senha = :hash, senha_texto = :texto, tipo = 'MASTER', status = 'ativo' WHERE email = 'admin@master.com'`,
        { replacements: { hash, texto: senha } }
      );
      console.log('✅ Usuário MASTER atualizado!');
    } else {
      await sequelize.query(`
        INSERT INTO users (
          "nomeCompleto", cpf, cargo, email, senha, senha_texto,
          rua, bairro, cidade, estado, numero, tipo, status,
          permissoes, empresa_id, created_at, updated_at
        ) VALUES (
          'Administrador Master', '000.000.000-00', 'Administrador',
          'admin@master.com', :hash, :texto,
          'Rua do Sistema', 'Centro', 'São Paulo', 'SP', '100',
          'MASTER', 'ativo', '{}', NULL, NOW(), NOW()
        )
      `, { replacements: { hash, texto: senha } });
      console.log('✅ Usuário MASTER criado com sucesso!');
    }

    console.log('\n📋 Credenciais:');
    console.log('   Email: admin@master.com');
    console.log('   Senha: master123');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

createMaster();
