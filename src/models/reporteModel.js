const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./userModel');

const Reporte = sequelize.define('Reporte', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    tipo_reporte: {
        type: DataTypes.ENUM(
            'mensual',
            'trimestral',
            'semestral',
            'anual',
            'personalizado',
            'paciente',
            'becario',
            'psicologo'
        ),
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    parametros: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON con parámetros del reporte'
    },
    fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    formato: {
        type: DataTypes.ENUM('pdf', 'excel', 'csv', 'html'),
        defaultValue: 'pdf'
    },
    archivo_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    archivo_tamano: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Tamaño en bytes'
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'generando', 'completado', 'error'),
        defaultValue: 'pendiente'
    },
    compartido_con: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON con IDs de usuarios con acceso'
    }
}, {
    tableName: 'reportes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['usuario_id']
        },
        {
            fields: ['tipo_reporte', 'estado']
        },
        {
            fields: ['created_at']
        }
    ]
});

Reporte.belongsTo(User, { foreignKey: 'usuario_id' });

module.exports = Reporte;