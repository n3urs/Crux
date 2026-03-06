/**
 * Preload script — exposes safe IPC bridge to renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Members
  member: {
    create: (data) => ipcRenderer.invoke('member:create', data),
    getById: (id) => ipcRenderer.invoke('member:getById', id),
    getByQrCode: (qrCode) => ipcRenderer.invoke('member:getByQrCode', qrCode),
    getByEmail: (email) => ipcRenderer.invoke('member:getByEmail', email),
    search: (query, limit) => ipcRenderer.invoke('member:search', query, limit),
    update: (id, data) => ipcRenderer.invoke('member:update', id, data),
    delete: (id) => ipcRenderer.invoke('member:delete', id),
    list: (opts) => ipcRenderer.invoke('member:list', opts),
    count: () => ipcRenderer.invoke('member:count'),
    getWithPassStatus: (id) => ipcRenderer.invoke('member:getWithPassStatus', id),
    addFamilyLink: (parentId, childId, rel) => ipcRenderer.invoke('member:addFamilyLink', parentId, childId, rel),
    getFamily: (id) => ipcRenderer.invoke('member:getFamily', id),
    sendQrEmail: (id) => ipcRenderer.invoke('member:sendQrEmail', id),
  },

  // Check-in
  checkin: {
    process: (memberId, method) => ipcRenderer.invoke('checkin:process', memberId, method),
  },

  // Products
  product: {
    create: (data) => ipcRenderer.invoke('product:create', data),
    getById: (id) => ipcRenderer.invoke('product:getById', id),
    list: (opts) => ipcRenderer.invoke('product:list', opts),
    listGrouped: (activeOnly) => ipcRenderer.invoke('product:listGrouped', activeOnly),
    update: (id, data) => ipcRenderer.invoke('product:update', id, data),
    delete: (id) => ipcRenderer.invoke('product:delete', id),
    search: (query) => ipcRenderer.invoke('product:search', query),
    adjustStock: (id, qty) => ipcRenderer.invoke('product:adjustStock', id, qty),
    getLowStock: () => ipcRenderer.invoke('product:getLowStock'),
    createCategory: (name, sort) => ipcRenderer.invoke('product:createCategory', name, sort),
    listCategories: () => ipcRenderer.invoke('product:listCategories'),
    updateCategory: (id, data) => ipcRenderer.invoke('product:updateCategory', id, data),
    deleteCategory: (id) => ipcRenderer.invoke('product:deleteCategory', id),
  },

  // Transactions
  transaction: {
    create: (data) => ipcRenderer.invoke('transaction:create', data),
    getById: (id) => ipcRenderer.invoke('transaction:getById', id),
    list: (opts) => ipcRenderer.invoke('transaction:list', opts),
    refund: (id, amount) => ipcRenderer.invoke('transaction:refund', id, amount),
    dailySummary: (date) => ipcRenderer.invoke('transaction:dailySummary', date),
    sendReceipt: (id) => ipcRenderer.invoke('transaction:sendReceipt', id),
  },

  // Passes
  pass: {
    createType: (data) => ipcRenderer.invoke('pass:createType', data),
    listTypes: (activeOnly) => ipcRenderer.invoke('pass:listTypes', activeOnly),
    updateType: (id, data) => ipcRenderer.invoke('pass:updateType', id, data),
    issue: (memberId, passTypeId, isPeak, pricePaid) => ipcRenderer.invoke('pass:issue', memberId, passTypeId, isPeak, pricePaid),
    getById: (id) => ipcRenderer.invoke('pass:getById', id),
    getActive: (memberId) => ipcRenderer.invoke('pass:getActive', memberId),
    getAll: (memberId) => ipcRenderer.invoke('pass:getAll', memberId),
    pause: (id, reason) => ipcRenderer.invoke('pass:pause', id, reason),
    unpause: (id) => ipcRenderer.invoke('pass:unpause', id),
    cancel: (id, reason) => ipcRenderer.invoke('pass:cancel', id, reason),
    extend: (id, days) => ipcRenderer.invoke('pass:extend', id, days),
    transfer: (id, newMemberId) => ipcRenderer.invoke('pass:transfer', id, newMemberId),
    seedDefaults: () => ipcRenderer.invoke('pass:seedDefaults'),
  },

  // Waivers
  waiver: {
    listTemplates: () => ipcRenderer.invoke('waiver:listTemplates'),
    getActiveTemplate: (type) => ipcRenderer.invoke('waiver:getActiveTemplate', type),
    sign: (data) => ipcRenderer.invoke('waiver:sign', data),
    isValid: (memberId) => ipcRenderer.invoke('waiver:isValid', memberId),
    getLatestValid: (memberId) => ipcRenderer.invoke('waiver:getLatestValid', memberId),
    getMemberHistory: (memberId) => ipcRenderer.invoke('waiver:getMemberHistory', memberId),
    getExpiringSoon: (days) => ipcRenderer.invoke('waiver:getExpiringSoon', days),
    seedDefaults: () => ipcRenderer.invoke('waiver:seedDefaults'),
  },

  // Gift Cards
  giftcard: {
    create: (data) => ipcRenderer.invoke('giftcard:create', data),
    getByCode: (code) => ipcRenderer.invoke('giftcard:getByCode', code),
    redeem: (code, amount, txnId) => ipcRenderer.invoke('giftcard:redeem', code, amount, txnId),
    addBalance: (code, amount) => ipcRenderer.invoke('giftcard:addBalance', code, amount),
    listActive: () => ipcRenderer.invoke('giftcard:listActive'),
  },

  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },

  // Stats
  stats: {
    dashboard: () => ipcRenderer.invoke('stats:dashboard'),
  },
});
