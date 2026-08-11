const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const verifyToken = require('../middlewares/authMiddleware');

router.post('/login', AuthController.login);
router.get('/me', verifyToken, AuthController.getMe);

module.exports = router;