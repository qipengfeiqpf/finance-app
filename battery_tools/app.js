(function () {
  'use strict';

  const CYCLE_ALIASES = [
    'cycle',
    'cycle number',
    'cycle_number',
    'cyclenumber',
    '循环',
    '循环次数',
    '圈数',
  ];

  const CHARGE_ALIASES = [
    'charge capacity',
    'charge_capacity',
    'charge',
    '充电比容量',
    '充电比容量(mah/g)',
    '充电容量',
  ];

  const DISCHARGE_ALIASES = [
    'discharge capacity',
    'discharge_capacity',
    'discharge',
    '放电比容量',
    '放电比容量(mah/g)',
    '放电容量',
  ];

  const GENERIC_CAPACITY_ALIASES = [
    'capacity',
    'specific capacity',
    'specific_capacity',
    'specificcapacity',
    '比容量',
    '容量',
  ];

  const CE_ALIASES = [
    'ce',
    'coulombic efficiency',
    'coulombic_efficiency',
    'coulombicefficiency',
    '库伦效率',
    '库仑效率',
    '库伦效率 (%)',
    'coulombic efficiency (%)',
  ];

  const CHART_CHARGE = {
    label: 'Charge Capacity',
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    tickColor: '#059669',
  };

  const CHART_DISCHARGE = {
    label: 'Discharge Capacity',
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    tickColor: '#2563eb',
  };

  const DEFAULT_REFERENCE_CYCLE = 28;
  const DEFAULT_CHARGE_RATE = 0.5;
  const DEFAULT_DISCHARGE_RATE = 0.5;

  const DEFAULT_TITLES = {
    chartTitle: 'Cycle Performance',
    xAxisTitle: 'Cycle Number',
    leftYTitle: 'Capacity (mAh g⁻¹)',
    rightYTitle: 'Coulombic Efficiency (%)',
  };

  const AXIS_TITLE_STYLE = {
    font: {
      size: 11,
      weight: '500',
      family: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
    color: '#5c6573',
  };

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const fileNameEl = document.getElementById('file-name');
  const messageEl = document.getElementById('message');
  const btnExport = document.getElementById('btn-export');
  const chartPlaceholder = document.getElementById('chart-placeholder');
  const inputChartTitle = document.getElementById('chart-title');
  const inputXAxisTitle = document.getElementById('chart-x-axis-title');
  const inputLeftYTitle = document.getElementById('chart-left-y-title');
  const inputRightYTitle = document.getElementById('chart-right-y-title');
  const titleFieldRightY = document.getElementById('title-field-right-y');
  const btnResetTitles = document.getElementById('btn-reset-titles');
  const titleInputs = [
    inputChartTitle,
    inputXAxisTitle,
    inputLeftYTitle,
    inputRightYTitle,
  ];
  const statChargeInitial = document.getElementById('stat-charge-initial');
  const statChargeFinal = document.getElementById('stat-charge-final');
  const statDischargeInitial = document.getElementById('stat-discharge-initial');
  const statDischargeFinal = document.getElementById('stat-discharge-final');
  const inputReferenceCycle = document.getElementById('reference-cycle');
  const inputChargeRate = document.getElementById('charge-rate');
  const inputDischargeRate = document.getElementById('discharge-rate');
  const rateInputs = [inputChargeRate, inputDischargeRate];
  const statReferenceCycle = document.getElementById('stat-reference-cycle');
  const statReferenceCapacity = document.getElementById('stat-reference-capacity');
  const statRetention = document.getElementById('stat-retention');
  const statCeAvg = document.getElementById('stat-ce-avg');
  const statCeFirst = document.getElementById('stat-ce-first');
  const statCeLast = document.getElementById('stat-ce-last');
  const axisFieldsetX = document.getElementById('axis-fieldset-x');
  const axisFieldsetCapacity = document.getElementById('axis-fieldset-capacity');
  const axisFieldsetCe = document.getElementById('axis-fieldset-ce');
  const inputXMin = document.getElementById('axis-x-min');
  const inputXMax = document.getElementById('axis-x-max');
  const inputCapacityMin = document.getElementById('axis-capacity-min');
  const inputCapacityMax = document.getElementById('axis-capacity-max');
  const inputCeMin = document.getElementById('axis-ce-min');
  const inputCeMax = document.getElementById('axis-ce-max');
  const btnApplyAxis = document.getElementById('btn-apply-axis');
  const btnResetAxis = document.getElementById('btn-reset-axis');
  const axisInputs = [
    inputXMin,
    inputXMax,
    inputCapacityMin,
    inputCapacityMax,
    inputCeMin,
    inputCeMax,
  ];

  let chart = null;
  let lastChartData = null;
  let lastRetentionResult = null;

  const experimentInfoPlugin = {
    id: 'experimentInfoBox',
    afterDraw(chartInstance) {
      drawExperimentInfoBox(chartInstance);
    },
  };

  function normalizeHeader(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, ' ')
      .replace(/[()（）]/g, '')
      .replace(/mah\/g/g, 'mah g')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchAlias(header, alias) {
    if (!header || !alias) return false;
    if (header === alias) return true;

    if (alias === 'charge') {
      return (
        /^charge(\s|$)/.test(header) ||
        header.includes('charge capacity') ||
        header.includes('充电')
      );
    }
    if (alias === 'discharge') {
      return (
        /^discharge(\s|$)/.test(header) ||
        header.includes('discharge capacity') ||
        header.includes('放电')
      );
    }

    if (alias.length > 4 && (header.includes(alias) || alias.includes(header))) {
      return true;
    }
    return false;
  }

  function findColumnByAliases(headers, aliases, excludeIndices) {
    const normalized = headers.map(normalizeHeader);
    const excluded = new Set(excludeIndices || []);

    for (const alias of aliases) {
      const idx = normalized.findIndex(
        (h, i) => !excluded.has(i) && h === alias
      );
      if (idx !== -1) return idx;
    }

    for (let i = 0; i < normalized.length; i++) {
      if (excluded.has(i)) continue;
      const h = normalized[i];
      if (!h) continue;
      for (const alias of aliases) {
        if (alias.length <= 2) continue;
        if (matchAlias(h, alias)) return i;
      }
    }
    return -1;
  }

  function isChargeHeader(header) {
    const h = normalizeHeader(header);
    if (!h) return false;
    if (h.includes('discharge') || h.includes('放电')) return false;
    return CHARGE_ALIASES.some((a) => matchAlias(h, a));
  }

  function isDischargeHeader(header) {
    const h = normalizeHeader(header);
    if (!h) return false;
    if (isChargeHeader(header) && !h.includes('discharge') && !h.includes('放电')) {
      return false;
    }
    return DISCHARGE_ALIASES.some((a) => matchAlias(h, a));
  }

  function findChargeColumnIndex(headers, excludeIndices) {
    const normalized = headers.map(normalizeHeader);
    const excluded = new Set(excludeIndices || []);
    for (let i = 0; i < normalized.length; i++) {
      if (excluded.has(i)) continue;
      if (isChargeHeader(headers[i])) return i;
    }
    return -1;
  }

  function findDischargeColumnIndex(headers, excludeIndices) {
    const normalized = headers.map(normalizeHeader);
    const excluded = new Set(excludeIndices || []);
    for (let i = 0; i < normalized.length; i++) {
      if (excluded.has(i)) continue;
      if (isDischargeHeader(headers[i])) return i;
    }
    return -1;
  }

  function findGenericCapacityIndex(headers, excludeIndices) {
    const excluded = new Set(excludeIndices || []);
    const normalized = headers.map(normalizeHeader);

    for (let i = 0; i < normalized.length; i++) {
      if (excluded.has(i)) continue;
      const h = normalized[i];
      if (!h || isChargeHeader(headers[i]) || isDischargeHeader(headers[i])) {
        continue;
      }
      for (const alias of GENERIC_CAPACITY_ALIASES) {
        if (matchAlias(h, alias)) return i;
      }
    }
    return -1;
  }

  function findCeColumnIndex(headers, excludeIndices) {
    const excluded = new Set(excludeIndices || []);
    const normalized = headers.map(normalizeHeader);
    for (let i = 0; i < normalized.length; i++) {
      if (excluded.has(i)) continue;
      const h = normalized[i];
      if (!h) continue;
      if (h === 'ce') return i;
      for (const alias of CE_ALIASES) {
        if (alias === 'ce') continue;
        if (matchAlias(h, alias)) return i;
      }
    }
    return -1;
  }

  function parseNumber(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return value;
    const s = String(value).trim().replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function normalizeCeValues(values) {
    const valid = values.filter(Number.isFinite);
    if (valid.length === 0) return values;
    const max = Math.max(...valid.map(Math.abs));
    if (max <= 1.5) {
      return values.map((v) => (Number.isFinite(v) ? v * 100 : v));
    }
    return values;
  }

  function sheetToRows(workbook) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  }

  function detectColumns(row) {
    const cycleIdx = findColumnByAliases(row, CYCLE_ALIASES);
    if (cycleIdx === -1) return null;

    const used = [cycleIdx];
    let chargeIdx = findChargeColumnIndex(row, used);
    if (chargeIdx !== -1) used.push(chargeIdx);

    let dischargeIdx = findDischargeColumnIndex(row, used);
    if (dischargeIdx !== -1) used.push(dischargeIdx);

    let genericIdx = -1;
    if (chargeIdx === -1 && dischargeIdx === -1) {
      genericIdx = findGenericCapacityIndex(row, used);
      if (genericIdx !== -1) {
        dischargeIdx = genericIdx;
        used.push(genericIdx);
      }
    }

    const ceIdx = findCeColumnIndex(row, used);

    if (dischargeIdx === -1 && chargeIdx === -1) {
      return null;
    }

    return { cycleIdx, chargeIdx, dischargeIdx, ceIdx };
  }

  function rowsToSeries(rows) {
    if (!rows || rows.length < 2) {
      throw new Error('数据行不足，请确认文件包含表头与数据');
    }

    let headerRowIndex = -1;
    let cols = null;

    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const detected = detectColumns(row);
      if (detected) {
        headerRowIndex = r;
        cols = detected;
        break;
      }
    }

    if (!cols) {
      throw new Error(
        '未找到 Cycle 与容量列，请检查 Charge / Discharge Capacity 或 Capacity 列名'
      );
    }

    const { cycleIdx, chargeIdx, dischargeIdx, ceIdx } = cols;
    const byCycle = new Map();

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const cycle = parseNumber(row[cycleIdx]);
      if (!Number.isFinite(cycle)) continue;

      const charge =
        chargeIdx !== -1 ? parseNumber(row[chargeIdx]) : NaN;
      const discharge =
        dischargeIdx !== -1 ? parseNumber(row[dischargeIdx]) : NaN;
      const ceRaw = ceIdx !== -1 ? parseNumber(row[ceIdx]) : NaN;

      if (!Number.isFinite(charge) && !Number.isFinite(discharge)) continue;

      const prev = byCycle.get(cycle) || {
        charge: NaN,
        discharge: NaN,
        ce: NaN,
      };

      byCycle.set(cycle, {
        charge: Number.isFinite(charge) ? charge : prev.charge,
        discharge: Number.isFinite(discharge) ? discharge : prev.discharge,
        ce: Number.isFinite(ceRaw) ? ceRaw : prev.ce,
      });
    }

    if (byCycle.size === 0) {
      throw new Error('未解析到有效数据点');
    }

    const cycles = [...byCycle.keys()].sort((a, b) => a - b);
    const chargeValues =
      chargeIdx !== -1
        ? cycles.map((c) => byCycle.get(c).charge)
        : null;
    const dischargeValues = cycles.map((c) => byCycle.get(c).discharge);

    const hasCharge =
      chargeValues && chargeValues.some(Number.isFinite);
    const hasDischarge = dischargeValues.some(Number.isFinite);

    let ceValues =
      ceIdx !== -1 ? cycles.map((c) => byCycle.get(c).ce) : null;
    const hasCe = ceValues && ceValues.some(Number.isFinite);
    if (hasCe) {
      ceValues = normalizeCeValues(ceValues);
    } else {
      ceValues = null;
    }

    return {
      cycles,
      chargeValues: hasCharge ? chargeValues : null,
      dischargeValues: hasDischarge ? dischargeValues : null,
      ceValues,
      hasCharge,
      hasDischarge,
      hasCe,
    };
  }

  function setMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'message' + (type ? ' ' + type : '');
  }

  function formatCapacity(value) {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 100) return value.toFixed(2);
    if (abs >= 10) return value.toFixed(3);
    return value.toFixed(4);
  }

  function formatCe(value) {
    if (!Number.isFinite(value)) return '—';
    return value.toFixed(2);
  }

  function firstFinite(values) {
    if (!values) return NaN;
    return values.find(Number.isFinite);
  }

  function lastFinite(values) {
    if (!values) return NaN;
    return [...values].reverse().find(Number.isFinite);
  }

  function getLastCycleNumber(cycles) {
    if (!cycles || cycles.length === 0) return NaN;
    return cycles[cycles.length - 1];
  }

  function parseRateInput(input, fallback) {
    const raw = input.value.trim();
    if (raw === '') return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function getChargeRate() {
    return parseRateInput(inputChargeRate, DEFAULT_CHARGE_RATE);
  }

  function getDischargeRate() {
    return parseRateInput(inputDischargeRate, DEFAULT_DISCHARGE_RATE);
  }

  function formatRateForDisplay(rate) {
    if (!Number.isFinite(rate)) return '— C';
    const text =
      Math.abs(rate - Math.round(rate)) < 1e-9
        ? String(Math.round(rate))
        : String(parseFloat(rate.toFixed(4)));
    return text + ' C';
  }

  function formatCycleCountLine(cycleNumber) {
    if (!Number.isFinite(cycleNumber)) return '— Cycles';
    const n = Math.round(cycleNumber) === cycleNumber
      ? String(Math.round(cycleNumber))
      : String(cycleNumber);
    return n + ' Cycles';
  }

  function getRetentionDisplayText() {
    if (
      lastRetentionResult &&
      lastRetentionResult.found &&
      Number.isFinite(lastRetentionResult.retention)
    ) {
      return lastRetentionResult.retention.toFixed(2) + ' %';
    }
    return '— %';
  }

  function buildExperimentInfoLines() {
    const cycleLine = formatCycleCountLine(
      lastRetentionResult ? lastRetentionResult.cycleCount : NaN
    );
    return [
      { text: cycleLine, bold: true },
      { text: '', bold: false },
      { text: 'Capacity Retention:', bold: false },
      { text: getRetentionDisplayText(), bold: false },
      { text: '', bold: false },
      { text: 'Charge Rate:', bold: false },
      { text: formatRateForDisplay(getChargeRate()), bold: false },
      { text: '', bold: false },
      { text: 'Discharge Rate:', bold: false },
      { text: formatRateForDisplay(getDischargeRate()), bold: false },
    ];
  }

  function drawExperimentInfoBox(chartInstance) {
    if (!lastChartData || !chartInstance.chartArea) return;

    const { ctx, chartArea } = chartInstance;
    const lines = buildExperimentInfoLines();
    const padX = 10;
    const padY = 8;
    const lineHeight = 14;
    const fontFamily =
      '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    const fontSize = 11;

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    let maxWidth = 0;
    lines.forEach((line) => {
      if (!line.text) return;
      ctx.font = line.bold
        ? `600 ${fontSize}px ${fontFamily}`
        : `${fontSize}px ${fontFamily}`;
      maxWidth = Math.max(maxWidth, ctx.measureText(line.text).width);
    });

    const boxWidth = maxWidth + padX * 2;
    const boxHeight = lines.length * lineHeight + padY * 2;
    const x = chartArea.right - boxWidth - 10;
    const legendOffset =
      chartInstance.legend &&
      chartInstance.legend.legendItems &&
      chartInstance.legend.legendItems.length > 0
        ? chartInstance.legend.height + 6
        : 0;
    const y = chartArea.top + 10 + legendOffset;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = '#e2e6ec';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, boxWidth, boxHeight, 3);
    } else {
      ctx.rect(x, y, boxWidth, boxHeight);
    }
    ctx.fill();
    ctx.stroke();

    let textY = y + padY + fontSize * 0.85;
    lines.forEach((line) => {
      if (line.text === '') {
        textY += lineHeight * 0.45;
        return;
      }
      ctx.font = line.bold
        ? `600 ${fontSize}px ${fontFamily}`
        : `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = line.bold ? '#1a1d23' : '#5c6573';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(line.text, x + padX, textY);
      textY += lineHeight;
    });
    ctx.restore();
  }

  function updateChartAnnotation() {
    if (chart) chart.update('none');
  }

  function setRateInputsEnabled(enabled) {
    rateInputs.forEach((input) => {
      input.disabled = !enabled;
    });
  }

  function getReferenceCycle() {
    const n = parseInt(inputReferenceCycle.value, 10);
    if (Number.isFinite(n) && n > 0) return n;
    return DEFAULT_REFERENCE_CYCLE;
  }

  function getDischargeAtCycle(cycles, dischargeValues, targetCycle) {
    for (let i = 0; i < cycles.length; i++) {
      if (cycles[i] === targetCycle) {
        const cap = dischargeValues[i];
        return Number.isFinite(cap) ? cap : NaN;
      }
    }
    return NaN;
  }

  function computeRetention(cycles, dischargeValues, referenceCycle) {
    const referenceCapacity = getDischargeAtCycle(
      cycles,
      dischargeValues,
      referenceCycle
    );
    const lastDischarge = lastFinite(dischargeValues);

    if (!Number.isFinite(referenceCapacity)) {
      return {
        found: false,
        referenceCycle,
        referenceCapacity: NaN,
        retention: NaN,
      };
    }

    const retention =
      Number.isFinite(lastDischarge) && referenceCapacity !== 0
        ? (lastDischarge / referenceCapacity) * 100
        : NaN;

    return {
      found: true,
      referenceCycle,
      referenceCapacity,
      retention,
    };
  }

  function setReferenceCycleEnabled(enabled) {
    inputReferenceCycle.disabled = !enabled;
  }

  function resetStats() {
    statChargeInitial.textContent = '—';
    statChargeFinal.textContent = '—';
    statDischargeInitial.textContent = '—';
    statDischargeFinal.textContent = '—';
    statReferenceCycle.textContent = '—';
    statReferenceCapacity.textContent = '—';
    statRetention.textContent = '—';
    statCeAvg.textContent = '—';
    statCeFirst.textContent = '—';
    statCeLast.textContent = '—';
    lastRetentionResult = null;
  }

  function updateRetentionStats(data) {
    const { cycles, dischargeValues, hasDischarge } = data;
    const referenceCycle = getReferenceCycle();
    const cycleCount = getLastCycleNumber(cycles);

    statReferenceCycle.textContent = String(referenceCycle);

    if (!hasDischarge) {
      statReferenceCapacity.textContent = '—';
      statRetention.textContent = '—';
      lastRetentionResult = {
        found: false,
        referenceCycle,
        referenceCapacity: NaN,
        retention: NaN,
        cycleCount,
      };
      return { found: false };
    }

    const result = computeRetention(cycles, dischargeValues, referenceCycle);
    lastRetentionResult = { ...result, cycleCount };

    statReferenceCapacity.textContent = result.found
      ? formatCapacity(result.referenceCapacity)
      : '—';
    statRetention.textContent =
      result.found && Number.isFinite(result.retention)
        ? result.retention.toFixed(2)
        : '—';

    return { found: result.found };
  }

  function updateStats(data) {
    const { chargeValues, dischargeValues, ceValues, hasCharge, hasCe } = data;

    if (hasCharge) {
      statChargeInitial.textContent = formatCapacity(firstFinite(chargeValues));
      statChargeFinal.textContent = formatCapacity(lastFinite(chargeValues));
    } else {
      statChargeInitial.textContent = '—';
      statChargeFinal.textContent = '—';
    }

    const dInitial = firstFinite(dischargeValues);
    const dFinal = lastFinite(dischargeValues);

    statDischargeInitial.textContent = formatCapacity(dInitial);
    statDischargeFinal.textContent = formatCapacity(dFinal);

    const retentionResult = updateRetentionStats(data);

    if (hasCe) {
      updateCeStats(ceValues);
    } else {
      statCeAvg.textContent = '—';
      statCeFirst.textContent = '—';
      statCeLast.textContent = '—';
    }

    return retentionResult;
  }

  function updateCeStats(ceValues) {
    const valid = ceValues.filter(Number.isFinite);
    if (valid.length === 0) {
      statCeAvg.textContent = '—';
      statCeFirst.textContent = '—';
      statCeLast.textContent = '—';
      return;
    }
    const sum = valid.reduce((a, b) => a + b, 0);
    statCeAvg.textContent = formatCe(sum / valid.length);
    statCeFirst.textContent = formatCe(firstFinite(ceValues));
    statCeLast.textContent = formatCe(lastFinite(ceValues));
  }

  function destroyChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  function setAxisControlsEnabled(enabled, hasCe) {
    axisFieldsetX.disabled = !enabled;
    axisFieldsetCapacity.disabled = !enabled;
    axisFieldsetCe.disabled = !enabled || !hasCe;
    btnApplyAxis.disabled = !enabled;
    btnResetAxis.disabled = !enabled;
  }

  function clearAxisInputs() {
    axisInputs.forEach((input) => {
      input.value = '';
    });
  }

  function parseAxisInput(input) {
    const raw = input.value.trim();
    if (raw === '') return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }

  function getAxisLimits() {
    return {
      xMin: parseAxisInput(inputXMin),
      xMax: parseAxisInput(inputXMax),
      capacityMin: parseAxisInput(inputCapacityMin),
      capacityMax: parseAxisInput(inputCapacityMax),
      ceMin: parseAxisInput(inputCeMin),
      ceMax: parseAxisInput(inputCeMax),
    };
  }

  function emptyAxisLimits() {
    return {
      xMin: null,
      xMax: null,
      capacityMin: null,
      capacityMax: null,
      ceMin: null,
      ceMax: null,
    };
  }

  function applyLimitsToScale(scale, min, max) {
    if (min !== null && max !== null && min >= max) return;
    if (min !== null) scale.min = min;
    if (max !== null) scale.max = max;
  }

  function setTitleControlsEnabled(enabled, hasCe) {
    inputChartTitle.disabled = !enabled;
    inputXAxisTitle.disabled = !enabled;
    inputLeftYTitle.disabled = !enabled;
    inputRightYTitle.disabled = !enabled || !hasCe;
    btnResetTitles.disabled = !enabled;
    titleFieldRightY.classList.toggle(
      'title-field-right-y-disabled',
      !enabled || !hasCe
    );
  }

  function resetDefaultTitles() {
    inputChartTitle.value = DEFAULT_TITLES.chartTitle;
    inputXAxisTitle.value = DEFAULT_TITLES.xAxisTitle;
    inputLeftYTitle.value = DEFAULT_TITLES.leftYTitle;
    inputRightYTitle.value = DEFAULT_TITLES.rightYTitle;
  }

  function getChartTitles() {
    return {
      chartTitle: inputChartTitle.value.trim(),
      xAxisTitle: inputXAxisTitle.value.trim(),
      leftYTitle: inputLeftYTitle.value.trim(),
      rightYTitle: inputRightYTitle.value.trim(),
    };
  }

  function buildAxisScaleTitle(text, padding) {
    const label = String(text || '').trim();
    return {
      display: label.length > 0,
      text: label,
      ...AXIS_TITLE_STYLE,
      padding: padding || { top: 4 },
    };
  }

  function refreshChart(axisLimits) {
    if (!lastChartData) return;
    renderChart(lastChartData, axisLimits || getAxisLimits());
  }

  function lineDataset(label, points, style, yAxisID, fill) {
    return {
      label,
      data: points,
      yAxisID,
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      borderWidth: 1.5,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.05,
      fill: !!fill,
    };
  }

  function renderChart(data, axisLimits) {
    destroyChart();
    const limits = axisLimits || getAxisLimits();
    const titles = getChartTitles();
    const ctx = document.getElementById('cycle-chart').getContext('2d');
    const {
      cycles,
      chargeValues,
      dischargeValues,
      ceValues,
      hasCharge,
      hasDischarge,
      hasCe,
    } = data;

    chartPlaceholder.classList.add('hidden');
    btnExport.disabled = false;

    const datasets = [];

    if (hasCharge) {
      const chargePoints = cycles
        .map((c, i) => ({ x: c, y: chargeValues[i] }))
        .filter((p) => Number.isFinite(p.y));
      datasets.push(
        lineDataset(
          CHART_CHARGE.label,
          chargePoints,
          CHART_CHARGE,
          'y',
          true
        )
      );
    }

    if (hasDischarge) {
      const dischargePoints = cycles
        .map((c, i) => ({ x: c, y: dischargeValues[i] }))
        .filter((p) => Number.isFinite(p.y));
      datasets.push(
        lineDataset(
          CHART_DISCHARGE.label,
          dischargePoints,
          CHART_DISCHARGE,
          'y',
          !hasCharge
        )
      );
    }

    if (hasCe) {
      const cePoints = cycles
        .map((c, i) => ({ x: c, y: ceValues[i] }))
        .filter((p) => Number.isFinite(p.y));
      datasets.push({
        label: 'CE',
        data: cePoints,
        yAxisID: 'y1',
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.06)',
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.05,
        fill: false,
      });
    }

    const scales = {
      x: {
        type: 'linear',
        title: buildAxisScaleTitle(titles.xAxisTitle, { top: 8 }),
        ticks: {
          maxTicksLimit: 12,
          font: { family: 'Consolas, monospace', size: 11 },
          color: '#5c6573',
        },
        grid: { color: '#eef1f5' },
        border: { color: '#e2e6ec' },
      },
      y: {
        position: 'left',
        title: buildAxisScaleTitle(titles.leftYTitle),
        ticks: {
          font: { family: 'Consolas, monospace', size: 11 },
          color: '#5c6573',
        },
        grid: { color: '#eef1f5' },
        border: { color: '#e2e6ec' },
      },
    };

    applyLimitsToScale(scales.x, limits.xMin, limits.xMax);
    applyLimitsToScale(scales.y, limits.capacityMin, limits.capacityMax);

    if (hasCe) {
      scales.y1 = {
        position: 'right',
        title: buildAxisScaleTitle(titles.rightYTitle),
        ticks: {
          font: { family: 'Consolas, monospace', size: 11 },
          color: '#dc2626',
          callback(value) {
            return value + '%';
          },
        },
        grid: { drawOnChartArea: false, color: '#f3f4f6' },
        border: { color: '#e2e6ec' },
      };
      applyLimitsToScale(scales.y1, limits.ceMin, limits.ceMax);
    }

    chart = new Chart(ctx, {
      type: 'line',
      plugins: [experimentInfoPlugin],
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: { top: 4, right: 10, bottom: 4, left: 6 },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: titles.chartTitle.length > 0,
            text: titles.chartTitle,
            position: 'top',
            align: 'center',
            font: {
              size: 14,
              weight: '600',
              family: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
            },
            color: '#1a1d23',
            padding: { top: 2, bottom: 10 },
          },
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 2,
              padding: 12,
              font: { size: 11, family: 'Segoe UI, sans-serif' },
              color: '#1a1d23',
              usePointStyle: false,
            },
          },
          tooltip: {
            callbacks: {
              title(items) {
                return 'Cycle ' + items[0].parsed.x;
              },
              label(ctx) {
                if (ctx.dataset.label === 'CE') {
                  return 'CE: ' + formatCe(ctx.parsed.y) + '%';
                }
                return (
                  ctx.dataset.label + ': ' + formatCapacity(ctx.parsed.y)
                );
              },
            },
          },
        },
        scales,
      },
    });
  }

  function processFile(file) {
    setMessage('');
    fileNameEl.textContent = file.name;

    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        let rows;
        if (ext === 'csv') {
          const wb = XLSX.read(e.target.result, { type: 'string' });
          rows = sheetToRows(wb);
        } else if (ext === 'xlsx' || ext === 'xls') {
          const wb = XLSX.read(new Uint8Array(e.target.result), {
            type: 'array',
          });
          rows = sheetToRows(wb);
        } else {
          throw new Error('不支持的文件格式');
        }

        const data = rowsToSeries(rows);
        lastChartData = data;
        clearAxisInputs();
        setAxisControlsEnabled(true, data.hasCe);
        setTitleControlsEnabled(true, data.hasCe);
        setReferenceCycleEnabled(true);
        setRateInputsEnabled(true);
        const retentionResult = updateStats(data);
        renderChart(data);

        let msg = '已加载 ' + data.cycles.length + ' 个循环点';
        const parts = [];
        if (data.hasCharge) parts.push('Charge');
        if (data.hasDischarge) parts.push('Discharge');
        if (parts.length) msg += '（' + parts.join(' + ') + '）';
        if (data.hasCe) msg += '，含 CE';
        if (data.hasDischarge && !retentionResult.found) {
          msg += '；Reference cycle not found';
        }
        setMessage(
          msg,
          data.hasDischarge && !retentionResult.found ? 'warn' : 'success'
        );
      } catch (err) {
        destroyChart();
        lastChartData = null;
        clearAxisInputs();
        setAxisControlsEnabled(false, false);
        setTitleControlsEnabled(false, false);
        setReferenceCycleEnabled(false);
        setRateInputsEnabled(false);
        chartPlaceholder.classList.remove('hidden');
        btnExport.disabled = true;
        resetStats();
        setMessage(err.message || '解析失败', 'error');
      }
    };

    reader.onerror = function () {
      setMessage('文件读取失败', 'error');
    };

    if (ext === 'csv') {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setMessage('请上传 .xlsx、.xls 或 .csv 文件', 'error');
      return;
    }
    processFile(file);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (ev) => {
    handleFiles(ev.target.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((type) => {
    dropzone.addEventListener(type, (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (ev) => {
    handleFiles(ev.dataTransfer.files);
  });

  btnExport.addEventListener('click', () => {
    if (!chart) return;
    const url = chart.toBase64Image('image/png', 1);
    const link = document.createElement('a');
    link.download = 'cycle_analysis_' + Date.now() + '.png';
    link.href = url;
    link.click();
  });

  function hasManualAxisLimits(limits) {
    return (
      limits.xMin !== null ||
      limits.xMax !== null ||
      limits.capacityMin !== null ||
      limits.capacityMax !== null ||
      limits.ceMin !== null ||
      limits.ceMax !== null
    );
  }

  function applyAxisRange() {
    if (!lastChartData) return;
    const limits = getAxisLimits();
    refreshChart(limits);
    setMessage(
      hasManualAxisLimits(limits) ? '已应用坐标轴范围' : '已恢复自动范围',
      'success'
    );
  }

  btnApplyAxis.addEventListener('click', applyAxisRange);

  btnResetAxis.addEventListener('click', () => {
    if (!lastChartData) return;
    clearAxisInputs();
    refreshChart(emptyAxisLimits());
    setMessage('已恢复自动范围', 'success');
  });

  btnResetTitles.addEventListener('click', () => {
    if (!lastChartData) return;
    resetDefaultTitles();
    refreshChart();
    setMessage('已恢复默认标题', 'success');
  });

  axisInputs.forEach((input) => {
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !btnApplyAxis.disabled) {
        ev.preventDefault();
        applyAxisRange();
      }
    });
  });

  titleInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!lastChartData || input.disabled) return;
      refreshChart();
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !input.disabled && lastChartData) {
        ev.preventDefault();
        refreshChart();
      }
    });
  });

  function onReferenceCycleChange() {
    if (!lastChartData) return;
    const result = updateRetentionStats(lastChartData);
    if (!result.found && lastChartData.hasDischarge) {
      setMessage('Reference cycle not found', 'warn');
    }
    updateChartAnnotation();
  }

  inputReferenceCycle.addEventListener('change', onReferenceCycleChange);
  inputReferenceCycle.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !inputReferenceCycle.disabled) {
      ev.preventDefault();
      onReferenceCycleChange();
    }
  });

  rateInputs.forEach((input) => {
    input.addEventListener('input', () => {
      if (!chart || input.disabled) return;
      updateChartAnnotation();
    });
  });
})();
