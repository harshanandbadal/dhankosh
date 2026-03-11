/* =========================================================
   DHANKOSH TERMINAL — script.js
   All dashboard logic: state, rendering, modals, forms
   ========================================================= */

'use strict';

// ─── CONSTANTS ────────────────────────────────────────────

const CREDIT_LIMITS = {
  amazon: 60000,
  coral: 60000,
  flipkart: 77000,
  supermoney: 4500,
  kiwi: 30000,
};

const ACCOUNT_LABELS = {
  airtel: 'Airtel Payment Bank',
  bob: 'Bank of Baroda',
  jupiter: 'Jupiter Federal Bank',
  ubi: 'Union Bank of India',
  slice: 'Slice Small Finance Bank',
  cash: 'Cash in Hand',
  amazon: 'Amazon Pay ICICI',
  coral: 'Coral ICICI',
  flipkart: 'Flipkart Axis',
  supermoney: 'SuperMoney',
  kiwi: 'Kiwi Yes Bank',
};

// Budget system is now fully dynamic — no hardcoded limits or labels

// ─── PARTICLE BACKGROUND ──────────────────────────────────

function initializeParticles() {
  const container = document.getElementById('particlesContainer');
  if (!container) return;

  const particleCount = 50;
  const animations = ['particleFloat', 'particleFloat2', 'particleFloat3'];

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const size = Math.random() * 4 + 2; // 2-6px
    const left = Math.random() * 100;
    const delay = Math.random() * 20;
    const duration = Math.random() * 15 + 15; // 15-30s
    const animation = animations[Math.floor(Math.random() * animations.length)];

    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = left + '%';
    particle.style.bottom = '-10px';
    particle.style.animation = `${animation} ${duration}s linear ${delay}s infinite`;

    container.appendChild(particle);
  }
}

// ─── STATE ────────────────────────────────────────────────

function getDefaultState() {
  return {
    banks: {
      airtel: 0, bob: 0, jupiter: 0, ubi: 0, slice: 0, cash: 0,
    },

    credit: {
      amazon: 0, coral: 0, flipkart: 0, supermoney: 0, kiwi: 0,
    },
    budgets: [],       // [{ id, name, limit, spent }]
    customers: [],     // { id, name, phoneNumber, youGave, youGot }
    transactions: [],  // { id, date, type, purpose, account, amount, sign }
    notifications: [],
    netWealthTarget: 0,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem('dhankosh_state');
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle missing keys from older saves
    const defaults = getDefaultState();

    // Migrate old object-format budgets to new array format
    let budgets = [];
    if (Array.isArray(parsed.budgets)) {
      budgets = parsed.budgets;
    } else if (parsed.budgets && typeof parsed.budgets === 'object') {
      // Old format: { personal: 0, kitchen: 0, ... }
      const oldLabelMap = {
        personal: 'Personal Monthly Budget', kitchen: 'Kitchen Monthly Spent',
        rent: 'Room Rent', utilities: 'Utilities', entertainment: 'Entertainment',
        health: 'Health & Fitness', education: 'Education',
        transportation: 'Transportation', others: 'Others',
      };
      const oldLimitMap = {
        personal: 1300, kitchen: 2000, rent: 1500,
      };
      for (const [key, spent] of Object.entries(parsed.budgets)) {
        if (key === 'others') continue;
        const limit = oldLimitMap[key] || 0;
        if (limit > 0 || spent > 0) {
          budgets.push({
            id: generateId(),
            name: oldLabelMap[key] || key,
            limit: limit,
            spent: spent || 0,
          });
        }
      }
    }

    return {
      banks: { ...defaults.banks, ...parsed.banks },

      credit: { ...defaults.credit, ...parsed.credit },
      budgets: budgets,
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      p2p: Array.isArray(parsed.p2p) ? parsed.p2p : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      netWealthTarget: typeof parsed.netWealthTarget === 'number' ? parsed.netWealthTarget : defaults.netWealthTarget,
    };
  } catch {
    return getDefaultState();
  }
}

function saveState() {
  // Save to localStorage immediately (offline cache)
  localStorage.setItem('dhankosh_state', JSON.stringify(state));

  // Debounced save to MongoDB server
  if (_saveToServerTimeout) clearTimeout(_saveToServerTimeout);
  _saveToServerTimeout = setTimeout(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      await fetch('/api/state', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          banks: state.banks,
          credit: state.credit,
          budgets: state.budgets,
          customers: state.customers,
          p2p: state.p2p,
          transactions: state.transactions,
          notifications: state.notifications,
          netWealthTarget: state.netWealthTarget,
        }),
      });
    } catch (err) {
      console.warn('[ SYNC WARNING ] Failed to save to server:', err.message);
    }
  }, 500);
}

let _saveToServerTimeout = null;
let state = loadState();

