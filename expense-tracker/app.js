/* =====================================================
   EXPENSE & BUDGET VISUALIZER — app.js
   Features:
   - Add / Delete transactions (income & expense)
   - LocalStorage persistence
   - Chart.js Pie Chart (auto-update)
   - Dark / Light Mode toggle
   - Monthly Summary with prev/next navigation
   - Sort transactions (date, amount, category)
   - Custom categories
   - Budget warning
   ===================================================== */

'use strict';

/* ─── CONSTANTS ──────────────────────────────────────── */
const STORAGE_KEY      = 'ebv_transactions';
const CATEGORIES_KEY   = 'ebv_categories';
const THEME_KEY        = 'ebv_theme';
const BUDGET_KEY       = 'ebv_budget';

const CHART_COLORS = [
  '#6366f1','#f43f5e','#10b981','#f59e0b','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4',
  '#84cc16','#a855f7','#ef4444','#22c55e','#eab308',
];

const DEFAULT_CATEGORIES = ['Makanan','Transportasi','Hiburan','Belanja','Kesehatan','Pendidikan','Tagihan','Lainnya'];

const CATEGORY_ICONS = {
  makanan:      '🍔', transportasi: '🚗', hiburan:    '🎮',
  belanja:      '🛍️', kesehatan:   '💊', pendidikan: '📚',
  tagihan:      '📄', lainnya:      '💰', income:     '💵',
};

/* ─── STATE ──────────────────────────────────────────── */
let transactions = [];
let categories   = [];
let budgetLimit  = 0;
let currentMonth = new Date(); // for monthly summary navigation
let pieChart     = null;
let sortMode     = 'date-desc';

/* ─── DOM REFS ───────────────────────────────────────── */
const $ = id => document.getElementById(id);

const els = {
  form:          $('transaction-form'),
  itemName:      $('item-name'),
  amount:        $('amount'),
  type:          $('type'),
  category:      $('category'),
  date:          $('date'),
  errName:       $('err-name'),
  errAmount:     $('err-amount'),
  totalBalance:  $('total-balance'),
  totalIncome:   $('total-income'),
  totalExpense:  $('total-expense'),
  txList:        $('transaction-list'),
  listEmpty:     $('list-empty'),
  sortSelect:    $('sort-select'),
  clearAll:      $('clear-all-btn'),
  themeToggle:   $('theme-toggle'),
  themeIcon:     $('theme-icon'),
  budgetInput:   $('budget-limit'),
  setBudget:     $('set-budget-btn'),
  budgetWarning: $('budget-warning'),
  warningLimit:  $('warning-limit'),
  pieCanvas:     $('pie-chart'),
  chartEmpty:    $('chart-empty'),
  chartLegend:   $('chart-legend'),
  prevMonth:     $('prev-month'),
  nextMonth:     $('next-month'),
  monthLabel:    $('month-label'),
  mIncome:       $('m-income'),
  mExpense:      $('m-expense'),
  mNet:          $('m-net'),
  mCount:        $('m-count'),
  // category modal
  addCatBtn:     $('add-category-btn'),
  catModal:      $('cat-modal'),
  catInput:      $('cat-input'),
  catCancel:     $('cat-cancel'),
  catConfirm:    $('cat-confirm'),
};

/* ─── INIT ───────────────────────────────────────────── */
function init() {
  loadData();
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  setDefaultDate();
  buildCategorySelect();
  renderAll();
  bindEvents();
}

