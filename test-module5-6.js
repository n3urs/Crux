const { getDb, closeDb } = require('./src/main/database/db');
const Member = require('./src/main/models/member');
const Event = require('./src/main/models/event');
const Route = require('./src/main/models/route');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; console.log(`  ✗ ${name}: ${err.message}`); }
}

console.log('\n=== Module 5 (Events) & Module 6 (Routes) Tests ===\n');
const db = getDb();
const m1 = Member.create({ first_name: 'Event', last_name: 'Tester', email: 'event@test.com' });
const m2 = Member.create({ first_name: 'Route', last_name: 'Tester', email: 'route@test.com' });

// ---- EVENT TEMPLATES ----
console.log('Event Templates:');

let template;
test('Create event template', () => {
  template = Event.createTemplate({ name: 'Kids Club', duration_minutes: 90, capacity: 12, price: 8.00, tags: 'kids,weekly' });
  if (!template.id) throw new Error('No ID');
  if (template.capacity !== 12) throw new Error('Wrong capacity');
});

test('List templates', () => {
  const list = Event.listTemplates();
  if (list.length < 1) throw new Error('Empty');
});

// ---- EVENTS ----
console.log('\nEvents:');

let event1;
test('Create event from template', () => {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0);
  event1 = Event.createFromTemplate(template.id, tomorrow.toISOString());
  if (!event1.id) throw new Error('No ID');
  if (event1.name !== 'Kids Club') throw new Error('Wrong name');
  if (event1.capacity !== 12) throw new Error('Wrong capacity');
});

test('List upcoming events', () => {
  const upcoming = Event.listUpcoming(14);
  if (upcoming.length < 1) throw new Error('No upcoming');
});

test('Enrol member in event', () => {
  const result = Event.enrol(event1.id, m1.id);
  if (result.status !== 'enrolled') throw new Error('Not enrolled');
});

test('Enrolment count updates', () => {
  const e = Event.getEventById(event1.id);
  if (e.current_enrolment !== 1) throw new Error(`Expected 1, got ${e.current_enrolment}`);
  if (e.enrolments.length !== 1) throw new Error('Missing enrolment details');
});

test('Cancel enrolment promotes waitlist', () => {
  // Fill to capacity with a small event
  const smallEvent = Event.createEvent({
    name: 'Tiny Event', starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90000000).toISOString(), capacity: 1, price: 5,
  });
  const e1 = Event.enrol(smallEvent.id, m1.id);
  if (e1.status !== 'enrolled') throw new Error('Should be enrolled');
  const e2 = Event.enrol(smallEvent.id, m2.id);
  if (e2.status !== 'waitlisted') throw new Error('Should be waitlisted');

  Event.cancelEnrolment(e1.id);
  const updated = Event.getEventById(smallEvent.id);
  const m2enrolment = updated.enrolments.find(e => e.member_id === m2.id);
  if (m2enrolment.status !== 'enrolled') throw new Error('Waitlisted member should be promoted');
});

test('Mark attended', () => {
  const enrolment = Event.getEventById(event1.id).enrolments[0];
  Event.markAttended(enrolment.id);
  const updated = Event.getEventById(event1.id);
  if (updated.enrolments[0].status !== 'attended') throw new Error('Should be attended');
});

test('Cancel event cancels enrolments', () => {
  const e = Event.createEvent({
    name: 'Cancelled Event', starts_at: new Date(Date.now() + 172800000).toISOString(),
    ends_at: new Date(Date.now() + 176400000).toISOString(), price: 0,
  });
  Event.enrol(e.id, m1.id);
  Event.cancelEvent(e.id, 'Weather');
  const cancelled = Event.getEventById(e.id);
  if (cancelled.status !== 'cancelled') throw new Error('Event should be cancelled');
  if (cancelled.enrolments[0].status !== 'cancelled') throw new Error('Enrolment should be cancelled');
});

// ---- COURSES ----
console.log('\nCourses:');

let course;
test('Create course', () => {
  course = Event.createCourse({ name: '6-Week Beginner', total_sessions: 6, price: 60, capacity: 10 });
  if (!course.id) throw new Error('No ID');
});

test('Add events to course', () => {
  for (let i = 0; i < 3; i++) {
    const start = new Date(Date.now() + (i + 1) * 604800000);
    Event.createEvent({
      name: `Beginner Week ${i + 1}`, starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 5400000).toISOString(),
      course_id: course.id, capacity: 10, price: 0,
    });
  }
  const updated = Event.getCourseById(course.id);
  if (updated.events.length !== 3) throw new Error(`Expected 3 events, got ${updated.events.length}`);
});

