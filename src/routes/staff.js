const router = require('express').Router();
const Staff = require('../main/models/staff');

// Seed default owner (first run only)
router.post('/seed-owner', (req, res, next) => {
  try { res.json(Staff.seedOwner()); } catch (e) { next(e); }
});

// Get staff count (for login screen to decide PIN vs first-run)
router.get('/count', (req, res, next) => {
  try { res.json({ count: Staff.count() }); } catch (e) { next(e); }
});

// Get default permissions for a role
router.get('/default-permissions/:role', (req, res, next) => {
  try { res.json(Staff.getDefaultPermissions(req.params.role)); } catch (e) { next(e); }
});

router.post('/', (req, res, next) => {
  try { res.json(Staff.create(req.body)); } catch (e) { next(e); }
});

router.get('/list', (req, res, next) => {
  try { res.json(Staff.list(req.query.activeOnly !== 'false')); } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(Staff.getById(req.params.id) || null); } catch (e) { next(e); }
});

router.put('/:id', (req, res, next) => {
  try { res.json(Staff.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.post('/:id/deactivate', (req, res, next) => {
  try { Staff.deactivate(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});

router.post('/:id/activate', (req, res, next) => {
  try { Staff.activate(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const db = require('../main/database/db').getDb();
    // Safety: never delete the last owner
    const owners = db.prepare("SELECT COUNT(*) as c FROM staff WHERE role='owner' AND is_active=1").get();
    const target = db.prepare('SELECT * FROM staff WHERE id=?').get(req.params.id);
    if (target?.role === 'owner' && owners.c <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only owner account' });
    }
    db.prepare('DELETE FROM staff WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post('/auth/pin', (req, res, next) => {
  try { res.json(Staff.authenticateByPin(req.body.pin) || { error: 'Invalid PIN' }); } catch (e) { next(e); }
});

router.post('/auth/password', (req, res, next) => {
  try {
    const result = Staff.authenticateByPassword(req.body.email, req.body.password);
    res.json(result || { error: 'Invalid credentials' });
  } catch (e) { next(e); }
});

// Admin impersonation — verify a short-lived JWT issued by /admin/impersonate
router.post('/auth/token', (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'crux_dev_secret');
    if (!payload.impersonated) return res.status(403).json({ error: 'Not an impersonation token' });

    const staff = Staff.getById(payload.staffId);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    res.json({ staff: { ...staff, impersonated: true } });
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── Staff invite flow ──────────────────────────────────────────────────────

router.post('/:id/invite', async (req, res, next) => {
  try {
    const staff = Staff.getById(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    if (!staff.email) return res.status(400).json({ error: 'This staff member has no email address. Add one first.' });

    const token = Staff.generateInviteToken(req.params.id);

    // Build invite link
    const host = req.get('host') || 'localhost:8080';
    const protocol = req.protocol || 'http';
    const inviteUrl = `${protocol}://${host}/invite?token=${token}`;

    // Send email
    try {
      const { getDb } = require('../main/database/db');
      const nodemailer = require('nodemailer');
      const db = getDb();
      const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value || '';
      const gymName = getSetting('gym_name') || 'Your Gym';
      const smtpUser = getSetting('email_smtp_user');
      const smtpPass = getSetting('email_smtp_pass');

      if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: getSetting('email_smtp_host') || 'smtp.gmail.com',
          port: parseInt(getSetting('email_smtp_port') || '587'),
          secure: false,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: getSetting('email_from') || smtpUser,
          to: staff.email,
          subject: `You've been invited to ${gymName} on Crux`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
              <h2 style="color:#1E3A5F;">${gymName}</h2>
              <p>Hi ${staff.first_name},</p>
              <p>You've been added as <strong>${staff.role.replace('_', ' ')}</strong> on Crux for ${gymName}.</p>
              <p>Click the button below to set your password and activate your account:</p>
              <a href="${inviteUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1E3A5F;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Accept Invitation</a>
              <p style="color:#888;font-size:12px;">This link expires in 7 days. If you didn't expect this email, you can ignore it.</p>
            </div>`,
        });
      }
    } catch (emailErr) {
      console.warn('[staff] invite email failed:', emailErr.message);
    }

    res.json({ ok: true, inviteUrl });
  } catch (e) { next(e); }
});

// Validate invite token (public — before billing gate)
router.get('/invite/validate', (req, res, next) => {
  try {
    const staff = Staff.getByInviteToken(req.query.token);
    if (!staff) return res.status(404).json({ error: 'Invalid or expired invite link' });
    res.json({ staff: { first_name: staff.first_name, last_name: staff.last_name, role: staff.role, email: staff.email } });
  } catch (e) { next(e); }
});

// Accept invite — set password
router.post('/invite/accept', (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const staff = Staff.acceptInvite(token, password);
    if (!staff) return res.status(404).json({ error: 'Invalid or expired invite link' });
    res.json({ ok: true, staff });
  } catch (e) { next(e); }
});

router.get('/:id/has-permission/:perm', (req, res, next) => {
  try { res.json({ allowed: Staff.hasPermission(req.params.id, req.params.perm) }); } catch (e) { next(e); }
});

// Shifts
router.post('/shifts', (req, res, next) => {
  try { res.json(Staff.createShift(req.body)); } catch (e) { next(e); }
});

router.get('/shifts/list', (req, res, next) => {
  try { res.json(Staff.getShifts(req.query)); } catch (e) { next(e); }
});

router.delete('/shifts/:id', (req, res, next) => {
  try { res.json(Staff.deleteShift(req.params.id)); } catch (e) { next(e); }
});

router.get('/shifts/week-rota', (req, res, next) => {
  try { res.json(Staff.getWeekRota(req.query.date)); } catch (e) { next(e); }
});

router.get('/audit-trail', (req, res, next) => {
  try { res.json(Staff.getAuditTrail(req.query)); } catch (e) { next(e); }
});

module.exports = router;
