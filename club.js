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
  attMap: {},           // { studentId: ['ป','ข','ล',...] }  ← ข้อมูลที่บันทึกไว้
  realAttMap: {},       // { studentId: { 'dd/mm/yyyy': 'ม'|'ข'|'ล' } } ← จาก Attendance จริง
  resultMap: {},        // { studentId: 'ผ่าน'|'ไม่ผ่าน' }
  savedMembers: [],     // snapshot สมาชิกที่โหลดมาจาก GAS (ใช้เทียบตอน save)
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
// ── normalize attArray: แปลงค่าให้เป็น 'ป'/'ข'/'ล'/'-' ──
// รองรับทั้งค่าจาก Club ('ป','ข','ล') และ Attendance ('ม','ข','ล','ป')
// และค่าเก่า ('เข้า', 'ขาด' ฯลฯ)
function _normalizeAtt_(arr) {
  return (arr || []).map(v => {
    const s = String(v || '').trim();
    if (s === 'ม' || s === 'ป' || s === 'เข้า' || s === '1') return 'ป'; // มา
    if (s === 'ข' || s === 'ขาด' || s === '0')                 return 'ข'; // ขาด
    if (s === 'ล' || s === 'ลา'  || s === 'ป่วย')              return 'ล'; // ลา
    if (s === '-')                                              return '-'; // ไม่นับ
    return 'ป'; // default = มา
  });
}

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

async function refreshClubDates() {
  Club.dates = calcClubDates();
  // sync topics ให้ตรงกับจำนวนวัน
  if (Club.topics.length !== Club.dates.length) {
    const old = Club.topics.slice();
    Club.topics = Array(Club.dates.length).fill('').map((_, i) => old[i] || '');
  }
  // reset attMap ทั้งหมดเพื่อให้คำนวณใหม่จาก realAttMap ตามวันใหม่
  Club.attMap = {};
  // โหลด realAttMap ใหม่ (วันอาจเปลี่ยน ต้องดึง Attendance ใหม่)
  await loadClubRealAttendance();
  _renderClubActivity();
}

// ── โหลดข้อมูลการเช็คชื่อจริงจาก Attendance sheet (คละชั้น) ──
// เหมือน loadGuidanceAttendance แต่ต้องยิงทีละชั้น เพราะสมาชิกคละชั้น
async function loadClubRealAttendance() {
  if (!Club.members.length) return;
  const year = $('gYear').value;

  // จัดกลุ่ม members ตามชั้น
  const byClass = {};
  Club.members.forEach(m => {
    if (!byClass[m.classroom]) byClass[m.classroom] = [];
    byClass[m.classroom].push(m.studentId);
  });

  Club.realAttMap = {};
  try {
    await Promise.all(
      Object.entries(byClass).map(async ([cls, sids]) => {
        // ดึง classroomKey จากสมาชิกคนแรกของชั้นนั้น
        const firstMember = Club.members.find(m => m.classroom === cls);
        const classroomKey = firstMember?.classroomKey ||
          Object.keys(App.subs || {}).find(k => k === cls || k.startsWith(cls + ' ')) ||
          cls;
        try {
          const res = await api('getAttendanceDetail', { year, classroom: classroomKey });
          // res = { studentId: { 'dd/mm/yyyy': 'ม'|'ข'|'ล' } }
          sids.forEach(sid => {
            if (res[sid]) Club.realAttMap[sid] = res[sid];
          });
        } catch(e) {
          console.warn('loadClubRealAttendance error [' + cls + ']:', e.message);
        }
      })
    );
  } catch(e) { console.warn('loadClubRealAttendance:', e.message); }
}

function renderClubPanel() {
  const wrap = $('clubContainer'); if (!wrap) return;
  // ใส่ชื่อครูที่ปรึกษาอัตโนมัติจากชื่อที่ล็อกอิน (ถ้ายังไม่มี)
  if (!Club.teacher && App.user && App.user.name) {
    Club.teacher = App.user.name;
  }
  _renderClubMain();
}

