const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please provide both username and password.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.is_active, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.username = ?`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role_name: user.role_name
    };

    let redirectUrl = '/login.html';
    if (user.role_name === 'Engineer') redirectUrl = '/engineer/dashboard.html';
    else if (user.role_name === 'Mechanic') redirectUrl = '/mechanic/dashboard.html';
    else if (user.role_name === 'ShipmentOfficer') redirectUrl = '/shipment/dashboard.html';

    return res.json({ message: 'Login successful', redirectUrl, user: req.session.user });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Could not log out.' });
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logged out.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.json({ user: req.session.user });
});

module.exports = router;