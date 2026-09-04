const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// GET /api/failures
router.get('/', async (req, res) => {
  const { resolved } = req.query;
  let query = `
    SELECT 
      f.failure_id,
      f.serial_number,
      p.current_status,
      c.category_name,
      f.failure_date,
      f.failure_reason,
      f.severity,
      f.is_resolved,
      u.username AS reported_by_user
    FROM part_failures f
    INNER JOIN parts p ON f.serial_number = p.serial_number
    INNER JOIN part_categories c ON p.category_id = c.category_id
    INNER JOIN users u ON f.reported_by = u.user_id
  `;
  const params = [];

  if (resolved !== undefined) {
    query += ` WHERE f.is_resolved = ?`;
    params.push(resolved === 'true' ? 1 : 0);
  }

  query += ` ORDER BY f.failure_date DESC`;

  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch failure logs.' });
  }
});

// POST /api/failures (Transaction)
router.post('/', requireRole(['Mechanic', 'Engineer', 'Admin']), async (req, res) => {
  const { serial_number, failure_reason, severity } = req.body;
  const reported_by = req.session.user.user_id;

  if (!serial_number || !failure_reason || !severity) {
    return res.status(400).json({ error: 'Serial number, reason, and severity are required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO part_failures (serial_number, reported_by, failure_reason, severity)
       VALUES (?, ?, ?, ?)`,
      [serial_number, reported_by, failure_reason, severity]
    );

    await conn.query(
      `UPDATE part_assignments SET removed_at = NOW() WHERE serial_number = ? AND removed_at IS NULL`,
      [serial_number]
    );

    await conn.query(
      `UPDATE parts SET current_status = 'Failed' WHERE serial_number = ?`,
      [serial_number]
    );

    await conn.commit();
    res.status(201).json({ message: `Failure logged. Part ${serial_number} marked as Failed.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to process failure report.' });
  } finally {
    conn.release();
  }
});

// PUT /api/failures/:id/resolve (Transaction)
router.put('/:id/resolve', requireRole(['Mechanic', 'Engineer', 'Admin']), async (req, res) => {
  const { id } = req.params;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [failure] = await conn.query(
      `SELECT serial_number FROM part_failures WHERE failure_id = ? FOR UPDATE`,
      [id]
    );

    if (failure.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Failure record not found.' });
    }

    const serial_number = failure[0].serial_number;

    await conn.query(`UPDATE part_failures SET is_resolved = TRUE WHERE failure_id = ?`, [id]);
    await conn.query(`UPDATE parts SET current_status = 'In Stock' WHERE serial_number = ?`, [serial_number]);

    await conn.commit();
    res.json({ message: `Failure resolved. Part ${serial_number} returned to stock.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve failure incident.' });
  } finally {
    conn.release();
  }
});

module.exports = router;