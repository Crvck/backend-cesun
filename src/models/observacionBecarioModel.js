const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./userModel');
const Cita = require('./citaModel');

const ObservacionBecario = sequelize.define('ObservacionBecario', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    becario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    supervisor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    cita_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Cita,
            key: 'id'
        }
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    tipo_observacion: {
        type: DataTypes.ENUM(
            'sesion_observada',
            'retroalimentacion',
            'evaluacion_periodica',
            'incidencia',
            'reconocimiento'
        ),
        defaultValue: 'sesion_observada'
    },
    aspecto_evaluado: {
        type: DataTypes.ENUM(
            'empatia',
            'tecnicas',
            'documentacion',
            'puntualidad',
            'profesionalismo',
            'etica'
        ),
        allowNull: false
    },
    calificacion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 10
        }
    },
    fortalezas: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    areas_mejora: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    recomendaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    plan_accion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha_seguimiento: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    privada: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Solo visible para supervisor y becario'
    }
}, {
    tableName: 'observaciones_becarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['becario_id', 'fecha']
        },
        {
            fields: ['supervisor_id']
        },
        {
            fields: ['tipo_observacion']
        }
    ]
});

ObservacionBecario.belongsTo(User, { as: 'Becario', foreignKey: 'becario_id' });
ObservacionBecario.belongsTo(User, { as: 'Supervisor', foreignKey: 'supervisor_id' });
ObservacionBecario.belongsTo(Cita, { foreignKey: 'cita_id' });

module.exports = ObservacionBecario;