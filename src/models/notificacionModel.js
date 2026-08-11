const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notificacion = sequelize.define('Notificacion', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	usuario_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	tipo: {
		type: DataTypes.ENUM(
			'cita_programada',
			'cita_modificada',
			'cita_cancelada',
			'asignacion_nueva',
			'observacion_nueva',
			'alerta_sistema',
			'reporte_generado',
			'feedback_supervision'
		),
		allowNull: false,
		defaultValue: 'alerta_sistema'
	},
	titulo: {
		type: DataTypes.STRING(255),
		allowNull: false
	},
	mensaje: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	prioridad: {
		type: DataTypes.ENUM('baja', 'media', 'alta', 'urgente'),
		allowNull: false,
		defaultValue: 'media'
	},
	accion_url: {
		type: DataTypes.STRING(500),
		allowNull: true
	},
	leido: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	},
	leido_at: {
		type: DataTypes.DATE,
		allowNull: true
	},
	datos_extra: {
		type: DataTypes.JSON,
		allowNull: true
	}
}, {
	tableName: 'notificaciones',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at',
	underscored: true
});

module.exports = Notificacion;