/* ─── LOAD / SAVE ────────────────────────────────────── */
function loadData() {
  transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  categories   = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || 'null')
                 || [...DEFAULT_CATEGORIES];
  budgetLimit  = parseFloat(localStorage.getItem(BUDGET_KEY) || '0');

  if (budgetLimit > 0) {
    els.budgetInput.value = budgetLimit;
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function saveCategories() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

/* ─── DATE HELPERS ───────────────────────────────────── */
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  els.date.value = today;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}`;
}

function monthLabel(date) {
  return date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
}

/* ─── CATEGORIES ─────────────────────────────────────── */
function buildCategorySelect() {
  els.category.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.toLowerCase();
    opt.textContent = cat;
    els.category.appendChild(opt);
  });
}

function addCustomCategory(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  // avoid duplicates
  if (categories.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) return;
  categories.push(trimmed);
  saveCategories();
  buildCategorySelect();
  // select the new one
  els.category.value = trimmed.toLowerCase();
}

/* ─── VALIDATION ─────────────────────────────────────── */
function validate() {
  let valid = true;
  els.errName.textContent   = '';
  els.errAmount.textContent = '';
  els.itemName.classList.remove('error');
  els.amount.classList.remove('error');

  if (!els.itemName.value.trim()) {
    els.errName.textContent = 'Nama barang wajib diisi.';
    els.itemName.classList.add('error');
    valid = false;
  }

  const amt = parseRp(els.amount.value);
  if (!els.amount.value || isNaN(amt) || amt <= 0) {
    els.errAmount.textContent = 'Masukkan jumlah yang valid (lebih dari 0).';
    els.amount.classList.add('error');
    valid = false;
  }

  return valid;
}

/* ─── ADD TRANSACTION ────────────────────────────────── */
function addTransaction(e) {
  e.preventDefault();
  if (!validate()) return;

  const tx = {
    id:       Date.now().toString(),
    name:     els.itemName.value.trim(),
    amount:   parseRp(els.amount.value),
    type:     els.type.value,
    category: els.category.value,
    date:     els.date.value || new Date().toISOString().split('T')[0],
  };

  transactions.unshift(tx);
  saveTransactions();
  renderAll();

  // reset form fields (keep date & category)
  els.itemName.value = '';
  els.amount.value   = '';
  els.itemName.focus();
}

/* ─── DELETE TRANSACTION ─────────────────────────────── */
function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  renderAll();
}

/* ─── CLEAR ALL ──────────────────────────────────────── */
function clearAll() {
  if (!transactions.length) return;
  if (!confirm('Hapus SEMUA transaksi? Tindakan ini tidak bisa dibatalkan.')) return;
  transactions = [];
  saveTransactions();
  renderAll();
}

/* ─── TOTALS ─────────────────────────────────────────── */
function calcTotals() {
  let income = 0, expense = 0;
  transactions.forEach(tx => {
    if (tx.type === 'income')  income  += tx.amount;
    else                        expense += tx.amount;
  });
  return { income, expense, balance: income - expense };
}

function fmt(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp${Math.abs(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* Strip titik ribuan & koma desimal → angka murni */
function parseRp(str) {
  if (!str) return NaN;
  // hapus semua titik (pemisah ribuan), ganti koma desimal → titik
  const clean = String(str).replace(/\./g, '').replace(',', '.');
  return parseFloat(clean);
}

function fmtRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n).replace('IDR', 'Rp');
}

/* ─── RENDER BALANCE ─────────────────────────────────── */
function renderBalance() {
  const { income, expense, balance } = calcTotals();

  els.totalBalance.textContent  = fmt(balance);
  els.totalIncome.textContent   = fmt(income);
  els.totalExpense.textContent  = fmt(expense);

  // colour balance
  els.totalBalance.style.color =
    balance < 0 ? '#fca5a5' : balance > 0 ? '#a7f3d0' : '#fff';

  // bump animation
  els.totalBalance.classList.remove('bump');
  void els.totalBalance.offsetWidth; // reflow
  els.totalBalance.classList.add('bump');

  // budget warning
  if (budgetLimit > 0 && expense > budgetLimit) {
    els.warningLimit.textContent = fmt(budgetLimit);
    els.budgetWarning.classList.remove('hidden');
  } else {
    els.budgetWarning.classList.add('hidden');
  }
}

/* ─── RENDER PIE CHART ───────────────────────────────── */
function renderChart() {
  const expenseOnly = transactions.filter(tx => tx.type === 'expense');

  if (!expenseOnly.length) {
    els.chartEmpty.classList.remove('hidden');
    els.chartLegend.innerHTML = '';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  els.chartEmpty.classList.add('hidden');

  // aggregate by category
  const map = {};
  expenseOnly.forEach(tx => {
    map[tx.category] = (map[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(map);
  const data   = Object.values(map);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (pieChart) {
    pieChart.data.labels          = labels;
    pieChart.data.datasets[0].data   = data;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.update();
  } else {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    pieChart = new Chart(els.pieCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: Rp${ctx.parsed.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  // custom legend
  els.chartLegend.innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span>${capitalize(label)}</span>
    </div>`).join('');
}

/* ─── RENDER MONTHLY SUMMARY ─────────────────────────── */
function renderMonthlySummary() {
  els.monthLabel.textContent = monthLabel(currentMonth);
  const key = monthKey(currentMonth);

  const monthTx = transactions.filter(tx => tx.date && tx.date.startsWith(key));

  let income = 0, expense = 0;
  monthTx.forEach(tx => {
    if (tx.type === 'income') income  += tx.amount;
    else                       expense += tx.amount;
  });
  const net = income - expense;

  els.mIncome.textContent  = fmt(income);
  els.mExpense.textContent = fmt(expense);
  els.mNet.textContent     = fmt(net);
  els.mNet.className       = 'mstat-value' + (net < 0 ? ' expense' : net > 0 ? ' income' : '');
  els.mCount.textContent   = monthTx.length;
}

