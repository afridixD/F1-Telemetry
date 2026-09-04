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
         COALESCE(c.category_name, 'Uncategorized') AS category_name,
         c.max_lifespan_km,
         p.supplier_id,
         COALESCE(s.supplier_name, 'Direct OEM') AS supplier_name,
         p.current_status,
         p.total_mileage_km,
         p.wear_percentage,
         p.created_at,
         u.username AS created_by_user
       FROM parts p
       LEFT JOIN part_categories c ON p.category_id = c.category_id
       LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
       LEFT JOIN users u ON p.created_by = u.user_id
       ORDER BY p.wear_percentage DESC`
    );
    res.json(parts);
  } catch (err) {
    console.error('Error querying parts catalogue:', err);
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
    console.error('Error querying summary reports:', err);
    res.status(500).json({ error: 'Error querying summary reports.' });
  }
});

// GET /api/parts/cross/pipeline (Inbound Freight + Active Garage Work)
router.get('/cross/pipeline', async (req, res) => {
  try {
    const [inboundFreight] = await db.query(
      `SELECT 
         si.serial_number, 
         COALESCE(c.category_name, 'General Item') AS category_name, 
         s.tracking_code, 
         s.origin_location, 
         s.status, 
         s.estimated_arrival_date,
         u.username AS dispatched_by
       FROM shipment_items si
       INNER JOIN shipments s ON si.shipment_id = s.shipment_id
       INNER JOIN parts p ON si.serial_number = p.serial_number
       LEFT JOIN part_categories c ON p.category_id = c.category_id
       LEFT JOIN users u ON s.dispatched_by = u.user_id
       WHERE s.status != 'Delivered'
       ORDER BY s.estimated_arrival_date ASC`
    );

    const [garageWork] = await db.query(
      `SELECT 
         pa.serial_number,
         COALESCE(c.category_name, 'General Item') AS category_name,
         car.chassis_code,
         car.driver_name,
         u.username AS mechanic_name,
         pa.fitted_at,
         p.wear_percentage
       FROM part_assignments pa
       INNER JOIN cars car ON pa.car_id = car.car_id
       INNER JOIN parts p ON pa.serial_number = p.serial_number
       LEFT JOIN part_categories c ON p.category_id = c.category_id
       INNER JOIN users u ON pa.mechanic_id = u.user_id
       WHERE pa.removed_at IS NULL
       ORDER BY pa.fitted_at DESC`
    );

    res.json({ inboundFreight, garageWork });
  } catch (err) {
    console.error('Error querying cross-department pipeline:', err);
    res.status(500).json({ error: 'Failed to retrieve cross-department pipeline data.' });
  }
});

// GET /api/parts/cross/requisitions (Damaged & High-Wear Parts)
router.get('/cross/requisitions', async (req, res) => {
  try {
    const [requisitions] = await db.query(
      `SELECT 
         p.serial_number,
         COALESCE(c.category_name, 'Uncategorized') AS category_name,
         COALESCE(s.supplier_name, 'Direct OEM') AS supplier_name,
         s.contact_email,
         p.current_status,
         p.wear_percentage,
         p.total_mileage_km,
         CASE 
           WHEN p.current_status = 'Failed' THEN 'CRITICAL: Component Failure'
           WHEN p.wear_percentage >= 80.0 THEN 'HIGH: Lifespan Exceeded (>80%)'
           ELSE 'NOMINAL'
         END AS requisition_priority
       FROM parts p
       LEFT JOIN part_categories c ON p.category_id = c.category_id
       LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
       WHERE p.current_status = 'Failed' OR p.wear_percentage >= 80.0
       ORDER BY p.wear_percentage DESC`
    );
    res.json(requisitions);
  } catch (err) {
    console.error('Error querying requisitions:', err);
    res.status(500).json({ error: 'Failed to retrieve order requisitions.' });
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