const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Paciente = require('./pacienteModel');

const PsicopedagogicoPerfil = sequelize.define('PsicopedagogicoPerfil', {
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
    diagnostico: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'psicopedagogico_perfiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        { fields: ['paciente_id'], unique: true }
    ]
});

PsicopedagogicoPerfil.belongsTo(Paciente, { foreignKey: 'paciente_id' });
Paciente.hasOne(PsicopedagogicoPerfil, { foreignKey: 'paciente_id' });

module.exports = PsicopedagogicoPerfil;
