/**
 * Tests for Module 2 (POS) and Module 3 (Waivers)
 */

const { getDb, closeDb } = require('./src/main/database/db');
const Member = require('./src/main/models/member');
const Product = require('./src/main/models/product');
const Transaction = require('./src/main/models/transaction');
const Pass = require('./src/main/models/pass');
const Waiver = require('./src/main/models/waiver');
const GiftCard = require('./src/main/models/giftcard');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; console.log(`  ✗ ${name}: ${err.message}`); }
}

console.log('\n=== Module 2 & 3 Tests ===\n');
const db = getDb();

// ---- PASS TYPES ----
console.log('Pass Types:');

test('Seed default pass types', () => {
  const count = Pass.seedDefaults();
  if (count !== 15) throw new Error(`Expected 15, got ${count}`);
});

test('List pass types', () => {
  const types = Pass.listTypes();
  if (types.length !== 15) throw new Error(`Expected 15, got ${types.length}`);
});

test('Find adult single entry', () => {
  const types = Pass.listTypes();
  const adult = types.find(t => t.name === 'Adult Single Entry');
  if (!adult) throw new Error('Not found');
  if (adult.price_peak !== 15) throw new Error(`Price should be 15, got ${adult.price_peak}`);
  if (adult.price_off_peak !== 12.5) throw new Error(`Off peak should be 12.50`);
});

test('Find adult monthly membership (DD)', () => {
  const types = Pass.listTypes();
  const dd = types.find(t => t.name === 'Adult Monthly Membership');
  if (!dd) throw new Error('Not found');
  if (dd.is_recurring !== 1) throw new Error('Should be recurring');
  if (dd.recurring_interval !== 'monthly') throw new Error('Should be monthly');
  if (dd.price_peak !== 42) throw new Error('Peak should be 42');
});

// ---- PRODUCTS ----
console.log('\nProducts:');

let testProduct;
test('Create product', () => {
  testProduct = Product.create({ name: 'Flat White', price: 3.50, cost_price: 0.80, category_id: 'cat_cafe', stock_count: 50 });
  if (!testProduct.id) throw new Error('No ID');
  if (testProduct.price !== 3.5) throw new Error('Wrong price');
});

test('Create another product', () => {
  Product.create({ name: 'Chalk Bag', price: 12.00, cost_price: 5.00, category_id: 'cat_merch', stock_count: 20, stock_low_threshold: 5 });
});

test('List products grouped', () => {
  const grouped = Product.listGroupedByCategory(true);
  if (grouped.length < 2) throw new Error('Expected at least 2 categories');
  const cafe = grouped.find(g => g.name === 'Café');
  if (!cafe) throw new Error('Café category not found');
  if (cafe.products.length !== 1) throw new Error('Expected 1 café product');
});

test('Search product', () => {
  const results = Product.search('flat');
  if (results.length !== 1) throw new Error('Expected 1 result');
});

test('Adjust stock', () => {
  Product.adjustStock(testProduct.id, -5);
  const updated = Product.getById(testProduct.id);
  if (updated.stock_count !== 45) throw new Error(`Expected 45, got ${updated.stock_count}`);
});

test('Low stock detection', () => {
  // Chalk bag has 20 with threshold 5, should not be low
  const low = Product.getLowStock();
  if (low.length !== 0) throw new Error('Should have no low stock items');
});

// ---- TRANSACTIONS ----
console.log('\nTransactions:');

const testMember = Member.create({ first_name: 'POS', last_name: 'Tester', email: 'pos@test.com' });

let testTxn;
test('Create transaction with items', () => {
  testTxn = Transaction.create({
    member_id: testMember.id,
    payment_method: 'dojo_card',
    items: [
      { product_id: testProduct.id, description: 'Flat White', unit_price: 3.50, quantity: 2 },
    ],
  });
  if (!testTxn.id) throw new Error('No ID');
  if (testTxn.total_amount !== 7.00) throw new Error(`Expected 7.00, got ${testTxn.total_amount}`);
  if (testTxn.items.length !== 1) throw new Error('Expected 1 item');
});

test('Stock deducted after sale', () => {
  const product = Product.getById(testProduct.id);
  if (product.stock_count !== 43) throw new Error(`Expected 43 (45-2), got ${product.stock_count}`);
});

