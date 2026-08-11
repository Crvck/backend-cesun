const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Paciente = sequelize.define('Paciente', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    apellido: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    telefono: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    fecha_inscripcion: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    genero: {
        type: DataTypes.ENUM('masculino', 'femenino', 'otro', 'prefiero_no_decir'),
        allowNull: true
    },
    direccion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    es_estudiante: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si el paciente es estudiante'
    },
    matricula: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Número de matrícula del estudiante'
    },
    institucion_educativa: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Institución educativa del estudiante'
    },
    carrera: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Carrera o programa académico del paciente cuando es estudiante'
    },
    disponibilidad: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Disponibilidad del paciente para atención'
    },
    comentarios_disponibilidad: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comentarios adicionales sobre la disponibilidad del paciente'
    },
    edad_registro: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Edad calculada al momento del registro del paciente'
    },
    usuario_registro_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del usuario que registró al paciente'
    },
    usuario_registro_nombre: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nombre completo del usuario que registró al paciente'
    },
    usuario_registro_rol: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Rol del usuario que registró al paciente'
    },
    estado: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'activo'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    notas: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fundacion_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'pacientes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['activo']
        },
        {
            fields: ['apellido', 'nombre']
        }
    ]
});

module.exports = Paciente;