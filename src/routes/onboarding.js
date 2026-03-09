/**
 * Onboarding routes — setup wizard state for new gyms
 */

const router = require('express').Router();
const { getDb } = require('../main/database/db');

/**
 * GET /api/onboarding/status
 * Returns current onboarding completion state by inspecting real data.
 */
router.get('/status', (req, res, next) => {
  try {
    const db = getDb();

    // gym_details: gym_name is set, non-empty, not the default placeholder
    const gymNameRow = db.prepare("SELECT value FROM settings WHERE key = 'gym_name'").get();
    const gymName = (gymNameRow && gymNameRow.value) ? gymNameRow.value.trim() : '';
    const gymDetails = !!(gymName && gymName !== 'My Gym');

    // waiver: at least one template where updated_at > created_at (i.e. user has edited it)
    const waiverRow = db.prepare(
      "SELECT COUNT(*) as cnt FROM waiver_templates WHERE updated_at > created_at"
    ).get();
    const waiver = !!(waiverRow && waiverRow.cnt > 0);

    // pass_types: at least 1 active pass type
    const passRow = db.prepare("SELECT COUNT(*) as cnt FROM pass_types WHERE is_active = 1").get();
    const passTypes = !!(passRow && passRow.cnt > 0);

    // staff: more than 1 active staff member (beyond the seeded owner)
    const staffRow = db.prepare("SELECT COUNT(*) as cnt FROM staff WHERE is_active = 1").get();
    const staffCount = staffRow ? staffRow.cnt : 0;
    const staff = staffCount > 1;

    // explicitly dismissed
    const dismissedRow = db.prepare("SELECT value FROM settings WHERE key = 'onboarding_complete'").get();
    const dismissed = !!(dismissedRow && dismissedRow.value === '1');

    const allStepsDone = gymDetails && waiver && passTypes && staff;
    const complete = dismissed || allStepsDone;

    res.json({
      complete,
      dismissed,
      steps: {
        gym_details: gymDetails,
        waiver,
        pass_types: passTypes,
        staff,
      },
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/onboarding/dismiss
 * Marks the onboarding as permanently dismissed for this gym.
 */
router.post('/dismiss', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('onboarding_complete', '1', datetime('now'))"
    ).run();
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