test('List transactions', () => {
  const result = Transaction.list({ page: 1, perPage: 10 });
  if (result.total < 1) throw new Error('No transactions');
});

test('Daily summary', () => {
  const summary = Transaction.dailySummary();
  if (summary.totals.total_sales < 7) throw new Error('Revenue should be >= 7');
  if (summary.totals.transaction_count < 1) throw new Error('Should have >= 1 transaction');
});

test('Refund transaction', () => {
  const refund = Transaction.refund(testTxn.id);
  if (refund.total_amount !== -7.00) throw new Error(`Expected -7.00, got ${refund.total_amount}`);
  const original = Transaction.getById(testTxn.id);
  if (original.payment_status !== 'refunded') throw new Error('Original should be refunded');
});

// ---- PASSES (issue/pause/unpause/cancel) ----
console.log('\nPass Management:');

const passTypes = Pass.listTypes();
const adultMonthly = passTypes.find(t => t.name === 'Adult Monthly Pass');
const adultDD = passTypes.find(t => t.name === 'Adult Monthly Membership');
const tenVisit = passTypes.find(t => t.name === 'Adult 10 Visit Pass');

let testPass;
test('Issue monthly pass', () => {
  testPass = Pass.issue(testMember.id, adultMonthly.id, true);
  if (testPass.status !== 'active') throw new Error('Should be active');
  if (testPass.price_paid !== 45) throw new Error('Should be 45');
  if (!testPass.expires_at) throw new Error('Should have expiry');
});

test('Get active passes', () => {
  const active = Pass.getActivePasses(testMember.id);
  if (active.length !== 1) throw new Error('Expected 1 active pass');
});

test('Pause pass', () => {
  const paused = Pass.pause(testPass.id, 'Going on holiday');
  if (paused.status !== 'paused') throw new Error('Should be paused');
  if (paused.pause_reason !== 'Going on holiday') throw new Error('Wrong reason');
});

test('Unpause extends expiry', () => {
  const before = Pass.getById(testPass.id);
  // Small delay for expiry extension calc
  const unpaused = Pass.unpause(testPass.id);
  if (unpaused.status !== 'active') throw new Error('Should be active');
});

test('Cancel pass', () => {
  const cancelled = Pass.cancel(testPass.id, 'Requested');
  if (cancelled.status !== 'cancelled') throw new Error('Should be cancelled');
});

test('Issue 10 visit pass and check visits', () => {
  const vp = Pass.issue(testMember.id, tenVisit.id, true);
  if (vp.visits_remaining !== 10) throw new Error(`Expected 10, got ${vp.visits_remaining}`);
});

test('Expire overdue passes', () => {
  // Create a pass that expired yesterday
  const { v4: uuidv4 } = require('uuid');
  db.prepare(`
    INSERT INTO member_passes (id, member_id, pass_type_id, status, is_peak, price_paid, expires_at)
    VALUES (?, ?, ?, 'active', 1, 15, datetime('now', '-1 day'))
  `).run(uuidv4(), testMember.id, adultMonthly.id);

  const count = Pass.expireOverdue();
  if (count < 1) throw new Error('Should have expired at least 1');
});

// ---- WAIVERS ----
console.log('\nWaivers:');

test('Seed default waiver templates', () => {
  const count = Waiver.seedDefaults();
  if (count !== 2) throw new Error(`Expected 2, got ${count}`);
});

test('Get active adult template', () => {
  const t = Waiver.getActiveTemplate('adult');
  if (!t) throw new Error('Not found');
  if (t.name !== 'Adult Acknowledgement of Risk') throw new Error('Wrong name');
  if (!t.content.confirmation_questions) throw new Error('Missing content');
  if (t.content.confirmation_questions.length !== 8) throw new Error('Expected 8 questions');
});

test('Get active minor template', () => {
  const t = Waiver.getActiveTemplate('minor');
  if (!t) throw new Error('Not found');
  if (!t.content.requires_dependents) throw new Error('Should require dependents');
  if (!t.content.additional_checkboxes) throw new Error('Should have photo ID consent');
});