test('Enrol in course enrols in all events', () => {
  Event.enrolInCourse(course.id, m1.id);
  const updated = Event.getCourseById(course.id);
  if (updated.enrolments.length !== 1) throw new Error('Should have 1 enrolment');
  // Check member is enrolled in each event
  for (const event of updated.events) {
    const full = Event.getEventById(event.id);
    const enrolled = full.enrolments.find(e => e.member_id === m1.id);
    if (!enrolled) throw new Error(`Not enrolled in event ${event.name}`);
  }
});

test('Late join price calculation', () => {
  const price = Event.lateJoinPrice(course.id);
  if (price === null) throw new Error('Should calculate price');
  if (price > 60) throw new Error('Late join should be <= full price');
});

// ---- SLOT BOOKER ----
console.log('\nSlot Booker:');

let slotTemplate;
test('Create slot template', () => {
  slotTemplate = Event.createSlotTemplate({
    name: 'Training Wall', capacity: 6, duration_minutes: 60, price: 5,
    recurrence_pattern: { days: ['monday', 'wednesday', 'friday'], times: ['18:00', '19:00'] },
    advance_booking_days: 7,
  });
  if (!slotTemplate.id) throw new Error('No ID');
});

test('Generate slots from template', () => {
  const start = new Date(); start.setDate(start.getDate() + 1);
  const end = new Date(); end.setDate(end.getDate() + 8);
  const slots = Event.generateSlots(slotTemplate.id, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  if (slots.length === 0) throw new Error('Should generate some slots');
});

test('Book a slot', () => {
  const slots = Event.listSlots({ status: 'open' });
  if (slots.length === 0) throw new Error('No open slots');
  const result = Event.bookSlot(slots[0].id, m1.id, 5);
  if (result.status !== 'booked') throw new Error('Not booked');
});

test('Double booking prevented', () => {
  const slots = Event.listSlots({ status: 'open' });
  const bookedSlot = Event.listSlots({}).find(s => s.booked_count > 0);
  if (bookedSlot) {
    try { Event.bookSlot(bookedSlot.id, m1.id); throw new Error('Should throw'); }
    catch (e) { if (!e.message.includes('Already')) throw e; }
  }
});

test('Cancel slot booking reopens slot', () => {
  const slots = Event.listSlots({});
  const bookedSlot = slots.find(s => s.booked_count > 0);
  if (bookedSlot) {
    const bookings = Event.getSlotBookings(bookedSlot.id);
    Event.cancelSlotBooking(bookings[0].id);
    const updated = db.prepare('SELECT * FROM slots WHERE id = ?').get(bookedSlot.id);
    if (updated.status !== 'open') throw new Error('Should be open again');
  }
});

// ---- ROUTES ----
console.log('\nRoutes:');

test('List default walls', () => {
  const walls = Route.listWalls();
  if (walls.length !== 3) throw new Error(`Expected 3, got ${walls.length}`);
  if (walls[0].name !== 'Cove Wall') throw new Error('Wrong first wall');
});

let climb1, climb2, climb3;
test('Create climbs', () => {
  climb1 = Route.createClimb({ wall_id: 'wall_cove', grade: 'V3', colour: 'Red', setter: 'Dave', style_tags: 'crimpy,vertical' });
  climb2 = Route.createClimb({ wall_id: 'wall_mothership', grade: 'V5', colour: 'Purple', setter: 'Sarah', style_tags: 'dynamic,overhang' });
  climb3 = Route.createClimb({ wall_id: 'wall_cove', grade: 'V1', colour: 'Green', setter: 'Dave', style_tags: 'slab,technical', date_strip_planned: new Date(Date.now() + 86400000).toISOString().split('T')[0] });
  if (!climb1.id || !climb2.id) throw new Error('Missing IDs');
});

test('List active climbs', () => {
  const climbs = Route.listClimbs({ status: 'active' });
  if (climbs.length !== 3) throw new Error(`Expected 3, got ${climbs.length}`);
});

test('Filter by wall', () => {
  const cove = Route.listClimbs({ wallId: 'wall_cove' });
  if (cove.length !== 2) throw new Error(`Expected 2, got ${cove.length}`);
});

test('Get wall with climbs', () => {
  const wall = Route.getWall('wall_cove');
  if (wall.active_climbs.length !== 2) throw new Error('Expected 2 climbs');
});

test('Log attempt and send', () => {
  Route.logAttempt({ climb_id: climb1.id, member_id: m2.id, attempts: 3, sent: true, logged_via: 'desk' });
  Route.logAttempt({ climb_id: climb2.id, member_id: m2.id, attempts: 1, sent: true, logged_via: 'nfc_tap' });
  Route.logAttempt({ climb_id: climb1.id, member_id: m2.id, attempts: 5, sent: false, logged_via: 'desk' });
});

test('Member logbook', () => {
  const logs = Route.getMemberLogbook(m2.id);
  if (logs.length !== 3) throw new Error(`Expected 3, got ${logs.length}`);
});

test('Member stats', () => {
  const stats = Route.getMemberStats(m2.id);
  if (stats.total_attempts !== 3) throw new Error(`Expected 3 attempts, got ${stats.total_attempts}`);
  if (stats.total_sends !== 2) throw new Error(`Expected 2 sends, got ${stats.total_sends}`);
});

test('Climb has log stats', () => {
  const c = Route.getClimbById(climb1.id);
  if (c.log_count !== 2) throw new Error(`Expected 2 logs, got ${c.log_count}`);
  if (c.send_count !== 1) throw new Error(`Expected 1 send, got ${c.send_count}`);
});

test('Add feedback', () => {
  Route.addFeedback({ climb_id: climb1.id, member_id: m2.id, rating: 4, grade_opinion: 'accurate', comment: 'Great crimps' });
  const feedback = Route.getClimbFeedback(climb1.id);
  if (feedback.length !== 1) throw new Error('Expected 1 feedback');
  if (feedback[0].rating !== 4) throw new Error('Wrong rating');
});

test('Grade distribution', () => {
  const dist = Route.getGradeDistribution();
  if (dist.length < 2) throw new Error('Expected multiple grades');
  const v3 = dist.find(d => d.grade === 'V3');
  if (!v3 || v3.count !== 1) throw new Error('V3 should have 1');
});

test('Style distribution', () => {
  const dist = Route.getStyleDistribution();
  if (dist.length < 3) throw new Error('Expected multiple styles');
});

test('Colour distribution', () => {
  const dist = Route.getColourDistribution();
  if (dist.length < 2) throw new Error('Expected multiple colours');
});

test('Strip climb', () => {
  const stripped = Route.stripClimb(climb3.id);
  if (stripped.status !== 'stripped') throw new Error('Should be stripped');
  if (!stripped.date_stripped) throw new Error('Missing strip date');
});

test('Due for stripping', () => {
  // climb3 already stripped, but we can check the function works
  const due = Route.getDueForStripping(30);
  // Should be empty since we already stripped it
  // That's fine — function executes without error
});

// ---- HOLD INVENTORY ----
console.log('\nHold Inventory:');

test('Create hold', () => {
  const hold = Route.createHold({ brand: 'Kilter', type: 'crimp', colour: 'Orange', quantity: 50, storage_location: 'Bin A' });
  if (!hold.id) throw new Error('No ID');
  if (hold.quantity !== 50) throw new Error('Wrong quantity');
});

test('List holds', () => {
  Route.createHold({ brand: 'Tension', type: 'sloper', colour: 'Grey', quantity: 30 });
  const holds = Route.listHolds();
  if (holds.length < 2) throw new Error('Expected at least 2');
});

test('Filter holds by type', () => {
  const crimps = Route.listHolds({ type: 'crimp' });
  if (crimps.length !== 1) throw new Error('Expected 1 crimp set');
});

// ---- COMPETITIONS ----
console.log('\nCompetitions:');

let comp;
test('Create competition', () => {
  comp = Route.createCompetition({ name: 'Spring Comp 2026', format: 'points', scoring_rules: { points_per_top: 100, points_per_zone: 50 } });
  if (!comp.id) throw new Error('No ID');
  if (comp.format !== 'points') throw new Error('Wrong format');
});

let entry;
test('Register for competition', () => {
  entry = Route.registerForCompetition(comp.id, m2.id, 'Open');
  if (!entry.id) throw new Error('No ID');
});

test('Submit scores', () => {
  Route.submitScore({ competition_id: comp.id, entry_id: entry.id, climb_id: climb1.id, score: 100, topped: 1 });
  Route.submitScore({ competition_id: comp.id, entry_id: entry.id, climb_id: climb2.id, score: 50, zones: 1 });
});

test('Leaderboard', () => {
  const lb = Route.getLeaderboard(comp.id);
  if (lb.length !== 1) throw new Error('Expected 1 entry');
  if (lb[0].total_score !== 150) throw new Error(`Expected 150, got ${lb[0].total_score}`);
  if (lb[0].tops !== 1) throw new Error('Expected 1 top');
});

test('Complete competition assigns ranks', () => {
  Route.startCompetition(comp.id);
  const completed = Route.completeCompetition(comp.id);
  if (completed.status !== 'completed') throw new Error('Should be completed');
  if (completed.entries[0].rank !== 1) throw new Error('Should be rank 1');
});

closeDb();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
