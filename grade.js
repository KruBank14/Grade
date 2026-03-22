// 6. SCORE MATH & LOGIC
// =====================================================
const ScoreLogic = {
  getTarget: () => (String(App.loadedClass||'').startsWith('ม.') ? 100 : 50),
  getUnitsMax:     t => (App.units[t]||[]).reduce((s,u) => s+(Number(u.max)||0), 0),
  // examUnit = { name, rawMax, scaledMax, indicators }
  // rawMax   = คะแนนดิบของการสอบนั้น (เช่น สอบ 30 คะแนน)
  // scaledMax = สัดส่วนที่นับเข้าเกรด (เช่น 10 คะแนน)
  getExamMax: t => {
    const eu = App.examUnits?.[t];
    if (eu && eu.length > 0)
      return eu.reduce((s,u) => s + (Number(u.scaledMax)||0), 0);
    return Math.max(0, ScoreLogic.getTarget() - ScoreLogic.getUnitsMax(t));
  },
  // คำนวณคะแนนสอบรวม (หลัง scale) จากค่าดิบที่กรอก
  calcExamScaled: (t, examRawVals) => {
    let total = 0;
    (App.examUnits?.[t]||[]).forEach((u, i) => {
      const raw     = Number(examRawVals[i]) || 0;
      const rawMax  = Number(u.rawMax)    || 0;
      const scaledMax = Number(u.scaledMax) || 0;
      total += ScoreLogic.calcScaled(raw, rawMax, scaledMax);
    });
    return Math.round(total * 100) / 100;
  },
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
    $('c_t2a').value = ScoreLogic.getUnitsMax(2); $('c_t2e').value = ScoreLogic.getExamMax(2);
  }
};

// =====================================================
// 7. UI SETTINGS & DATA LOAD
// =====================================================
function normalizeUnits(t) {
  if (!Array.isArray(App.units[t])) App.units[t] = [];
  App.units[t] = App.units[t].map((u, idx) => (u && Array.isArray(u.items) ? u : { name: u?.name || `หน่วยที่ ${idx + 1}`, max: Number(u?.max) || 10, items:[{ name: u?.name || 'งาน 1', max: Number(u?.max) || 10 }] }));
}

function updateAutoScoreDisplay() {
  const setScoreTxt = (t) => {
    const k = ScoreLogic.getUnitsMax(t), e = ScoreLogic.getExamMax(t);
    if ($(`show_t${t}_keep`))  $(`show_t${t}_keep`).textContent  = k;
    if ($(`show_t${t}_exam`))  $(`show_t${t}_exam`).textContent  = e;
    if ($(`show_t${t}_total`)) $(`show_t${t}_total`).textContent = k + e;
    if ($(`sum_t${t}_units`))  $(`sum_t${t}_units`).textContent  = k;
  };
  setScoreTxt(1); setScoreTxt(2);
}

function refreshUnitPanelLabels() {
  if ($('sum_t1_units')?.parentElement) $('sum_t1_units').parentElement.innerHTML = `<span>คะแนนรวมทุกหน่วย เทอม 1:</span><strong id="sum_t1_units">${ScoreLogic.getUnitsMax(1)}</strong><span>/</span><span class="res">${'50'}</span>`;
  if ($('sum_t2_units')?.parentElement) $('sum_t2_units').parentElement.innerHTML = `<span>คะแนนรวมทุกหน่วย เทอม 2:</span><strong id="sum_t2_units">${ScoreLogic.getUnitsMax(2)}</strong><span>/</span><span class="res">50</span>`;
  if ($('t2AutoBlock')) $('t2AutoBlock').style.display = 'flex';
  if ($('tabTerm2Btn')) $('tabTerm2Btn').style.display = 'block';
  updateAutoScoreDisplay();
  refreshCourseOverview();
}


function switchTerm(t, btn) {
  if (btn?.closest('.ttabs')) btn.closest('.ttabs').querySelectorAll('.ttab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  $('subPanel_1').style.display  = t === 1 ? '' : 'none';
  $('subPanel_2').style.display  = t === 2 ? '' : 'none';
  if ($('examPanel_1')) $('examPanel_1').style.display = t === 1 ? '' : 'none';
  if ($('examPanel_2')) $('examPanel_2').style.display = t === 2 ? '' : 'none';
  if (typeof renderExamList === 'function') renderExamList(t);
}


function switchCourseSubTab(key, btn) {
  document.querySelectorAll('.course-subtab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  ['basic','desc','schedule','units'].forEach(k => {
    const el = document.getElementById(`coursePanel_${k}`);
    if (el) el.style.display = (k === key ? '' : 'none');
  });
}

function goCourseSubTab(key) {
  const map = {
    basic: 'courseTabBasicBtn',
    desc: 'courseTabDescBtn',
    schedule: 'courseTabScheduleBtn',
    units: 'courseTabUnitsBtn'
  };
  switchCourseSubTab(key, $(map[key]));
}

