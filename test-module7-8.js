const { getDb, closeDb } = require('./src/main/database/db');
const Member = require('./src/main/models/member');
const Pass = require('./src/main/models/pass');
const Transaction = require('./src/main/models/transaction');
const Route = require('./src/main/models/route');
const Analytics = require('./src/main/models/analytics');
const Staff = require('./src/main/models/staff');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; console.log(`  ✗ ${name}: ${err.message}`); }
}

console.log('\n=== Module 7 (Analytics) & Module 8 (Staff) Tests ===\n');
const db = getDb();

// Seed data
Pass.seedDefaults();
const m1 = Member.create({ first_name: 'Ana', last_name: 'Lytics', email: 'ana@test.com' });
const m2 = Member.create({ first_name: 'Staff', last_name: 'Test', email: 'staff@test.com' });

// Create staff first so we can link transactions
const owner = Staff.create({ first_name: 'Oscar', last_name: 'Boss', email: 'oscar@test.com', password: 'test123', pin: '1234', role: 'owner' });

// Issue pass and check in
const passTypes = Pass.listTypes();
const adultPass = passTypes.find(t => t.name === 'Adult Monthly Pass');
Pass.issue(m1.id, adultPass.id, true);

// Check in
const { v4: uuidv4 } = require('uuid');
db.prepare("INSERT INTO check_ins (id, member_id, checked_in_by, method, is_peak) VALUES (?, ?, 'staff', 'desk', 1)").run(uuidv4(), m1.id);
db.prepare("INSERT INTO check_ins (id, member_id, checked_in_by, method, is_peak) VALUES (?, ?, 'staff', 'qr_scan', 0)").run(uuidv4(), m2.id);

// Transactions
Transaction.create({ member_id: m1.id, staff_id: owner.id, payment_method: 'dojo_card', items: [{ description: 'Day Pass', unit_price: 15.00 }] });
Transaction.create({ member_id: m2.id, staff_id: owner.id, payment_method: 'dojo_card', items: [{ description: 'Shoe Rental', unit_price: 3.50 }, { description: 'Day Pass', unit_price: 15.00 }] });

// Routes
Route.createClimb({ wall_id: 'wall_cove', grade: 'V3', colour: 'Red', setter: 'Dave' });
Route.createClimb({ wall_id: 'wall_mothership', grade: 'V5', colour: 'Purple', setter: 'Sarah' });

// ---- ANALYTICS ----
console.log('Footfall Analytics:');

test('Footfall by hour', () => {
  const data = Analytics.footfallByHour();
  if (!Array.isArray(data)) throw new Error('Should be array');
  // We have 2 check-ins today
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total < 2) throw new Error(`Expected >= 2 check-ins, got ${total}`);
});

test('Footfall by day', () => {
  const data = Analytics.footfallByDay(30);
  if (data.length < 1) throw new Error('Should have at least 1 day');
});

test('Footfall by day of week', () => {
  const data = Analytics.footfallByDayOfWeek(90);
  if (data.length < 1) throw new Error('Should have data');
});

test('Peak vs off-peak', () => {
  const data = Analytics.peakVsOffPeak(30);
  if (data.peak + data.offPeak < 2) throw new Error('Should have check-ins');
});

console.log('\nRevenue Analytics:');

test('Revenue by day', () => {
  const data = Analytics.revenueByDay(30);
  if (data.length < 1) throw new Error('Should have data');
  if (data[0].revenue < 15) throw new Error('Should have revenue');
});

test('Revenue by month', () => {
  const data = Analytics.revenueByMonth(12);
  if (data.length < 1) throw new Error('Should have data');
});

test('Revenue by payment method', () => {
  const data = Analytics.revenueByPaymentMethod(30);
  const card = data.find(d => d.payment_method === 'dojo_card');
  if (!card) throw new Error('Should have card payments');
  if (card.revenue < 33.5) throw new Error('Revenue too low');
});

test('Top products', () => {
  const data = Analytics.topProducts(30, 10);
  if (data.length < 1) throw new Error('Should have products');
  const dayPass = data.find(d => d.description === 'Day Pass');
  if (!dayPass || dayPass.qty < 2) throw new Error('Should have 2 day passes');
});

console.log('\nMember Analytics:');

test('Member growth', () => {
  const data = Analytics.memberGrowth(90);
  if (data.length < 1) throw new Error('Should have data');
});

test('New vs returning', () => {
  const data = Analytics.newVsReturning(30);
  if (data.total < 2) throw new Error('Should have visitors');
});

test('Visit frequency', () => {
  const data = Analytics.visitFrequency(90);
  if (data.length < 1) throw new Error('Should have data');
});

test('Active pass breakdown', () => {
  const data = Analytics.activePassBreakdown();
  if (data.length < 1) throw new Error('Should have passes');
});

test('Pass churn rate', () => {
  const data = Analytics.passChurnRate(90);
  if (data.active < 1) throw new Error('Should have active passes');
});

