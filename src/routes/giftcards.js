const router = require('express').Router();
const GiftCard = require('../main/models/giftcard');

router.post('/', (req, res, next) => {
  try { res.json(GiftCard.create(req.body)); } catch (e) { next(e); }
});

router.get('/by-code/:code', (req, res, next) => {
  try { res.json(GiftCard.getByCode(req.params.code) || null); } catch (e) { next(e); }
});

router.post('/redeem', (req, res, next) => {
  try {
    const { code, amount, transactionId } = req.body;
    res.json(GiftCard.redeem(code, amount, transactionId));
  } catch (e) { next(e); }
});

router.post('/add-balance', (req, res, next) => {
  try {
    const { code, amount } = req.body;
    res.json(GiftCard.addBalance(code, amount));
  } catch (e) { next(e); }
});

router.get('/active', (req, res, next) => {
  try { res.json(GiftCard.listActive()); } catch (e) { next(e); }
});

module.exports = router;
