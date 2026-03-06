/**
 * Analytics model — dashboards, reports, retention, KPIs
 */

const { getDb } = require('../database/db');

const Analytics = {
  // ---- Footfall ----

  footfallByHour(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return getDb().prepare(`
      SELECT strftime('%H', checked_in_at) as hour, count(*) as count
      FROM check_ins WHERE date(checked_in_at) = ?
      GROUP BY hour ORDER BY hour
    `).all(targetDate);
  },

  footfallByDay(days = 30) {
    return getDb().prepare(`
      SELECT date(checked_in_at) as date, count(*) as count
      FROM check_ins WHERE checked_in_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date ORDER BY date
    `).all(days);
  },

  footfallByDayOfWeek(days = 90) {
    return getDb().prepare(`
      SELECT
        CASE strftime('%w', checked_in_at)
          WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'
          WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday'
          WHEN '6' THEN 'Saturday' END as day_name,
        cast(strftime('%w', checked_in_at) as integer) as day_num,
        count(*) as count, round(count(*) * 1.0 / (? / 7.0), 1) as avg_per_week
      FROM check_ins WHERE checked_in_at >= datetime('now', '-' || ? || ' days')
      GROUP BY day_num ORDER BY day_num
    `).all(days, days);
  },

  peakVsOffPeak(days = 30) {
    const db = getDb();
    const peak = db.prepare(`
      SELECT count(*) as c FROM check_ins
      WHERE checked_in_at >= datetime('now', '-' || ? || ' days') AND is_peak = 1
    `).get(days).c;
    const offPeak = db.prepare(`
      SELECT count(*) as c FROM check_ins
      WHERE checked_in_at >= datetime('now', '-' || ? || ' days') AND is_peak = 0
    `).get(days).c;
    return { peak, offPeak, total: peak + offPeak };
  },

  // ---- Revenue ----

  revenueByDay(days = 30) {
    return getDb().prepare(`
      SELECT date(created_at) as date, COALESCE(sum(total_amount), 0) as revenue, count(*) as transactions
      FROM transactions
      WHERE created_at >= datetime('now', '-' || ? || ' days') AND payment_status IN ('completed', 'refunded')
      GROUP BY date ORDER BY date
    `).all(days);
  },

  revenueByMonth(months = 12) {
    return getDb().prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COALESCE(sum(total_amount), 0) as revenue, count(*) as transactions
      FROM transactions
      WHERE created_at >= datetime('now', '-' || ? || ' months') AND payment_status IN ('completed', 'refunded')
      GROUP BY month ORDER BY month
    `).all(months);
  },

  revenueByCategory(days = 30) {
    return getDb().prepare(`
      SELECT pc.name as category, COALESCE(sum(ti.total_price), 0) as revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      LEFT JOIN products p ON ti.product_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE t.created_at >= datetime('now', '-' || ? || ' days') AND t.payment_status IN ('completed', 'refunded') AND t.total_amount > 0
      GROUP BY pc.name ORDER BY revenue DESC
    `).all(days);
  },

  revenueByPaymentMethod(days = 30) {
    return getDb().prepare(`
      SELECT payment_method, COALESCE(sum(total_amount), 0) as revenue, count(*) as transactions
      FROM transactions
      WHERE created_at >= datetime('now', '-' || ? || ' days') AND payment_status IN ('completed', 'refunded')
      GROUP BY payment_method
    `).all(days);
  },

  topProducts(days = 30, limit = 10) {
    return getDb().prepare(`
      SELECT ti.description, sum(ti.quantity) as qty, sum(ti.total_price) as revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE t.created_at >= datetime('now', '-' || ? || ' days') AND t.payment_status IN ('completed', 'refunded') AND t.total_amount > 0
      GROUP BY ti.description ORDER BY revenue DESC LIMIT ?
    `).all(days, limit);
  },

  // ---- Member Analytics ----

  memberGrowth(days = 90) {
    return getDb().prepare(`
      SELECT date(created_at) as date, count(*) as new_members
      FROM members WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date ORDER BY date
    `).all(days);
  },

  memberRetention(cohortMonth) {
    // Cohort analysis: of members who joined in cohortMonth, how many are still active?
    const db = getDb();
    const cohortMembers = db.prepare(`
      SELECT id FROM members WHERE strftime('%Y-%m', created_at) = ?
    `).all(cohortMonth);

    if (cohortMembers.length === 0) return { cohort: cohortMonth, total: 0, months: [] };

    const ids = cohortMembers.map(m => m.id);
    const months = [];

    for (let i = 0; i < 6; i++) {
      const checkMonth = new Date(cohortMonth + '-01');
      checkMonth.setMonth(checkMonth.getMonth() + i);
      const monthStr = checkMonth.toISOString().slice(0, 7);

      let activeCount = 0;
      for (const id of ids) {
        const hasCheckIn = db.prepare(`
          SELECT 1 FROM check_ins WHERE member_id = ? AND strftime('%Y-%m', checked_in_at) = ? LIMIT 1
        `).get(id, monthStr);
        if (hasCheckIn) activeCount++;
      }

      months.push({ month: monthStr, active: activeCount, rate: cohortMembers.length > 0 ? Math.round(activeCount / cohortMembers.length * 100) : 0 });
    }

    return { cohort: cohortMonth, total: cohortMembers.length, months };
  },

  atRiskMembers(inactiveDays = 30) {
    return getDb().prepare(`
      SELECT m.id, m.first_name, m.last_name, m.email,
        max(ci.checked_in_at) as last_visit,
        julianday('now') - julianday(max(ci.checked_in_at)) as days_since_visit
      FROM members m
      JOIN check_ins ci ON ci.member_id = m.id
      JOIN member_passes mp ON mp.member_id = m.id AND mp.status = 'active'
      GROUP BY m.id
      HAVING days_since_visit >= ?
      ORDER BY days_since_visit DESC
    `).all(inactiveDays);
  },

  visitFrequency(days = 90) {
    return getDb().prepare(`
      SELECT m.id, m.first_name, m.last_name, count(*) as visits,
        round(count(*) * 7.0 / ?, 1) as visits_per_week
      FROM members m
      JOIN check_ins ci ON ci.member_id = m.id
      WHERE ci.checked_in_at >= datetime('now', '-' || ? || ' days')
      GROUP BY m.id ORDER BY visits DESC LIMIT 50
    `).all(days, days);
  },

  newVsReturning(days = 30) {
    const db = getDb();
    const newMembers = db.prepare(`
      SELECT count(DISTINCT ci.member_id) as c FROM check_ins ci
      JOIN members m ON ci.member_id = m.id
      WHERE ci.checked_in_at >= datetime('now', '-' || ? || ' days')
        AND m.created_at >= datetime('now', '-' || ? || ' days')
    `).get(days, days).c;

    const returning = db.prepare(`
      SELECT count(DISTINCT ci.member_id) as c FROM check_ins ci
      JOIN members m ON ci.member_id = m.id
      WHERE ci.checked_in_at >= datetime('now', '-' || ? || ' days')
        AND m.created_at < datetime('now', '-' || ? || ' days')
    `).get(days, days).c;

    return { newMembers, returning, total: newMembers + returning };
  },

  // ---- Pass Analytics ----

  activePassBreakdown() {
    return getDb().prepare(`
      SELECT pt.name, pt.category, count(*) as count
      FROM member_passes mp
      JOIN pass_types pt ON mp.pass_type_id = pt.id
      WHERE mp.status = 'active' AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now'))
      GROUP BY pt.id ORDER BY count DESC
    `).all();
  },

  passChurnRate(days = 90) {
    const db = getDb();
    const cancelled = db.prepare(`
      SELECT count(*) as c FROM member_passes
      WHERE cancelled_at >= datetime('now', '-' || ? || ' days')
    `).get(days).c;
    const expired = db.prepare(`
      SELECT count(*) as c FROM member_passes
      WHERE status = 'expired' AND expires_at >= datetime('now', '-' || ? || ' days')
    `).get(days).c;
    const active = db.prepare(`
      SELECT count(*) as c FROM member_passes WHERE status = 'active'
    `).get().c;

    return { cancelled, expired, active, churnRate: active > 0 ? Math.round((cancelled + expired) / active * 100) : 0 };
  },

  // ---- Staff Performance ----

  staffSales(days = 30) {
    return getDb().prepare(`
      SELECT s.first_name || ' ' || s.last_name as staff_name,
        count(*) as transactions, COALESCE(sum(t.total_amount), 0) as revenue
      FROM transactions t
      JOIN staff s ON t.staff_id = s.id
      WHERE t.created_at >= datetime('now', '-' || ? || ' days') AND t.payment_status = 'completed'
      GROUP BY t.staff_id ORDER BY revenue DESC
    `).all(days);
  },

  // ---- KPI Summary ----

  kpiSummary() {
    const db = getDb();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return {
      totalMembers: db.prepare('SELECT count(*) as c FROM members').get().c,
      activeMembers: db.prepare(`
        SELECT count(DISTINCT mp.member_id) as c FROM member_passes mp
        WHERE mp.status = 'active' AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now'))
      `).get().c,
      todayCheckIns: db.prepare("SELECT count(*) as c FROM check_ins WHERE date(checked_in_at) = date('now')").get().c,
      todayRevenue: db.prepare("SELECT COALESCE(sum(total_amount), 0) as t FROM transactions WHERE date(created_at) = date('now') AND payment_status = 'completed'").get().t,
      weekRevenue: db.prepare("SELECT COALESCE(sum(total_amount), 0) as t FROM transactions WHERE created_at >= datetime('now', '-7 days') AND payment_status = 'completed'").get().t,
      monthRevenue: db.prepare("SELECT COALESCE(sum(total_amount), 0) as t FROM transactions WHERE created_at >= datetime('now', '-30 days') AND payment_status = 'completed'").get().t,
      activeRoutes: db.prepare("SELECT count(*) as c FROM climbs WHERE status = 'active'").get().c,
      upcomingEvents: db.prepare("SELECT count(*) as c FROM events WHERE status = 'scheduled' AND starts_at > datetime('now')").get().c,
      expiringWaivers: db.prepare("SELECT count(*) as c FROM signed_waivers WHERE expires_at > datetime('now') AND expires_at <= datetime('now', '+30 days')").get().c,
    };
  },
};

module.exports = Analytics;
