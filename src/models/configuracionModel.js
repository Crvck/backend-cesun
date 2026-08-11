const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Configuración general del sistema agrupada por categoría
const Configuracion = sequelize.define('Configuracion', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	categoria: {
		type: DataTypes.ENUM(
			'general',
			'clinica',
			'citas',
			'notificaciones',
			'seguridad',
			'avanzada'
		),
		allowNull: false,
		unique: true
	},
	valores: {
		type: DataTypes.JSON,
		allowNull: false
	}
}, {
	tableName: 'configuraciones',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at',
	underscored: true
});

module.exports = Configuracion;
