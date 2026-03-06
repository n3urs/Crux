const router = require('express').Router();
const Pass = require('../main/models/pass');

router.post('/types', (req, res, next) => {
  try { res.json(Pass.createType(req.body)); } catch (e) { next(e); }
});

router.get('/types', (req, res, next) => {
  try { res.json(Pass.listTypes(req.query.activeOnly !== 'false')); } catch (e) { next(e); }
});

router.put('/types/:id', (req, res, next) => {
  try { res.json(Pass.updateType(req.params.id, req.body)); } catch (e) { next(e); }
});

router.post('/issue', (req, res, next) => {
  try {
    const { memberId, passTypeId, isPeak, pricePaid } = req.body;
    res.json(Pass.issue(memberId, passTypeId, isPeak, pricePaid));
  } catch (e) { next(e); }
});

router.get('/active/:memberId', (req, res, next) => {
  try { res.json(Pass.getActivePasses(req.params.memberId)); } catch (e) { next(e); }
});

router.get('/all/:memberId', (req, res, next) => {
  try { res.json(Pass.getAllPasses(req.params.memberId)); } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(Pass.getById(req.params.id) || null); } catch (e) { next(e); }
});

router.post('/:id/pause', (req, res, next) => {
  try { res.json(Pass.pause(req.params.id, req.body.reason)); } catch (e) { next(e); }
});

router.post('/:id/unpause', (req, res, next) => {
  try { res.json(Pass.unpause(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/cancel', (req, res, next) => {
  try { res.json(Pass.cancel(req.params.id, req.body.reason)); } catch (e) { next(e); }
});

router.post('/:id/extend', (req, res, next) => {
  try { res.json(Pass.extend(req.params.id, req.body.days)); } catch (e) { next(e); }
});

router.post('/:id/transfer', (req, res, next) => {
  try { res.json(Pass.transfer(req.params.id, req.body.newMemberId)); } catch (e) { next(e); }
});

router.post('/seed-defaults', (req, res, next) => {
  try { res.json({ count: Pass.seedDefaults() }); } catch (e) { next(e); }
});

module.exports = router;
