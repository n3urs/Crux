/**
 * Event, Course, and Slot Booker model
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const Event = {
  // ---- Templates ----

  createTemplate(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO event_templates (id, name, description, duration_minutes, capacity, price, tags, requires_certification_id, is_active)
      VALUES (@id, @name, @description, @duration_minutes, @capacity, @price, @tags, @requires_certification_id, @is_active)
    `).run({
      id, name: data.name, description: data.description || null,
      duration_minutes: data.duration_minutes || 60, capacity: data.capacity || null,
      price: data.price || 0, tags: data.tags || null,
      requires_certification_id: data.requires_certification_id || null,
      is_active: data.is_active ?? 1,
    });
    return this.getTemplateById(id);
  },

  getTemplateById(id) {
    return getDb().prepare('SELECT * FROM event_templates WHERE id = ?').get(id);
  },

  listTemplates(activeOnly = true) {
    const sql = activeOnly
      ? 'SELECT * FROM event_templates WHERE is_active = 1 ORDER BY name'
      : 'SELECT * FROM event_templates ORDER BY name';
    return getDb().prepare(sql).all();
  },

  updateTemplate(id, data) {
    const db = getDb();
    const fields = ['name', 'description', 'duration_minutes', 'capacity', 'price', 'tags', 'requires_certification_id', 'is_active'];
    const updates = []; const params = { id };
    for (const f of fields) { if (data[f] !== undefined) { updates.push(`${f} = @${f}`); params[f] = data[f]; } }
    if (updates.length) db.prepare(`UPDATE event_templates SET ${updates.join(', ')} WHERE id = @id`).run(params);
    return this.getTemplateById(id);
  },

  // ---- Events ----

  createEvent(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO events (id, template_id, name, description, starts_at, ends_at, capacity, price,
        min_participants, auto_cancel_deadline, course_id, external_organiser, confirmation_email_template, tags)
      VALUES (@id, @template_id, @name, @description, @starts_at, @ends_at, @capacity, @price,
        @min_participants, @auto_cancel_deadline, @course_id, @external_organiser, @confirmation_email_template, @tags)
    `).run({
      id, template_id: data.template_id || null, name: data.name,
      description: data.description || null, starts_at: data.starts_at, ends_at: data.ends_at,
      capacity: data.capacity || null, price: data.price || 0,
      min_participants: data.min_participants || null, auto_cancel_deadline: data.auto_cancel_deadline || null,
      course_id: data.course_id || null, external_organiser: data.external_organiser || null,
      confirmation_email_template: data.confirmation_email_template || null, tags: data.tags || null,
    });
    return this.getEventById(id);
  },

  /**
   * Create event from template
   */
  createFromTemplate(templateId, startsAt) {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('Template not found');

    const start = new Date(startsAt);
    const end = new Date(start.getTime() + template.duration_minutes * 60000);

    return this.createEvent({
      template_id: templateId,
      name: template.name,
      description: template.description,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      capacity: template.capacity,
      price: template.price,
      tags: template.tags,
    });
  },

  getEventById(id) {
    const db = getDb();
    const event = db.prepare(`
      SELECT e.*, et.name as template_name
      FROM events e
      LEFT JOIN event_templates et ON e.template_id = et.id
      WHERE e.id = ?
    `).get(id);

    if (event) {
      event.enrolments = db.prepare(`
        SELECT ee.*, m.first_name, m.last_name, m.email
        FROM event_enrolments ee
        JOIN members m ON ee.member_id = m.id
        WHERE ee.event_id = ?
        ORDER BY ee.enrolled_at
      `).all(id);
      event.current_enrolment = event.enrolments.filter(e => e.status === 'enrolled' || e.status === 'attended').length;
    }
    return event;
  },

  listEvents({ status, dateFrom, dateTo, tag, courseId, page = 1, perPage = 50 } = {}) {
    const db = getDb();
    let sql = 'SELECT e.* FROM events e WHERE 1=1';
    const params = {};

    if (status) { sql += ' AND e.status = @status'; params.status = status; }
    if (dateFrom) { sql += ' AND e.starts_at >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { sql += ' AND e.starts_at <= @dateTo'; params.dateTo = dateTo; }
    if (tag) { sql += ' AND e.tags LIKE @tag'; params.tag = `%${tag}%`; }
    if (courseId) { sql += ' AND e.course_id = @courseId'; params.courseId = courseId; }

    sql += ' ORDER BY e.starts_at ASC LIMIT @limit OFFSET @offset';
    params.limit = perPage; params.offset = (page - 1) * perPage;

    return db.prepare(sql).all(params);
  },

  listUpcoming(days = 7) {
    return getDb().prepare(`
      SELECT e.* FROM events e
      WHERE e.status = 'scheduled' AND e.starts_at >= datetime('now') AND e.starts_at <= datetime('now', '+' || ? || ' days')
      ORDER BY e.starts_at ASC
    `).all(days);
  },

  updateEvent(id, data) {
    const db = getDb();
    const fields = ['name', 'description', 'starts_at', 'ends_at', 'capacity', 'price',
      'min_participants', 'auto_cancel_deadline', 'status', 'cancel_reason',
      'external_organiser', 'confirmation_email_template', 'tags'];
    const updates = []; const params = { id };
    for (const f of fields) { if (data[f] !== undefined) { updates.push(`${f} = @${f}`); params[f] = data[f]; } }
    if (updates.length) db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = @id`).run(params);
    return this.getEventById(id);
  },

  cancelEvent(id, reason = '') {
    const db = getDb();
    db.prepare("UPDATE events SET status = 'cancelled', cancel_reason = ? WHERE id = ?").run(reason, id);
    // Cancel all enrolments
    db.prepare("UPDATE event_enrolments SET status = 'cancelled', cancelled_at = datetime('now') WHERE event_id = ? AND status = 'enrolled'").run(id);
    return this.getEventById(id);
  },

  completeEvent(id) {
    getDb().prepare("UPDATE events SET status = 'completed' WHERE id = ?").run(id);
    return this.getEventById(id);
  },

  // ---- Enrolments ----

  enrol(eventId, memberId, pricePaid = null, transactionId = null) {
    const db = getDb();
    const event = this.getEventById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.status !== 'scheduled') throw new Error('Event is not open for enrolment');

    if (event.capacity && event.current_enrolment >= event.capacity) {
      // Waitlist
      const id = uuidv4();
      db.prepare(`
        INSERT INTO event_enrolments (id, event_id, member_id, status, price_paid, transaction_id)
        VALUES (?, ?, ?, 'waitlisted', ?, ?)
      `).run(id, eventId, memberId, pricePaid ?? event.price, transactionId);
      return { id, status: 'waitlisted' };
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO event_enrolments (id, event_id, member_id, status, price_paid, transaction_id)
      VALUES (?, ?, ?, 'enrolled', ?, ?)
    `).run(id, eventId, memberId, pricePaid ?? event.price, transactionId);

    db.prepare('UPDATE events SET current_enrolment = current_enrolment + 1 WHERE id = ?').run(eventId);

    return { id, status: 'enrolled' };
  },

  cancelEnrolment(enrolmentId) {
    const db = getDb();
    const enrolment = db.prepare('SELECT * FROM event_enrolments WHERE id = ?').get(enrolmentId);
    if (!enrolment) throw new Error('Enrolment not found');

    db.prepare("UPDATE event_enrolments SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?").run(enrolmentId);

    if (enrolment.status === 'enrolled') {
      db.prepare('UPDATE events SET current_enrolment = max(0, current_enrolment - 1) WHERE id = ?').run(enrolment.event_id);

      // Promote first waitlisted
      const waitlisted = db.prepare("SELECT id FROM event_enrolments WHERE event_id = ? AND status = 'waitlisted' ORDER BY enrolled_at LIMIT 1").get(enrolment.event_id);
      if (waitlisted) {
        db.prepare("UPDATE event_enrolments SET status = 'enrolled' WHERE id = ?").run(waitlisted.id);
        db.prepare('UPDATE events SET current_enrolment = current_enrolment + 1 WHERE id = ?').run(enrolment.event_id);
      }
    }
  },

  markAttended(enrolmentId) {
    getDb().prepare("UPDATE event_enrolments SET status = 'attended', attended_at = datetime('now') WHERE id = ?").run(enrolmentId);
  },

  markNoShow(enrolmentId) {
    getDb().prepare("UPDATE event_enrolments SET status = 'no_show' WHERE id = ?").run(enrolmentId);
  },

  /**
   * Auto-cancel events below minimum participation
   */
  autoCancel() {
    const db = getDb();
    const toCancel = db.prepare(`
      SELECT id FROM events
      WHERE status = 'scheduled' AND min_participants IS NOT NULL
        AND auto_cancel_deadline IS NOT NULL AND auto_cancel_deadline <= datetime('now')
        AND current_enrolment < min_participants
    `).all();

    let count = 0;
    for (const e of toCancel) {
      this.cancelEvent(e.id, 'Auto-cancelled: below minimum participants');
      count++;
    }
    return count;
  },

  // ---- Courses ----

  createCourse(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, name, description, total_sessions, price, capacity, allows_late_join)
      VALUES (@id, @name, @description, @total_sessions, @price, @capacity, @allows_late_join)
    `).run({
      id, name: data.name, description: data.description || null,
      total_sessions: data.total_sessions, price: data.price,
      capacity: data.capacity || null, allows_late_join: data.allows_late_join ?? 1,
    });
    return this.getCourseById(id);
  },

  getCourseById(id) {
    const db = getDb();
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
    if (course) {
      course.events = db.prepare('SELECT * FROM events WHERE course_id = ? ORDER BY starts_at').all(id);
      course.enrolments = db.prepare(`
        SELECT ce.*, m.first_name, m.last_name
        FROM course_enrolments ce
        JOIN members m ON ce.member_id = m.id
        WHERE ce.course_id = ?
      `).all(id);
    }
    return course;
  },

  listCourses(activeOnly = true) {
    const sql = activeOnly
      ? "SELECT * FROM courses WHERE status = 'active' ORDER BY name"
      : 'SELECT * FROM courses ORDER BY name';
    return getDb().prepare(sql).all();
  },

  enrolInCourse(courseId, memberId, pricePaid = null, transactionId = null) {
    const db = getDb();
    const course = this.getCourseById(courseId);
    if (!course) throw new Error('Course not found');

    const id = uuidv4();
    db.prepare(`
      INSERT INTO course_enrolments (id, course_id, member_id, status, price_paid, transaction_id)
      VALUES (?, ?, ?, 'enrolled', ?, ?)
    `).run(id, courseId, memberId, pricePaid ?? course.price, transactionId);

    // Enrol in all scheduled events in the course
    for (const event of course.events) {
      if (event.status === 'scheduled') {
        try { this.enrol(event.id, memberId, 0); } catch (e) { /* already enrolled or full */ }
      }
    }

    return { id, status: 'enrolled' };
  },

  /**
   * Calculate late-join discount
   */
  lateJoinPrice(courseId) {
    const course = this.getCourseById(courseId);
    if (!course || !course.allows_late_join) return null;

    const futureEvents = course.events.filter(e => e.status === 'scheduled' && new Date(e.starts_at) > new Date());
    const totalSessions = course.total_sessions || course.events.length;
    if (totalSessions === 0) return course.price;

    const pricePerSession = course.price / totalSessions;
    return Math.round(pricePerSession * futureEvents.length * 100) / 100;
  },

  // ---- Slot Booker ----

  createSlotTemplate(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO slot_templates (id, name, description, capacity, duration_minutes, price, recurrence_pattern, advance_booking_days, is_active)
      VALUES (@id, @name, @description, @capacity, @duration_minutes, @price, @recurrence_pattern, @advance_booking_days, @is_active)
    `).run({
      id, name: data.name, description: data.description || null,
      capacity: data.capacity, duration_minutes: data.duration_minutes,
      price: data.price || 0, recurrence_pattern: data.recurrence_pattern ? JSON.stringify(data.recurrence_pattern) : null,
      advance_booking_days: data.advance_booking_days || 7, is_active: data.is_active ?? 1,
    });
    return db.prepare('SELECT * FROM slot_templates WHERE id = ?').get(id);
  },

  listSlotTemplates(activeOnly = true) {
    const sql = activeOnly
      ? 'SELECT * FROM slot_templates WHERE is_active = 1 ORDER BY name'
      : 'SELECT * FROM slot_templates ORDER BY name';
    return getDb().prepare(sql).all();
  },

  createSlot(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO slots (id, template_id, starts_at, ends_at, capacity, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `).run(id, data.template_id || null, data.starts_at, data.ends_at, data.capacity);
    return db.prepare('SELECT * FROM slots WHERE id = ?').get(id);
  },

  /**
   * Generate slots from template for a date range
   */
  generateSlots(templateId, startDate, endDate) {
    const template = getDb().prepare('SELECT * FROM slot_templates WHERE id = ?').get(templateId);
    if (!template) throw new Error('Slot template not found');

    const pattern = template.recurrence_pattern ? JSON.parse(template.recurrence_pattern) : null;
    if (!pattern || !pattern.days || !pattern.times) return [];

    const slots = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      if (pattern.days.includes(dayNames[dayOfWeek])) {
        for (const time of pattern.times) {
          const [hours, minutes] = time.split(':').map(Number);
          const startTime = new Date(current);
          startTime.setHours(hours, minutes, 0, 0);
          const endTime = new Date(startTime.getTime() + template.duration_minutes * 60000);

          const slot = this.createSlot({
            template_id: templateId,
            starts_at: startTime.toISOString(),
            ends_at: endTime.toISOString(),
            capacity: template.capacity,
          });
          slots.push(slot);
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return slots;
  },

  bookSlot(slotId, memberId, pricePaid = 0, transactionId = null) {
    const db = getDb();
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
    if (!slot) throw new Error('Slot not found');
    if (slot.status !== 'open') throw new Error('Slot is not available');
    if (slot.booked_count >= slot.capacity) throw new Error('Slot is full');

    // Check double booking
    const existing = db.prepare("SELECT id FROM slot_bookings WHERE slot_id = ? AND member_id = ? AND status = 'booked'").get(slotId, memberId);
    if (existing) throw new Error('Already booked');

    const id = uuidv4();
    db.prepare(`
      INSERT INTO slot_bookings (id, slot_id, member_id, status, price_paid, transaction_id)
      VALUES (?, ?, ?, 'booked', ?, ?)
    `).run(id, slotId, memberId, pricePaid, transactionId);

    const newCount = slot.booked_count + 1;
    const newStatus = newCount >= slot.capacity ? 'full' : 'open';
    db.prepare('UPDATE slots SET booked_count = ?, status = ? WHERE id = ?').run(newCount, newStatus, slotId);

    return { id, status: 'booked' };
  },

  cancelSlotBooking(bookingId) {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM slot_bookings WHERE id = ?').get(bookingId);
    if (!booking) throw new Error('Booking not found');

    db.prepare("UPDATE slot_bookings SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?").run(bookingId);

    if (booking.status === 'booked') {
      db.prepare("UPDATE slots SET booked_count = max(0, booked_count - 1), status = 'open' WHERE id = ?").run(booking.slot_id);
    }
  },

  getSlotBookings(slotId) {
    return getDb().prepare(`
      SELECT sb.*, m.first_name, m.last_name
      FROM slot_bookings sb
      JOIN members m ON sb.member_id = m.id
      WHERE sb.slot_id = ? AND sb.status = 'booked'
      ORDER BY sb.booked_at
    `).all(slotId);
  },

  listSlots({ dateFrom, dateTo, templateId, status } = {}) {
    const db = getDb();
    let sql = 'SELECT s.*, st.name as template_name FROM slots s LEFT JOIN slot_templates st ON s.template_id = st.id WHERE 1=1';
    const params = {};
    if (dateFrom) { sql += ' AND s.starts_at >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { sql += ' AND s.starts_at <= @dateTo'; params.dateTo = dateTo; }
    if (templateId) { sql += ' AND s.template_id = @templateId'; params.templateId = templateId; }
    if (status) { sql += ' AND s.status = @status'; params.status = status; }
    sql += ' ORDER BY s.starts_at ASC';
    return db.prepare(sql).all(params);
  },
};

module.exports = Event;
