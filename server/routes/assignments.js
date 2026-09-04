const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// GET /api/assignments/cars
router.get('/cars', async (req, res) => {
  try {
    const [cars] = await db.query(`SELECT * FROM cars ORDER BY chassis_code`);
    const [fittedParts] = await db.query(
      `SELECT 
         pa.assignment_id,
         pa.car_id,
         pa.serial_number,
         pa.fitted_at,
         u.username AS mechanic_name,
         p.wear_percentage,
         c.category_name
       FROM part_assignments pa
       INNER JOIN parts p ON pa.serial_number = p.serial_number
       INNER JOIN part_categories c ON p.category_id = c.category_id
       INNER JOIN users u ON pa.mechanic_id = u.user_id
       WHERE pa.removed_at IS NULL`
    );

    const result = cars.map(car => ({
      ...car,
      active_parts: fittedParts.filter(fp => fp.car_id === car.car_id)
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch car assignments.' });
  }
});

// POST /api/assignments/fit (Transaction)
router.post('/fit', requireRole(['Mechanic', 'Engineer', 'Admin']), async (req, res) => {
  const { car_id, serial_number } = req.body;
  const mechanic_id = req.session.user.user_id;

  if (!car_id || !serial_number) {
    return res.status(400).json({ error: 'Car ID and Part serial number are required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [partCheck] = await conn.query(
      `SELECT current_status FROM parts WHERE serial_number = ? FOR UPDATE`,
      [serial_number]
    );

    if (partCheck.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Part not found.' });
    }
    if (partCheck[0].current_status !== 'In Stock') {
      await conn.rollback();
      return res.status(400).json({ error: `Cannot fit part with status: ${partCheck[0].current_status}` });
    }

    await conn.query(
      `INSERT INTO part_assignments (car_id, serial_number, mechanic_id, fitted_at)
       VALUES (?, ?, ?, NOW())`,
      [car_id, serial_number, mechanic_id]
    );

    await conn.query(
      `UPDATE parts SET current_status = 'Fitted' WHERE serial_number = ?`,
      [serial_number]
    );

    await conn.commit();
    res.status(201).json({ message: `Part ${serial_number} successfully fitted.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Fitting transaction failed.' });
  } finally {
    conn.release();
  }
});

// POST /api/assignments/remove (Transaction)
router.post('/remove', requireRole(['Mechanic', 'Engineer', 'Admin']), async (req, res) => {
  const { assignment_id, additional_mileage = 0, added_wear = 0 } = req.body;

  if (!assignment_id) {
    return res.status(400).json({ error: 'Assignment ID required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [assignment] = await conn.query(
      `SELECT serial_number FROM part_assignments WHERE assignment_id = ? AND removed_at IS NULL FOR UPDATE`,
      [assignment_id]
    );

    if (assignment.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Active assignment record not found.' });
    }

    const serial_number = assignment[0].serial_number;

    await conn.query(
      `UPDATE part_assignments SET removed_at = NOW() WHERE assignment_id = ?`,
      [assignment_id]
    );

    await conn.query(
      `UPDATE parts 
       SET current_status = 'In Stock',
           total_mileage_km = total_mileage_km + ?,
           wear_percentage = LEAST(100.00, wear_percentage + ?)
       WHERE serial_number = ?`,
      [Number(additional_mileage) || 0, Number(added_wear) || 0, serial_number]
    );

    await conn.commit();
    res.json({ message: `Part ${serial_number} unmounted and returned to stock.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Removal transaction failed.' });
  } finally {
    conn.release();
  }
});

module.exports = router;