/* ─── SORT TRANSACTIONS ──────────────────────────────── */
function getSorted() {
  const list = [...transactions];
  switch (sortMode) {
    case 'date-asc':    return list.sort((a,b) => a.date.localeCompare(b.date));
    case 'date-desc':   return list.sort((a,b) => b.date.localeCompare(a.date));
    case 'amount-desc': return list.sort((a,b) => b.amount - a.amount);
    case 'amount-asc':  return list.sort((a,b) => a.amount - b.amount);
    case 'category':    return list.sort((a,b) => a.category.localeCompare(b.category));
    default:            return list;
  }
}

/* ─── RENDER TRANSACTION LIST ────────────────────────── */
function renderList() {
  const sorted = getSorted();

  if (!sorted.length) {
    els.txList.innerHTML = '';
    els.txList.appendChild(els.listEmpty);
    els.listEmpty.classList.remove('hidden');
    return;
  }

  els.listEmpty.classList.add('hidden');

  els.txList.innerHTML = sorted.map(tx => {
    const icon   = tx.type === 'income'
      ? '💵'
      : (CATEGORY_ICONS[tx.category] || '💸');
    const sign   = tx.type === 'income' ? '+' : '-';
    const cls    = tx.type; // 'income' | 'expense'

    return `
      <div class="tx-item" data-id="${tx.id}">
        <div class="tx-icon ${cls}">${icon}</div>
        <div class="tx-info">
          <div class="tx-name">${escHtml(tx.name)}</div>
          <div class="tx-meta">
            <span class="tx-cat">${capitalize(tx.category)}</span>
            <span class="tx-date">${formatDate(tx.date)}</span>
          </div>
        </div>
        <div class="tx-amount ${cls}">${sign}Rp${tx.amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
        <button class="tx-delete" data-id="${tx.id}" aria-label="Hapus ${escHtml(tx.name)}">Hapus</button>
      </div>`;
  }).join('');

  // delegate delete clicks
  els.txList.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

/* ─── RENDER ALL ─────────────────────────────────────── */
function renderAll() {
  renderBalance();
  renderChart();
  renderMonthlySummary();
  renderList();
}

/* ─── THEME ──────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);

  // update chart border color if chart exists
  if (pieChart) {
    pieChart.data.datasets[0].borderColor =
      theme === 'dark' ? '#1e293b' : '#ffffff';
    pieChart.update();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ─── BUDGET ─────────────────────────────────────────── */
function setBudget() {
  const val = parseFloat(els.budgetInput.value);
  if (isNaN(val) || val < 0) return;
  budgetLimit = val;
  localStorage.setItem(BUDGET_KEY, val);
  renderBalance();
}

/* ─── HELPERS ────────────────────────────────────────── */
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function escHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/* ─── BIND EVENTS ────────────────────────────────────── */
function bindEvents() {
  // form submit
  els.form.addEventListener('submit', addTransaction);

  // theme toggle
  els.themeToggle.addEventListener('click', toggleTheme);

  // sort
  els.sortSelect.addEventListener('change', () => {
    sortMode = els.sortSelect.value;
    renderList();
  });

  // clear all
  els.clearAll.addEventListener('click', clearAll);

  // auto-format amount input dengan titik ribuan
  els.amount.addEventListener('input', () => {
    // ambil hanya angka
    const digits = els.amount.value.replace(/\D/g, '');
    if (!digits) { els.amount.value = ''; return; }
    // format dengan titik ribuan
    els.amount.value = parseInt(digits, 10).toLocaleString('id-ID');
  });

  // budget
  els.setBudget.addEventListener('click', setBudget);
  els.budgetInput.addEventListener('keydown', e => { if (e.key === 'Enter') setBudget(); });

  // monthly nav
  els.prevMonth.addEventListener('click', () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    renderMonthlySummary();
  });
  els.nextMonth.addEventListener('click', () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    renderMonthlySummary();
  });

  // custom category modal
  els.addCatBtn.addEventListener('click', () => {
    els.catInput.value = '';
    els.catModal.classList.remove('hidden');
    els.catInput.focus();
  });
  els.catCancel.addEventListener('click', () => els.catModal.classList.add('hidden'));
  els.catConfirm.addEventListener('click', () => {
    addCustomCategory(els.catInput.value);
    els.catModal.classList.add('hidden');
  });
  els.catInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { addCustomCategory(els.catInput.value); els.catModal.classList.add('hidden'); }
    if (e.key === 'Escape') { els.catModal.classList.add('hidden'); }
  });
  // close modal on overlay click
  els.catModal.addEventListener('click', e => {
    if (e.target === els.catModal) els.catModal.classList.add('hidden');
  });
}

/* ─── BOOTSTRAP ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Cek session — redirect ke login kalau belum login
  const SESSION_KEY = 'ebv_session';
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  // Tampilkan nama user di header
  const badge = document.getElementById('user-badge');
  if (badge) badge.textContent = '👤 ' + session.nama;

  // Tombol logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Yakin mau keluar?')) {
        localStorage.removeItem(SESSION_KEY);
        window.location.replace('login.html');
      }
    });
  }

  init();
});
