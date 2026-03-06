/**
 * BoulderRyn — Frontend Application
 * Handles navigation, page rendering, and UI interactions
 */

// ============================================================
// Navigation
// ============================================================

const pages = ['dashboard', 'checkin', 'members', 'pos', 'events', 'routes', 'analytics', 'staff'];

function navigateTo(pageName) {
  // Hide all pages
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });

  // Deactivate all nav links
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  // Show target page
  const pageEl = document.getElementById(`page-${pageName}`);
  if (pageEl) pageEl.classList.add('active');

  // Activate nav link
  const navLink = document.querySelector(`[data-page="${pageName}"]`);
  if (navLink) navLink.classList.add('active');

  // Load page content
  loadPage(pageName);
}

// Nav click handlers
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

// ============================================================
// Page Loaders
// ============================================================

async function loadPage(pageName) {
  switch (pageName) {
    case 'dashboard': return loadDashboard();
    case 'checkin': return loadCheckIn();
    case 'members': return loadMembers();
    case 'pos': return loadPOS();
    case 'events': return loadEvents();
    case 'routes': return loadRoutes();
    case 'analytics': return loadAnalytics();
    case 'staff': return loadStaff();
  }
}

// ============================================================
// Dashboard
// ============================================================

async function loadDashboard() {
  const el = document.getElementById('page-dashboard');

  // Check if API is available (running in Electron)
  if (typeof window.api === 'undefined') {
    el.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p class="text-gray-500 mt-1">Welcome to BoulderRyn</p>
      </div>
      <div class="card">
        <p class="text-gray-500">Running outside Electron — database not available.</p>
        <p class="text-gray-400 text-sm mt-2">Start with: <code>npm start</code></p>
      </div>
    `;
    return;
  }

  try {
    const stats = await window.api.stats.dashboard();

    el.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p class="text-gray-500 mt-1">Welcome to BoulderRyn</p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="card">
          <div class="card-header">Today's Check-ins</div>
          <div class="card-value">${stats.todayCheckIns}</div>
        </div>
        <div class="card">
          <div class="card-header">Active Members</div>
          <div class="card-value">${stats.activeMembers}</div>
        </div>
        <div class="card">
          <div class="card-header">Today's Revenue</div>
          <div class="card-value">£${stats.todayRevenue.toFixed(2)}</div>
        </div>
        <div class="card">
          <div class="card-header">This Month</div>
          <div class="card-value">£${stats.monthRevenue.toFixed(2)}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card">
          <div class="card-header">Quick Actions</div>
          <div class="mt-3 space-y-2">
            <button onclick="navigateTo('checkin')" class="btn btn-primary btn-lg w-full">Check In Member</button>
            <button onclick="navigateTo('pos')" class="btn btn-secondary btn-lg w-full">Point of Sale</button>
            <button onclick="showNewMemberModal()" class="btn btn-secondary btn-lg w-full">Register New Member</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header">Overview</div>
          <div class="mt-3 space-y-3">
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
              <span class="text-gray-600">Total Members</span>
              <span class="font-semibold">${stats.totalMembers}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
              <span class="text-gray-600">Week Revenue</span>
              <span class="font-semibold">£${stats.weekRevenue.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center py-2">
              <span class="text-gray-600">Month Revenue</span>
              <span class="font-semibold">£${stats.monthRevenue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="card"><p class="text-red-500">Error loading dashboard: ${err.message}</p></div>`;
  }
}

// ============================================================
// Check-In
// ============================================================

