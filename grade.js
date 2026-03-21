// 6. SCORE MATH & LOGIC
// =====================================================
const ScoreLogic = {
  getTarget: t => App.isSemMode ? 100 : 50,
  getUnitsMax: t => (App.units[t] ||[]).reduce((s, u) => s + (Number(u.max) || 0), 0),
  getExamMax: t => Math.max(0, ScoreLogic.getTarget(t) - ScoreLogic.getUnitsMax(t)),
  getUnitRawMax: (t, uIdx) => ((App.units[t][uIdx] || {}).items ||[]).reduce((s, i) => s + (Number(i.max) || 0), 0),
  getUnitOffsets: t => {
    let off = 0;
    return (App.units[t] ||[]).map((u, i) => { const c = (u.items ||[]).length; const obj = { unitIndex: i, start: off, count: c }; off += c; return obj; });
  },
  getFlatItems: t => {
    const out = [];
    (App.units[t] ||[]).forEach((u, ui) => (u.items ||[]).forEach((item, ii) => out.push({ term: t, unitIndex: ui, itemIndex: ii, unitName: u.name, unitMax: Number(u.max)||0, itemName: item.name, itemMax: Number(item.max)||0 })));
    return out;
  },
  calcScaled: (raw, rawMax, scaledMax) => {
    raw = Number(raw)||0; rawMax = Number(rawMax)||0; scaledMax = Number(scaledMax)||0;
    if (rawMax <= 0 || scaledMax <= 0) return 0;
    return Math.round((raw / rawMax) * scaledMax * 100) / 100;
  },
  calcKeepFromFlat: (t, flatVals) => {
    let total = 0;
    ScoreLogic.getUnitOffsets(t).forEach(({ unitIndex, start, count }) => {
      const rawMax = ScoreLogic.getUnitRawMax(t, unitIndex);
      let raw = 0;
      for (let i = 0; i < count; i++) raw += Number(flatVals[start + i]) || 0;
      total += ScoreLogic.calcScaled(raw, rawMax, Number(App.units[t][unitIndex].max) || 0);
    });
    return Math.round(total * 100) / 100;
  },
  syncHiddenInputs: () => {['c_t1a','c_t1e','c_t2a','c_t2e'].forEach(id => { if (!$(id)) { const i = document.createElement('input'); i.type = 'hidden'; i.id = id; document.body.appendChild(i); } });
    $('c_t1a').value = ScoreLogic.getUnitsMax(1); $('c_t1e').value = ScoreLogic.getExamMax(1);
    $('c_t2a').value = App.isSemMode ? 0 : ScoreLogic.getUnitsMax(2); $('c_t2e').value = App.isSemMode ? 0 : ScoreLogic.getExamMax(2);
  }
};

// =====================================================
// 7. UI SETTINGS & DATA LOAD
// =====================================================
function normalizeUnits(t) {
  if (!Array.isArray(App.units[t])) App.units[t] = [];
  App.units[t] = App.units[t].map((u, idx) => {
    const items = Array.isArray(u?.items) ? u.items.map((item, ii) => ({
      name: item?.name || `งาน ${ii + 1}`,
      max: Number(item?.max) || 0
    })) : [{ name: "งาน 1", max: Number(u?.max) || 10 }];

    return {
      name: u?.name || `หน่วยที่ ${idx + 1}`,
      max: Number(u?.max) || 0,
      items,
      indicators: Array.isArray(u?.indicators) ? [...new Set(u.indicators.map(String))] : []
    };
  });
}

function updateAutoScoreDisplay() {
  const setScoreTxt = (t) => {
    const k = ScoreLogic.getUnitsMax(t), e = ScoreLogic.getExamMax(t);
    if ($(`show_t${t}_keep`)) $(`show_t${t}_keep`).textContent = k;
    if ($(`show_t${t}_exam`)) $(`show_t${t}_exam`).textContent = e;
    if ($(`sum_t${t}_units`)) $(`sum_t${t}_units`).textContent = k;
  };
  setScoreTxt(1); if (!App.isSemMode) setScoreTxt(2);
}

function refreshUnitPanelLabels() {
  if ($('sum_t1_units')?.parentElement) $('sum_t1_units').parentElement.innerHTML = `<span>คะแนนรวมทุกหน่วย เทอม 1:</span><strong id="sum_t1_units">${ScoreLogic.getUnitsMax(1)}</strong><span>/</span><span class="res">${App.isSemMode ? '100' : '50'}</span>`;
  if ($('sum_t2_units')?.parentElement) $('sum_t2_units').parentElement.innerHTML = `<span>คะแนนรวมทุกหน่วย เทอม 2:</span><strong id="sum_t2_units">${ScoreLogic.getUnitsMax(2)}</strong><span>/</span><span class="res">50</span>`;
  if ($('t2AutoBlock')) $('t2AutoBlock').style.display = App.isSemMode ? 'none' : 'flex';
  if ($('tabTerm2Btn')) $('tabTerm2Btn').style.display = App.isSemMode ? 'none' : 'block';
  updateAutoScoreDisplay();
}

