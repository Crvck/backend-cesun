const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Importamos el modelo de Sequelize
const User = require('../models/userModel'); 

class AuthController {
    
    static async login(req, res) {
        try {
            console.log('=== LOGIN REQUEST ===');
            const { email, password } = req.body;
            console.log('Email:', email);

            // 1. Validar entrada básica
            if (!email || !password) {
                console.log('❌ Datos incompletos');
                return res.status(400).json({ message: 'Por favor ingrese email y contraseña' });
            }

            // 2. Buscar el usuario usando Sequelize
            console.log('🔍 Buscando usuario...');
            const user = await User.findOne({ 
                where: { email: email } 
            });

            // 3. Verificar si el usuario existe
            if (!user) {
                console.log('❌ Usuario no encontrado');
                return res.status(401).json({ message: 'Credenciales inválidas' });
            }
                // 3. Verificar si el usuario existe y está activo
                if (user.activo === false) {
                    console.log('❌ Usuario inactivo');
                    return res.status(403).json({ message: 'Tu usuario ha sido desactivado, comunícate con el administrador' });
                }
                console.log('✅ Usuario encontrado:', user.email);

            // 4. Comparar la contraseña
            console.log('🔐 Verificando contraseña...');
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                console.log('❌ Contraseña incorrecta');
                return res.status(401).json({ message: 'Credenciales inválidas' });
            }
            console.log('✅ Contraseña correcta');

            // 5. Generar el JWT
            console.log('🔑 Generando token...');
            const payload = {
                id: user.id,
                email: user.email,
                rol: user.rol,
                nombre: user.nombre,
                apellido: user.apellido,
                fundacion_id: user.fundacion_id || null
            };

            const token = jwt.sign(
                payload, 
                process.env.JWT_SECRET, 
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );
            console.log('✅ Token generado');

            // 6. Responder
            console.log('✅ Login exitoso para:', user.email);
            res.json({
                message: 'Login exitoso',
                token: token,
                user: { 
                    id: user.id, 
                    email: user.email,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    rol: user.rol,
                    especialidad: user.especialidad,
                    fundacion_id: user.fundacion_id || null,
                    created_at: user.created_at
                }
            });

        } catch (error) {
            console.error('❌ Error en el login:', error);
            console.error('Stack trace:', error.stack);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    static async getMe(req, res) {
        try {
            const userId = req.user.id;
            
            // Buscar usuario en la base de datos
            const user = await User.findOne({ 
                where: { id: userId },
                attributes: ['id', 'email', 'nombre', 'apellido', 'rol', 'especialidad', 'fundacion_id', 'created_at'] // Cambia 'createdAt' por 'created_at'
            });
            
            if (!user) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }
            
            res.json({
                message: 'Usuario obtenido exitosamente',
                user: user
            });
            
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
}

module.exports = AuthController