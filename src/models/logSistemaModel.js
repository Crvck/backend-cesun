const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./userModel');

const LogSistema = sequelize.define('LogSistema', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'id'
        }
    },
    tipo_log: {
        type: DataTypes.ENUM(
            'login',
            'logout',
            'creacion',
            'modificacion',
            'eliminacion',
            'error',
            'seguridad',
            'backup',
            'reporte',
            'sistema'
        ),
        allowNull: false
    },
    modulo: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    accion: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    datos_antes: {
        type: DataTypes.JSON,
        allowNull: true
    },
    datos_despues: {
        type: DataTypes.JSON,
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    severidad: {
        type: DataTypes.ENUM('info', 'advertencia', 'error', 'critico'),
        defaultValue: 'info'
    },
    resuelto: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'logs_sistema',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['tipo_log', 'created_at']
        },
        {
            fields: ['usuario_id']
        },
        {
            fields: ['modulo']
        },
        {
            fields: ['severidad', 'resuelto']
        }
    ]
});

LogSistema.belongsTo(User, { foreignKey: 'usuario_id' });

module.exports = LogSistema;