const router = require('express').Router();
const Waiver = require('../main/models/waiver');
const { getDb } = require('../main/database/db');

router.get('/templates', (req, res, next) => {
  try { res.json(Waiver.listTemplates()); } catch (e) { next(e); }
});

router.get('/templates/active/:type', (req, res, next) => {
  try { res.json(Waiver.getActiveTemplate(req.params.type) || null); } catch (e) { next(e); }
});

// Recent waiver submissions
router.get('/recent', (req, res, next) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 20;
    const recent = db.prepare(`
      SELECT sw.id, sw.member_id, sw.signed_at, sw.expires_at,
        wt.name as waiver_name, wt.type as waiver_type,
        m.first_name, m.last_name, m.date_of_birth
      FROM signed_waivers sw
      JOIN waiver_templates wt ON sw.waiver_template_id = wt.id
      JOIN members m ON sw.member_id = m.id
      ORDER BY sw.signed_at DESC
      LIMIT ?
    `).all(limit);
    res.json(recent);
  } catch (e) { next(e); }
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

router.put('/templates/:id', (req, res, next) => {
  try {
    const db = getDb();
    const { name, video_url, expires_after_days, content_json } = req.body;
    db.prepare(`
      UPDATE waiver_templates
      SET name = @name, video_url = @video_url, expires_after_days = @expires_after_days,
          content_json = @content_json, updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id: req.params.id,
      name,
      video_url,
      expires_after_days: parseInt(expires_after_days) || 365,
      content_json: typeof content_json === 'string' ? content_json : JSON.stringify(content_json),
    });
    res.json(Waiver.getTemplateById(req.params.id));
  } catch (e) { next(e); }
});

router.post('/seed-defaults', (req, res, next) => {
  try { res.json({ count: Waiver.seedDefaults() }); } catch (e) { next(e); }
});

module.exports = router;
