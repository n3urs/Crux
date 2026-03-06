const router = require('express').Router();
const Staff = require('../main/models/staff');

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

router.post('/auth/pin', (req, res, next) => {
  try { res.json(Staff.authenticateByPin(req.body.pin) || { error: 'Invalid PIN' }); } catch (e) { next(e); }
});

router.post('/auth/password', (req, res, next) => {
  try {
    const result = Staff.authenticateByPassword(req.body.email, req.body.password);
    res.json(result || { error: 'Invalid credentials' });
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
