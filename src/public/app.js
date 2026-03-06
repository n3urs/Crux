/**
 * BoulderRyn — Frontend Application (Web Version)
 * Complete overhaul matching BETA gym software
 */

// ============================================================
// API Helper
// ============================================================

async function api(method, url, body = null) {
  const opts = { method, headers: {} };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ============================================================
// Utility
// ============================================================

function nameToColour(name) {
  const colours = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
    '#E11D48', '#0EA5E9', '#84CC16', '#A855F7', '#D946EF'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colours[Math.abs(hash) % colours.length];
}

function getInitials(firstName, lastName) {
  return ((firstName || '')[0] || '') + ((lastName || '')[0] || '');
}

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// Role Helpers
// ============================================================

const ROLE_DISPLAY_NAMES = {
  centre_assistant: 'Centre Assistant',
  duty_manager: 'Duty Manager',
  setter: 'Route Setter',
  tech_lead: 'Tech Lead',
  owner: 'Owner',
};

const ROLE_BADGE_CLASSES = {
  owner: 'bg-purple-100 text-purple-800',
  tech_lead: 'bg-blue-100 text-blue-800',
  duty_manager: 'bg-green-100 text-green-800',
  centre_assistant: 'bg-slate-100 text-slate-700',
  setter: 'bg-orange-100 text-orange-800',
};

const ROLE_SIDEBAR_COLOURS = {
  owner: 'bg-purple-600',
  tech_lead: 'bg-blue-600',
  duty_manager: 'bg-green-600',
  centre_assistant: 'bg-slate-500',
  setter: 'bg-orange-500',
};

function getRoleDisplayName(role) {
  return ROLE_DISPLAY_NAMES[role] || role;
}

function getRoleBadgeHTML(role, size = 'sm') {
  const cls = ROLE_BADGE_CLASSES[role] || 'bg-gray-100 text-gray-700';
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return `<span class="${cls} ${padding} rounded-full font-medium">${getRoleDisplayName(role)}</span>`;
}

// ============================================================
// Auth / Login System
// ============================================================

window.currentStaff = null;

async function initAuth() {
  // Check localStorage for existing session
  const saved = localStorage.getItem('boulderryn_staff');
  if (saved) {
    try {
      const staff = JSON.parse(saved);
      // Verify staff still exists and is active
      const verified = await api('GET', `/api/staff/${staff.id}`);
      if (verified && verified.is_active) {
        window.currentStaff = verified;
        onLoginSuccess();
        return;
      }
    } catch (e) {
      localStorage.removeItem('boulderryn_staff');
    }
  }

  // Check if any staff exist
  try {
    const { count } = await api('GET', '/api/staff/count');
    if (count === 0) {
      showFirstRunSetup();
    } else {
      showPinLogin();
    }
  } catch (e) {
    showPinLogin();
  }
}

function showFirstRunSetup() {
  const container = document.getElementById('login-container');
  container.innerHTML = `
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">BoulderRyn</h1>
      <p class="text-slate-400 mt-2">First Time Setup</p>
    </div>
    <div class="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <h2 class="text-lg font-semibold text-white mb-1">Create First Staff Account</h2>
      <p class="text-slate-400 text-sm mb-6">This will be the owner account with full access.</p>
      <form id="first-run-form" onsubmit="handleFirstRunSetup(event)">
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">First Name</label>
            <input type="text" name="first_name" value="Oscar" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Last Name</label>
            <input type="text" name="last_name" value="Sullivan" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
          </div>
        </div>
        <div class="mb-3">
          <label class="block text-xs text-slate-400 mb-1">Email</label>
          <input type="email" name="email" value="oscar@sullivanltd.co.uk" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
        </div>
        <div class="mb-3">
          <label class="block text-xs text-slate-400 mb-1">4-Digit PIN</label>
          <input type="text" name="pin" maxlength="4" pattern="[0-9]{4}" value="1234" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center text-xl tracking-[0.5em] font-mono">
        </div>
        <div class="mb-4">
          <label class="block text-xs text-slate-400 mb-1">Password (optional)</label>
          <input type="password" name="password" class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
        </div>
        <div id="first-run-error" class="text-red-400 text-sm mb-3 hidden"></div>
        <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">Create Owner Account</button>
      </form>
      <div class="mt-4 text-center">
        <button onclick="handleSeedOwner()" class="text-slate-400 hover:text-white text-sm transition underline">Use default (Oscar Sullivan, PIN: 1234)</button>
      </div>
    </div>
  `;
}

async function handleFirstRunSetup(e) {
  e.preventDefault();
  const form = document.getElementById('first-run-form');
  const data = Object.fromEntries(new FormData(form));
  data.role = 'owner';
  const errEl = document.getElementById('first-run-error');

  try {
    const staff = await api('POST', '/api/staff', data);
    if (staff.error) throw new Error(staff.error);
    window.currentStaff = staff;
    localStorage.setItem('boulderryn_staff', JSON.stringify(staff));
    onLoginSuccess();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleSeedOwner() {
  try {
    const result = await api('POST', '/api/staff/seed-owner');
    if (result.created) {
      // Auto-login with PIN 1234
      const staff = await api('POST', '/api/staff/auth/pin', { pin: '1234' });
      if (staff && !staff.error) {
        window.currentStaff = staff;
        localStorage.setItem('boulderryn_staff', JSON.stringify(staff));
        onLoginSuccess();
      }
    } else {
      showPinLogin();
    }
  } catch (err) {
    const errEl = document.getElementById('first-run-error');
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
}

let pinValue = '';

function showPinLogin() {
  pinValue = '';
  const container = document.getElementById('login-container');
  container.innerHTML = `
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">BoulderRyn</h1>
      <p class="text-slate-400 mt-2">Enter your PIN to continue</p>
    </div>
    <div class="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <!-- PIN Dots -->
      <div class="flex justify-center gap-4 mb-8" id="pin-dots">
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
      </div>
      <div id="pin-error" class="text-red-400 text-sm text-center mb-4 h-5"></div>
      <!-- Number Pad -->
      <div class="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
        ${[1,2,3,4,5,6,7,8,9].map(n => `
          <button onclick="pinPress('${n}')" class="h-16 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-semibold transition-all duration-100 select-none">${n}</button>
        `).join('')}
        <button onclick="pinClear()" class="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600 text-slate-300 text-sm font-medium transition select-none">Clear</button>
        <button onclick="pinPress('0')" class="h-16 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-semibold transition-all duration-100 select-none">0</button>
        <button onclick="pinBackspace()" class="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600 text-slate-300 transition select-none flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414A2 2 0 0110.828 5H21a1 1 0 011 1v12a1 1 0 01-1 1H10.828a2 2 0 01-1.414-.586L3 12z"/></svg>
        </button>
      </div>
      <div class="mt-6 text-center">
        <button onclick="showEmailLogin()" class="text-slate-400 hover:text-white text-sm transition">Login with email instead</button>
      </div>
    </div>
  `;
  document.getElementById('login-overlay').classList.remove('hidden');
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pin-dots div');
  dots.forEach((dot, i) => {
    if (i < pinValue.length) {
      dot.className = 'w-5 h-5 rounded-full bg-blue-500 border-2 border-blue-500 transition-all duration-150 scale-110';
    } else {
      dot.className = 'w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150';
    }
  });
}

function pinPress(digit) {
  if (pinValue.length >= 4) return;
  pinValue += digit;
  updatePinDots();
  document.getElementById('pin-error').textContent = '';

  if (pinValue.length === 4) {
    attemptPinLogin(pinValue);
  }
}

function pinClear() {
  pinValue = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

function pinBackspace() {
  pinValue = pinValue.slice(0, -1);
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

async function attemptPinLogin(pin) {
  try {
    const result = await api('POST', '/api/staff/auth/pin', { pin });
    if (result.error) {
      document.getElementById('pin-error').textContent = 'Invalid PIN';
      pinValue = '';
      updatePinDots();
      // Shake animation
      const dots = document.getElementById('pin-dots');
      dots.classList.add('animate-shake');
      setTimeout(() => dots.classList.remove('animate-shake'), 500);
      return;
    }
    window.currentStaff = result;
    localStorage.setItem('boulderryn_staff', JSON.stringify(result));
    onLoginSuccess();
  } catch (err) {
    document.getElementById('pin-error').textContent = 'Login failed';
    pinValue = '';
    updatePinDots();
  }
}

function showEmailLogin() {
  const container = document.getElementById('login-container');
  container.innerHTML = `
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">BoulderRyn</h1>
      <p class="text-slate-400 mt-2">Login with email</p>
    </div>
    <div class="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <form id="email-login-form" onsubmit="handleEmailLogin(event)">
        <div class="mb-4">
          <label class="block text-xs text-slate-400 mb-1">Email</label>
          <input type="email" name="email" required autofocus class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="you@example.com">
        </div>
        <div class="mb-4">
          <label class="block text-xs text-slate-400 mb-1">Password</label>
          <input type="password" name="password" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
        </div>
        <div id="email-login-error" class="text-red-400 text-sm mb-3 hidden"></div>
        <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">Login</button>
      </form>
      <div class="mt-4 text-center">
        <button onclick="showPinLogin()" class="text-slate-400 hover:text-white text-sm transition">Back to PIN login</button>
      </div>
    </div>
  `;
}

async function handleEmailLogin(e) {
  e.preventDefault();
  const form = document.getElementById('email-login-form');
  const data = Object.fromEntries(new FormData(form));
  const errEl = document.getElementById('email-login-error');

  try {
    const result = await api('POST', '/api/staff/auth/password', data);
    if (result.error) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    window.currentStaff = result;
    localStorage.setItem('boulderryn_staff', JSON.stringify(result));
    onLoginSuccess();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function onLoginSuccess() {
  const overlay = document.getElementById('login-overlay');
  overlay.classList.add('hidden');
  updateStaffBadge();
  enforcePermissions();
  navigateTo('dashboard');
}

function lockScreen() {
  window.currentStaff = null;
  localStorage.removeItem('boulderryn_staff');
  document.getElementById('staff-badge-container').classList.add('hidden');
  showPinLogin();
}

function updateStaffBadge() {
  const staff = window.currentStaff;
  if (!staff) return;

  const container = document.getElementById('staff-badge-container');
  const initialsEl = document.getElementById('staff-badge-initials');
  const nameEl = document.getElementById('staff-badge-name');
  const roleEl = document.getElementById('staff-badge-role');

  const initials = getInitials(staff.first_name, staff.last_name).toUpperCase();
  initialsEl.textContent = initials;
  initialsEl.className = `w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${ROLE_SIDEBAR_COLOURS[staff.role] || 'bg-slate-500'}`;
  nameEl.textContent = `${staff.first_name} ${staff.last_name}`;

  const badgeCls = ROLE_BADGE_CLASSES[staff.role] || 'bg-gray-100 text-gray-700';
  roleEl.className = `text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeCls}`;
  roleEl.textContent = getRoleDisplayName(staff.role);

  container.classList.remove('hidden');
}

// ============================================================
// Permission Enforcement
// ============================================================

function staffHasPermission(perm) {
  if (!window.currentStaff) return false;
  const role = window.currentStaff.role;
  if (role === 'owner' || role === 'tech_lead') return true;
  const perms = window.currentStaff.permissions || {};
  return !!perms[perm];
}

function enforcePermissions() {
  const navLinks = document.querySelectorAll('#nav-links .nav-link');
  navLinks.forEach(link => {
    const perm = link.dataset.perm;
    if (!perm) return;
    const li = link.closest('li');
    if (staffHasPermission(perm)) {
      li.classList.remove('hidden');
      link.classList.remove('opacity-40', 'pointer-events-none');
    } else {
      li.classList.add('hidden');
    }
  });
}

// ============================================================
// Member Card Component
// ============================================================

function renderMemberCard(m, options = {}) {
  const { showCheckin = true, compact = false } = options;
  const initials = getInitials(m.first_name, m.last_name).toUpperCase();
  const colour = nameToColour(m.first_name + m.last_name);
  const age = calculateAge(m.date_of_birth);
  const isUnder18 = age !== null && age < 18;
  const regPaid = m.registration_fee_paid === 1;
  const name = `${m.first_name} ${m.last_name}`.toUpperCase();

  return `
    <div class="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition cursor-pointer flex items-start gap-3"
         onclick="openMemberProfile('${m.id}')">
      <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
           style="background:${colour}">
        ${initials}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-gray-900">${name}</span>
          ${!regPaid ? '<span class="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" title="Registration fee not paid">!</span>' : '<span class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></span>'}
        </div>
        <p class="text-xs text-gray-500 truncate">${m.email || 'No email'}</p>
        ${m.date_of_birth ? `
          <p class="text-xs mt-0.5">
            <span class="text-gray-400">${formatDate(m.date_of_birth)}</span>
            ${age !== null ? `<span class="${isUnder18 ? 'text-blue-600 font-bold' : 'text-gray-500'} ml-1">(${age})</span>` : ''}
          </p>
        ` : ''}
      </div>
      ${showCheckin ? `
        <button onclick="event.stopPropagation(); quickCheckIn('${m.id}')" 
                class="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition"
                title="Check in">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        </button>
      ` : ''}
    </div>
  `;
}

async function quickCheckIn(memberId) {
  try {
    const result = await api('POST', '/api/checkin/process', { memberId });
    if (result.success) {
      showToast(`${result.member.first_name} checked in`, 'success');
      if (result.registrationWarning) {
        showToast('REGISTRATION FEE NOT PAID — Add £3.00 to next transaction', 'error');
      }
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        loadActiveVisitors();
      }
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast('Check-in failed: ' + err.message, 'error');
  }
}

// ============================================================
// Navigation
// ============================================================

const pages = ['dashboard', 'checkin', 'members', 'pos', 'events', 'routes', 'analytics', 'staff'];

function navigateTo(pageName) {
  // Permission check
  const navLink = document.querySelector(`[data-page="${pageName}"]`);
  const perm = navLink ? navLink.dataset.perm : null;
  if (perm && !staffHasPermission(perm)) {
    showAccessDenied(pageName);
    return;
  }

  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });

  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const pageEl = document.getElementById(`page-${pageName}`);
  if (pageEl) pageEl.classList.add('active');

  if (navLink) navLink.classList.add('active');

  // Remove padding and hide sidebar for POS page
  const container = document.getElementById('page-container');
  const sidebar = document.getElementById('sidebar');
  if (pageName === 'pos') {
    container.classList.remove('p-6');
    container.classList.add('p-0');
    if (sidebar) sidebar.classList.add('hidden');
  } else {
    container.classList.remove('p-0');
    container.classList.add('p-6');
    if (sidebar) sidebar.classList.remove('hidden');
  }

  loadPage(pageName);
}

function showAccessDenied(pageName) {
  const pageEl = document.getElementById(`page-${pageName}`);
  if (pageEl) {
    pages.forEach(p => { const el = document.getElementById(`page-${p}`); if (el) el.classList.remove('active'); });
    pageEl.classList.add('active');
    pageEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24">
        <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900">Access Denied</h2>
        <p class="text-gray-500 mt-2">You don't have permission to access this page.</p>
        <button onclick="navigateTo('dashboard')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Back to Visitors</button>
      </div>
    `;
  }
}

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
// Dashboard (Visitors Page)
// ============================================================

let dashboardSearchTimer = null;

async function loadDashboard() {
  const el = document.getElementById('page-dashboard');

  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Visitors</h2>
      <p class="text-gray-500 mt-1">Search members, manage active visitors</p>
    </div>

    <div class="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      <div class="relative">
        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" id="dashboard-search" class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
               placeholder="Search members by name or email..."
               autocomplete="off">
      </div>
      <p id="dashboard-search-hint" class="text-xs text-gray-400 mt-2">Enter at least 3 characters to search</p>
      <div id="dashboard-search-results" class="mt-4 hidden">
        <div class="flex items-center justify-between mb-2">
          <span id="dashboard-search-count" class="text-sm text-gray-500"></span>
        </div>
        <div id="dashboard-search-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
      </div>
    </div>

    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-gray-900" id="active-visitors-header">Active Visitors (0)</h3>
        <button onclick="loadActiveVisitors()" class="btn btn-sm btn-secondary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refresh
        </button>
      </div>
      <div id="active-visitors-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
      <div id="active-visitors-pagination" class="mt-3 flex justify-center gap-2"></div>
    </div>

    <div class="mb-6">
      <h3 class="text-lg font-bold text-gray-900 mb-3">Recent Waiver Submissions</h3>
      <div id="recent-forms-list" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p class="text-gray-400 text-sm p-4 text-center">Loading...</p>
      </div>
    </div>

    <button onclick="showNewMemberModal()" 
            class="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition z-40">
      +
    </button>
  `;

  const searchInput = document.getElementById('dashboard-search');
  searchInput.addEventListener('input', () => {
    clearTimeout(dashboardSearchTimer);
    const q = searchInput.value.trim();
    if (q.length < 3) {
      document.getElementById('dashboard-search-results').classList.add('hidden');
      document.getElementById('dashboard-search-hint').textContent = 'Enter at least 3 characters to search';
      return;
    }
    dashboardSearchTimer = setTimeout(() => dashboardSearch(q), 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      document.getElementById('dashboard-search-results').classList.add('hidden');
    }
  });

  await Promise.all([loadActiveVisitors(), loadRecentForms()]);
}

async function dashboardSearch(query) {
  try {
    const results = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=30`);
    const container = document.getElementById('dashboard-search-results');
    const grid = document.getElementById('dashboard-search-grid');
    const count = document.getElementById('dashboard-search-count');
    const hint = document.getElementById('dashboard-search-hint');

    container.classList.remove('hidden');
    hint.textContent = '';
    count.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    
    if (results.length === 0) {
      grid.innerHTML = '<p class="text-gray-400 text-sm col-span-2 text-center py-4">No members found</p>';
      return;
    }

    grid.innerHTML = results.map(m => renderMemberCard(m)).join('');
  } catch (err) {
    document.getElementById('dashboard-search-hint').textContent = 'Search error: ' + err.message;
  }
}

let activeVisitorsPage = 1;

async function loadActiveVisitors(page = 1) {
  activeVisitorsPage = page;
  try {
    const data = await api('GET', `/api/checkin/active?page=${page}&perPage=20`);
    const header = document.getElementById('active-visitors-header');
    const grid = document.getElementById('active-visitors-grid');
    const pagination = document.getElementById('active-visitors-pagination');

    header.textContent = `Active Visitors (${data.total})`;

    if (data.visitors.length === 0) {
      grid.innerHTML = '<p class="text-gray-400 text-sm col-span-2 text-center py-8">No active visitors today</p>';
      pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = data.visitors.map(m => renderMemberCard(m, { showCheckin: false })).join('');

    if (data.totalPages > 1) {
      let paginationHtml = '';
      for (let i = 1; i <= data.totalPages; i++) {
        paginationHtml += `<button onclick="loadActiveVisitors(${i})" class="px-3 py-1 rounded text-sm ${i === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">${i}</button>`;
      }
      pagination.innerHTML = paginationHtml;
    } else {
      pagination.innerHTML = '';
    }
  } catch (err) {
    document.getElementById('active-visitors-grid').innerHTML = `<p class="text-red-400 text-sm col-span-2">${err.message}</p>`;
  }
}

async function loadRecentForms() {
  try {
    const forms = await api('GET', '/api/waivers/recent?limit=10');
    const container = document.getElementById('recent-forms-list');

    if (forms.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm p-4 text-center">No waiver submissions yet</p>';
      return;
    }

    container.innerHTML = `
      <table class="w-full">
        <thead>
          <tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
            <th class="px-4 py-2">Form</th>
            <th class="px-4 py-2">Member</th>
            <th class="px-4 py-2">Age</th>
            <th class="px-4 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          ${forms.map(f => {
            const age = calculateAge(f.date_of_birth);
            const isUnder18 = age !== null && age < 18;
            return `
              <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="openMemberProfile('${f.member_id}')">
                <td class="px-4 py-2 text-sm">${f.waiver_name}</td>
                <td class="px-4 py-2 text-sm font-medium">${f.first_name} ${f.last_name}</td>
                <td class="px-4 py-2 text-sm ${isUnder18 ? 'text-blue-600 font-bold' : 'text-gray-500'}">${age ?? '—'}</td>
                <td class="px-4 py-2 text-sm text-gray-400">${formatDateTime(f.signed_at)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    document.getElementById('recent-forms-list').innerHTML = `<p class="text-red-400 text-sm p-4">${err.message}</p>`;
  }
}

// ============================================================
// Check-In
// ============================================================

let checkinDebounceTimer = null;

async function loadCheckIn() {
  const el = document.getElementById('page-checkin');
  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Check In</h2>
      <p class="text-gray-500 mt-1">Scan QR code or search by name</p>
    </div>

    <div class="card mb-4">
      <div class="flex gap-4">
        <div class="flex-1" style="position: relative;">
          <input type="text" id="checkin-search" class="form-input text-lg" placeholder="Scan QR code or type name/email..." autofocus autocomplete="off">
          <div id="checkin-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:50; background:#fff; border:1px solid #e5e7eb; border-radius:0.5rem; box-shadow:0 4px 16px rgba(0,0,0,0.12); max-height:320px; overflow-y:auto; margin-top:4px;"></div>
        </div>
        <button onclick="processCheckInSearch()" class="btn btn-primary btn-lg">Search</button>
      </div>
    </div>

    <div id="checkin-result"></div>
  `;

  const searchInput = document.getElementById('checkin-search');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { hideCheckinDropdown(); processCheckInSearch(); }
    if (e.key === 'Escape') hideCheckinDropdown();
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(checkinDebounceTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { hideCheckinDropdown(); return; }
    checkinDebounceTimer = setTimeout(() => checkinLiveSearch(q), 300);
  });
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('checkin-dropdown');
    if (dropdown && !dropdown.contains(e.target) && e.target.id !== 'checkin-search') hideCheckinDropdown();
  });
  searchInput.focus();
}

function hideCheckinDropdown() {
  const dd = document.getElementById('checkin-dropdown');
  if (dd) dd.style.display = 'none';
}

async function checkinLiveSearch(query) {
  const dropdown = document.getElementById('checkin-dropdown');
  if (!dropdown) return;

  try {
    const results = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=10`);

    if (results.length === 0) {
      dropdown.innerHTML = `<div style="padding:12px 16px; color:#9ca3af; font-size:0.875rem;">No members found</div>`;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = results.map(m => {
      const age = calculateAge(m.date_of_birth);
      const isUnder18 = age !== null && age < 18;
      return `
        <div onclick="checkinDropdownSelect('${m.id}')" style="padding:10px 16px; cursor:pointer; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; gap:8px;" onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background='#fff'">
          <div style="width:32px;height:32px;border-radius:50%;background:${nameToColour(m.first_name+m.last_name)};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.7rem;flex-shrink:0">
            ${getInitials(m.first_name, m.last_name).toUpperCase()}
          </div>
          <div style="flex:1;min-width:0">
            <span style="font-weight:600; color:#111827;">${m.first_name} ${m.last_name}</span>
            <span style="color:#9ca3af; font-size:0.8rem; margin-left:8px;">${m.email || ''}</span>
            ${age !== null ? `<span style="color:${isUnder18 ? '#2563EB' : '#9ca3af'};font-size:0.75rem;margin-left:8px;${isUnder18 ? 'font-weight:700' : ''}">(${age})</span>` : ''}
          </div>
          ${!m.registration_fee_paid ? '<span style="width:20px;height:20px;background:#EF4444;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.65rem;font-weight:700;flex-shrink:0">!</span>' : ''}
        </div>
      `;
    }).join('');
    dropdown.style.display = 'block';
  } catch (err) {
    dropdown.style.display = 'none';
  }
}

async function checkinDropdownSelect(memberId) {
  hideCheckinDropdown();
  document.getElementById('checkin-search').value = '';
  await doCheckIn(memberId);
}

async function processCheckInSearch() {
  const query = document.getElementById('checkin-search').value.trim();
  if (!query) return;

  const resultEl = document.getElementById('checkin-result');

  try {
    if (query.startsWith('BR-')) {
      const member = await api('GET', `/api/members/by-qr/${encodeURIComponent(query)}`);
      if (member) {
        await doCheckIn(member.id);
        document.getElementById('checkin-search').value = '';
        return;
      }
    }

    const results = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=10`);

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

    resultEl.innerHTML = `
      <div class="card">
        <p class="text-sm text-gray-500 mb-3">${results.length} members found — select one:</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${results.map(m => renderMemberCard(m)).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = `<div class="card checkin-result checkin-fail"><p class="text-xl font-bold">Error</p><p class="text-gray-500 mt-2">${err.message}</p></div>`;
  }
}

async function doCheckIn(memberId) {
  const result = await api('POST', '/api/checkin/process', { memberId });
  const resultEl = document.getElementById('checkin-result');

  if (result.success) {
    const m = result.member;
    const regWarning = result.registrationWarning;

    resultEl.innerHTML = `
      <div class="card checkin-result checkin-success">
        <svg class="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        <p class="checkin-name">${m.first_name} ${m.last_name}</p>
        <p class="text-gray-500">${result.alreadyCheckedIn ? 'Already checked in today' : result.message}</p>
        ${m.active_pass ? `<span class="badge badge-success mt-2">${m.active_pass.pass_name}</span>` : ''}
        ${regWarning ? `
          <div class="mt-4 bg-red-50 border-2 border-red-400 rounded-xl p-4">
            <p class="text-red-600 font-bold text-lg">REGISTRATION FEE NOT PAID</p>
            <p class="text-red-500 text-sm mt-1">Add £3.00 to next transaction</p>
            <button onclick="openPOSForMember('${m.id}', '${m.first_name} ${m.last_name}')" class="btn btn-danger mt-2">Go to POS</button>
          </div>
        ` : ''}
      </div>
    `;

    if (!regWarning) {
      setTimeout(() => {
        resultEl.innerHTML = '';
        document.getElementById('checkin-search').value = '';
        document.getElementById('checkin-search').focus();
      }, 3000);
    }
  } else {
    resultEl.innerHTML = `
      <div class="card checkin-result checkin-fail">
        <svg class="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p class="checkin-name">${result.member ? result.member.first_name + ' ' + result.member.last_name : 'Unknown'}</p>
        <p class="text-red-500 font-semibold">${result.error}</p>
        ${result.needsWaiver ? '<button onclick="navigateTo(\'members\')" class="btn btn-primary mt-4">Complete Waiver</button>' : ''}
        ${result.needsPass ? '<button onclick="navigateTo(\'pos\')" class="btn btn-primary mt-4">Purchase Pass</button>' : ''}
      </div>
    `;
  }
}

// ============================================================
// Members Page
// ============================================================

async function loadMembers() {
  const el = document.getElementById('page-members');

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

    <div class="card p-0 overflow-x-auto">
      <table class="data-table w-full">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Member</th>
            <th class="whitespace-nowrap">Email</th>
            <th class="whitespace-nowrap text-center">Reg.</th>
            <th class="whitespace-nowrap text-center">Waiver</th>
            <th class="whitespace-nowrap">Pass</th>
            <th class="whitespace-nowrap">Joined</th>
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
  const tbody = document.getElementById('members-table-body');
  const countText = document.getElementById('member-count-text');

  let members, total;

  if (query) {
    members = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=50`);
    total = members.length;
  } else {
    const result = await api('GET', `/api/members/list?page=${page}&perPage=50`);
    members = result.members;
    total = result.total;
  }

  countText.textContent = `${total} member${total !== 1 ? 's' : ''}`;

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">No members found</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const initials = getInitials(m.first_name, m.last_name).toUpperCase();
    const colour = nameToColour(m.first_name + m.last_name);
    const regPaid = m.registration_fee_paid === 1;

    return `
      <tr onclick="openMemberProfile('${m.id}')">
        <td>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style="background:${colour}">${initials}</div>
            <span class="font-medium">${m.first_name} ${m.last_name}</span>
          </div>
        </td>
        <td class="text-gray-500">${m.email || '—'}</td>
        <td class="text-center">
          ${regPaid
            ? '<span class="w-6 h-6 inline-flex items-center justify-center bg-green-100 text-green-600 rounded-full"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg></span>'
            : '<span class="w-6 h-6 inline-flex items-center justify-center bg-red-100 text-red-600 rounded-full text-xs font-bold">!</span>'}
        </td>
        <td><span class="badge badge-neutral">—</span></td>
        <td><span class="badge badge-neutral">—</span></td>
        <td class="text-gray-400 text-sm">${m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '—'}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// Member Profile Modal
// ============================================================

async function openMemberProfile(memberId) {
  try {
    const [member, comments, passes, visits, transactions, events] = await Promise.all([
      api('GET', `/api/members/${memberId}/with-pass-status`),
      api('GET', `/api/members/${memberId}/comments`),
      api('GET', `/api/passes/member/${memberId}`).catch(() => []),
      api('GET', `/api/members/${memberId}/visits`),
      api('GET', `/api/members/${memberId}/transactions`),
      api('GET', `/api/members/${memberId}/events`),
    ]);

    if (!member) { showToast('Member not found', 'error'); return; }

    const initials = getInitials(member.first_name, member.last_name).toUpperCase();
    const colour = nameToColour(member.first_name + member.last_name);
    const age = calculateAge(member.date_of_birth);
    const isUnder18 = age !== null && age < 18;
    const regPaid = member.registration_fee_paid === 1;
    const fullName = `${member.first_name} ${member.last_name}`;

    const address = [member.address_line1, member.address_line2, member.city, member.region, member.postal_code].filter(Boolean).join(', ');

    document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto';

    showModal(`
      <div class="flex flex-col md:flex-row min-h-[500px]">
        <div class="md:w-80 flex-shrink-0 bg-gray-50 p-6 border-r border-gray-200 rounded-l-xl">
          <div class="flex justify-end mb-2">
            <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="text-center mb-4">
            <div class="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3" style="background:${colour}">${initials}</div>
            <h3 class="text-lg font-bold text-gray-900">${fullName}</h3>
          </div>

          <div class="flex items-center justify-center gap-2 mb-4">
            ${regPaid
              ? '<span class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></span><span class="text-sm text-green-600 font-medium">Registered</span>'
              : `<span class="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">!</span><span class="text-sm text-red-600 font-medium">Not Registered</span>
                 <button onclick="validateRegistration('${member.id}')" class="btn btn-sm btn-danger ml-1">Validate</button>`}
          </div>

          <div class="space-y-3 text-sm">
            ${member.date_of_birth ? `<div><span class="text-gray-400 text-xs uppercase">DOB</span><p class="font-medium">${formatDate(member.date_of_birth)} ${age !== null ? `<span class="${isUnder18 ? 'text-blue-600 font-bold' : 'text-gray-500'}">(${age})</span>` : ''}</p></div>` : ''}
            ${member.gender ? `<div><span class="text-gray-400 text-xs uppercase">Gender</span><p class="font-medium capitalize">${member.gender.replace('_', ' ')}</p></div>` : ''}
            ${member.email ? `<div><span class="text-gray-400 text-xs uppercase">Email</span><p class="font-medium text-blue-600">${member.email}</p></div>` : ''}
            ${member.phone ? `<div><span class="text-gray-400 text-xs uppercase">Phone</span><p class="font-medium">${member.phone}</p></div>` : ''}
            ${address ? `<div><span class="text-gray-400 text-xs uppercase">Address</span><p class="font-medium">${address}</p></div>` : ''}
            ${member.emergency_contact_name ? `<div><span class="text-gray-400 text-xs uppercase">Emergency Contact</span><p class="font-medium">${member.emergency_contact_name} ${member.emergency_contact_phone ? '(' + member.emergency_contact_phone + ')' : ''}</p></div>` : ''}
            ${member.medical_conditions ? `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2"><span class="text-yellow-800 text-xs uppercase font-bold">Medical</span><p class="text-yellow-700 text-sm">${member.medical_conditions}</p></div>` : ''}
          </div>

          <div class="mt-4 space-y-2">
            <button onclick="closeModal(); openPOSForMember('${member.id}', '${fullName.replace(/'/g, "\\'")}')" class="btn btn-primary w-full btn-sm">Open in POS</button>
            <button onclick="editMemberModal('${member.id}')" class="btn btn-secondary w-full btn-sm">Edit Profile</button>
          </div>

          <div class="mt-4 border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs uppercase font-bold text-gray-400">Comments (${comments.length})</span>
              <button onclick="toggleCommentForm()" class="text-blue-600 text-xs font-medium hover:underline">+ Add</button>
            </div>
            <div id="comment-form-container" class="hidden mb-3">
              <input type="text" id="comment-staff-name" class="form-input text-xs mb-1" placeholder="Your name" value="${window.currentStaff ? window.currentStaff.first_name : 'Staff'}">
              <textarea id="comment-text" class="form-input text-xs" rows="2" placeholder="Add a comment..."></textarea>
              <button onclick="addComment('${member.id}')" class="btn btn-sm btn-primary mt-1 w-full">Post Comment</button>
            </div>
            <div id="comments-list" class="space-y-2 max-h-40 overflow-y-auto">
              ${comments.length === 0 ? '<p class="text-xs text-gray-400">No comments yet</p>' :
                comments.map(c => `
                  <div class="bg-white rounded-lg p-2 border border-gray-100">
                    <div class="flex items-center gap-1 mb-0.5">
                      <span class="text-xs font-bold text-gray-700">${c.staff_name}</span>
                      <span class="text-xs text-gray-300">${formatDate(c.created_at)}</span>
                    </div>
                    <p class="text-xs text-gray-600">${c.comment}</p>
                  </div>
                `).join('')}
            </div>
          </div>

          ${member.tags && member.tags.length > 0 ? `
            <div class="mt-4 border-t border-gray-200 pt-4">
              <span class="text-xs uppercase font-bold text-gray-400">Tags</span>
              <div class="flex flex-wrap gap-1 mt-2">
                ${member.tags.map(t => `<span class="px-2 py-0.5 rounded-full text-xs font-medium text-white" style="background:${t.colour || '#3B82F6'}">${t.name}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="flex-1 flex flex-col min-w-0">
          <div class="flex border-b border-gray-200">
            <button onclick="switchProfileTab('passes')" class="profile-tab active px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600" data-tab="passes">Passes</button>
            <button onclick="switchProfileTab('visits')" class="profile-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="visits">Visits</button>
            <button onclick="switchProfileTab('events')" class="profile-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="events">Events</button>
            <button onclick="switchProfileTab('transactions')" class="profile-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="transactions">Transactions</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div id="profile-tab-passes" class="profile-tab-content">${renderPassesTab(passes)}</div>
            <div id="profile-tab-visits" class="profile-tab-content hidden">${renderVisitsTab(visits)}</div>
            <div id="profile-tab-events" class="profile-tab-content hidden">${renderEventsTab(events)}</div>
            <div id="profile-tab-transactions" class="profile-tab-content hidden">${renderTransactionsTab(transactions)}</div>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    showToast('Error loading profile: ' + err.message, 'error');
  }
}

function switchProfileTab(tabName) {
  document.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.remove('active', 'border-blue-600', 'text-blue-600');
    t.classList.add('border-transparent', 'text-gray-500');
  });
  document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hidden'));

  const activeTab = document.querySelector(`.profile-tab[data-tab="${tabName}"]`);
  if (activeTab) {
    activeTab.classList.add('active', 'border-blue-600', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');
  }
  const content = document.getElementById(`profile-tab-${tabName}`);
  if (content) content.classList.remove('hidden');
}

function renderPassesTab(passes) {
  if (!passes || passes.length === 0) return '<p class="text-gray-400 text-center py-8">No passes</p>';
  return passes.map(p => {
    const isActive = p.status === 'active';
    const statusColour = isActive ? 'green' : p.status === 'paused' ? 'yellow' : 'red';
    return `
      <div class="bg-white border border-gray-200 rounded-xl p-4 mb-3 ${isActive ? 'border-l-4 border-l-green-500' : ''}">
        <div class="flex items-start justify-between">
          <div><h4 class="font-bold text-sm">${p.pass_name || 'Pass'}</h4><p class="text-xs text-gray-500 mt-0.5">${p.category || ''}</p></div>
          <span class="badge badge-${statusColour === 'green' ? 'success' : statusColour === 'yellow' ? 'warning' : 'danger'}">${p.status}</span>
        </div>
        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
          ${p.visits_remaining !== null ? `<span>Visits: ${p.visits_remaining} remaining</span>` : '<span>Unlimited visits</span>'}
          ${p.started_at ? `<span>From: ${formatDate(p.started_at)}</span>` : ''}
          ${p.expires_at ? `<span>Expires: ${formatDate(p.expires_at)}</span>` : ''}
        </div>
        ${p.status === 'paused' && p.pause_reason ? `<p class="text-xs text-yellow-600 mt-1">Paused: ${p.pause_reason}</p>` : ''}
      </div>
    `;
  }).join('');
}

function renderVisitsTab(visits) {
  if (!visits || visits.length === 0) return '<p class="text-gray-400 text-center py-8">No visit history</p>';
  return `<table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-400 uppercase border-b"><th class="pb-2">Date</th><th class="pb-2">Time</th><th class="pb-2">Method</th><th class="pb-2">Pass</th></tr></thead><tbody>${visits.map(v => `<tr class="border-b border-gray-50"><td class="py-2">${formatDate(v.checked_in_at)}</td><td class="py-2 text-gray-500">${v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '—'}</td><td class="py-2"><span class="badge badge-neutral">${v.method || 'desk'}</span></td><td class="py-2 text-gray-500">${v.pass_name || '—'}</td></tr>`).join('')}</tbody></table>`;
}

function renderEventsTab(events) {
  if (!events || events.length === 0) return '<p class="text-gray-400 text-center py-8">No event history</p>';
  return `<table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-400 uppercase border-b"><th class="pb-2">Event</th><th class="pb-2">Date</th><th class="pb-2">Status</th></tr></thead><tbody>${events.map(e => `<tr class="border-b border-gray-50"><td class="py-2 font-medium">${e.event_name}</td><td class="py-2 text-gray-500">${formatDate(e.starts_at)}</td><td class="py-2"><span class="badge badge-neutral">${e.status}</span></td></tr>`).join('')}</tbody></table>`;
}

function renderTransactionsTab(transactions) {
  if (!transactions || transactions.length === 0) return '<p class="text-gray-400 text-center py-8">No transactions</p>';
  return `<table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-400 uppercase border-b"><th class="pb-2">Date</th><th class="pb-2">Items</th><th class="pb-2">Method</th><th class="pb-2 text-right">Amount</th></tr></thead><tbody>${transactions.map(t => `<tr class="border-b border-gray-50"><td class="py-2">${formatDate(t.created_at)}</td><td class="py-2 text-gray-600 truncate max-w-[200px]">${t.items_summary || '—'}</td><td class="py-2"><span class="badge badge-neutral">${t.payment_method === 'dojo_card' ? 'Card' : t.payment_method}</span></td><td class="py-2 text-right font-semibold ${t.total_amount < 0 ? 'text-red-500' : ''}">£${Math.abs(t.total_amount).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}

function toggleCommentForm() {
  document.getElementById('comment-form-container').classList.toggle('hidden');
}

async function addComment(memberId) {
  const staffName = document.getElementById('comment-staff-name').value.trim();
  const comment = document.getElementById('comment-text').value.trim();
  if (!comment) return;
  try {
    await api('POST', `/api/members/${memberId}/comments`, { staff_name: staffName || 'Staff', comment });
    showToast('Comment added', 'success');
    await openMemberProfile(memberId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function validateRegistration(memberId) {
  try {
    await api('POST', `/api/members/${memberId}/validate-registration`);
    showToast('Registration validated', 'success');
    await openMemberProfile(memberId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function editMemberModal(memberId) {
  const m = await api('GET', `/api/members/${memberId}`);
  if (!m) return;

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';

  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-4">Edit Member</h3>
      <form id="edit-member-form" onsubmit="updateMember(event, '${m.id}')">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">First Name *</label><input type="text" name="first_name" class="form-input" value="${m.first_name || ''}" required></div>
          <div class="form-group"><label class="form-label">Last Name *</label><input type="text" name="last_name" class="form-input" value="${m.last_name || ''}" required></div>
          <div class="form-group"><label class="form-label">Email</label><input type="email" name="email" class="form-input" value="${m.email || ''}"></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="tel" name="phone" class="form-input" value="${m.phone || ''}"></div>
          <div class="form-group"><label class="form-label">Date of Birth</label><input type="date" name="date_of_birth" class="form-input" value="${m.date_of_birth || ''}"></div>
          <div class="form-group"><label class="form-label">Gender</label><select name="gender" class="form-select"><option value="">—</option><option value="male" ${m.gender === 'male' ? 'selected' : ''}>Male</option><option value="female" ${m.gender === 'female' ? 'selected' : ''}>Female</option><option value="other" ${m.gender === 'other' ? 'selected' : ''}>Other</option><option value="prefer_not_to_say" ${m.gender === 'prefer_not_to_say' ? 'selected' : ''}>Prefer not to say</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><input type="text" name="address_line1" class="form-input mb-2" placeholder="Address Line 1" value="${m.address_line1 || ''}"><input type="text" name="address_line2" class="form-input mb-2" placeholder="Address Line 2" value="${m.address_line2 || ''}"><div class="grid grid-cols-3 gap-2"><input type="text" name="city" class="form-input" placeholder="City" value="${m.city || ''}"><input type="text" name="region" class="form-input" placeholder="County" value="${m.region || ''}"><input type="text" name="postal_code" class="form-input" placeholder="Postcode" value="${m.postal_code || ''}"></div></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">Emergency Contact Name</label><input type="text" name="emergency_contact_name" class="form-input" value="${m.emergency_contact_name || ''}"></div>
          <div class="form-group"><label class="form-label">Emergency Contact Phone</label><input type="tel" name="emergency_contact_phone" class="form-input" value="${m.emergency_contact_phone || ''}"></div>
        </div>
        <div class="form-group"><label class="form-label">Medical Conditions</label><input type="text" name="medical_conditions" class="form-input" value="${m.medical_conditions || ''}"></div>
        <div class="form-group"><label class="form-label">Notes</label><textarea name="notes" class="form-input" rows="2">${m.notes || ''}</textarea></div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="openMemberProfile('${m.id}')" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `);
}

async function updateMember(e, memberId) {
  e.preventDefault();
  const form = document.getElementById('edit-member-form');
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('PUT', `/api/members/${memberId}`, data);
    showToast('Member updated', 'success');
    await openMemberProfile(memberId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ============================================================
// New Member Modal
// ============================================================

function showNewMemberModal() {
  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';

  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-4">Register New Member</h3>
      <form id="new-member-form" onsubmit="createMember(event)">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">First Name *</label><input type="text" name="first_name" class="form-input" required></div>
          <div class="form-group"><label class="form-label">Last Name *</label><input type="text" name="last_name" class="form-input" required></div>
          <div class="form-group"><label class="form-label">Email</label><input type="email" name="email" class="form-input"></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="tel" name="phone" class="form-input"></div>
          <div class="form-group"><label class="form-label">Date of Birth</label><input type="date" name="date_of_birth" class="form-input"></div>
          <div class="form-group"><label class="form-label">Gender</label><select name="gender" class="form-select"><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><input type="text" name="address_line1" class="form-input mb-2" placeholder="Address Line 1"><input type="text" name="address_line2" class="form-input mb-2" placeholder="Address Line 2"><div class="grid grid-cols-3 gap-2"><input type="text" name="city" class="form-input" placeholder="City"><input type="text" name="region" class="form-input" placeholder="County"><input type="text" name="postal_code" class="form-input" placeholder="Postcode"></div></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">Emergency Contact Name</label><input type="text" name="emergency_contact_name" class="form-input"></div>
          <div class="form-group"><label class="form-label">Emergency Contact Phone</label><input type="tel" name="emergency_contact_phone" class="form-input"></div>
        </div>
        <div class="form-group"><label class="form-label">Medical Conditions</label><input type="text" name="medical_conditions" class="form-input" placeholder="None, or describe..."></div>
        <div class="form-group"><label class="form-label">Climbing Experience</label><select name="climbing_experience" class="form-select"><option value="">—</option><option value="new">New Climber</option><option value="few_times">Climbed a few times</option><option value="regular">Regular Climber</option></select></div>
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
  const form = document.getElementById('new-member-form');
  const data = Object.fromEntries(new FormData(form));

  try {
    const member = await api('POST', '/api/members', data);
    closeModal();
    showToast(`${member.first_name} ${member.last_name} registered`, 'success');

    if (member.email) {
      api('POST', `/api/members/${member.id}/send-qr-email`).then(r => {
        if (r.success) showToast('QR code sent to ' + member.email, 'info');
      });
    }

    if (document.getElementById('page-members').classList.contains('active')) await refreshMembersList();
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      const q = document.getElementById('dashboard-search')?.value;
      if (q && q.length >= 3) await dashboardSearch(q);
    }
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ============================================================
// Open POS for a specific member
// ============================================================

async function openPOSForMember(memberId, memberName) {
  closeModal();
  navigateTo('pos');
  await new Promise(r => setTimeout(r, 200));
  try {
    const member = await api('GET', `/api/members/${memberId}/with-pass-status`);
    posSelectMember(member);
  } catch (err) {
    const [firstName, ...rest] = memberName.split(' ');
    posSelectMember({ id: memberId, first_name: firstName, last_name: rest.join(' ') });
  }
}

// ============================================================
// Placeholder pages
// ============================================================

function loadEvents() {
  document.getElementById('page-events').innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold">Events & Scheduling</h2><p class="text-gray-500 mt-1">Coming soon</p></div>
    <div class="card"><p class="text-gray-400">Events, courses, slot booker — under development.</p></div>
  `;
}

function loadRoutes() {
  document.getElementById('page-routes').innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold">Routes</h2><p class="text-gray-500 mt-1">Coming soon</p></div>
    <div class="card"><p class="text-gray-400">Route management, gym map, logbooks — under development.</p></div>
  `;
}

function loadAnalytics() {
  document.getElementById('page-analytics').innerHTML = `
    <div class="mb-6"><h2 class="text-2xl font-bold">Analytics</h2><p class="text-gray-500 mt-1">Coming soon</p></div>
    <div class="card"><p class="text-gray-400">Dashboards, reports, retention analytics — under development.</p></div>
  `;
}

// ============================================================
// Settings Page (Staff Management + General + Integrations)
// ============================================================

let settingsTab = 'staff';

async function loadStaff() {
  const el = document.getElementById('page-staff');

  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Settings</h2>
      <p class="text-gray-500 mt-1">Staff management, gym settings, and integrations</p>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 mb-6">
      <button onclick="switchSettingsTab('staff')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'staff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="staff">Staff Management</button>
      <button onclick="switchSettingsTab('general')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="general">General</button>
      <button onclick="switchSettingsTab('integrations')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'integrations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="integrations">Integrations</button>
    </div>

    <div id="settings-tab-staff" class="settings-tab-content ${settingsTab !== 'staff' ? 'hidden' : ''}"></div>
    <div id="settings-tab-general" class="settings-tab-content ${settingsTab !== 'general' ? 'hidden' : ''}"></div>
    <div id="settings-tab-integrations" class="settings-tab-content ${settingsTab !== 'integrations' ? 'hidden' : ''}"></div>
  `;

  loadSettingsTabContent(settingsTab);
}

function switchSettingsTab(tab) {
  settingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.classList.remove('border-blue-600', 'text-blue-600');
    t.classList.add('border-transparent', 'text-gray-500');
  });
  document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));

  const active = document.querySelector(`.settings-tab[data-stab="${tab}"]`);
  if (active) { active.classList.add('border-blue-600', 'text-blue-600'); active.classList.remove('border-transparent', 'text-gray-500'); }

  const content = document.getElementById(`settings-tab-${tab}`);
  if (content) content.classList.remove('hidden');

  loadSettingsTabContent(tab);
}

async function loadSettingsTabContent(tab) {
  switch (tab) {
    case 'staff': return loadStaffManagement();
    case 'general': return loadGeneralSettings();
    case 'integrations': return loadIntegrationSettings();
  }
}

// ---- Staff Management Tab ----

async function loadStaffManagement() {
  const container = document.getElementById('settings-tab-staff');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading staff...</p>';

  try {
    const staffList = await api('GET', '/api/staff/list?activeOnly=false');

    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Staff Members</h3>
        <button onclick="showStaffModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">+ Add Staff</button>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-gray-50">
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Email</th>
              <th class="px-4 py-3 text-center">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staffList.length === 0 ? '<tr><td colspan="5" class="text-center text-gray-400 py-8">No staff members</td></tr>' :
              staffList.map(s => {
                const initials = getInitials(s.first_name, s.last_name).toUpperCase();
                const colour = nameToColour(s.first_name + s.last_name);
                return `
                  <tr class="border-b border-gray-50 hover:bg-gray-50">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs" style="background:${colour}">${initials}</div>
                        <div>
                          <p class="font-medium text-gray-900">${s.first_name} ${s.last_name}</p>
                          ${s.phone ? `<p class="text-xs text-gray-400">${s.phone}</p>` : ''}
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">${getRoleBadgeHTML(s.role)}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${s.email || '—'}</td>
                    <td class="px-4 py-3 text-center">
                      ${s.is_active
                        ? '<span class="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Active</span>'
                        : '<span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>Inactive</span>'}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button onclick="showStaffModal('${s.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="Edit">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onclick="resetStaffPin('${s.id}', '${s.first_name}')" class="p-1.5 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition" title="Reset PIN">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                        </button>
                        ${s.is_active
                          ? `<button onclick="toggleStaffStatus('${s.id}', false)" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition" title="Deactivate"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></button>`
                          : `<button onclick="toggleStaffStatus('${s.id}', true)" class="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition" title="Activate"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>`}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading staff: ${err.message}</p>`;
  }
}

async function showStaffModal(staffId = null) {
  let staff = null;
  if (staffId) {
    try { staff = await api('GET', `/api/staff/${staffId}`); } catch (e) {}
  }

  const isEdit = !!staff;
  const title = isEdit ? 'Edit Staff Member' : 'Add Staff Member';

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto';

  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold">${title}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <form id="staff-form" onsubmit="saveStaff(event, ${isEdit ? `'${staffId}'` : 'null'})">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input type="text" name="first_name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? staff.first_name : ''}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input type="text" name="last_name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? staff.last_name : ''}">
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" name="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? (staff.email || '') : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="tel" name="phone" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? (staff.phone || '') : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Role *</label>
          <select name="role" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="centre_assistant" ${staff && staff.role === 'centre_assistant' ? 'selected' : ''}>Centre Assistant</option>
            <option value="duty_manager" ${staff && staff.role === 'duty_manager' ? 'selected' : ''}>Duty Manager</option>
            <option value="setter" ${staff && staff.role === 'setter' ? 'selected' : ''}>Route Setter</option>
            <option value="tech_lead" ${staff && staff.role === 'tech_lead' ? 'selected' : ''}>Tech Lead</option>
            <option value="owner" ${staff && staff.role === 'owner' ? 'selected' : ''}>Owner</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN ${isEdit ? '' : '*'}</label>
            <input type="text" name="pin" maxlength="4" pattern="[0-9]{4}" ${isEdit ? '' : 'required'} class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center text-lg tracking-[0.3em] font-mono" placeholder="${isEdit ? 'Leave blank to keep' : '0000'}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" name="password" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="${isEdit ? 'Leave blank to keep' : 'Optional'}">
          </div>
        </div>
        <div id="staff-form-error" class="text-red-500 text-sm mb-3 hidden"></div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Cancel</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium">${isEdit ? 'Save Changes' : 'Add Staff'}</button>
        </div>
      </form>
    </div>
  `);
}

async function saveStaff(e, staffId) {
  e.preventDefault();
  const form = document.getElementById('staff-form');
  const data = Object.fromEntries(new FormData(form));
  const errEl = document.getElementById('staff-form-error');

  // Clean empty optional fields
  if (!data.pin) delete data.pin;
  if (!data.password) delete data.password;
  if (!data.email) delete data.email;
  if (!data.phone) delete data.phone;

  try {
    if (staffId) {
      await api('PUT', `/api/staff/${staffId}`, data);
      showToast('Staff member updated', 'success');
    } else {
      await api('POST', '/api/staff', data);
      showToast('Staff member added', 'success');
    }
    closeModal();
    loadStaffManagement();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function resetStaffPin(staffId, firstName) {
  const newPin = prompt(`Enter new 4-digit PIN for ${firstName}:`);
  if (!newPin || !/^\d{4}$/.test(newPin)) {
    if (newPin !== null) showToast('PIN must be 4 digits', 'error');
    return;
  }
  try {
    await api('PUT', `/api/staff/${staffId}`, { pin: newPin });
    showToast('PIN reset successfully', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function toggleStaffStatus(staffId, activate) {
  try {
    if (activate) {
      await api('POST', `/api/staff/${staffId}/activate`);
      showToast('Staff member activated', 'success');
    } else {
      await api('POST', `/api/staff/${staffId}/deactivate`);
      showToast('Staff member deactivated', 'success');
    }
    loadStaffManagement();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ---- General Settings Tab ----

async function loadGeneralSettings() {
  const container = document.getElementById('settings-tab-general');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading settings...</p>';

  try {
    const settings = await api('GET', '/api/settings');

    container.innerHTML = `
      <div class="max-w-2xl">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
        <form id="general-settings-form" onsubmit="saveGeneralSettings(event)" class="space-y-4">
          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3">Gym Details</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Gym Name</label>
                <input type="text" name="gym_name" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.gym_name || ''}">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Peak Description</label>
                  <input type="text" name="peak_description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.peak_description || ''}">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Off-Peak Description</label>
                  <input type="text" name="off_peak_description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.off_peak_description || ''}">
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3">Pricing</h4>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Registration Fee (£)</label>
                <input type="number" step="0.01" name="first_time_registration_fee" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.first_time_registration_fee || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Shoe Rental (£)</label>
                <input type="number" step="0.01" name="shoe_rental_price" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.shoe_rental_price || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select name="currency" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                  <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                  <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex justify-end">
            <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition text-sm">Save Changes</button>
          </div>
        </form>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading settings: ${err.message}</p>`;
  }
}

async function saveGeneralSettings(e) {
  e.preventDefault();
  const form = document.getElementById('general-settings-form');
  const data = Object.fromEntries(new FormData(form));

  // Map currency to symbol
  const symbols = { GBP: '£', EUR: '€', USD: '$' };

  try {
    const promises = Object.entries(data).map(([key, value]) =>
      api('PUT', `/api/settings/${key}`, { value })
    );
    // Also update currency symbol
    if (data.currency) {
      promises.push(api('PUT', '/api/settings/currency_symbol', { value: symbols[data.currency] || '£' }));
    }
    await Promise.all(promises);
    showToast('Settings saved', 'success');
  } catch (err) {
    showToast('Error saving settings: ' + err.message, 'error');
  }
}

// ---- Integrations Tab ----

async function loadIntegrationSettings() {
  const container = document.getElementById('settings-tab-integrations');

  try {
    const settings = await api('GET', '/api/settings');

    container.innerHTML = `
      <div class="max-w-2xl space-y-4">
        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">GoCardless</h4>
              <p class="text-xs text-gray-500">Direct debit payment collection</p>
            </div>
          </div>
          <form onsubmit="saveIntegration(event, 'gocardless')" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <input type="password" name="gocardless_access_token" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.gocardless_access_token || ''}" placeholder="sandbox_xxx or live_xxx">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Environment</label>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gocardless_environment" value="sandbox" ${settings.gocardless_environment !== 'live' ? 'checked' : ''} class="text-blue-600">
                  <span class="text-sm text-gray-700">Sandbox</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gocardless_environment" value="live" ${settings.gocardless_environment === 'live' ? 'checked' : ''} class="text-blue-600">
                  <span class="text-sm text-gray-700">Live</span>
                </label>
              </div>
            </div>
            <div class="flex justify-end"><button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Save</button></div>
          </form>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Dojo</h4>
              <p class="text-xs text-gray-500">Card terminal payments</p>
            </div>
          </div>
          <form onsubmit="saveIntegration(event, 'dojo')" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input type="password" name="dojo_api_key" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.dojo_api_key || ''}" placeholder="Your Dojo API key">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Terminal ID</label>
              <input type="text" name="dojo_terminal_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.dojo_terminal_id || ''}" placeholder="Terminal identifier">
            </div>
            <div class="flex justify-end"><button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Save</button></div>
          </form>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Email / SMTP</h4>
              <p class="text-xs text-gray-500">Outbound email for receipts, QR codes</p>
            </div>
          </div>
          <form onsubmit="saveIntegration(event, 'email')" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input type="text" name="email_smtp_host" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_host || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                <input type="text" name="email_smtp_port" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_port || ''}">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">From Address</label>
              <input type="email" name="email_from" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_from || ''}" placeholder="noreply@boulderryn.com">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                <input type="text" name="email_smtp_user" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_user || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                <input type="password" name="email_smtp_pass" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_pass || ''}">
              </div>
            </div>
            <div class="flex justify-end"><button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Save</button></div>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading integrations: ${err.message}</p>`;
  }
}

async function saveIntegration(e, type) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  try {
    const promises = Object.entries(data).map(([key, value]) =>
      api('PUT', `/api/settings/${key}`, { value })
    );
    await Promise.all(promises);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} settings saved`, 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
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
  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

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
// Init — Start with auth
// ============================================================

// Add shake animation CSS
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
  .animate-shake { animation: shake 0.4s ease-in-out; }
`;
document.head.appendChild(shakeStyle);

initAuth();