function switchTerm(t, btn) {
  if (btn?.closest('.ttabs')) btn.closest('.ttabs').querySelectorAll('.ttab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  $('subPanel_1').style.display = t === 1 ? '' : 'none'; $('subPanel_2').style.display = t === 2 ? '' : 'none';
}

function normalizeIndicatorBuckets(indicators) {
  if (indicators && typeof indicators === 'object' && !Array.isArray(indicators)) {
    const formative = Array.isArray(indicators.formative) ? indicators.formative : [];
    const summative = Array.isArray(indicators.summative) ? indicators.summative : [];
    return {
      formative: formative.map(v => String(v || '').trim()).filter(Boolean),
      summative: summative.map(v => String(v || '').trim()).filter(Boolean)
    };
  }

  const legacy = String(indicators || '')
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter(Boolean);

  return { formative: legacy, summative: [] };
}

function getIndicatorCatalog() {
  const formative = String($('ci_indicators_formative')?.value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  const summative = String($('ci_indicators_summative')?.value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  return [
    ...formative.map((text, idx) => ({ key: `F${idx + 1}`, text, type: 'formative', label: `ระหว่างทาง ${idx + 1}` })),
    ...summative.map((text, idx) => ({ key: `S${idx + 1}`, text, type: 'summative', label: `ปลายทาง ${idx + 1}` }))
  ];
}

function getIndicatorMap() {
  return Object.fromEntries(getIndicatorCatalog().map(item => [item.key, item]));
}

function getUnitIndicatorBadges(unit) {
  const imap = getIndicatorMap();
  return (unit?.indicators || []).map(key => imap[key]).filter(Boolean);
}

function getIndicatorUsageOverview() {
  const catalog = getIndicatorCatalog();
  const byKey = Object.fromEntries(catalog.map(item => [item.key, { ...item, units: [] }]));
  const terms = App.isSemMode ? [1] : [1, 2];

  terms.forEach(t => {
    (App.units?.[t] || []).forEach((unit, ui) => {
      const unitName = String(unit?.name || `หน่วย ${ui + 1}`).trim() || `หน่วย ${ui + 1}`;
      const keys = Array.isArray(unit?.indicators) ? [...new Set(unit.indicators.map(String))] : [];
      keys.forEach(key => {
        if (!byKey[key]) return;
        byKey[key].units.push({
          term: t,
          unitIndex: ui,
          unitName,
          shortLabel: `ท${t} · ${unitName}`
        });
      });
    });
  });

  const all = Object.values(byKey);
  return {
    total: all.length,
    used: all.filter(item => item.units.length),
    unused: all.filter(item => !item.units.length)
  };
}

function renderIndicatorCoverageSummary() {
  const wrap = $('indicatorCoverageGlobal');
  if (!wrap) return;

  const overview = getIndicatorUsageOverview();
  if (!overview.total) {
    wrap.innerHTML = `
      <div class="coverage-head">
        <div class="coverage-title">สรุปการผูกตัวชี้วัดกับหน่วยการเรียนรู้</div>
      </div>
      <div class="coverage-empty">ยังไม่มีตัวชี้วัดในหน้ารายวิชา กรุณากำหนดตัวชี้วัดระหว่างทางหรือปลายทางก่อน</div>
    `;
    return;
  }

  const renderItem = (item, withLinks) => `
    <div class="coverage-item">
      <div class="coverage-item-top"><strong>${item.label}</strong>${item.text}</div>
      ${withLinks ? `
        <div class="coverage-links">
          ${item.units.map(u => `<span class="coverage-link">${u.shortLabel}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  wrap.innerHTML = `
    <div class="coverage-head">
      <div class="coverage-title">สรุปการผูกตัวชี้วัดกับหน่วยการเรียนรู้</div>
      <div class="coverage-stats">
        <span class="coverage-stat total">ทั้งหมด ${overview.total} ข้อ</span>
        <span class="coverage-stat used">ผูกแล้ว ${overview.used.length} ข้อ</span>
        <span class="coverage-stat unused">ยังไม่ผูก ${overview.unused.length} ข้อ</span>
      </div>
    </div>
    <div class="coverage-grid">
      <div class="coverage-col">
        <div class="coverage-col-title warn">ตัวชี้วัดที่ยังไม่ถูกผูกกับหน่วยใดเลย</div>
        ${overview.unused.length ? `
          <div class="coverage-list">
            ${overview.unused.map(item => renderItem(item, false)).join('')}
          </div>
        ` : `<div class="coverage-empty">ครบแล้ว ทุกตัวชี้วัดถูกผูกกับหน่วยการเรียนรู้แล้ว</div>`}
      </div>
      <div class="coverage-col">
        <div class="coverage-col-title ok">ตัวชี้วัดที่ผูกแล้ว</div>
        ${overview.used.length ? `
          <div class="coverage-list">
            ${overview.used.map(item => renderItem(item, true)).join('')}
          </div>
        ` : `<div class="coverage-empty">ยังไม่มีตัวชี้วัดที่ถูกผูกกับหน่วยการเรียนรู้</div>`}
      </div>
    </div>
  `;
}

function toggleUnitIndicator(t, ui, key, checked) {
  const unit = App.units?.[t]?.[ui];
  if (!unit) return;
  const current = new Set(Array.isArray(unit.indicators) ? unit.indicators : []);
  if (checked) current.add(key); else current.delete(key);
  unit.indicators = [...current];
  renderSubList(t);
}

function setActiveUnitTab(t, idx) {
  App.activeUnitTab[t] = idx;
  renderSubList(t);
}

function addSub(t) {
  App.units[t].push({
    name: `หน่วยที่ ${App.units[t].length + 1}`,
    max: 10,
    items: [{ name: "งาน 1", max: 10 }]
  });
  App.activeUnitTab[t] = App.units[t].length - 1;
  renderSubList(t);
}

function rmSub(t, ui) {
  if (!confirm(`ลบ "${App.units[t][ui].name}" ?`)) return;
  App.units[t].splice(ui, 1);
  if (App.activeUnitTab[t] >= App.units[t].length) {
    App.activeUnitTab[t] = Math.max(0, App.units[t].length - 1);
  }
  renderSubList(t);
}

function addSubItem(t, ui) {
  App.units[t][ui].items.push({
    name: `งาน ${App.units[t][ui].items.length + 1}`,
    max: 10
  });
  renderSubList(t);
}

function rmSubItem(t, ui, ii) {
  if (!confirm('ลบงานนี้?')) return;
  App.units[t][ui].items.splice(ii, 1);
  renderSubList(t);
}

function renderUnitTabs(t) {
  const wrap = $(`unitTabs_${t}`);
  if (!wrap) return;

  const units = App.units[t] || [];
  if (!units.length) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = units.map((u, i) => `
    <button type="button" class="unit-tab ${App.activeUnitTab[t] === i ? 'active' : ''}" onclick="setActiveUnitTab(${t}, ${i})">
      ${u.name || `หน่วย ${i + 1}`}
    </button>
  `).join('');
}

function renderUnitEditor(t) {
  const wrap = $(`unitEditor_${t}`);
  if (!wrap) return;

  const units = App.units[t] || [];
  if (!units.length) {
    wrap.innerHTML = `<div class="unit-empty">ยังไม่มีหน่วยการเรียนรู้</div>`;
    return;
  }

  if (App.activeUnitTab[t] >= units.length) App.activeUnitTab[t] = units.length - 1;
  if (App.activeUnitTab[t] < 0) App.activeUnitTab[t] = 0;

  const ui = App.activeUnitTab[t];
  const unit = units[ui];
  const catalog = getIndicatorCatalog();
  const grouped = {
    formative: catalog.filter(item => item.type === 'formative'),
    summative: catalog.filter(item => item.type === 'summative')
  };
  const selectedBadges = getUnitIndicatorBadges(unit);

  const renderIndicatorGroup = (title, type, items) => `
    <div class="indicator-group">
      <div class="indicator-group-title">${title} <small>${items.length} ข้อ</small></div>
      ${items.length ? `
        <div class="indicator-list">
          ${items.map(item => `
            <label class="indicator-item">
              <input type="checkbox" ${Array.isArray(unit.indicators) && unit.indicators.includes(item.key) ? 'checked' : ''}
                onchange="toggleUnitIndicator(${t}, ${ui}, '${item.key}', this.checked)">
              <span class="indicator-item-text"><strong>${item.label}</strong> ${item.text}</span>
            </label>
          `).join('')}
        </div>
      ` : `<div class="indicator-empty">ยังไม่ได้กำหนดตัวชี้วัด${type === 'formative' ? 'ระหว่างทาง' : 'ปลายทาง'}ในหน้ารายวิชา</div>`}
    </div>
  `;

  wrap.innerHTML = `
    <div class="unit-editor-card">
      <div class="unit-editor-head">
        <span class="sub-n">${ui + 1}.</span>
        <input class="sub-name" type="text" value="${unit.name || ''}" placeholder="ชื่อหน่วย" onchange="App.units[${t}][${ui}].name=this.value;renderSubList(${t});">

        <span class="sub-max-lbl">คะแนนเต็ม</span>
        <input class="sub-max" type="number" min="1" value="${Number(unit.max) || 0}" onchange="App.units[${t}][${ui}].max=Number(this.value)||0;updateAutoScoreDisplay();renderSubList(${t});">

        <button class="btn-rm" onclick="rmSub(${t}, ${ui})">✕</button>
      </div>

      <div class="d-flex flex-column gap-2">
        ${(unit.items || []).map((item, ii) => `
          <div class="unit-item-row">
            <input class="sub-name" type="text" value="${item.name || ''}" placeholder="ชื่องาน" onchange="App.units[${t}][${ui}].items[${ii}].name=this.value">
            <span class="sub-max-lbl">เต็ม</span>
            <input class="sub-max" type="number" min="1" value="${Number(item.max) || 0}" onchange="App.units[${t}][${ui}].items[${ii}].max=Number(this.value)||0;renderSubList(${t});">
            <button class="btn-rm" onclick="rmSubItem(${t}, ${ui}, ${ii})">✕</button>
          </div>
        `).join('')}
      </div>

      <button type="button" class="btn-add-sub mt-2" onclick="addSubItem(${t}, ${ui})">＋ เพิ่มงาน</button>

      <div class="unit-meta-grid">
        <div class="unit-meta-card">
          <div class="unit-meta-title">ตัวชี้วัดที่ใช้ในหน่วยนี้</div>
          <div class="indicator-grid">
            ${renderIndicatorGroup('ตัวชี้วัดระหว่างทาง', 'formative', grouped.formative)}
            ${renderIndicatorGroup('ตัวชี้วัดปลายทาง', 'summative', grouped.summative)}
          </div>
          ${selectedBadges.length ? `
            <div class="indicator-badge-list">
              ${selectedBadges.map(item => `<span class="indicator-badge ${item.type}">${item.label}</span>`).join('')}
            </div>
          ` : `<div class="unit-meta-note">ยังไม่ได้เลือกตัวชี้วัดให้หน่วยนี้</div>`}
        </div>
      </div>

      <div class="raw-preview mt-2">คะแนนดิบรวมของงาน: <strong>${ScoreLogic.getUnitRawMax(t, ui)}</strong> | คะแนนที่เก็บเข้าหน่วย: <strong class="res">${Number(unit.max) || 0}</strong></div>
    </div>
  `;
}

function renderSubList(t) {
  if (!Array.isArray(App.units[t])) App.units[t] = [];
  if (App.activeUnitTab[t] == null) App.activeUnitTab[t] = 0;
  if (App.activeUnitTab[t] >= App.units[t].length) {
    App.activeUnitTab[t] = Math.max(0, App.units[t].length - 1);
  }

  renderUnitTabs(t);
  renderUnitEditor(t);
  renderIndicatorCoverageSummary();
  updateAutoScoreDisplay();
}

function toggleCols(t) { App.expanded[t] = !App.expanded[t]; $('gtbl').classList.toggle(`t${t}-collapsed`, !App.expanded[t]); if ($(`tbtn${t}`)) $(`tbtn${t}`).innerHTML = `<span class="arr">${App.expanded[t] ? '▼' : '▶'}</span> ${App.expanded[t] ? 'ยุบ' : 'ขยาย'}`; }
function toggleIgnoreR() { App.ignoreR = $('toggleR').checked; $$('#gtBody tr[data-sid]').forEach(tr => recalcTots(tr)); }

async function loadGrades() {
  const year = $('gYear').value, cls = $('gClass').value, subj = $('gSubj').value;
  if (!subj || subj === "-- ไม่พบวิชา --") return Utils.toast('กรุณาเลือกวิชาที่ถูกต้อง', 'error');

  App.isSemMode = cls.includes("เทอม");
  $('lblClass').textContent = cls; $('lblSubj').textContent = subj;
  Utils.showLoading('กำลังโหลดข้อมูล...');
  $('toggleRWrapper').style.display = App.isSemMode ? 'flex' : 'none'; $('toggleR').checked = false; App.ignoreR = false;

  try {
    const res = await api('getGrades', { year, classroom: cls, subject: subj });
    App.config = res.config || {};
App.courseInfo = res.config?.courseInfo || {};
    App.termDates = res.termDates || {};
App.holidays = res.holidays || [];
App.config = res.config || {};
App.courseInfo = res.config?.courseInfo || {};
    App.termDates = res.termDates || {}; 
    App.holidays = res.holidays ||[];
        App.homeroomTeacher = res.homeroomTeacher || "-"; 

    ScoreLogic.syncHiddenInputs();

    setCourseInfoForm(res.config?.courseInfo || {}, subj);
    try { setSchoolProfileForm(await api('getSchoolProfile', {}) || {}); } catch(e) { setSchoolProfileForm({}); }

    if (App.isSemMode) {
      if ($('tabTerm2Btn')) $('tabTerm2Btn').style.display = 'none';
      const btnAddT1 = document.querySelector('.btn-add-sub[onclick="addSub(1)"]');
      if (btnAddT1) btnAddT1.textContent = "＋ เพิ่มหัวข้อคะแนนย่อย";
      const t1TabBtn = document.querySelector('.ttab[onclick*="switchTerm(1"]');
      if (t1TabBtn) switchTerm(1, t1TabBtn);
      App.units[2] =[];
    }
    App.units[1] = res.config?.units?.t1 || res.config?.subItems?.t1 || [];
    if (!App.isSemMode) App.units[2] = res.config?.units?.t2 || res.config?.subItems?.t2 ||[];

    App.activeUnitTab = { 1: 0, 2: 0 };

    normalizeUnits(1); normalizeUnits(2); renderSubList(1); if (!App.isSemMode) renderSubList(2);
    refreshUnitPanelLabels(); updateAutoScoreDisplay();

    // ── โหลด rtw_data + guidance_data (แยก term) แล้ว merge เข้า students ──
    let rtwMap = {}, guidanceMap1 = {}, guidanceMap2 = {}, scoutMap1 = {}, scoutMap2 = {};
    try {
      [rtwMap, guidanceMap1, guidanceMap2, scoutMap1, scoutMap2] = await Promise.all([
        api('getRTWData',      { year, classroom: cls, subject: subj }),
        api('getGuidanceData', { year, classroom: cls, term: '1' }),
        api('getGuidanceData', { year, classroom: cls, term: '2' }),
        api('getScoutData',    { year, classroom: cls, term: '1' }),
        api('getScoutData',    { year, classroom: cls, term: '2' })
      ]);
    } catch (e) { /* ถ้ายังไม่มีชีท ไม่ error */ }

    // แยก topics/teachers metadata ออกจาก map แล้วเก็บใน App.guidanceData
    function extractGuidanceMeta(gmap) {
      var topics  = (gmap && gmap['__topics__'])  || [];
      var teacher = (gmap && gmap['__teacher__']) || '';
      var day     = (gmap && gmap['__day__'])     || '5';
      var clean   = {};
      Object.keys(gmap || {}).forEach(function(k) {
        if (k !== '__topics__' && k !== '__teacher__' && k !== '__day__') clean[k] = gmap[k];
      });
      clean._topics  = topics;
      clean._teacher = teacher;
      clean._day     = day; // วันเรียน (1-5)
      return clean;
    }

    App.guidanceData = {
      '1': extractGuidanceMeta(guidanceMap1),
      '2': extractGuidanceMeta(guidanceMap2)
    };
    App.scoutData = {
      '1': extractGuidanceMeta(scoutMap1),
      '2': extractGuidanceMeta(scoutMap2)
    };

    App.students = (res.students || []).map(s => ({
      ...s,
      rtw_data      : rtwMap[s.studentId]      || {},
      guidance_data : guidanceMap1[s.studentId] || {},
      scout_data    : scoutMap1[s.studentId]    || {}
    }));
    App.expanded = { 1: true, 2: true };
    $('gradePanel').style.display = '';
    buildTable();

    // ── toggle ปุ่ม ปพ.6 ตาม mode ──
    const isSem = App.isSemMode;
    if ($('btnPp6T1'))   $('btnPp6T1').style.display   = isSem ? 'none' : '';
    if ($('btnPp6Year')) $('btnPp6Year').style.display  = isSem ? 'none' : '';
    if ($('btnPp6Sem'))  $('btnPp6Sem').style.display   = isSem ? ''     : 'none';
    renderHolisticTable(App.students, 'assContainer', 'assBody', 'subject');
    renderHolisticTable(App.students, 'hrAssContainer', 'hrAssBody', 'homeroom');
    renderRTWTable();
    renderGuidanceTable();
    if (typeof renderScoutTable === 'function') renderScoutTable();

    showScoreMain($('tabScoreMain'));
    Utils.toast(`โหลดข้อมูลสำเร็จ: โหมด${App.isSemMode ? 'มัธยม (รายภาคเรียน)' : 'ประถม (รายปี)'}`);
  } catch (e) { Utils.toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); $('gradePanel').style.display = 'none'; }
  Utils.hideLoading();
}

// =====================================================
// 8. TABLE GENERATOR
// =====================================================
function buildTable() { buildHead(); buildBody(); $('gtbl').classList.remove('t1-collapsed', 't2-collapsed'); App.expanded = { 1: true, 2: true }; }

function buildHead() {
  ScoreLogic.syncHiddenInputs();
  let r1 = `<th rowspan="3" class="th-base s-c0" style="width:36px;">ที่</th><th rowspan="3" class="th-base s-c1" style="width:72px;">รหัส</th><th rowspan="3" class="th-base s-c2" style="text-align:left;min-width:145px;">ชื่อ-นามสกุล</th><th rowspan="3" class="th-att" style="width:115px;">มาเรียน</th>`;
  let r2 = '', r3 = '';

  const addTermHeaders = (t) => {
    const flat = ScoreLogic.getFlatItems(t), units = App.units[t] ||[], target = ScoreLogic.getTarget(t);
    const lblT = App.isSemMode ? '' : ` ท.${t}`;
    if (flat.length > 0) r1 += `<th colspan="${flat.length + units.length}" class="th-t${t}s sc${t}">📝 หน่วย / งาน เทอม ${t}</th>`;
    r1 += `<th rowspan="3" class="th-t${t}sc" style="width:88px;"><div style="margin-bottom:3px;">${App.isSemMode ? 'คะแนนเก็บ' : 'เก็บ'+lblT}<br><small>(${ScoreLogic.getUnitsMax(t)})</small></div>${flat.length > 0 ? `<button class="tbtn" id="tbtn${t}" onclick="toggleCols(${t})"><span class="arr">▼</span> ยุบ</button>` : ''}</th>
           <th rowspan="3" class="th-t${t}e" style="width:72px;">${App.isSemMode ? 'สอบ' : 'สอบ'+lblT}<br><small>(${ScoreLogic.getExamMax(t)})</small></th>
           <th rowspan="3" class="th-t${t}t" style="width:72px;">รวม${lblT}<br><small>(${target})</small></th>`;
    
    units.forEach(u => {
      const c = (u.items ||[]).length;
      if (c > 0) {
        r2 += `<th colspan="${c + 1}" class="th-t${t}si sc${t}">${u.name}<br><small>หน่วย ${Number(u.max)||0} คะแนน</small></th>`;
        (u.items ||[]).forEach(item => r3 += `<th class="th-t${t}raw sc${t}">${item.name}<br><small>(${Number(item.max)||0})</small></th>`);
        r3 += `<th class="th-t${t}sc sc${t}">รวมหน่วย</th>`;
      }
    });
  };

  addTermHeaders(1);
  if (App.isSemMode) r1 += `<th rowspan="3" class="th-base" style="width:65px;background:#475569;color:#fff;">สถานะ</th>`;
  else {
    addTermHeaders(2);
    r1 += `<th rowspan="3" class="th-sum-keep" style="width:80px;">รวมเก็บ<br><small>(ท.1+ท.2)</small><br><small style="opacity:.8;">(${ScoreLogic.getUnitsMax(1)+ScoreLogic.getUnitsMax(2)})</small></th>
           <th rowspan="3" class="th-sum-exam" style="width:80px;">รวมสอบ<br><small>(ท.1+ท.2)</small><br><small style="opacity:.8;">(${ScoreLogic.getExamMax(1)+ScoreLogic.getExamMax(2)})</small></th>
           <th rowspan="3" class="th-grand" style="width:74px;">รวม<br>ทั้งปี</th>`;
  }
  r1 += `<th rowspan="3" style="width:65px;background:#4f46e5;color:#fff;font-size:15px;border-right:1px solid rgba(255,255,255,.12);vertical-align:middle;">เกรด</th>`;
  $('gtHead').innerHTML = `<tr>${r1}</tr><tr>${r2}</tr><tr>${r3}</tr>`;
}

function buildBody() {
  ScoreLogic.syncHiddenInputs();
  if (!App.students.length) return $('gtBody').innerHTML = `<tr><td colspan="50" class="text-center py-4 text-muted">ไม่พบข้อมูลผู้เรียน</td></tr>`;

  const buildTermCells = (t, s) => {
    const flatVals = Array.isArray(s.grades?.[`t${t}_sub`]) ? s.grades[`t${t}_sub`] :[];
    let cells = '';
    ScoreLogic.getUnitOffsets(t).forEach(({ unitIndex, start, count }) => {
      const unit = App.units[t][unitIndex];
      let raw = 0;
      for (let i = 0; i < count; i++) {
        const val = flatVals[start + i] ?? '';
        raw += Number(val) || 0;
        cells += `<td class="td-sub${t} sc${t}"><input type="number" class="sinput sub${t} ${t===2?'t2':''}" min="0" max="${Number((unit.items||[])[i]?.max)||0}" value="${val}" data-term="${t}" data-unit="${unitIndex}" data-item="${i}" oninput="calcSub(this, ${t})"></td>`;
      }
      cells += `<td class="td-sc${t} sc${t} unit-total-${t}" data-unit="${unitIndex}">${ScoreLogic.calcScaled(raw, ScoreLogic.getUnitRawMax(t, unitIndex), Number(unit.max)||0) || '-'}</td>`;
    });
    const keep = ScoreLogic.calcKeepFromFlat(t, flatVals), exam = Number(s.grades?.[`t${t}_exam`]) || 0, total = keep + exam;
    cells += `<td class="td-sc${t}"><span class="t${t}sc">${keep || '-'}</span></td>
              <td><input type="number" class="sinput ${t===2?'t2':''} s-t${t}e" min="0" max="${ScoreLogic.getExamMax(t)}" value="${s.grades?.[`t${t}_exam`] ?? ''}" oninput="calcExam(this)"></td>
              <td><span class="tbadge ${total === 0 && !App.isSemMode ? 'nil' : (total >= (App.isSemMode?50:25) ? 'ok' : 'fail')} t${t}tot">${total || '-'}</span></td>`;
    return { cells, keep, exam, total };
  };

  $('gtBody').innerHTML = App.students.map((s, idx) => {
    const st = s.stats || {}, t1 = buildTermCells(1, s);
    let html = `<tr data-sid="${s.studentId}">
      <td class="s-c0">${idx + 1}</td><td class="s-c1">${s.studentId}</td>
      <td class="s-c2"><div class="d-flex justify-content-between align-items-center gap-1"><span>${s.name}</span><div class="d-flex gap-1"><button class="btn-sm" style="padding:2px 7px;font-size:0.72rem;background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;" onclick="printRowPDF('${s.studentId}','term1')">T1</button><button class="btn-sm" style="padding:2px 8px;font-size:0.75rem;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;" onclick="printRowPDF('${s.studentId}','year')">🖨️</button></div></div></td>
      <td><span class="sp p">ม ${st.present || 0}</span> <span class="sp a">ข ${st.absent || 0}</span> <span class="sp l">ล ${st.leave || 0}</span></td>${t1.cells}`;

    let finalScore = t1.total, isR = false;

    if (App.isSemMode) {
      let rStat = String(s.grades?.t2_acc || 'ปกติ').trim();
      if (rStat !== 'ติด ร' && rStat !== 'แก้ ร') rStat = 'ปกติ';
      if (!App.ignoreR && rStat === 'ติด ร') isR = true;
      html += `<td style="background:#f8fafc;"><select class="sinput r-status" style="width:55px;font-size:0.75rem;padding:2px;text-align:center;cursor:pointer;" onchange="recalcTots(this.closest('tr'))"><option value="ปกติ" ${rStat === 'ปกติ' ? 'selected' : ''}>-</option><option value="ติด ร" ${rStat === 'ติด ร' ? 'selected' : ''}>ติด ร</option><option value="แก้ ร" ${rStat === 'แก้ ร' ? 'selected' : ''}>แก้ ร</option></select></td>`;
    } else {
      const t2 = buildTermCells(2, s);
      finalScore = t1.total + t2.total;
      html += `${t2.cells}
        <td class="td-sum-keep"><span class="sbadge-keep sum-keep">${Math.round((t1.keep + t2.keep) * 100) / 100 || '-'}</span></td>
        <td class="td-sum-exam"><span class="sbadge-exam sum-exam">${t1.exam + t2.exam || '-'}</span></td>
        <td><span class="gbadge ${finalScore === 0 ? 'nil' : finalScore < 50 ? 'fail' : 'ok'} gtot">${finalScore || '-'}</span></td>`;
    }

    html += `<td style="background:#f8fafc;"><span class="gbadge ${isR ? 'fail' : (finalScore === 0 ? 'nil' : (finalScore < 50 ? 'fail' : 'ok'))} final-grade" style="font-size:1.05rem;border:2px solid #c7d2fe;min-width:48px;">${isR ? 'ร' : (finalScore === 0 ? '-' : Utils.calcGradeFrontend(finalScore))}</span></td></tr>`;
    return html;
  }).join('');
  refreshAllScoreInputStates($('gtBody'));
}

// =====================================================
// 9. SCORE CALCULATION & AUTO-FOCUS
// =====================================================
function handleAutoTab(el, tr, mx) {
  if (el.value.length >= String(mx).length) {
    const rows = Array.from(tr.closest('tbody').querySelectorAll('tr'));
    const nextInput = rows[rows.indexOf(tr) + 1]?.cells[el.closest('td').cellIndex]?.querySelector('.sinput');
    if (nextInput) { nextInput.focus(); nextInput.select(); }
  }
}

function calcSub(el, t) {
  const mx = +el.getAttribute('max');
  if (+el.value > mx) { el.value = mx; Utils.toast(`เต็ม ${mx} คะแนน`, 'warning'); }
  if (+el.value < 0) el.value = 0;
  updateScoreInputState(el);

  const tr = el.closest('tr');
  handleAutoTab(el, tr, mx);

  const flatVals =[...tr.querySelectorAll(`.sub${t}`)].map(i => i.value);
  ScoreLogic.getUnitOffsets(t).forEach(({ unitIndex, start, count }) => {
    let raw = 0;
    for (let i = 0; i < count; i++) raw += Number(flatVals[start + i]) || 0;
    const unitCell = tr.querySelector(`.unit-total-${t}[data-unit="${unitIndex}"]`);
    if (unitCell) unitCell.textContent = ScoreLogic.calcScaled(raw, ScoreLogic.getUnitRawMax(t, unitIndex), Number(App.units[t][unitIndex].max)||0) || '-';
  });

  const scEl = tr.querySelector(`.t${t}sc`);
  if (scEl) scEl.textContent = ScoreLogic.calcKeepFromFlat(t, flatVals) || '-';
  recalcTots(tr); refreshAllScoreInputStates(tr);
}

function calcExam(el) {
  const mx = +el.getAttribute('max');
  if (+el.value > mx) { el.value = mx; Utils.toast(`เต็ม ${mx} คะแนน`, 'warning'); }
  if (+el.value < 0) el.value = 0;
  updateScoreInputState(el);
  const tr = el.closest('tr');
  handleAutoTab(el, tr, mx);
  recalcTots(tr); refreshAllScoreInputStates(tr);
}

function recalcTots(tr) {
  const getVal = (sel) => Number(tr.querySelector(sel)?.textContent || tr.querySelector(sel)?.value || 0);
  const t1s = getVal('.t1sc'), t2s = getVal('.t2sc'), t1e = getVal('.s-t1e'), t2e = getVal('.s-t2e');
  const t1t = t1s + t1e, t2t = t2s + t2e, grand = t1t + t2t;
  const updateUI = (sel, val, cls) => { const e = tr.querySelector(sel); if(e) { e.textContent = val||'-'; e.className = cls; } };

  updateUI('.t1tot', t1t, `tbadge ${t1t === 0 ? 'nil' : 'ok'} t1tot`);
  updateUI('.t2tot', t2t, `tbadge ${t2t === 0 ? 'nil' : 'ok'} t2tot`);
  updateUI('.gtot', grand, `gbadge ${grand === 0 ? 'nil' : grand < 50 ? 'fail' : 'ok'} gtot`);
  updateUI('.sum-keep', Math.round((t1s + t2s) * 100) / 100, `sbadge-keep sum-keep`);
  updateUI('.sum-exam', t1e + t2e, `sbadge-exam sum-exam`);

  const finalScore = App.isSemMode ? t1t : grand;
  const isR = App.isSemMode && !App.ignoreR && (tr.querySelector('.r-status')?.value === 'ติด ร');
  updateUI('.final-grade', isR ? 'ร' : (finalScore === 0 ? '-' : Utils.calcGradeFrontend(finalScore)), `gbadge ${isR ? 'fail' : (finalScore === 0 ? 'nil' : (finalScore < 50 ? 'fail' : 'ok'))} final-grade`);
}

function applySubConfig() {
  if (!App.students.length) return Utils.toast('โหลดรายชื่อก่อน', 'error');
  if (ScoreLogic.getUnitsMax(1) > (App.isSemMode ? 100 : 50)) return Utils.toast(`เทอม 1: คะแนนรวมเกิน ${App.isSemMode ? 100 : 50}`, 'error');
  if (!App.isSemMode && ScoreLogic.getUnitsMax(2) > 50) return Utils.toast('เทอม 2: คะแนนรวมเกิน 50', 'error');
  ScoreLogic.syncHiddenInputs(); refreshUnitPanelLabels();
  
  const snap = {};
  $$('#gtBody tr[data-sid]').forEach(tr => snap[tr.getAttribute('data-sid')] = {
    t1s:[...tr.querySelectorAll('.sub1')].map(i => i.value), t2s: [...tr.querySelectorAll('.sub2')].map(i => i.value),
    t1e: tr.querySelector('.s-t1e')?.value || '', t2e: tr.querySelector('.s-t2e')?.value || '', rStat: tr.querySelector('.r-status')?.value || ''
  });

  buildTable();

  $$('#gtBody tr[data-sid]').forEach(tr => {
    const d = snap[tr.getAttribute('data-sid')]; if (!d) return;
    tr.querySelectorAll('.sub1').forEach((inp, i) => { if (d.t1s[i] !== undefined) inp.value = d.t1s[i]; });
    tr.querySelectorAll('.sub2').forEach((inp, i) => { if (d.t2s[i] !== undefined) inp.value = d.t2s[i]; });
    if (tr.querySelector('.s-t1e')) tr.querySelector('.s-t1e').value = d.t1e;
    if (tr.querySelector('.s-t2e')) tr.querySelector('.s-t2e').value = d.t2e;
    if (tr.querySelector('.r-status') && d.rStat) tr.querySelector('.r-status').value = d.rStat;
    const any1 = tr.querySelector('.sub1'), any2 = tr.querySelector('.sub2');
    if (any1) calcSub(any1, 1); if (any2) calcSub(any2, 2); if (!any1 && !any2) recalcTots(tr);
  });
  Utils.toast('อัปเดตตารางแล้ว ✓');
}

// =====================================================
// 10. SAVING SETTINGS & DATA
// =====================================================
function getCourseInfoForm() {
  return {
    learningArea: $('ci_learning_area').value || '',
    name: $('ci_name').value || '',
    code: $('ci_code').value || '',
    type: $('ci_type').value || 'รายวิชาพื้นฐาน',
    credit: $('ci_credit').value || '',
    teacherName: $('ci_teacher_name').value || '',
    groupHeadName: $('ci_group_head_name').value || '',
    description: $('ci_description').value || '',
    indicators: {
      formative: String($('ci_indicators_formative').value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean),
      summative: String($('ci_indicators_summative').value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean)
    },
    schedule: {
      mon: +$('sch_mon').value || 0,
      tue: +$('sch_tue').value || 0,
      wed: +$('sch_wed').value || 0,
      thu: +$('sch_thu').value || 0,
      fri: +$('sch_fri').value || 0,
      manualAdjust: +$('ci_manual_adjust').value || 0,
      totalHours: +$('ci_total_hours').textContent || 0
    }
  };
}

function setCourseInfoForm(c = {}, subj = '') {
  const indicatorBuckets = normalizeIndicatorBuckets(c.indicators);

  $('ci_learning_area').value = c.learningArea || '';
  $('ci_name').value = c.name || subj || '';
  $('ci_code').value = c.code || '';
  $('ci_type').value = c.type || 'รายวิชาพื้นฐาน';
  $('ci_credit').value = c.credit || '';
  $('ci_teacher_name').value = c.teacherName || '';
  $('ci_group_head_name').value = c.groupHeadName || '';
  $('ci_description').value = c.description || '';
  $('ci_indicators_formative').value = indicatorBuckets.formative.join('\n');
  $('ci_indicators_summative').value = indicatorBuckets.summative.join('\n');
  renderIndicatorCoverageSummary();
  ['mon','tue','wed','thu','fri'].forEach(d => $(`sch_${d}`).value = c.schedule?.[d] || 0);
  $('ci_manual_adjust').value = c.schedule?.manualAdjust || 0;
  $('ci_total_hours').textContent = c.schedule?.totalHours || 0;
}
function getSchoolProfileForm() {
  return { school_name: $('sp_school_name').value || '', director_name: $('sp_director_name').value || '', director_position: $('sp_director_position').value || 'ผู้อำนวยการโรงเรียน', academic_head_name: $('sp_academic_head_name').value || '', academic_head_position: $('sp_academic_head_position').value || 'หัวหน้าวิชาการ' };
}

function setSchoolProfileForm(p = {}) {
  App.schoolProfile = { ...App.schoolProfile, ...p };['school_name','director_name','director_position','academic_head_name','academic_head_position'].forEach(k => $(`sp_${k}`).value = App.schoolProfile[k]);
}

function buildConfigPayload() {
  return { t1_acc: ScoreLogic.getUnitsMax(1), t1_exam: ScoreLogic.getExamMax(1), t2_acc: App.isSemMode ? 0 : ScoreLogic.getUnitsMax(2), t2_exam: App.isSemMode ? 0 : ScoreLogic.getExamMax(2), units: { t1: App.units[1], t2: App.units[2] }, subItems: { t1: [], t2:[] }, rawMax: { t1: 0, t2: 0 }, courseInfo: getCourseInfoForm() };
}

async function saveGrades() {
  ScoreLogic.syncHiddenInputs();

  if (ScoreLogic.getUnitsMax(1) > (App.isSemMode ? 100 : 50)) {
    return Utils.toast(`เทอม 1: คะแนนรวมหน่วยเกิน ${App.isSemMode ? 100 : 50}`, 'error');
  }
  if (!App.isSemMode && ScoreLogic.getUnitsMax(2) > 50) {
    return Utils.toast('เทอม 2: คะแนนรวมหน่วยเกิน 50', 'error');
  }

  const records = [];
  $$('#gtBody tr[data-sid]').forEach(tr => {
    const t1sv = [...tr.querySelectorAll('.sub1')].map(i => i.value);
    const t2sv = [...tr.querySelectorAll('.sub2')].map(i => i.value);

    records.push({
      studentId: tr.getAttribute('data-sid'),
      t1_sub: t1sv,
      t1_acc: ScoreLogic.calcKeepFromFlat(1, t1sv),
      t1_exam: tr.querySelector('.s-t1e')?.value || '',
      t2_sub: t2sv,
      t2_acc: App.isSemMode
        ? (tr.querySelector('.r-status')?.value || 'ปกติ')
        : ScoreLogic.calcKeepFromFlat(2, t2sv),
      t2_exam: tr.querySelector('.s-t2e')?.value || ''
    });
  });

  console.log('saveGrades records =', records);

  if (!records.length) {
    return Utils.toast('ยังไม่มีข้อมูล', 'warning');
  }

  Utils.showLoading('กำลังบันทึกคะแนน...');

  try {
    const payload = {
      year: $('gYear').value,
      classroom: $('gClass').value,
      subject: $('gSubj').value,
      config: buildConfigPayload(),
      gradeRecords: records
    };

    console.log('saveGrades payload =', payload);

    const res = await api('saveGrades', payload);

    console.log('saveGrades response =', res);
    Utils.toast('✅ ' + res);
  } catch (e) {
    console.error('saveGrades error =', e);
    Utils.toast(e.message || 'บันทึกไม่สำเร็จ', 'error');
  }

  Utils.hideLoading();
}

async function saveConfigOnly() {
  const subj = $('gSubj').value; if (!subj || subj === "-- ไม่พบวิชา --") return false;
  if (ScoreLogic.getUnitsMax(1) > (App.isSemMode ? 100 : 50) || (!App.isSemMode && ScoreLogic.getUnitsMax(2) > 50)) { Utils.toast('คะแนนรวมเกินเป้าหมาย', 'warning'); return false; }
  Utils.showLoading('กำลังบันทึกการตั้งค่า...');
  try { await api('saveGrades', { year: $('gYear').value, classroom: $('gClass').value, subject: subj, config: buildConfigPayload(), gradeRecords:[] }); return true; } catch (e) { Utils.toast(e.message, 'error'); return false; } finally { Utils.hideLoading(); }
}

async function saveSchoolProfile() {
  const p = getSchoolProfileForm(); Utils.showLoading('กำลังบันทึกข้อมูลโรงเรียน...');
  try { App.schoolProfile = p; Utils.toast('✅ ' + (await api('saveSchoolProfile', p) || 'บันทึกเรียบร้อย')); } catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

async function saveCourseMetaOnly() { if (!$('ci_name').value.trim()) $('ci_name').value = $('gSubj').value || ''; const ok = await saveConfigOnly(); renderIndicatorCoverageSummary(); if (ok) Utils.toast('✅ บันทึกข้อมูลวิชาเรียบร้อย'); }
async function saveScheduleOnly() { if (await saveConfigOnly()) Utils.toast('✅ บันทึกเวลาเรียนเรียบร้อย'); }
async function saveScoreConfigOnly() { if (await saveConfigOnly()) Utils.toast('✅ บันทึกการตั้งค่าคะแนนเรียบร้อย'); }

// =====================================================

function syncStudentsToSubjectSheet_(sheet, students) {
  const values = sheet.getDataRange().getValues();
  const existingIds = new Set();

  // อ่าน student_id เดิมจากคอลัมน์ A ตั้งแต่แถว 3 ลงไป
  for (let i = 2; i < values.length; i++) {
    const sid = String(values[i][0] || "").trim();
    if (sid && !sid.startsWith("__")) existingIds.add(sid);
  }

  const newRows = [];
  (students || []).forEach(stu => {
    const sid = String(stu.studentId || "").trim();
    if (!sid) return;
    if (!existingIds.has(sid)) {
      newRows.push([sid, "", "", "", "", "", "", ""]);
      existingIds.add(sid);
    }
  });

  if (newRows.length) {
    const startRow = Math.max(sheet.getLastRow() + 1, 3);
    sheet.getRange(startRow, 1, newRows.length, 8).setValues(newRows);
  }

  return newRows.length;
}
