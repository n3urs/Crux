/**
 * BoulderRyn — Express Web Server
 * Replaces Electron main process
 */

const express = require('express');
const path = require('path');
const { getDb, closeDb } = require('./src/main/database/db');

// Models
const Pass = require('./src/main/models/pass');
const Waiver = require('./src/main/models/waiver');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' })); // large limit for signature images
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'src', 'public')));

// API Routes
app.use('/api/members', require('./src/routes/members'));
app.use('/api/checkin', require('./src/routes/checkin'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/transactions', require('./src/routes/transactions'));
app.use('/api/passes', require('./src/routes/passes'));
app.use('/api/waivers', require('./src/routes/waivers'));
app.use('/api/giftcards', require('./src/routes/giftcards'));
app.use('/api/events', require('./src/routes/events'));
app.use('/api/routes', require('./src/routes/routes'));
app.use('/api/analytics', require('./src/routes/analytics'));
app.use('/api/staff', require('./src/routes/staff'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/stats', require('./src/routes/stats'));

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
  // Ensure database is initialised
  getDb();

  // Seed defaults on first run
  Pass.seedDefaults();
  Waiver.seedDefaults();

  console.log(`BoulderRyn running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