function getIndicatorBucketsFromForm() {
  const normalize = txt => String(txt || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  return {
    formative: normalize($('ci_indicators_formative')?.value || ''),
    summative: normalize($('ci_indicators_summative')?.value || '')
  };
}

function refreshCourseOverview() {
  const put = (id, val) => { const el = $(id); if (el) el.textContent = val || '-'; };
  const indicators = getIndicatorBucketsFromForm();
  put('ov_subject_name', $('ci_name')?.value || $('gSubj')?.value || '-');
  put('ov_subject_code', $('ci_code')?.value || '-');
  put('ov_teacher_name', $('ci_teacher_name')?.value || '-');
  put('ov_total_hours', $('ci_total_hours')?.textContent || '0');
  put('ov_indicator_count', String(indicators.formative.length + indicators.summative.length));
  put('ov_unit_count', String((App.units?.[1]?.length || 0) + (App.units?.[2]?.length || 0)));
}

function addSub(t) {
  App.units[t].push({ name: `หน่วยที่ ${App.units[t].length + 1}`, max: 10, items: [{ name: 'งาน 1', max: 10 }] });
  if (!App.activeSubUnit) App.activeSubUnit = {};
  App.activeSubUnit[t] = App.units[t].length - 1; // switch ไปหน่วยใหม่
  refreshCourseOverview(); renderSubList(t);
}
function rmSub(t, ui) {
  if (!confirm(`ลบ "${App.units[t][ui].name}" ?`)) return;
  App.units[t].splice(ui, 1);
  if (!App.activeSubUnit) App.activeSubUnit = {};
  App.activeSubUnit[t] = Math.max(0, (App.activeSubUnit[t]||0) - (ui <= (App.activeSubUnit[t]||0) ? 1 : 0));
  refreshCourseOverview(); renderSubList(t);
}
function addSubItem(t, ui) { App.units[t][ui].items.push({ name: `งาน ${App.units[t][ui].items.length + 1}`, max: 10 }); refreshCourseOverview(); renderSubList(t); }
function rmSubItem(t, ui, ii) { if (confirm('ลบงานนี้?')) { App.units[t][ui].items.splice(ii, 1); refreshCourseOverview(); renderSubList(t); } }

function renderSubList(t) {
  const wrap = $(`subList_${t}`); if (!wrap) return;
  const units = App.units[t] || [];

  if (!units.length) {
    wrap.innerHTML = `<div class="text-muted text-center py-4 border rounded" style="color:#94a3b8;">ยังไม่มีหน่วยการเรียนรู้</div>`;
    updateAutoScoreDisplay(); refreshCourseOverview(); return;
  }

  // activeSubUnit[t] = index หน่วยที่กำลังแสดง (default 0)
  if (!App.activeSubUnit) App.activeSubUnit = {};
  if (App.activeSubUnit[t] === undefined || App.activeSubUnit[t] >= units.length)
    App.activeSubUnit[t] = 0;
  const ui = App.activeSubUnit[t];
  const unit = units[ui];

  // ── Tab bar ──
  const tabsHtml = units.map((u, i) =>
    `<button class="utab ${i===ui?'on':''}" onclick="App.activeSubUnit[${t}]=${i};renderSubList(${t})">
      ${u.name||`หน่วย ${i+1}`}
    </button>`
  ).join('');

  // ── Content: แก้ชื่อ/คะแนนเต็มหน่วย + รายการงาน ──
  const itemsHtml = (unit.items||[]).map((item, ii) =>
    `<div class="d-flex align-items-center gap-2 flex-wrap" style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
      <input class="sub-name" type="text" value="${item.name||''}" placeholder="ชื่องาน"
        onchange="App.units[${t}][${ui}].items[${ii}].name=this.value">
      <span class="sub-max-lbl">เต็ม</span>
      <input class="sub-max" type="number" min="1" value="${Number(item.max)||0}"
        onchange="App.units[${t}][${ui}].items[${ii}].max=Number(this.value)||0;renderSubList(${t});">
      <button class="btn-rm" onclick="rmSubItem(${t},${ui},${ii})">✕</button>
    </div>`
  ).join('');

  // ── ตัวชี้วัด ──
  const allIndicators = [
    ...($('ci_indicators_formative')?.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>({txt:s,type:'formative'})),
    ...($('ci_indicators_summative')?.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>({txt:s,type:'summative'}))
  ];
  const selInds = Array.isArray(unit.indicators) ? unit.indicators : [];
  const indicatorsHtml = allIndicators.length === 0
    ? `<div style="color:#94a3b8;font-size:.78rem;padding:4px 0;">ยังไม่มีตัวชี้วัด — กรอกใน "คำอธิบาย/ตัวชี้วัด" ก่อน</div>`
    : allIndicators.map((ind, k) => {
        const checked = selInds.includes(ind.txt) ? 'checked' : '';
        const badge = ind.type === 'formative'
          ? `<span style="font-size:.68rem;background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 6px;">ระหว่างทาง</span>`
          : `<span style="font-size:.68rem;background:#dcfce7;color:#15803d;border-radius:4px;padding:1px 6px;">ปลายทาง</span>`;
        return `<label style="display:flex;align-items:flex-start;gap:7px;cursor:pointer;padding:4px 0;border-bottom:1px solid #f8fafc;font-size:.82rem;">
          <input type="checkbox" ${checked} style="margin-top:2px;width:15px;height:15px;cursor:pointer;flex-shrink:0;"
            onchange="App.units[${t}][${ui}].indicators=App.units[${t}][${ui}].indicators||[];
              this.checked
                ? (App.units[${t}][${ui}].indicators.includes('${ind.txt.replace(/'/g,"\\'")}') || App.units[${t}][${ui}].indicators.push('${ind.txt.replace(/'/g,"\\'")}'))
                : (App.units[${t}][${ui}].indicators = App.units[${t}][${ui}].indicators.filter(x=>x!=='${ind.txt.replace(/'/g,"\\'")}'))">
          <span>${ind.txt} ${badge}</span>
        </label>`;
      }).join('');

  wrap.innerHTML = `
    <div class="unit-tabs" style="margin-bottom:10px;">${tabsHtml}</div>
    <div class="sub-row p-3 border rounded bg-white" style="display:block;">
      <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
        <span style="font-weight:800;font-size:.88rem;color:#6d28d9;">หน่วยที่ ${ui+1}</span>
        <input class="sub-name" type="text" value="${unit.name||''}" placeholder="ชื่อหน่วย"
          onchange="App.units[${t}][${ui}].name=this.value;renderSubList(${t})">
        <span class="sub-max-lbl">คะแนนเต็มหน่วย</span>
        <input class="sub-max" type="number" min="1" value="${Number(unit.max)||0}"
          onchange="App.units[${t}][${ui}].max=Number(this.value)||0;updateAutoScoreDisplay();renderSubList(${t});">
        <button class="btn-rm" title="ลบหน่วยนี้" onclick="rmSub(${t},${ui})">✕ ลบหน่วย</button>
      </div>

      <div style="font-weight:700;font-size:.82rem;color:#374151;margin-bottom:6px;">📋 งานย่อย</div>
      <div class="ms-2" style="display:flex;flex-direction:column;">
        ${itemsHtml}
        <button type="button" class="btn-add-sub mt-2" onclick="addSubItem(${t},${ui})">＋ เพิ่มงาน</button>
      </div>
      <div class="raw-preview mt-2">คะแนนดิบรวมของงาน: <strong>${ScoreLogic.getUnitRawMax(t,ui)}</strong> | คะแนนที่เก็บเข้าหน่วย: <strong class="res">${Number(unit.max)||0}</strong></div>

      ${allIndicators.length > 0 ? `
      <div style="margin-top:14px;border-top:2px dashed #e0e7ff;padding-top:12px;">
        <div style="font-weight:700;font-size:.82rem;color:#4338ca;margin-bottom:8px;">
          🎯 ตัวชี้วัดที่ใช้ในหน่วยนี้
          <span style="font-weight:400;color:#94a3b8;font-size:.75rem;">(${selInds.length}/${allIndicators.length} ข้อ)</span>
        </div>
        <div style="max-height:220px;overflow-y:auto;padding-right:4px;">${indicatorsHtml}</div>
      </div>` : `
      <div style="margin-top:14px;border-top:2px dashed #e0e7ff;padding-top:10px;">
        <div style="font-size:.78rem;color:#94a3b8;">🎯 ${indicatorsHtml}</div>
      </div>`}
    </div>`;

  updateAutoScoreDisplay(); refreshCourseOverview();
}

function toggleCols(t) { App.expanded[t] = !App.expanded[t]; $('gtbl').classList.toggle(`t${t}-collapsed`, !App.expanded[t]); if ($(`tbtn${t}`)) $(`tbtn${t}`).innerHTML = `<span class="arr">${App.expanded[t] ? '▼' : '▶'}</span> ${App.expanded[t] ? 'ยุบ' : 'ขยาย'}`; }
function toggleIgnoreR() { App.ignoreR = $('toggleR').checked; $$('#gtBody tr[data-sid]').forEach(tr => recalcTots(tr)); }

// ── จัดการรายการสอบ (examUnits) ──────────────────────
function addExam(t) {
  if (!App.examUnits) App.examUnits = { 1: [], 2: [] };
  const examMax = ScoreLogic.getExamMax(t); // สัดส่วนที่เหลือ
  App.examUnits[t].push({ name: `สอบครั้งที่ ${App.examUnits[t].length + 1}`, rawMax: 100, scaledMax: examMax, indicators: [] });
  renderExamList(t);
  updateAutoScoreDisplay();
}
function rmExam(t, ei) {
  if (!confirm(`ลบ "${App.examUnits[t][ei].name}" ?`)) return;
  App.examUnits[t].splice(ei, 1);
  renderExamList(t);
  updateAutoScoreDisplay();
}

function renderExamList(t) {
  const wrap = $(`examList_${t}`); if (!wrap) return;
  if (!App.examUnits) App.examUnits = { 1: [], 2: [] };
  const exams = App.examUnits[t] || [];

  // ตัวชี้วัด
  const allIndicators = [
    ...($('ci_indicators_formative')?.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>({txt:s,type:'formative'})),
    ...($('ci_indicators_summative')?.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>({txt:s,type:'summative'}))
  ];

  if (!exams.length) {
    wrap.innerHTML = `<div class="text-muted text-center py-3 border rounded" style="color:#94a3b8;font-size:.83rem;">ยังไม่มีรายการสอบ — กดเพิ่มด้านล่าง</div>`;
    updateAutoScoreDisplay(); return;
  }

  wrap.innerHTML = exams.map((exam, ei) => {
    const selInds = Array.isArray(exam.indicators) ? exam.indicators : [];
    const indHtml = allIndicators.length === 0
      ? `<div style="color:#94a3b8;font-size:.75rem;">ยังไม่มีตัวชี้วัด</div>`
      : allIndicators.map(ind => {
          const checked = selInds.includes(ind.txt) ? 'checked' : '';
          const badge = ind.type === 'formative'
            ? `<span style="font-size:.65rem;background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 5px;">ระหว่างทาง</span>`
            : `<span style="font-size:.65rem;background:#dcfce7;color:#15803d;border-radius:4px;padding:1px 5px;">ปลายทาง</span>`;
          return `<label style="display:flex;align-items:flex-start;gap:6px;cursor:pointer;padding:3px 0;font-size:.8rem;">
            <input type="checkbox" ${checked} style="margin-top:2px;width:14px;height:14px;cursor:pointer;flex-shrink:0;"
              onchange="App.examUnits[${t}][${ei}].indicators=App.examUnits[${t}][${ei}].indicators||[];
                this.checked
                  ? (App.examUnits[${t}][${ei}].indicators.includes('${ind.txt.replace(/'/g,"\\'")}') || App.examUnits[${t}][${ei}].indicators.push('${ind.txt.replace(/'/g,"\\'")}'))
                  : (App.examUnits[${t}][${ei}].indicators = App.examUnits[${t}][${ei}].indicators.filter(x=>x!=='${ind.txt.replace(/'/g,"\\'")}'))">
            <span>${ind.txt} ${badge}</span>
          </label>`;
        }).join('');

    const rawMax    = Number(exam.rawMax)    || Number(exam.max) || 0;
    const scaledMax = Number(exam.scaledMax) || Number(exam.max) || 0;

    return `<div class="sub-row p-3 border rounded bg-white mb-2" style="display:block;border-color:#bae6fd;">
      <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
        <span style="font-weight:800;font-size:.85rem;color:#0369a1;">สอบ ${ei+1}.</span>
        <input class="sub-name" type="text" value="${exam.name||''}" placeholder="ชื่อการสอบ"
          style="min-width:140px;"
          onchange="App.examUnits[${t}][${ei}].name=this.value">
        <button class="btn-rm" onclick="rmExam(${t},${ei})">✕</button>
      </div>
      <div class="d-flex align-items-center gap-3 flex-wrap mb-1"
           style="background:#f0f9ff;border-radius:8px;padding:8px 12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:.78rem;color:#0369a1;font-weight:700;">คะแนนดิบ (สอบจริง)</span>
          <input class="sub-max" type="number" min="1" value="${rawMax}"
            style="width:72px;"
            onchange="App.examUnits[${t}][${ei}].rawMax=Number(this.value)||0;renderExamList(${t});">
        </div>
        <span style="color:#94a3b8;">→ scale →</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:.78rem;color:#6d28d9;font-weight:700;">นับเข้าเกรด</span>
          <input class="sub-max" type="number" min="1" value="${scaledMax}"
            style="width:72px;"
            onchange="App.examUnits[${t}][${ei}].scaledMax=Number(this.value)||0;updateAutoScoreDisplay();renderExamList(${t});">
        </div>
        <span style="font-size:.76rem;color:#64748b;background:#e0f2fe;padding:3px 8px;border-radius:6px;">
          กรอกดิบ ${rawMax} → ได้ ${scaledMax} คะแนน
        </span>
      </div>
      ${allIndicators.length > 0 ? `
      <div style="margin-top:8px;border-top:1px dashed #bae6fd;padding-top:8px;">
        <div style="font-weight:700;font-size:.78rem;color:#0369a1;margin-bottom:6px;">
          🎯 ตัวชี้วัด <span style="font-weight:400;color:#94a3b8;">(${selInds.length}/${allIndicators.length})</span>
        </div>
        <div style="max-height:180px;overflow-y:auto;">${indHtml}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  updateAutoScoreDisplay();
}

async function loadGrades() {
  const year = $('gYear').value, cls = $('gClass').value, subj = $('gSubj').value;
  if (!subj || subj === "-- ไม่พบวิชา --") return Utils.toast('กรุณาเลือกวิชาที่ถูกต้อง', 'error');

  // ── lock selector ───────────────────────────────────────
  App.loadedSubject = subj;
  App.loadedClass   = cls;
  App.loadedYear    = year;
  _lockSubjectSelector_();

  App.isSemMode  = false;
  App.activeTerm = App.gradeTerm || 1;
  App.activeUnit = null; // reset เป็น "ทั้งหมด" ทุกครั้งที่โหลดวิชาใหม่

  $('lblClass').textContent = cls; $('lblSubj').textContent = subj;
  Utils.showLoading('กำลังโหลดข้อมูล...');
  $('toggleRWrapper').style.display = 'none'; $('toggleR').checked = false; App.ignoreR = false;

  try {
    const res = await api('getGrades', { year, classroom: cls, subject: subj });
    App.config      = res.config  || {};
    App.courseInfo  = res.config?.courseInfo || {};
    App.termDates   = res.termDates || {};
    App.holidays    = res.holidays  || [];
    App.homeroomTeacher = res.homeroomTeacher || '-';

    ScoreLogic.syncHiddenInputs();

    setCourseInfoForm(res.config?.courseInfo || {}, subj);
    try { setSchoolProfileForm(await api('getSchoolProfile', {}) || {}); } catch(e) { setSchoolProfileForm({}); }

    App.units[1] = res.config?.units?.t1 || res.config?.subItems?.t1 || [];
    App.units[2] = res.config?.units?.t2 || res.config?.subItems?.t2 || [];
    App.examUnits = {
      1: res.config?.examUnits?.t1 || [],
      2: res.config?.examUnits?.t2 || []
    };

    normalizeUnits(1); normalizeUnits(2); renderSubList(1); renderSubList(2);
    if (typeof renderExamList === 'function') { renderExamList(1); renderExamList(2); }

    if ($('tabTerm2Btn')) $('tabTerm2Btn').style.display = 'flex';
    if ($('t2AutoBlock')) $('t2AutoBlock').style.display = 'flex';
    refreshUnitPanelLabels(); updateAutoScoreDisplay(); refreshCourseOverview();
    switchCourseSubTab('basic', $('courseTabBasicBtn'));

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
    if ($('btnPp6T1'))   $('btnPp6T1').style.display   = '';
    if ($('btnPp6Year')) $('btnPp6Year').style.display  = '';
    if ($('btnPp6Sem'))  $('btnPp6Sem').style.display   = 'none';
    renderHolisticTable(App.students, 'assContainer', 'assBody', 'subject');
    renderHolisticTable(App.students, 'hrAssContainer', 'hrAssBody', 'homeroom');
    renderRTWTable();
    renderGuidanceTable();
    if (typeof renderScoutTable === 'function') renderScoutTable();
    if (typeof renderClubPanel === 'function') renderClubPanel();

    showScoreMain($('tabScoreMain'));
    Utils.toast('โหลดข้อมูลสำเร็จ');
  } catch (e) { Utils.toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); $('gradePanel').style.display = 'none'; }
  Utils.hideLoading();
}

// =====================================================
// 8. TABLE GENERATOR
// =====================================================

function buildTable() {
  const isYear = (App.activeTerm || 1) === 0;
  if (!isYear) _buildUnitTabs_();
  else { const w = $('unitTabsRow'); if(w) w.innerHTML = ''; }
  buildHead();
  buildBody();
  $('gtbl').classList.remove('t1-collapsed', 't2-collapsed');
  App.expanded = { 1: true, 2: true };
  const t = App.activeTerm || 1;
  const saveBtn = document.querySelector('.btn-save');
  if (saveBtn && t !== 0) saveBtn.textContent = `💾 บันทึกเทอม ${t}`;
}

function _buildUnitTabs_() {
  const t     = App.activeTerm || 1;
  const units = App.units[t] || [];
  const wrap  = $('unitTabsRow');
  if (!wrap) return;
  if (!units.length) { wrap.innerHTML = ''; return; }
  const cur = App.activeUnit ?? null;
  const tabs = [
    `<button class="utab ${cur===null?'on':''}" onclick="switchUnitTab(null)">📋 ทั้งหมด</button>`,
    ...units.map((u,i) => `<button class="utab ${cur===i?'on':''}" onclick="switchUnitTab(${i})">${u.name||`หน่วย ${i+1}`}</button>`),
    `<button class="utab ${cur===-1?'on':''}" onclick="switchUnitTab(-1)">📝 สอบ</button>`
  ];
  wrap.innerHTML = `<div class="unit-tabs">${tabs.join('')}</div>`;
}

function switchUnitTab(unitIdx) {
  App.activeUnit = unitIdx;
  buildTable();
}

function buildHead() {
  ScoreLogic.syncHiddenInputs();
  const t      = App.activeTerm;  // 0=ทั้งปี, 1=เทอม1, 2=เทอม2
  const isYear = t === 0;
  const tgt    = ScoreLogic.getTarget();

  let r1 = `<th rowspan="3" class="th-base s-c0" style="width:36px;">ที่</th>
             <th rowspan="3" class="th-base s-c1" style="width:72px;">รหัส</th>
             <th rowspan="3" class="th-base s-c2" style="text-align:left;min-width:145px;">ชื่อ-นามสกุล</th>
             <th rowspan="3" class="th-att" style="width:115px;">มาเรียน</th>`;
  let r2 = '', r3 = '';

  if (isYear) {
    r1 += `<th rowspan="3" class="th-t1sc" style="width:80px;background:#ede9fe;color:#6d28d9;">เก็บ ท.1<br><small>(${ScoreLogic.getUnitsMax(1)})</small></th>
            <th rowspan="3" class="th-t1e"  style="width:72px;">สอบ ท.1<br><small>(${ScoreLogic.getExamMax(1)})</small></th>
            <th rowspan="3" class="th-t1t"  style="width:80px;">รวม ท.1<br><small>(${tgt})</small></th>
            <th rowspan="3" class="th-t2sc" style="width:80px;background:#dbeafe;color:#1d4ed8;">เก็บ ท.2<br><small>(${ScoreLogic.getUnitsMax(2)})</small></th>
            <th rowspan="3" class="th-t2e"  style="width:72px;">สอบ ท.2<br><small>(${ScoreLogic.getExamMax(2)})</small></th>
            <th rowspan="3" class="th-t2t"  style="width:80px;">รวม ท.2<br><small>(${tgt})</small></th>`;
  } else {
    const units = App.units[t] || [];
    const uIdx  = App.activeUnit ?? null;
    if (uIdx === null) {
      const flat = ScoreLogic.getFlatItems(t);
      if (flat.length > 0) r1 += `<th colspan="${flat.length + units.length}" class="th-t${t}s sc${t}">📝 หน่วย / งาน เทอม ${t}</th>`;
      r1 += `<th rowspan="3" class="th-t${t}sc" style="width:88px;">เก็บ ท.${t}<br><small>(${ScoreLogic.getUnitsMax(t)})</small></th>
              <th rowspan="3" class="th-t${t}e" style="width:72px;">สอบ<br><small>(${ScoreLogic.getExamMax(t)})</small></th>
              <th rowspan="3" class="th-t${t}t" style="width:72px;">รวม<br><small>(${tgt})</small></th>`;
      units.forEach(u => {
        const c = (u.items||[]).length;
        if (c > 0) {
          r2 += `<th colspan="${c+1}" class="th-t${t}si sc${t}">${u.name}<br><small>${Number(u.max)||0} คะแนน</small></th>`;
          (u.items||[]).forEach(item => r3 += `<th class="th-t${t}raw sc${t}">${item.name}<br><small>(${Number(item.max)||0})</small></th>`);
          r3 += `<th class="th-t${t}sc sc${t}">รวม</th>`;
        }
      });
    } else if (uIdx === -1) {
      const examItems = App.examUnits?.[t] || [];
      if (examItems.length > 0) {
        r1 += `<th colspan="${examItems.length}" class="th-t${t}s sc${t}">📝 รายการสอบ เทอม ${t}</th>`;
        examItems.forEach(eu =>
          r2 += `<th class="th-t${t}raw sc${t}">${eu.name}<br><small>ดิบ(${Number(eu.rawMax)||0}) → ${Number(eu.scaledMax)||0}คะ</small></th>`
        );
      } else {
        r1 += `<th rowspan="3" class="th-t${t}e" style="width:140px;color:#94a3b8;">ยังไม่มีรายการสอบ</th>`;
      }
      r1 += `<th rowspan="3" class="th-t${t}sc" style="width:100px;">เก็บรวม<br><small>(${ScoreLogic.getUnitsMax(t)})</small></th>
              <th rowspan="3" class="th-t${t}e" style="width:88px;">สอบรวม<br><small>(${ScoreLogic.getExamMax(t)})</small></th>
              <th rowspan="3" class="th-t${t}t" style="width:88px;">รวม<br><small>(${tgt})</small></th>`;
    } else {
      const u = units[uIdx]||{}, items = u.items||[];
      if (items.length > 0) {
        r1 += `<th colspan="${items.length+1}" class="th-t${t}s sc${t}">${u.name||`หน่วย ${uIdx+1}`} <small>(${Number(u.max)||0} คะแนน)</small></th>`;
        items.forEach(item => r2 += `<th class="th-t${t}raw sc${t}">${item.name}<br><small>(${Number(item.max)||0})</small></th>`);
        r2 += `<th class="th-t${t}sc sc${t}">รวมหน่วย</th>`;
      }
      r1 += `<th rowspan="3" class="th-t${t}sc" style="width:88px;background:#6d28d9;color:#fff;">เก็บรวม<br><small>(${ScoreLogic.getUnitsMax(t)})</small></th>
              <th rowspan="3" class="th-t${t}e" style="width:72px;">สอบ<br><small>(${ScoreLogic.getExamMax(t)})</small></th>
              <th rowspan="3" class="th-t${t}t" style="width:72px;">รวม<br><small>(${tgt})</small></th>`;
    }
  }

  const grandLabel = isYear ? `รวมทั้งปี<br><small>(${tgt*2})</small>` : `รวม<br><small>(${tgt})</small>`;
  r1 += `<th rowspan="3" class="th-grand" style="width:80px;background:#1e3a5f;color:#fff;">${grandLabel}</th>
          <th rowspan="3" style="width:65px;background:#4f46e5;color:#fff;font-size:15px;vertical-align:middle;">เกรด</th>`;
  $('gtHead').innerHTML = `<tr>${r1}</tr><tr>${r2}</tr><tr>${r3}</tr>`;
}


function buildBody() {
  ScoreLogic.syncHiddenInputs();
  if (!App.students.length) return $('gtBody').innerHTML = `<tr><td colspan="50" class="text-center py-4 text-muted">ไม่พบข้อมูลผู้เรียน</td></tr>`;

  const t      = App.activeTerm;
  const isYear = t === 0;
  const tgt    = ScoreLogic.getTarget();

  // ── ทั้งปี: แสดงเฉพาะข้อมูล read-only ──
  if (isYear) {
    $('gtBody').innerHTML = App.students.map((s, idx) => {
      const st   = s.stats || {};
      const g    = s.grades || {};
      const k1   = Number(g.t1_acc)||0, e1 = Number(g.t1_exam)||0, r1 = k1+e1;
      const k2   = Number(g.t2_acc)||0, e2 = Number(g.t2_exam)||0, r2 = k2+e2;
      const grand = r1+r2;
      const cls  = (v,mx) => v===0?'nil':v>=mx*0.5?'ok':'fail';
      return `<tr data-sid="${s.studentId}">
        <td class="s-c0">${idx+1}</td><td class="s-c1">${s.studentId}</td>
        <td class="s-c2"><span>${s.name}</span></td>
        <td><span class="sp p">ม ${st.present||0}</span> <span class="sp a">ข ${st.absent||0}</span> <span class="sp l">ล ${st.leave||0}</span></td>
        <td><span class="tbadge ${k1===0?'nil':'ok'}">${k1||'-'}</span></td>
        <td><span class="tbadge ${e1===0?'nil':'ok'}">${e1||'-'}</span></td>
        <td><span class="tbadge ${r1===0?'nil':r1>=tgt*0.5?'ok':'fail'} t1tot">${r1||'-'}</span></td>
        <td><span class="tbadge ${k2===0?'nil':'ok'}">${k2||'-'}</span></td>
        <td><span class="tbadge ${e2===0?'nil':'ok'}">${e2||'-'}</span></td>
        <td><span class="tbadge ${r2===0?'nil':r2>=tgt*0.5?'ok':'fail'} t2tot">${r2||'-'}</span></td>
        <td><span class="gbadge ${grand===0?'nil':grand>=tgt?'ok':'fail'} gtot">${grand||'-'}</span></td>
        <td style="background:#f8fafc;"><span class="gbadge ${grand===0?'nil':grand>=tgt?'ok':'fail'} final-grade" style="font-size:1.05rem;border:2px solid #c7d2fe;min-width:48px;">${grand===0?'-':Utils.calcGradeFrontend(grand)}</span></td>
      </tr>`;
    }).join('');
    return;
  }

  // ── เทอม 1 หรือ 2 ──
  const uIdx  = App.activeUnit ?? null;
  const units = App.units[t] || [];

  const mkExamInput = (s) => `<input type="number" class="sinput ${t===2?'t2':''} s-t${t}e" data-term="${t}" data-type="exam" min="0" max="${ScoreLogic.getExamMax(t)}" value="${s.grades?.[`t${t}_exam`]??''}" oninput="calcExam(this)">`;

  const buildCells = (s) => {
    const flatVals = Array.isArray(s.grades?.[`t${t}_sub`]) ? s.grades[`t${t}_sub`] : [];
    const keep  = ScoreLogic.calcKeepFromFlat(t, flatVals);
    const exam  = Number(s.grades?.[`t${t}_exam`]) || 0;
    const total = keep + exam;
    const totalBadge = `<span class="tbadge ${total===0?'nil':total>=(tgt*0.5)?'ok':'fail'} t${t}tot">${total||'-'}</span>`;

    let cells = '';
    if (uIdx === null) {
      ScoreLogic.getUnitOffsets(t).forEach(({ unitIndex, start, count }) => {
        const unit = units[unitIndex]; let raw = 0;
        for (let i = 0; i < count; i++) {
          const val = flatVals[start+i]??''; raw += Number(val)||0;
          cells += `<td class="td-sub${t} sc${t}"><input type="number" class="sinput sub${t} ${t===2?'t2':''}" min="0" max="${Number((unit.items||[])[i]?.max)||0}" value="${val}" data-term="${t}" data-unit="${unitIndex}" data-item="${i}" oninput="calcSub(this,${t})"></td>`;
        }
        cells += `<td class="td-sc${t} sc${t} unit-total-${t}" data-unit="${unitIndex}">${ScoreLogic.calcScaled(raw,ScoreLogic.getUnitRawMax(t,unitIndex),Number(unit.max)||0)||'-'}</td>`;
      });
    } else if (uIdx === -1) {
      // ── สอบ — แสดง input ต่อรายการสอบ ──
      const examItems = App.examUnits?.[t] || [];
      examItems.forEach((eu, ei) => {
        const val = (s.grades?.[`t${t}_exam_sub`]||[])[ei] ?? '';
        cells += `<td class="td-sub${t} sc${t}"><input type="number" class="sinput exam-sub${t}" min="0" max="${Number(eu.max)||0}" value="${val}" data-term="${t}" data-examidx="${ei}" oninput="calcExamSub(this,${t})"></td>`;
      });
      if (!examItems.length) {
        cells += `<td class="td-sc${t}" style="color:#94a3b8;font-size:.78rem;white-space:nowrap;padding:6px 10px;">ยังไม่มีรายการสอบ<br><small>ตั้งค่าในแท็บ "หน่วยการเรียนรู้"</small></td>`;
      }
      const unit = units[uIdx]||{}, items = unit.items||[];
      const offset = ScoreLogic.getUnitOffsets(t).find(o=>o.unitIndex===uIdx);
      const base = offset?.start ?? 0; let raw = 0;
      items.forEach((item,i) => {
        const val = flatVals[base+i]??''; raw += Number(val)||0;
        cells += `<td class="td-sub${t} sc${t}"><input type="number" class="sinput sub${t} ${t===2?'t2':''}" min="0" max="${Number(item.max)||0}" value="${val}" data-term="${t}" data-unit="${uIdx}" data-item="${i}" oninput="calcSub(this,${t})"></td>`;
      });
      if (items.length>0) cells += `<td class="td-sc${t} sc${t} unit-total-${t}" data-unit="${uIdx}">${ScoreLogic.calcScaled(raw,ScoreLogic.getUnitRawMax(t,uIdx),Number(unit.max)||0)||'-'}</td>`;
    }
    cells += `<td class="td-sc${t}"><span class="t${t}sc">${keep||'-'}</span></td>
              <td>${mkExamInput(s)}</td>
              <td>${totalBadge}</td>`;
    return { cells, keep, exam, total };
  };

  $('gtBody').innerHTML = App.students.map((s, idx) => {
    const st = s.stats||{}, tc = buildCells(s), fs = tc.total;
    return `<tr data-sid="${s.studentId}">
      <td class="s-c0">${idx+1}</td><td class="s-c1">${s.studentId}</td>
      <td class="s-c2"><div class="d-flex justify-content-between align-items-center gap-1"><span>${s.name}</span><div class="d-flex gap-1">
        <button class="btn-sm" style="padding:2px 7px;font-size:.72rem;background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;" onclick="printRowPDF('${s.studentId}','term1')">T1</button>
        <button class="btn-sm" style="padding:2px 8px;font-size:.75rem;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;" onclick="printRowPDF('${s.studentId}','year')">🖨️</button>
      </div></div></td>
      <td><span class="sp p">ม ${st.present||0}</span> <span class="sp a">ข ${st.absent||0}</span> <span class="sp l">ล ${st.leave||0}</span></td>
      ${tc.cells}
      <td><span class="gbadge ${fs===0?'nil':fs<tgt*0.5?'fail':'ok'} gtot">${fs||'-'}</span></td>
      <td style="background:#f8fafc;"><span class="gbadge ${fs===0?'nil':fs<tgt*0.5?'fail':'ok'} final-grade" style="font-size:1.05rem;border:2px solid #c7d2fe;min-width:48px;">${fs===0?'-':Utils.calcGradeFrontend(fs)}</span></td>
    </tr>`;
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

function calcExamSub(el, t) {
  const mx = +el.getAttribute('max');
  if (+el.value > mx) { el.value = mx; Utils.toast(`เต็ม ${mx} คะแนน`, 'warning'); }
  if (+el.value < 0) el.value = 0;
  updateScoreInputState(el);
  const tr = el.closest('tr');
  handleAutoTab(el, tr, mx);
  // คำนวณ exam รวมหลัง scale
  const examRawVals = [...tr.querySelectorAll(`.exam-sub${t}`)].map(i => Number(i.value)||0);
  const examScaled  = ScoreLogic.calcExamScaled(t, examRawVals);
  // อัปเดต span แสดงผล (ถ้ามี)
  const examSpan = tr.querySelector(`.t${t}e-total`);
  if (examSpan) examSpan.textContent = examScaled || '-';
  recalcTotsFromExamSub(tr, t, examScaled);
  refreshAllScoreInputStates(tr);
}

function recalcTotsFromExamSub(tr, t, examTotal) {
  const getVal = sel => Number(tr.querySelector(sel)?.textContent || tr.querySelector(sel)?.value || 0);
  const keep  = getVal(`.t${t}sc`);
  const total = keep + examTotal;
  const tgt   = ScoreLogic.getTarget();
  const upd   = (sel, val, cls) => { const e = tr.querySelector(sel); if(e){e.textContent=val||'-';e.className=cls;} };
  upd(`.t${t}tot`, total, `tbadge ${total===0?'nil':'ok'} t${t}tot`);
  upd('.gtot', total, `gbadge ${total===0?'nil':total<tgt*0.5?'fail':'ok'} gtot`);
  upd('.final-grade', total===0?'-':Utils.calcGradeFrontend(total),
      `gbadge ${total===0?'nil':total<tgt*0.5?'fail':'ok'} final-grade`);
}

function recalcTots(tr) {
  const t = App.activeTerm || 1;
  const getVal = (sel) => Number(tr.querySelector(sel)?.textContent || tr.querySelector(sel)?.value || 0);
  const keep = getVal(`.t${t}sc`), exam = getVal(`.s-t${t}e`), total = keep + exam;
  const tgt  = ScoreLogic.getTarget();
  const upd  = (sel, val, cls) => { const e = tr.querySelector(sel); if(e){e.textContent=val||'-';e.className=cls;} };

  upd(`.t${t}tot`, total, `tbadge ${total===0?'nil':'ok'} t${t}tot`);
  upd('.gtot',      total, `gbadge ${total===0?'nil':total<tgt*0.5?'fail':'ok'} gtot`);
  upd('.final-grade', total===0?'-':Utils.calcGradeFrontend(total),
      `gbadge ${total===0?'nil':total<tgt*0.5?'fail':'ok'} final-grade`);
}

function applySubConfig() {
  if (!App.students.length) return Utils.toast('โหลดรายชื่อก่อน', 'error');
  if (ScoreLogic.getUnitsMax(1) > (50)) return Utils.toast(`เทอม 1: คะแนนรวมเกิน ${50}`, 'error');
  if (ScoreLogic.getUnitsMax(2) > 50) return Utils.toast('เทอม 2: คะแนนรวมเกิน 50', 'error');
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
  const indicatorBuckets = getIndicatorBucketsFromForm();
  return {
    learningArea: $('ci_learning_area').value || '',
    name: $('ci_name').value || '',
    code: $('ci_code').value || '',
    type: $('ci_type').value || 'รายวิชาพื้นฐาน',
    credit: $('ci_credit').value || '',
    teacherName: $('ci_teacher_name').value || '',
    groupHeadName: $('ci_group_head_name').value || '',
    description: $('ci_description').value || '',
    indicators: indicatorBuckets,
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
  const rawIndicators = c.indicators;
  const indicatorBuckets = (rawIndicators && typeof rawIndicators === 'object' && !Array.isArray(rawIndicators))
    ? {
        formative: Array.isArray(rawIndicators.formative) ? rawIndicators.formative : [],
        summative: Array.isArray(rawIndicators.summative) ? rawIndicators.summative : []
      }
    : {
        formative: String(rawIndicators || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean),
        summative: []
      };

  $('ci_learning_area').value = c.learningArea || '';
  $('ci_name').value = c.name || subj || '';
  $('ci_code').value = c.code || '';
  $('ci_type').value = c.type || 'รายวิชาพื้นฐาน';
  $('ci_credit').value = c.credit || '';
  $('ci_teacher_name').value = c.teacherName || '';
  $('ci_group_head_name').value = c.groupHeadName || '';
  $('ci_description').value = c.description || '';
  if ($('ci_indicators_formative')) $('ci_indicators_formative').value = indicatorBuckets.formative.join('\n');
  if ($('ci_indicators_summative')) $('ci_indicators_summative').value = indicatorBuckets.summative.join('\n');
  ['mon','tue','wed','thu','fri'].forEach(d => $(`sch_${d}`).value = c.schedule?.[d] || 0);
  $('ci_manual_adjust').value = c.schedule?.manualAdjust || 0;
  $('ci_total_hours').textContent = c.schedule?.totalHours || 0;
  refreshCourseOverview();
}

function getSchoolProfileForm() {
  return { school_name: $('sp_school_name').value || '', director_name: $('sp_director_name').value || '', director_position: $('sp_director_position').value || 'ผู้อำนวยการโรงเรียน', academic_head_name: $('sp_academic_head_name').value || '', academic_head_position: $('sp_academic_head_position').value || 'หัวหน้าวิชาการ' };
}

function setSchoolProfileForm(p = {}) {
  App.schoolProfile = { ...App.schoolProfile, ...p };['school_name','director_name','director_position','academic_head_name','academic_head_position'].forEach(k => $(`sp_${k}`).value = App.schoolProfile[k]);
}

function buildConfigPayload() {
  if (!App.examUnits) App.examUnits = { 1: [], 2: [] };
  return {
    t1_acc: ScoreLogic.getUnitsMax(1), t1_exam: ScoreLogic.getExamMax(1),
    t2_acc: ScoreLogic.getUnitsMax(2), t2_exam: ScoreLogic.getExamMax(2),
    units:     { t1: App.units[1],     t2: App.units[2] },
    examUnits: { t1: App.examUnits[1], t2: App.examUnits[2] },
    subItems: { t1: [], t2: [] }, rawMax: { t1: 0, t2: 0 },
    courseInfo: getCourseInfoForm()
  };
}

async function saveGrades() {
  ScoreLogic.syncHiddenInputs();

  const subj = App.loadedSubject;
  const cls  = App.loadedClass || $('gClass').value;
  const year = App.loadedYear  || $('gYear').value;
  const t    = App.activeTerm  || 1;

  if (!subj) return Utils.toast('กรุณาเลือกวิชาก่อนบันทึก', 'error');

  const tgt = ScoreLogic.getTarget();
  if (ScoreLogic.getUnitsMax(t) > tgt)
    return Utils.toast(`เทอม ${t}: คะแนนรวมหน่วยเกิน ${tgt}`, 'error');

  // snapshot สำหรับเทอมที่ไม่ได้แสดง (เพื่อไม่เขียนทับ)
  const stuMap = {};
  (App.students || []).forEach(s => { stuMap[s.studentId] = s.grades || {}; });

  const records = [];
  $$('#gtBody tr[data-sid]').forEach(tr => {
    const sid  = tr.getAttribute('data-sid');
    const snap = stuMap[sid] || {};
    const other = t === 1 ? 2 : 1;

    // อ่านค่าจาก DOM ของเทอมที่แสดงอยู่
    const subVals = [...tr.querySelectorAll(`.sub${t}`)].map(i => i.value);
    const acc     = ScoreLogic.calcKeepFromFlat(t, subVals);
    const examEl  = tr.querySelector(`input[data-term="${t}"][data-type="exam"]`);

    // exam sub items (ถ้ามี) — scale แล้วส่ง
    const examSubInputs = [...tr.querySelectorAll(`.exam-sub${t}`)];
    const examSubVals   = examSubInputs.map(i => i.value);
    const examVal = examSubInputs.length > 0
      ? String(ScoreLogic.calcExamScaled(t, examSubVals.map(v => Number(v)||0)))
      : (examEl ? examEl.value : '');

    // ใช้ snapshot สำหรับเทอมอื่น
    const oAcc  = Number(snap[`t${other}_acc`])  || 0;
    const oExam = snap[`t${other}_exam`]  ?? '';
    const oSub  = Array.isArray(snap[`t${other}_sub`]) ? snap[`t${other}_sub`] : [];

    records.push(t === 1
      ? { studentId: sid, t1_sub: subVals, t1_acc: acc, t1_exam: examVal, t1_exam_sub: examSubVals,
          t2_sub: oSub, t2_acc: oAcc, t2_exam: oExam, t2_exam_sub: snap.t2_exam_sub || [] }
      : { studentId: sid, t1_sub: oSub, t1_acc: oAcc, t1_exam: oExam, t1_exam_sub: snap.t1_exam_sub || [],
          t2_sub: subVals, t2_acc: acc, t2_exam: examVal, t2_exam_sub: examSubVals }
    );
  });

  if (!records.length) return Utils.toast('ยังไม่มีข้อมูล', 'warning');

  Utils.showLoading(`กำลังบันทึกคะแนนเทอม ${t}...`);
  try {
    const res = await api('saveGrades', {
      year, classroom: cls, subject: subj,
      config: buildConfigPayload(),
      gradeRecords: records
    });
    // อัปเดต snapshot
    records.forEach(rec => {
      if (stuMap[rec.studentId]) Object.assign(stuMap[rec.studentId], {
        t1_sub: rec.t1_sub, t1_acc: rec.t1_acc, t1_exam: rec.t1_exam,
        t2_sub: rec.t2_sub, t2_acc: rec.t2_acc, t2_exam: rec.t2_exam
      });
    });
    Utils.toast(`✅ บันทึกเทอม ${t} — ` + res);
  } catch (e) {
    Utils.toast(e.message || 'บันทึกไม่สำเร็จ', 'error');
  }
  Utils.hideLoading();
}

async function saveConfigOnly() {
  const subj = App.loadedSubject || $('gSubj').value;
  if (!subj || subj === "-- ไม่พบวิชา --") return false;
  if (ScoreLogic.getUnitsMax(1) > 50 || ScoreLogic.getUnitsMax(2) > 50) { Utils.toast('คะแนนรวมเกินเป้าหมาย', 'warning'); return false; }
  Utils.showLoading('กำลังบันทึกการตั้งค่า...');
  try { await api('saveGrades', { year: App.loadedYear || $('gYear').value, classroom: App.loadedClass || $('gClass').value, subject: subj, config: buildConfigPayload(), gradeRecords:[] }); return true; } catch (e) { Utils.toast(e.message, 'error'); return false; } finally { Utils.hideLoading(); }
}

async function saveSchoolProfile() {
  const p = getSchoolProfileForm(); Utils.showLoading('กำลังบันทึกข้อมูลโรงเรียน...');
  try { App.schoolProfile = p; Utils.toast('✅ ' + (await api('saveSchoolProfile', p) || 'บันทึกเรียบร้อย')); } catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

async function saveCourseMetaOnly() { if (!$('ci_name').value.trim()) $('ci_name').value = $('gSubj').value || ''; refreshCourseOverview(); if (await saveConfigOnly()) Utils.toast('✅ บันทึกข้อมูลวิชาเรียบร้อย'); }
async function saveScheduleOnly() { refreshCourseOverview(); if (await saveConfigOnly()) Utils.toast('✅ บันทึกเวลาเรียนเรียบร้อย'); }
async function saveScoreConfigOnly() { refreshCourseOverview(); if (await saveConfigOnly()) Utils.toast('✅ บันทึกการตั้งค่าคะแนนเรียบร้อย'); }

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


window.addEventListener('DOMContentLoaded', () => { try { refreshCourseOverview(); } catch(e) {} });

// ── auto-load เมื่อเลือกวิชา ─────────────────────────────
function onSubjChange() {
  const subj = $('gSubj').value;
  if (!subj) return; // ยังไม่เลือก (ค่าว่าง)
  loadGrades();
}
function _lockSubjectSelector_() {
  const subj = App.loadedSubject, cls = App.loadedClass, year = App.loadedYear;
  // ซ่อน sel-bar, แสดง lock bar
  const selBar  = $('subjSelBar');
  const lockBar = $('selectorLockBar');
  if (selBar)  selBar.style.display  = 'none';
  if (lockBar) {
    lockBar.style.display = 'flex';
    if ($('lockBarSubj'))  $('lockBarSubj').textContent  = subj  || '';
    if ($('lockBarClass')) $('lockBarClass').textContent = cls   || '';
    if ($('lockBarYear'))  $('lockBarYear').textContent  = year  || '';
  }
  // disable dropdown และ gYear เพื่อป้องกันเปลี่ยนค่า
  ['gClass','gSubj','gYear'].forEach(id => { if ($(id)) $(id).disabled = true; });
}

function unlockSubjectSelector() {
  const selBar  = $('subjSelBar');
  const lockBar = $('selectorLockBar');
  if (selBar)  selBar.style.display  = '';
  if (lockBar) lockBar.style.display = 'none';
  ['gClass','gSubj','gYear'].forEach(id => { if ($(id)) $(id).disabled = false; });
  // reset dropdown วิชากลับเป็นว่าง (ไม่ auto-select)
  const sel = $('gSubj');
  if (sel) sel.value = '';
  // ล้าง loaded state
  App.loadedSubject = null;
  App.loadedClass   = null;
  App.loadedYear    = null;
  // ซ่อน grade panel
  if ($('gradePanel')) $('gradePanel').style.display = 'none';
}
