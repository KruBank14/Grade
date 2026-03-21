// =====================================================
// club.js — ระบบชุมนุม (โหลดทุกชั้นพร้อมกัน)
// =====================================================

const Club = {
  term: '1',
  clubName: '',
  teacher: '',
  dayOfWeek: '5',
  members: [],          // { studentId, name, classroom }
  attendanceMap: {},    // studentId → { attArray, result, attended }
  topics: [],
  allClassStudents: {}, // { 'ป.1': [{studentId,name,inOtherClub,clubName},...], ... }
  loadErrors: {},       // { 'ป.1': 'error message', ... }
  activeClassTab: '',
  loaded: false
};

function renderClubPanel() {
  const wrap = $('clubContainer'); if (!wrap) return;
  if (!App.students || !App.students.length) {
    wrap.innerHTML = `<div class="text-center text-muted py-3" style="font-size:13px;">กรุณาโหลดรายชื่อผู้เรียนก่อน</div>`;
    return;
  }
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

async function loadAllClubStudents() {
  const year = $('gYear').value;
  const cls  = $('gClass').value;

  if (!year) { Utils.toast('กรุณาเลือกปีการศึกษาก่อน', 'error'); return; }

  // ใช้ App.students ที่โหลดมาแล้วจาก getGrades — ไม่ต้องยิง API ใหม่
  if (!App.students || !App.students.length) {
    Utils.toast('กรุณาโหลดตารางคะแนนก่อน เพื่อดึงรายชื่อนักเรียน', 'error');
    return;
  }

  const t = Club.term;
  Utils.showLoading('โหลดรายชื่อ...');
  try {
    // ดึง clubMap ของชั้นปัจจุบันจาก GAS เพื่อรู้ว่าใครอยู่ชุมนุมอื่นแล้ว
    let clubMap = {};
    try {
      const res = await api('getClubsByClassroom', { year, classroom: cls, term: t });
      (res.students || []).forEach(s => {
        if (s.clubName) clubMap[s.studentId] = s.clubName;
      });
    } catch(e) { /* ยังไม่มีชีทชุมนุม — ไม่ error */ }

    // จัดรายชื่อนักเรียนชั้นปัจจุบันเข้า allClassStudents
    Club.allClassStudents = {};
    Club.loadErrors = {};

    // ใส่นักเรียนชั้นที่โหลดอยู่ (App.students) พร้อมข้อมูล inOtherClub
    Club.allClassStudents[cls] = App.students.map(s => ({
      studentId:   s.studentId,
      name:        s.name,
      inOtherClub: !!(clubMap[s.studentId] && !Club.members.some(m => m.studentId === s.studentId)),
      clubName:    clubMap[s.studentId] || ''
    }));

    Club.activeClassTab = cls;
    Club.loaded = true;
    Utils.toast(`✅ โหลดรายชื่อสำเร็จ ${Club.allClassStudents[cls].length} คน`);
    _renderClubMain();
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

function switchClubClassTab(cls) {
  Club.activeClassTab = cls;
  _renderClubStudentPicker();
}

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
          <select class="cfg-n" style="width:100%;" onchange="Club.dayOfWeek=this.value">
            ${['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์'].map((d,i) =>
              `<option value="${i+1}" ${Club.dayOfWeek==i+1?'selected':''}>${d}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <hr style="border-color:#fde68a;margin:10px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:12px;font-weight:700;color:#92400e;">เพิ่มนักเรียนเข้าชุมนุม</div>
        <button class="btn-pri" style="padding:6px 16px;font-size:.82rem;background:linear-gradient(135deg,#d97706,#b45309);"
          onclick="loadAllClubStudents()">
          ${Club.loaded ? '🔄 รีโหลดรายชื่อ' : '📋 โหลดรายชื่อทุกชั้น'}
        </button>
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
                ${ms.map(m => `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
                  border-radius:20px;background:#fef3c7;border:1px solid #fde68a;font-size:12px;color:#92400e;margin:2px;">
                  ${m.name}
                  <button onclick="toggleClubMember('${m.studentId}','${m.name.replace(/'/g,"\\'")}','${m.classroom}')"
                    style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:0;line-height:1;">×</button>
                </span>`).join('')}
              </div>`).join('')
        }
      </div>
    </div>

    <div class="card mb-3" style="background:#fff;border:1px solid #fde68a;">
      <div style="font-size:.88rem;font-weight:700;color:#92400e;margin-bottom:10px;">📋 บันทึกการเข้าร่วม</div>
      <div id="clubAttContainer">
        <div style="font-size:13px;color:#9ca3af;padding:4px 0;">
          ${memberCount ? 'กดโหลดข้อมูลเพื่อแสดงตาราง' : 'ยังไม่มีสมาชิกชุมนุม'}
        </div>
      </div>
      ${memberCount ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:.78rem;color:#6b7280;">* เกณฑ์: เวลาเรียน ≥ 80% = "ผ่าน"</div>
          <button class="btn-pri" onclick="loadClubAttendance()" style="background:linear-gradient(135deg,#d97706,#b45309);">
            🔄 โหลดข้อมูลการเข้าร่วม
          </button>
        </div>
        <button class="btn-save mt-3 w-100" onclick="saveClubData()"
          style="background:linear-gradient(135deg,#d97706,#b45309);">
          💾 บันทึกชุมนุม ภาคเรียน ${t}
        </button>` : ''}
    </div>
  `;

  if (Club.loaded) _renderClubStudentPicker();
}

function _renderClubStudentPicker() {
  const wrap = $('clubStudentPicker'); if (!wrap) return;
  const activeCls = Club.activeClassTab;
  const students  = Club.allClassStudents[activeCls] || [];
  const errorMsg  = Club.loadErrors ? Club.loadErrors[activeCls] : null;

  let chipsHtml;
  if (errorMsg) {
    chipsHtml = `<div style="font-size:12px;color:#b91c1c;padding:8px;background:#fff1f2;border-radius:6px;border:1px solid #fecaca;">
      ⚠️ โหลดรายชื่อไม่สำเร็จ<br>
      <span style="color:#6b7280;font-size:11px;">${errorMsg}</span>
    </div>`;
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
        const check  = inMyClub ? '✓ ' : '';
        const tag    = inOther ? ` <span style="font-size:10px;color:#9ca3af;">(${s.clubName})</span>` : '';
        return `<div style="display:inline-flex;align-items:center;gap:3px;padding:4px 10px;
          border-radius:20px;border:1px solid ${border};background:${bg};font-size:12px;color:${color};
          cursor:${inOther?'not-allowed':'pointer'};user-select:none;${inOther?'opacity:.5;':''}"
          onclick="${inOther?'':` toggleClubMember('${s.studentId}','${s.name.replace(/'/g,"\'")}','${activeCls}')`}">
          ${check}${s.name}${tag}
        </div>`;
      }).join('') + `</div>`;
  }

  wrap.innerHTML = `<div style="max-height:200px;overflow-y:auto;">${chipsHtml}</div>`;
}

function toggleClubMember(sid, name, classroom) {
  const idx = Club.members.findIndex(m => m.studentId === sid);
  if (idx >= 0) Club.members.splice(idx, 1);
  else Club.members.push({ studentId: sid, name, classroom });
  _renderClubMain();
  if (Club.loaded) _renderClubStudentPicker();
}

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
    Club.attendanceMap = res.attendanceMap || {};
    if (res.topics && res.topics.length) Club.topics = res.topics;
    if (res.teacher) Club.teacher = res.teacher;
    if (res.dayOfWeek) Club.dayOfWeek = res.dayOfWeek;
    if (res.clubName) Club.clubName = res.clubName;
    _renderClubAttTable();
    _renderClubMain();
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

function _renderClubAttTable() {
  const wrap = $('clubAttContainer'); if (!wrap) return;
  const topics = Club.topics;
  const topicCount = topics.length;
  const topicHeaders = topics.map((tp, i) =>
    `<th style="font-size:.72rem;writing-mode:vertical-rl;transform:rotate(180deg);max-height:120px;white-space:nowrap;padding:6px 3px;background:#fef3c7;color:#92400e;">${i+1}. ${tp}</th>`
  ).join('');

  const rows = Club.members.map((m, idx) => {
    const d = Club.attendanceMap[m.studentId] || {};
    const attArray = Array.isArray(d.attArray) ? d.attArray : Array(topicCount).fill('');
    const attended = Number(d.attended) || attArray.filter(v => v === 'เข้า').length;
    const result = d.result || (topicCount > 0 && attended/topicCount >= 0.8 ? 'ผ่าน' : 'ไม่ผ่าน');
    const cells = Array(topicCount).fill(0).map((_, i) => {
      const checked = attArray[i] === 'เข้า';
      return `<td style="text-align:center;"><input type="checkbox" ${checked?'checked':''}
        style="width:16px;height:16px;cursor:pointer;accent-color:#d97706;"
        onchange="updateClubAtt('${m.studentId}',${i},this.checked)"></td>`;
    }).join('');
    const badge = result === 'ผ่าน'
      ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ผ่าน</span>`
      : `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ไม่ผ่าน</span>`;
    return `<tr><td style="text-align:center;color:#6b7280;font-size:.76rem;">${idx+1}</td>
      <td style="font-weight:600;font-size:.82rem;min-width:120px;">${m.name}</td>
      <td style="font-size:.74rem;color:#6b7280;">${m.classroom}</td>
      ${cells}
      <td style="text-align:center;"><input type="number" min="0" max="${topicCount}" value="${attended}"
        style="width:44px;text-align:center;border:1px solid #fde68a;border-radius:6px;padding:3px;font-size:.8rem;"
        onchange="updateClubAttCount('${m.studentId}',this.value)"></td>
      <td style="text-align:center;">${badge}</td></tr>`;
  }).join('');

  wrap.innerHTML = `
    <div style="overflow-x:auto;border:1px solid #fde68a;border-radius:8px;margin-bottom:8px;">
      <table style="width:100%;border-collapse:collapse;font-size:.82rem;min-width:400px;">
        <thead><tr style="background:#fef3c7;">
          <th style="padding:6px;width:28px;font-size:.74rem;">ที่</th>
          <th style="padding:6px;text-align:left;font-size:.74rem;">ชื่อ-นามสกุล</th>
          <th style="padding:6px;text-align:left;font-size:.74rem;">ชั้น</th>
          ${topicHeaders}
          <th style="padding:6px;width:50px;font-size:.74rem;text-align:center;">เข้าร่วม</th>
          <th style="padding:6px;width:70px;font-size:.74rem;text-align:center;">ผล</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:12px;">ยังไม่มีสมาชิก</td></tr>'}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
      <input type="text" id="clubTopicInp" class="cfg-n" style="flex:1;text-align:left;min-width:140px;" placeholder="เพิ่มหัวข้อ/ครั้งที่...">
      <button class="btn-sm" onclick="addClubTopic()" style="white-space:nowrap;">+ เพิ่มหัวข้อ</button>
      ${topicCount>0?`<button class="btn-sm" style="color:#ef4444;border-color:#fecaca;" onclick="removeLastClubTopic()">ลบล่าสุด</button>`:''}
    </div>`;
}

