const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Fundacion = sequelize.define('Fundacion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    direccion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    responsable: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    convenio_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    convenio_fin: {
        type: DataTypes.DATEONLY,
        allowNull: true
    }
}, {
    tableName: 'fundaciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

module.exports = Fundacion;