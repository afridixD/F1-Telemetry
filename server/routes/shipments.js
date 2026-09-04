const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// GET /api/shipments
router.get('/', async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT 
      s.shipment_id,
      s.tracking_code,
      s.origin_location,
      s.status,
      s.estimated_arrival_date,
      s.created_at,
      u.username AS dispatched_by_user,
      COUNT(si.shipment_item_id) AS total_items
    FROM shipments s
    LEFT JOIN users u ON s.dispatched_by = u.user_id
    LEFT JOIN shipment_items si ON s.shipment_id = si.shipment_id
  `;
  const params = [];

  if (status) {
    query += ` WHERE s.status = ?`;
    params.push(status);
  }

  query += ` GROUP BY s.shipment_id ORDER BY s.created_at DESC`;

  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve shipments.' });
  }
});

// GET /api/shipments/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [shipment] = await db.query(
      `SELECT s.*, u.username AS dispatched_by_user 
       FROM shipments s 
       LEFT JOIN users u ON s.dispatched_by = u.user_id 
       WHERE s.shipment_id = ?`,
      [id]
    );

    if (shipment.length === 0) return res.status(404).json({ error: 'Shipment not found.' });

    const [items] = await db.query(
      `SELECT 
         si.shipment_item_id,
         si.serial_number,
         si.quantity,
         p.current_status,
         p.wear_percentage,
         c.category_name,
         sp.supplier_name
       FROM shipment_items si
       INNER JOIN parts p ON si.serial_number = p.serial_number
       INNER JOIN part_categories c ON p.category_id = c.category_id
       INNER JOIN suppliers sp ON p.supplier_id = sp.supplier_id
       WHERE si.shipment_id = ?`,
      [id]
    );

    res.json({ shipment: shipment[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve shipment metadata.' });
  }
});

// POST /api/shipments
router.post('/', requireRole(['ShipmentOfficer', 'Admin']), async (req, res) => {
  const { tracking_code, origin_location, estimated_arrival_date, status } = req.body;
  const dispatched_by = req.session.user.user_id;

  if (!tracking_code || !origin_location) {
    return res.status(400).json({ error: 'Tracking code and origin location are required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO shipments (tracking_code, origin_location, estimated_arrival_date, status, dispatched_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tracking_code, origin_location, estimated_arrival_date || null, status || 'Pending', dispatched_by]
    );
    res.status(201).json({ message: 'Shipment recorded.', shipment_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Tracking code already exists.' });
    }
    res.status(500).json({ error: 'Failed to create shipment.' });
  }
});

// POST /api/shipments/:id/items
router.post('/:id/items', requireRole(['ShipmentOfficer', 'Admin']), async (req, res) => {
  const { id } = req.params;
  const { serial_number, quantity = 1 } = req.body;

  if (!serial_number) {
    return res.status(400).json({ error: 'Serial number is required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [part] = await conn.query(
      `SELECT current_status FROM parts WHERE serial_number = ? FOR UPDATE`,
      [serial_number]
    );

    if (part.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: `Part '${serial_number}' does not exist.` });
    }

    if (part[0].current_status === 'Fitted') {
      await conn.rollback();
      return res.status(400).json({ error: `Part '${serial_number}' is mounted to a chassis and cannot be shipped.` });
    }

    await conn.query(
      `INSERT INTO shipment_items (shipment_id, serial_number, quantity) VALUES (?, ?, ?)`,
      [id, serial_number, quantity]
    );

    await conn.query(
      `UPDATE parts SET current_status = 'In Transit' WHERE serial_number = ?`,
      [serial_number]
    );

    await conn.commit();
    res.status(201).json({ message: `Part ${serial_number} assigned to shipment.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to attach item to shipment.' });
  } finally {
    conn.release();
  }
});

// POST /api/shipments/:id/deliver (MULTI-TABLE TRANSACTION)
router.post('/:id/deliver', requireRole(['ShipmentOfficer', 'Admin']), async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [shipmentRes] = await conn.query(
      `UPDATE shipments SET status = 'Delivered' WHERE shipment_id = ? AND status != 'Delivered'`,
      [id]
    );

    if (shipmentRes.affectedRows === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Shipment is already delivered or not found.' });
    }

    await conn.query(
      `UPDATE parts p
       INNER JOIN shipment_items si ON p.serial_number = si.serial_number
       SET p.current_status = 'In Stock'
       WHERE si.shipment_id = ?`,
      [id]
    );

    await conn.commit();
    res.json({ message: `Shipment #${id} delivered. All enclosed parts stocked.` });
  } catch (err) {
    await conn.rollback();
    console.error('Shipment delivery transaction failed:', err);
    res.status(500).json({ error: 'Multi-table delivery transaction aborted.' });
  } finally {
    conn.release();
  }
});

module.exports = router;