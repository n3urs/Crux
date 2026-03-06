/**
 * POS Page — Point of Sale interface
 */

// Current cart state
let posCart = [];
let posSelectedMember = null;

async function loadPOS() {
  const el = document.getElementById('page-pos');

  if (typeof window.api === 'undefined') {
    el.innerHTML = '<div class="card"><p class="text-gray-500">Database not available outside Electron.</p></div>';
    return;
  }

  el.innerHTML = `
    <div class="flex gap-4 h-[calc(100vh-7rem)]">
      <!-- Left: Product Grid -->
      <div class="flex-1 flex flex-col min-w-0">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-gray-900">Point of Sale</h2>
          <div class="flex gap-2">
            <button onclick="showAddProductModal()" class="btn btn-sm btn-secondary">+ Add Product</button>
            <button onclick="showDailySummaryModal()" class="btn btn-sm btn-secondary">End of Day</button>
          </div>
        </div>

        <!-- Category tabs -->
        <div id="pos-category-tabs" class="flex gap-2 mb-4 overflow-x-auto flex-shrink-0"></div>

        <!-- Product grid -->
        <div id="pos-product-grid" class="grid grid-cols-3 xl:grid-cols-4 gap-2 overflow-y-auto flex-1"></div>
      </div>

      <!-- Right: Cart -->
      <div class="w-96 flex flex-col bg-white border border-gray-200 rounded-xl flex-shrink-0">
        <!-- Member selection -->
        <div class="p-4 border-b border-gray-100">
          <div class="flex gap-2">
            <input type="text" id="pos-member-search" class="form-input text-sm flex-1"
              placeholder="Link member (name/QR)..." onkeydown="if(event.key==='Enter')posSearchMember()">
            <button onclick="posSearchMember()" class="btn btn-sm btn-secondary">Find</button>
          </div>
          <div id="pos-member-display" class="mt-2 text-sm"></div>
        </div>

        <!-- Cart items -->
        <div id="pos-cart-items" class="flex-1 overflow-y-auto p-4">
          <p class="text-gray-400 text-center text-sm py-8">Cart is empty</p>
        </div>

        <!-- Cart total & pay -->
        <div class="border-t border-gray-200 p-4">
          <div class="flex justify-between items-center mb-4">
            <span class="text-lg font-semibold">Total</span>
            <span id="pos-cart-total" class="text-2xl font-bold">£0.00</span>
          </div>
          <div class="flex gap-2">
            <button onclick="posPayCard()" class="btn btn-primary btn-lg flex-1" id="pos-pay-btn" disabled>
              Pay — Card
            </button>
          </div>
          <div class="flex gap-2 mt-2">
            <button onclick="posPayGiftCard()" class="btn btn-sm btn-secondary flex-1">Gift Card</button>
            <button onclick="posClearCart()" class="btn btn-sm btn-danger">Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;

  await posLoadProducts();
}

async function posLoadProducts() {
  const grouped = await window.api.product.listGrouped(true);
  const tabsEl = document.getElementById('pos-category-tabs');
  const gridEl = document.getElementById('pos-product-grid');

  if (grouped.length === 0) {
    tabsEl.innerHTML = '';
    gridEl.innerHTML = '<p class="text-gray-400 text-center col-span-full py-8">No products yet. Click "+ Add Product" to get started.</p>';
    return;
  }

  // Build tabs
  tabsEl.innerHTML = `
    <button class="pos-tab active" onclick="posFilterCategory(null, this)">All</button>
    ${grouped.map(g => `
      <button class="pos-tab" onclick="posFilterCategory('${g.id}', this)">${g.name}</button>
    `).join('')}
  `;

  // Build grid with all products
  window._posProducts = grouped;
  posRenderGrid(null);
}

function posRenderGrid(categoryId) {
  const gridEl = document.getElementById('pos-product-grid');
  let products = [];

  if (categoryId) {
    const cat = window._posProducts.find(g => g.id === categoryId);
    if (cat) products = cat.products;
  } else {
    window._posProducts.forEach(g => products.push(...g.products));
  }

  if (products.length === 0) {
    gridEl.innerHTML = '<p class="text-gray-400 text-center col-span-full py-8">No products in this category.</p>';
    return;
  }

  gridEl.innerHTML = products.map(p => {
    const outOfStock = p.stock_enforce_limit && p.stock_count !== null && p.stock_count <= 0;
    return `
      <button onclick="posAddToCart('${p.id}')" class="pos-product-btn ${outOfStock ? 'opacity-40 cursor-not-allowed' : ''}" ${outOfStock ? 'disabled' : ''}>
        <span class="font-semibold text-sm leading-tight">${p.name}</span>
        <span class="text-blue-600 font-bold mt-1">£${p.price.toFixed(2)}</span>
        ${p.stock_count !== null ? `<span class="text-xs text-gray-400">${p.stock_count} left</span>` : ''}
      </button>
    `;
  }).join('');
}

function posFilterCategory(categoryId, btn) {
  document.querySelectorAll('.pos-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  posRenderGrid(categoryId);
}

async function posAddToCart(productId) {
  const product = await window.api.product.getById(productId);
  if (!product) return;

  // Check stock
  if (product.stock_enforce_limit && product.stock_count !== null && product.stock_count <= 0) {
    showToast('Out of stock', 'error');
    return;
  }

  const existing = posCart.find(item => item.product_id === productId);
  if (existing) {
    existing.quantity++;
    existing.total_price = existing.quantity * existing.unit_price;
  } else {
    posCart.push({
      product_id: productId,
      description: product.name,
      unit_price: product.price,
      quantity: 1,
      total_price: product.price,
    });
  }

  posRenderCart();
}

function posAddCustomItem(description, price) {
  posCart.push({
    product_id: null,
    description,
    unit_price: price,
    quantity: 1,
    total_price: price,
  });
  posRenderCart();
}

function posRemoveFromCart(index) {
  posCart.splice(index, 1);
  posRenderCart();
}

function posUpdateQuantity(index, delta) {
  posCart[index].quantity += delta;
  if (posCart[index].quantity <= 0) {
    posCart.splice(index, 1);
  } else {
    posCart[index].total_price = posCart[index].quantity * posCart[index].unit_price;
  }
  posRenderCart();
}

function posRenderCart() {
  const itemsEl = document.getElementById('pos-cart-items');
  const totalEl = document.getElementById('pos-cart-total');
  const payBtn = document.getElementById('pos-pay-btn');

  if (posCart.length === 0) {
    itemsEl.innerHTML = '<p class="text-gray-400 text-center text-sm py-8">Cart is empty</p>';
    totalEl.textContent = '£0.00';
    payBtn.disabled = true;
    return;
  }

  const total = posCart.reduce((sum, item) => sum + item.total_price, 0);

  itemsEl.innerHTML = posCart.map((item, i) => `
    <div class="flex items-center justify-between py-2 border-b border-gray-50">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">${item.description}</p>
        <p class="text-xs text-gray-400">£${item.unit_price.toFixed(2)} each</p>
      </div>
      <div class="flex items-center gap-2 ml-2">
        <button onclick="posUpdateQuantity(${i}, -1)" class="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold">−</button>
        <span class="text-sm font-semibold w-6 text-center">${item.quantity}</span>
        <button onclick="posUpdateQuantity(${i}, 1)" class="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold">+</button>
        <span class="text-sm font-semibold w-14 text-right">£${item.total_price.toFixed(2)}</span>
        <button onclick="posRemoveFromCart(${i})" class="text-red-400 hover:text-red-600 ml-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  totalEl.textContent = `£${total.toFixed(2)}`;
  payBtn.textContent = `Pay — Card (£${total.toFixed(2)})`;
  payBtn.disabled = false;
}

