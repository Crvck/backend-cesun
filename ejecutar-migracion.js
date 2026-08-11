require('dotenv').config({ path: '../.env' });
const sequelize = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function ejecutarMigracion() {
  try {
    console.log('📂 Ejecutando migración...');
    console.log(`DB_HOST: ${process.env.DB_HOST}`);
    console.log(`DB_USER: ${process.env.DB_USER}`);
    console.log(`DB_NAME: ${process.env.DB_NAME}`);

    const nombreMigracion = process.argv[2] || '20260807_add_departamento_to_citas.sql';
    const migracionPath = path.join(__dirname, 'migrations', nombreMigracion);

    if (!fs.existsSync(migracionPath)) {
      console.error(`❌ No existe la migración: ${nombreMigracion}`);
      console.error('📌 Archivo esperado en:', migracionPath);
      process.exit(1);
    }

    console.log(`📄 Archivo: ${nombreMigracion}`);
    const sql = fs.readFileSync(migracionPath, 'utf8');
    
    // Eliminar comentarios (líneas que comienzan con --)
    const lineasSinComentarios = sql
      .split('\n')
      .filter(linea => !linea.trim().startsWith('--'))
      .join('\n');
    
    // Dividir por puntos y comas para ejecutar cada sentencia
    const sentencias = lineasSinComentarios
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`\n📊 Total de sentencias a ejecutar: ${sentencias.length}\n`);
    
    for (const sentencia of sentencias) {
      console.log(`⏳ Ejecutando: ${sentencia.substring(0, 60)}...`);
      try {
        await sequelize.query(sentencia);
        console.log(`✅ OK\n`);
      } catch (err) {
        console.error(`❌ Error: ${err.message}\n`);
        // Continuar con la siguiente sentencia
      }
    }
    
    console.log('✨ Migración completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error crítico:', error.message);
    process.exit(1);
  }
}

ejecutarMigracion();
