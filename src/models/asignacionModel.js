const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Paciente = require('./pacienteModel');
const User = require('./userModel');

const Asignacion = sequelize.define('Asignacion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    paciente_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Paciente,
            key: 'id'
        }
    },
    psicologo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    becario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'id'
        }
    },
    fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    motivo_fin: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    estado: {
        type: DataTypes.ENUM('activa', 'finalizada', 'suspendida'),
        defaultValue: 'activa'
    },
    notas: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'asignaciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['paciente_id', 'estado']
        },
        {
            fields: ['psicologo_id', 'estado']
        },
        {
            fields: ['becario_id']
        }
    ]
});

// Relaciones
Asignacion.belongsTo(Paciente, { foreignKey: 'paciente_id' });
Asignacion.belongsTo(User, { as: 'Psicologo', foreignKey: 'psicologo_id' });
Asignacion.belongsTo(User, { as: 'Becario', foreignKey: 'becario_id' });

module.exports = Asignacion;