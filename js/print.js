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
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">[ NO TRANSACTIONS FOUND IN LEDGER ]</td></tr>';
    return;
  }

  // Populate Accounts Dropdown dynamically (Sorted & Grouped)
  const bankNames = (state.banks || []).map(b => `${b.name} (${b.accNo})`).sort();
  if (bankNames.length > 0) {
    const optgroupBanks = document.createElement('optgroup');
    optgroupBanks.label = "Bank Accounts";
    bankNames.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc;
      opt.textContent = acc;
      optgroupBanks.appendChild(opt);
    });
    accountSelect.appendChild(optgroupBanks);
  }

  const creditNames = (state.credit || []).map(c => `${c.name} (${c.last4})`).sort();
  if (creditNames.length > 0) {
    const optgroupCredit = document.createElement('optgroup');
    optgroupCredit.label = "Credit Cards";
    creditNames.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc;
      opt.textContent = acc;
      optgroupCredit.appendChild(opt);
    });
    accountSelect.appendChild(optgroupCredit);
  }

  const customerNames = (state.customers || []).map(c => c.name).sort();
  if (customerNames.length > 0) {
    const optgroupCustomers = document.createElement('optgroup');
    optgroupCustomers.label = "Customers";
    customerNames.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc;
      opt.textContent = acc;
      optgroupCustomers.appendChild(opt);
    });
    accountSelect.appendChild(optgroupCustomers);
  }

  // Include any other accounts present in transactions that are missing from current state
  const knownAccounts = new Set([...bankNames, ...creditNames, ...customerNames]);
  const otherAccounts = [...new Set((state.transactions || []).map(t => t.account).filter(a => a && !knownAccounts.has(a)))].sort();
  if (otherAccounts.length > 0) {
    const optgroupOther = document.createElement('optgroup');
    optgroupOther.label = "Other Accounts";
    otherAccounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc;
      opt.textContent = acc;
      optgroupOther.appendChild(opt);
    });
    accountSelect.appendChild(optgroupOther);
  }

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

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('q')) {
    const query = urlParams.get('q').toLowerCase();
    
    setupOverlay.style.setProperty('display', 'none', 'important');
    statementContent.style.setProperty('display', 'block', 'important');
    
    filterText.textContent = query ? `Search Query: "${urlParams.get('q')}"` : 'All Transactions';
    
    let filteredTrans = state.transactions;
    if (query) {
      filteredTrans = filteredTrans.filter(txn => {
        const typeDisplay = txn.sign === '+' ? 'deposit' : 'withdraw';
        const searchString = `${txn.id} ${txn.date} ${typeDisplay} ${txn.amount} ${txn.purpose} ${txn.remark || ''} ${txn.account}`.toLowerCase();
        return searchString.includes(query);
      });
    }

    if (filteredTrans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">[ NO TRANSACTIONS MATCHING SEARCH ]</td></tr>';
      return;
    }

    const chronological = [...filteredTrans].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a._ts || 0) - (b._ts || 0);
    });

    let runningBalance = 0;
    const withBalance = chronological.map(txn => {
      const isDeposit = txn.sign === '+';
      runningBalance += isDeposit ? txn.amount : -txn.amount;
      return { ...txn, balance: runningBalance };
    });

    const sortedTrans = withBalance.reverse();

    let totalD = 0;
    let totalW = 0;

    tbody.innerHTML = sortedTrans.map(txn => {
      const isDeposit = txn.sign === '+';
      const typeDisplay = isDeposit ? 'Deposit' : 'Withdraw';
      const balClass = txn.balance >= 0 ? 'pos' : 'neg';
      const balSign  = txn.balance >= 0 ? '' : '-';

      if (isDeposit) totalD += txn.amount;
      else totalW += txn.amount;

      return `
        <tr>
          <td>${formatDateDisplay(txn.date)}</td>
          <td style="font-family: monospace;">${txn.id.substring(0, 8)}</td>
          <td>${typeDisplay}</td>
          <td>${txn.purpose || '—'}</td>
          <td>${txn.remark || '—'}</td>
          <td>${txn.account || '—'}</td>
          <td class="amount ${isDeposit ? 'pos' : 'neg'}">${isDeposit ? '+' : '-'} ${formatINR(txn.amount)}</td>
          <td class="amount balance-col ${balClass}">${balSign}${formatINR(Math.abs(txn.balance))}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('totalDeposits').textContent = '+ ' + formatINR(totalD);
    document.getElementById('totalWithdrawals').textContent = '- ' + formatINR(totalW);

    setTimeout(() => {
      window.print();
    }, 500);
    
    return;
  }

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
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">[ NO TRANSACTIONS MATCHING FILTER ]</td></tr>';
      return;
    }

    // Sort OLDEST → NEWEST first to correctly accumulate running balance
    const chronological = [...filteredTrans].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a._ts || 0) - (b._ts || 0);
    });

    // Compute running balance for each transaction (oldest→newest)
    let runningBalance = 0;
    const withBalance = chronological.map(txn => {
      const isDeposit = txn.sign === '+';
      runningBalance += isDeposit ? txn.amount : -txn.amount;
      return { ...txn, balance: runningBalance };
    });

    // Reverse to display NEWEST → OLDEST in the table
    const sortedTrans = withBalance.reverse();

    let totalD = 0;
    let totalW = 0;

    tbody.innerHTML = sortedTrans.map(txn => {
      const isDeposit = txn.sign === '+';
      const typeDisplay = isDeposit ? 'Deposit' : 'Withdraw';
      const balClass = txn.balance >= 0 ? 'pos' : 'neg';
      const balSign  = txn.balance >= 0 ? '' : '-';

      if (isDeposit) totalD += txn.amount;
      else totalW += txn.amount;

      return `
        <tr>
          <td>${formatDateDisplay(txn.date)}</td>
          <td style="font-family: monospace;">${txn.id.substring(0, 8)}</td>
          <td>${typeDisplay}</td>
          <td>${txn.purpose || '—'}</td>
          <td>${txn.remark || '—'}</td>
          <td>${txn.account || '—'}</td>
          <td class="amount ${isDeposit ? 'pos' : 'neg'}">${isDeposit ? '+' : '-'} ${formatINR(txn.amount)}</td>
          <td class="amount balance-col ${balClass}">${balSign}${formatINR(Math.abs(txn.balance))}</td>
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
