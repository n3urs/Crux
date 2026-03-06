const router = require('express').Router();
const Transaction = require('../main/models/transaction');

router.post('/', (req, res, next) => {
  try { res.json(Transaction.create(req.body)); } catch (e) { next(e); }
});

router.get('/list', (req, res, next) => {
  try {
    res.json(Transaction.list({
      page: parseInt(req.query.page) || 1,
      perPage: parseInt(req.query.perPage) || 50,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      memberId: req.query.memberId,
      paymentMethod: req.query.paymentMethod,
      status: req.query.status,
    }));
  } catch (e) { next(e); }
});

router.get('/daily-summary', (req, res, next) => {
  try { res.json(Transaction.dailySummary(req.query.date)); } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(Transaction.getById(req.params.id) || null); } catch (e) { next(e); }
});

router.post('/:id/refund', (req, res, next) => {
  try { res.json(Transaction.refund(req.params.id, req.body.amount)); } catch (e) { next(e); }
});

router.post('/:id/send-receipt', async (req, res, next) => {
  try {
    await Transaction.sendReceipt(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
