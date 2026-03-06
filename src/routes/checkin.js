const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../main/database/db');
const Member = require('../main/models/member');

router.post('/process', (req, res, next) => {
  try {
    const { memberId, method } = req.body;
    const db = getDb();

    const member = Member.getWithPassStatus(memberId);
    if (!member) return res.json({ success: false, error: 'Member not found' });

    if (!member.waiver_valid) {
      return res.json({ success: false, error: 'No valid waiver on file', member, needsWaiver: true });
    }

    if (!member.has_valid_pass) {
      return res.json({ success: false, error: 'No valid pass', member, needsPass: true });
    }

    if (member.checked_in_today) {
      return res.json({ success: true, alreadyCheckedIn: true, member, message: 'Already checked in today' });
    }

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const isPeak = !isWeekday || hour < 10 || hour >= 16;

    if (member.active_pass.visits_remaining !== null) {
      db.prepare("UPDATE member_passes SET visits_remaining = visits_remaining - 1, updated_at = datetime('now') WHERE id = ?")
        .run(member.active_pass.id);
    }

    const checkInId = uuidv4();
    db.prepare(`
      INSERT INTO check_ins (id, member_id, member_pass_id, checked_in_by, method, is_peak)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(checkInId, memberId, member.active_pass.id, 'staff', method || 'desk', isPeak ? 1 : 0);

    res.json({
      success: true,
      member: Member.getWithPassStatus(memberId),
      checkInId,
      message: `Welcome, ${member.first_name}!`
    });
  } catch (e) { next(e); }
});

module.exports = router;
