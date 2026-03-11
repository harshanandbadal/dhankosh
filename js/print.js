/* =========================================================
   DHANKOSH TERMINAL — print.js
   Logic to load local state and populate the print template
   ========================================================= */

'use strict';

function loadState() {
  try {
    const raw = localStorage.getItem('dhankosh_state');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function formatINR(amount) {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return '₹ ' + formatted;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

document.addEventListener('DOMContentLoaded', () => {
  const state = loadState();
  const username = localStorage.getItem('username') || 'Authorized User';

  document.getElementById('printUsername').textContent = username;
  document.getElementById('printDate').textContent = new Date().toLocaleString('en-IN');

  const setupOverlay = document.getElementById('setupOverlay');
  const statementContent = document.getElementById('statementContent');
  const accountSelect = document.getElementById('accountSelect');
  const paymentDetailsSelect = document.getElementById('paymentDetailsSelect');
  const setupForm = document.getElementById('setupForm');
  const tbody = document.getElementById('printTableBody');
  const filterText = document.getElementById('statementAccountFilter');

  if (!state || !state.transactions || state.transactions.length === 0) {
    setupOverlay.style.display = 'none';
    statementContent.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">[ NO TRANSACTIONS FOUND IN LEDGER ]</td></tr>';
    return;
  }

  // Populate Accounts Dropdown dynamically
  const uniqueAccounts = [...new Set(state.transactions.map(t => t.account).filter(a => a))].sort();
  uniqueAccounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc;
    opt.textContent = acc;
    accountSelect.appendChild(opt);
  });

  // Populate Payment Details Dropdown dynamically
  const uniquePaymentDetails = [...new Set(state.transactions.map(t => t.purpose).filter(p => p))].sort();
  uniquePaymentDetails.forEach(purpose => {
    const opt = document.createElement('option');
    opt.value = purpose;
    opt.textContent = purpose;
    if (paymentDetailsSelect) {
      paymentDetailsSelect.appendChild(opt);
    }
  });

  // Force show setup overlay initially
  setupOverlay.style.setProperty('display', 'flex', 'important');
  statementContent.style.setProperty('display', 'none', 'important');

  // Handle form submission
  setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedAccount = accountSelect.value;
    const selectedPaymentDetails = paymentDetailsSelect ? paymentDetailsSelect.value : 'ALL';

    // Switch views
    setupOverlay.style.setProperty('display', 'none', 'important');
    statementContent.style.setProperty('display', 'block', 'important');

    const accountText = selectedAccount === 'ALL' ? 'All Accounts (Consolidated)' : selectedAccount;
    const paymentText = selectedPaymentDetails === 'ALL' ? 'All Payment Details' : selectedPaymentDetails;
    filterText.textContent = `Account: ${accountText} | Payment Details: ${paymentText}`;

    // Filter transactions
    let filteredTrans = state.transactions;
    if (selectedAccount !== 'ALL') {
      filteredTrans = filteredTrans.filter(t => t.account === selectedAccount);
    }
    if (selectedPaymentDetails !== 'ALL') {
      filteredTrans = filteredTrans.filter(t => t.purpose === selectedPaymentDetails);
    }

    if (filteredTrans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">[ NO TRANSACTIONS MATCHING FILTER ]</td></tr>';
      return;
    }

    // Sort newest first
    const sortedTrans = filteredTrans.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b._ts || 0) - (a._ts || 0);
    });

    let totalD = 0;
    let totalW = 0;

    tbody.innerHTML = sortedTrans.map(txn => {
      const isDeposit = txn.sign === '+';
      let typeDisplay = isDeposit ? 'Deposit' : 'Withdraw';

      if (isDeposit) totalD += txn.amount;
      else totalW += txn.amount;

      return `
        <tr>
          <td>${formatDateDisplay(txn.date)}</td>
          <td style="font-family: monospace;">${txn.id.substring(0, 8)}</td>
          <td>${typeDisplay}</td>
          <td>${txn.purpose || '—'}</td>
          <td>${txn.account || '—'}</td>
          <td class="amount ${isDeposit ? 'pos' : 'neg'}">${isDeposit ? '+' : '-'} ${formatINR(txn.amount)}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('totalDeposits').textContent = '+ ' + formatINR(totalD);
    document.getElementById('totalWithdrawals').textContent = '- ' + formatINR(totalW);

    // Briefly delay then trigger print
    setTimeout(() => {
      window.print();
    }, 500);
  });
});
