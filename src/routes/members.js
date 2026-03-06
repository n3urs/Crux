const router = require('express').Router();
const Member = require('../main/models/member');

router.post('/', (req, res, next) => {
  try { res.json(Member.create(req.body)); } catch (e) { next(e); }
});

router.get('/search', (req, res, next) => {
  try { res.json(Member.search(req.query.q || '', parseInt(req.query.limit) || 20)); } catch (e) { next(e); }
});

router.get('/count', (req, res, next) => {
  try { res.json({ count: Member.count() }); } catch (e) { next(e); }
});

router.get('/list', (req, res, next) => {
  try {
    const opts = {
      page: parseInt(req.query.page) || 1,
      perPage: parseInt(req.query.perPage) || 50,
      orderBy: req.query.orderBy || 'last_name',
      order: req.query.order || 'ASC',
    };
    res.json(Member.list(opts));
  } catch (e) { next(e); }
});

router.get('/by-qr/:qrCode', (req, res, next) => {
  try { res.json(Member.getByQrCode(req.params.qrCode) || null); } catch (e) { next(e); }
});

router.get('/by-email/:email', (req, res, next) => {
  try { res.json(Member.getByEmail(req.params.email) || null); } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(Member.getById(req.params.id) || null); } catch (e) { next(e); }
});

router.get('/:id/with-pass-status', (req, res, next) => {
  try { res.json(Member.getWithPassStatus(req.params.id) || null); } catch (e) { next(e); }
});

router.put('/:id', (req, res, next) => {
  try { res.json(Member.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try { res.json(Member.delete(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/family-link', (req, res, next) => {
  try {
    const { childId, relationship } = req.body;
    res.json({ id: Member.addFamilyLink(req.params.id, childId, relationship || 'parent') });
  } catch (e) { next(e); }
});

router.get('/:id/family', (req, res, next) => {
  try { res.json(Member.getFamily(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/send-qr-email', async (req, res, next) => {
  try {
    await Member.sendQrEmail(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