let signedWaiver;
test('Sign adult waiver', () => {
  const template = Waiver.getActiveTemplate('adult');
  signedWaiver = Waiver.sign({
    member_id: testMember.id,
    waiver_template_id: template.id,
    form_data: { medical_conditions: 'None', climbing_experience: 'regular' },
    signature_supervisee: 'data:image/png;base64,fakeSignatureData',
    video_watched: true,
  });
  if (!signedWaiver.id) throw new Error('No ID');
  if (signedWaiver.video_watched !== 1) throw new Error('Video not marked watched');
});

test('Waiver is now valid', () => {
  if (!Waiver.isValid(testMember.id)) throw new Error('Should be valid');
});

test('Get latest valid waiver', () => {
  const w = Waiver.getLatestValid(testMember.id);
  if (!w) throw new Error('Not found');
  if (w.id !== signedWaiver.id) throw new Error('Wrong waiver');
});

test('Waiver history', () => {
  const history = Waiver.getMemberHistory(testMember.id);
  if (history.length !== 1) throw new Error('Expected 1');
});

test('Sign minor waiver with dependents', () => {
  const parent = Member.create({ first_name: 'Parent', last_name: 'Test', email: 'parent@test.com' });
  const template = Waiver.getActiveTemplate('minor');
  const w = Waiver.sign({
    member_id: parent.id,
    waiver_template_id: template.id,
    form_data: { medical_conditions: 'None' },
    signature_supervisee: 'base64sig',
    signature_dependent: 'base64sig_kid',
    video_watched: true,
    dependents: [
      { first_name: 'Kid', last_name: 'Test', date_of_birth: '2016-05-15', gender: 'female' },
    ],
  });
  if (!w) throw new Error('Failed to sign');
  if (w.dependents.length !== 1) throw new Error('Expected 1 dependent');
  if (w.dependents[0].first_name !== 'Kid') throw new Error('Wrong dependent');
});

// ---- GIFT CARDS ----
console.log('\nGift Cards:');

let testCard;
test('Create gift card', () => {
  testCard = GiftCard.create({ amount: 50.00, member_id: testMember.id });
  if (!testCard.code) throw new Error('No code');
  if (!testCard.code.startsWith('BR-')) throw new Error('Wrong format');
  if (testCard.current_balance !== 50) throw new Error('Wrong balance');
});

test('Redeem gift card', () => {
  const card = GiftCard.redeem(testCard.code, 15.00);
  if (card.current_balance !== 35) throw new Error(`Expected 35, got ${card.current_balance}`);
});

test('Insufficient balance fails', () => {
  try {
    GiftCard.redeem(testCard.code, 100);
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('Insufficient')) throw e;
  }
});

test('Add balance', () => {
  const card = GiftCard.addBalance(testCard.code, 20);
  if (card.current_balance !== 55) throw new Error(`Expected 55, got ${card.current_balance}`);
});

test('Gift card history', () => {
  const history = GiftCard.getHistory(testCard.id);
  if (history.length !== 2) throw new Error(`Expected 2 events, got ${history.length}`);
});

test('List active gift cards', () => {
  const cards = GiftCard.listActive();
  if (cards.length < 1) throw new Error('Should have at least 1');
});

// ---- SMART PRODUCTS (auto-issue pass) ----
console.log('\nSmart Products:');

test('Smart product auto-issues pass', () => {
  const smartProduct = Product.create({
    name: 'Adult Monthly Pass (Peak)',
    price: 45.00,
    category_id: 'cat_passes',
    linked_pass_type_id: adultMonthly.id,
  });

  const buyer = Member.create({ first_name: 'Smart', last_name: 'Buyer', email: 'smart@test.com' });

  Transaction.create({
    member_id: buyer.id,
    payment_method: 'dojo_card',
    items: [{ product_id: smartProduct.id, description: smartProduct.name, unit_price: 45.00 }],
  });

  const passes = Pass.getActivePasses(buyer.id);
  if (passes.length !== 1) throw new Error(`Expected 1 auto-issued pass, got ${passes.length}`);
  if (passes[0].pass_name !== 'Adult Monthly Pass') throw new Error('Wrong pass type issued');
});

// ---- DONE ----
closeDb();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
