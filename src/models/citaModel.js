const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Paciente = require('./pacienteModel');
const User = require('./userModel');

const Cita = sequelize.define('Cita', {
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
    titulo: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    psicologo_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    hora: {
        type: DataTypes.TIME,
        allowNull: false,
        get() {
            // Obtener la hora sin segundos
            const rawValue = this.getDataValue('hora');
            return rawValue ? rawValue.substring(0, 5) : null;
        }
    },
    tipo_consulta: {
        type: DataTypes.ENUM('presencial', 'virtual'),
        allowNull: false,
        defaultValue: 'presencial'
    },
    departamento: {
        type: DataTypes.ENUM('DEPAC', 'Psicopedagogico'),
        allowNull: false,
        defaultValue: 'DEPAC'
    },
    estado: {
        type: DataTypes.ENUM('programada', 'confirmada', 'completada', 'cancelada'),
        allowNull: false,
        defaultValue: 'programada'
    },
    notas: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    color: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    total_sesiones: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    numero_sesion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    serie_id: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    motivo_cancelacion: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    duracion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
        comment: 'Duración en minutos'
    },
    // Mantén compatibilidad con duracion_minutos
    duracion_minutos: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.getDataValue('duracion');
        }
    }
}, {
    tableName: 'citas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['fecha', 'estado']
        },
        {
            fields: ['psicologo_id', 'fecha']
        },
        {
            fields: ['becario_id']
        },
        {
            fields: ['paciente_id']
        }
    ]
});

// Relaciones
Cita.belongsTo(Paciente, { foreignKey: 'paciente_id' });
Cita.belongsTo(User, { as: 'Psicologo', foreignKey: 'psicologo_id' });
Cita.belongsTo(User, { as: 'Becario', foreignKey: 'becario_id' });

module.exports = Cita;