// ─── API HELPERS ──────────────────────────────────────────

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`,
  };
}

async function loadStateFromServer() {
  try {
    const token = getAuthToken();
    if (!token) return null;

    const response = await fetch('/api/state', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid — redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '../pages/login.html';
        return null;
      }
      throw new Error('Server returned ' + response.status);
    }

    const data = await response.json();
    const defaults = getDefaultState();

    return {
      banks: { ...defaults.banks, ...(data.banks || {}) },
      credit: { ...defaults.credit, ...(data.credit || {}) },
      budgets: Array.isArray(data.budgets) ? data.budgets : [],
      customers: Array.isArray(data.customers) ? data.customers : [],
      p2p: Array.isArray(data.p2p) ? data.p2p : [],
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      netWealthTarget: typeof data.netWealthTarget === 'number' ? data.netWealthTarget : defaults.netWealthTarget,
    };
  } catch (err) {
    console.warn('[ SYNC WARNING ] Failed to load from server, using local cache:', err.message);
    return null; // Will fall back to localStorage
  }
}

// ─── FORMAT HELPERS ───────────────────────────────────────

function formatINR(amount) {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return (amount < 0 ? '- ₹ ' : '₹ ') + formatted;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── RENDER: BANK ACCOUNTS ────────────────────────────────

function renderBanks() {
  const bankKeys = ['airtel', 'bob', 'jupiter', 'ubi', 'slice', 'cash'];
  let totalCapital = 0;

  bankKeys.forEach(key => {
    const row = document.querySelector(`.bank-account-item[data-bank="${key}"]`);
    if (!row) return;

    const val = state.banks[key] || 0;
    totalCapital += val;

    const valueEl = row.querySelector('.value');
    if (valueEl) {
      valueEl.textContent = formatINR(val);
      valueEl.className = 'value ' + (val >= 0 ? 'pos' : 'neg');
    }
  });

  // Update the panel header total capital display
  const capitalEl = document.getElementById('bankTotalCapital');
  if (capitalEl) {
    capitalEl.textContent = formatINR(totalCapital);
    capitalEl.className = 'value ' + (totalCapital >= 0 ? 'pos' : 'neg');
  }
}


// ─── RENDER: CREDIT LINES ─────────────────────────────────

function renderCredit() {
  const creditKeys = ['amazon', 'coral', 'flipkart', 'supermoney', 'kiwi'];
  const items = document.querySelectorAll('.credit-item');

  // Helper function to calculate outstanding for an account
  function getOutstandingForAccount(accountKey) {
    const creditLabel = ACCOUNT_LABELS[accountKey];
    let outstanding = 0;

    state.transactions.forEach(txn => {
      if (txn.account === creditLabel) {
        if (txn.sign === '+') {
          // Deposit/Payment reduces outstanding
          outstanding -= txn.amount;
        } else if (txn.sign === '-') {
          // Withdrawal/Spending increases outstanding
          outstanding += txn.amount;
        }
      }
    });

    return Math.max(0, outstanding);
  }

  items.forEach((item, i) => {
    const key = creditKeys[i];
    if (!key) return;

    let outstanding = 0;
    let limit = CREDIT_LIMITS[key] || 0;

    // Amazon and Coral are linked - they share the same limit and combined outstanding
    if (key === 'amazon' || key === 'coral') {
      const amazonOutstanding = getOutstandingForAccount('amazon');
      const coralOutstanding = getOutstandingForAccount('coral');
      outstanding = amazonOutstanding + coralOutstanding;
      // Both share the same limit (60000)
      limit = CREDIT_LIMITS['amazon'];
    } else {
      outstanding = getOutstandingForAccount(key);
    }

    const available = limit - outstanding;
    const pct = limit > 0 ? Math.min((outstanding / limit) * 100, 100) : 0;

    const details = item.querySelectorAll('.credit-value');
    if (details[0]) {
      details[0].textContent = formatINR(outstanding);
      details[0].className = 'credit-value neg';
    }
    if (details[1]) {
      details[1].textContent = formatINR(available);
      details[1].className = 'credit-value pos';
    }

    const fill = item.querySelector('.progress-fill');
    if (fill) {
      fill.style.width = pct.toFixed(1) + '%';
      // Color the bar based on usage
      if (pct > 80) {
        fill.style.background = 'var(--accent-red)';
      } else if (pct > 50) {
        fill.style.background = 'var(--accent-gold)';
      } else {
        fill.style.background = 'var(--accent-cyan)';
      }
    }
  });
}

// ─── RENDER: BUDGETS ──────────────────────────────────────

function renderBudgets() {
  const list = document.getElementById('budgetsList');
  const empty = document.getElementById('noBudgets');
  if (!list) return;

  list.innerHTML = '';

  if (state.budgets.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  state.budgets.forEach(budget => {
    const spent = budget.spent || 0;
    const limit = budget.limit || 0;
    const available = limit - spent;
    const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

    const item = document.createElement('div');
    item.className = 'bank-account-item budget-item';
    item.dataset.id = budget.id;

    item.innerHTML = `
      <div class="bank-info">
        <span class="label">${escapeHtml(budget.name)}</span>
        <span class="value pos">${formatINR(limit)}</span>
      </div>
      <div class="budget-stats">
        <div class="budget-stat">
          <div class="budget-label">Utilised</div>
          <div class="budget-value neg">${formatINR(spent)}</div>
        </div>
        <div class="budget-stat">
          <div class="budget-label">Available</div>
          <div class="budget-value ${available >= 0 ? 'pos' : 'neg'}">${formatINR(available)}</div>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-fill"></div>
      </div>
      <div class="bank-actions">
        <button class="bank-action-btn budget-limit-btn" data-id="${budget.id}">📈 Limit Increase</button>
        <button class="bank-action-btn budget-delete-btn" data-id="${budget.id}">🗑️ Delete</button>
      </div>
    `;

    // Set progress fill
    const fill = item.querySelector('.progress-fill');
    if (fill) {
      fill.style.width = pct.toFixed(1) + '%';
      if (pct >= 100) {
        fill.style.background = 'var(--accent-red)';
        fill.style.boxShadow = '0 0 10px rgba(255, 61, 0, 0.5)';
      } else if (pct > 70) {
        fill.style.background = 'var(--accent-gold)';
        fill.style.boxShadow = '0 0 10px rgba(255, 196, 0, 0.4)';
      } else {
        fill.style.background = 'var(--accent-gold)';
        fill.style.boxShadow = '0 0 10px rgba(255, 196, 0, 0.4)';
      }
    }

    // Attach event listeners
    item.querySelector('.budget-limit-btn').addEventListener('click', () => openBudgetLimitModal(budget.id));
    item.querySelector('.budget-delete-btn').addEventListener('click', () => deleteBudget(budget.id));

    list.appendChild(item);
  });

  // Also update the Withdrawal form's payment details dropdown
  populateSpentsDropdown();

  // Update total available in panel header
  const totalAvailable = state.budgets.reduce((sum, b) => sum + ((b.limit || 0) - (b.spent || 0)), 0);
  const totalEl = document.getElementById('budgetTotalAvailable');
  if (totalEl) {
    totalEl.textContent = formatINR(totalAvailable);
    totalEl.className = totalAvailable >= 0 ? 'value pos' : 'value neg';
  }
}

// ─── POPULATE WITHDRAWAL DROPDOWN WITH DYNAMIC BUDGETS ───

function populateSpentsDropdown() {
  const budgetGroup = document.getElementById('budgetOptionsGroup');
  if (!budgetGroup) return;

  // Clear existing budget options
  budgetGroup.innerHTML = '';

  // Add dynamic budget options
  state.budgets.forEach(budget => {
    const opt = document.createElement('option');
    opt.value = 'budget_' + budget.id;
    opt.textContent = escapeHtml(budget.name);
    budgetGroup.appendChild(opt);
  });

  // Hide the group if no budgets exist
  budgetGroup.style.display = state.budgets.length === 0 ? 'none' : '';
}

// ─── BUDGET HELPER VARIABLES ──────────────────────────────

let currentBudgetSpentId = null;
let currentBudgetLimitId = null;

function openBudgetSpentModal(budgetId) {
  currentBudgetSpentId = budgetId;
  const budget = state.budgets.find(b => b.id === budgetId);
  if (!budget) return;

  const title = document.getElementById('budgetSpentModalTitle');
  if (title) title.textContent = `[ Spent — ${budget.name} ]`;

  openModal('budgetSpentModalOverlay');
}

function openBudgetLimitModal(budgetId) {
  currentBudgetLimitId = budgetId;
  openModal('budgetLimitModalOverlay');
}

function deleteBudget(budgetId) {
  const budget = state.budgets.find(b => b.id === budgetId);
  const budgetName = budget ? budget.name : 'this budget';
  confirmDelete(`Are you sure you want to delete the budget "${budgetName}"?`, () => {
    state.budgets = state.budgets.filter(b => b.id !== budgetId);
    saveState();
    renderBudgets();
    renderNetWealth();
    addNotification('Budget deleted');
  });
}

// ─── RENDER: P2P ──────────────────────────────────────────

function renderP2P() {
  const payablesList = document.getElementById('payablesList');
  const receivablesList = document.getElementById('receivablesList');
  if (!payablesList || !receivablesList) return;

  const payables = state.p2p.filter(e => e.type === 'payable');
  const receivables = state.p2p.filter(e => e.type === 'receivable');

  function buildRow(entry) {
    const row = document.createElement('div');
    row.className = 'p2p-row';
    row.dataset.id = entry.id;

    const amtClass = entry.type === 'payable' ? 'payable' : 'receivable';
    const amtPrefix = entry.type === 'payable' ? '- ' : '+ ';

    row.innerHTML = `
      <div class="p2p-row-content">
        <div class="p2p-label">
          <span class="name">${escapeHtml(entry.name)}</span>
          ${entry.details ? `<span class="details">${escapeHtml(entry.details)}</span>` : ''}
        </div>
        <span class="p2p-amount ${amtClass}">${amtPrefix}${formatINR(entry.amount)}</span>
      </div>
      <button class="p2p-delete-btn" data-id="${entry.id}">[ ✕ ]</button>
    `;

    row.querySelector('.p2p-delete-btn').addEventListener('click', () => {
      deleteP2P(entry.id);
    });

    return row;
  }

  payablesList.innerHTML = '';
  if (payables.length === 0) {
    payablesList.innerHTML = '<div class="no-transactions" style="padding:0.5rem 0; font-size:0.8rem;">[ NONE ]</div>';
  } else {
    payables.forEach(e => payablesList.prepend(buildRow(e)));
  }

  receivablesList.innerHTML = '';
  if (receivables.length === 0) {
    receivablesList.innerHTML = '<div class="no-transactions" style="padding:0.5rem 0; font-size:0.8rem;">[ NONE ]</div>';
  } else {
    receivables.forEach(e => receivablesList.prepend(buildRow(e)));
  }
}

function deleteP2P(id) {
  const entry = state.p2p.find(e => e.id === id);
  const entryName = entry ? entry.name : 'this entry';
  confirmDelete(`Are you sure you want to delete the P2P entry for "${entryName}"?`, () => {
    state.p2p = state.p2p.filter(e => e.id !== id);
    saveState();
    renderP2P();
    renderNetWealth();
    addNotification('P2P entry removed');
  });
}

// ─── RENDER: TRANSACTIONS ─────────────────────────────────

function renderTransactions() {
  const list = document.getElementById('transactionsList');
  const empty = document.getElementById('noTransactions');
  if (!list) return;

  list.innerHTML = '';

  if (state.transactions.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  // Apply search filter if present
  const searchInput = document.getElementById('txnSearchInput');
  const query = searchInput && searchInput.value ? searchInput.value.toLowerCase().trim() : '';

  let filtered = state.transactions;
  if (query) {
    filtered = filtered.filter(txn => {
      const typeDisplay = txn.sign === '+' ? 'deposit' : 'withdraw';
      const searchString = `${txn.id} ${txn.date} ${typeDisplay} ${txn.amount} ${txn.purpose} ${txn.account}`.toLowerCase();
      return searchString.includes(query);
    });
  }

  if (filtered.length === 0) {
    if (empty) {
      empty.textContent = '[ NO TRANSACTIONS MATCHING SEARCH ]';
      empty.style.display = 'block';
    }
    return;
  }
  if (empty) empty.textContent = '[ NO TRANSACTIONS YET ]';

  // Show newest first
  const sorted = filtered.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b._ts || 0) - (a._ts || 0);
  });

  sorted.forEach(txn => {
    const row = document.createElement('div');
    row.className = 'transaction-row';
    row.dataset.id = txn.id;

    const amountClass = txn.sign === '+' ? 'positive' : 'negative';
    const amountStr = (txn.sign === '+' ? '+ ' : '- ') + formatINR(txn.amount);

    // Determine transaction type: Deposit or Withdraw
    const txnTypeDisplay = txn.sign === '+' ? 'Deposit' : 'Withdraw';
    const typeClass = txn.type.toLowerCase().replace(/ /g, '_');

    row.innerHTML = `
      <div class="txn-data-date">${formatDate(txn.date)}</div>
      <div class="txn-data-id">${txn.id.substring(0, 8)}</div>
      <div class="txn-data-type ${typeClass}">${txnTypeDisplay}</div>
      <div class="txn-data-amount ${amountClass}">${amountStr}</div>
      <div class="txn-data-purpose" title="${escapeHtml(txn.purpose)}">${escapeHtml(txn.purpose)}</div>
      <div class="txn-data-account">${escapeHtml(txn.account)}</div>
      <button class="txn-delete-btn" data-id="${txn.id}" title="Delete Transaction">🗑️ Delete</button>
    `;

    // Add delete event listener
    const deleteBtn = row.querySelector('.txn-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTransaction(txn.id);
      });
    }

    list.appendChild(row);
  });
}

function deleteTransaction(txnId) {
  const txn = state.transactions.find(t => t.id === txnId);
  if (!txn) return;

  const txnLabel = `${txn.sign === '+' ? 'Deposit' : 'Withdrawal'} of ${formatINR(txn.amount)} — ${txn.purpose}`;
  confirmDelete(`Are you sure you want to delete this transaction?\n\n${txnLabel}`, () => {
    // Reverse-lookup account key from label
    const accountKey = Object.keys(ACCOUNT_LABELS).find(
      key => ACCOUNT_LABELS[key] === txn.account
    );

    if (accountKey) {
      // Reverse the balance change
      if (txn.sign === '+') {
        // Was a deposit — subtract it back
        if (state.banks[accountKey] !== undefined) state.banks[accountKey] -= txn.amount;
      } else {
        // Was a withdrawal — add it back
        if (state.banks[accountKey] !== undefined) state.banks[accountKey] += txn.amount;
      }

      // Reverse credit card impact
      if (state.credit[accountKey] !== undefined) {
        if (txn.sign === '-') state.credit[accountKey] -= txn.amount;
        else state.credit[accountKey] += txn.amount;
      }
    }

    // Reverse budget impact if the transaction tracked a budget
    const matchedBudget = state.budgets.find(b => b.name === txn.purpose);
    if (matchedBudget && txn.sign === '-') {
      matchedBudget.spent = Math.max(0, (matchedBudget.spent || 0) - txn.amount);
    }

    state.transactions = state.transactions.filter(t => t.id !== txnId);
    saveState();
    renderAll();
    addNotification('Transaction deleted & balances updated');
  });
}

// ─── RENDER: NET WEALTH ───────────────────────────────────

function renderNetWealth() {
  // Calculate TOTAL AVAILABLE from transaction history (sum of deposits)
  const totalAvailable = state.transactions
    .filter(t => t.sign === '+')
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculate TOTAL SPENT from transaction history (sum of withdrawals)
  const totalTxnSpent = state.transactions
    .filter(t => t.sign === '-')
    .reduce((sum, t) => sum + t.amount, 0);

  // Add budget total available (sum of all budget available = limit - spent)
  const budgetTotalAvailable = state.budgets
    .reduce((sum, b) => sum + ((b.limit || 0) - (b.spent || 0)), 0);

  const totalSpent = totalTxnSpent + budgetTotalAvailable;

  // Net Wealth = Total Available - Total Spent
  const netWealth = totalAvailable - totalSpent;

  const balanceAmountEl = document.querySelector('.balance-amount');
  if (balanceAmountEl) {
    balanceAmountEl.textContent = formatINR(netWealth);
    balanceAmountEl.style.color = netWealth >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  }

  const inflowEl = document.querySelector('.inflow-amount');
  if (inflowEl) inflowEl.textContent = '+ ' + formatINR(totalAvailable);

  const outflowEl = document.querySelector('.outflow-amount');
  if (outflowEl) outflowEl.textContent = '- ' + formatINR(totalSpent);

  // Update Target box
  const targetVal = state.netWealthTarget || 0;
  const targetRequiredDisplay = document.getElementById('targetRequiredDisplay');
  const targetAmountDisplay = document.getElementById('targetAmountDisplay');

  if (targetAmountDisplay) {
    targetAmountDisplay.textContent = formatINR(targetVal);
  }

  if (targetRequiredDisplay) {
    const required = targetVal - netWealth;
    if (required > 0) {
      targetRequiredDisplay.textContent = formatINR(required);
      targetRequiredDisplay.style.color = 'var(--accent-red)';
    } else {
      targetRequiredDisplay.textContent = '₹ 0 (ACHIEVED)';
      targetRequiredDisplay.style.color = 'var(--accent-green)';
    }
  }
}

// ─── RENDER: USER INFO ────────────────────────────────────

function renderUserInfo() {
  const username = localStorage.getItem('username') || 'User';
  const usernameEl = document.getElementById('username');
  const userIconEl = document.getElementById('userIcon');

  if (usernameEl) usernameEl.textContent = username;
  if (userIconEl) userIconEl.textContent = username.charAt(0).toUpperCase();
}

// ─── RENDER ALL ───────────────────────────────────────────

function renderAll() {
  renderBanks();
  renderCredit();
  renderBudgets();
  renderCustomers();
  renderP2P();
  renderTransactions();
  renderNetWealth();
  renderNotifications();
}

// ─── NOTIFICATIONS ────────────────────────────────────────

function addNotification(title) {
  const notif = {
    id: generateId(),
    title,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
  state.notifications.unshift(notif);
  if (state.notifications.length > 50) state.notifications.pop();
  saveState();
  renderNotifications();
}

function renderNotifications() {
  const list = document.getElementById('notificationList');
  const badge = document.getElementById('notificationBadge');
  const footerLink = document.getElementById('viewAllNotifications');
  if (!list) return;

  const isExpanded = list.dataset.expanded === 'true';
  const limit = isExpanded ? state.notifications.length : 5;
  const items = state.notifications.slice(0, limit);

  // Toggle footer link visibility
  if (footerLink && footerLink.parentElement) {
    if (state.notifications.length <= 5 || isExpanded) {
      footerLink.parentElement.style.display = 'none';
    } else {
      footerLink.parentElement.style.display = 'block';
    }
  }

  if (state.notifications.length === 0) {
    list.innerHTML = '<div style="padding:1rem; color:var(--text-muted); font-size:0.85rem; text-align:center;">[ NO NOTIFICATIONS ]</div>';
  } else {
    list.innerHTML = items.map(n => `
      <div class="notification-item">
        <div class="notification-title">${escapeHtml(n.title)}</div>
        <div class="notification-time">${escapeHtml(n.time)}</div>
      </div>
    `).join('');
  }

  if (badge) {
    const unreadCount = state.notifications.length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}

// ─── MODAL HELPERS ────────────────────────────────────────

function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.classList.add('active');
}

function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.classList.remove('active');
}

// ─── DELETE CONFIRMATION MODAL ────────────────────────────

let _deleteConfirmCallback = null;

function confirmDelete(message, onConfirm) {
  const overlay = document.getElementById('deleteConfirmOverlay');
  const msgEl = document.getElementById('deleteConfirmMessage');
  const modal = document.getElementById('deleteConfirmModal');

  if (!overlay) {
    // Fallback if modal doesn't exist
    if (confirm(message)) onConfirm();
    return;
  }

  if (msgEl) msgEl.textContent = message;
  _deleteConfirmCallback = onConfirm;

  overlay.classList.add('active');

  // Trigger shake animation
  if (modal) {
    modal.classList.remove('shake');
    void modal.offsetWidth; // Force reflow
    modal.classList.add('shake');
  }
}

function initDeleteConfirmModal() {
  const overlay = document.getElementById('deleteConfirmOverlay');
  const yesBtn = document.getElementById('deleteConfirmYes');
  const noBtn = document.getElementById('deleteConfirmNo');

  if (!overlay) return;

  function closeDeleteModal() {
    overlay.classList.remove('active');
    _deleteConfirmCallback = null;
  }

  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      if (_deleteConfirmCallback) {
        _deleteConfirmCallback();
      }
      closeDeleteModal();
    });
  }

  if (noBtn) {
    noBtn.addEventListener('click', () => {
      closeDeleteModal();
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDeleteModal();
    }
  });
}

// ─── MODAL: ADD PAYMENTS ──────────────────────────────────

function initAddPaymentsModal() {
  const openBtn = document.getElementById('addPaymentsBtn');
  const closeBtn = document.getElementById('closeTxnBtn');
  const overlay = document.getElementById('txnModalOverlay');
  const form = document.getElementById('txnForm');
  const purposeSel = document.getElementById('txnPurpose');
  const customGroup = document.getElementById('customPurposeGroup');
  const txnOriginSel = document.getElementById('txnOrigin');
  const dateInput = document.getElementById('txnDate');

  if (!openBtn || !form) return;

  // Set today's date as default
  if (dateInput) dateInput.value = today();

  openBtn.addEventListener('click', () => {
    if (dateInput) dateInput.value = today();
    openModal('txnModalOverlay');
  });

  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('txnModalOverlay');
    form.reset();
    if (customGroup) customGroup.classList.remove('visible');
    if (txnOriginSel) txnOriginSel.disabled = true;
  });

  // Close on overlay click
  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeModal('txnModalOverlay');
      form.reset();
      if (customGroup) customGroup.classList.remove('visible');
      if (txnOriginSel) txnOriginSel.disabled = true;
    }
  });

  // Show custom purpose field and manage destination dropdown
  if (purposeSel) {
    purposeSel.addEventListener('change', () => {
      const val = purposeSel.value;

      // Custom purpose text input
      if (customGroup) {
        if (val === 'others') {
          customGroup.classList.add('visible');
        } else {
          customGroup.classList.remove('visible');
        }
      }

      // Enable/configure destination select
      if (txnOriginSel) {
        txnOriginSel.disabled = false;

        // Show/hide optgroups based on purpose
        const optLiquid = document.getElementById('opt-liquid');
        const optCredit = document.getElementById('opt-credit');

        // Reset all to visible first
        if (optLiquid) optLiquid.style.display = '';
        if (optCredit) optCredit.style.display = '';

        // Filter based on selected purpose
        if (val === 'billpayments') {
          // Bill Payments [Credit Lines] → Show only Credit Lines
          if (optLiquid) optLiquid.style.display = 'none';
          if (optCredit) optCredit.style.display = '';
        } else if (val === 'deposit') {
          // Deposit [Bank Accounts] → Show only Bank Accounts
          if (optLiquid) optLiquid.style.display = '';
          if (optCredit) optCredit.style.display = 'none';
        } else if (val === 'others') {
          // Others → Show Bank Accounts, Credit Lines
          if (optLiquid) optLiquid.style.display = '';
          if (optCredit) optCredit.style.display = '';
        }

        txnOriginSel.value = '';
      }
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();

    const date = document.getElementById('txnDate').value;
    const amount = parseFloat(document.getElementById('txnAmount').value);
    const purpose = purposeSel ? purposeSel.value : '';
    const custom = document.getElementById('txnCustomPurpose')?.value?.trim();
    const account = txnOriginSel ? txnOriginSel.value : '';

    if (!date || isNaN(amount) || amount <= 0 || !purpose || !account) {
      showFormError(form, 'Please fill in all required fields correctly.');
      return;
    }

    if (purpose === 'others' && !custom) {
      showFormError(form, 'Please specify the details for this transaction.');
      return;
    }

    const purposeLabel = getPurposeLabel(purpose, custom);
    const accountLabel = ACCOUNT_LABELS[account] || account;

    // Apply state changes
    applyPayment(purpose, account, amount);

    // Log transaction
    const txn = {
      id: generateId(),
      date,
      type: getTxnType(purpose),
      purpose: purposeLabel,
      account: accountLabel,
      amount,
      sign: getTxnSign(purpose),
      _ts: Date.now(),
    };
    state.transactions.push(txn);
    saveState();

    renderAll();
    addNotification(`${purposeLabel} — ${formatINR(amount)}`);
    closeModal('txnModalOverlay');
    form.reset();
    if (customGroup) customGroup.classList.remove('visible');
    if (txnOriginSel) txnOriginSel.disabled = true;
  });
}

function applyPayment(purpose, account, amount) {
  switch (purpose) {
    case 'deposit':
      // Add money to a bank account
      if (state.banks[account] !== undefined) {
        state.banks[account] += amount;
      }
      break;

    case 'billpayments':
      // Bill payment to credit card - transaction is recorded with '+' sign
      // Credit outstanding is calculated from transaction history
      break;


    default:
      // others — treat as inflow to the selected account
      if (state.banks[account] !== undefined) {
        state.banks[account] += amount;
      } else if (state.credit[account] !== undefined) {
        state.credit[account] += amount;
      }
  }
}

function getTxnType(purpose) {
  const map = {
    billpayments: 'DEPOSIT',
    deposit: 'DEPOSIT',

    others: 'DEPOSIT',
  };
  return map[purpose] || 'DEPOSIT';
}

function getTxnSign(purpose) {
  return '+';
}

function getPurposeLabel(purpose, custom) {
  const map = {
    billpayments: 'Bill Payment',
    deposit: 'Deposit',

    others: custom || 'Others',
  };
  return map[purpose] || purpose;
}

// ─── MODAL: LOG SPENTS ────────────────────────────────────

function initSpentsModal() {
  const openBtn = document.getElementById('spentsBtn');
  const closeBtn = document.getElementById('closeSpentsBtn');
  const overlay = document.getElementById('spentsModalOverlay');
  const form = document.getElementById('spentsForm');
  const detailsSel = document.getElementById('paymentsdetails');
  const customGroup = document.getElementById('spentsCustomPurposeGroup');
  const dateInput = document.getElementById('spentsDate');

  if (!openBtn || !form) return;

  if (dateInput) dateInput.value = today();

  openBtn.addEventListener('click', () => {
    if (dateInput) dateInput.value = today();
    openModal('spentsModalOverlay');
  });

  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('spentsModalOverlay');
    form.reset();
    if (customGroup) customGroup.classList.remove('visible');
  });

  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeModal('spentsModalOverlay');
      form.reset();
      if (customGroup) customGroup.classList.remove('visible');
    }
  });

  if (detailsSel) {
    detailsSel.addEventListener('change', () => {
      if (customGroup) {
        if (detailsSel.value === 'others') {
          customGroup.classList.add('visible');
        } else {
          customGroup.classList.remove('visible');
        }
      }
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();

    const date = document.getElementById('spentsDate').value;
    const amount = parseFloat(document.getElementById('spentsAmount').value);
    const category = detailsSel ? detailsSel.value : 'others';
    const custom = document.getElementById('spentsCustomPurpose')?.value?.trim();
    const bankKey = document.getElementById('spentsBank').value;

    if (!date || isNaN(amount) || amount <= 0 || !bankKey || !category) {
      showFormError(form, 'Please fill in all required fields correctly.');
      return;
    }

    if (category === 'others' && !custom) {
      showFormError(form, 'Please specify the details for this transaction.');
      return;
    }

    // Determine label for the category
    let categoryLabel = category;

    if (detailsSel && detailsSel.options[detailsSel.selectedIndex]) {
      categoryLabel = detailsSel.options[detailsSel.selectedIndex].text;
    }

    if (category.startsWith('budget_')) {
      const budgetId = category.replace('budget_', '');
      const budget = state.budgets.find(b => b.id === budgetId);
      if (budget) {
        categoryLabel = budget.name;
        budget.spent = (budget.spent || 0) + amount;
      }
    } else if (category === 'others') {
      categoryLabel = custom ? custom : 'Others';
    }

    const bankLabel = ACCOUNT_LABELS[bankKey] || bankKey;

    // Deduct from the appropriate account
    if (state.banks[bankKey] !== undefined) {
      state.banks[bankKey] -= amount;
    }
    // Credit card spending is tracked via transaction history

    // Log transaction
    const txn = {
      id: generateId(),
      date,
      type: 'WITHDRAWAL',
      purpose: categoryLabel,
      account: bankLabel,
      amount,
      sign: '-',
      _ts: Date.now(),
    };
    state.transactions.push(txn);
    saveState();

    renderAll();
    addNotification(`Spent ${formatINR(amount)} on ${categoryLabel}`);
    closeModal('spentsModalOverlay');
    form.reset();
    if (customGroup) customGroup.classList.remove('visible');
  });
}

// ─── MODAL: CUSTOMER ──────────────────────────────────────

function initCustomerModal() {
  const openBtn = document.getElementById('p2pBtn');
  const closeBtn = document.getElementById('closeCustomerBtn');
  const overlay = document.getElementById('customerModalOverlay');
  const form = document.getElementById('customerForm');

  if (!openBtn || !form) return;

  openBtn.addEventListener('click', () => openModal('customerModalOverlay'));

  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('customerModalOverlay');
    form.reset();
  });

  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeModal('customerModalOverlay');
      form.reset();
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const name = document.getElementById('customerPersonName').value.trim();
    const phone = document.getElementById('customerPhoneNumber').value.trim();

    if (!name || !phone) {
      showFormError(form, 'Please fill in all required fields.');
      return;
    }

    const customer = {
      id: generateId(),
      name,
      phoneNumber: phone,
      youGave: 0,
      youGot: 0,
    };

    state.customers.push(customer);
    saveState();
    renderCustomers();
    addNotification(`Customer added: ${name}`);
    closeModal('customerModalOverlay');
    form.reset();
  });
}

function renderCustomers() {
  const list = document.getElementById('customersList');
  const empty = document.getElementById('noCustomers');
  if (!list) return;

  list.innerHTML = '';

  if (state.customers.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  state.customers.forEach(customer => {
    const row = document.createElement('div');
    row.className = 'customer-item';
    row.dataset.id = customer.id;

    const net = customer.youGave - customer.youGot;
    const netClass = net > 0 ? 'pos' : net < 0 ? 'neg' : '';

    row.innerHTML = `
      <div class="customer-info">
        <div class="customer-header">
          <div class="customer-details">
            <span class="label">${escapeHtml(customer.name)}</span>
            <div class="customer-phone">📱 ${escapeHtml(customer.phoneNumber)}</div>
          </div>
          <div class="customer-balance ${netClass}">${formatINR(Math.abs(net))}</div>
        </div>
        <div class="customer-actions">
          <button class="customer-action-btn gave-btn" data-id="${customer.id}" title="You Gave">⚡ You Gave</button>
          <button class="customer-action-btn got-btn" data-id="${customer.id}" title="You Got">💰 You Got</button>
        </div>
        <div class="customer-delete-section">
          <button class="customer-delete-btn" data-id="${customer.id}" title="Delete Customer">🗑️ Delete</button>
        </div>
      </div>
    `;

    const gaveBtn = row.querySelector('.gave-btn');
    const gotBtn = row.querySelector('.got-btn');
    const deleteBtn = row.querySelector('.customer-delete-btn');

    if (gaveBtn) gaveBtn.addEventListener('click', () => openCustomerAmountModal(customer.id, 'youGave'));
    if (gotBtn) gotBtn.addEventListener('click', () => openCustomerAmountModal(customer.id, 'youGot'));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteCustomer(customer.id));

    list.prepend(row);
  });
}

function deleteCustomer(customerId) {
  const customer = state.customers.find(c => c.id === customerId);
  const customerName = customer ? customer.name : 'this customer';
  confirmDelete(`Are you sure you want to delete customer "${customerName}"? All associated transactions will also be removed.`, () => {
    state.customers = state.customers.filter(c => c.id !== customerId);
    state.transactions = state.transactions.filter(t => {
      const purpose = t.purpose || '';
      return !purpose.includes(`Customer`) || !purpose.includes(state.customers.find(c => c.id === customerId)?.name || '');
    });
    saveState();
    renderCustomers();
    renderTransactions();
    renderNetWealth();
    addNotification('Customer deleted');
  });
}

let currentCustomerId = null;
let currentCustomerAmountType = null;

function initCustomerAmountModals() {
  const closeBtn = document.getElementById('closeCustomerAmountBtn');
  const overlay = document.getElementById('customerAmountModalOverlay');
  const form = document.getElementById('customerAmountForm');

  if (form) {
    if (closeBtn) closeBtn.addEventListener('click', () => {
      closeModal('customerAmountModalOverlay');
      form.reset();
    });

    if (overlay) overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal('customerAmountModalOverlay');
        form.reset();
      }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();

      const date = document.getElementById('customerAmountDate').value;
      const amount = parseFloat(document.getElementById('customerAmountValue').value);
      const description = document.getElementById('customerAmountDescription').value.trim();

      if (!date) {
        showFormError(form, 'Please select a date.');
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        showFormError(form, 'Please enter a valid amount.');
        return;
      }

      const customer = state.customers.find(c => c.id === currentCustomerId);
      if (customer) {
        if (currentCustomerAmountType === 'youGave') {
          customer.youGave = (customer.youGave || 0) + amount;

          state.transactions.push({
            id: generateId(),
            date: date,
            type: 'Deposit',
            purpose: `You Gave - ${customer.name}${description ? ' - ' + description : ''}`,
            account: customer.name,
            amount: amount,
            sign: '+',
            _ts: Date.now(),
          });

          addNotification(`You Gave ₹${formatINR(amount)}${description ? ' - ' + description : ''}`);
        } else if (currentCustomerAmountType === 'youGot') {
          customer.youGot = (customer.youGot || 0) + amount;

          state.transactions.push({
            id: generateId(),
            date: date,
            type: 'Withdrawal',
            purpose: `You Got - ${customer.name}${description ? ' - ' + description : ''}`,
            account: customer.name,
            amount: amount,
            sign: '-',
            _ts: Date.now(),
          });

          addNotification(`You Got ₹${formatINR(amount)}${description ? ' - ' + description : ''}`);
        }

        saveState();
        renderCustomers();
        renderTransactions();
        renderNetWealth();
        closeModal('customerAmountModalOverlay');
        form.reset();
      }
    });
  }
}

function openCustomerAmountModal(customerId, type) {
  currentCustomerId = customerId;
  currentCustomerAmountType = type;

  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) return;

  const modalTitle = document.getElementById('customerAmountModalTitle');
  if (modalTitle) {
    modalTitle.textContent = type === 'youGave' ? '[ You Gave ]' : '[ You Got ]';
  }

  // Set today's date as default
  const dateInput = document.getElementById('customerAmountDate');
  if (dateInput) dateInput.value = today();

  openModal('customerAmountModalOverlay');
}

// ─── MODAL: RESET DASHBOARD ───────────────────────────────

function initResetModal() {
  const openBtn = document.getElementById('resetDashboardBtn');
  const closeBtn = document.getElementById('closeResetBtn');
  const overlay = document.getElementById('resetModalOverlay');
  const form = document.getElementById('resetForm');

  if (!openBtn || !form) return;

  openBtn.addEventListener('click', () => openModal('resetModalOverlay'));

  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('resetModalOverlay');
    form.reset();
  });

  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeModal('resetModalOverlay');
      form.reset();
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const pwInput = document.getElementById('resetPassword');
    const email = localStorage.getItem('email');

    if (!pwInput || !pwInput.value) {
      showFormError(form, 'Please enter your password to confirm.');
      return;
    }

    if (!email) {
      showFormError(form, 'Authentication error: User email not found.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '[ AUTHENTICATING... ]';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pwInput.value })
      });

      const data = await response.json();

      if (!response.ok) {
        showFormError(form, data.error || 'Authentication failed. Incorrect password.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }

      // Authentication successful: Wipe financial state but keep auth data
      state = getDefaultState();
      saveState();

      renderAll();
      addNotification('Dashboard has been reset');
      closeModal('resetModalOverlay');
      form.reset();

      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;

    } catch (err) {
      showFormError(form, 'Connection error connecting to server.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
}

// ─── TRANSACTION SEARCH ─────────────────────────────────────

function initTransactionSearch() {
  const searchInput = document.getElementById('txnSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTransactions();
    });
  }
}

// ─── MODAL: BUDGET CREATE ─────────────────────────────────

function initBudgetCreateModal() {
  const openBtn = document.getElementById('setBudgetBtn');
  const closeBtn = document.getElementById('closeBudgetCreateBtn');
  const overlay = document.getElementById('budgetCreateModalOverlay');
  const form = document.getElementById('budgetCreateForm');

  if (!form) return;

  if (openBtn) openBtn.addEventListener('click', () => openModal('budgetCreateModalOverlay'));

  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('budgetCreateModalOverlay');
    form.reset();
  });

  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeModal('budgetCreateModalOverlay');
      form.reset();
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const name = document.getElementById('budgetName').value.trim();
    const limit = parseFloat(document.getElementById('budgetTotalLimit').value);

    if (!name) {
      showFormError(form, 'Please enter a name for the budget.');
      return;
    }
    if (isNaN(limit) || limit <= 0) {
      showFormError(form, 'Please enter a valid limit amount.');
      return;
    }

    const budget = {
      id: generateId(),
      name,
      limit,
      spent: 0,
    };

    state.budgets.push(budget);
    saveState();
    renderBudgets();
    addNotification(`Budget added: ${name}`);
    closeModal('budgetCreateModalOverlay');
    form.reset();
  });
}

// ─── MODAL: BUDGET SPENT ──────────────────────────────────

function initBudgetSpentModal() {
  const closeBtn = document.getElementById('closeBudgetSpentBtn');
  const overlay = document.getElementById('budgetSpentModalOverlay');
  const form = document.getElementById('budgetSpentForm');

  if (!form) return;

  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('budgetSpentModalOverlay');
    form.reset();
  });

  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeModal('budgetSpentModalOverlay');
      form.reset();
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('budgetSpentAmount').value);

    if (isNaN(amount) || amount <= 0) {
      showFormError(form, 'Please enter a valid amount.');
      return;
    }

    const budget = state.budgets.find(b => b.id === currentBudgetSpentId);
    if (budget) {
      budget.spent = (budget.spent || 0) + amount;
      saveState();
      renderBudgets();
      renderNetWealth();
      addNotification(`Spent ${formatINR(amount)} on ${budget.name}`);
    }

    closeModal('budgetSpentModalOverlay');
    form.reset();
  });
}

// ─── MODAL: BUDGET LIMIT INCREASE ─────────────────────────

function initBudgetLimitModal() {
  const closeBtn = document.getElementById('closeBudgetLimitBtn');
  const overlay = document.getElementById('budgetLimitModalOverlay');
  const form = document.getElementById('budgetLimitForm');

  if (!form) return;

  if (closeBtn) closeBtn.addEventListener('click', () => {
    closeModal('budgetLimitModalOverlay');
    form.reset();
  });

  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeModal('budgetLimitModalOverlay');
      form.reset();
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const increase = parseFloat(document.getElementById('budgetLimitIncrease').value);

    if (isNaN(increase) || increase <= 0) {
      showFormError(form, 'Please enter a valid amount.');
      return;
    }

    const budget = state.budgets.find(b => b.id === currentBudgetLimitId);
    if (budget) {
      budget.limit = (budget.limit || 0) + increase;
      saveState();
      renderBudgets();
      renderNetWealth();
      addNotification(`Limit increased by ${formatINR(increase)} for ${budget.name}`);
    }

    closeModal('budgetLimitModalOverlay');
    form.reset();
  });
}

// ─── BANK ACTION BUTTONS: QUICK DEPOSIT/WITHDRAW ────────────

function initBankActionButtons() {
  const buttons = document.querySelectorAll('.bank-action-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action; // 'deposit' or 'withdraw'
      const bank = btn.dataset.bank;

      if (!action || !bank) return;

      openQuickTxnModal(action, bank);
    });
  });
}

function openQuickTxnModal(action, bank) {
  const modalTitle = document.getElementById('quickTxnModalTitle');
  const dateInput = document.getElementById('quickTxnDate');
  const form = document.getElementById('quickTxnForm');

  if (!modalTitle || !form) return;

  // Set modal title based on action
  modalTitle.textContent = action === 'deposit' ? '[ Quick Deposit ]' : '[ Quick Withdraw ]';

  // Set today's date
  if (dateInput) dateInput.value = today();

  // Store the current action and bank in form data attributes
  form.dataset.action = action;
  form.dataset.bank = bank;

  openModal('quickTxnModalOverlay');
}

function initQuickTxnForm() {
  const form = document.getElementById('quickTxnForm');
  const closeBtn = document.getElementById('closeQuickTxnBtn');
  const overlay = document.getElementById('quickTxnModalOverlay');

  if (!form) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeModal('quickTxnModalOverlay');
      form.reset();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal('quickTxnModalOverlay');
        form.reset();
      }
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();

    const date = document.getElementById('quickTxnDate').value;
    const amount = parseFloat(document.getElementById('quickTxnAmount').value);
    const description = document.getElementById('quickTxnDescription')?.value?.trim();
    const action = form.dataset.action;
    const bank = form.dataset.bank;

    if (!date || isNaN(amount) || amount <= 0 || !action || !bank) {
      showFormError(form, 'Please fill in all required fields correctly.');
      return;
    }

    // Determine the purpose and sign
    let purpose = action === 'deposit' ? 'Quick Deposit' : 'Quick Withdrawal';
    if (description) {
      purpose += ` - ${description}`;
    }

    const accountLabel = ACCOUNT_LABELS[bank] || bank;

    // Apply state changes
    if (action === 'deposit') {
      state.banks[bank] = (state.banks[bank] || 0) + amount;
    } else {
      state.banks[bank] = (state.banks[bank] || 0) - amount;
    }

    // Log transaction
    const txn = {
      id: generateId(),
      date,
      type: action === 'deposit' ? 'DEPOSIT' : 'WITHDRAWAL',
      purpose: purpose,
      account: accountLabel,
      amount,
      sign: action === 'deposit' ? '+' : '-',
      _ts: Date.now(),
    };

    state.transactions.push(txn);

    saveState();
    renderAll();
    addNotification(`${action === 'deposit' ? 'Deposit' : 'Withdrawal'} of ₹ ${formatINR(amount).replace('₹ ', '')} recorded`);
    closeModal('quickTxnModalOverlay');
    form.reset();
  });
}

// ─── NOTIFICATIONS UI ─────────────────────────────────────

function initNotifications() {
  const bell = document.getElementById('notificationBell');
  const dropdown = document.getElementById('notificationDropdown');
  const closeBtn = document.getElementById('closeNotifications');

  if (!bell || !dropdown) return;

  bell.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
  });

  if (closeBtn) closeBtn.addEventListener('click', () => {
    dropdown.classList.remove('active');
  });

  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.remove('active');
    }
  });

  const viewAll = document.getElementById('viewAllNotifications');
  if (viewAll) viewAll.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const list = document.getElementById('notificationList');
    if (list) {
      list.dataset.expanded = 'true';
      renderNotifications();
    }
  });

  const clearAll = document.getElementById('clearNotifications');
  if (clearAll) clearAll.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    state.notifications = [];
    saveState();

    // Reset view bounds as well
    const list = document.getElementById('notificationList');
    if (list) {
      list.dataset.expanded = 'false';
    }

    renderNotifications();
  });
}

// ─── LOGOUT ───────────────────────────────────────────────

function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('email');
    localStorage.removeItem('username');
    localStorage.removeItem('dhankosh_state');
    window.location.href = '../pages/login.html';
  });
}

// ─── TARGET MODAL ─────────────────────────────────────────

function initTargetModal() {
  const openBtn = document.getElementById('editTargetBtn');
  const closeBtn = document.getElementById('closeTargetBtn');
  const overlay = document.getElementById('targetModalOverlay');
  const form = document.getElementById('targetForm');

  if (!form || !openBtn) return;

  openBtn.addEventListener('click', () => {
    const inputAmount = document.getElementById('targetInputAmount');
    if (inputAmount) inputAmount.value = state.netWealthTarget || '';
    openModal('targetModalOverlay');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeModal('targetModalOverlay');
      form.reset();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal('targetModalOverlay');
        form.reset();
      }
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('targetInputAmount').value);

    if (isNaN(amount) || amount < 0) {
      showFormError(form, 'Please enter a valid target amount.');
      return;
    }

    state.netWealthTarget = amount;
    saveState();
    renderNetWealth();
    addNotification(`Wealth target updated to ${formatINR(amount)}`);

    closeModal('targetModalOverlay');
    form.reset();
  });
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────

function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Escape closes any open modal
    if (e.key === 'Escape') {
      ['txnModalOverlay', 'spentsModalOverlay', 'p2pModalOverlay', 'resetModalOverlay',
        'budgetCreateModalOverlay', 'budgetSpentModalOverlay', 'budgetLimitModalOverlay',
        'deleteConfirmOverlay', 'targetModalOverlay'].forEach(id => {
          closeModal(id);
        });
      _deleteConfirmCallback = null;
      const notifDropdown = document.getElementById('notificationDropdown');
      if (notifDropdown) notifDropdown.classList.remove('active');
    }
  });
}

// ─── UTILITY: XSS PREVENTION ──────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── UTILITY: INLINE FORM ERRORS ─────────────────────────

function showFormError(form, message) {
  let errEl = form.querySelector('.txn-error-msg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'txn-error-msg';
    errEl.style.cssText = `
      color: var(--accent-red);
      font-size: 0.8rem;
      margin-bottom: 1rem;
      padding: 0.5rem;
      border: 1px solid var(--accent-red);
      background: rgba(255,61,0,0.08);
    `;
    form.insertBefore(errEl, form.firstChild);
  }
  errEl.textContent = message;
  setTimeout(() => { if (errEl.parentNode) errEl.remove(); }, 3000);
}

// ─── AUTH GUARD ───────────────────────────────────────────

function checkAuth() {
  const token = localStorage.getItem('authToken');
  if (!token || !token.startsWith('eyJ')) {
    // No token or not a valid JWT format
    localStorage.removeItem('authToken');
    window.location.href = '../pages/login.html';
    return false;
  }
  return true;
}

// ─── INIT ─────────────────────────────────────────────────

let dbConnected = false;

function updateSystemStatus() {
  const statusEl = document.getElementById('systemStatus');
  if (statusEl) {
    if (dbConnected) {
      statusEl.textContent = '[ SYSTEM ACTIVE : DATABASE CONNECTED ]';
    } else {
      statusEl.textContent = '[ SYSTEM ACTIVE : SYSTEMS OFFLINE ]';
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;

  initializeParticles();
  renderUserInfo();

  // Render with local cache first (instant)
  renderAll();

  // Then load latest state from MongoDB server
  const serverState = await loadStateFromServer();
  if (serverState) {
    dbConnected = true;
    state = serverState;
    // Update local cache with server data
    localStorage.setItem('dhankosh_state', JSON.stringify(state));
    // Re-render with server data
    renderAll();
  } else {
    dbConnected = false;
  }

  // Update system status display
  updateSystemStatus();

  // Initialize all modal forms and event listeners
  initAddPaymentsModal();
  initSpentsModal();
  initQuickTxnForm();
  initBankActionButtons();
  initCustomerModal();
  initCustomerAmountModals();
  initResetModal();
  initBudgetCreateModal();
  initBudgetSpentModal();
  initBudgetLimitModal();
  initNotifications();
  initLogout();
  initDeleteConfirmModal();
  initKeyboardShortcuts();
  initTransactionSearch();
  initTargetModal();
});