async function posSearchMember() {
  const query = document.getElementById('pos-member-search').value.trim();
  if (!query) return;

  // Try QR
  if (query.startsWith('BR-')) {
    const m = await window.api.member.getByQrCode(query);
    if (m) { posSelectMember(m); return; }
  }

  const results = await window.api.member.search(query, 5);
  const displayEl = document.getElementById('pos-member-display');

  if (results.length === 0) {
    displayEl.innerHTML = '<span class="text-red-400">No member found</span>';
    return;
  }

  if (results.length === 1) {
    posSelectMember(results[0]);
    return;
  }

  displayEl.innerHTML = results.map(m => `
    <button onclick='posSelectMember(${JSON.stringify(m).replace(/'/g, "&#39;")})' class="block w-full text-left px-2 py-1 hover:bg-blue-50 rounded text-sm">
      ${m.first_name} ${m.last_name} <span class="text-gray-400">${m.email || ''}</span>
    </button>
  `).join('');
}

function posSelectMember(member) {
  posSelectedMember = member;
  document.getElementById('pos-member-search').value = '';
  document.getElementById('pos-member-display').innerHTML = `
    <div class="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
      <span class="font-medium text-sm">${member.first_name} ${member.last_name}</span>
      <button onclick="posClearMember()" class="text-gray-400 hover:text-red-500 text-xs">Remove</button>
    </div>
  `;
}

function posClearMember() {
  posSelectedMember = null;
  document.getElementById('pos-member-display').innerHTML = '';
}

async function posPayCard() {
  if (posCart.length === 0) return;

  const total = posCart.reduce((sum, item) => sum + item.total_price, 0);

  // TODO: Send total to Dojo card reader when API available
  // For now, simulate payment completion

  try {
    const txn = await window.api.transaction.create({
      member_id: posSelectedMember ? posSelectedMember.id : null,
      payment_method: 'dojo_card',
      payment_status: 'completed',
      items: posCart,
      notes: null,
    });

    showToast(`Payment complete — £${total.toFixed(2)}`, 'success');

    // Send receipt if member has email
    if (posSelectedMember && posSelectedMember.email) {
      window.api.transaction.sendReceipt(txn.id).then(r => {
        if (r.success) showToast('Receipt emailed', 'info');
      });
    }

    // Clear cart
    posClearCart();
    await posLoadProducts(); // Refresh stock counts
  } catch (err) {
    showToast('Payment failed: ' + err.message, 'error');
  }
}

