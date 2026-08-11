const path = require('path');
// 1. FORZADO PARA VERCEL: Obliga al empaquetador a incluir el driver de MySQL en la compilación
require('mysql2'); 

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Sequelize } = require('sequelize');

// Verifica primero si las variables se están leyendo (solo para depuración)
// console.log("User:", process.env.DB_USERNAME); 

const sequelize = new Sequelize(
    process.env.DB_DATABASE, 
    process.env.DB_USERNAME, 
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        // 2. CONFIGURACIÓN EXPLÍCITA: Le dice a Sequelize qué módulo exacto usar en entornos Serverless
        dialectModule: require('mysql2'), 
        logging: false,
        
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Importante para TiDB Cloud
            }
        },

        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a base de datos establecida exitosamente.');
    } catch (error) {
        console.error('❌ No se pudo conectar a la base de datos:', error);
    }
}

testConnection();

module.exports = sequelize;
