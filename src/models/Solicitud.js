const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Solicitud = sequelize.define('Solicitud', {
  nombre_completo: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  telefono: { type: DataTypes.STRING, allowNull: false },
  origen: { type: DataTypes.ENUM('CESUN', 'EXTERNO'), defaultValue: 'CESUN' },
  matricula: { type: DataTypes.STRING, allowNull: true },
  institucion_procedencia: { type: DataTypes.STRING, allowNull: true },
  horas_a_liberar: { type: DataTypes.INTEGER, allowNull: false },
  motivo: { type: DataTypes.TEXT },
  estado: { type: DataTypes.ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO'), defaultValue: 'PENDIENTE' },
  fecha_resolucion: { type: DataTypes.DATE, allowNull: true },
  aprobado_por: { type: DataTypes.INTEGER, allowNull: true },
  disponibilidad_horaria: { type: DataTypes.JSON, allowNull: true, comment: 'JSON con los días y horarios disponibles del solicitante' }
}, {
  tableName: 'solicitudes_ingreso',
  timestamps: true,
  createdAt: 'fecha_solicitud',
  updatedAt: false
});

module.exports = Solicitud;