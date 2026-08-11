const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Paciente = require('./pacienteModel');
const User = require('./userModel');

const Expediente = sequelize.define('Expediente', {
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
        },
        unique: true
    },
    psicologo_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'id'
        }
    },
    motivo_consulta: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    motivo_consulta_especial: {
        type: DataTypes.ENUM('No aplica', 'Por canalizacion', 'Por Crisis'),
        allowNull: false,
        defaultValue: 'No aplica'
    },
    historia_personal: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    historia_familiar: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    antecedentes_medicos: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    antecedentes_psiquiatricos: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    diagnostico_presuntivo: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    diagnostico_definitivo: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    tratamiento_actual: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    medicamentos: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON con medicamentos y dosis'
    },
    alergias: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    factores_riesgo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON con factores de riesgo identificados'
    },
    redes_apoyo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    emergencia_contacto: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    emergencia_telefono: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    consentimiento_informado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    fecha_consentimiento: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    restricciones_acceso: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON con IDs de usuarios con acceso restringido'
    },
    notas_confidenciales: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Solo visible para psicólogo asignado'
    },
    riesgo_suicida: {
        type: DataTypes.ENUM('ninguno','bajo','moderado','alto'),
        defaultValue: 'ninguno'
    }
}, {
    tableName: 'expedientes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

Expediente.belongsTo(Paciente, { foreignKey: 'paciente_id' });
Expediente.belongsTo(User, { as: 'Psicologo', foreignKey: 'psicologo_id' });

module.exports = Expediente;