async function loadCheckIn() {
  const el = document.getElementById('page-checkin');
  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Check In</h2>
      <p class="text-gray-500 mt-1">Scan QR code or search by name</p>
    </div>

    <div class="card mb-4">
      <div class="flex gap-4">
        <div class="flex-1">
          <input type="text" id="checkin-search" class="form-input text-lg" placeholder="Scan QR code or type name/email..." autofocus>
        </div>
        <button onclick="processCheckInSearch()" class="btn btn-primary btn-lg">Search</button>
      </div>
    </div>

    <div id="checkin-result"></div>
  `;

  const searchInput = document.getElementById('checkin-search');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') processCheckInSearch();
  });

  // Auto-focus for QR scanner input
  searchInput.focus();
}

async function processCheckInSearch() {
  if (typeof window.api === 'undefined') return;

  const query = document.getElementById('checkin-search').value.trim();
  if (!query) return;

  const resultEl = document.getElementById('checkin-result');

  // Try QR code first
  if (query.startsWith('BR-')) {
    const member = await window.api.member.getByQrCode(query);
    if (member) {
      await doCheckIn(member.id);
      document.getElementById('checkin-search').value = '';
      return;
    }
  }

  // Search by name/email
  const results = await window.api.member.search(query, 10);

  if (results.length === 0) {
    resultEl.innerHTML = `
      <div class="card checkin-result checkin-fail">
        <p class="text-xl font-bold">No member found</p>
        <p class="text-gray-500 mt-2">Try a different search or register a new member</p>
        <button onclick="showNewMemberModal()" class="btn btn-primary mt-4">Register New Member</button>
      </div>
    `;
    return;
  }

  if (results.length === 1) {
    await doCheckIn(results[0].id);
    document.getElementById('checkin-search').value = '';
    return;
  }

  // Multiple results — show list
  resultEl.innerHTML = `
    <div class="card">
      <p class="text-sm text-gray-500 mb-3">${results.length} members found — select one:</p>
      <div class="space-y-2">
        ${results.map(m => `
          <button onclick="doCheckIn('${m.id}')" class="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition">
            <span class="font-semibold">${m.first_name} ${m.last_name}</span>
            <span class="text-gray-500 text-sm ml-2">${m.email || ''}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

async function doCheckIn(memberId) {
  if (typeof window.api === 'undefined') return;

  const result = await window.api.checkin.process(memberId);
  const resultEl = document.getElementById('checkin-result');

  if (result.success) {
    const m = result.member;
    resultEl.innerHTML = `
      <div class="card checkin-result checkin-success">
        <svg class="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        <p class="checkin-name">${m.first_name} ${m.last_name}</p>
        <p class="text-gray-500">${result.alreadyCheckedIn ? 'Already checked in today' : result.message}</p>
        ${m.active_pass ? `<span class="badge badge-success mt-2">${m.active_pass.pass_name}</span>` : ''}
      </div>
    `;

    // Auto-clear after 3 seconds
    setTimeout(() => {
      resultEl.innerHTML = '';
      document.getElementById('checkin-search').value = '';
      document.getElementById('checkin-search').focus();
    }, 3000);
  } else {
    resultEl.innerHTML = `
      <div class="card checkin-result checkin-fail">
        <svg class="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <p class="checkin-name">${result.member ? result.member.first_name + ' ' + result.member.last_name : 'Unknown'}</p>
        <p class="text-red-500 font-semibold">${result.error}</p>
        ${result.needsWaiver ? '<button onclick="navigateTo(\'members\')" class="btn btn-primary mt-4">Complete Waiver</button>' : ''}
        ${result.needsPass ? '<button onclick="navigateTo(\'pos\')" class="btn btn-primary mt-4">Purchase Pass</button>' : ''}
      </div>
    `;
  }
}

// ============================================================
// Members
// ============================================================

async function loadMembers() {
  const el = document.getElementById('page-members');

  if (typeof window.api === 'undefined') {
    el.innerHTML = '<div class="card"><p class="text-gray-500">Database not available outside Electron.</p></div>';
    return;
  }

  el.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Members</h2>
        <p class="text-gray-500 mt-1" id="member-count-text">Loading...</p>
      </div>
      <button onclick="showNewMemberModal()" class="btn btn-primary">+ New Member</button>
    </div>

    <div class="card mb-4">
      <input type="text" id="member-search" class="form-input" placeholder="Search members by name, email, or phone..." oninput="searchMembers(this.value)">
    </div>

    <div class="card p-0 overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Pass Status</th>
            <th>Waiver</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody id="members-table-body">
        </tbody>
      </table>
    </div>

    <div id="members-pagination" class="mt-4 flex justify-center gap-2"></div>
  `;

  await refreshMembersList();
}

let memberSearchTimeout = null;
function searchMembers(query) {
  clearTimeout(memberSearchTimeout);
  memberSearchTimeout = setTimeout(() => refreshMembersList(query), 200);
}

async function refreshMembersList(query = '', page = 1) {
  if (typeof window.api === 'undefined') return;

  const tbody = document.getElementById('members-table-body');
  const countText = document.getElementById('member-count-text');

  let members, total;

  if (query) {
    members = await window.api.member.search(query, 50);
    total = members.length;
  } else {
    const result = await window.api.member.list({ page, perPage: 50 });
    members = result.members;
    total = result.total;
  }

  countText.textContent = `${total} member${total !== 1 ? 's' : ''}`;

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">No members found</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => `
    <tr onclick="showMemberDetail('${m.id}')">
      <td class="font-medium">${m.first_name} ${m.last_name}</td>
      <td class="text-gray-500">${m.email || '—'}</td>
      <td class="text-gray-500">${m.phone || '—'}</td>
      <td><span class="badge badge-neutral">—</span></td>
      <td><span class="badge badge-neutral">—</span></td>
      <td class="text-gray-400 text-sm">${m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '—'}</td>
    </tr>
  `).join('');
}

async function showMemberDetail(id) {
  if (typeof window.api === 'undefined') return;

  const member = await window.api.member.getWithPassStatus(id);
  if (!member) return;

  showModal(`
    <div class="p-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-xl font-bold">${member.first_name} ${member.last_name}</h3>
          <p class="text-gray-500">${member.email || 'No email'}</p>
          <p class="text-gray-400 text-sm">QR: ${member.qr_code}</p>
        </div>
        <div class="flex gap-2">
          ${!member.waiver_valid ? `<button onclick="openWaiverFlow('${member.id}')" class="btn btn-sm btn-danger">Sign Waiver</button>` : ''}
          <button onclick="resendQr('${member.id}')" class="btn btn-sm btn-secondary">Re-send QR</button>
          <button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span class="text-sm text-gray-500">Pass Status</span>
          <p class="font-semibold">${member.has_valid_pass
            ? `<span class="badge badge-success">${member.active_pass.pass_name}</span>`
            : '<span class="badge badge-danger">No active pass</span>'}</p>
        </div>
        <div>
          <span class="text-sm text-gray-500">Waiver</span>
          <p class="font-semibold">${member.waiver_valid
            ? '<span class="badge badge-success">Valid</span>'
            : '<span class="badge badge-danger">Missing/Expired</span>'}</p>
        </div>
        <div>
          <span class="text-sm text-gray-500">Phone</span>
          <p>${member.phone || '—'}</p>
        </div>
        <div>
          <span class="text-sm text-gray-500">DOB</span>
          <p>${member.date_of_birth || '—'}</p>
        </div>
        <div>
          <span class="text-sm text-gray-500">Emergency Contact</span>
          <p>${member.emergency_contact_name || '—'} ${member.emergency_contact_phone ? '(' + member.emergency_contact_phone + ')' : ''}</p>
        </div>
        <div>
          <span class="text-sm text-gray-500">Experience</span>
          <p>${member.climbing_experience || '—'}</p>
        </div>
      </div>

      ${member.medical_conditions ? `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <span class="text-sm font-semibold text-yellow-800">Medical:</span>
          <span class="text-sm text-yellow-700 ml-1">${member.medical_conditions}</span>
        </div>
      ` : ''}

      ${member.notes ? `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <span class="text-sm font-semibold text-blue-800">Notes:</span>
          <span class="text-sm text-blue-700 ml-1">${member.notes}</span>
        </div>
      ` : ''}

      ${member.certifications.length > 0 ? `
        <div class="mb-4">
          <span class="text-sm text-gray-500">Certifications</span>
          <div class="flex gap-1 mt-1">${member.certifications.map(c => `<span class="badge badge-info">${c.cert_name}</span>`).join('')}</div>
        </div>
      ` : ''}

      ${member.tags.length > 0 ? `
        <div class="mb-4">
          <span class="text-sm text-gray-500">Tags</span>
          <div class="flex gap-1 mt-1">${member.tags.map(t => `<span class="badge badge-neutral">${t.name}</span>`).join('')}</div>
        </div>
      ` : ''}
    </div>
  `);
}

async function resendQr(memberId) {
  if (typeof window.api === 'undefined') return;
  const result = await window.api.member.sendQrEmail(memberId);
  if (result.success) {
    showToast('QR code sent', 'success');
  } else {
    showToast('Failed: ' + result.error, 'error');
  }
}

// ============================================================
// New Member Modal
// ============================================================

function showNewMemberModal() {
  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-4">Register New Member</h3>
      <form id="new-member-form" onsubmit="createMember(event)">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">First Name *</label>
            <input type="text" name="first_name" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Last Name *</label>
            <input type="text" name="last_name" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" name="phone" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Date of Birth</label>
            <input type="date" name="date_of_birth" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select name="gender" class="form-select">
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Address</label>
          <input type="text" name="address_line1" class="form-input mb-2" placeholder="Address Line 1">
          <input type="text" name="address_line2" class="form-input mb-2" placeholder="Address Line 2">
          <div class="grid grid-cols-3 gap-2">
            <input type="text" name="city" class="form-input" placeholder="City">
            <input type="text" name="region" class="form-input" placeholder="County">
            <input type="text" name="postal_code" class="form-input" placeholder="Postcode">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Emergency Contact Name</label>
            <input type="text" name="emergency_contact_name" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Contact Phone</label>
            <input type="tel" name="emergency_contact_phone" class="form-input">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Medical Conditions</label>
          <input type="text" name="medical_conditions" class="form-input" placeholder="None, or describe...">
        </div>

        <div class="form-group">
          <label class="form-label">Climbing Experience</label>
          <select name="climbing_experience" class="form-select">
            <option value="">—</option>
            <option value="new">New Climber</option>
            <option value="few_times">Climbed a few times</option>
            <option value="regular">Regular Climber</option>
          </select>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Register Member</button>
        </div>
      </form>
    </div>
  `);
}

async function createMember(e) {
  e.preventDefault();
  if (typeof window.api === 'undefined') return;

  const form = document.getElementById('new-member-form');
  const data = Object.fromEntries(new FormData(form));

  try {
    const member = await window.api.member.create(data);
    closeModal();
    showToast(`${member.first_name} ${member.last_name} registered`, 'success');

    // Send QR if email provided
    if (member.email) {
      await window.api.member.sendQrEmail(member.id);
      showToast('QR code sent to ' + member.email, 'info');
    }

    // Refresh members list if on that page
    if (document.getElementById('page-members').classList.contains('active')) {
      await refreshMembersList();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================================
// Placeholder pages
// ============================================================

// loadPOS is defined in pages/pos.js

function loadEvents() {
  document.getElementById('page-events').innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold">Events & Scheduling</h2><p class="text-gray-500 mt-1">Coming in Module 5</p></div>
    <div class="card"><p class="text-gray-400">Events, courses, slot booker, and staff rota — under development.</p></div>
  `;
}

function loadRoutes() {
  document.getElementById('page-routes').innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold">Routes</h2><p class="text-gray-500 mt-1">Coming in Module 6</p></div>
    <div class="card"><p class="text-gray-400">Route management, gym map, logbooks, competitions — under development.</p></div>
  `;
}

function loadAnalytics() {
  document.getElementById('page-analytics').innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold">Analytics</h2><p class="text-gray-500 mt-1">Coming in Module 7</p></div>
    <div class="card"><p class="text-gray-400">Dashboards, reports, retention analytics — under development.</p></div>
  `;
}

function loadStaff() {
  document.getElementById('page-staff').innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold">Settings & Staff</h2><p class="text-gray-500 mt-1">Coming in Module 8</p></div>
    <div class="card"><p class="text-gray-400">Staff management, permissions, system settings — under development.</p></div>
  `;
}

// ============================================================
// Modal
// ============================================================

function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ============================================================
// Toast notifications
// ============================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// Init
// ============================================================

// Load dashboard on start
navigateTo('dashboard');
