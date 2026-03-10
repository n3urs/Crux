/**
 * Onboarding email sequence for new gym owners.
 *
 * Emails sent:
 *   day3  — Getting started tips
 *   day7  — One week in / setup checklist
 *   day13 — Trial ends tomorrow (conversion nudge)
 *   day14 — Trial expired (if still trialing, no card added)
 *
 * Run checkAndSendSequenceEmails() on a schedule (e.g. every hour).
 * Uses a `sequence_log` table in platform.db to ensure each email
 * is sent at most once per gym.
 */

const nodemailer = require('nodemailer');
const path = require('path');
const Database = require('better-sqlite3');
const { getPlatformDb } = require('../main/database/platformDb');

const SMTP_USER = process.env.SMTP_USER || 'cruxgymhq@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'Crux <hello@cruxgym.co.uk>';

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ── Ensure sequence_log table exists ──────────────────────────────────────────

function ensureSequenceLog(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sequence_log (
      gym_id TEXT NOT NULL,
      email_key TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (gym_id, email_key)
    );
  `);
}

// ── Get owner email from gym's staff DB ───────────────────────────────────────

function getOwnerEmail(gymId) {
  try {
    const dataRoot = process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const dbPath = path.join(dataRoot, 'gyms', gymId, 'gym.db');
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare("SELECT email FROM staff WHERE role = 'owner' LIMIT 1").get();
    db.close();
    return row?.email || null;
  } catch {
    return null;
  }
}

// ── Email templates ────────────────────────────────────────────────────────────

function buildEmail(key, gymId, gymName) {
  const dashboardUrl = `https://${gymId}.cruxgym.co.uk`;
  const billingUrl = `https://${gymId}.cruxgym.co.uk/?page=settings&tab=billing`;
  const stripePortalUrl = `https://${gymId}.cruxgym.co.uk/?page=settings&tab=billing`;

  const wrap = (title, body) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#1E3A5F;padding:28px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;">⛰ Crux</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">${title}</h1>
      ${body}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Powered by Crux · <a href="https://cruxgym.co.uk" style="color:#9ca3af;">cruxgym.co.uk</a><br>
        You're receiving this because you signed up for a Crux trial.
        <a href="mailto:hello@cruxgym.co.uk?subject=Unsubscribe" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const btn = (url, label) =>
    `<a href="${url}" style="display:inline-block;margin:20px 0 8px;padding:12px 24px;background:#1E3A5F;color:#fff;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;">${label}</a>`;

  const p = (text) => `<p style="margin:12px 0;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`;

  const li = (items) =>
    `<ul style="margin:12px 0;padding-left:20px;">${items.map(i => `<li style="margin:6px 0;font-size:15px;color:#374151;">${i}</li>`).join('')}</ul>`;

  if (key === 'day3') {
    return {
      subject: `Getting started with Crux — 3 tips for ${gymName}`,
      html: wrap(`Getting started with ${gymName}`, `
        ${p(`You're 3 days in — here are the most important things to set up first:`)}
        ${li([
          `<strong>Add your pass types</strong> — Settings → Pass Types. Set up day passes, memberships, etc.`,
          `<strong>Register your first member</strong> — share <a href="${dashboardUrl}/register">${gymId}.cruxgym.co.uk/register</a> or use the QR code in the staff app.`,
          `<strong>Try a check-in</strong> — scan a member's QR code at the desk or search by name.`,
        ])}
        ${p(`Your dashboard is at:`)}
        ${btn(dashboardUrl, 'Open Dashboard →')}
        ${p(`Any questions? Reply to this email — we're here to help.`)}
      `),
    };
  }

  if (key === 'day7') {
    return {
      subject: `One week with Crux — how's it going?`,
      html: wrap(`One week in 🎉`, `
        ${p(`${gymName} has been on Crux for a week. Here's a quick checklist to make sure you're getting the most out of it:`)}
        ${li([
          `✅ Setup wizard complete (gym details, logo, waiver, pass types)`,
          `☐ Staff invited — Settings → Staff → Invite`,
          `☐ Members registered via /register or imported`,
          `☐ Noticeboard post created for your members`,
          `☐ Member portal tested — visit <a href="${dashboardUrl}/me">${gymId}.cruxgym.co.uk/me</a>`,
        ])}
        ${p(`Your 14-day trial ends in 7 days. Add your card details to keep everything running.`)}
        ${btn(billingUrl, 'Manage Billing →')}
      `),
    };
  }

  if (key === 'day13') {
    return {
      subject: `Your Crux trial ends tomorrow`,
      html: wrap(`Your trial ends tomorrow`, `
        ${p(`Your 14-day free trial for <strong>${gymName}</strong> ends tomorrow.`)}
        ${p(`To keep your gym running without interruption, add your card details now. It takes 2 minutes.`)}
        ${btn(billingUrl, 'Add Payment Details →')}
        ${p(`After your trial, you'll be billed monthly (or annually if you chose that). You can cancel anytime from your billing settings.`)}
        ${p(`Questions? Just reply to this email.`)}
      `),
    };
  }

  if (key === 'day14') {
    return {
      subject: `Your Crux trial has ended — reactivate now`,
      html: wrap(`Your trial has ended`, `
        ${p(`Your free trial for <strong>${gymName}</strong> has ended and your gym is now paused.`)}
        ${p(`Your data is safe. Reactivate your subscription to restore full access in seconds.`)}
        ${btn(stripePortalUrl, 'Reactivate Now →')}
        ${p(`If you have any questions or need help choosing a plan, just reply to this email.`)}
      `),
    };
  }

  return null;
}

// ── Main sequence runner ───────────────────────────────────────────────────────

async function checkAndSendSequenceEmails() {
  if (!SMTP_PASS) return; // No email configured — skip silently

  const db = getPlatformDb();
  ensureSequenceLog(db);

  const gyms = db.prepare(`
    SELECT gym_id, plan, status, trial_ends_at, created_at
    FROM gym_billing
    WHERE trial_ends_at IS NOT NULL
  `).all();

  const now = Date.now();
  const transporter = getTransporter();

  for (const gym of gyms) {
    const trialEnd = new Date(gym.trial_ends_at).getTime();
    const created = new Date(gym.created_at).getTime();
    const daysSinceCreated = (now - created) / (1000 * 60 * 60 * 24);
    const daysUntilTrialEnd = (trialEnd - now) / (1000 * 60 * 60 * 24);

    // Which emails should we send?
    const toSend = [];

    if (daysSinceCreated >= 3 && gym.status === 'trialing') toSend.push('day3');
    if (daysSinceCreated >= 7 && gym.status === 'trialing') toSend.push('day7');
    if (daysUntilTrialEnd <= 1 && daysUntilTrialEnd > -1 && gym.status === 'trialing') toSend.push('day13');
    if (daysUntilTrialEnd <= 0 && gym.status === 'trialing') toSend.push('day14');

    for (const key of toSend) {
      // Check if already sent
      const already = db.prepare('SELECT 1 FROM sequence_log WHERE gym_id = ? AND email_key = ?').get(gym.gym_id, key);
      if (already) continue;

      const ownerEmail = getOwnerEmail(gym.gym_id);
      if (!ownerEmail) continue;

      // Get gym name from gym DB
      let gymName = gym.gym_id;
      try {
        const dataRoot = process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', '..', 'data');
        const gymDb = new Database(path.join(dataRoot, 'gyms', gym.gym_id, 'gym.db'), { readonly: true });
        const row = gymDb.prepare("SELECT value FROM settings WHERE key = 'gym_name'").get();
        if (row) gymName = row.value;
        gymDb.close();
      } catch { /* use gym_id as fallback */ }

      const email = buildEmail(key, gym.gym_id, gymName);
      if (!email) continue;

      try {
        await transporter.sendMail({
          from: SMTP_FROM,
          to: ownerEmail,
          subject: email.subject,
          html: email.html,
        });

        db.prepare('INSERT OR IGNORE INTO sequence_log (gym_id, email_key) VALUES (?, ?)').run(gym.gym_id, key);
        console.log(`[sequence] Sent ${key} to ${ownerEmail} (${gym.gym_id})`);
      } catch (err) {
        console.warn(`[sequence] Failed to send ${key} to ${ownerEmail}:`, err.message);
      }
    }
  }
}

module.exports = { checkAndSendSequenceEmails };
