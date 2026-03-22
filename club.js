// =====================================================
// club.js — ระบบชุมนุม
// =====================================================

const Club = {
  term: '1',
  clubName: '',
  teacher: '',
  dayOfWeek: '5',
  dates: [],            // วันที่กรองจากช่วงเทอม + วันที่เลือก
  members: [],          // { studentId, name, classroom }
  topics: [],           // ['หัวข้อครั้งที่ 1', ...]
  attMap: {},           // { studentId: ['ป','ข','ล',...] }
  resultMap: {},        // { studentId: 'ผ่าน'|'ไม่ผ่าน' }
  allClassStudents: {},
  loadErrors: {},
  activeClassTab: '',
  loaded: false
};

// ── helpers ──────────────────────────────────────────
function _clubShortDate(dStr) {
  const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const p = String(dStr).split('/');
  if (p.length !== 3) return dStr;
  return parseInt(p[0]) + ' ' + m[parseInt(p[1])-1] + ' ' + String(p[2]).slice(-2);
}

// ── คำนวณวันที่ชุมนุม (กรองจากช่วงเทอม + วันที่เลือก + ตัดวันหยุด) ──
function calcClubDates() {
  const term      = Club.term;
  const dayOfWeek = parseInt(Club.dayOfWeek);
  const startD    = App.termDates['t' + term + '_start'];
  const endD      = App.termDates['t' + term + '_end'];
  if (!startD || !endD) return [];

  function parseD(str) {
    const p = String(str).split(/[\/\-]/);
    if (p.length !== 3) return new Date();
    const y = parseInt(p[2]) > 2500 ? parseInt(p[2]) - 543 : parseInt(p[2]);
    return new Date(y, parseInt(p[1]) - 1, parseInt(p[0]));
  }

  const hSet = new Set(
    (App.holidays || []).filter(h => h.type === 'holiday').map(h => h.date)
  );
  const dates = [];
  const cur = parseD(startD), end = parseD(endD);
  cur.setHours(0,0,0,0); end.setHours(0,0,0,0);
  while (cur <= end) {
    if (cur.getDay() === dayOfWeek) {
      const dd = String(cur.getDate()).padStart(2,'0');
      const mm = String(cur.getMonth()+1).padStart(2,'0');
      const yy = cur.getFullYear() + 543;
      const key = `${dd}/${mm}/${yy}`;
      if (!hSet.has(key)) dates.push(key);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function refreshClubDates() {
  Club.dates = calcClubDates();
  // sync topics ให้ตรงกับจำนวนวัน (ถ้า topics ยังไม่ถูก set จากที่บันทึกไว้)
  if (Club.topics.length === 0 && Club.dates.length > 0) {
    Club.topics = Club.dates.map((d, i) => '');
  } else if (Club.topics.length !== Club.dates.length && Club.topics.length === 0) {
    Club.topics = Array(Club.dates.length).fill('');
  }
  // ขยาย attMap ให้ครบทุกวัน
  Club.members.forEach(m => {
    if (!Club.attMap[m.studentId]) Club.attMap[m.studentId] = [];
    while (Club.attMap[m.studentId].length < Club.dates.length) Club.attMap[m.studentId].push('ป');
    Club.attMap[m.studentId] = Club.attMap[m.studentId].slice(0, Club.dates.length);
  });
  _renderClubActivity();
}

function renderClubPanel() {
  const wrap = $('clubContainer'); if (!wrap) return;
  _renderClubMain();
}

function switchClubTab(term, btn) {
  Club.term = String(term);
  document.querySelectorAll('#clubTabs .ttab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  Club.allClassStudents = {};
  Club.loadErrors = {};
  Club.loaded = false;
  _renderClubMain();
}

// ── โหลดรายชื่อทุกชั้น ──────────────────────────────
async function loadAllClubStudents() {
  const year = $('gYear').value;
  if (!year) { Utils.toast('กรุณาเลือกปีการศึกษาก่อน', 'error'); return; }
  if (!App.subs || !Object.keys(App.subs).length) {
    Utils.toast('ไม่พบข้อมูลรายวิชา กรุณา Login ใหม่', 'error'); return;
  }

  const t       = Club.term;
  const classes = [...new Set(CONFIG.ALL_CLS.map(c => c.replace(/ เทอม [12]/g, '').trim()))];

  Utils.showLoading('โหลดรายชื่อทุกชั้น...');
  try {
    const results = await Promise.all(
      classes.map(async cls => {
        const subsKey = Object.keys(App.subs).find(k => k === cls || k.startsWith(cls + ' '));
        const subs = subsKey ? (App.subs[subsKey] || []) : [];
        const classroomKey = subsKey || cls;
        if (!subs.length) return { cls, students: [], error: null };
        try {
          const res = await api('getGrades', { year, classroom: classroomKey, subject: subs[0] });
          return { cls, students: (res.students || []).map(s => ({ studentId: s.studentId, name: s.name, inOtherClub: false, clubName: '' })), error: null };
        } catch(e) {
          return { cls, students: [], error: e.message || 'โหลดไม่สำเร็จ' };
        }
      })
    );

    Club.allClassStudents = {};
    Club.loadErrors = {};
    results.forEach(({ cls, students, error }) => {
      Club.allClassStudents[cls] = students;
      if (error) Club.loadErrors[cls] = error;
    });

    const successCount = results.filter(r => !r.error && r.students.length > 0).length;
    const failCount    = results.filter(r => !!r.error).length;
    const firstCls = classes.find(c => (Club.allClassStudents[c] || []).length > 0) || classes[0];
    Club.activeClassTab = firstCls;
    Club.loaded = true;

    if (failCount > 0 && successCount === 0) Utils.toast('โหลดรายชื่อไม่สำเร็จ ตรวจสอบปีการศึกษา', 'error');
    else if (failCount > 0) Utils.toast(`⚠️ โหลดสำเร็จ ${successCount} ชั้น, ไม่สำเร็จ ${failCount} ชั้น`);
    else Utils.toast(`✅ โหลดรายชื่อสำเร็จทั้ง ${successCount} ชั้น`);

    _renderClubMain();
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// ── โหลดข้อมูลชุมนุมที่บันทึกไว้ (เรียกอัตโนมัติตอนเปิดหน้า) ──────
async function loadSavedClub() {
  const year = $('gYear').value;
  if (!year) { Utils.toast('กรุณาเลือกปีการศึกษาก่อน', 'error'); return; }
  const t = Club.term;
  const classes = [...new Set(CONFIG.ALL_CLS.map(c => c.replace(/ เทอม [12]/g, '').trim()))];

  // ป้องกันกดซ้อน
  if (document.getElementById('btnLoadSaved')) document.getElementById('btnLoadSaved').disabled = true;
  Utils.showLoading('โหลดข้อมูลชุมนุม...');
  try {
    const savedResults = await Promise.all(
      classes.map(cls =>
        api('getClubsByClassroom', { year, classroom: cls, term: t })
          .then(res => ({ cls, students: res.students || [] }))
          .catch(() => ({ cls, students: [] }))
      )
    );

    const savedMembers = [];
    const savedResultMap = {};
    let savedClubName = '';

    savedResults.forEach(({ cls, students }) => {
      students.forEach(s => {
        if (s.clubName) {
          savedMembers.push({ studentId: s.studentId, name: s.name, classroom: cls });
          if (s.result) savedResultMap[s.studentId] = s.result;
          if (!savedClubName) savedClubName = s.clubName;
        }
      });
    });

    if (savedMembers.length === 0) {
      Utils.toast('ยังไม่มีข้อมูลชุมนุมที่บันทึกไว้');
      _renderClubMain();
      Utils.hideLoading();
      return;
    }

    Club.members    = savedMembers;
    Club.resultMap  = savedResultMap;
    if (savedClubName) Club.clubName = savedClubName;

    // โหลด termDates + holidays ถ้ายังไม่มี (จำเป็นสำหรับคำนวณวันชุมนุม)
    if (!App.termDates || !App.termDates['t' + t + '_start']) {
      try {
        // ดึงจากชั้นแรกที่มีสมาชิก
        const firstMember = savedMembers[0];
        const clsKey  = firstMember.classroom;
        const subsKey = Object.keys(App.subs || {}).find(k => k === clsKey || k.startsWith(clsKey + ' '));
        const subs    = subsKey ? (App.subs[subsKey] || []) : [];
        if (subs.length) {
          const gradeRes = await api('getGrades', { year, classroom: subsKey || clsKey, subject: subs[0] });
          if (gradeRes.termDates) App.termDates = gradeRes.termDates;
          if (gradeRes.holidays)  App.holidays  = gradeRes.holidays;
        }
      } catch(e) { /* ถ้าโหลดไม่ได้ — ใช้ dates เปล่า */ }
    }

    // โหลด topics + attArray
    try {
      const attRes = await api('getClubAttendanceDetail', {
        year,
        members: savedMembers.map(m => ({ studentId: m.studentId, classroom: m.classroom })),
        term: t
      });
      const aMap = attRes.attendanceMap || {};
      if (attRes.topics && attRes.topics.length) Club.topics = attRes.topics;
      if (attRes.teacher)   Club.teacher   = attRes.teacher;
      if (attRes.dayOfWeek) Club.dayOfWeek = attRes.dayOfWeek;
      if (attRes.clubName)  Club.clubName  = attRes.clubName;
      savedMembers.forEach(m => {
        const d = aMap[m.studentId];
        if (d) {
          Club.attMap[m.studentId]    = d.attArray || [];
          Club.resultMap[m.studentId] = d.result   || 'ไม่ผ่าน';
        }
      });
    } catch(e) { /* ยังไม่มีกิจกรรม — ไม่ error */ }

    Club.dates = calcClubDates();
    // ถ้า topics น้อยกว่าวัน → pad ให้ครบ
    if (Club.topics.length < Club.dates.length) {
      while (Club.topics.length < Club.dates.length) Club.topics.push('');
    }
    // sync attMap ให้ครบทุกวัน
    Club.members.forEach(m => {
      if (!Club.attMap[m.studentId]) Club.attMap[m.studentId] = [];
      while (Club.attMap[m.studentId].length < Club.dates.length) Club.attMap[m.studentId].push('ป');
      Club.attMap[m.studentId] = Club.attMap[m.studentId].slice(0, Club.dates.length);
    });
    Utils.toast(`✅ โหลดชุมนุม "${Club.clubName}" ${savedMembers.length} คน — ${Club.dates.length} ครั้ง`);
    _renderClubMain();
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
  if (document.getElementById('btnLoadSaved')) document.getElementById('btnLoadSaved').disabled = false;
}

function switchClubClassTab(cls) {
  Club.activeClassTab = cls;
  _renderClubStudentPicker();
}

// ── render หน้าหลัก ──────────────────────────────────
function _renderClubMain() {
  const wrap = $('clubContainer'); if (!wrap) return;
  const t = Club.term;
  const memberCount = Club.members.length;
  const byClass = {};
  Club.members.forEach(m => {
    if (!byClass[m.classroom]) byClass[m.classroom] = [];
    byClass[m.classroom].push(m);
  });

  wrap.innerHTML = `
    <div class="card mb-3" style="background:#fefce8;border:1px solid #fde68a;">
      <div style="font-weight:800;font-size:.9rem;color:#92400e;margin-bottom:12px;">
        🎯 ตั้งค่าชุมนุม ภาคเรียนที่ ${t}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:200px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">ชื่อชุมนุม</label>
          <input type="text" class="cfg-n" style="width:100%;text-align:left;"
            placeholder="เช่น ชุมนุมคอมพิวเตอร์" value="${Club.clubName}"
            oninput="Club.clubName=this.value">
        </div>
        <div style="flex:0;min-width:130px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">ครูที่ปรึกษา</label>
          <input type="text" class="cfg-n" style="width:100%;text-align:left;"
            placeholder="ชื่อครู" value="${Club.teacher}"
            oninput="Club.teacher=this.value">
        </div>
        <div style="flex:0;min-width:100px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">วันเรียน</label>
          <select class="cfg-n" style="width:100%;" onchange="Club.dayOfWeek=this.value;refreshClubDates()">
            ${['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์'].map((d,i) =>
              `<option value="${i+1}" ${Club.dayOfWeek==i+1?'selected':''}>${d}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <hr style="border-color:#fde68a;margin:10px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:12px;font-weight:700;color:#92400e;">เพิ่ม/ลบสมาชิกชุมนุม</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="btnLoadSaved" class="btn-pri" style="padding:6px 14px;font-size:.82rem;background:#6b7280;"
            onclick="loadSavedClub()">
            📂 โหลดชุมนุมที่บันทึกไว้
          </button>
          <button class="btn-pri" style="padding:6px 14px;font-size:.82rem;background:linear-gradient(135deg,#d97706,#b45309);"
            onclick="loadAllClubStudents()">
            ${Club.loaded ? '🔄 รีโหลดรายชื่อ' : '👥 จัดการสมาชิก'}
          </button>
        </div>
      </div>
      <div id="clubStudentPicker">
        ${!Club.loaded ? `<div style="font-size:13px;color:#9ca3af;padding:6px 0;">กดโหลดรายชื่อเพื่อเลือกนักเรียน</div>` : ''}
      </div>

      <hr style="border-color:#fde68a;margin:12px 0;">
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;">
        สมาชิกชุมนุมปัจจุบัน <span style="font-weight:400;color:#6b7280;">(${memberCount} คน)</span>
      </div>
      <div id="clubMemberChips">
        ${memberCount === 0
          ? `<div style="font-size:12px;color:#9ca3af;">ยังไม่มีสมาชิก</div>`
          : Object.entries(byClass).map(([cls, ms]) =>
              `<div style="margin-bottom:6px;">
                <span style="font-size:11px;font-weight:700;color:#92400e;margin-right:6px;">${cls}</span>
                ${ms.map(m =>
                  `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
                    border-radius:20px;background:#fef3c7;border:1px solid #fde68a;font-size:12px;color:#92400e;margin:2px;">
                    ${m.name}
                    <button onclick="toggleClubMember('${m.studentId}','${m.name.replace(/'/g,"\\'")}','${m.classroom}')"
                      style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:0;line-height:1;">×</button>
                  </span>`
                ).join('')}
              </div>`
            ).join('')
        }
      </div>
    </div>

    ${memberCount > 0 ? `
    <div class="card mb-3" style="background:#fff;border:1px solid #fde68a;">
      <div style="font-size:.88rem;font-weight:700;color:#92400e;margin-bottom:12px;">📋 บันทึกกิจกรรมชุมนุม ภาคเรียนที่ ${t}</div>
      <div id="clubActivitySection"></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button class="btn-save w-100" onclick="saveClubData()"
          style="background:linear-gradient(135deg,#d97706,#b45309);">
          💾 บันทึกชุมนุม ภาคเรียน ${t}
        </button>
      </div>
    </div>` : ''}
  `;

  if (Club.loaded) _renderClubStudentPicker();
  if (memberCount > 0) {
    if (Club.dates.length === 0) Club.dates = calcClubDates();
    _renderClubActivity();
  }
}

// ── tab เลือกนักเรียน ────────────────────────────────
function _renderClubStudentPicker() {
  const wrap = $('clubStudentPicker'); if (!wrap) return;
  const classes   = [...new Set(CONFIG.ALL_CLS.map(c => c.replace(/ เทอม [12]/g, '').trim()))];
  const activeCls = Club.activeClassTab || classes[0];

  const tabsHtml = classes.map(cls => {
    const selected = Club.members.filter(m => m.classroom === cls).length;
    const hasError = !!Club.loadErrors[cls];
    const on       = cls === activeCls;
    const border   = on ? '#d97706' : hasError ? '#fca5a5' : '#e5e7eb';
    const bg       = on ? '#fef3c7' : hasError ? '#fff1f2' : '#fff';
    const color    = on ? '#92400e' : hasError ? '#b91c1c' : '#6b7280';
    return `<button type="button" onclick="switchClubClassTab('${cls}')"
      title="${hasError ? Club.loadErrors[cls] : ''}"
      style="padding:4px 12px;border-radius:20px;white-space:nowrap;cursor:pointer;font-size:12px;
             border:1px solid ${border};background:${bg};color:${color};">
      ${cls}${hasError ? ' ⚠️' : ''}${selected > 0
        ? ` <span style="background:#d97706;color:#fff;border-radius:10px;padding:0 5px;font-size:11px;">${selected}</span>`
        : ''}
    </button>`;
  }).join('');

  const students = Club.allClassStudents[activeCls] || [];
  const errorMsg = Club.loadErrors[activeCls];

  let chipsHtml;
  if (errorMsg) {
    chipsHtml = `<div style="font-size:12px;color:#b91c1c;padding:8px;background:#fff1f2;border-radius:6px;border:1px solid #fecaca;">
      ⚠️ โหลดรายชื่อชั้น ${activeCls} ไม่สำเร็จ<br>
      <span style="color:#6b7280;font-size:11px;">${errorMsg}</span></div>`;
  } else if (students.length === 0) {
    chipsHtml = `<div style="font-size:12px;color:#9ca3af;padding:6px 0;">ไม่พบรายชื่อ</div>`;
  } else {
    chipsHtml = `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 0;">` +
      students.map(s => {
        const inMyClub = Club.members.some(m => m.studentId === s.studentId);
        const inOther  = s.inOtherClub && !inMyClub;
        const bg     = inMyClub ? '#d1fae5' : inOther ? '#f3f4f6' : '#fff';
        const border = inMyClub ? '#6ee7b7' : inOther ? '#e5e7eb' : '#d1d5db';
        const color  = inMyClub ? '#065f46' : inOther ? '#9ca3af' : '#374151';
        const click  = inOther ? '' : `toggleClubMember('${s.studentId}','${s.name.replace(/'/g,"\\'")}','${activeCls}')`;
        return `<div onclick="${click}" style="display:inline-flex;align-items:center;gap:3px;padding:4px 10px;
          border-radius:20px;border:1px solid ${border};background:${bg};font-size:12px;color:${color};
          cursor:${inOther?'not-allowed':'pointer'};user-select:none;${inOther?'opacity:.6;':''}">
          ${inMyClub?'✓ ':''}${s.name}${inOther?` <span style="font-size:10px;color:#9ca3af;">(${s.clubName})</span>`:''}
        </div>`;
      }).join('') + `</div>`;
  }

  wrap.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${tabsHtml}</div>
    <div style="max-height:220px;overflow-y:auto;">${chipsHtml}</div>`;
}

function toggleClubMember(sid, name, classroom) {
  const idx = Club.members.findIndex(m => m.studentId === sid);
  if (idx >= 0) {
    Club.members.splice(idx, 1);
    delete Club.attMap[sid];
    delete Club.resultMap[sid];
  } else {
    Club.members.push({ studentId: sid, name, classroom });
  }
  _renderClubMain();
  if (Club.loaded) _renderClubStudentPicker();
}

// ── ส่วนบันทึกกิจกรรม (เหมือนแนะแนว) ──────────────
function _renderClubActivity() {
  const wrap = $('clubActivitySection'); if (!wrap) return;
  const dates  = Club.dates;
  const nDates = dates.length;
  // sync topics ให้ตรงกับจำนวนวัน
  if (Club.topics.length !== nDates) {
    const old = Club.topics.slice();
    Club.topics = Array(nDates).fill('').map((_, i) => old[i] || '');
  }
  const topics  = Club.topics;
  const members = Club.members;
  const MONTHS  = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  const noTermDates = !App.termDates || !App.termDates['t' + Club.term + '_start'];
  if (noTermDates) {
    wrap.innerHTML = `<div style="font-size:13px;color:#d97706;padding:8px;background:#fef3c7;border-radius:6px;border:1px solid #fde68a;margin-bottom:12px;">
      ⚠️ ยังไม่พบวันเปิด-ปิดเทอม — กรุณาโหลดตารางคะแนนก่อน</div>`;
    return;
  }
  if (!members.length) { wrap.innerHTML = ''; return; }

  // ── ส่วน 1: บันทึกหัวข้อกิจกรรม ──
  const actRows = dates.map((d, i) => {
    const tv = topics[i] || '';
    const hr = Club.teacher || '';
    return `<tr>
      <td style="text-align:center;border:1px solid #e2e8f0;padding:5px;color:#94a3b8;font-size:.8rem;">${i+1}</td>
      <td style="border:1px solid #e2e8f0;padding:4px 6px;text-align:center;font-size:.82rem;color:#92400e;white-space:nowrap;">${_clubShortDate(d)}</td>
      <td style="border:1px solid #e2e8f0;padding:2px 4px;">
        <input type="text" class="club-topic" data-idx="${i}" value="${tv}"
          placeholder="หัวข้อกิจกรรม..."
          oninput="Club.topics[${i}]=this.value"
          style="width:100%;border:none;background:transparent;font-family:inherit;font-size:.84rem;padding:4px 6px;outline:none;">
      </td>
      <td style="border:1px solid #e2e8f0;padding:2px 4px;">
        <input type="text" class="club-teacher-inp" data-idx="${i}" value="${hr}"
          placeholder="ครูที่ปรึกษา..."
          oninput="Club.teacher=this.value"
          style="width:100%;border:none;background:transparent;font-family:inherit;font-size:.84rem;padding:4px 6px;outline:none;">
      </td>
    </tr>`;
  }).join('');

  // ── ส่วน 2: header วันที่ (แนวตั้ง) ──
  const dateHeaders = dates.map(d => {
    const p = d.split('/');
    return `<th style="width:22px;vertical-align:bottom;padding-bottom:4px;border:1px solid #e2e8f0;background:#f8fafc;">
      <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;font-weight:600;color:#92400e;white-space:nowrap;">
        ${parseInt(p[0])} ${MONTHS[parseInt(p[1])]} ${p[2].slice(-2)}
      </div></th>`;
  }).join('');

  // ── ส่วน 2: แถวนักเรียน ──
  const bodyRows = members.map((m, idx) => {
    const att = Club.attMap[m.studentId] || Array(nDates).fill('ป');
    while (att.length < nDates) att.push('ป');
    Club.attMap[m.studentId] = att.slice(0, nDates);

    const nP    = att.filter(v => v === 'ป').length;
    const nBase = att.filter(v => v !== '-').length;
    const result = Club.resultMap[m.studentId] ||
      (nBase > 0 && nP >= Math.ceil(nBase * 0.8) ? 'ผ่าน' : 'ไม่ผ่าน');

    const rCl = result==='ผ่าน'?'#16a34a':'#dc2626';
    const rBg = result==='ผ่าน'?'#dcfce7':'#fee2e2';
    const rBd = result==='ผ่าน'?'#86efac':'#fca5a5';

    function attSt(v) {
      if (v==='ข') return {bg:'#fee2e2',cl:'#dc2626',lb:'ข'};
      if (v==='ล') return {bg:'#fef3c7',cl:'#b45309',lb:'ล'};
      if (v==='-') return {bg:'#f8fafc',cl:'#94a3b8',lb:'-'};
      return {bg:'#f0fdf4',cl:'#166534',lb:'✓'};
    }

    const cells = att.slice(0, nDates).map((v, i) => {
      const st = attSt(v);
      return `<td class="club-day-cell" data-sid="${m.studentId}" data-idx="${i}" data-flag="${v}"
        onclick="cycleClubDay(this)"
        style="width:22px;min-width:22px;text-align:center;cursor:pointer;border:1px solid #e2e8f0;
               padding:2px 0;font-size:12px;font-weight:700;background:${st.bg};color:${st.cl};
               user-select:none;transition:background .1s;">${st.lb}</td>`;
    }).join('');

    return `<tr data-sid="${m.studentId}">
      <td style="text-align:center;border:1px solid #e2e8f0;padding:4px;position:sticky;left:0;z-index:10;background:#fff;font-size:.78rem;color:#94a3b8;min-width:28px;">${idx+1}</td>
      <td class="ass-name" style="text-align:left;border:1px solid #e2e8f0;padding:5px 8px;position:sticky;left:28px;z-index:10;background:#fff;white-space:nowrap;font-weight:600;min-width:160px;border-right:2px solid #fde68a;">
        ${m.name} <span style="font-size:10px;color:#9ca3af;font-weight:400;">${m.classroom}</span>
      </td>
      ${cells}
      <td class="club-total-val" style="text-align:center;font-weight:700;color:#0369a1;background:#eff6ff;border:1px solid #e2e8f0;padding:4px 6px;white-space:nowrap;min-width:48px;">${nP}/${nBase}</td>
      <td style="text-align:center;border:1px solid #e2e8f0;padding:3px 4px;">
        <select class="club-result"
          style="width:88px;padding:3px 4px;font-size:.78rem;font-weight:700;background:${rBg};color:${rCl};border:1.5px solid ${rBd};border-radius:6px;font-family:inherit;"
          onchange="Club.resultMap['${m.studentId}']=this.value;
                    this.style.background=this.value==='ผ่าน'?'#dcfce7':'#fee2e2';
                    this.style.color=this.value==='ผ่าน'?'#16a34a':'#dc2626';
                    this.style.borderColor=this.value==='ผ่าน'?'#86efac':'#fca5a5';">
          <option value="ผ่าน" ${result==='ผ่าน'?'selected':''}>ผ่าน</option>
          <option value="ไม่ผ่าน" ${result!=='ผ่าน'?'selected':''}>ไม่ผ่าน</option>
        </select>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:.88rem;color:#92400e;padding:8px 12px;background:#fef3c7;border-radius:8px 8px 0 0;border:1px solid #fde68a;border-bottom:none;">
        📋 บันทึกกิจกรรมชุมนุม ภาคเรียนที่ ${Club.term} (${nDates} ครั้ง)
      </div>
      <div style="border:1px solid #fde68a;border-radius:0 0 8px 8px;overflow:auto;max-height:260px;">
        <table style="width:100%;border-collapse:collapse;font-size:.84rem;min-width:500px;">
          <thead style="position:sticky;top:0;z-index:10;background:#fef9ee;">
            <tr>
              <th style="width:40px;border:1px solid #e2e8f0;padding:7px 4px;">ครั้งที่</th>
              <th style="width:90px;border:1px solid #e2e8f0;padding:7px 4px;">วันที่</th>
              <th style="border:1px solid #e2e8f0;padding:7px 8px;text-align:left;">หัวข้อกิจกรรม</th>
              <th style="width:200px;border:1px solid #e2e8f0;padding:7px 8px;text-align:left;">ครูที่ปรึกษา</th>
            </tr>
          </thead>
          <tbody>${actRows}</tbody>
        </table>
      </div>
    </div>

    <div>
      <div style="font-weight:700;font-size:.88rem;color:#0369a1;padding:8px 12px;background:#eff6ff;border-radius:8px 8px 0 0;border:1px solid #bae6fd;border-bottom:none;">
        ✅ ตารางการเข้าร่วม ภาคเรียนที่ ${Club.term}
        <span style="font-size:.75rem;font-weight:400;color:#64748b;margin-left:8px;">(คลิก: ✓มา → ขขาด → ลลา)</span>
      </div>
      <div style="border:1px solid #bae6fd;border-radius:0 0 8px 8px;overflow:auto;max-height:55vh;">
        <table style="border-collapse:collapse;font-size:.84rem;width:max-content;min-width:100%;">
          <thead style="position:sticky;top:0;z-index:20;background:#f0f9ff;">
            <tr>
              <th rowspan="2" style="width:28px;position:sticky;left:0;z-index:30;background:#f0f9ff;border:1px solid #e2e8f0;">ที่</th>
              <th rowspan="2" style="min-width:160px;text-align:left;padding-left:8px;position:sticky;left:28px;z-index:30;background:#f0f9ff;border:1px solid #e2e8f0;border-right:2px solid #fde68a;">ชื่อ-นามสกุล</th>
              <th colspan="${nDates}" style="border:1px solid #e2e8f0;background:#e0f2fe;font-size:.8rem;">วันที่เข้าร่วมกิจกรรม</th>
              <th rowspan="2" style="width:54px;border:1px solid #e2e8f0;background:#eff6ff;font-size:.78rem;">มา/รวม</th>
              <th rowspan="2" style="width:90px;border:1px solid #e2e8f0;background:#f0fdf4;">ผลประเมิน</th>
            </tr>
            <tr style="height:90px;">${dateHeaders}</tr>
          </thead>
          <tbody id="clubAttBody">${bodyRows}</tbody>
        </table>
      </div>
    </div>
  `;
}
// ── toggle มา/ขาด/ลา ────────────────────────────────
function cycleClubDay(cell) {
  const CY = { 'ป':'ข', 'ข':'ล', 'ล':'ป', '':'ป' };
  const ST = {
    'ป': { bg:'#f0fdf4', cl:'#166534', lb:'✓' },
    'ข': { bg:'#fee2e2', cl:'#dc2626', lb:'ข' },
    'ล': { bg:'#fef3c7', cl:'#b45309', lb:'ล' }
  };
  const cur  = cell.getAttribute('data-flag') || 'ป';
  const next = CY[cur] || 'ป';
  const st   = ST[next];
  const sid  = cell.getAttribute('data-sid');
  const idx  = parseInt(cell.getAttribute('data-idx'));

  cell.setAttribute('data-flag', next);
  cell.style.background = st.bg;
  cell.style.color      = st.cl;
  cell.textContent      = st.lb;

  // อัปเดต attMap
  if (!Club.attMap[sid]) Club.attMap[sid] = Array(Club.topics.length).fill('ป');
  Club.attMap[sid][idx] = next;

  // อัปเดต มา/รวม และผล
  const tr = cell.closest('tr');
  const allCells = tr.querySelectorAll('.club-day-cell');
  let nP = 0, nBase = 0;
  allCells.forEach(c => {
    const f = c.getAttribute('data-flag') || 'ป';
    if (f !== '-') nBase++;
    if (f === 'ป') nP++;
  });
  const totEl = tr.querySelector('.club-total-val');
  if (totEl) totEl.textContent = `${nP}/${nBase}`;
  const sel = tr.querySelector('.club-result');
  if (sel && nBase > 0) {
    const pass = nP >= Math.ceil(nBase * 0.8) ? 'ผ่าน' : 'ไม่ผ่าน';
    sel.value             = pass;
    sel.style.background  = pass==='ผ่าน' ? '#dcfce7' : '#fee2e2';
    sel.style.color       = pass==='ผ่าน' ? '#16a34a' : '#dc2626';
    sel.style.borderColor = pass==='ผ่าน' ? '#86efac' : '#fca5a5';
    Club.resultMap[sid] = pass;
  }
}

// ── จัดการหัวข้อ ─────────────────────────────────────
function addClubTopic() {
  const inp = $('clubTopicInp');
  const val = inp?.value?.trim() || `ครั้งที่ ${Club.topics.length + 1}`;
  Club.topics.push(val);
  if (inp) inp.value = '';
  // ขยาย attMap ของทุกสมาชิก
  Club.members.forEach(m => {
    if (!Club.attMap[m.studentId]) Club.attMap[m.studentId] = [];
    Club.attMap[m.studentId].push('ป');
  });
  _renderClubActivity();
}

function removeLastClubTopic() {
  if (!Club.topics.length) return;
  Club.topics.pop();
  Club.members.forEach(m => {
    if (Club.attMap[m.studentId]) Club.attMap[m.studentId].pop();
  });
  _renderClubActivity();
}

// ── บันทึก ───────────────────────────────────────────
async function saveClubData() {
  if (!Club.clubName.trim()) return Utils.toast('กรอกชื่อชุมนุมก่อน', 'error');
  if (!Club.members.length)  return Utils.toast('ยังไม่มีสมาชิก', 'error');

  // sync ผลจากหน้าจอ
  document.querySelectorAll('#clubAttBody tr[data-sid]').forEach(tr => {
    const sid  = tr.getAttribute('data-sid');
    const att  = [...tr.querySelectorAll('.club-day-cell')].map(c => c.getAttribute('data-flag') || 'ป');
    const res  = tr.querySelector('.club-result')?.value || 'ไม่ผ่าน';
    Club.attMap[sid]    = att;
    Club.resultMap[sid] = res;
  });

  const year    = $('gYear').value;
  const records = Club.members.map(m => ({
    studentId: m.studentId,
    classroom: m.classroom,
    attended:  (Club.attMap[m.studentId] || []).filter(v => v === 'ป').length,
    result:    Club.resultMap[m.studentId] || 'ไม่ผ่าน',
    attArray:  Club.attMap[m.studentId]    || []
  }));

  Utils.showLoading('บันทึกชุมนุม...');
  try {
    const res = await api('saveClub', {
      year,
      term:      Club.term,
      clubName:  Club.clubName,
      teacher:   Club.teacher,
      dayOfWeek: Club.dayOfWeek,
      topics:    Club.topics,
      dates:     Club.dates,
      records
    });
    Utils.toast('✅ ' + res);
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// ── โหลดข้อมูลที่บันทึกไว้ ──────────────────────────
async function loadClubAttendance() {
  if (!Club.members.length) return Utils.toast('ยังไม่มีสมาชิก', 'error');
  const year = $('gYear').value;
  Utils.showLoading('โหลดข้อมูล...');
  try {
    const res = await api('getClubAttendanceDetail', {
      year,
      members: Club.members.map(m => ({ studentId: m.studentId, classroom: m.classroom })),
      term: Club.term
    });
    const aMap = res.attendanceMap || {};
    if (res.topics && res.topics.length) Club.topics = res.topics;
    if (res.teacher)   Club.teacher   = res.teacher;
    if (res.dayOfWeek) Club.dayOfWeek = res.dayOfWeek;
    if (res.clubName)  Club.clubName  = res.clubName;
    Club.members.forEach(m => {
      const d = aMap[m.studentId];
      if (d) {
        Club.attMap[m.studentId]    = d.attArray || [];
        Club.resultMap[m.studentId] = d.result   || 'ไม่ผ่าน';
      }
    });
    _renderClubMain();
    Utils.toast('✅ โหลดข้อมูลสำเร็จ');
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// ── ดูชุมนุมของชั้น (ครูประจำชั้น) ─────────────────
async function loadHomeroomClubView() {
  const year = $('gYear').value, cls = $('gClass').value;
  const term = $('homeroomClubTerm')?.value || '1';
  const wrap = $('homeroomClubTable'); if (!wrap) return;
  if (!cls) { wrap.innerHTML = `<div style="color:#9ca3af;font-size:13px;">กรุณาเลือกชั้นเรียนก่อน</div>`; return; }
  Utils.showLoading('โหลดข้อมูลชุมนุม...');
  try {
    const res      = await api('getClubsByClassroom', { year, classroom: cls, term }).catch(() => ({ students: [] }));
    const students = res.students || [];
    const noClub   = students.filter(s => !s.clubName).length;
    const rows     = students.map((s,i) => {
      const badge  = s.clubName
        ? `<span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:2px 10px;border-radius:20px;font-size:.78rem;font-weight:700;">${s.clubName}</span>`
        : `<span style="color:#9ca3af;font-size:.78rem;">-</span>`;
      const result = s.result === 'ผ่าน'
        ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ผ่าน</span>`
        : s.result === 'ไม่ผ่าน'
          ? `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ไม่ผ่าน</span>`
          : `<span style="color:#9ca3af;font-size:.76rem;">-</span>`;
      return `<tr>
        <td style="text-align:center;color:#6b7280;font-size:.76rem;">${i+1}</td>
        <td style="font-weight:600;font-size:.82rem;">${s.name}</td>
        <td style="text-align:center;">${badge}</td>
        <td style="text-align:center;">${result}</td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `
      ${noClub > 0 ? `<div style="font-size:12px;color:#d97706;margin-bottom:8px;">⚠️ มี ${noClub} คนยังไม่มีชุมนุม</div>` : ''}
      <div style="overflow-x:auto;border:1px solid #fde68a;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:.84rem;">
          <thead><tr style="background:#fef3c7;">
            <th style="padding:7px;width:32px;text-align:center;font-size:.76rem;">ที่</th>
            <th style="padding:7px;text-align:left;font-size:.76rem;">ชื่อ-นามสกุล</th>
            <th style="padding:7px;text-align:center;font-size:.76rem;">ชุมนุม</th>
            <th style="padding:7px;text-align:center;font-size:.76rem;">ผล</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch(e) {
    Utils.toast(e.message, 'error');
    wrap.innerHTML = `<div style="color:#ef4444;font-size:13px;">${e.message}</div>`;
  }
  Utils.hideLoading();
}

async function printClubReport(term) {
  const year = $('gYear').value, cls = $('gClass').value;
  if (!cls) return Utils.toast('กรุณาเลือกชั้นก่อน', 'error');
  Utils.showLoading('สร้างรายงาน...');
  try {
    const res     = await api('getClubsByClassroom', { year, classroom: cls, term }).catch(() => ({ students: [] }));
    const profile = App.schoolProfile || {};
    const rows    = (res.students||[]).map((s,i) =>
      `<tr><td style="text-align:center;">${i+1}</td><td>${s.name}</td>
       <td style="text-align:center;">${s.clubName||'-'}</td>
       <td style="text-align:center;">${s.result||'-'}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{font-family:Sarabun,sans-serif;padding:20px;}h3,h4{text-align:center;margin:4px 0;}
      table{width:100%;border-collapse:collapse;margin-top:12px;}
      th,td{border:1px solid #ccc;padding:6px 10px;font-size:14px;}th{background:#fef3c7;}
      @media print{button{display:none;}}</style></head><body>
      <h3>${profile.school_name||''}</h3>
      <h4>สรุปชุมนุม ชั้น ${cls} ปีการศึกษา ${year} ภาคเรียนที่ ${term}</h4>
      <table><thead><tr><th>ที่</th><th>ชื่อ-นามสกุล</th><th>ชุมนุม</th><th>ผล</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;cursor:pointer;">🖨️ พิมพ์</button>
      </body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
  } catch(e) { Utils.toast(e.message,'error'); }
  Utils.hideLoading();
}