test('KPI summary', () => {
  const kpi = Analytics.kpiSummary();
  if (kpi.totalMembers < 2) throw new Error('Should have members');
  if (kpi.todayCheckIns < 2) throw new Error('Should have check-ins');
  if (kpi.todayRevenue < 33) throw new Error('Should have revenue');
  if (kpi.activeRoutes < 2) throw new Error('Should have routes');
});

// ---- STAFF ----
console.log('\nStaff Management:');

test('Create staff with roles', () => {
  Staff.create({ first_name: 'Desk', last_name: 'Worker', email: 'desk@test.com', pin: '5678', role: 'desk' });
  Staff.create({ first_name: 'Route', last_name: 'Setter', email: 'setter@test.com', pin: '9012', role: 'setter' });
});

test('List staff', () => {
  const list = Staff.list();
  if (list.length < 3) throw new Error(`Expected >= 3, got ${list.length}`);
});

test('Authenticate by PIN', () => {
  const staff = Staff.authenticateByPin('1234');
  if (!staff) throw new Error('Auth failed');
  if (staff.first_name !== 'Oscar') throw new Error('Wrong person');
  if (staff.password_hash) throw new Error('Should not expose password hash');
});

test('Authenticate by password', () => {
  const staff = Staff.authenticateByPassword('oscar@test.com', 'test123');
  if (!staff) throw new Error('Auth failed');
  if (staff.first_name !== 'Oscar') throw new Error('Wrong person');
});

test('Wrong PIN returns null', () => {
  const staff = Staff.authenticateByPin('0000');
  if (staff !== null) throw new Error('Should be null');
});

test('Wrong password returns null', () => {
  const staff = Staff.authenticateByPassword('oscar@test.com', 'wrong');
  if (staff !== null) throw new Error('Should be null');
});

test('Permission check - owner has all', () => {
  if (!Staff.hasPermission(owner.id, 'analytics')) throw new Error('Owner should have analytics');
  if (!Staff.hasPermission(owner.id, 'settings')) throw new Error('Owner should have settings');
});

test('Permission check - desk limited', () => {
  const desk = Staff.list().find(s => s.role === 'desk');
  const full = Staff.getById(desk.id);
  if (full.permissions.analytics) throw new Error('Desk should not have analytics');
  if (full.permissions.settings) throw new Error('Desk should not have settings');
  if (!full.permissions.checkin) throw new Error('Desk should have checkin');
  if (!full.permissions.pos) throw new Error('Desk should have pos');
});

test('Permission check - setter limited', () => {
  const setter = Staff.list().find(s => s.role === 'setter');
  const full = Staff.getById(setter.id);
  if (!full.permissions.routes_edit) throw new Error('Setter should edit routes');
  if (full.permissions.pos) throw new Error('Setter should not have POS');
});

test('Deactivate staff', () => {
  const desk = Staff.list().find(s => s.role === 'desk');
  Staff.deactivate(desk.id);
  const all = Staff.list(false);
  const deactivated = all.find(s => s.id === desk.id);
  if (deactivated.is_active !== 0) throw new Error('Should be inactive');
  const activeOnly = Staff.list(true);
  if (activeOnly.find(s => s.id === desk.id)) throw new Error('Should not appear in active list');
});

console.log('\nStaff Rota:');

test('Create shift', () => {
  const shift = Staff.createShift({
    staff_id: owner.id, shift_date: new Date().toISOString().split('T')[0],
    start_time: '09:00', end_time: '17:00', notes: 'Morning shift',
  });
  if (!shift.id) throw new Error('No ID');
});

test('Get shifts', () => {
  const shifts = Staff.getShifts({ staffId: owner.id });
  if (shifts.length < 1) throw new Error('Should have shifts');
  if (shifts[0].first_name !== 'Oscar') throw new Error('Wrong staff');
});

test('Week rota', () => {
  const today = new Date().toISOString().split('T')[0];
  const rota = Staff.getWeekRota(today);
  if (rota.length < 1) throw new Error('Should have shifts this week');
});

test('Delete shift', () => {
  const shifts = Staff.getShifts({ staffId: owner.id });
  Staff.deleteShift(shifts[0].id);
  const after = Staff.getShifts({ staffId: owner.id });
  if (after.length !== 0) throw new Error('Shift should be deleted');
});

console.log('\nStaff Sales:');

test('Staff sales analytics', () => {
  const sales = Analytics.staffSales(30);
  if (sales.length < 1) throw new Error('Should have data');
  if (sales[0].staff_name !== 'Oscar Boss') throw new Error('Wrong name');
  if (sales[0].revenue < 33) throw new Error('Revenue too low');
});

test('Audit trail', () => {
  const trail = Staff.getAuditTrail({ limit: 10 });
  if (trail.length < 2) throw new Error('Should have transactions');
});

closeDb();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
