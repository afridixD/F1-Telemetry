const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// GET /api/parts (JOIN parts + categories + suppliers)
router.get('/', async (req, res) => {
  try {
    const [parts] = await db.query(
      `SELECT 
         p.serial_number,
         p.category_id,
         c.category_name,
         c.max_lifespan_km,
         p.supplier_id,
         s.supplier_name,
         p.current_status,
         p.total_mileage_km,
         p.wear_percentage,
         p.created_at,
         u.username AS created_by_user
       FROM parts p
       INNER JOIN part_categories c ON p.category_id = c.category_id
       INNER JOIN suppliers s ON p.supplier_id = s.supplier_id
       LEFT JOIN users u ON p.created_by = u.user_id
       ORDER BY p.wear_percentage DESC`
    );
    res.json(parts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error querying parts catalogue.' });
  }
});

// GET /api/parts/summary (Aggregations with GROUP BY)
router.get('/summary', async (req, res) => {
  try {
    const [statusSummary] = await db.query(
      `SELECT current_status, COUNT(*) AS count FROM parts GROUP BY current_status`
    );
    const [categorySummary] = await db.query(
      `SELECT c.category_name, COUNT(p.serial_number) AS total_parts, AVG(p.wear_percentage) AS avg_wear
       FROM part_categories c
       LEFT JOIN parts p ON c.category_id = p.category_id
       GROUP BY c.category_id, c.category_name`
    );
    res.json({ statusSummary, categorySummary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error querying summary reports.' });
  }
});

// POST /api/parts
router.post('/', requireRole(['Engineer', 'Admin']), async (req, res) => {
  const { serial_number, category_id, supplier_id, current_status, total_mileage_km, wear_percentage } = req.body;
  const created_by = req.session.user.user_id;

  if (!serial_number || !category_id || !supplier_id) {
    return res.status(400).json({ error: 'Serial number, category, and supplier are required.' });
  }

  try {
    await db.query(
      `INSERT INTO parts (serial_number, category_id, supplier_id, current_status, total_mileage_km, wear_percentage, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        serial_number,
        category_id,
        supplier_id,
        current_status || 'In Stock',
        total_mileage_km || 0,
        wear_percentage || 0,
        created_by
      ]
    );
    res.status(201).json({ message: 'Part successfully registered.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Serial number already exists in system.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create part.' });
  }
});

// PUT /api/parts/:serial_number
router.put('/:serial_number', requireRole(['Engineer', 'Admin']), async (req, res) => {
  const { serial_number } = req.params;
  const { category_id, supplier_id, current_status, total_mileage_km, wear_percentage } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE parts 
       SET category_id = ?, supplier_id = ?, current_status = ?, total_mileage_km = ?, wear_percentage = ?
       WHERE serial_number = ?`,
      [category_id, supplier_id, current_status, total_mileage_km, wear_percentage, serial_number]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Part not found.' });
    res.json({ message: 'Part updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update part.' });
  }
});

// DELETE /api/parts/:serial_number
router.delete('/:serial_number', requireRole(['Engineer', 'Admin']), async (req, res) => {
  const { serial_number } = req.params;
  try {
    const [result] = await db.query(`DELETE FROM parts WHERE serial_number = ?`, [serial_number]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Part not found.' });
    res.json({ message: 'Part successfully deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Constraint error: Part is linked to active records.' });
  }
});

// Lookup Metadata Endpoints
router.get('/meta/categories', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM part_categories ORDER BY category_name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

router.get('/meta/suppliers', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM suppliers ORDER BY supplier_name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load suppliers.' });
  }
});

module.exports = router;