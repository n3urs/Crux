const router = require('express').Router();
const Waiver = require('../main/models/waiver');

router.get('/templates', (req, res, next) => {
  try { res.json(Waiver.listTemplates()); } catch (e) { next(e); }
});

router.get('/templates/active/:type', (req, res, next) => {
  try { res.json(Waiver.getActiveTemplate(req.params.type) || null); } catch (e) { next(e); }
});

router.post('/sign', (req, res, next) => {
  try { res.json(Waiver.sign(req.body)); } catch (e) { next(e); }
});

router.get('/valid/:memberId', (req, res, next) => {
  try { res.json({ valid: Waiver.isValid(req.params.memberId) }); } catch (e) { next(e); }
});

router.get('/latest/:memberId', (req, res, next) => {
  try { res.json(Waiver.getLatestValid(req.params.memberId) || null); } catch (e) { next(e); }
});

router.get('/history/:memberId', (req, res, next) => {
  try { res.json(Waiver.getMemberHistory(req.params.memberId)); } catch (e) { next(e); }
});

router.get('/expiring-soon', (req, res, next) => {
  try { res.json(Waiver.getExpiringSoon(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});

router.post('/seed-defaults', (req, res, next) => {
  try { res.json({ count: Waiver.seedDefaults() }); } catch (e) { next(e); }
});

module.exports = router;
