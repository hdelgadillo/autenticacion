const express = require('express');
const AuthController = require('../controller/authController');
const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/validate-session', AuthController.validateSession);

module.exports = router;
