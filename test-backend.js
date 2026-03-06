/**
 * Backend integration test — runs outside Electron
 */

const Member = require('./src/main/models/member');
const { getDb, closeDb } = require('./src/main/database/db');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

console.log('\n=== BoulderRyn Backend Tests ===\n');

// Ensure DB is fresh
const db = getDb();

// -----------------------------------------------------------
console.log('Member CRUD:');

let testMember;
test('Create member', () => {
  testMember = Member.create({
    first_name: 'Test',
    last_name: 'Climber',
    email: 'test@example.com',
    phone: '07700900000',
    date_of_birth: '1995-06-15',
    city: 'Penryn',
    postal_code: 'TR10 8AA',
    climbing_experience: 'regular',
    emergency_contact_name: 'Jane Climber',
    emergency_contact_phone: '07700900001',
  });
  if (!testMember.id) throw new Error('No ID returned');
  if (!testMember.qr_code) throw new Error('No QR code generated');
  if (!testMember.qr_code.startsWith('BR-')) throw new Error('QR code format wrong');
});

test('Get by ID', () => {
  const m = Member.getById(testMember.id);
  if (m.first_name !== 'Test') throw new Error('Wrong name');
  if (m.email !== 'test@example.com') throw new Error('Wrong email');
});

test('Get by email', () => {
  const m = Member.getByEmail('test@example.com');
  if (!m) throw new Error('Not found');
  if (m.id !== testMember.id) throw new Error('Wrong member');
});

test('Get by QR code', () => {
  const m = Member.getByQrCode(testMember.qr_code);
  if (!m) throw new Error('Not found');
  if (m.id !== testMember.id) throw new Error('Wrong member');
});

test('Search by name', () => {
  const results = Member.search('Test');
  if (results.length === 0) throw new Error('No results');
  if (results[0].id !== testMember.id) throw new Error('Wrong member');
});

test('Search by full name', () => {
  const results = Member.search('Test Climber');
  if (results.length === 0) throw new Error('No results');
});

test('Update member', () => {
  const updated = Member.update(testMember.id, { notes: 'Likes crimps', medical_conditions: 'Asthma' });
  if (updated.notes !== 'Likes crimps') throw new Error('Notes not updated');
  if (updated.medical_conditions !== 'Asthma') throw new Error('Medical not updated');
});

test('List members', () => {
  const result = Member.list({ page: 1, perPage: 10 });
  if (result.total < 1) throw new Error('No members in list');
  if (result.members.length < 1) throw new Error('Empty members array');
});

test('Count members', () => {
  const count = Member.count();
  if (count < 1) throw new Error('Count is 0');
});

// -----------------------------------------------------------
console.log('\nFamily links:');

let childMember;
test('Create child member', () => {
  childMember = Member.create({
    first_name: 'Mini',
    last_name: 'Climber',
    date_of_birth: '2015-03-20',
    is_minor: 1,
  });
  if (!childMember.id) throw new Error('No ID');
  if (childMember.is_minor !== 1) throw new Error('Not marked as minor');
});

test('Add family link', () => {
  Member.addFamilyLink(testMember.id, childMember.id, 'parent');
});

test('Get family - parent perspective', () => {
  const family = Member.getFamily(testMember.id);
  if (family.children.length !== 1) throw new Error('Expected 1 child');
  if (family.children[0].first_name !== 'Mini') throw new Error('Wrong child');
});

test('Get family - child perspective', () => {
  const family = Member.getFamily(childMember.id);
  if (family.parents.length !== 1) throw new Error('Expected 1 parent');
  if (family.parents[0].first_name !== 'Test') throw new Error('Wrong parent');
});

// -----------------------------------------------------------
console.log('\nTags:');

test('Create and apply tag', () => {
  const { v4: uuidv4 } = require('uuid');
  const tagId = uuidv4();
  db.prepare("INSERT INTO tags (id, name, colour) VALUES (?, 'Competition Team', '#EF4444')").run(tagId);
  db.prepare("INSERT INTO member_tags (member_id, tag_id, applied_by) VALUES (?, ?, 'staff')").run(testMember.id, tagId);
});

test('Tags appear in member detail', () => {
  const detail = Member.getWithPassStatus(testMember.id);
  if (detail.tags.length !== 1) throw new Error('Expected 1 tag');
  if (detail.tags[0].name !== 'Competition Team') throw new Error('Wrong tag');
});