function switchClubTab(term, btn) {
  Club.term = String(term);
  document.querySelectorAll('#clubTabs .ttab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  // reset ข้อมูลทั้งหมดของเทอมเดิม
  Club.allClassStudents = {};
  Club.loadErrors = {};
  Club.loaded = false;
  Club.members    = [];
  Club.topics     = [];
  Club.attMap        = {};
  Club.realAttMap    = {};
  Club.resultMap     = {};
  Club.dates         = [];
  Club.savedMembers  = [];
  Club.clubName   = '';
  Club.teacher    = (App.user && App.user.name) ? App.user.name : '';
  Club.dayOfWeek  = '5';
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
  const classes = CONFIG.ALL_CLS; // ไม่มี เทอม ใน ALL_CLS แล้ว

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
          // เก็บ classroomKey จริง (เช่น "ม.1 เทอม 1") ไว้ใน _classroomKey สำหรับส่ง GAS ตอน save
          return { cls, students: (res.students || []).map(s => ({ studentId: s.studentId, name: s.name, inOtherClub: false, clubName: '', _classroomKey: classroomKey })), error: null };
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

    // ── ดึงข้อมูลว่าใครอยู่ชุมนุมอะไรแล้ว ──
    // ยิง getClubsByClassroom ทุกชั้นพร้อมกัน แล้ว mark inOtherClub + clubName
    Utils.showLoading('ตรวจสอบข้อมูลชุมนุม...');
    try {
      const clubResults = await Promise.all(
        classes.map(cls => {
          const subsKey = Object.keys(App.subs || {}).find(k => k === cls || k.startsWith(cls + ' '));
          const classroomKey = subsKey || cls;
          return api('getClubsByClassroom', { year, classroom: classroomKey, term: t })
            .then(res => ({ cls, students: res.students || [] }))
            .catch(() => ({ cls, students: [] }));
        })
      );
      // สร้าง map { studentId: clubName }
      const clubMap = {};
      clubResults.forEach(({ students }) => {
        students.forEach(s => {
          if (s.clubName) clubMap[s.studentId] = s.clubName;
        });
      });
      // mark inOtherClub และ clubName ในทุกชั้น
      classes.forEach(cls => {
        (Club.allClassStudents[cls] || []).forEach(s => {
          if (clubMap[s.studentId]) {
            s.inOtherClub = true;
            s.clubName    = clubMap[s.studentId];
          }
        });
      });
    } catch(e) { /* ถ้าดึงไม่ได้ — ข้ามไป */ }

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
  const classes = CONFIG.ALL_CLS; // ไม่มี เทอม ใน ALL_CLS แล้ว

  // ป้องกันกดซ้อน
  if (document.getElementById('btnLoadSaved')) document.getElementById('btnLoadSaved').disabled = true;
  Utils.showLoading('โหลดข้อมูลชุมนุม...');
  try {
    const savedResults = await Promise.all(
      classes.map(cls => {
        // หา classroomKey จริง (มัธยม "ม.1" → "ม.1 เทอม 1")
        const subsKey = Object.keys(App.subs || {}).find(k => k === cls || k.startsWith(cls + ' '));
        const classroomKey = subsKey || cls;
        return api('getClubsByClassroom', { year, classroom: classroomKey, term: t })
          .then(res => ({ cls, classroomKey, students: res.students || [] }))
          .catch(() => ({ cls, classroomKey, students: [] }));
      })
    );

    // จัดกลุ่มตามชื่อชุมนุม (อาจมีหลายชุมนุมในโรงเรียน)
    const clubGroups = {}; // { clubName: [ {studentId, name, classroom, result} ] }

    // clubTeachers = { clubName: teacher } ดึงจาก attRes ต่อไป
    // ตอนนี้เก็บแค่รายชื่อก่อน แล้วดึง teacher จาก getClubAttendanceDetail ทีหลัง
    savedResults.forEach(({ cls, classroomKey, students }) => {
      students.forEach(s => {
        if (s.clubName) {
          if (!clubGroups[s.clubName]) clubGroups[s.clubName] = [];
          clubGroups[s.clubName].push({
            studentId:    s.studentId,
            name:         s.name,
            classroom:    cls,
            classroomKey: classroomKey || cls,
            result:       s.result || ''
          });
        }
      });
    });

    const clubNames = Object.keys(clubGroups);

    if (clubNames.length === 0) {
      Utils.toast('ยังไม่มีข้อมูลชุมนุมที่บันทึกไว้');
      _renderClubMain();
      Utils.hideLoading();
      return;
    }

    // เลือกชุมนุมที่จะโหลด
    // ถ้ามีชุมนุมเดิมอยู่แล้ว (Club.clubName) ให้โหลดอันนั้น
    // ถ้าไม่มี ให้เลือกชุมนุมที่มีสมาชิกมากที่สุด
    // กรองชุมนุมของครูที่ล็อกอินอยู่
    // ขั้นตอน: ดึง teacher จากแต่ละชุมนุม แล้วเลือกอันที่ตรงกับ App.user.name
    const myName = (App.user && App.user.name) ? App.user.name.trim() : '';

    // ถ้าครูบันทึกชุมนุมไว้แล้ว จะมี teacher field ใน attRes
    // ── เลือกชุมนุมที่ตรงกับครูที่ล็อกอิน ──
    // ดึง teacher ของแต่ละชุมนุมจาก attArray ที่โหลดมาแล้ว
    // (teacher ถูกเก็บใน row ของนักเรียนแต่ละคน ดึงจากสมาชิกคนแรก)
    const clubTeacherMap = {}; // { clubName: teacher }
    await Promise.all(
      clubNames.map(async cName => {
        // ยิง getClubAttendanceDetail เพื่อดึง teacher ของชุมนุมนั้น
        const members = clubGroups[cName].slice(0, 1); // ดึงแค่คนแรก
        if (!members.length) return;
        try {
          const attRes = await api('getClubAttendanceDetail', {
            year,
            members: members.map(m => ({ studentId: m.studentId, classroom: m.classroomKey || m.classroom })),
            term: t
          });
          clubTeacherMap[cName] = attRes.teacher || '';
        } catch(e) { clubTeacherMap[cName] = ''; }
      })
    );

    // เลือกชุมนุมที่จะโหลด — เรียงลำดับความสำคัญ:
    // 1. ชุมนุมที่ครูล็อกอินเป็นที่ปรึกษา
    // 2. ชุมนุมที่ระบุไว้แล้ว (Club.clubName)
    // 3. ชุมนุมที่มีสมาชิกมากที่สุด
    let targetClub = '';
    if (myName) {
      // normalize ช่องว่างหลายตัวเป็นตัวเดียว ก่อนเปรียบเทียบ
      const normName = myName.replace(/\s+/g, ' ').trim();
      targetClub = clubNames.find(cName => {
        const teacher = (clubTeacherMap[cName] || '').replace(/\s+/g, ' ').trim();
        if (!teacher) return false;
        // เปรียบเทียบแบบ fuzzy — ตัดชื่อแรก/นามสกุลออกมาเทียบ
        const normTeacher = teacher.replace(/\s+/g, ' ').trim();
        return normTeacher === normName ||
               normTeacher.includes(normName) ||
               normName.includes(normTeacher);
      }) || '';
    }
    if (!targetClub && Club.clubName && clubGroups[Club.clubName]) {
      targetClub = Club.clubName;
    }
    // ถ้าหาชุมนุมของครูคนนี้ไม่เจอเลย → ไม่โหลด
    if (!targetClub) {
      Utils.toast('ไม่พบชุมนุมที่คุณเป็นที่ปรึกษา');
      _renderClubMain();
      Utils.hideLoading();
      if (document.getElementById('btnLoadSaved')) document.getElementById('btnLoadSaved').disabled = false;
      return;
    }

    const savedMembers    = clubGroups[targetClub].map(s => ({ studentId: s.studentId, name: s.name, classroom: s.classroom, classroomKey: s.classroomKey || s.classroom }));
    const savedResultMap  = {};
    clubGroups[targetClub].forEach(s => { if (s.result) savedResultMap[s.studentId] = s.result; });
    const savedClubName   = targetClub;
    const savedTeacher    = clubTeacherMap[targetClub] || '';

    if (savedMembers.length === 0) {
      Utils.toast('ยังไม่มีข้อมูลชุมนุมที่บันทึกไว้');
      _renderClubMain();
      Utils.hideLoading();
      return;
    }

    Club.members       = savedMembers;
    Club.savedMembers  = savedMembers.map(m => ({ ...m })); // snapshot
    Club.resultMap     = savedResultMap;
    if (savedClubName) Club.clubName = savedClubName;
    if (savedTeacher && !Club.teacher) Club.teacher = savedTeacher;

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
          Club.attMap[m.studentId]    = _normalizeAtt_(d.attArray);
          Club.resultMap[m.studentId] = d.result   || 'ไม่ผ่าน';
        }
      });
    } catch(e) { /* ยังไม่มีกิจกรรม — ไม่ error */ }

    // โหลดข้อมูลการเช็คชื่อจริง
    await loadClubRealAttendance();

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
// แบ่งเป็น 2 sub-tab: "ข้อมูลชุมนุม" และ "จัดการสมาชิก"
function _renderClubMain() {
  const wrap = $('clubContainer'); if (!wrap) return;
  const t = Club.term;
  const memberCount = Club.members.length;
  const activeTab = Club._subTab || 'info'; // 'info' | 'members'

  // ── sub-tab bar ──
  const tabBar = `
    <div style="display:flex;gap:0;margin-bottom:0;border-bottom:2px solid #fde68a;">
      <button onclick="Club._subTab='info';_renderClubMain()"
        style="padding:8px 20px;font-size:.85rem;font-weight:700;cursor:pointer;border:none;
               background:${activeTab==='info'?'#fef3c7':'#fff'};
               color:${activeTab==='info'?'#92400e':'#9ca3af'};
               border-bottom:${activeTab==='info'?'3px solid #d97706':'3px solid transparent'};
               margin-bottom:-2px;">
        🎯 ข้อมูลชุมนุม
      </button>
      <button onclick="Club._subTab='members';_renderClubMain()"
        style="padding:8px 20px;font-size:.85rem;font-weight:700;cursor:pointer;border:none;
               background:${activeTab==='members'?'#fef3c7':'#fff'};
               color:${activeTab==='members'?'#92400e':'#9ca3af'};
               border-bottom:${activeTab==='members'?'3px solid #d97706':'3px solid transparent'};
               margin-bottom:-2px;">
        👥 จัดการสมาชิก
        ${memberCount > 0 ? `<span style="background:#d97706;color:#fff;border-radius:10px;padding:0 6px;font-size:11px;margin-left:4px;">${memberCount}</span>` : ''}
      </button>
    </div>`;

  // ── tab: ข้อมูลชุมนุม ──
  const tabInfo = `
    <div style="padding:14px 0;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div style="flex:1;min-width:200px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">ชื่อชุมนุม</label>
          <input type="text" class="cfg-n" style="width:100%;text-align:left;"
            placeholder="เช่น ชุมนุมคอมพิวเตอร์" value="${Club.clubName}"
            oninput="Club.clubName=this.value">
        </div>
        <div style="flex:0;min-width:160px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">ครูที่ปรึกษา</label>
          <input type="text" class="cfg-n" style="width:100%;text-align:left;"
            placeholder="ชื่อครู" value="${Club.teacher}"
            oninput="Club.teacher=this.value">
        </div>
        <div style="flex:0;min-width:110px;">
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">วันเรียน</label>
          <select class="cfg-n" style="width:100%;" onchange="Club.dayOfWeek=this.value;refreshClubDates()">
            ${['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์'].map((d,i) =>
              `<option value="${i+1}" ${Club.dayOfWeek==i+1?'selected':''}>${d}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <id id="btnLoadSaved" class="btn-pri" style="padding:6px 14px;font-size:.82rem;background:#6b7280;cursor:pointer;border:none;border-radius:6px;color:#fff;"
          onclick="loadSavedClub()">
          📂 โหลดชุมนุมที่บันทึกไว้
        </id>
        <span style="font-size:12px;color:#9ca3af;">
          ${memberCount > 0 ? `สมาชิก <b style="color:#92400e;">${memberCount} คน</b>` : 'ยังไม่มีสมาชิก'}
        </span>
      </div>

      ${memberCount > 0 ? `
      <div id="clubActivitySection"></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button class="btn-save" style="flex:1;background:linear-gradient(135deg,#d97706,#b45309);"
          onclick="saveClubData()">
          💾 บันทึกชุมนุม ภาคเรียน ${t}
        </button>
        <button class="btn-pri" style="padding:8px 18px;background:linear-gradient(135deg,#0369a1,#0284c7);"
          onclick="printClubReport()">
          🖨️ พิมพ์รายงาน
        </button>
      </div>` : `
      <div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
        ยังไม่มีสมาชิก — ไปที่แท็บ 👥 จัดการสมาชิก เพื่อเพิ่มนักเรียน
      </div>`}
    </div>`;

  // ── tab: จัดการสมาชิก ──
  const byClass = {};
  Club.members.forEach(m => {
    if (!byClass[m.classroom]) byClass[m.classroom] = [];
    byClass[m.classroom].push(m);
  });

  const tabMembers = `
    <div style="padding:14px 0;">
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn-pri" style="padding:6px 14px;font-size:.82rem;background:linear-gradient(135deg,#d97706,#b45309);"
          onclick="loadAllClubStudents()">
          ${Club.loaded ? '🔄 รีโหลดรายชื่อ' : '📋 โหลดรายชื่อทุกชั้น'}
        </button>
      </div>

      <div id="clubStudentPicker">
        ${!Club.loaded ? `<div style="font-size:13px;color:#9ca3af;padding:6px 0;">กดโหลดรายชื่อเพื่อเลือกนักเรียน</div>` : ''}
      </div>

      ${memberCount > 0 ? `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #fde68a;">
        <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;">
          สมาชิกปัจจุบัน <span style="font-weight:400;color:#6b7280;">(${memberCount} คน)</span>
        </div>
        <div>
          ${Object.entries(byClass).map(([cls, ms]) =>
            `<div style="margin-bottom:8px;">
              <span style="font-size:11px;font-weight:700;color:#92400e;background:#fef3c7;
                           padding:2px 8px;border-radius:20px;margin-right:6px;">${cls}</span>
              ${ms.map(m =>
                `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
                  border-radius:20px;background:#fff;border:1px solid #fde68a;font-size:12px;color:#92400e;margin:2px 2px 4px;">
                  ${m.name}
                  <button onclick="toggleClubMember('${m.studentId}','${m.name.replace(/'/g,"\'")}','${m.classroom}')"
                    style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0;line-height:1;font-weight:bold;">×</button>
                </span>`
              ).join('')}
            </div>`
          ).join('')}
        </div>
      </div>` : ''}
    </div>`;

  wrap.innerHTML = `
    <div class="card mb-3" style="background:#fff;border:1px solid #fde68a;padding:0;">
      <div style="padding:12px 16px 0;">
        <div style="font-weight:800;font-size:.9rem;color:#92400e;margin-bottom:10px;">
          🎯 ชุมนุม${Club.clubName ? ' — ' + Club.clubName : ''} ภาคเรียนที่ ${t}
        </div>
        ${tabBar}
      </div>
      <div style="padding:0 16px 14px;">
        ${activeTab === 'info' ? tabInfo : tabMembers}
      </div>
    </div>
  `;

  if (activeTab === 'info' && memberCount > 0) {
    if (Club.dates.length === 0) Club.dates = calcClubDates();
    _renderClubActivity();
  }
  if (activeTab === 'members' && Club.loaded) {
    _renderClubStudentPicker();
  }
}
// ── tab เลือกนักเรียน ────────────────────────────────
function _renderClubStudentPicker() {
  const wrap = $('clubStudentPicker'); if (!wrap) return;
  const classes   = CONFIG.ALL_CLS;
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
        // อยู่ชุมนุมอื่น = มีชุมนุมแล้ว และไม่ใช่ชุมนุมนี้ และไม่ได้เลือกอยู่ในชุมนุมนี้
        const inOther  = s.inOtherClub && !inMyClub && s.clubName !== Club.clubName;
        const bg     = inMyClub ? '#d1fae5' : inOther ? '#f3f4f6' : '#fff';
        const border = inMyClub ? '#6ee7b7' : inOther ? '#e5e7eb' : '#d1d5db';
        const color  = inMyClub ? '#065f46' : inOther ? '#9ca3af' : '#374151';
        const click  = inOther ? '' : `toggleClubMember('${s.studentId}','${s.name.replace(/'/g,"\'")}','${activeCls}')`;
        // badge แสดงชื่อชุมนุม
        const badge  = inOther
          ? `<span style="font-size:10px;background:#e5e7eb;color:#6b7280;padding:1px 5px;border-radius:8px;margin-left:3px;white-space:nowrap;">${s.clubName}</span>`
          : inMyClub && Club.clubName
            ? `<span style="font-size:10px;background:#bbf7d0;color:#166534;padding:1px 5px;border-radius:8px;margin-left:3px;white-space:nowrap;">${Club.clubName}</span>`
            : '';
        return `<div onclick="${click}"
          title="${inOther ? 'อยู่ชุมนุม ' + s.clubName + ' แล้ว' : ''}"
          style="display:inline-flex;align-items:center;gap:2px;padding:4px 10px;
            border-radius:20px;border:1px solid ${border};background:${bg};font-size:12px;color:${color};
            cursor:${inOther?'not-allowed':'pointer'};user-select:none;${inOther?'opacity:.55;':''}">
          ${inMyClub?'✓ ':''}${s.name}${badge}
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
    // หา classroomKey จริงจาก allClassStudents
    const stuInfo = (Club.allClassStudents[classroom] || []).find(s => s.studentId === sid);
    const classroomKey = stuInfo?._classroomKey || classroom;
    Club.members.push({ studentId: sid, name, classroom, classroomKey });
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
    // ลำดับความสำคัญเหมือนแนะแนว:
    // 1. attMap ที่บันทึกไว้แล้ว (เคยกด save) → ใช้ค่านั้น
    // 2. realAttMap จาก Attendance sheet จริง → pre-fill อัตโนมัติ
    let att;
    const saved = Club.attMap[m.studentId];
    const hasSaved = saved && saved.length > 0 && saved.some(v => v === 'ข' || v === 'ล');
    // ถือว่า "มีข้อมูลบันทึกจริง" ก็ต่อเมื่อมี ข หรือ ล อย่างน้อย 1 ครั้ง
    // (ถ้าเป็น ป ทั้งหมด แปลว่ายังไม่ได้บันทึกจริง → ให้ดึงจาก Attendance)
    if (hasSaved) {
      att = _normalizeAtt_(saved);
      while (att.length < nDates) att.push('ป');
      att = att.slice(0, nDates);
    } else {
      // ดึงจาก Attendance จริง
      const realAtt = Club.realAttMap[m.studentId] || {};
      att = dates.map(dateStr => {
        const r = String(realAtt[dateStr] || '').trim();
        if (r === 'ข')                return 'ข'; // ขาด
        if (r === 'ล' || r === 'ป')   return 'ล'; // ลา/ป่วย
        if (r === 'ม' || r === '')    return 'ป'; // มา / ไม่มีข้อมูล = มา
        return 'ป';
      });
    }
    Club.attMap[m.studentId] = att;

    const nP    = att.filter(v => v === 'ป').length;
    const nBase = att.filter(v => v !== '-').length;
    const result = nBase > 0
      ? (nP >= Math.ceil(nBase * 0.8) ? 'ผ่าน' : 'ไม่ผ่าน')
      : (Club.resultMap[m.studentId] || 'ไม่ผ่าน');
    Club.resultMap[m.studentId] = result;

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
    classroom: m.classroomKey || m.classroom, // ใช้ key จริง เช่น "ม.1 เทอม 1"
    attended:  (Club.attMap[m.studentId] || []).filter(v => v === 'ป').length,
    result:    Club.resultMap[m.studentId] || 'ไม่ผ่าน',
    attArray:  Club.attMap[m.studentId]    || []
  }));

  // หาสมาชิกที่ถูกลบออก = อยู่ใน savedMembers แต่ไม่อยู่ใน members ปัจจุบัน
  const currentIds = new Set(Club.members.map(m => m.studentId));
  Club.savedMembers.forEach(m => {
    if (!currentIds.has(m.studentId)) {
      records.push({
        studentId: m.studentId,
        classroom: m.classroom,
        attended:  0,
        result:    '',
        attArray:  [],
        _remove:   true
      });
    }
  });

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
        Club.attMap[m.studentId]    = _normalizeAtt_(d.attArray);
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

function printClubReport() {
  const year    = $('gYear').value;
  const profile = App.schoolProfile || {};
  const schoolName   = profile.school_name   || 'โรงเรียน';
  const directorName = profile.director_name || '..............................';
  const actHeadName  = profile.academic_head_name || '..............................';
  const t       = Club.term;
  const MONTHS  = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  if (!Club.members.length) return Utils.toast('ยังไม่มีสมาชิกชุมนุม', 'error');
  if (!Club.dates.length)   return Utils.toast('ยังไม่พบวันกิจกรรม', 'error');

  // sync ข้อมูลจากหน้าจอก่อน print
  document.querySelectorAll('#clubAttBody tr[data-sid]').forEach(tr => {
    const sid = tr.getAttribute('data-sid');
    const att = [...tr.querySelectorAll('.club-day-cell')].map(c => c.getAttribute('data-flag') || 'ป');
    const res = tr.querySelector('.club-result')?.value || 'ไม่ผ่าน';
    Club.attMap[sid]    = att;
    Club.resultMap[sid] = res;
  });
  const topics_   = [...(document.querySelectorAll('.club-topic') || [])].map(i => i.value);
  const teachers_ = [...(document.querySelectorAll('.club-teacher-inp') || [])].map(i => i.value);

  const termDates = Club.dates;
  const nDates    = termDates.length;
  const teacher   = Club.teacher || '..............................';

  function fmtD(dStr) {
    const p = dStr.split('/');
    if (p.length !== 3) return dStr;
    return parseInt(p[0]) + ' ' + MONTHS[parseInt(p[1])] + ' ' + p[2].slice(-2);
  }

  const rows = Club.members.map((m, i) => {
    const att     = Club.attMap[m.studentId] || Array(nDates).fill('ป');
    const nP      = att.filter(v => v === 'ป').length;
    const nBase   = att.filter(v => v !== '-').length;
    const result  = Club.resultMap[m.studentId] ||
      (nBase > 0 && nP >= Math.ceil(nBase * 0.8) ? 'ผ่าน' : 'ไม่ผ่าน');
    return { no: i+1, name: m.name, classroom: m.classroom, att, attended: nP, nBase, result };
  });

  const passCount = rows.filter(r => r.result === 'ผ่าน').length;
  const failCount = rows.length - passCount;

  // ── ปก ──
  const pageCover = `<div class="page cover-page">
    <div style="text-align:center;margin-top:10mm;margin-bottom:6mm;">
      <img src="https://raw.githubusercontent.com/Bk14School/easygrade/refs/heads/main/logo-OBEC.png" style="width:90px;height:auto;">
    </div>
    <div style="text-align:center;font-size:22px;font-weight:bold;letter-spacing:1px;margin-bottom:4mm;">แบบบันทึกผลกิจกรรมชุมนุม</div>
    <div style="text-align:center;font-size:17px;font-weight:bold;margin-bottom:8mm;">
      ชุมนุม ${Club.clubName} &nbsp;|&nbsp; ภาคเรียนที่ ${t} &nbsp;|&nbsp; ปีการศึกษา ${year}
    </div>
    <div class="cover-info-box">
      <div class="cover-row"><span class="cover-label">โรงเรียน</span><span class="cover-val">${schoolName}</span></div>
      <div class="cover-row"><span class="cover-label">ชื่อชุมนุม</span><span class="cover-val cover-ul">${Club.clubName}</span></div>
      <div class="cover-row"><span class="cover-label">ครูที่ปรึกษา</span><span class="cover-val cover-ul">${teacher}</span></div>
      <div class="cover-row"><span class="cover-label">จำนวนสมาชิก</span><span class="cover-val">${rows.length} คน</span></div>
    </div>
    <table class="cover-stat">
      <tr><th>จำนวนสมาชิกทั้งหมด</th><th>ผ่าน</th><th>ไม่ผ่าน</th><th>หมายเหตุ</th></tr>
      <tr><td>${rows.length}</td><td>${passCount}</td><td>${failCount}</td><td></td></tr>
    </table>
    <div class="appr">
      <div style="font-size:16px;font-weight:bold;text-align:center;margin-bottom:10px;">การอนุมัติผลการเรียน</div>
      <div class="sf">
        <div style="text-align:center;min-width:220px;">ลงชื่อ.......................................ครูที่ปรึกษา<br><div style="margin-top:8px;">( ${teacher} )</div></div>
      </div>
      <hr style="border:none;border-top:1px dashed #ccc;margin:10px 0;">
      <div class="sign-block">
        <div>ลงชื่อ.................................................................</div>
        <div class="sign-name">หัวหน้างานกิจกรรมพัฒนาผู้เรียน</div>
        <div class="sign-name">( ${actHeadName} )</div>
      </div>
      <hr style="border:none;border-top:1px dashed #ccc;margin:10px 0;">
      <div style="text-align:center;margin-top:8px;">
        <div style="font-weight:bold;font-size:15px;margin-bottom:8px;">เรียน เสนอเพื่อโปรดพิจารณาอนุมัติผลการเรียน</div>
        <div style="display:flex;justify-content:center;gap:70px;margin:8px 0;font-size:14px;">
          <span><span class="rc"></span> อนุมัติ</span><span><span class="rc"></span> ไม่อนุมัติ</span>
        </div>
      </div>
      <div class="sign-block">
        <div>ลงชื่อ.................................................................</div>
        <div class="sign-name">ผู้อำนวยการ${schoolName}</div>
        <div class="sign-name">( ${directorName} )</div>
      </div>
    </div>
  </div>`;

  // ── รายชื่อสมาชิก ──
  const pageRoster = `<div class="page">
    <div class="rh">ชุมนุม${Club.clubName} ภาคเรียนที่ ${t} ปีการศึกษา ${year}</div>
    <div style="margin-left:15%;font-size:14px;margin-bottom:6px;">จำนวนสมาชิก..........${rows.length}..........คน</div>
    <table><thead><tr>
      <th style="width:40px;font-weight:normal;">ที่</th>
      <th style="font-weight:normal;">ชื่อ – สกุล</th>
      <th style="width:80px;font-weight:normal;">ชั้น</th>
      <th style="width:35%;font-weight:normal;">หมายเหตุ</th>
    </tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.no}</td><td style="text-align:left;padding-left:15px;">${r.name}</td><td>${r.classroom}</td><td></td></tr>`).join('')}
      ${Array(Math.max(0, 20 - rows.length)).fill('<tr><td><br></td><td></td><td></td><td></td></tr>').join('')}
    </tbody></table>
    <div class="sf" style="margin-top:30px;">
      <div style="text-align:center;min-width:220px;">ลงชื่อ.......................................ครูที่ปรึกษา<br><div style="margin-top:10px;">( ${teacher} )</div></div>
    </div>
  </div>`;

  // ── บันทึกกิจกรรม ──
  const actRowCount = Math.max(nDates, 20);
  const actRowsHtml = Array(actRowCount).fill(0).map((_, i) =>
    `<tr>
      <td style="height:26px;">${i+1}</td>
      <td style="font-size:12px;">${termDates[i] ? fmtD(termDates[i]) : ''}</td>
      <td style="text-align:left;padding-left:8px;font-size:12px;">${topics_[i] || ''}</td>
      <td style="font-size:12px;">${teachers_[i] || teacher}</td>
    </tr>`
  ).join('');

  const pageActivity = `<div class="page">
    <div class="tc fw" style="font-size:16px;margin-bottom:6px;">บันทึกการจัดกิจกรรมชุมนุม${Club.clubName} ภาคเรียนที่ ${t}</div>
    <table><thead><tr>
      <th style="width:8%;font-weight:normal;">ครั้งที่</th>
      <th style="width:14%;font-weight:normal;">วัน/เดือน/ปี</th>
      <th style="font-weight:normal;">หัวข้อกิจกรรม</th>
      <th style="width:22%;font-weight:normal;">ครูที่ปรึกษา</th>
    </tr></thead>
    <tbody>${actRowsHtml}</tbody></table>
  </div>`;

  // ── ตารางเช็คชื่อ (landscape) ──
  const attDateHeaders = termDates.map(d => {
    const p = d.split('/');
    return `<th class="col-date"><div class="v-date">${parseInt(p[0])} ${MONTHS[parseInt(p[1])]} ${p[2].slice(-2)}</div></th>`;
  }).join('');

  const attRowsHtml = rows.map(r =>
    `<tr>
      <td>${r.no}</td>
      <td class="col-name" style="text-align:left;">${r.name} <span style="font-size:8px;color:#666;">${r.classroom}</span></td>
      ${r.att.slice(0, nDates).map(v => {
        const lb = v==='ป' ? '<span style="color:#166534;font-weight:bold;">/</span>'
                 : v==='ข' ? '<span style="color:#dc2626;font-weight:bold;">ข</span>'
                 : v==='ล' ? '<span style="color:#ca8a04;font-weight:bold;">ล</span>'
                 :           '<span style="color:#94a3b8;">-</span>';
        return `<td style="text-align:center;border:1px solid #000;">${lb}</td>`;
      }).join('')}
      <td style="text-align:center;font-weight:bold;">${r.attended}</td>
      <td style="text-align:center;font-weight:bold;color:#166534;">${r.result==='ผ่าน'?'✓':''}</td>
      <td style="text-align:center;font-weight:bold;color:#dc2626;">${r.result!=='ผ่าน'?'✓':''}</td>
    </tr>`
  ).join('');

  const pageAtt = `<div class="page att-page">
    <div class="tc fw" style="font-size:13px;margin-bottom:3px;">การเข้าร่วมกิจกรรมชุมนุม${Club.clubName} ภาคเรียนที่ ${t}</div>
    <div class="fw" style="margin-bottom:2px;font-size:12px;">ปีการศึกษา ${year} &nbsp; ครูที่ปรึกษา ${teacher}</div>
    <div style="font-size:11px;margin-bottom:5px;">/ = มาเรียนปกติ &nbsp; ข = ขาดเรียน &nbsp; ล = ลา &nbsp; เกณฑ์ผ่าน ≥ 80%</div>
    <table class="att-tbl"><thead><tr>
      <th rowspan="2" class="col-no">ที่</th>
      <th rowspan="2" class="col-name">ชื่อ – สกุล</th>
      <th colspan="${nDates}" style="border:1px solid #000;font-size:10px;">วัน/เดือน/ปี ครั้งที่เข้าร่วมกิจกรรม</th>
      <th rowspan="2" class="col-sum">รวม</th>
      <th rowspan="2" class="col-pass">ผ่าน</th>
      <th rowspan="2" class="col-pass">ไม่ผ่าน</th>
    </tr><tr>${attDateHeaders}</tr></thead>
    <tbody>${attRowsHtml}</tbody></table>
  </div>`;

  const css =
    '@page{size:A4 portrait;margin:12mm;}' +
    '@page att{size:A4 landscape;margin:6mm 7mm;}' +
    "body{font-family:'Sarabun',sans-serif;font-size:14px;color:#000;margin:0;line-height:1.4;}" +
    '.page{page-break-after:always;min-height:260mm;padding:8px 18px;}' +
    '.cover-page{padding:0 20mm;box-sizing:border-box;}' +
    '.cover-info-box{border:1.5px solid #555;border-radius:8px;padding:10px 16px;margin:0 auto 8mm;max-width:160mm;font-size:14px;line-height:2;}' +
    '.cover-row{display:flex;align-items:baseline;gap:8px;}' +
    '.cover-label{font-weight:bold;white-space:nowrap;min-width:80px;}' +
    '.cover-val{flex:1;border-bottom:1px solid #999;padding-bottom:1px;}' +
    '.cover-ul{border-bottom:1.5px solid #000 !important;}' +
    '.cover-stat{width:80%;margin:0 auto 8mm;border-collapse:collapse;font-size:14px;}' +
    '.cover-stat th,.cover-stat td{border:1px solid #000;padding:8px;text-align:center;}' +
    '.cover-stat th{background:#f3f4f6;font-weight:bold;}' +
    '.sign-block{text-align:center;margin:10px auto;font-size:14px;line-height:1.9;}' +
    '.sign-name{font-size:13px;color:#222;}' +
    '.att-page{page-break-after:always;page:att;padding:6px 10px;}' +
    '.tc{text-align:center;}.fw{font-weight:bold;}' +
    'table{width:100%;border-collapse:collapse;}' +
    'th,td{border:1px solid #000;padding:3px 2px;text-align:center;}' +
    '.appr{border:1.5px solid #000;border-radius:25px;padding:14px 18px;margin-top:12px;}' +
    '.rc{display:inline-block;width:13px;height:13px;border:1.5px solid #000;border-radius:50%;vertical-align:middle;margin-right:5px;}' +
    '.sf{display:flex;justify-content:space-around;flex-wrap:wrap;margin-top:14px;gap:8px;}' +
    '.rh{border:1px solid #000;border-radius:8px;padding:8px;width:65%;margin:0 auto 10px;text-align:center;font-size:15px;font-weight:bold;}' +
    '.att-tbl{font-size:9.5px;table-layout:fixed;width:100%;border-collapse:collapse;}' +
    '.att-tbl th,.att-tbl td{border:1px solid #000;padding:0;text-align:center;overflow:hidden;line-height:1.2;}' +
    '.att-tbl .col-no{width:18px;min-width:18px;}' +
    '.att-tbl .col-name{width:130px;min-width:130px;text-align:left !important;padding-left:3px;white-space:nowrap;overflow:hidden;}' +
    '.att-tbl .col-date{width:14px;min-width:14px;max-width:14px;}' +
    '.att-tbl .col-sum{width:20px;min-width:20px;font-weight:bold;}' +
    '.att-tbl .col-pass{width:20px;min-width:20px;}' +
    ".att-tbl .v-date{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5px;color:#c00;height:70px;white-space:nowrap;display:block;}";

  const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
    <title>รายงานชุมนุม_${Club.clubName}_${year}_เทอม${t}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>${css}</style></head><body>
    ${pageCover}${pageRoster}${pageActivity}${pageAtt}
    </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return Utils.toast('กรุณาอนุญาต Popup', 'error');
  win.document.open();
  win.document.write(html);
  win.document.close();
}
