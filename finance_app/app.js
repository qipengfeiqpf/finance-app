const STORAGE_KEY = 'finance_records';
const CATEGORIES_KEY = 'finance_categories';
const BUDGETS_KEY = 'finance_budgets';

const DEFAULT_CATEGORIES = {
  income: ['工资', '奖金', '兼职'],
  expense: ['餐饮', '交通', '购物', '娱乐', '住房'],
};

const PIE_COLORS = [
  '#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b',
];

const TEXT = {
  income: '收入',
  expense: '支出',
  deleteConfirm: '确定要删除这条记录吗？',
  amountRequired: '请输入金额',
  amountInvalid: '金额必须大于 0',
  categoryRequired: '请选择分类',
  dateRequired: '请选择记账日期',
  dateFuture: '记账日期不能晚于今天',
  editRecord: '编辑',
  catEmpty: '分类名称不能为空',
  catDuplicate: '该分类已存在',
  catInUse: '该分类下还有记录，无法删除',
  importConfirm: '导入将覆盖现有全部数据，确定继续吗？',
  importSuccess: '导入成功',
  importFail: '文件格式无效',
  budgetSaved: '预算已保存',
};

const form = document.getElementById('form');
const typeInput = document.getElementById('type');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('record-date');
const categorySelect = document.getElementById('category');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const balanceEl = document.getElementById('balance');
const statIncomeEl = document.getElementById('stat-income');
const statExpenseEl = document.getElementById('stat-expense');
const periodLabelEl = document.getElementById('period-label');
const chartCanvas = document.getElementById('chart');
const pieCanvas = document.getElementById('pie-chart');
const pieLegendEl = document.getElementById('pie-legend');
const budgetAlertEl = document.getElementById('budget-alert');
const filterKeyword = document.getElementById('filter-keyword');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const filterFrom = document.getElementById('filter-from');
const filterTo = document.getElementById('filter-to');
const filterCountEl = document.getElementById('filter-count');
const filterResetBtn = document.getElementById('filter-reset');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editTypeInput = document.getElementById('edit-type');
const editAmountInput = document.getElementById('edit-amount');
const editDateInput = document.getElementById('edit-date');
const editCategorySelect = document.getElementById('edit-category');
const editNoteInput = document.getElementById('edit-note');
const editBackdrop = document.getElementById('edit-backdrop');
const editCancelBtn = document.getElementById('edit-cancel');
const budgetTotalInput = document.getElementById('budget-total');
const budgetCategoriesEl = document.getElementById('budget-categories');
const saveBudgetBtn = document.getElementById('save-budget');
const incomeCatList = document.getElementById('income-cat-list');
const expenseCatList = document.getElementById('expense-cat-list');
const newIncomeCatInput = document.getElementById('new-income-cat');
const newExpenseCatInput = document.getElementById('new-expense-cat');
const importFileInput = document.getElementById('import-file');

let statPeriod = '7';
let pieType = 'expense';
let editingRecordId = null;

