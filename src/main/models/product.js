/**
 * Product & Category model
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const Product = {
  // ---- Categories ----

  createCategory(name, sortOrder = 0) {
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO product_categories (id, name, sort_order) VALUES (?, ?, ?)').run(id, name, sortOrder);
    return this.getCategoryById(id);
  },

  getCategoryById(id) {
    return getDb().prepare('SELECT * FROM product_categories WHERE id = ?').get(id);
  },

  listCategories() {
    return getDb().prepare('SELECT * FROM product_categories ORDER BY sort_order, name').all();
  },

  updateCategory(id, data) {
    const db = getDb();
    const updates = [];
    const params = { id };
    if (data.name !== undefined) { updates.push('name = @name'); params.name = data.name; }
    if (data.icon !== undefined) { updates.push('icon = @icon'); params.icon = data.icon; }
    if (data.sort_order !== undefined) { updates.push('sort_order = @sort_order'); params.sort_order = parseInt(data.sort_order) || 0; }
    if (updates.length) db.prepare(`UPDATE product_categories SET ${updates.join(', ')} WHERE id = @id`).run(params);
    return this.getCategoryById(id);
  },

  deleteCategory(id) {
    return getDb().prepare('DELETE FROM product_categories WHERE id = ?').run(id);
  },

  // ---- Products ----

  create(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO products (id, category_id, name, description, price, cost_price,
        stock_count, stock_low_threshold, stock_enforce_limit,
        requires_certification_id, linked_pass_type_id, is_active, sort_order)
      VALUES (@id, @category_id, @name, @description, @price, @cost_price,
        @stock_count, @stock_low_threshold, @stock_enforce_limit,
        @requires_certification_id, @linked_pass_type_id, @is_active, @sort_order)
    `).run({
      id,
      category_id: data.category_id || null,
      name: data.name,
      description: data.description || null,
      price: data.price,
      cost_price: data.cost_price || null,
      stock_count: data.stock_count ?? null,
      stock_low_threshold: data.stock_low_threshold || null,
      stock_enforce_limit: data.stock_enforce_limit || 0,
      requires_certification_id: data.requires_certification_id || null,
      linked_pass_type_id: data.linked_pass_type_id || null,
      is_active: data.is_active ?? 1,
      sort_order: data.sort_order || 0,
    });
    return this.getById(id);
  },

  getById(id) {
    return getDb().prepare(`
      SELECT p.*, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.id = ?
    `).get(id);
  },

  list({ categoryId, activeOnly = true } = {}) {
    const db = getDb();
    let sql = `
      SELECT p.*, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1
    `;
    const params = {};
    if (activeOnly) { sql += ' AND p.is_active = 1'; }
    if (categoryId) { sql += ' AND p.category_id = @categoryId'; params.categoryId = categoryId; }
    sql += ' ORDER BY pc.sort_order, p.sort_order, p.name';
    return db.prepare(sql).all(params);
  },

  listGroupedByCategory(activeOnly = true) {
    const products = this.list({ activeOnly });
    const categories = this.listCategories();
    const grouped = {};

    categories.forEach(cat => {
      grouped[cat.id] = { id: cat.id, name: cat.name, icon: cat.icon, sort_order: cat.sort_order, products: [] };
    });

    // Uncategorised bucket
    grouped['_uncategorised'] = { id: null, name: 'Uncategorised', products: [] };

    products.forEach(p => {
      const key = p.category_id || '_uncategorised';
      if (grouped[key]) grouped[key].products.push(p);
    });

    return Object.values(grouped).filter(g => g.products.length > 0);
  },

  update(id, data) {
    const db = getDb();
    const fields = ['category_id', 'name', 'description', 'price', 'cost_price',
      'stock_count', 'stock_low_threshold', 'stock_enforce_limit',
      'requires_certification_id', 'linked_pass_type_id', 'is_active', 'sort_order'];
    const updates = [];
    const params = { id };

    for (const f of fields) {
      if (data[f] !== undefined) {
        updates.push(`${f} = @${f}`);
        params[f] = data[f];
      }
    }
    if (updates.length === 0) return this.getById(id);
    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = @id`).run(params);
    return this.getById(id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM products WHERE id = ?').run(id);
  },

  search(query) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.name LIKE @q AND p.is_active = 1
      ORDER BY p.name
    `).all({ q: `%${query}%` });
  },

  adjustStock(id, quantity) {
    const db = getDb();
    db.prepare('UPDATE products SET stock_count = stock_count + ?, updated_at = datetime(\'now\') WHERE id = ? AND stock_count IS NOT NULL')
      .run(quantity, id);
    return this.getById(id);
  },

  getLowStock() {
    return getDb().prepare(`
      SELECT p.*, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.stock_count IS NOT NULL
        AND p.stock_low_threshold IS NOT NULL
        AND p.stock_count <= p.stock_low_threshold
        AND p.is_active = 1
      ORDER BY p.stock_count ASC
    `).all();
  },
};

module.exports = Product;