// -----------------------------------------------------------
console.log('\nCertifications:');

test('Create cert type and grant', () => {
  const { v4: uuidv4 } = require('uuid');
  const certTypeId = uuidv4();
  db.prepare("INSERT INTO certification_types (id, name, description) VALUES (?, 'Belay Competency', 'Passed belay test')").run(certTypeId);
  
  const certId = uuidv4();
  db.prepare("INSERT INTO member_certifications (id, member_id, certification_type_id, granted_by) VALUES (?, ?, ?, 'Staff')").run(certId, testMember.id, certTypeId);
});

test('Certs appear in member detail', () => {
  const detail = Member.getWithPassStatus(testMember.id);
  if (detail.certifications.length !== 1) throw new Error('Expected 1 cert');
  if (detail.certifications[0].cert_name !== 'Belay Competency') throw new Error('Wrong cert');
});

// -----------------------------------------------------------
console.log('\nPass & Check-in:');

test('Create pass type and assign', () => {
  const { v4: uuidv4 } = require('uuid');
  const passTypeId = uuidv4();
  db.prepare(`
    INSERT INTO pass_types (id, name, category, price_peak, price_off_peak, duration_days, is_active)
    VALUES (?, 'Adult Monthly Peak', 'monthly_pass', 45.00, 35.00, 30, 1)
  `).run(passTypeId);

  const passId = uuidv4();
  db.prepare(`
    INSERT INTO member_passes (id, member_id, pass_type_id, status, is_peak, price_paid, expires_at)
    VALUES (?, ?, ?, 'active', 1, 45.00, datetime('now', '+30 days'))
  `).run(passId, testMember.id, passTypeId);
});

test('Member now has valid pass', () => {
  const detail = Member.getWithPassStatus(testMember.id);
  if (!detail.has_valid_pass) throw new Error('Should have valid pass');
  if (detail.active_pass.pass_name !== 'Adult Monthly Peak') throw new Error('Wrong pass name');
});

// -----------------------------------------------------------
console.log('\nWaivers:');

test('Create waiver template and sign', () => {
  const { v4: uuidv4 } = require('uuid');
  const templateId = uuidv4();
  db.prepare(`
    INSERT INTO waiver_templates (id, name, type, content_json, video_url, expires_after_days, version)
    VALUES (?, 'Adult Acknowledgement of Risk', 'adult', '{}', 'https://www.youtube.com/watch?v=-r2zbi21aks', 365, 1)
  `).run(templateId);

  const waiverId = uuidv4();
  db.prepare(`
    INSERT INTO signed_waivers (id, member_id, waiver_template_id, template_version, form_data_json, signature_supervisee, video_watched, expires_at)
    VALUES (?, ?, ?, 1, '{"answers":"all_yes"}', 'base64signaturedata', 1, datetime('now', '+365 days'))
  `).run(waiverId, testMember.id, templateId);
});

test('Member now has valid waiver', () => {
  const detail = Member.getWithPassStatus(testMember.id);
  if (!detail.waiver_valid) throw new Error('Should have valid waiver');
});

// -----------------------------------------------------------
console.log('\nFull member status check:');

test('getWithPassStatus returns everything', () => {
  const detail = Member.getWithPassStatus(testMember.id);
  if (!detail.has_valid_pass) throw new Error('Missing pass');
  if (!detail.waiver_valid) throw new Error('Missing waiver');
  if (detail.certifications.length === 0) throw new Error('Missing certs');
  if (detail.tags.length === 0) throw new Error('Missing tags');
  if (detail.notes !== 'Likes crimps') throw new Error('Missing notes');
  if (detail.medical_conditions !== 'Asthma') throw new Error('Missing medical');
});

// -----------------------------------------------------------
console.log('\nCheck-in simulation:');

test('Check-in via IPC-style call', () => {
  const { v4: uuidv4 } = require('uuid');
  const member = Member.getWithPassStatus(testMember.id);
  
  // Simulate check-in logic from main.js
  if (!member.waiver_valid) throw new Error('Waiver invalid');
  if (!member.has_valid_pass) throw new Error('No valid pass');
  
  const checkInId = uuidv4();
  db.prepare(`
    INSERT INTO check_ins (id, member_id, member_pass_id, checked_in_by, method, is_peak)
    VALUES (?, ?, ?, 'staff', 'desk', 1)
  `).run(checkInId, testMember.id, member.active_pass.id);
  
  // Verify
  const checkIn = db.prepare("SELECT * FROM check_ins WHERE id = ?").get(checkInId);
  if (!checkIn) throw new Error('Check-in not recorded');
});