// —— 存储 ——

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadCategories() {
  try {
    const raw = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    if (raw?.income?.length && raw?.expense?.length) return raw;
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
}

function saveCategories(cats) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

function loadBudgets() {
  try {
    return JSON.parse(localStorage.getItem(BUDGETS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBudgets(budgets) {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
}

function migrateStorage() {
  if (!localStorage.getItem(CATEGORIES_KEY)) {
    saveCategories(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
  }
}

// —— 工具 ——

function fmt(n) {
  return '¥' + n.toFixed(2);
}

function escape(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseInputDateValue(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  const isToday = startOfDay(d).getTime() === startOfDay(new Date()).getTime();
  if (!isToday) {
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatChartLabel(date, short) {
  if (short) return date.toLocaleDateString('zh-CN', { day: 'numeric' });
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function buildRecordDate(dateStr, previousDate) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const selectedDay = startOfDay(new Date(y, m - 1, d));
  const today = startOfDay(new Date());
  if (selectedDay.getTime() === today.getTime()) {
    if (previousDate) {
      const old = new Date(previousDate);
      if (startOfDay(old).getTime() === today.getTime()) {
        return new Date(y, m - 1, d, old.getHours(), old.getMinutes(), 0, 0);
      }
    }
    return new Date();
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function validateDateValue(dateStr, inputEl) {
  if (!dateStr) {
    alert(TEXT.dateRequired);
    inputEl?.focus();
    return false;
  }
  if (parseInputDateValue(dateStr) > startOfDay(new Date())) {
    alert(TEXT.dateFuture);
    inputEl?.focus();
    return false;
  }
  return true;
}

function validateAmount(inputEl) {
  const amount = parseFloat(inputEl.value, 10);
  if (!inputEl.value.trim()) {
    alert(TEXT.amountRequired);
    inputEl.focus();
    return null;
  }
  if (Number.isNaN(amount) || amount <= 0) {
    alert(TEXT.amountInvalid);
    inputEl.focus();
    return null;
  }
  return amount;
}

function sumByType(records, type) {
  return records.filter((r) => r.type === type).reduce((s, r) => s + r.amount, 0);
}

// —— 统计周期 ——

function getMonthRange(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const start = startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function filterByPeriod(records, period) {
  if (period === '7' || period === '30') {
    const days = Number(period);
    const now = startOfDay(new Date());
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    return records.filter((r) => {
      const d = startOfDay(new Date(r.date));
      return d >= start && d <= now;
    });
  }
  const offset = period === 'lastMonth' ? -1 : 0;
  const { start, end } = getMonthRange(offset);
  return records.filter((r) => {
    const t = new Date(r.date);
    return t >= start && t <= end;
  });
}

function getPeriodLabel(period) {
  if (period === '7') return '统计范围：最近 7 天';
  if (period === '30') return '统计范围：最近 30 天';
  const offset = period === 'lastMonth' ? -1 : 0;
  const { start, end } = getMonthRange(offset);
  const s = start.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  const e = end.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  return `统计范围：${s} 至 ${e}`;
}

function getDailyBuckets(period) {
  if (period === '7' || period === '30') {
    const days = Number(period);
    const buckets = [];
    const now = startOfDay(new Date());
    const shortLabel = days > 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        date: d,
        label: formatChartLabel(d, shortLabel),
        income: 0,
        expense: 0,
      });
    }
    return buckets;
  }
  const offset = period === 'lastMonth' ? -1 : 0;
  const { start, end } = getMonthRange(offset);
  const buckets = [];
  const cur = new Date(start);
  const dayCount = end.getDate();
  const shortLabel = dayCount > 10;
  while (cur <= end) {
    const d = new Date(cur);
    buckets.push({
      date: startOfDay(d),
      label: formatChartLabel(d, shortLabel),
      income: 0,
      expense: 0,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return buckets;
}

function fillBuckets(records, buckets) {
  for (const r of records) {
    const rd = startOfDay(new Date(r.date)).getTime();
    const bucket = buckets.find((b) => b.date.getTime() === rd);
    if (bucket) bucket[r.type] += r.amount;
  }
}

function sumByCategory(records, type) {
  const map = {};
  for (const r of records) {
    if (r.type !== type) continue;
    map[r.category] = (map[r.category] || 0) + r.amount;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

// —— 图表 ——

function drawBarChart(buckets, period) {
  const dpr = window.devicePixelRatio || 1;
  const rect = chartCanvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  chartCanvas.width = w * dpr;
  chartCanvas.height = h * dpr;
  const ctx = chartCanvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (!buckets.length) return;

  const pad = { top: 8, right: 8, bottom: 32, left: 8 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...buckets.flatMap((b) => [b.income, b.expense]));
  const groupW = chartW / buckets.length;
  const barW = Math.min(10, Math.max(4, (groupW - 4) / 2));
  const days = period === '7' || period === '30' ? Number(period) : buckets.length;

  buckets.forEach((b, i) => {
    const gx = pad.left + i * groupW + groupW / 2;
    const drawBar = (val, offset, color) => {
      const barH = (val / maxVal) * chartH;
      ctx.fillStyle = color;
      ctx.fillRect(gx + offset - barW / 2, pad.top + chartH - barH, barW, barH);
    };
    drawBar(b.income, -barW / 2 - 1, '#22c55e');
    drawBar(b.expense, barW / 2 + 1, '#ef4444');
    const showLabel =
      days <= 7 || i % Math.max(1, Math.ceil(buckets.length / 7)) === 0 || i === buckets.length - 1;
    if (showLabel) {
      ctx.fillStyle = '#888';
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, gx, h - 8);
    }
  });
}

function drawPieChart(items) {
  const dpr = window.devicePixelRatio || 1;
  const rect = pieCanvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  pieCanvas.width = w * dpr;
  pieCanvas.height = h * dpr;
  const ctx = pieCanvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  pieLegendEl.innerHTML = '';

  if (!items.length) {
    ctx.fillStyle = '#888';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', w / 2, h / 2);
    return;
  }

  const cx = w / 2;
  const cy = h / 2 - 8;
  const radius = Math.min(w, h) * 0.32;
  const total = items.reduce((s, i) => s + i.value, 0);
  let angle = -Math.PI / 2;

  items.forEach((item, i) => {
    const slice = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
    ctx.fill();
    angle += slice;

    const pct = ((item.value / total) * 100).toFixed(1);
    const li = document.createElement('li');
    li.innerHTML = `<span class="pie-dot" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>${escape(item.name)} ${pct}% · ${fmt(item.value)}`;
    pieLegendEl.appendChild(li);
  });
}

function renderStats(records) {
  const period = filterByPeriod(records, statPeriod);
  periodLabelEl.textContent = getPeriodLabel(statPeriod);
  statIncomeEl.textContent = fmt(sumByType(period, 'income'));
  statExpenseEl.textContent = fmt(sumByType(period, 'expense'));

  const buckets = getDailyBuckets(statPeriod);
  fillBuckets(period, buckets);
  drawBarChart(buckets, statPeriod);

  const pieData = sumByCategory(period, pieType);
  drawPieChart(pieData);
}

// —— 预算 ——

function getCurrentMonthRecords(records) {
  const { start, end } = getMonthRange(0);
  return records.filter((r) => {
    const t = new Date(r.date);
    return t >= start && t <= end;
  });
}

function renderBudgetForm() {
  const cats = loadCategories();
  const budgets = loadBudgets();
  const key = getMonthKey();
  const b = budgets[key] || { total: 0, categories: {} };

  budgetTotalInput.value = b.total || '';

  budgetCategoriesEl.innerHTML = '';
  cats.expense.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'budget-row';
    const label = document.createElement('label');
    label.textContent = cat;
    const input = document.createElement('input');
    input.type = 'number';
    input.dataset.budgetCat = cat;
    input.placeholder = '选填';
    input.min = '0';
    input.step = '50';
    input.inputMode = 'numeric';
    if (b.categories?.[cat]) input.value = b.categories[cat];
    row.append(label, input);
    budgetCategoriesEl.appendChild(row);
  });
}

function saveBudgetForm() {
  const budgets = loadBudgets();
  const key = getMonthKey();
  const categories = {};
  budgetCategoriesEl.querySelectorAll('[data-budget-cat]').forEach((input) => {
    const val = parseFloat(input.value, 10);
    if (!Number.isNaN(val) && val > 0) {
      categories[input.dataset.budgetCat] = val;
    }
  });
  const total = parseFloat(budgetTotalInput.value, 10);
  budgets[key] = {
    total: !Number.isNaN(total) && total > 0 ? total : 0,
    categories,
  };
  saveBudgets(budgets);
  alert(TEXT.budgetSaved);
  renderBudgetAlert(loadRecords());
}

function renderBudgetAlert(records) {
  const budgets = loadBudgets();
  const b = budgets[getMonthKey()];
  if (!b || (!b.total && !Object.keys(b.categories || {}).length)) {
    budgetAlertEl.classList.add('hidden');
    return;
  }

  const monthRecords = getCurrentMonthRecords(records);
  const messages = [];
  const totalExpense = sumByType(monthRecords, 'expense');

  if (b.total > 0) {
    const pct = (totalExpense / b.total) * 100;
    if (totalExpense > b.total) {
      messages.push(`本月支出已超总预算（${fmt(totalExpense)} / ${fmt(b.total)}）`);
    } else if (pct >= 90) {
      messages.push(`本月支出已达总预算 ${pct.toFixed(0)}%（${fmt(totalExpense)} / ${fmt(b.total)}）`);
    }
  }

  for (const [cat, limit] of Object.entries(b.categories || {})) {
    if (!limit) continue;
    const spent = monthRecords
      .filter((r) => r.type === 'expense' && r.category === cat)
      .reduce((s, r) => s + r.amount, 0);
    const pct = (spent / limit) * 100;
    if (spent > limit) {
      messages.push(`「${cat}」已超预算（${fmt(spent)} / ${fmt(limit)}）`);
    } else if (pct >= 90) {
      messages.push(`「${cat}」已达预算 ${pct.toFixed(0)}%`);
    }
  }

  if (messages.length) {
    budgetAlertEl.innerHTML = messages.map((m) => `<p>${escape(m)}</p>`).join('');
    budgetAlertEl.classList.remove('hidden');
  } else {
    budgetAlertEl.classList.add('hidden');
  }
}

// —— 自定义分类 ——

function fillCategorySelect(select, type, selected) {
  const cats = loadCategories()[type] || [];
  select.innerHTML = '';
  cats.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
  if (selected && cats.includes(selected)) select.value = selected;
}

function updateFormCategories(type) {
  fillCategorySelect(categorySelect, type);
}

function categoryInUse(name, type) {
  return loadRecords().some((r) => r.category === name && r.type === type);
}

function renderCategoryManage() {
  const cats = loadCategories();
  const renderList = (ul, type, items) => {
    ul.innerHTML = items
      .map(
        (name) => `
      <li>
        <span>${escape(name)}</span>
        <button type="button" class="btn-remove-cat" data-type="${type}" data-name="${name.replace(/"/g, '')}">删除</button>
      </li>`
      )
      .join('');
    ul.querySelectorAll('.btn-remove-cat').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        const n = btn.dataset.name;
        if (categoryInUse(n, t)) {
          alert(TEXT.catInUse);
          return;
        }
        const all = loadCategories();
        all[t] = all[t].filter((c) => c !== n);
        saveCategories(all);
        refreshAll();
      });
    });
  };
  renderList(incomeCatList, 'income', cats.income);
  renderList(expenseCatList, 'expense', cats.expense);
}

function addCategory(type, input) {
  const name = input.value.trim();
  if (!name) {
    alert(TEXT.catEmpty);
    return;
  }
  const cats = loadCategories();
  if (cats[type].includes(name)) {
    alert(TEXT.catDuplicate);
    return;
  }
  cats[type].push(name);
  saveCategories(cats);
  input.value = '';
  refreshAll();
}

// —— 筛选 ——

function updateFilterCategoryOptions() {
  const cats = loadCategories();
  const all = [...new Set([...cats.income, ...cats.expense])];
  const current = filterCategory.value;
  filterCategory.innerHTML =
    '<option value="all">全部分类</option>' +
    all.map((c) => `<option value="${c.replace(/"/g, '')}">${escape(c)}</option>`).join('');
  if ([...filterCategory.options].some((o) => o.value === current)) {
    filterCategory.value = current;
  }
}

function applyFilters(records) {
  const kw = filterKeyword.value.trim().toLowerCase();
  const type = filterType.value;
  const cat = filterCategory.value;
  const from = filterFrom.value;
  const to = filterTo.value;

  return records.filter((r) => {
    if (type !== 'all' && r.type !== type) return false;
    if (cat !== 'all' && r.category !== cat) return false;
    if (kw) {
      const hay = `${r.category} ${r.note || ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    const d = startOfDay(new Date(r.date));
    if (from && d < parseInputDateValue(from)) return false;
    if (to && d > parseInputDateValue(to)) return false;
    return true;
  });
}

// —— 列表与编辑 ——

function syncDateShortcuts(containerSelector, inputEl) {
  if (!inputEl?.value) return;
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const today = startOfDay(new Date());
  const selected = parseInputDateValue(inputEl.value);
  const diffDays = Math.round((today - selected) / 86400000);
  container.querySelectorAll('[data-offset]').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.offset) === diffDays);
  });
}

function setDateByOffset(inputEl, containerSelector, daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  inputEl.value = toDateInputValue(d);
  syncDateShortcuts(containerSelector, inputEl);
}

function initDateInput() {
  const todayStr = toDateInputValue(new Date());
  dateInput.value = todayStr;
  dateInput.max = todayStr;
  syncDateShortcuts('#form-date-quick', dateInput);
}

function openEditModal(record) {
  editingRecordId = record.id;
  editTypeInput.value = record.type;
  document.querySelectorAll('#edit-type-tabs .edit-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === record.type);
  });
  fillCategorySelect(editCategorySelect, record.type, record.category);
  editAmountInput.value = record.amount;
  editNoteInput.value = record.note || '';
  editDateInput.value = toDateInputValue(new Date(record.date));
  editDateInput.max = toDateInputValue(new Date());
  syncDateShortcuts('#edit-date-quick', editDateInput);
  editModal.classList.remove('hidden');
  editModal.setAttribute('aria-hidden', 'false');
}

function closeEditModal() {
  editingRecordId = null;
  editModal.classList.add('hidden');
  editModal.setAttribute('aria-hidden', 'true');
}

function saveEditRecord() {
  if (!editingRecordId) return;
  const amount = validateAmount(editAmountInput);
  if (amount === null) return;
  if (!validateDateValue(editDateInput.value, editDateInput)) return;
  if (!editCategorySelect.value) {
    alert(TEXT.categoryRequired);
    return;
  }

  const records = loadRecords();
  const index = records.findIndex((r) => r.id === editingRecordId);
  if (index === -1) {
    closeEditModal();
    return;
  }
  const old = records[index];
  records[index] = {
    ...old,
    type: editTypeInput.value,
    amount,
    category: editCategorySelect.value,
    note: editNoteInput.value.trim(),
    date: buildRecordDate(editDateInput.value, old.date).toISOString(),
  };
  saveRecords(records);
  closeEditModal();
  refreshAll();
}

function renderList(records) {
  const filtered = applyFilters(records);
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  listEl.innerHTML = '';
  const hasAny = records.length > 0;
  const hasFiltered = sorted.length > 0;
  emptyEl.classList.toggle('hidden', hasFiltered);
  emptyEl.textContent = hasAny ? '没有符合条件的记录' : '还没有任何记录，请先记一笔';
  filterCountEl.textContent = hasAny
    ? `共 ${records.length} 条，当前显示 ${sorted.length} 条`
    : '';

  for (const r of sorted) {
    const li = document.createElement('li');
    const typeName = TEXT[r.type];
    const sign = r.type === 'income' ? '+' : '-';
    const note = r.note ? ` · ${escape(r.note)}` : '';
    li.innerHTML = `
      <div class="item-icon ${r.type}">${r.category.slice(0, 2)}</div>
      <div class="item-body">
        <div class="item-title">${escape(r.category)}</div>
        <div class="item-meta">${typeName} · ${formatDateTime(r.date)}${note}</div>
      </div>
      <span class="item-amount ${r.type}">${sign}${fmt(r.amount).slice(1)}</span>
      <div class="item-actions">
        <button type="button" class="btn-edit" title="${TEXT.editRecord}">编辑</button>
        <button type="button" class="btn-del" title="删除" aria-label="删除">×</button>
      </div>
    `;
    li.querySelector('.btn-edit').addEventListener('click', () => openEditModal(r));
    li.querySelector('.btn-del').addEventListener('click', () => {
      if (!confirm(TEXT.deleteConfirm)) return;
      saveRecords(loadRecords().filter((x) => x.id !== r.id));
      refreshAll();
    });
    listEl.appendChild(li);
  }
}

// —— 导出 / 导入 ——

function exportJSON() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    records: loadRecords(),
    categories: loadCategories(),
    budgets: loadBudgets(),
  };
  downloadFile(JSON.stringify(data, null, 2), `记账备份_${getMonthKey()}.json`, 'application/json');
}

function exportCSV() {
  const records = loadRecords();
  const header = '类型,分类,金额,日期,备注';
  const rows = records.map((r) => {
    const type = TEXT[r.type];
    const date = new Date(r.date).toLocaleString('zh-CN');
    const note = (r.note || '').replace(/"/g, '""');
    return `${type},${r.category},${r.amount},"${date}","${note}"`;
  });
  const bom = '\uFEFF';
  downloadFile(bom + [header, ...rows].join('\n'), `记账导出_${getMonthKey()}.csv`, 'text/csv;charset=utf-8');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.records)) throw new Error('invalid');
      if (!confirm(TEXT.importConfirm)) return;
      saveRecords(data.records);
      if (data.categories?.income && data.categories?.expense) {
        saveCategories(data.categories);
      }
      if (data.budgets && typeof data.budgets === 'object') {
        saveBudgets(data.budgets);
      }
      alert(TEXT.importSuccess);
      refreshAll();
    } catch {
      alert(TEXT.importFail);
    }
  };
  reader.readAsText(file);
}

// —— 渲染总控 ——

function refreshAll() {
  const records = loadRecords();
  const income = sumByType(records, 'income');
  const expense = sumByType(records, 'expense');
  balanceEl.textContent = fmt(income - expense);
  updateFormCategories(typeInput.value);
  updateFilterCategoryOptions();
  renderStats(records);
  renderBudgetAlert(records);
  renderBudgetForm();
  renderCategoryManage();
  renderList(records);
}

function checkBudgetAfterSave(records) {
  renderBudgetAlert(records);
  const budgets = loadBudgets();
  const b = budgets[getMonthKey()];
  if (!b) return;
  const monthRecords = getCurrentMonthRecords(records);
  const last = monthRecords[monthRecords.length - 1];
  if (!last || last.type !== 'expense') return;
  const limit = b.categories?.[last.category];
  if (limit) {
    const spent = monthRecords
      .filter((r) => r.type === 'expense' && r.category === last.category)
      .reduce((s, r) => s + r.amount, 0);
    if (spent > limit) {
      alert(`提示：「${last.category}」本月已超预算`);
    } else if (spent >= limit * 0.9) {
      alert(`提示：「${last.category}」本月已达预算 90%`);
    }
  }
  if (b.total > 0) {
    const totalExpense = sumByType(monthRecords, 'expense');
    if (totalExpense > b.total) {
      alert('提示：本月支出已超总预算');
    }
  }
}

// —— 事件绑定 ——

document.querySelectorAll('#form-type-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#form-type-tabs .tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    typeInput.value = btn.dataset.type;
    updateFormCategories(typeInput.value);
  });
});

document.querySelectorAll('#stat-period-tabs .period').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#stat-period-tabs .period').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    statPeriod = btn.dataset.period;
    renderStats(loadRecords());
  });
});

document.querySelectorAll('#pie-type-tabs .pie-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#pie-type-tabs .pie-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    pieType = btn.dataset.pie;
    renderStats(loadRecords());
  });
});

document.querySelectorAll('#form-date-quick .date-shortcut').forEach((btn) => {
  btn.addEventListener('click', () => setDateByOffset(dateInput, '#form-date-quick', Number(btn.dataset.offset)));
});

document.querySelectorAll('#edit-date-quick .edit-date-shortcut').forEach((btn) => {
  btn.addEventListener('click', () => setDateByOffset(editDateInput, '#edit-date-quick', Number(btn.dataset.offset)));
});

dateInput.addEventListener('change', () => syncDateShortcuts('#form-date-quick', dateInput));
editDateInput.addEventListener('change', () => syncDateShortcuts('#edit-date-quick', editDateInput));

document.querySelectorAll('#edit-type-tabs .edit-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#edit-type-tabs .edit-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    editTypeInput.value = btn.dataset.type;
    fillCategorySelect(editCategorySelect, editTypeInput.value);
  });
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = validateAmount(amountInput);
  if (amount === null) return;
  if (!validateDateValue(dateInput.value, dateInput)) return;
  if (!categorySelect.value) {
    alert(TEXT.categoryRequired);
    return;
  }
  const records = loadRecords();
  records.push({
    id: crypto.randomUUID(),
    type: typeInput.value,
    amount,
    category: categorySelect.value,
    note: document.getElementById('note').value.trim(),
    date: buildRecordDate(dateInput.value).toISOString(),
  });
  saveRecords(records);
  form.reset();
  typeInput.value = document.querySelector('#form-type-tabs .tab.active').dataset.type;
  updateFormCategories(typeInput.value);
  initDateInput();
  refreshAll();
  checkBudgetAfterSave(records);
});

editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveEditRecord();
});

editBackdrop.addEventListener('click', closeEditModal);
editCancelBtn.addEventListener('click', closeEditModal);

saveBudgetBtn.addEventListener('click', saveBudgetForm);

document.getElementById('add-income-cat').addEventListener('click', () => addCategory('income', newIncomeCatInput));
document.getElementById('add-expense-cat').addEventListener('click', () => addCategory('expense', newExpenseCatInput));

[filterKeyword, filterType, filterCategory, filterFrom, filterTo].forEach((el) => {
  el.addEventListener('input', () => renderList(loadRecords()));
  el.addEventListener('change', () => renderList(loadRecords()));
});

filterResetBtn.addEventListener('click', () => {
  filterKeyword.value = '';
  filterType.value = 'all';
  filterCategory.value = 'all';
  filterFrom.value = '';
  filterTo.value = '';
  renderList(loadRecords());
});

document.getElementById('export-json').addEventListener('click', exportJSON);
document.getElementById('export-csv').addEventListener('click', exportCSV);
document.getElementById('import-json').addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', () => {
  const file = importFileInput.files[0];
  if (file) importJSON(file);
  importFileInput.value = '';
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderStats(loadRecords()), 150);
});

migrateStorage();
initDateInput();
refreshAll();
