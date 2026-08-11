const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./userModel');

const BecarioHoras = sequelize.define('BecarioHoras', {
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
    horas: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0
    },
    comentario: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'becario_horas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        { fields: ['becario_id'] }
    ]
});

BecarioHoras.belongsTo(User, { foreignKey: 'becario_id' });

module.exports = BecarioHoras;
