const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Cita = require('./citaModel');
const User = require('./userModel');

const Sesion = sequelize.define('Sesion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    cita_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Cita,
            key: 'id'
        },
        unique: true
    },
    psicologo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    hora_inicio: {
        type: DataTypes.TIME,
        allowNull: false
    },
    hora_fin: {
        type: DataTypes.TIME,
        allowNull: false
    },
    tipo_sesion: {
        type: DataTypes.ENUM('evaluacion', 'terapia', 'seguimiento', 'crisis'),
        defaultValue: 'terapia'
    },
    objetivo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    desarrollo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    conclusion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    tareas_asignadas: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    emocion_predominante: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    riesgo_suicida: {
        type: DataTypes.ENUM('ninguno', 'bajo', 'moderado', 'alto'),
        defaultValue: 'ninguno'
    },
    escalas_aplicadas: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON con escalas aplicadas y puntajes'
    },
    siguiente_cita: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    privado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Si solo psicólogo puede ver'
    },
    dificultades: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Dificultades encontradas durante la sesión'
    },
    logros: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Logros del paciente en la sesión'
    },
    preguntas_supervisor: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Preguntas para el supervisor'
    }
}, {
    tableName: 'sesiones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['psicologo_id', 'fecha']
        },
        {
            fields: ['fecha']
        }
    ]
});

// Relaciones
Sesion.belongsTo(Cita, { foreignKey: 'cita_id' });
Sesion.belongsTo(User, { as: 'Psicologo', foreignKey: 'psicologo_id' });

module.exports = Sesion;