test('Today check-in detected', () => {
  const detail = Member.getWithPassStatus(testMember.id);
  if (!detail.checked_in_today) throw new Error('Should show as checked in today');
});

// -----------------------------------------------------------
console.log('\nRoutes:');

test('Create climb on wall', () => {
  const { v4: uuidv4 } = require('uuid');
  const climbId = uuidv4();
  db.prepare(`
    INSERT INTO climbs (id, wall_id, grade, colour, setter, style_tags, date_set, status)
    VALUES (?, 'wall_cove', 'V4', 'Red', 'Dave', 'crimpy,technical', date('now'), 'active')
  `).run(climbId);
  
  const climb = db.prepare("SELECT * FROM climbs WHERE id = ?").get(climbId);
  if (climb.grade !== 'V4') throw new Error('Wrong grade');
  if (climb.colour !== 'Red') throw new Error('Wrong colour');
});

test('Log climb attempt', () => {
  const { v4: uuidv4 } = require('uuid');
  const climb = db.prepare("SELECT id FROM climbs LIMIT 1").get();
  const logId = uuidv4();
  db.prepare(`
    INSERT INTO climb_logs (id, climb_id, member_id, attempts, sent, logged_via)
    VALUES (?, ?, ?, 3, 1, 'desk')
  `).run(logId, climb.id, testMember.id);
  
  const log = db.prepare("SELECT * FROM climb_logs WHERE id = ?").get(logId);
  if (log.attempts !== 3) throw new Error('Wrong attempts');
  if (log.sent !== 1) throw new Error('Should be sent');
});

// -----------------------------------------------------------
console.log('\nProducts & Transactions:');

test('Create product and transaction', () => {
  const { v4: uuidv4 } = require('uuid');
  const prodId = uuidv4();
  db.prepare(`
    INSERT INTO products (id, category_id, name, price, cost_price, is_active)
    VALUES (?, 'cat_cafe', 'Flat White', 3.50, 0.80, 1)
  `).run(prodId);
  
  const txnId = uuidv4();
  db.prepare(`
    INSERT INTO transactions (id, member_id, total_amount, payment_method, payment_status)
    VALUES (?, ?, 3.50, 'dojo_card', 'completed')
  `).run(txnId, testMember.id);
  
  const itemId = uuidv4();
  db.prepare(`
    INSERT INTO transaction_items (id, transaction_id, product_id, description, quantity, unit_price, total_price)
    VALUES (?, ?, ?, 'Flat White', 1, 3.50, 3.50)
  `).run(itemId, txnId, prodId);
  
  const txn = db.prepare("SELECT * FROM transactions WHERE id = ?").get(txnId);
  if (txn.total_amount !== 3.50) throw new Error('Wrong amount');
});

// -----------------------------------------------------------
console.log('\nStats dashboard:');

test('Dashboard stats return correctly', () => {
  const totalMembers = db.prepare('SELECT count(*) as c FROM members').get().c;
  const todayCheckIns = db.prepare("SELECT count(*) as c FROM check_ins WHERE date(checked_in_at) = date('now')").get().c;
  const todayRevenue = db.prepare("SELECT COALESCE(sum(total_amount), 0) as total FROM transactions WHERE date(created_at) = date('now') AND payment_status = 'completed'").get().total;
  
  if (totalMembers < 2) throw new Error('Expected at least 2 members');
  if (todayCheckIns < 1) throw new Error('Expected at least 1 check-in');
  if (todayRevenue < 3.50) throw new Error('Expected revenue from coffee');
});

// -----------------------------------------------------------
console.log('\nCleanup:');

test('Delete member', () => {
  const result = Member.delete(childMember.id);
  if (result.changes !== 1) throw new Error('Delete failed');
  const check = Member.getById(childMember.id);
  if (check) throw new Error('Member still exists');
});

closeDb();
console.log('\n=== All tests complete ===\n');
