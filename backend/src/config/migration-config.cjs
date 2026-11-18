require('dotenv').config();

const configFromEnvironment = () => ({
  ...(process.env.DATABASE_URL
    ? { use_env_variable: 'DATABASE_URL' }
    : {
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      }),
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.DB_SSL === 'false'
      ? false
      : { require: true, rejectUnauthorized: false },
  },
});

// O backend de produção usa tanto DATABASE_URL quanto o conjunto DB_* da
// Vercel. As migrations precisam aceitar exatamente os mesmos dois formatos.
module.exports = {
  development: configFromEnvironment(),
  production: configFromEnvironment(),
};
