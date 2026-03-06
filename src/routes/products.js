const router = require('express').Router();
const Product = require('../main/models/product');

router.post('/', (req, res, next) => {
  try { res.json(Product.create(req.body)); } catch (e) { next(e); }
});

router.get('/list', (req, res, next) => {
  try { res.json(Product.list({ categoryId: req.query.categoryId, activeOnly: req.query.activeOnly !== 'false' })); } catch (e) { next(e); }
});

router.get('/grouped', (req, res, next) => {
  try { res.json(Product.listGroupedByCategory(req.query.activeOnly !== 'false')); } catch (e) { next(e); }
});

router.get('/search', (req, res, next) => {
  try { res.json(Product.search(req.query.q || '')); } catch (e) { next(e); }
});

router.get('/low-stock', (req, res, next) => {
  try { res.json(Product.getLowStock()); } catch (e) { next(e); }
});

router.get('/categories', (req, res, next) => {
  try { res.json(Product.listCategories()); } catch (e) { next(e); }
});

router.post('/categories', (req, res, next) => {
  try { res.json(Product.createCategory(req.body.name, req.body.sort_order || 0)); } catch (e) { next(e); }
});

router.put('/categories/:id', (req, res, next) => {
  try { res.json(Product.updateCategory(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/categories/:id', (req, res, next) => {
  try { res.json(Product.deleteCategory(req.params.id)); } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(Product.getById(req.params.id) || null); } catch (e) { next(e); }
});

router.put('/:id', (req, res, next) => {
  try { res.json(Product.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try { res.json(Product.delete(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/adjust-stock', (req, res, next) => {
  try { res.json(Product.adjustStock(req.params.id, req.body.quantity)); } catch (e) { next(e); }
});

module.exports = router;
