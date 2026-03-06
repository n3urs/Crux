const router = require('express').Router();
const Analytics = require('../main/models/analytics');

router.get('/footfall/by-hour', (req, res, next) => {
  try { res.json(Analytics.footfallByHour(req.query.date)); } catch (e) { next(e); }
});
router.get('/footfall/by-day', (req, res, next) => {
  try { res.json(Analytics.footfallByDay(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});
router.get('/footfall/by-day-of-week', (req, res, next) => {
  try { res.json(Analytics.footfallByDayOfWeek(parseInt(req.query.days) || 90)); } catch (e) { next(e); }
});
router.get('/footfall/peak-vs-offpeak', (req, res, next) => {
  try { res.json(Analytics.peakVsOffPeak(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});

router.get('/revenue/by-day', (req, res, next) => {
  try { res.json(Analytics.revenueByDay(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});
router.get('/revenue/by-month', (req, res, next) => {
  try { res.json(Analytics.revenueByMonth(parseInt(req.query.months) || 12)); } catch (e) { next(e); }
});
router.get('/revenue/by-category', (req, res, next) => {
  try { res.json(Analytics.revenueByCategory(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});
router.get('/revenue/by-payment-method', (req, res, next) => {
  try { res.json(Analytics.revenueByPaymentMethod(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});

router.get('/top-products', (req, res, next) => {
  try { res.json(Analytics.topProducts(parseInt(req.query.days) || 30, parseInt(req.query.limit) || 10)); } catch (e) { next(e); }
});

router.get('/members/growth', (req, res, next) => {
  try { res.json(Analytics.memberGrowth(parseInt(req.query.days) || 90)); } catch (e) { next(e); }
});
router.get('/members/retention', (req, res, next) => {
  try { res.json(Analytics.memberRetention(req.query.cohort)); } catch (e) { next(e); }
});
router.get('/members/at-risk', (req, res, next) => {
  try { res.json(Analytics.atRiskMembers(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});
router.get('/members/visit-frequency', (req, res, next) => {
  try { res.json(Analytics.visitFrequency(parseInt(req.query.days) || 90)); } catch (e) { next(e); }
});
router.get('/members/new-vs-returning', (req, res, next) => {
  try { res.json(Analytics.newVsReturning(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});

router.get('/passes/breakdown', (req, res, next) => {
  try { res.json(Analytics.activePassBreakdown()); } catch (e) { next(e); }
});
router.get('/passes/churn', (req, res, next) => {
  try { res.json(Analytics.passChurnRate(parseInt(req.query.days) || 90)); } catch (e) { next(e); }
});

router.get('/staff-sales', (req, res, next) => {
  try { res.json(Analytics.staffSales(parseInt(req.query.days) || 30)); } catch (e) { next(e); }
});

router.get('/kpi', (req, res, next) => {
  try { res.json(Analytics.kpiSummary()); } catch (e) { next(e); }
});

module.exports = router;