function updateClubAtt(sid, idx, checked) {
  if (!Club.attendanceMap[sid]) Club.attendanceMap[sid] = { attArray: [], attended: 0, result: 'ไม่ผ่าน' };
  const d = Club.attendanceMap[sid];
  while (d.attArray.length <= idx) d.attArray.push('');
  d.attArray[idx] = checked ? 'เข้า' : '';
  d.attended = d.attArray.filter(v => v === 'เข้า').length;
  d.result = Club.topics.length > 0 && d.attended/Club.topics.length >= 0.8 ? 'ผ่าน' : 'ไม่ผ่าน';
  _renderClubAttTable();
}

function updateClubAttCount(sid, val) {
  if (!Club.attendanceMap[sid]) Club.attendanceMap[sid] = { attArray: [], attended: 0, result: 'ไม่ผ่าน' };
  const count = Number(val) || 0;
  Club.attendanceMap[sid].attended = count;
  Club.attendanceMap[sid].result = Club.topics.length > 0 && count/Club.topics.length >= 0.8 ? 'ผ่าน' : 'ไม่ผ่าน';
  _renderClubAttTable();
}

function addClubTopic() {
  const inp = $('clubTopicInp');
  const val = inp?.value?.trim();
  if (!val) return Utils.toast('กรอกชื่อหัวข้อก่อน', 'error');
  Club.topics.push(val);
  if (inp) inp.value = '';
  _renderClubAttTable();
}

