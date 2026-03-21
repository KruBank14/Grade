// =====================================================
// MODULE: กิจกรรมลูกเสือ-เนตรนารี (Scout)
// clone จาก guidance.js
// =====================================================

// =====================================================
// MODULE: กิจกรรมลูกเสือ-เนตรนารี (Guidance)
// =====================================================

// ── State ──────────────────────────────────────────
// state แยกตาม term (key = '1' หรือ '2')
App.scoutDates    = [];
App.scoutTopics   = [];
App.scoutTeachers = [];
App.hrMap            = App.hrMap || {};
App.scoutAttMap   = {}; // { studentId: { "dd/mm/yyyy": "ม"|"ข"|"ล"|"ป" } }
App.scoutActiveTerm = '1'; // term ที่กำลังแสดงอยู่
App.scoutData = { '1': {}, '2': {} }; // { term: { studentId: savedData } }

// ── helpers ─────────────────────────────────────────
function calcScoutDates() {
  var termEl = document.getElementById('guide_term');
  var dayEl  = document.getElementById('guide_day');
  if (!termEl || !dayEl) return [];

  var term      = termEl.value;
  var dayOfWeek = parseInt(dayEl.value);
  var startD    = App.termDates['t' + term + '_start'];
  var endD      = App.termDates['t' + term + '_end'];
  if (!startD || !endD) return [];

  function parseD(str) {
    var p = String(str).split(/[\/\-]/);
    if (p.length !== 3) return new Date();
    var y = parseInt(p[2]) > 2500 ? parseInt(p[2]) - 543 : parseInt(p[2]);
    return new Date(y, parseInt(p[1]) - 1, parseInt(p[0]));
  }

  var hSet = new Set(
    (App.holidays || []).filter(function(h) { return h.type === 'holiday'; }).map(function(h) { return h.date; })
  );

  var dates = [];
  var cur = parseD(startD);
  var end = parseD(endD);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    if (cur.getDay() === dayOfWeek) {
      var dd  = String(cur.getDate()).padStart(2, '0');
      var mm  = String(cur.getMonth() + 1).padStart(2, '0');
      var yy  = cur.getFullYear() + 543;
      var key = dd + '/' + mm + '/' + yy;
      if (!hSet.has(key)) dates.push(key);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function shortThaiDateScout(dStr) {
  var p = dStr.split('/');
  if (p.length !== 3) return dStr;
  var m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return parseInt(p[0]) + ' ' + m[parseInt(p[1]) - 1] + String(p[2]).slice(-2);
}

// ── โหลด attendance รายวันจาก API ─────────────────
async function loadScoutAttendance() {
  try {
    var res = await api('getAttendanceDetail', {
      year      : $('gYear').value,
      classroom : $('gClass').value
    });
    App.scoutAttMap = res || {};
  } catch (e) {
    App.scoutAttMap = {};
    console.warn('getAttendanceDetail failed:', e.message);
  }
}

// ── สลับ tab เทอม ────────────────────────────────────────
function switchScoutTab(term, btn) {
  App.scoutActiveTerm = term;
  document.querySelectorAll('#scoutTabs .ttab').forEach(function(b) { b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var p1 = document.getElementById('scoutTerm1Panel');
  var p2 = document.getElementById('scoutTerm2Panel');
  if (p1) p1.style.display = term === '1' ? '' : 'none';
  if (p2) p2.style.display = term === '2' ? '' : 'none';

  // sync วันเรียนจาก DB เฉพาะครั้งแรกที่ยังไม่เคย sync (flag _dayLoaded)
  var gd = App.scoutData && App.scoutData[term];
  if (gd && gd._day && !gd._dayLoaded) {
    var sel = document.getElementById('scout_day_t' + term);
    if (sel) {
      sel.value = gd._day;
      gd._dayLoaded = true; // mark ว่า sync แล้ว ไม่ override อีก
    }
  }

  if (App.students && App.students.length) {
    _renderScoutForTerm(term);
  }
}

// ── แผงควบคุม (entry point จาก loadGrades) ─────────────
// เรียกครั้งแรกตอนโหลดข้อมูล → สร้างแผงควบคุมในแต่ละ term container
function renderScoutTable(isRecalculating) {
  isRecalculating = !!isRecalculating;

  // ถ้ายังไม่มี students ไม่ทำอะไร
  if (!App.students || !App.students.length) return;

  if (!isRecalculating) {
    // ลบแผงเก่าออก
    document.querySelectorAll('.scout-dynamic-panel').forEach(function(el) { el.remove(); });

    var cls = $('gClass').value.trim();
    if (App.hrMap[cls] === undefined) {
      App.hrMap[cls] = (App.user && App.user.classroom === cls) ? (App.user.name || '') : '';
    }

    // สร้างแผงควบคุมแยกในแต่ละ term container
    ['1', '2'].forEach(function(term) {
      var container = document.getElementById('scoutContainer' + term);
      if (!container) return;

      var hrName = App.hrMap[cls] || '';
      var panel  = document.createElement('div');
      panel.className = 'scout-dynamic-panel';
      panel.id        = 'scout_panel_t' + term;
      panel.innerHTML =
        '<div style="background:#fff;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<label style="font-weight:700;color:#166534;margin:0;white-space:nowrap;font-size:.85rem;">👨\u200d🏫 ครูประจำชั้น</label>' +
            '<input type="text" id="scout_teacher_t' + term + '" value="' + hrName + '"' +
            ' placeholder="ชื่อครู / ครู ก และ ครู ข"' +
            ' style="width:220px;padding:5px 10px;border:1.5px solid #86efac;border-radius:6px;font-weight:700;font-family:inherit;font-size:.85rem;"' +
            ' oninput="App.hrMap[document.getElementById(\'gClass\').value.trim()]=this.value;">' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<label style="font-weight:700;color:#166534;margin:0;font-size:.85rem;">วันเรียน</label>' +
            (function() {
              var sd = String((App.scoutData[term] && App.scoutData[term]._day) || '5');
              var days = [['1','จันทร์'],['2','อังคาร'],['3','พุธ'],['4','พฤหัสบดี'],['5','ศุกร์']];
              var opts = days.map(function(d) { return '<option value="'+d[0]+'"'+(d[0]===sd?' selected':'')+'>'+d[1]+'</option>'; }).join('');
              return '<select id="scout_day_t'+term+'" onchange="_renderScoutForTerm(\''+term+'\')" style="padding:5px 8px;border-radius:6px;border:1.5px solid #bbf7d0;font-weight:700;font-family:inherit;">'+opts+'</select>';
            }()) +
          '</div>' +
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:5px 14px;border-radius:50px;font-weight:700;font-size:.85rem;">' +
            'รวม <span id="scout_total_t' + term + '" style="font-size:1rem;color:#15803d;">0</span> คาบ' +
          '</div>' +
        '</div>';
      container.parentNode.insertBefore(panel, container);
    });

    // โหลด attendance แล้ว render ทั้ง 2 term
    loadScoutAttendance().then(function() {
      setTimeout(function() {
        // pre-fill teacher + วันเรียน จากข้อมูลที่บันทึกไว้ (ครั้งแรกเท่านั้น)
        ['1','2'].forEach(function(t) {
          var gd = App.scoutData && App.scoutData[t];
          var inp = document.getElementById('scout_teacher_t' + t);
          if (inp && gd && gd._teacher) inp.value = gd._teacher;

          // sync วันเรียนที่บันทึกไว้เข้า select (ครั้งแรก)
          var sel = document.getElementById('scout_day_t' + t);
          if (sel && gd && gd._day) {
            sel.value = gd._day;
            gd._dayLoaded = true; // mark แล้ว ไม่ override อีก
          }
        });
        _renderScoutForTerm('1');
        _renderScoutForTerm('2');
      }, 50);
    });
    return;
  }

  // recalculate: render term ที่ active อยู่
  _renderScoutForTerm(App.scoutActiveTerm || '1');
}

// ── render ตารางของ term ที่ระบุ ────────────────────────
function _renderScoutForTerm(term) {
  var container = document.getElementById('scoutContainer' + term);
  if (!container) return;

  // อ่านวันเรียนจาก select โดยตรง (user เลือกได้เองได้เสมอ)
  var termEl    = document.getElementById('scout_day_t' + term);
  var dayOfWeek = termEl ? parseInt(termEl.value) : 5;

  var startD = App.termDates['t' + term + '_start'];
  var endD   = App.termDates['t' + term + '_end'];

  var dates = [];
  if (startD && endD) {
    function parseD(str) {
      var p = String(str).split(/[\/\-]/);
      if (p.length !== 3) return new Date();
      var y = parseInt(p[2]) > 2500 ? parseInt(p[2]) - 543 : parseInt(p[2]);
      return new Date(y, parseInt(p[1]) - 1, parseInt(p[0]));
    }
    var hSet = new Set(
      (App.holidays || []).filter(function(h) { return h.type === 'holiday'; }).map(function(h) { return h.date; })
    );
    var cur = parseD(startD), end = parseD(endD);
    cur.setHours(0,0,0,0); end.setHours(0,0,0,0);
    while (cur <= end) {
      if (cur.getDay() === dayOfWeek) {
        var dd = String(cur.getDate()).padStart(2,'0');
        var mm = String(cur.getMonth()+1).padStart(2,'0');
        var yy = cur.getFullYear() + 543;
        var key = dd + '/' + mm + '/' + yy;
        if (!hSet.has(key)) dates.push(key);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  // อัปเดต badge จำนวนคาบ
  var totEl = document.getElementById('scout_total_t' + term);
  if (totEl) totEl.textContent = dates.length;

  // เก็บ dates แยกตาม term เสมอ + sync App.scoutDates ถ้าเป็น active term
  App['scoutDates' + term] = dates;
  if (term === (App.scoutActiveTerm || '1')) {
    App.scoutDates = dates;
  }

  _buildScoutTable(term, dates);
}

function onScoutSettingChange() {
  _renderScoutForTerm(App.scoutActiveTerm || '1');
}

// ── ตาราง 2 ส่วน (รับ term + dates) ─────────────────────
function _buildScoutTable(term, dates) {
  var container = document.getElementById('scoutContainer' + term);
  if (!container) return;

  var nDates = dates.length;
  var MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  var gd = App.scoutData[term] || {};
  var savedTopics  = gd._topics  || [];
  var savedTeacher = gd._teacher || '';

  // ส่วน 1: บันทึกกิจกรรม
  var actRows = dates.map(function(d, i) {
    var tv = savedTopics[i]   || '';
    var hv = (document.getElementById('scout_teacher_t' + term) || {}).value || savedTeacher || '';
    return '<tr>' +
      '<td style="text-align:center;border:1px solid #e2e8f0;padding:5px;color:#94a3b8;font-size:.8rem;">' + (i+1) + '</td>' +
      '<td style="border:1px solid #e2e8f0;padding:4px 6px;text-align:center;font-size:.82rem;color:#15803d;white-space:nowrap;">' + shortThaiDateScout(d) + '</td>' +
      '<td style="border:1px solid #e2e8f0;padding:2px 4px;"><input type="text" class="scout-topic" data-idx="' + i + '" value="' + tv + '" placeholder="หัวข้อกิจกรรม..." style="width:100%;border:none;background:transparent;font-family:inherit;font-size:.84rem;padding:4px 6px;outline:none;"></td>' +
      '<td style="border:1px solid #e2e8f0;padding:2px 4px;"><input type="text" class="scout-teacher" data-idx="' + i + '" value="' + hv + '" placeholder="ครูผู้รับผิดชอบ..." style="width:100%;border:none;background:transparent;font-family:inherit;font-size:.84rem;padding:4px 6px;outline:none;"></td>' +
    '</tr>';
  }).join('');

  // ส่วน 2: header วันที่
  var dateHeaders = dates.map(function(d) {
    var p = d.split('/');
    return '<th style="width:22px;vertical-align:bottom;padding-bottom:4px;border:1px solid #e2e8f0;background:#f8fafc;">' +
      '<div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;font-weight:600;color:#166534;white-space:nowrap;">' +
        parseInt(p[0]) + ' ' + MONTHS[parseInt(p[1])] + ' ' + String(p[2]).slice(-2) +
      '</div></th>';
  }).join('');

  // ส่วน 2: แถวนักเรียน (ดึงข้อมูลจาก App.scoutData[term] หรือ App.scoutAttMap)
  function attSt(v) {
    if (v==='ข') return {bg:'#fee2e2',cl:'#dc2626',lb:'ข'};
    if (v==='ล') return {bg:'#fef3c7',cl:'#b45309',lb:'ล'};
    if (v==='-') return {bg:'#f8fafc',cl:'#94a3b8',lb:'-'};
    return {bg:'#f0fdf4',cl:'#166534',lb:'✓'};
  }

  var bodyRows = App.students.map(function(s, idx) {
    // ลำดับความสำคัญ: App.scoutData[term] > guidance_data จาก API > guidanceAttMap
    var saved = (App.scoutData[term] && App.scoutData[term][s.studentId])
      || s.scout_data || {};

    var att;
    if (saved.attArray && Array.isArray(saved.attArray) && saved.attArray.length > 0) {
      att = saved.attArray.slice();
      while (att.length < nDates) att.push('ป');
    } else {
      var sbd = App.scoutAttMap[s.studentId] || {};
      att = dates.map(function(ds) {
        var r = String(sbd[ds] || '').trim();
        if (r==='ข') return 'ข';
        if (r==='ล'||r==='ป') return 'ล';
        return 'ป';
      });
    }

    var nP    = att.filter(function(v){return v==='ป';}).length;
    var nBase = att.filter(function(v){return v!=='-';}).length;
    var res   = saved.result || (nBase>0 && nP>=Math.ceil(nBase*0.8) ? 'ผ่าน' : 'ไม่ผ่าน');
    var rCl   = res==='ผ่าน'?'#16a34a':'#dc2626';
    var rBg   = res==='ผ่าน'?'#dcfce7':'#fee2e2';
    var rBd   = res==='ผ่าน'?'#86efac':'#fca5a5';

    var cells = dates.map(function(d,i) {
      var v = att[i]!==undefined ? att[i] : 'ป';
      var st = attSt(v);
      return '<td class="scout-day-cell" data-term="' + term + '" data-idx="' + i + '" data-flag="' + v + '" onclick="cycleScoutDay(this)"' +
        ' style="width:22px;min-width:22px;text-align:center;cursor:pointer;border:1px solid #e2e8f0;padding:2px 0;font-size:12px;font-weight:700;background:' + st.bg + ';color:' + st.cl + ';user-select:none;transition:background .1s;">' +
        st.lb + '</td>';
    }).join('');

    return '<tr data-guidesid="' + s.studentId + '" data-term="' + term + '">' +
      '<td style="text-align:center;border:1px solid #e2e8f0;padding:4px;position:sticky;left:0;z-index:10;background:#fff;font-size:.78rem;color:#94a3b8;min-width:30px;">' + (idx+1) + '</td>' +
      '<td class="ass-name" style="text-align:left;border:1px solid #e2e8f0;padding:5px 8px;position:sticky;left:30px;z-index:10;background:#fff;white-space:nowrap;font-weight:600;min-width:180px;border-right:2px solid #86efac;">' + s.name + '</td>' +
      cells +
      '<td class="scout-total-val" style="text-align:center;font-weight:700;color:#166534;background:#f0fdf4;border:1px solid #e2e8f0;padding:4px 6px;white-space:nowrap;min-width:48px;">' + nP + '/' + nBase + '</td>' +
      '<td style="text-align:center;border:1px solid #e2e8f0;padding:3px 4px;">' +
        '<select class="scout-result sinput" data-term="' + term + '"' +
        ' style="width:88px;padding:3px 4px;font-size:.78rem;font-weight:700;background:' + rBg + ';color:' + rCl + ';border:1.5px solid ' + rBd + ';border-radius:6px;font-family:inherit;"' +
        ' onchange="this.style.background=this.value===\'ผ่าน\'?\'#dcfce7\':\'#fee2e2\';this.style.color=this.value===\'ผ่าน\'?\'#16a34a\':\'#dc2626\';this.style.borderColor=this.value===\'ผ่าน\'?\'#86efac\':\'#fca5a5\';">' +
          '<option value="ผ่าน"'    + (res==='ผ่าน'   ?' selected':'') + '>ผ่าน</option>' +
          '<option value="ไม่ผ่าน"' + (res==='ไม่ผ่าน'?' selected':'') + '>ไม่ผ่าน</option>' +
        '</select>' +
      '</td>' +
    '</tr>';
  }).join('');

  // ── body ID แยกตาม term ─────────────────────────────
  var bodyId = 'scoutBody_t' + term;

  container.innerHTML =
    '<div style="margin-bottom:16px;">' +
      '<div style="font-weight:700;font-size:.88rem;color:#166534;padding:8px 12px;background:#f0fdf4;border-radius:8px 8px 0 0;border:1px solid #bbf7d0;border-bottom:none;">📋 บันทึกกิจกรรมลูกเสือ-เนตรนารี เทอม ' + term + ' (' + nDates + ' ครั้ง)</div>' +
      '<div style="border:1px solid #bbf7d0;border-radius:0 0 8px 8px;overflow:auto;max-height:260px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:.84rem;min-width:500px;">' +
          '<thead style="position:sticky;top:0;z-index:10;background:#f0fdf4;">' +
            '<tr><th style="width:40px;border:1px solid #e2e8f0;padding:7px 4px;">ครั้งที่</th><th style="width:90px;border:1px solid #e2e8f0;padding:7px 4px;">วันที่</th><th style="border:1px solid #e2e8f0;padding:7px 8px;text-align:left;">หัวข้อกิจกรรม</th><th style="width:200px;border:1px solid #e2e8f0;padding:7px 8px;text-align:left;">ครูผู้รับผิดชอบ</th></tr>' +
          '</thead>' +
          '<tbody>' + actRows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +
    '<div>' +
      '<div style="font-weight:700;font-size:.88rem;color:#166534;padding:8px 12px;background:#f0fdf4;border-radius:8px 8px 0 0;border:1px solid #bbf7d0;border-bottom:none;">✅ ตารางการเข้าร่วม เทอม ' + term + ' <span style="font-size:.75rem;font-weight:400;color:#64748b;margin-left:8px;">(คลิก: ✓มา → ขขาด → ลลา)</span></div>' +
      '<div style="border:1px solid #bbf7d0;border-radius:0 0 8px 8px;overflow:auto;max-height:55vh;">' +
        '<table style="border-collapse:collapse;font-size:.84rem;width:max-content;min-width:100%;">' +
          '<thead style="position:sticky;top:0;z-index:20;background:#f0fdf4;">' +
            '<tr>' +
              '<th rowspan="2" style="width:30px;position:sticky;left:0;z-index:30;background:#f0fdf4;border:1px solid #e2e8f0;">ที่</th>' +
              '<th rowspan="2" style="min-width:180px;text-align:left;padding-left:8px;position:sticky;left:30px;z-index:30;background:#f0fdf4;border:1px solid #e2e8f0;border-right:2px solid #86efac;">ชื่อ-นามสกุล</th>' +
              '<th colspan="' + nDates + '" style="border:1px solid #e2e8f0;background:#dcfce7;font-size:.8rem;">วันที่เข้าร่วมกิจกรรม</th>' +
              '<th rowspan="2" style="width:54px;border:1px solid #e2e8f0;background:#f0fdf4;font-size:.78rem;">มา/รวม</th>' +
              '<th rowspan="2" style="width:90px;border:1px solid #e2e8f0;background:#f0fdf4;">ผลประเมิน</th>' +
            '</tr>' +
            '<tr style="height:90px;">' + dateHeaders + '</tr>' +
          '</thead>' +
          '<tbody id="' + bodyId + '">' + bodyRows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
}

// ── คลิก toggle ────────────────────────────────────────
function cycleScoutDay(cell) {
  var CY = { 'ป':'ข', 'ข':'ล', 'ล':'ป', '-':'ป', '':'ป' };
  var ST = {
    'ป': { bg:'#f0fdf4', cl:'#166534', lb:'✓' },
    'ข': { bg:'#fee2e2', cl:'#dc2626', lb:'ข' },
    'ล': { bg:'#fef3c7', cl:'#b45309', lb:'ล' }
  };
  var cur  = cell.getAttribute('data-flag') || 'ป';
  var next = CY[cur] || 'ป';
  var st   = ST[next];

  cell.setAttribute('data-flag', next);
  cell.style.background = st.bg;
  cell.style.color      = st.cl;
  cell.textContent      = st.lb;

  var tr = cell.closest('tr');
  var nP = 0, nBase = 0;
  tr.querySelectorAll('.scout-day-cell').forEach(function(c) {
    var f = c.getAttribute('data-flag') || 'ป';
    if (f !== '-') nBase++;
    if (f === 'ป') nP++;
  });

  var tot = tr.querySelector('.scout-total-val');
  if (tot) tot.textContent = nP + '/' + nBase;

  var sel = tr.querySelector('.scout-result');
  if (sel && nBase > 0) {
    var pass = nP >= Math.ceil(nBase * 0.8) ? 'ผ่าน' : 'ไม่ผ่าน';
    sel.value             = pass;
    sel.style.background  = pass === 'ผ่าน' ? '#dcfce7' : '#fee2e2';
    sel.style.color       = pass === 'ผ่าน' ? '#16a34a' : '#dc2626';
    sel.style.borderColor = pass === 'ผ่าน' ? '#86efac' : '#fca5a5';
  }
}

// ── บันทึกข้อมูล (term = '1' หรือ '2') ──────────────────
async function saveScoutData(term) {
  term = term || App.scoutActiveTerm || '1';

  var bodyId   = 'scoutBody_t' + term;
  var rows     = $$(  '#' + bodyId + ' tr[data-guidesid]');
  if (!rows.length) return Utils.toast('ไม่พบข้อมูล เทอม ' + term, 'error');

  // อ่าน topics + teachers จาก container ของ term นี้
  var container = document.getElementById('scoutContainer' + term);
  var topics   = container ? [...container.querySelectorAll('.scout-topic')].map(function(i){return i.value;})   : [];
  var teachers = container ? [...container.querySelectorAll('.scout-teacher')].map(function(i){return i.value;}) : [];

  var records = [...rows].map(function(tr) {
    var flags = [...tr.querySelectorAll('.scout-day-cell')].map(function(c){return c.getAttribute('data-flag')||'ป';});
    var nP = flags.filter(function(f){return f==='ป';}).length;
    return {
      studentId : tr.getAttribute('data-guidesid'),
      attArray  : flags,
      attended  : nP,
      result    : tr.querySelector('.scout-result').value
    };
  });

  // บันทึกใน App.scoutData ด้วยเพื่อ persist ขณะยังอยู่หน้าเดิม
  if (!App.scoutData[term]) App.scoutData[term] = {};
  App.scoutData[term]._topics   = topics;
  App.scoutData[term]._teachers = teachers;
  records.forEach(function(r) { App.scoutData[term][r.studentId] = r; });

  Utils.showLoading('กำลังบันทึกแนะแนว เทอม ' + term + '...');
  try {
    var dayEl = document.getElementById('scout_day_t' + term);
    var dayOfWeek = dayEl ? dayEl.value : '5';
    // บันทึก dayOfWeek ลงใน App.scoutData ด้วย
    if (!App.scoutData[term]) App.scoutData[term] = {};
    App.scoutData[term]._day = dayOfWeek;
    await api('saveScout', {
      year      : $('gYear').value,
      classroom : $('gClass').value,
      term      : term,
      dayOfWeek : dayOfWeek,
      teacher   : (document.getElementById('scout_teacher_t'+term)||{}).value || '',
      topics    : topics,
      records   : records
    });
    Utils.toast('✅ บันทึกกิจกรรมลูกเสือ-เนตรนารี เทอม ' + term + ' สำเร็จ');
  } catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// ── พิมพ์รายงาน ────────────────────────────────────────
function printScoutReport() {
  var cls          = $('gClass').value;
  var year         = $('gYear').value;
  var clsName      = cls.split('เทอม')[0].trim();
  var evalHeadName     = 'นางสาวพรพรรณ บุญวัน';
  var activityHeadName = 'นาจิรพิพัฒน์ พะสุรัมย์';
  var directorName = 'นางสาวสู่ขวัญ ตลับนาค';
  var schoolName   = 'โรงเรียนบ้านคลอง ๑๔';
  var MONTHS   = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var MONTHS_S = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  // ── helper: ดึงข้อมูล + สร้าง HTML ของ 1 เทอม ──────────
  function buildTermPages(t) {
    var _cont     = document.getElementById('scoutContainer' + t) || document;
    var topics_   = [..._cont.querySelectorAll('.scout-topic')].map(function(i)   { return i.value; });
    var teachers_ = [..._cont.querySelectorAll('.scout-teacher')].map(function(i) { return i.value; });
    var termDates = App['scoutDates' + t] || [];
    var nDates    = termDates.length;
    var dispCols  = nDates; // ใช้จำนวนจริง ไม่ pad

    var rawTeacher = ((document.getElementById('scout_teacher_t' + t) || {}).value || '').trim()
      || '........................................................';
    var teachers = rawTeacher.split(/\s*(?:และ|\/|,)\s*/).filter(function(x) { return x; });

    var rows = [...$$('#scoutBody_t' + t + ' tr[data-guidesid]')].map(function(tr, i) {
      return {
        no      : i + 1,
        name    : tr.querySelector('.ass-name').textContent.trim(),
        atts    : [...tr.querySelectorAll('.scout-day-cell')].map(function(c) { return c.getAttribute('data-flag') || 'ป'; }),
        attended: [...tr.querySelectorAll('.scout-day-cell')].filter(function(c) { return c.getAttribute('data-flag') === 'ป'; }).length,
        result  : tr.querySelector('.scout-result').value
      };
    });

    if (!rows.length) return ''; // เทอมนี้ยังไม่มีข้อมูล ข้ามไป

    var passCount = rows.filter(function(r) { return r.result === 'ผ่าน'; }).length;
    var failCount = rows.length - passCount;

    function fmtD(dStr) {
      var p = dStr.split('/');
      if (p.length !== 3) return dStr;
      return parseInt(p[0]) + MONTHS_S[parseInt(p[1]) - 1] + p[2].slice(-2);
    }

    var attDateHeaders = Array(dispCols).fill(0).map(function(_, i) {
      var dStr = termDates[i];
      if (!dStr) return '<th class="col-date"></th>';
      var p = dStr.split('/');
      return '<th class="col-date"><div class="v-date">' +
        parseInt(p[0]) + ' ' + MONTHS[parseInt(p[1])] + ' ' + p[2].slice(-2) +
      '</div></th>';
    }).join('');

    var attRows = rows.map(function(r) {
      var cells = Array(dispCols).fill(0).map(function(_, i) {
        if (i >= nDates) return '<td style="border:1px solid #000;"></td>';
        var v  = r.atts[i] || 'ป';
        var lb = v === 'ป' ? '<span style="color:#166534;font-weight:bold;">/</span>'
               : v === 'ข' ? '<span style="color:#dc2626;font-weight:bold;">ข</span>'
               : v === 'ล' ? '<span style="color:#ca8a04;font-weight:bold;">ล</span>'
               :             '<span style="color:#94a3b8;">-</span>';
        return '<td style="text-align:center;border:1px solid #000;">' + lb + '</td>';
      }).join('');
      return '<tr>' +
        '<td style="text-align:center;border:1px solid #000;">' + r.no + '</td>' +
        '<td style="text-align:left;padding-left:6px;border:1px solid #000;white-space:nowrap;">' + r.name + '</td>' +
        cells +
        '<td style="text-align:center;font-weight:bold;border:1px solid #000;">' + r.attended + '</td>' +
        '<td style="text-align:center;font-weight:bold;color:#166534;border:1px solid #000;">' + (r.result === 'ผ่าน' ? '✓' : '') + '</td>' +
        '<td style="text-align:center;font-weight:bold;color:#dc2626;border:1px solid #000;">' + (r.result !== 'ผ่าน' ? '✓' : '') + '</td>' +
      '</tr>';
    }).join('');

    var actRowCount = Math.max(nDates, 20); // pad ถึง 20 แถวสำหรับหน้าบันทึก
    var actRows = Array(actRowCount).fill(0).map(function(_, i) {
      return '<tr>' +
        '<td style="height:26px;">' + (i + 1) + '</td>' +
        '<td style="font-size:12px;">' + (termDates[i] ? fmtD(termDates[i]) : '') + '</td>' +
        '<td style="text-align:left;padding-left:8px;font-size:12px;">' + (topics_[i] || '') + '</td>' +
        '<td style="font-size:12px;">' + (teachers_[i] || teachers[0] || '') + '</td>' +
      '</tr>';
    }).join('');

    var signLines = teachers.map(function(x) {
      return '<div style="text-align:center;min-width:220px;">ลงชื่อ.......................................ครูประจำชั้น<br><div style="margin-top:8px;">( ' + x + ' )</div></div>';
    }).join('');

    // ── ปก (เทอม t) ──
    var pageCover =
      '<div class="page cover-page">' +
        '<div style="text-align:center;margin-top:10mm;margin-bottom:6mm;">' +
          '<img src="https://raw.githubusercontent.com/Bk14School/easygrade/refs/heads/main/logo-OBEC.png" style="width:90px;height:auto;">' +
        '</div>' +
        '<div style="text-align:center;font-size:22px;font-weight:bold;letter-spacing:1px;margin-bottom:4mm;">แบบบันทึกผลกิจกรรมลูกเสือ-เนตรนารี</div>' +
        '<div style="text-align:center;font-size:17px;font-weight:bold;margin-bottom:8mm;">' +
          'ระดับชั้น ' + clsName + ' &nbsp;|&nbsp; ภาคเรียนที่ ' + t + ' &nbsp;|&nbsp; ปีการศึกษา ' + year +
        '</div>' +
        '<div class="cover-info-box">' +
          '<div class="cover-row"><span class="cover-label">โรงเรียน</span><span class="cover-val">' + schoolName + '</span></div>' +
          '<div class="cover-row"><span class="cover-label">หลักสูตร</span><span class="cover-val">การศึกษาขั้นพื้นฐาน &nbsp; ระดับชั้น ' + clsName + '</span></div>' +
          '<div class="cover-row"><span class="cover-label">ครูประจำชั้น</span><span class="cover-val cover-ul">' + teachers.join(' และ ') + '</span></div>' +
        '</div>' +
        '<table class="cover-stat">' +
          '<tr><th>จำนวนนักเรียนทั้งหมด</th><th>ผ่าน</th><th>ไม่ผ่าน</th><th>หมายเหตุ</th></tr>' +
          '<tr><td>' + rows.length + '</td><td>' + passCount + '</td><td>' + failCount + '</td><td></td></tr>' +
        '</table>' +
        '<div class="appr">' +
          '<div style="font-size:16px;font-weight:bold;text-align:center;margin-bottom:10px;">การอนุมัติผลการเรียน</div>' +
          '<div class="sf">' + signLines + '</div>' +
          '<hr style="border:none;border-top:1px dashed #ccc;margin:10px 0;">' +
          '<div class="sign-block">' +
            '<div>ลงชื่อ.................................................................</div>' +
            '<div class="sign-name">หัวหน้ากิจกรรมพัฒนาผู้เรียน</div>' +
            '<div class="sign-name">( ' + activityHeadName + ' )</div>' +
          '</div>' +
          '<div class="sign-block">' +
            '<div>ลงชื่อ.................................................................</div>' +
            '<div class="sign-name">หัวหน้างานวัดผลและประเมินผล</div>' +
            '<div class="sign-name">( ' + evalHeadName + ' )</div>' +
          '</div>' +
          '<hr style="border:none;border-top:1px dashed #ccc;margin:10px 0;">' +
          '<div style="text-align:center;margin-top:8px;">' +
            '<div style="font-weight:bold;font-size:15px;margin-bottom:8px;">เรียน เสนอเพื่อโปรดพิจารณาอนุมัติผลการเรียน</div>' +
            '<div style="display:flex;justify-content:center;gap:70px;margin:8px 0;font-size:14px;">' +
              '<span><span class="rc"></span> อนุมัติ</span><span><span class="rc"></span> ไม่อนุมัติ</span>' +
            '</div>' +
          '</div>' +
          '<div class="sign-block">' +
            '<div>ลงชื่อ.................................................................</div>' +
            '<div class="sign-name">ผู้อำนวยการ' + schoolName + '</div>' +
            '<div class="sign-name">( ' + directorName + ' )</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // ── รายชื่อ ──
    var pageRoster =
      '<div class="page">' +
        '<div class="rh">กิจกรรมแนะแนว ระดับชั้น ' + clsName + ' ภาคเรียนที่ ' + t + '</div>' +
        '<div style="margin-left:15%;font-size:14px;margin-bottom:6px;">จำนวนนักเรียน..........' + rows.length + '..........คน</div>' +
        '<table><thead><tr><th style="width:40px;font-weight:normal;">ที่</th><th style="font-weight:normal;">ชื่อ – สกุล</th><th style="width:35%;font-weight:normal;">หมายเหตุ</th></tr></thead><tbody>' +
          rows.map(function(r) { return '<tr><td>' + r.no + '</td><td style="text-align:left;padding-left:15px;">' + r.name + '</td><td></td></tr>'; }).join('') +
          Array(Math.max(0, 20 - rows.length)).fill('<tr><td><br></td><td></td><td></td></tr>').join('') +
        '</tbody></table>' +
        '<div class="sf" style="margin-top:30px;">' + teachers.map(function(x) { return '<div style="text-align:center;min-width:200px;">ลงชื่อ.......................................ครูประจำชั้น<br><div style="margin-top:10px;">( ' + x + ' )</div></div>'; }).join('') + '</div>' +
      '</div>';

    // ── บันทึกกิจกรรม ──
    var pageActivity =
      '<div class="page">' +
        '<div class="tc fw" style="font-size:16px;margin-bottom:6px;">บันทึกการจัดกิจกรรม ภาคเรียนที่ ' + t + '</div>' +
        '<table><thead><tr><th style="width:8%;font-weight:normal;">ครั้งที่</th><th style="width:12%;font-weight:normal;">วัน/เดือน/ปี</th><th style="font-weight:normal;">หัวข้อกิจกรรม / แผนการจัดการเรียนรู้</th><th style="width:20%;font-weight:normal;">ผู้สอน</th></tr></thead>' +
        '<tbody>' + actRows + '</tbody></table>' +
      '</div>';

    // ── ตารางเช็คชื่อ (landscape) ──
    var pageAtt =
      '<div class="page att-page">' +
        '<div class="tc fw" style="font-size:13px;margin-bottom:3px;">การเข้าร่วมกิจกรรมลูกเสือ-เนตรนารี ภาคเรียนที่ ' + t + '</div>' +
        '<div class="fw" style="margin-bottom:2px;font-size:12px;">ชั้น.................' + clsName + '..................ปีการศึกษา ' + year + '</div>' +
        '<div style="font-size:11px;margin-bottom:5px;">/ = มาเรียนปกติ &nbsp; ข = ขาดเรียน &nbsp; ล = ลา &nbsp; เกณฑ์ผ่าน ≥ 80%</div>' +
        '<table class="att-tbl"><thead><tr>' +
          '<th rowspan="2" class="col-no">ที่</th>' +
          '<th rowspan="2" class="col-name">ชื่อ – สกุล</th>' +
          '<th colspan="' + nDates + '" style="border:1px solid #000;font-size:10px;">วัน/เดือน/ปี ครั้งที่เข้าร่วมกิจกรรม</th>' +
          '<th rowspan="2" class="col-sum">รวม</th>' +
          '<th rowspan="2" class="col-pass">ผ่าน</th>' +
          '<th rowspan="2" class="col-pass">ไม่ผ่าน</th>' +
        '</tr><tr>' + attDateHeaders + '</tr></thead>' +
        '<tbody>' + attRows + '</tbody></table>' +
      '</div>';

    return pageCover + pageRoster + pageActivity + pageAtt;
  }

  // ── สร้าง HTML รวม 2 เทอม ──────────────────────────────
  var pageVision =
    '<div class="page" style="padding:35px;">' +
      '<div class="tc fw" style="font-size:17px;margin-bottom:10px;">วิสัยทัศน์</div>' +
      '<div style="text-indent:40px;text-align:justify;margin-bottom:22px;">โรงเรียนบ้านคลอง ๑๔ มุ่งจัดการศึกษาให้เยาวชนเป็นคนดี มีคุณธรรม มีทักษะในการสื่อสาร มีความรู้ความสามารถเต็มตามศักยภาพของแต่ละบุคคล มีเจตคติที่ดีในการประกอบอาชีพสุจริตและใช้ชีวิตในสังคมได้อย่างมีความสุขตามแนวปรัชญาเศรษฐกิจพอเพียงด้วยกระบวนการบริหารจัดการที่ทันสมัยและการมีส่วนร่วมของบุคคลทั้งในและนอกสถานศึกษา</div>' +
      '<div class="tc fw" style="font-size:17px;margin-bottom:10px;">พันธกิจ</div>' +
      '<div style="margin-bottom:22px;padding-left:20px;line-height:1.9;">๑. ส่งเสริมสนับสนุนให้ชุมชนเข้ามามีส่วนร่วมในการจัดการศึกษา และใช้ภูมิปัญญาท้องถิ่น<br>๒. จัดการเรียนการสอนโดยยึดนักเรียนเป็นสำคัญ นักเรียนแสวงหาความรู้ด้วยตนเอง<br>๓. ส่งเสริมสนับสนุนให้ครูและบุคลากรทางการศึกษาพัฒนาตนเองและทำการวิจัยในชั้นเรียน<br>๔. จัดสภาพแวดล้อมของโรงเรียนให้เอื้อต่อการจัดการเรียนการสอน<br>๕. จัดกิจกรรมโครงการพระราชดำริอย่างต่อเนื่องและเป็นระบบ</div>' +
      '<div class="tc fw" style="font-size:17px;margin-bottom:10px;">เป้าหมาย</div>' +
      '<div style="padding-left:20px;line-height:1.9;">๑. ชุมชนมีส่วนร่วมในการจัดการศึกษา<br>๒. นำภูมิปัญญาท้องถิ่นมาใช้ในการจัดการเรียนการสอน<br>๓. ครูจัดการเรียนรู้โดยยึดนักเรียนเป็นสำคัญ<br>๔. นักเรียนรู้จักแสวงหาความรู้ได้ด้วยตนเองและสร้างองค์ความรู้ได้<br>๕. นักเรียนมีคุณธรรม จริยธรรมที่ดีงาม<br>๖. ส่งเสริมสนับสนุนครูและบุคลากรทางการศึกษาพัฒนาตนเองอยู่เสมอ<br>๗. จัดสภาพแวดล้อมในโรงเรียนให้เอื้อต่อการเรียนรู้<br>๘. จัดกิจกรรมตามโครงการพระราชดำริอย่างต่อเนื่องและเป็นระบบ</div>' +
    '</div>';

  var term1Pages = buildTermPages('1');
  var term2Pages = buildTermPages('2');

  if (!term1Pages && !term2Pages) {
    return Utils.toast('ไม่พบข้อมูลทั้ง 2 เทอม', 'error');
  }

  var win = window.open('', '_blank');
  if (!win) return Utils.toast('กรุณาอนุญาต Popup', 'error');

  var css =
    '@page{size:A4 portrait;margin:12mm;}' +
    '@page att{size:A4 landscape;margin:6mm 7mm;}' +
    'body{font-family:\'Sarabun\',sans-serif;font-size:14px;color:#000;margin:0;line-height:1.4;}' +
    '.page{page-break-after:always;min-height:260mm;padding:8px 18px;}' +
    '.cover-page{padding:0 20mm;box-sizing:border-box;}' +
    '.cover-info-box{border:1.5px solid #555;border-radius:8px;padding:10px 16px;margin:0 auto 8mm;max-width:160mm;font-size:14px;line-height:2;}' +
    '.cover-row{display:flex;align-items:baseline;gap:8px;}' +
    '.cover-label{font-weight:bold;white-space:nowrap;min-width:70px;}' +
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
    '.cover-box{border:1.5px solid #000;border-radius:12px;padding:12px;text-align:center;margin-bottom:12px;}' +
    '.appr{border:1.5px solid #000;border-radius:25px;padding:14px 18px;margin-top:12px;}' +
    '.st{width:90%;margin:10px auto;font-size:13px;}' +
    '.rc{display:inline-block;width:13px;height:13px;border:1.5px solid #000;border-radius:50%;vertical-align:middle;margin-right:5px;}' +
    '.sf{display:flex;justify-content:space-around;flex-wrap:wrap;margin-top:14px;gap:8px;}' +
    '.rh{border:1px solid #000;border-radius:8px;padding:8px;width:65%;margin:0 auto 10px;text-align:center;font-size:15px;font-weight:bold;}' +
    '.att-tbl{font-size:9.5px;table-layout:fixed;width:100%;border-collapse:collapse;}' +
    '.att-tbl th,.att-tbl td{border:1px solid #000;padding:0;text-align:center;overflow:hidden;line-height:1.2;}' +
    '.att-tbl .col-no{width:18px;min-width:18px;}' +
    '.att-tbl .col-name{width:120px;min-width:120px;text-align:left !important;padding-left:3px;white-space:nowrap;overflow:hidden;}' +
    '.att-tbl .col-date{width:14px;min-width:14px;max-width:14px;}' +
    '.att-tbl .col-sum{width:20px;min-width:20px;font-weight:bold;}' +
    '.att-tbl .col-pass{width:20px;min-width:20px;}' +
    '.att-tbl .v-date{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5px;color:#c00;height:70px;white-space:nowrap;display:block;}';

  var html =
    '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">' +
    '<title>รายงานกิจกรรมลูกเสือ_' + cls + '_' + year + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style></head><body>' +
    pageVision +
    term1Pages +
    term2Pages +
    '</body></html>';

  win.document.open();
  win.document.write(html);
  win.document.close();
}


// ── legacy stubs ──────────────────────────────────────
function calcScoutSchedule() { onScoutSettingChange(); }
function calcScoutRow()      { /* stub */ }
function toggleScoutDay()    { /* stub */ }
