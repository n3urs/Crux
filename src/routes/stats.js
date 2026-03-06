const router = require('express').Router();
const { getDb } = require('../main/database/db');

router.get('/dashboard', (req, res, next) => {
  try {
    const db = getDb();

    const totalMembers = db.prepare('SELECT count(*) as c FROM members').get().c;
    const activeMembers = db.prepare(`
      SELECT count(DISTINCT mp.member_id) as c FROM member_passes mp
      WHERE mp.status = 'active' AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now'))
    `).get().c;

    const todayCheckIns = db.prepare(`
      SELECT count(*) as c FROM check_ins WHERE date(checked_in_at) = date('now')
    `).get().c;

    const todayRevenue = db.prepare(`
      SELECT COALESCE(sum(total_amount), 0) as total FROM transactions
      WHERE date(created_at) = date('now') AND payment_status = 'completed'
    `).get().total;

    const todayTransactions = db.prepare(`
      SELECT count(*) as c FROM transactions
      WHERE date(created_at) = date('now') AND payment_status = 'completed'
    `).get().c;

    const weekRevenue = db.prepare(`
      SELECT COALESCE(sum(total_amount), 0) as total FROM transactions
      WHERE created_at >= datetime('now', '-7 days') AND payment_status = 'completed'
    `).get().total;

    const monthRevenue = db.prepare(`
      SELECT COALESCE(sum(total_amount), 0) as total FROM transactions
      WHERE created_at >= datetime('now', '-30 days') AND payment_status = 'completed'
    `).get().total;

    res.json({
      totalMembers,
      activeMembers,
      todayCheckIns,
      todayRevenue,
      todayTransactions,
      weekRevenue,
      monthRevenue,
    });
  } catch (e) { next(e); }
});

// Daily revenue for last N days
router.get('/revenue-daily', (req, res, next) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days) || 7;
    const rows = db.prepare(`
      WITH RECURSIVE dates(d) AS (
        SELECT date('now', '-' || ? || ' days')
        UNION ALL
        SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
      )
      SELECT dates.d as date,
        COALESCE(sum(t.total_amount), 0) as revenue,
        count(t.id) as transactions
      FROM dates
      LEFT JOIN transactions t ON date(t.created_at) = dates.d AND t.payment_status = 'completed'
      GROUP BY dates.d
      ORDER BY dates.d
    `).all(days);
    res.json(rows);
  } catch (e) { next(e); }
});

// Top products by quantity sold
router.get('/popular-products', (req, res, next) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 30;
    const rows = db.prepare(`
      SELECT ti.description as name, sum(ti.quantity) as quantity, sum(ti.total_price) as revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE t.payment_status = 'completed' AND t.created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY ti.description
      ORDER BY quantity DESC
      LIMIT ?
    `).all(days, limit);
    res.json(rows);
  } catch (e) { next(e); }
});

// Daily check-in counts for last N days
router.get('/checkins-daily', (req, res, next) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days) || 7;
    const rows = db.prepare(`
      WITH RECURSIVE dates(d) AS (
        SELECT date('now', '-' || ? || ' days')
        UNION ALL
        SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
      )
      SELECT dates.d as date, count(ci.id) as count
      FROM dates
      LEFT JOIN check_ins ci ON date(ci.checked_in_at) = dates.d
      GROUP BY dates.d
      ORDER BY dates.d
    `).all(days);
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
