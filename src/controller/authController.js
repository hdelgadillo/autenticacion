const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const moment = require('moment-timezone'); // Necesario para manejar zonas horarias

class AuthController {
  static async register(req, res) {
    const { username, email, password } = req.body;
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const query = `
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3) RETURNING user_id
      `;
      const result = await db.query(query, [username, email, passwordHash]);
      res.status(201).json({ message: 'Usuario registrado exitosamente', userId: result.rows[0].user_id });
    } catch (error) {
      res.status(400).json({ error: 'Error al registrar el usuario' });
    }
  }

  static async login(req, res) {
    const { email, password } = req.body;
    try {
      const query = `SELECT * FROM users WHERE email = $1`;
      const result = await db.query(query, [email]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const user = result.rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      // Guardar las fechas en UTC para asegurar consistencia en la base de datos
      const now = moment.utc().toDate();
      const expiresAt = moment.utc().add(1, 'hour').toDate();

      // Guardar la sesión en la base de datos con las fechas y zona horaria correctas
      const sessionQuery = `
        INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await db.query(sessionQuery, [user.user_id, token, ipAddress, userAgent, now, expiresAt]);

      res.json({ token });
    } catch (error) {
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  }

  static async validateSession(req, res) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.log('Token no proporcionado');
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
  
    // Extraer el token sin la palabra 'Bearer'
    const token = authHeader.split(' ')[1];
    console.log('Token extraído:', token);
  
    if (!token) {
      console.log('Token no encontrado en la cabecera');
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decodificado:', decoded);
  
      // Resto de la lógica para verificar la sesión en la base de datos
      const query = `
        SELECT * FROM user_sessions 
        WHERE session_token = $1 
        AND expires_at > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')
      `;
      console.log('Ejecutando consulta para verificar la sesión...');
      const result = await db.query(query, [token]);
  
      console.log('Resultado de la consulta:', result.rows);
  
      if (result.rows.length === 0) {
        console.log('Sesión no válida o expirada');
        return res.status(401).json({ error: 'Sesión no válida o expirada' });
      }
  
      console.log('Sesión válida para el usuario con ID:', decoded.userId);
      res.json({ message: 'Sesión válida', userId: decoded.userId });
    } catch (error) {
      console.log('Error al verificar la sesión:', error);
      res.status(401).json({ error: 'Sesión no válida o expirada' });
    }
  }
  
  
  
}

module.exports = AuthController;
