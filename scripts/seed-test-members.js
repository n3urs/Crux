#!/usr/bin/env node
/**
 * Seed ~200 fake members into a gym's database for testing.
 *
 * Usage:
 *   node scripts/seed-test-members.js <gym_id>
 *
 * Example:
 *   node scripts/seed-test-members.js mygym
 *
 * What gets created:
 *   - 200 members with realistic UK names, phones, emails, DOBs
 *   - ~40% with an active pass (member_passes row, status='active')
 *   - ~20% with an expired pass (member_passes row, status='expired')
 *   - ~15% with no pass at all
 *   - ~10% with unpaid registration fee
 *   - ~10% minors (age 8–17)
 *   - ~5% with medical conditions
 *   - A signed_waiver row for all members with an active pass
 *   - Some check-in history (last 30 days) for members with active passes
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

// ── Helpers ──────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(options) {
  // options: [{ value, weight }, ...]
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

function isoDate(date) {
  return date.toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── Name pools (realistic UK) ────────────────────────────────────────────

const MALE_NAMES = [
  'Oliver', 'George', 'Harry', 'Noah', 'Jack', 'Charlie', 'Liam', 'James',
  'Ethan', 'Lucas', 'Mason', 'Aiden', 'Sebastian', 'Leo', 'Finn', 'Theo',
  'Archie', 'Freddie', 'Isaac', 'Thomas', 'Henry', 'Elijah', 'Samuel',
  'Adam', 'Ben', 'Daniel', 'Josh', 'Matt', 'Ryan', 'Tom', 'Alex', 'Chris',
  'Dave', 'Mike', 'Nick', 'Pete', 'Rob', 'Sam', 'Scott', 'Tim', 'Will',
  'Connor', 'Dylan', 'Jake', 'Callum', 'Kieran', 'Luca', 'Oscar', 'Rory',
  'Aaron', 'Evan', 'Nathan', 'Luke', 'Jamie', 'Marcus', 'Ewan', 'Hamish',
  'Niall', 'Rowan', 'Seb', 'Zach', 'Alfie', 'Toby', 'Max', 'Joe'
];

const FEMALE_NAMES = [
  'Olivia', 'Amelia', 'Isla', 'Ava', 'Mia', 'Ivy', 'Lily', 'Sophia',
  'Grace', 'Freya', 'Poppy', 'Evie', 'Ella', 'Emily', 'Millie', 'Daisy',
  'Florence', 'Chloe', 'Layla', 'Phoebe', 'Sienna', 'Emma', 'Lucy',
  'Sophie', 'Hannah', 'Charlotte', 'Jessica', 'Sarah', 'Kate', 'Laura',
  'Amy', 'Anna', 'Beth', 'Claire', 'Emma', 'Fiona', 'Hannah', 'Jennifer',
  'Leah', 'Megan', 'Natalie', 'Rachel', 'Rebecca', 'Zoe', 'Ellie',
  'Amber', 'Alice', 'Holly', 'Imogen', 'Katie', 'Lauren', 'Molly',
  'Niamh', 'Rose', 'Rosie', 'Scarlett', 'Skye', 'Tara', 'Victoria'
];

const LAST_NAMES = [
  'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans',
  'Wilson', 'Thomas', 'Roberts', 'Johnson', 'Lewis', 'Walker', 'Robinson',
  'Wood', 'Thompson', 'White', 'Watson', 'Jackson', 'Wright', 'Green',
  'Harris', 'Cooper', 'King', 'Lee', 'Martin', 'Clarke', 'James', 'Morgan',
  'Hughes', 'Edwards', 'Hill', 'Moore', 'Clark', 'Harrison', 'Scott',
  'Young', 'Morris', 'Hall', 'Ward', 'Turner', 'Carter', 'Phillips',
  'Mitchell', 'Patel', 'Adams', 'Campbell', 'Anderson', 'Allen', 'Cook',
  'Bailey', 'Bell', 'Collins', 'Shaw', 'Murphy', 'Rogers', 'Kelly',
  'Richardson', 'Cox', 'Howard', 'Bennett', 'Griffiths', 'Price', 'Peake',
  'Sutton', 'Finch', 'Walsh', 'Burns', 'Fletcher', 'Holt', 'Reid'
];

const UK_CITIES = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Sheffield',
  'Edinburgh', 'Bristol', 'Liverpool', 'Cardiff', 'Nottingham', 'Leicester',
  'Coventry', 'Bradford', 'York', 'Oxford', 'Cambridge', 'Brighton',
  'Reading', 'Derby', 'Wolverhampton', 'Bath', 'Exeter', 'Plymouth'
];

const UK_POSTCODES_PREFIX = [
  'SW1A', 'EC1A', 'W1T', 'N1', 'SE1', 'E1', 'WC1', 'NW1',
  'M1', 'M4', 'M14', 'LS1', 'LS6', 'B1', 'B15',
  'S1', 'S10', 'L1', 'L8', 'G1', 'G42', 'EH1', 'EH6',
  'BS1', 'BS6', 'CF10', 'OX1', 'CB1', 'BN1', 'RG1'
];

const EMAIL_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.co.uk', 'yahoo.co.uk',
  'icloud.com', 'hotmail.com', 'live.co.uk', 'btinternet.com', 'sky.com'
];

const MEDICAL_CONDITIONS = [
  'Asthma — uses inhaler',
  'Type 1 Diabetes',
  'Epilepsy — well controlled',
  'Nut allergy (carries EpiPen)',
  'Knee reconstruction (right) — 2022',
  'Peanut allergy',
  'Latex allergy',
  'Mild asthma',
  'Heart condition — cleared by GP for exercise',
];

const EXPERIENCE_LEVELS = ['new', 'few_times', 'regular'];

// ── Phone number generator (UK mobile) ──────────────────────────────────

function randomPhone() {
  const prefix = pick(['07700', '07800', '07900', '07500', '07777', '07411', '07511', '07311']);
  const suffix = String(rand(100000, 999999));
  return `${prefix} ${suffix}`;
}

// ── Email generator ──────────────────────────────────────────────────────

function makeEmail(firstName, lastName, usedEmails) {
  const domain = pick(EMAIL_DOMAINS);
  const variants = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}${rand(1, 99)}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase()}${rand(10, 99)}`,
  ];
  for (const v of variants) {
    const email = `${v}@${domain}`;
    if (!usedEmails.has(email)) {
      usedEmails.add(email);
      return email;
    }
  }
  // Fallback with UUID prefix
  const email = `${firstName.toLowerCase()}${uuidv4().split('-')[0]}@${domain}`;
  usedEmails.add(email);
  return email;
}

// ── Date of birth generator ──────────────────────────────────────────────

function randomDOB(isMinor) {
  const now = new Date();
  let birthYear;
  if (isMinor) {
    // Age 8–17
    birthYear = now.getFullYear() - rand(8, 17);
  } else {
    // Age 18–65
    birthYear = now.getFullYear() - rand(18, 65);
  }
  const month = rand(1, 12);
  const day = rand(1, 28); // safe for all months
  return `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const gymId = process.argv[2];
  if (!gymId) {
    console.error('Usage: node scripts/seed-test-members.js <gym_id>');
    console.error('Example: node scripts/seed-test-members.js mygym');
    process.exit(1);
  }

  const dataRoot = process.env.CRUX_DATA_DIR || process.env.BOULDERRYN_DATA_DIR || path.join(__dirname, '..', 'data');
  const dbPath = path.join(dataRoot, 'gyms', gymId, 'gym.db');

  const fs = require('fs');
  if (!fs.existsSync(dbPath)) {
    console.error(`No database found at ${dbPath}`);
    console.error(`Run: node scripts/provision-gym.js ${gymId} first.`);
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF'); // allow inserts without full referential integrity during seeding

  console.log(`\nSeeding test members into gym: ${gymId}`);
  console.log(`DB: ${dbPath}\n`);

  // ── Read existing schema ────────────────────────────────────────────────

  // Check columns on members table
  const memberColumns = db.prepare("PRAGMA table_info(members)").all().map(c => c.name);
  console.log(`Members table columns: ${memberColumns.join(', ')}`);

  // Get pass types from DB
  const passTypes = db.prepare("SELECT id, name, category, price_peak, visits_included, duration_days FROM pass_types WHERE is_active = 1").all();
  if (passTypes.length === 0) {
    console.warn('Warning: no active pass types found. Passes will not be created. Run server once to seed defaults.');
  } else {
    console.log(`Found ${passTypes.length} pass type(s): ${passTypes.map(p => p.name).join(', ')}`);
  }

  // Get first waiver template
  const waiverTemplate = db.prepare("SELECT id, version FROM waiver_templates WHERE type = 'adult' ORDER BY created_at LIMIT 1").get();
  if (!waiverTemplate) {
    console.warn('Warning: no adult waiver template found. Signed waivers will not be created.');
  } else {
    console.log(`Using waiver template: ${waiverTemplate.id}`);
  }

  // ── Prepare statements ──────────────────────────────────────────────────

  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO members (
      id, first_name, last_name, email, phone, date_of_birth, gender,
      city, postal_code, emergency_contact_name, emergency_contact_phone,
      medical_conditions, notes, qr_code, is_minor,
      registration_fee_paid, climbing_experience, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const insertPass = db.prepare(`
    INSERT OR IGNORE INTO member_passes (
      id, member_id, pass_type_id, status, is_peak,
      price_paid, visits_remaining, started_at, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
  `);

  const insertWaiver = db.prepare(`
    INSERT OR IGNORE INTO signed_waivers (
      id, member_id, waiver_template_id, template_version,
      form_data_json, video_watched, signed_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const insertCheckin = db.prepare(`
    INSERT INTO check_ins (id, member_id, member_pass_id, checked_in_at, checked_in_by, method, is_peak)
    VALUES (?, ?, ?, ?, 'Seed Script', 'desk', 1)
  `);

  // ── Generate 200 members ────────────────────────────────────────────────

  const TOTAL = 200;
  const usedEmails = new Set();

  // Pre-existing emails to avoid collision
  const existingEmails = db.prepare("SELECT email FROM members WHERE email IS NOT NULL").all().map(r => r.email);
  existingEmails.forEach(e => usedEmails.add(e));

  let stats = {
    members: 0,
    activePass: 0,
    expiredPass: 0,
    noPass: 0,
    regFeeUnpaid: 0,
    minors: 0,
    medical: 0,
    waivers: 0,
    checkins: 0,
    skipped: 0,
  };

  const seedAll = db.transaction(() => {
    for (let i = 0; i < TOTAL; i++) {
      const gender = Math.random() < 0.52 ? 'male' : 'female';
      const firstName = pick(gender === 'male' ? MALE_NAMES : FEMALE_NAMES);
      const lastName = pick(LAST_NAMES);
      const email = makeEmail(firstName, lastName, usedEmails);

      // Decide member category using weighted random
      const category = weightedPick([
        { value: 'active_pass',   weight: 40 },
        { value: 'expired_pass',  weight: 20 },
        { value: 'no_pass',       weight: 15 },
        { value: 'reg_unpaid',    weight: 10 },
        { value: 'minor',         weight: 10 },
        { value: 'medical',       weight: 5  },
      ]);

      const isMinor = category === 'minor';
      const regFeePaid = category === 'reg_unpaid' ? 0 : 1;
      const hasMedical = category === 'medical' || Math.random() < 0.02; // 2% extra background medical
      const hasWarning = Math.random() < 0.04; // 4% overall

      const dob = randomDOB(isMinor);
      const phone = Math.random() < 0.85 ? randomPhone() : null;
      const city = pick(UK_CITIES);
      const postcodePrefix = pick(UK_POSTCODES_PREFIX);
      const postcode = `${postcodePrefix} ${rand(1, 9)}${String.fromCharCode(65 + rand(0, 25))}${String.fromCharCode(65 + rand(0, 25))}`;
      const experience = pick(EXPERIENCE_LEVELS);

      // Emergency contact (most adults have one)
      const hasEmergency = !isMinor && Math.random() < 0.8;
      const emergencyName = hasEmergency ? `${pick(MALE_NAMES.concat(FEMALE_NAMES))} ${lastName}` : null;
      const emergencyPhone = hasEmergency ? randomPhone() : null;

      const medicalConditions = hasMedical ? pick(MEDICAL_CONDITIONS) : null;
      const notes = hasWarning ? 'Staff note: behaviour warning issued' : null;

      // Join date — between 3 years ago and 7 days ago
      const daysOld = rand(7, 365 * 3);
      const joinDate = daysAgo(daysOld);
      const joinedAt = joinDate.toISOString();

      const memberId = uuidv4();
      const qrCode = `CX-${memberId.split('-')[0].toUpperCase()}`;

      const result = insertMember.run(
        memberId, firstName, lastName, email, phone, dob, gender,
        city, postcode, emergencyName, emergencyPhone,
        medicalConditions, notes, qrCode, isMinor ? 1 : 0,
        regFeePaid, experience, joinedAt, joinedAt
      );

      if (result.changes === 0) {
        stats.skipped++;
        continue;
      }
      stats.members++;

      if (isMinor) stats.minors++;
      if (hasMedical) stats.medical++;
      if (category === 'reg_unpaid') stats.regFeeUnpaid++;

      // ── Add pass ─────────────────────────────────────────────────────────

      if (passTypes.length > 0 && (category === 'active_pass' || category === 'expired_pass' || category === 'medical')) {
        const isActive = category !== 'expired_pass';

        // Pick a suitable pass type
        let passType;
        if (isMinor) {
          passType = passTypes.find(p => p.name && /junior|junior|child|kid|minor/i.test(p.name))
                  || passTypes.find(p => p.category === 'single_entry')
                  || pick(passTypes);
        } else {
          passType = pick(passTypes);
        }

        const passId = uuidv4();
        const pricePaid = passType.price_peak || 10;

        let startedAt, expiresAt, status, visitsRemaining;

        if (passType.category === 'single_entry') {
          // Single entry — no expiry, 1 visit
          startedAt = joinedAt;
          expiresAt = null;
          status = isActive ? 'active' : 'expired';
          visitsRemaining = isActive ? 1 : 0;
        } else if (passType.category === 'multi_visit') {
          const totalVisits = passType.visits_included || 10;
          const used = isActive ? rand(0, Math.floor(totalVisits * 0.6)) : totalVisits;
          visitsRemaining = totalVisits - used;
          startedAt = daysAgo(rand(1, 60)).toISOString();
          expiresAt = passType.duration_days
            ? daysFromNow(isActive ? rand(5, passType.duration_days) : -rand(1, 30)).toISOString()
            : null;
          status = (isActive && visitsRemaining > 0) ? 'active' : 'expired';
        } else {
          // monthly_pass, membership_dd, etc.
          const durationDays = passType.duration_days || 30;
          if (isActive) {
            startedAt = daysAgo(rand(1, durationDays - 1)).toISOString();
            expiresAt = daysFromNow(rand(1, durationDays)).toISOString();
          } else {
            startedAt = daysAgo(rand(31, 120)).toISOString();
            expiresAt = daysAgo(rand(1, 30)).toISOString();
          }
          status = isActive ? 'active' : 'expired';
          visitsRemaining = null; // unlimited
        }

        insertPass.run(
          passId, memberId, passType.id, status, pricePaid,
          visitsRemaining, startedAt, expiresAt,
          new Date(joinedAt).toISOString(), new Date(joinedAt).toISOString()
        );

        if (status === 'active') {
          stats.activePass++;

          // ── Add waiver for active pass members ─────────────────────────────
          if (waiverTemplate) {
            const waiverId = uuidv4();
            const waiverSignedAt = daysAgo(rand(1, daysOld)).toISOString();
            const waiverExpiresAt = new Date(new Date(waiverSignedAt).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const formData = JSON.stringify({ firstName, lastName, email, dob, medicalConditions });

            insertWaiver.run(
              waiverId, memberId, waiverTemplate.id, waiverTemplate.version || 1,
              formData, waiverSignedAt, waiverExpiresAt
            );
            stats.waivers++;
          }

          // ── Add some check-in history ────────────────────────────────────
          const numCheckins = rand(0, 8);
          for (let c = 0; c < numCheckins; c++) {
            const checkinDaysAgo = rand(0, 30);
            const checkinDate = daysAgo(checkinDaysAgo);
            checkinDate.setHours(rand(9, 20), rand(0, 59), 0, 0);
            insertCheckin.run(uuidv4(), memberId, passId, checkinDate.toISOString());
            stats.checkins++;
          }

        } else {
          stats.expiredPass++;
        }

      } else if (category === 'no_pass' || (category !== 'active_pass' && category !== 'expired_pass' && category !== 'medical')) {
        stats.noPass++;
      }
    }
  });

  try {
    seedAll();
  } catch (err) {
    console.error('Seed transaction failed:', err.message);
    db.close();
    process.exit(1);
  }

  db.close();

  console.log('\n─── Seed complete ─────────────────────────────────────────');
  console.log(`  Members inserted:   ${stats.members}`);
  console.log(`  Skipped/duplicate:  ${stats.skipped}`);
  console.log(`  Active passes:      ${stats.activePass}`);
  console.log(`  Expired passes:     ${stats.expiredPass}`);
  console.log(`  No pass:            ${stats.noPass}`);
  console.log(`  Reg fee unpaid:     ${stats.regFeeUnpaid}`);
  console.log(`  Minors:             ${stats.minors}`);
  console.log(`  Medical conditions: ${stats.medical}`);
  console.log(`  Signed waivers:     ${stats.waivers}`);
  console.log(`  Check-in records:   ${stats.checkins}`);
  console.log('───────────────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
