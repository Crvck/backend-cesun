const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./userModel');

const Disponibilidad = sequelize.define('Disponibilidad', {
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
    dia_semana: {
        type: DataTypes.ENUM(
            'lunes',
            'martes',
            'miercoles',
            'jueves',
            'viernes',
            'sabado',
            'domingo'
        ),
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
    tipo_disponibilidad: {
        type: DataTypes.ENUM('regular', 'extraordinaria', 'limitada'),
        defaultValue: 'regular'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    fecha_inicio_vigencia: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    fecha_fin_vigencia: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    notas: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    max_citas_dia: {
        type: DataTypes.INTEGER,
        defaultValue: 8,
        validate: {
            min: 1,
            max: 12
        }
    },
    intervalo_citas: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
        comment: 'Duración estándar en minutos'
    }
}, {
    tableName: 'disponibilidades',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            fields: ['usuario_id', 'dia_semana', 'activo']
        },
        {
            fields: ['fecha_inicio_vigencia', 'fecha_fin_vigencia']
        }
    ]
});

User.hasMany(Disponibilidad, { foreignKey: 'usuario_id', as: 'Disponibilidades' });
Disponibilidad.belongsTo(User, { foreignKey: 'usuario_id', as: 'Usuario' });

module.exports = Disponibilidad;