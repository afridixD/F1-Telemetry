const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const partsRoutes = require('./routes/parts');
const assignmentsRoutes = require('./routes/assignments');
const failuresRoutes = require('./routes/failures');
const shipmentsRoutes = require('./routes/shipments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'paddock_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/parts', partsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/failures', failuresRoutes);
app.use('/api/shipments', shipmentsRoutes);

app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    const role = req.session.user.role_name;
    if (role === 'Engineer') return res.redirect('/engineer/dashboard.html');
    if (role === 'Mechanic') return res.redirect('/mechanic/dashboard.html');
    if (role === 'ShipmentOfficer') return res.redirect('/shipment/dashboard.html');
  }
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});