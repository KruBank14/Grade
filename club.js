// =====================================================
// club.js — ระบบชุมนุม
// =====================================================

// ── State ──
const Club = {
  term: '1',
  clubName: '',
  members: [],        // { studentId, name, classroom }
  attendanceMap: {},  // studentId → { attArray, result, attended }
  topics: [],
  teacher: '',
  dayOfWeek: '5',
  loadedClass: '',
  loadedStudents: [],  // รายชื่อจากชั้นที่เลือก { studentId, name, inOtherClub, clubName }
  classroomClubMap: {} // studentId → clubName (ทุกชั้น cache)
};

// ── Tab switch ──
function switchClubTab(term, btn) {
  Club.term = String(term);
  document.querySelectorAll('#clubTabs .ttab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderClubPanel();
}

// ── Main render ──
function renderClubPanel() {
  const wrap = $('clubContainer'); if (!wrap) return;
  const t = Club.term;

  wrap.innerHTML = `
    <div class="card mb-3" style="background:#fefce8;border:1px solid #fde68a;">
      <div style="font-weight:800;font-size:.9rem;color:#92400e;margin-bottom:12px;">
        🎯 ตั้งค่าชุมนุม ภาคเรียนที่ ${t}
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:200px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">ชื่อชุมนุม</label>
          <input type="text" id="clubNameInp_${t}" class="cfg-n" style="width:100%;text-align:left;"
            placeholder="เช่น ชุมนุมคอมพิวเตอร์" value="${Club.clubName}"
            oninput="Club.clubName=this.value">
        </div>
        <div style="flex:0;min-width:120px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">ครูที่ปรึกษา</label>
          <input type="text" id="clubTeacherInp_${t}" class="cfg-n" style="width:100%;text-align:left;"
            placeholder="ชื่อครู" value="${Club.teacher}"
            oninput="Club.teacher=this.value">
        </div>
        <div style="flex:0;min-width:100px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">วันเรียน</label>
          <select id="clubDayInp_${t}" class="cfg-n" style="width:100%;" onchange="Club.dayOfWeek=this.value">
            ${['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์'].map((d,i) =>
              `<option value="${i+1}" ${Club.dayOfWeek==i+1?'selected':''}>${d}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <hr style="border-color:#fde68a;margin:10px 0;">

      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;">
        เพิ่มนักเรียนเข้าชุมนุม
      </div>

      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">เลือกชั้น</label>
          <select id="clubClassSel_${t}" class="cfg-n" style="min-width:140px;">
            <option value="">-- เลือกชั้น --</option>
            ${CONFIG.ALL_CLS.filter(c => !c.includes('เทอม')).map(c =>
              `<option value="${c}">${c}</option>`
            ).join('')}
          </select>
        </div>
        <button class="btn-pri" style="padding:7px 16px;font-size:.84rem;"
          onclick="loadClubClassStudents('${t}')">
          📋 โหลดรายชื่อ
        </button>
      </div>

      <div id="clubStudentList_${t}" style="max-height:240px;overflow-y:auto;"></div>

      <hr style="border-color:#fde68a;margin:10px 0;">

      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;">
        สมาชิกชุมนุมปัจจุบัน
        <span style="font-weight:400;color:#6b7280;">(${Club.members.length} คน)</span>
      </div>
      <div id="clubMemberChips_${t}"></div>
    </div>

    <div class="card mb-3" style="background:#fff;border:1px solid #fde68a;">
      <div style="font-size:.88rem;font-weight:700;color:#92400e;margin-bottom:10px;">
        📋 บันทึกการเข้าร่วม
      </div>
      <div id="clubAttContainer_${t}">
        <div class="text-center text-muted py-3" style="font-size:13px;">
          ${Club.members.length ? 'กดโหลดข้อมูลเพื่อแสดงตาราง' : 'ยังไม่มีสมาชิกชุมนุม'}
        </div>
      </div>
      ${Club.members.length ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:.78rem;color:#6b7280;">* เกณฑ์: เวลาเรียน ≥ 80% = "ผ่าน"</div>
          <button class="btn-pri" onclick="loadClubAttendance('${t}')" style="background:linear-gradient(135deg,#d97706,#b45309);">
            🔄 โหลดข้อมูลการเข้าร่วม
          </button>
        </div>
        <button class="btn-save mt-3 w-100" onclick="saveClubData('${t}')"
          style="background:linear-gradient(135deg,#d97706,#b45309);">
          💾 บันทึกชุมนุม ภาคเรียน ${t}
        </button>
      ` : ''}
    </div>
  `;

  renderClubMemberChips(t);
}

// ── โหลดรายชื่อชั้นที่เลือก ──
async function loadClubClassStudents(t) {
  const sel = $(`clubClassSel_${t}`);
  const cls = sel?.value;
  if (!cls) return Utils.toast('เลือกชั้นก่อน', 'error');

  const year = $('gYear').value;
  Utils.showLoading('โหลดรายชื่อ...');
  try {
    const res = await api('getClubStudentsForClass', { year, classroom: cls, term: t });
    Club.loadedClass = cls;
    Club.loadedStudents = res.students || [];
    renderClubStudentList(t);
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

function renderClubStudentList(t) {
  const wrap = $(`clubStudentList_${t}`); if (!wrap) return;
  const students = Club.loadedStudents;

  if (!students.length) {
    wrap.innerHTML = `<div style="font-size:13px;color:#9ca3af;padding:8px 0;">ไม่พบรายชื่อ</div>`;
    return;
  }

  wrap.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;">` +
    students.map(s => {
      const inMyClub = Club.members.some(m => m.studentId === s.studentId);
      const inOther  = s.inOtherClub && !inMyClub;
      const disabled = inOther ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;';
      const bg       = inMyClub ? '#d1fae5' : inOther ? '#f3f4f6' : '#fff';
      const border   = inMyClub ? '#6ee7b7' : inOther ? '#e5e7eb' : '#d1d5db';
      const check    = inMyClub ? '✓ ' : '';
      const tag      = inOther ? ` <span style="font-size:10px;color:#9ca3af;">(${s.clubName})</span>` : '';
      return `<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
        border-radius:20px;border:1px solid ${border};background:${bg};
        font-size:12px;${disabled}"
        onclick="${inOther ? '' : `toggleClubMember('${s.studentId}','${s.name.replace(/'/g,"\\'")}','${Club.loadedClass}')`}">
        ${check}${s.name}${tag}
      </div>`;
    }).join('') + `</div>`;
}

function toggleClubMember(sid, name, classroom) {
  const idx = Club.members.findIndex(m => m.studentId === sid);
  if (idx >= 0) Club.members.splice(idx, 1);
  else Club.members.push({ studentId: sid, name, classroom });
  renderClubStudentList(Club.term);
  renderClubMemberChips(Club.term);
}

function renderClubMemberChips(t) {
  const wrap = $(`clubMemberChips_${t}`); if (!wrap) return;
  if (!Club.members.length) {
    wrap.innerHTML = `<div style="font-size:12px;color:#9ca3af;">ยังไม่มีสมาชิก</div>`;
    return;
  }

  // จัดกลุ่มตามชั้น
  const byClass = {};
  Club.members.forEach(m => {
    if (!byClass[m.classroom]) byClass[m.classroom] = [];
    byClass[m.classroom].push(m);
  });

  wrap.innerHTML = Object.entries(byClass).map(([cls, members]) =>
    `<div style="margin-bottom:6px;">
      <span style="font-size:11px;font-weight:700;color:#92400e;margin-right:6px;">${cls}</span>
      ${members.map(m =>
        `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
          border-radius:20px;background:#fef3c7;border:1px solid #fde68a;
          font-size:12px;color:#92400e;margin:2px;">
          ${m.name}
          <button onclick="toggleClubMember('${m.studentId}','${m.name.replace(/'/g,"\\'")}','${m.classroom}')"
            style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:0;line-height:1;">×</button>
        </span>`
      ).join('')}
    </div>`
  ).join('');
}

// ── โหลดข้อมูลการเข้าร่วม ──
async function loadClubAttendance(t) {
  if (!Club.members.length) return Utils.toast('ยังไม่มีสมาชิก', 'error');
  const year = $('gYear').value;
  const classroom = $('gClass').value;
  Utils.showLoading('โหลดข้อมูล...');
  try {
    const res = await api('getClubAttendanceDetail', {
      year,
      members: Club.members.map(m => ({ studentId: m.studentId, classroom: m.classroom })),
      term: t
    });
    Club.attendanceMap = res.attendanceMap || {};
    Club.topics = res.topics || Club.topics;
    Club.teacher = res.teacher || Club.teacher;
    Club.dayOfWeek = res.dayOfWeek || Club.dayOfWeek;
    Club.clubName = res.clubName || Club.clubName;
    renderClubAttTable(t);
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

function renderClubAttTable(t) {
  const wrap = $(`clubAttContainer_${t}`); if (!wrap) return;
  if (!Club.members.length) { wrap.innerHTML = ''; return; }

  // reuse logic เดียวกับ guidance
  const attMap = Club.attendanceMap;
  const topics = Club.topics;

  // header topics
  const topicCount = topics.length;
  const topicHeaders = topics.map((tp, i) =>
    `<th style="font-size:.72rem;writing-mode:vertical-rl;transform:rotate(180deg);
      max-height:120px;white-space:nowrap;padding:6px 3px;background:#fef3c7;color:#92400e;">
      ${i+1}. ${tp}
    </th>`
  ).join('');

  const rows = Club.members.map((m, idx) => {
    const d = attMap[m.studentId] || {};
    const attArray = Array.isArray(d.attArray) ? d.attArray : Array(topicCount).fill('');
    const attended = Number(d.attended) || attArray.filter(v => v === 'เข้า' || v === '1' || v === true).length;
    const result = d.result || (topicCount > 0 && attended/topicCount >= 0.8 ? 'ผ่าน' : 'ไม่ผ่าน');
    const topicCells = Array(topicCount).fill(0).map((_, i) => {
      const val = attArray[i] || '';
      const checked = val === 'เข้า' || val === '1' || val === true;
      return `<td style="text-align:center;">
        <input type="checkbox" ${checked ? 'checked' : ''}
          style="width:16px;height:16px;cursor:pointer;accent-color:#d97706;"
          onchange="updateClubAtt('${m.studentId}',${i},this.checked,'${t}')">
      </td>`;
    }).join('');
    const badge = result === 'ผ่าน'
      ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:.78rem;font-weight:700;">ผ่าน</span>`
      : `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:.78rem;font-weight:700;">ไม่ผ่าน</span>`;
    return `<tr data-club-sid="${m.studentId}" data-classroom="${m.classroom}">
      <td style="text-align:center;color:#6b7280;font-size:.78rem;">${idx+1}</td>
      <td style="font-weight:600;font-size:.84rem;min-width:130px;">${m.name}</td>
      <td style="font-size:.76rem;color:#6b7280;">${m.classroom}</td>
      ${topicCells}
      <td style="text-align:center;"><input type="number" min="0" max="${topicCount}" value="${attended}"
        style="width:44px;text-align:center;border:1px solid #fde68a;border-radius:6px;padding:3px;font-size:.82rem;"
        onchange="updateClubAttCount('${m.studentId}',this.value,'${t}')"></td>
      <td style="text-align:center;">${badge}</td>
    </tr>`;
  }).join('');

  // add topic
  const addTopicRow = `
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
      <input type="text" id="clubTopicInp_${t}" class="cfg-n" style="flex:1;text-align:left;"
        placeholder="เพิ่มหัวข้อ/ครั้งที่...">
      <button class="btn-sm" onclick="addClubTopic('${t}')" style="white-space:nowrap;">+ เพิ่มหัวข้อ</button>
      ${topicCount > 0 ? `<button class="btn-sm" style="color:#ef4444;border-color:#fecaca;" onclick="removeLastClubTopic('${t}')">ลบล่าสุด</button>` : ''}
    </div>`;

  wrap.innerHTML = `
    <div style="overflow-x:auto;border:1px solid #fde68a;border-radius:8px;margin-bottom:8px;">
      <table style="width:100%;border-collapse:collapse;font-size:.82rem;min-width:400px;">
        <thead>
          <tr style="background:#fef3c7;">
            <th style="padding:6px;width:32px;text-align:center;font-size:.76rem;">ที่</th>
            <th style="padding:6px;text-align:left;font-size:.76rem;">ชื่อ-นามสกุล</th>
            <th style="padding:6px;text-align:left;font-size:.76rem;">ชั้น</th>
            ${topicHeaders}
            <th style="padding:6px;width:50px;text-align:center;font-size:.76rem;">เข้าร่วม</th>
            <th style="padding:6px;width:70px;text-align:center;font-size:.76rem;">ผล</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${addTopicRow}
  `;
}

function updateClubAtt(sid, topicIdx, checked, t) {
  if (!Club.attendanceMap[sid]) Club.attendanceMap[sid] = { attArray: [], attended: 0, result: 'ไม่ผ่าน' };
  const d = Club.attendanceMap[sid];
  while (d.attArray.length <= topicIdx) d.attArray.push('');
  d.attArray[topicIdx] = checked ? 'เข้า' : '';
  const count = d.attArray.filter(v => v === 'เข้า').length;
  d.attended = count;
  d.result = Club.topics.length > 0 && count / Club.topics.length >= 0.8 ? 'ผ่าน' : 'ไม่ผ่าน';
  renderClubAttTable(t);
}

function updateClubAttCount(sid, val, t) {
  if (!Club.attendanceMap[sid]) Club.attendanceMap[sid] = { attArray: [], attended: 0, result: 'ไม่ผ่าน' };
  const count = Number(val) || 0;
  Club.attendanceMap[sid].attended = count;
  Club.attendanceMap[sid].result = Club.topics.length > 0 && count / Club.topics.length >= 0.8 ? 'ผ่าน' : 'ไม่ผ่าน';
  renderClubAttTable(t);
}

function addClubTopic(t) {
  const inp = $(`clubTopicInp_${t}`);
  const val = inp?.value?.trim();
  if (!val) return Utils.toast('กรอกชื่อหัวข้อก่อน', 'error');
  Club.topics.push(val);
  if (inp) inp.value = '';
  renderClubAttTable(t);
}

function removeLastClubTopic(t) {
  Club.topics.pop();
  renderClubAttTable(t);
}

// ── Save ──
async function saveClubData(t) {
  if (!Club.clubName.trim()) return Utils.toast('กรอกชื่อชุมนุมก่อน', 'error');
  if (!Club.members.length) return Utils.toast('ยังไม่มีสมาชิก', 'error');

  const year = $('gYear').value;
  const records = Club.members.map(m => {
    const d = Club.attendanceMap[m.studentId] || {};
    return {
      studentId: m.studentId,
      classroom: m.classroom,
      clubName: Club.clubName,
      attended: d.attended || 0,
      result: d.result || 'ไม่ผ่าน',
      attArray: d.attArray || []
    };
  });

  Utils.showLoading('บันทึกชุมนุม...');
  try {
    const res = await api('saveClub', {
      year,
      term: t,
      clubName: Club.clubName,
      teacher: Club.teacher,
      dayOfWeek: Club.dayOfWeek,
      topics: Club.topics,
      records
    });
    Utils.toast('✅ ' + res);
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// ── มุมมองครูประจำชั้น: ดูชุมนุมรายชั้น ──
async function loadHomeroomClubView() {
  const year  = $('gYear').value;
  const cls   = $('gClass').value;
  const term  = $('homeroomClubTerm')?.value || '1';
  const wrap  = $('homeroomClubTable');
  if (!wrap) return;
  if (!cls) { wrap.innerHTML = `<div style="color:#9ca3af;font-size:13px;">กรุณาเลือกชั้นเรียนก่อน</div>`; return; }

  Utils.showLoading('โหลดข้อมูลชุมนุม...');
  try {
    const res = await api('getClubsByClassroom', { year, classroom: cls, term });
    renderHomeroomClubTable(res, wrap, cls);
  } catch(e) { Utils.toast(e.message, 'error'); wrap.innerHTML = `<div style="color:#ef4444;font-size:13px;">${e.message}</div>`; }
  Utils.hideLoading();
}

function renderHomeroomClubTable(data, wrap, cls) {
  const students = data.students || [];
  if (!students.length) {
    wrap.innerHTML = `<div style="font-size:13px;color:#9ca3af;padding:8px 0;">ไม่พบข้อมูลชุมนุม</div>`;
    return;
  }

  const rows = students.map((s, idx) => {
    const badge = s.clubName
      ? `<span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:2px 10px;border-radius:20px;font-size:.78rem;font-weight:700;">${s.clubName}</span>`
      : `<span style="color:#9ca3af;font-size:.78rem;">ยังไม่มีชุมนุม</span>`;
    const result = s.result
      ? (s.result === 'ผ่าน'
          ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ผ่าน</span>`
          : `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ไม่ผ่าน</span>`)
      : `<span style="color:#9ca3af;font-size:.76rem;">-</span>`;
    return `<tr>
      <td style="color:#6b7280;font-size:.78rem;text-align:center;">${idx+1}</td>
      <td style="font-weight:600;font-size:.84rem;">${s.name}</td>
      <td style="text-align:center;">${badge}</td>
      <td style="text-align:center;">${result}</td>
    </tr>`;
  }).join('');

  const hasNoClub = students.filter(s => !s.clubName).length;
  wrap.innerHTML = `
    ${hasNoClub > 0 ? `<div style="font-size:12px;color:#d97706;margin-bottom:8px;">⚠️ มี ${hasNoClub} คนยังไม่มีชุมนุม</div>` : ''}
    <div style="overflow-x:auto;border:1px solid #fde68a;border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;font-size:.84rem;">
        <thead>
          <tr style="background:#fef3c7;">
            <th style="padding:7px;width:32px;text-align:center;font-size:.76rem;">ที่</th>
            <th style="padding:7px;text-align:left;font-size:.76rem;">ชื่อ-นามสกุล</th>
            <th style="padding:7px;text-align:center;font-size:.76rem;">ชุมนุม</th>
            <th style="padding:7px;text-align:center;font-size:.76rem;">ผล</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function printClubReport(term) {
  const year = $('gYear').value;
  const cls  = $('gClass').value;
  if (!cls) return Utils.toast('กรุณาเลือกชั้นก่อน', 'error');
  Utils.showLoading('กำลังสร้างรายงาน...');
  try {
    const res = await api('getClubsByClassroom', { year, classroom: cls, term });
    const html = buildClubPrintHTML(res, cls, year, term);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

function buildClubPrintHTML(data, cls, year, term) {
  const students = data.students || [];
  const profile = App.schoolProfile || {};
  const rows = students.map((s, i) => `
    <tr>
      <td style="text-align:center;">${i+1}</td>
      <td>${s.name}</td>
      <td style="text-align:center;">${s.clubName || '-'}</td>
      <td style="text-align:center;">${s.result || '-'}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:Sarabun,sans-serif;padding:20px;}
    table{width:100%;border-collapse:collapse;}
    th,td{border:1px solid #ccc;padding:6px 10px;font-size:14px;}
    th{background:#fef3c7;}
    @media print{button{display:none;}}</style></head><body>
    <h3 style="text-align:center;">${profile.school_name || ''}</h3>
    <h4 style="text-align:center;">สรุปชุมนุม ชั้น ${cls} ปีการศึกษา ${year} ภาคเรียนที่ ${term}</h4>
    <table><thead><tr><th>ที่</th><th>ชื่อ-นามสกุล</th><th>ชุมนุม</th><th>ผล</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;cursor:pointer;">🖨️ พิมพ์</button>
    </body></html>`;
}
