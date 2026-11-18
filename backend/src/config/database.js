import { Sequelize } from 'sequelize';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectModule: pg,
      logging: false,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      pool: { max: 20, min: 0, idle: 5000, acquire: 30000 }
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        dialectOptions: {
          ssl: process.env.DB_SSL === 'true'
            ? { require: true, rejectUnauthorized: false }
            : false
        },
        pool: { max: 20, min: 0, idle: 5000, acquire: 30000 }
      }
    );

export default sequelize;


// import { Sequelize } from 'sequelize';
// import pg from 'pg';
// import dotenv from 'dotenv';

// // Pega varíaveis de ambiente
// dotenv.config();

// const sequelize = new Sequelize(process.env.DATABASE_URL, {
//   dialect: 'postgres',
//   dialectModule: pg,

//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false
//     },
//     connectTimeout: 60000,
//     application_name: 'lucro-plus-app'
//   },

//   pool: {
//     max: 5,
//     min: 0,
//     acquire: 30000,
//     idle: 10000
//   },

//   logging:
//     process.env.NODE_ENV === 'development'
//       ? (msg) => console.log(`[SQL] ${msg}`)
//       : false,

//   retry: {
//     max: 3,
//     timeout: 5000
//   }
// });

// (async () => {
//   try {
//     await sequelize.authenticate();
//     console.log('🟢 Conexão segura estabelecida com Neon PostgreSQL');
//   } catch (error) {
//     console.error('🔴 Falha crítica na conexão:', error.message);
//     process.exit(1);
//   }
// })();

// export default sequelize;
