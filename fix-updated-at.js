const sequelize = require('./src/config/db');

const fixUpdatedAt = async () => {
  try {
    console.log('🔧 Iniciando corrección del campo updated_at en tabla citas...');
    
    // Alterar tabla citas para asegurarse de que updated_at tiene un valor por defecto
    await sequelize.query(`
      ALTER TABLE citas 
      MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    `);
    
    console.log('✅ Campo updated_at correcto en tabla citas');
    
    // También verificar sesiones por si acaso
    await sequelize.query(`
      ALTER TABLE sesiones 
      MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    `);
    
    console.log('✅ Campo updated_at correcto en tabla sesiones');
    
    console.log('✅ Todas las correcciones completadas');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al corregir updated_at:', error.message);
    process.exit(1);
  }
};

fixUpdatedAt();