async function posPayGiftCard() {
  if (posCart.length === 0) return;
  const total = posCart.reduce((sum, item) => sum + item.total_price, 0);

  const code = prompt('Enter gift card code:');
  if (!code) return;

  try {
    const card = await window.api.giftcard.getByCode(code);
    if (!card) { showToast('Gift card not found', 'error'); return; }
    if (card.current_balance < total) {
      showToast(`Insufficient balance (£${card.current_balance.toFixed(2)} available)`, 'error');
      return;
    }

    const txn = await window.api.transaction.create({
      member_id: posSelectedMember ? posSelectedMember.id : null,
      payment_method: 'gift_card',
      payment_status: 'completed',
      payment_reference: code,
      items: posCart,
    });

    await window.api.giftcard.redeem(code, total, txn.id);
    showToast(`Paid with gift card — £${total.toFixed(2)} (balance: £${(card.current_balance - total).toFixed(2)})`, 'success');
    posClearCart();
    await posLoadProducts();
  } catch (err) {
    showToast('Gift card payment failed: ' + err.message, 'error');
  }
}

function posClearCart() {
  posCart = [];
  posSelectedMember = null;
  document.getElementById('pos-member-display').innerHTML = '';
  posRenderCart();
}

async function showDailySummaryModal() {
  const summary = await window.api.transaction.dailySummary();

  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-4">End of Day — ${summary.date}</h3>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="card">
          <div class="card-header">Transactions</div>
          <div class="card-value">${summary.totals.transaction_count}</div>
        </div>
        <div class="card">
          <div class="card-header">Total Sales</div>
          <div class="card-value">£${summary.totals.total_sales.toFixed(2)}</div>
        </div>
        <div class="card">
          <div class="card-header">Net Total</div>
          <div class="card-value">£${summary.totals.net_total.toFixed(2)}</div>
        </div>
      </div>

      ${summary.totals.total_refunds > 0 ? `
        <div class="bg-red-50 rounded-lg p-3 mb-4">
          <span class="text-sm font-semibold text-red-800">Refunds: £${summary.totals.total_refunds.toFixed(2)}</span>
        </div>
      ` : ''}

      <h4 class="font-semibold text-sm text-gray-500 uppercase mb-2">By Payment Method</h4>
      <div class="space-y-2 mb-4">
        ${summary.byMethod.map(m => `
          <div class="flex justify-between items-center py-1">
            <span class="text-sm">${m.payment_method === 'dojo_card' ? 'Card (Dojo)' : m.payment_method}</span>
            <span class="font-semibold">£${m.net_total.toFixed(2)} <span class="text-gray-400 text-xs">(${m.transaction_count} txns)</span></span>
          </div>
        `).join('')}
      </div>

      ${summary.byCategory.length > 0 ? `
        <h4 class="font-semibold text-sm text-gray-500 uppercase mb-2">By Category</h4>
        <div class="space-y-2 mb-4">
          ${summary.byCategory.map(c => `
            <div class="flex justify-between items-center py-1">
              <span class="text-sm">${c.category || 'Uncategorised'}</span>
              <span class="font-semibold">£${c.total.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${summary.topProducts.length > 0 ? `
        <h4 class="font-semibold text-sm text-gray-500 uppercase mb-2">Top Products</h4>
        <div class="space-y-2">
          ${summary.topProducts.map(p => `
            <div class="flex justify-between items-center py-1">
              <span class="text-sm">${p.description} <span class="text-gray-400">(x${p.qty})</span></span>
              <span class="font-semibold">£${p.revenue.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="flex justify-end mt-6">
        <button onclick="closeModal()" class="btn btn-secondary">Close</button>
      </div>
    </div>
  `);
}

function showAddProductModal() {
  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-4">Add Product</h3>
      <form id="add-product-form" onsubmit="posCreateProduct(event)">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group col-span-2">
            <label class="form-label">Product Name *</label>
            <input type="text" name="name" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Price (£) *</label>
            <input type="number" name="price" class="form-input" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">Cost Price (£)</label>
            <input type="number" name="cost_price" class="form-input" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select name="category_id" class="form-select" id="product-category-select">
              <option value="">None</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Initial Stock (blank = not tracked)</label>
            <input type="number" name="stock_count" class="form-input" min="0">
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Description</label>
            <input type="text" name="description" class="form-input">
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Product</button>
        </div>
      </form>
    </div>
  `);

  // Load categories into select
  window.api.product.listCategories().then(cats => {
    const select = document.getElementById('product-category-select');
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  });
}

async function posCreateProduct(e) {
  e.preventDefault();
  const form = document.getElementById('add-product-form');
  const data = Object.fromEntries(new FormData(form));

  data.price = parseFloat(data.price);
  if (data.cost_price) data.cost_price = parseFloat(data.cost_price);
  if (data.stock_count) data.stock_count = parseInt(data.stock_count);
  else data.stock_count = null;
  if (!data.category_id) data.category_id = null;

  try {
    await window.api.product.create(data);
    closeModal();
    showToast('Product added', 'success');
    await posLoadProducts();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}
