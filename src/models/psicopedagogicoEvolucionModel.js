const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const PsicopedagogicoPerfil = require('./psicopedagogicoPerfilModel');

const PsicopedagogicoEvolucion = sequelize.define('PsicopedagogicoEvolucion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    perfil_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: PsicopedagogicoPerfil,
            key: 'id'
        }
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'psicopedagogico_evoluciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
        { fields: ['perfil_id'] },
        { fields: ['fecha'] }
    ]
});

PsicopedagogicoEvolucion.belongsTo(PsicopedagogicoPerfil, { foreignKey: 'perfil_id' });
PsicopedagogicoPerfil.hasMany(PsicopedagogicoEvolucion, { foreignKey: 'perfil_id', as: 'Evoluciones' });

module.exports = PsicopedagogicoEvolucion;
