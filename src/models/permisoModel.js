const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./userModel');

const Permiso = sequelize.define('Permiso', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    categoria: {
        type: DataTypes.ENUM(
            'administracion',
            'pacientes',
            'citas',
            'reportes',
            'configuracion',
            'usuarios'
        ),
        allowNull: false
    },
    nivel_requerido: {
        type: DataTypes.ENUM('basico', 'intermedio', 'avanzado', 'administrador'),
        defaultValue: 'basico'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'permisos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

const UsuarioPermiso = sequelize.define('UsuarioPermiso', {
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
    permiso_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Permiso,
            key: 'id'
        }
    },
    concedido: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    concedido_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'id'
        }
    },
    fecha_concesion: {
        type: DataTypes.DATE,
        allowNull: true
    },
    fecha_expiracion: {
        type: DataTypes.DATE,
        allowNull: true
    },
    motivo: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'usuario_permisos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['usuario_id', 'permiso_id']
        }
    ]
});

// Relaciones
UsuarioPermiso.belongsTo(User, { as: 'Usuario', foreignKey: 'usuario_id' });
UsuarioPermiso.belongsTo(User, { as: 'ConcedidoPor', foreignKey: 'concedido_por' });
UsuarioPermiso.belongsTo(Permiso, { foreignKey: 'permiso_id' });

module.exports = { Permiso, UsuarioPermiso };