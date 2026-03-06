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
      weekRevenue,
      monthRevenue,
    });
  } catch (e) { next(e); }
});

module.exports = router;
