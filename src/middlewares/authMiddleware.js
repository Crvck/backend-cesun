

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // 1. Obtener el token del header "Authorization"
    // Se espera el formato: "Bearer <token_aqui>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Obtener la segunda parte

    if (!token) {
        return res.status(403).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        // 2. Verificar el token usando la clave secreta
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 3. Si es válido, guardamos los datos del usuario (payload) en la request
        // para que las siguientes rutas puedan usarlo (ej. req.user.id)
        req.user = decoded;
        
        // 4. Continuar con la siguiente función
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
             return res.status(401).json({ message: 'El token ha expirado.' });
        }
        return res.status(401).json({ message: 'Token inválido.' });
    }
};

module.exports = verifyToken;