function removeLastClubTopic() {
  Club.topics.pop();
  _renderClubAttTable();
}

async function saveClubData() {
  if (!Club.clubName.trim()) return Utils.toast('กรอกชื่อชุมนุมก่อน', 'error');
  if (!Club.members.length) return Utils.toast('ยังไม่มีสมาชิก', 'error');
  const year = $('gYear').value;
  const records = Club.members.map(m => {
    const d = Club.attendanceMap[m.studentId] || {};
    return { studentId: m.studentId, classroom: m.classroom, attended: d.attended||0, result: d.result||'ไม่ผ่าน', attArray: d.attArray||[] };
  });
  Utils.showLoading('บันทึกชุมนุม...');
  try {
    const res = await api('saveClub', { year, term: Club.term, clubName: Club.clubName, teacher: Club.teacher, dayOfWeek: Club.dayOfWeek, topics: Club.topics, records });
    Utils.toast('✅ ' + res);
  } catch(e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

async function loadHomeroomClubView() {
  const year = $('gYear').value, cls = $('gClass').value;
  const term = $('homeroomClubTerm')?.value || '1';
  const wrap = $('homeroomClubTable'); if (!wrap) return;
  if (!cls) { wrap.innerHTML = `<div style="color:#9ca3af;font-size:13px;">กรุณาเลือกชั้นเรียนก่อน</div>`; return; }
  Utils.showLoading('โหลดข้อมูลชุมนุม...');
  try {
    const res = await api('getClubsByClassroom', { year, classroom: cls, term });
    const students = res.students || [];
    const noClub = students.filter(s => !s.clubName).length;
    const rows = students.map((s,i) => {
      const badge = s.clubName ? `<span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:2px 10px;border-radius:20px;font-size:.78rem;font-weight:700;">${s.clubName}</span>` : `<span style="color:#9ca3af;font-size:.78rem;">-</span>`;
      const result = s.result==='ผ่าน' ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ผ่าน</span>` : s.result==='ไม่ผ่าน' ? `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:.76rem;font-weight:700;">ไม่ผ่าน</span>` : `<span style="color:#9ca3af;font-size:.76rem;">-</span>`;
      return `<tr><td style="text-align:center;color:#6b7280;font-size:.76rem;">${i+1}</td><td style="font-weight:600;font-size:.82rem;">${s.name}</td><td style="text-align:center;">${badge}</td><td style="text-align:center;">${result}</td></tr>`;
    }).join('');
    wrap.innerHTML = `${noClub>0?`<div style="font-size:12px;color:#d97706;margin-bottom:8px;">⚠️ มี ${noClub} คนยังไม่มีชุมนุม</div>`:''}
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
  } catch(e) { Utils.toast(e.message,'error'); wrap.innerHTML=`<div style="color:#ef4444;font-size:13px;">${e.message}</div>`; }
  Utils.hideLoading();
}

async function printClubReport(term) {
  const year = $('gYear').value, cls = $('gClass').value;
  if (!cls) return Utils.toast('กรุณาเลือกชั้นก่อน', 'error');
  Utils.showLoading('สร้างรายงาน...');
  try {
    const res = await api('getClubsByClassroom', { year, classroom: cls, term });
    const profile = App.schoolProfile || {};
    const rows = (res.students||[]).map((s,i) => `<tr><td style="text-align:center;">${i+1}</td><td>${s.name}</td><td style="text-align:center;">${s.clubName||'-'}</td><td style="text-align:center;">${s.result||'-'}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Sarabun,sans-serif;padding:20px;}h3,h4{text-align:center;margin:4px 0;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ccc;padding:6px 10px;font-size:14px;}th{background:#fef3c7;}@media print{button{display:none;}}</style></head><body>
      <h3>${profile.school_name||''}</h3><h4>สรุปชุมนุม ชั้น ${cls} ปีการศึกษา ${year} ภาคเรียนที่ ${term}</h4>
      <table><thead><tr><th>ที่</th><th>ชื่อ-นามสกุล</th><th>ชุมนุม</th><th>ผล</th></tr></thead><tbody>${rows}</tbody></table>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;cursor:pointer;">🖨️ พิมพ์</button></body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
  } catch(e) { Utils.toast(e.message,'error'); }
  Utils.hideLoading();
}
