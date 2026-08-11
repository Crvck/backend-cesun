require('dotenv').config({ path: '../.env' });
const sequelize = require('../src/config/db');

(async () => {
  try {
    await sequelize.query(
      "ALTER TABLE citas ADD COLUMN total_sesiones INT NOT NULL DEFAULT 1, ADD COLUMN numero_sesion INT NOT NULL DEFAULT 1, ADD COLUMN serie_id VARCHAR(64) NULL"
    );
    await sequelize.query("CREATE INDEX idx_citas_serie_id ON citas (serie_id)");
    console.log('OK');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
