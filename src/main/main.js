/**
 * BoulderRyn — Main Electron Process
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getDb, closeDb } = require('./database/db');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'BoulderRyn',
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the renderer
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================
// IPC Handlers — bridge between renderer and database/services
// ============================================================

// -- Models --
const Member = require('./models/member');
const Product = require('./models/product');
const Transaction = require('./models/transaction');
const Pass = require('./models/pass');
const Waiver = require('./models/waiver');
const GiftCard = require('./models/giftcard');
const Event = require('./models/event');
const Route = require('./models/route');
const Analytics = require('./models/analytics');
const Staff = require('./models/staff');

ipcMain.handle('member:create', (_, data) => Member.create(data));
ipcMain.handle('member:getById', (_, id) => Member.getById(id));
ipcMain.handle('member:getByQrCode', (_, qrCode) => Member.getByQrCode(qrCode));
ipcMain.handle('member:getByEmail', (_, email) => Member.getByEmail(email));
ipcMain.handle('member:search', (_, query, limit) => Member.search(query, limit));
ipcMain.handle('member:update', (_, id, data) => Member.update(id, data));
ipcMain.handle('member:delete', (_, id) => Member.delete(id));
ipcMain.handle('member:list', (_, opts) => Member.list(opts));
ipcMain.handle('member:count', () => Member.count());
ipcMain.handle('member:getWithPassStatus', (_, id) => Member.getWithPassStatus(id));
ipcMain.handle('member:addFamilyLink', (_, parentId, childId, rel) => Member.addFamilyLink(parentId, childId, rel));
ipcMain.handle('member:getFamily', (_, id) => Member.getFamily(id));
ipcMain.handle('member:sendQrEmail', async (_, id) => {
  try {
    await Member.sendQrEmail(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// -- Check-In --
ipcMain.handle('checkin:process', (_, memberId, method = 'desk') => {
  const db = getDb();
  const { v4: uuidv4 } = require('uuid');

  // Get member with pass status
  const member = Member.getWithPassStatus(memberId);
  if (!member) return { success: false, error: 'Member not found' };

  // Check waiver
  if (!member.waiver_valid) {
    return { success: false, error: 'No valid waiver on file', member, needsWaiver: true };
  }

  // Check pass
  if (!member.has_valid_pass) {
    return { success: false, error: 'No valid pass', member, needsPass: true };
  }

  // Already checked in today?
  if (member.checked_in_today) {
    return { success: true, alreadyCheckedIn: true, member, message: 'Already checked in today' };
  }

  // Determine peak/off-peak
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sunday
  const isWeekday = day >= 1 && day <= 5;
  const isPeak = !isWeekday || hour < 10 || hour >= 16;

  // Deduct visit if multi-visit pass
  if (member.active_pass.visits_remaining !== null) {
    db.prepare('UPDATE member_passes SET visits_remaining = visits_remaining - 1, updated_at = datetime(\'now\') WHERE id = ?')
      .run(member.active_pass.id);
  }

  // Create check-in record
  const checkInId = uuidv4();
  db.prepare(`
    INSERT INTO check_ins (id, member_id, member_pass_id, checked_in_by, method, is_peak)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(checkInId, memberId, member.active_pass.id, 'staff', method, isPeak ? 1 : 0);

  return {
    success: true,
    member: Member.getWithPassStatus(memberId),
    checkInId,
    message: `Welcome, ${member.first_name}!`
  };
});

// -- Products --
ipcMain.handle('product:create', (_, data) => Product.create(data));
ipcMain.handle('product:getById', (_, id) => Product.getById(id));
ipcMain.handle('product:list', (_, opts) => Product.list(opts));
ipcMain.handle('product:listGrouped', (_, activeOnly) => Product.listGroupedByCategory(activeOnly));
ipcMain.handle('product:update', (_, id, data) => Product.update(id, data));
ipcMain.handle('product:delete', (_, id) => Product.delete(id));
ipcMain.handle('product:search', (_, query) => Product.search(query));
ipcMain.handle('product:adjustStock', (_, id, qty) => Product.adjustStock(id, qty));
ipcMain.handle('product:getLowStock', () => Product.getLowStock());
ipcMain.handle('product:createCategory', (_, name, sort) => Product.createCategory(name, sort));
ipcMain.handle('product:listCategories', () => Product.listCategories());
ipcMain.handle('product:updateCategory', (_, id, data) => Product.updateCategory(id, data));
ipcMain.handle('product:deleteCategory', (_, id) => Product.deleteCategory(id));

// -- Transactions --
ipcMain.handle('transaction:create', (_, data) => Transaction.create(data));
ipcMain.handle('transaction:getById', (_, id) => Transaction.getById(id));
ipcMain.handle('transaction:list', (_, opts) => Transaction.list(opts));
ipcMain.handle('transaction:refund', (_, id, amount) => Transaction.refund(id, amount));
ipcMain.handle('transaction:dailySummary', (_, date) => Transaction.dailySummary(date));
ipcMain.handle('transaction:sendReceipt', async (_, id) => {
  try { await Transaction.sendReceipt(id); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

// -- Passes --
ipcMain.handle('pass:createType', (_, data) => Pass.createType(data));
ipcMain.handle('pass:listTypes', (_, activeOnly) => Pass.listTypes(activeOnly));
ipcMain.handle('pass:updateType', (_, id, data) => Pass.updateType(id, data));
ipcMain.handle('pass:issue', (_, memberId, passTypeId, isPeak, pricePaid) => Pass.issue(memberId, passTypeId, isPeak, pricePaid));
ipcMain.handle('pass:getById', (_, id) => Pass.getById(id));
ipcMain.handle('pass:getActive', (_, memberId) => Pass.getActivePasses(memberId));
ipcMain.handle('pass:getAll', (_, memberId) => Pass.getAllPasses(memberId));
ipcMain.handle('pass:pause', (_, id, reason) => Pass.pause(id, reason));
ipcMain.handle('pass:unpause', (_, id) => Pass.unpause(id));
ipcMain.handle('pass:cancel', (_, id, reason) => Pass.cancel(id, reason));
ipcMain.handle('pass:extend', (_, id, days) => Pass.extend(id, days));
ipcMain.handle('pass:transfer', (_, id, newMemberId) => Pass.transfer(id, newMemberId));
ipcMain.handle('pass:seedDefaults', () => Pass.seedDefaults());

// -- Waivers --
ipcMain.handle('waiver:listTemplates', () => Waiver.listTemplates());
ipcMain.handle('waiver:getActiveTemplate', (_, type) => Waiver.getActiveTemplate(type));
ipcMain.handle('waiver:sign', (_, data) => Waiver.sign(data));
ipcMain.handle('waiver:isValid', (_, memberId) => Waiver.isValid(memberId));
ipcMain.handle('waiver:getLatestValid', (_, memberId) => Waiver.getLatestValid(memberId));
ipcMain.handle('waiver:getMemberHistory', (_, memberId) => Waiver.getMemberHistory(memberId));
ipcMain.handle('waiver:getExpiringSoon', (_, days) => Waiver.getExpiringSoon(days));
ipcMain.handle('waiver:seedDefaults', () => Waiver.seedDefaults());

// -- Gift Cards --
ipcMain.handle('giftcard:create', (_, data) => GiftCard.create(data));
ipcMain.handle('giftcard:getByCode', (_, code) => GiftCard.getByCode(code));
ipcMain.handle('giftcard:redeem', (_, code, amount, txnId) => GiftCard.redeem(code, amount, txnId));
ipcMain.handle('giftcard:addBalance', (_, code, amount) => GiftCard.addBalance(code, amount));
ipcMain.handle('giftcard:listActive', () => GiftCard.listActive());

// -- Events --
ipcMain.handle('event:createTemplate', (_, data) => Event.createTemplate(data));
ipcMain.handle('event:listTemplates', (_, activeOnly) => Event.listTemplates(activeOnly));
ipcMain.handle('event:updateTemplate', (_, id, data) => Event.updateTemplate(id, data));
ipcMain.handle('event:create', (_, data) => Event.createEvent(data));
ipcMain.handle('event:createFromTemplate', (_, templateId, startsAt) => Event.createFromTemplate(templateId, startsAt));
ipcMain.handle('event:getById', (_, id) => Event.getEventById(id));
ipcMain.handle('event:list', (_, opts) => Event.listEvents(opts));
ipcMain.handle('event:listUpcoming', (_, days) => Event.listUpcoming(days));
ipcMain.handle('event:update', (_, id, data) => Event.updateEvent(id, data));
ipcMain.handle('event:cancel', (_, id, reason) => Event.cancelEvent(id, reason));
ipcMain.handle('event:complete', (_, id) => Event.completeEvent(id));
ipcMain.handle('event:enrol', (_, eventId, memberId, price, txnId) => Event.enrol(eventId, memberId, price, txnId));
ipcMain.handle('event:cancelEnrolment', (_, id) => Event.cancelEnrolment(id));
ipcMain.handle('event:markAttended', (_, id) => Event.markAttended(id));
ipcMain.handle('event:markNoShow', (_, id) => Event.markNoShow(id));
ipcMain.handle('event:autoCancel', () => Event.autoCancel());
// Courses
ipcMain.handle('event:createCourse', (_, data) => Event.createCourse(data));
ipcMain.handle('event:getCourse', (_, id) => Event.getCourseById(id));
ipcMain.handle('event:listCourses', (_, activeOnly) => Event.listCourses(activeOnly));
ipcMain.handle('event:enrolInCourse', (_, courseId, memberId, price, txnId) => Event.enrolInCourse(courseId, memberId, price, txnId));
ipcMain.handle('event:lateJoinPrice', (_, courseId) => Event.lateJoinPrice(courseId));
// Slots
ipcMain.handle('event:createSlotTemplate', (_, data) => Event.createSlotTemplate(data));
ipcMain.handle('event:listSlotTemplates', (_, activeOnly) => Event.listSlotTemplates(activeOnly));
ipcMain.handle('event:createSlot', (_, data) => Event.createSlot(data));
ipcMain.handle('event:generateSlots', (_, templateId, start, end) => Event.generateSlots(templateId, start, end));
ipcMain.handle('event:bookSlot', (_, slotId, memberId, price, txnId) => Event.bookSlot(slotId, memberId, price, txnId));
ipcMain.handle('event:cancelSlotBooking', (_, id) => Event.cancelSlotBooking(id));
ipcMain.handle('event:listSlots', (_, opts) => Event.listSlots(opts));

// -- Routes --
ipcMain.handle('route:listWalls', () => Route.listWalls());
ipcMain.handle('route:getWall', (_, id) => Route.getWall(id));
ipcMain.handle('route:createClimb', (_, data) => Route.createClimb(data));
ipcMain.handle('route:getClimb', (_, id) => Route.getClimbById(id));
ipcMain.handle('route:listClimbs', (_, opts) => Route.listClimbs(opts));
ipcMain.handle('route:updateClimb', (_, id, data) => Route.updateClimb(id, data));
ipcMain.handle('route:stripClimb', (_, id) => Route.stripClimb(id));
ipcMain.handle('route:logAttempt', (_, data) => Route.logAttempt(data));
ipcMain.handle('route:getMemberLogbook', (_, memberId, opts) => Route.getMemberLogbook(memberId, opts));
ipcMain.handle('route:getMemberStats', (_, memberId) => Route.getMemberStats(memberId));
ipcMain.handle('route:addFeedback', (_, data) => Route.addFeedback(data));
ipcMain.handle('route:getClimbFeedback', (_, climbId) => Route.getClimbFeedback(climbId));
ipcMain.handle('route:gradeDistribution', (_, wallId) => Route.getGradeDistribution(wallId));
ipcMain.handle('route:styleDistribution', (_, wallId) => Route.getStyleDistribution(wallId));
ipcMain.handle('route:colourDistribution', (_, wallId) => Route.getColourDistribution(wallId));
ipcMain.handle('route:createHold', (_, data) => Route.createHold(data));
ipcMain.handle('route:listHolds', (_, opts) => Route.listHolds(opts));
ipcMain.handle('route:updateHold', (_, id, data) => Route.updateHold(id, data));
ipcMain.handle('route:createCompetition', (_, data) => Route.createCompetition(data));
ipcMain.handle('route:getCompetition', (_, id) => Route.getCompetitionById(id));
ipcMain.handle('route:listCompetitions', (_, status) => Route.listCompetitions(status));
ipcMain.handle('route:registerForComp', (_, compId, memberId, cat) => Route.registerForCompetition(compId, memberId, cat));
ipcMain.handle('route:submitScore', (_, data) => Route.submitScore(data));
ipcMain.handle('route:getLeaderboard', (_, compId) => Route.getLeaderboard(compId));
ipcMain.handle('route:startCompetition', (_, id) => Route.startCompetition(id));
ipcMain.handle('route:completeCompetition', (_, id) => Route.completeCompetition(id));
ipcMain.handle('route:dueForStripping', (_, days) => Route.getDueForStripping(days));

// -- Analytics --
ipcMain.handle('analytics:footfallByHour', (_, date) => Analytics.footfallByHour(date));
ipcMain.handle('analytics:footfallByDay', (_, days) => Analytics.footfallByDay(days));
ipcMain.handle('analytics:footfallByDayOfWeek', (_, days) => Analytics.footfallByDayOfWeek(days));
ipcMain.handle('analytics:peakVsOffPeak', (_, days) => Analytics.peakVsOffPeak(days));
ipcMain.handle('analytics:revenueByDay', (_, days) => Analytics.revenueByDay(days));
ipcMain.handle('analytics:revenueByMonth', (_, months) => Analytics.revenueByMonth(months));
ipcMain.handle('analytics:revenueByCategory', (_, days) => Analytics.revenueByCategory(days));
ipcMain.handle('analytics:revenueByPaymentMethod', (_, days) => Analytics.revenueByPaymentMethod(days));
ipcMain.handle('analytics:topProducts', (_, days, limit) => Analytics.topProducts(days, limit));
ipcMain.handle('analytics:memberGrowth', (_, days) => Analytics.memberGrowth(days));
ipcMain.handle('analytics:memberRetention', (_, cohort) => Analytics.memberRetention(cohort));
ipcMain.handle('analytics:atRiskMembers', (_, days) => Analytics.atRiskMembers(days));
ipcMain.handle('analytics:visitFrequency', (_, days) => Analytics.visitFrequency(days));
ipcMain.handle('analytics:newVsReturning', (_, days) => Analytics.newVsReturning(days));
ipcMain.handle('analytics:activePassBreakdown', () => Analytics.activePassBreakdown());
ipcMain.handle('analytics:passChurnRate', (_, days) => Analytics.passChurnRate(days));
ipcMain.handle('analytics:staffSales', (_, days) => Analytics.staffSales(days));
ipcMain.handle('analytics:kpiSummary', () => Analytics.kpiSummary());

// -- Staff --
ipcMain.handle('staff:create', (_, data) => Staff.create(data));
ipcMain.handle('staff:getById', (_, id) => Staff.getById(id));
ipcMain.handle('staff:list', (_, activeOnly) => Staff.list(activeOnly));
ipcMain.handle('staff:update', (_, id, data) => Staff.update(id, data));
ipcMain.handle('staff:deactivate', (_, id) => Staff.deactivate(id));
ipcMain.handle('staff:activate', (_, id) => Staff.activate(id));
ipcMain.handle('staff:authByPin', (_, pin) => Staff.authenticateByPin(pin));
ipcMain.handle('staff:authByPassword', (_, email, pass) => Staff.authenticateByPassword(email, pass));
ipcMain.handle('staff:hasPermission', (_, staffId, perm) => Staff.hasPermission(staffId, perm));
ipcMain.handle('staff:createShift', (_, data) => Staff.createShift(data));
ipcMain.handle('staff:getShifts', (_, opts) => Staff.getShifts(opts));
ipcMain.handle('staff:deleteShift', (_, id) => Staff.deleteShift(id));
ipcMain.handle('staff:getWeekRota', (_, date) => Staff.getWeekRota(date));
ipcMain.handle('staff:getAuditTrail', (_, opts) => Staff.getAuditTrail(opts));

// -- Settings --
ipcMain.handle('settings:get', (_, key) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
});

ipcMain.handle('settings:set', (_, key, value) => {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
  return true;
});

ipcMain.handle('settings:getAll', () => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
});

// -- Stats (basic) --
ipcMain.handle('stats:dashboard', () => {
  const db = getDb();

  const totalMembers = db.prepare('SELECT count(*) as c FROM members').get().c;
  const activeMembers = db.prepare(`
    SELECT count(DISTINCT mp.member_id) as c FROM member_passes mp
    WHERE mp.status = 'active' AND (mp.expires_at IS NULL OR mp.expires_at > datetime('now'))
  `).get().c;

  const todayCheckIns = db.prepare(`
    SELECT count(*) as c FROM check_ins WHERE date(checked_in_at) = date('now')
  `).get().c;

  const todayRevenue = db.prepare(`
    SELECT COALESCE(sum(total_amount), 0) as total FROM transactions
    WHERE date(created_at) = date('now') AND payment_status = 'completed'
  `).get().total;

  const weekRevenue = db.prepare(`
    SELECT COALESCE(sum(total_amount), 0) as total FROM transactions
    WHERE created_at >= datetime('now', '-7 days') AND payment_status = 'completed'
  `).get().total;

  const monthRevenue = db.prepare(`
    SELECT COALESCE(sum(total_amount), 0) as total FROM transactions
    WHERE created_at >= datetime('now', '-30 days') AND payment_status = 'completed'
  `).get().total;

  return {
    totalMembers,
    activeMembers,
    todayCheckIns,
    todayRevenue,
    weekRevenue,
    monthRevenue,
  };
});

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(() => {
  // Ensure database is initialised
  getDb();

  // Seed defaults on first run
  Pass.seedDefaults();
  Waiver.seedDefaults();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDb();
});
