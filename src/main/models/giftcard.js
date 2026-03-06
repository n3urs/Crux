/**
 * Gift Card model
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

function generateCode() {
  // Generate a human-readable gift card code like BR-XXXX-XXXX
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/1/0 for clarity
  let code = 'BR-';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const GiftCard = {
  create(data) {
    const db = getDb();
    const id = uuidv4();
    const code = generateCode();

    db.prepare(`
      INSERT INTO gift_cards (id, code, initial_balance, current_balance, purchased_by_member_id, purchased_transaction_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, code, data.amount, data.amount, data.member_id || null, data.transaction_id || null);

    return this.getById(id);
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM gift_cards WHERE id = ?').get(id);
  },

  getByCode(code) {
    return getDb().prepare('SELECT * FROM gift_cards WHERE code = ? AND is_active = 1').get(code.toUpperCase());
  },

  redeem(code, amount, transactionId = null) {
    const db = getDb();
    const card = this.getByCode(code);
    if (!card) throw new Error('Gift card not found');
    if (card.current_balance < amount) throw new Error(`Insufficient balance (£${card.current_balance.toFixed(2)} available)`);

    const newBalance = card.current_balance - amount;

    db.prepare('UPDATE gift_cards SET current_balance = ? WHERE id = ?').run(newBalance, card.id);

    db.prepare(`
      INSERT INTO gift_card_transactions (id, gift_card_id, transaction_id, amount, balance_after)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), card.id, transactionId, -amount, newBalance);

    return this.getById(card.id);
  },

  addBalance(code, amount) {
    const db = getDb();
    const card = this.getByCode(code);
    if (!card) throw new Error('Gift card not found');

    const newBalance = card.current_balance + amount;
    db.prepare('UPDATE gift_cards SET current_balance = ? WHERE id = ?').run(newBalance, card.id);

    db.prepare(`
      INSERT INTO gift_card_transactions (id, gift_card_id, amount, balance_after)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), card.id, amount, newBalance);

    return this.getById(card.id);
  },

  getHistory(cardId) {
    return getDb().prepare(`
      SELECT * FROM gift_card_transactions WHERE gift_card_id = ? ORDER BY created_at DESC
    `).all(cardId);
  },

  deactivate(id) {
    getDb().prepare('UPDATE gift_cards SET is_active = 0 WHERE id = ?').run(id);
  },

  listActive() {
    return getDb().prepare('SELECT * FROM gift_cards WHERE is_active = 1 AND current_balance > 0 ORDER BY created_at DESC').all();
  },
};

module.exports = GiftCard;
