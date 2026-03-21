// 11. HOLISTIC & ATTENDANCE
// =====================================================
function calcTotalHours() {
  if (!App.termDates || Object.keys(App.termDates).length === 0) return $('ci_total_hours').textContent = 0;
  const cls = $('gClass').value;
  const startD = App.termDates[cls.includes("เทอม 2") ? 't2_start' : 't1_start'], endD = App.termDates[cls.includes("เทอม 1") ? 't1_end' : 't2_end'];
  if (!startD || !endD) return;

  const parseD = (str) => { const p = String(str).split(/[\/\-]/); return p.length === 3 ? new Date(parseInt(p[2]) > 2500 ? parseInt(p[2]) - 543 : parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])) : new Date(); };
  const start = parseD(startD), end = parseD(endD); start.setHours(0,0,0,0); end.setHours(0,0,0,0);
  
  const sch = { 1: +$('sch_mon').value||0, 2: +$('sch_tue').value||0, 3: +$('sch_wed').value||0, 4: +$('sch_thu').value||0, 5: +$('sch_fri').value||0, 0:0, 6:0 };
  const hSet = new Set(App.holidays.filter(h => h.type === 'holiday').map(h => h.date));
  let hrs = 0, cur = new Date(start);
  
  while (cur <= end) {
    if (!hSet.has(`${String(cur.getDate()).padStart(2,'0')}/${String(cur.getMonth()+1).padStart(2,'0')}/${cur.getFullYear()+543}`)) hrs += sch[cur.getDay()];
    cur.setDate(cur.getDate() + 1);
  }
  $('ci_total_hours').textContent = hrs + (Number($('ci_manual_adjust').value) || 0);
}

function renderHolisticTable(students, containerId, tableId, mode) {
  const container = $(containerId); if (!container) return;
  if (!students.length) return container.innerHTML = `<div class="text-center text-muted py-3">ไม่พบข้อมูลผู้เรียน</div>`;
  const htmlRows = students.map((s, idx) => {
    const h = (mode === 'homeroom' ? s.holistic_homeroom : s.holistic_subject) || {};
    const cVals = h.char_scores?.length === 8 ? h.char_scores : Array(8).fill(""), rVals = h.read_scores?.length === 5 ? h.read_scores : Array(5).fill(""), sVals = h.skill_scores?.length === 5 ? h.skill_scores : Array(5).fill("");
    const mkInp = (vals, t) => vals.map(v => `<td><input type="number" class="inp-ass ${t}-inp" min="0" max="3" value="${v}" oninput="calcAssRow(this, '${t}')"></td>`).join('');
    return `<tr data-hsid="${s.studentId}"><td class="ass-no">${idx + 1}</td><td class="ass-name" style="text-align:left;font-weight:600;background:#fff;">${s.name}</td>
      ${mkInp(cVals, 'c')}<td class="bg-sum c-total">-</td><td><span class="res-badge c-result">-</span><input type="hidden" class="c-final-val" value="${h.char || ''}"></td>
      ${mkInp(rVals, 'r')}<td class="bg-sum r-total">-</td><td><span class="res-badge r-result">-</span><input type="hidden" class="r-final-val" value="${h.read || ''}"></td>
      ${mkInp(sVals, 's')}<td class="bg-sum s-total">-</td><td><span class="res-badge s-result">-</span><input type="hidden" class="s-final-val" value="${h.skill || ''}"></td></tr>`;
  }).join('');
  
  container.innerHTML = `<div class="ass-wrap"><table class="ass-tbl" id="${tableId}">
    <thead><tr><th rowspan="2" class="ass-no" style="width:40px;">ที่</th><th rowspan="2" class="ass-name" style="min-width:140px;">ชื่อ-นามสกุล</th><th colspan="10" class="bg-char">คุณลักษณะอันพึงประสงค์</th><th colspan="7" class="bg-rw">อ่าน คิด วิเคราะห์ เขียน</th><th colspan="7" style="background:#d1d5db;">สมรรถนะสำคัญ</th></tr>
    <tr>${Array(8).fill(0).map((_,i)=>`<th class="bg-char v-text">${i+1}.</th>`).join('')}<th class="bg-sum v-text">รวม</th><th class="bg-sum">ผล</th>
    ${Array(5).fill(0).map((_,i)=>`<th class="bg-rw v-text">${i+1}.</th>`).join('')}<th class="bg-sum v-text">รวม</th><th class="bg-sum">ผล</th>
    ${Array(5).fill(0).map((_,i)=>`<th class="v-text" style="background:#e5e7eb;">${i+1}.</th>`).join('')}<th class="bg-sum v-text">รวม</th><th class="bg-sum">ผล</th></tr></thead>
    <tbody>${htmlRows}</tbody></table></div>`;
  $$(`#${tableId} tr[data-hsid]`).forEach(tr => { ['c','r','s'].forEach(t => calcAssRow(tr.querySelector(`.${t}-inp`), t)); });
}

function calcAssRow(input, type) {
  if (!input) return; const tr = input.closest('tr'); if (!tr) return;
  let sum = 0, count = 0;
  tr.querySelectorAll(`.${type}-inp`).forEach(inp => { let v = parseFloat(inp.value); if (!isNaN(v)) { if (v > 3) { inp.value = 3; v = 3; } if (v < 0) { inp.value = 0; v = 0; } sum += v; count++; } });
  if (document.activeElement === input && input.value.length >= 1) {
    let nx = input.closest('td').nextElementSibling, nxInp = null;
    while (nx && !nxInp) { nxInp = nx.querySelector('.inp-ass'); nx = nx.nextElementSibling; }
    if (nxInp) { nxInp.focus(); nxInp.select(); }
  }
  const tEl = tr.querySelector(`.${type}-total`), rBadge = tr.querySelector(`.${type}-result`), fVal = tr.querySelector(`.${type}-final-val`);
  if (!count) { if(tEl) tEl.textContent="-"; if(rBadge) { rBadge.textContent="-"; rBadge.className=`res-badge ${type}-result`; } if(fVal) fVal.value=""; return; }
  const avg = sum / count;
  const levels =[{ v: 2.5, t: "ดีเยี่ยม", c: "res-3", p: "ดีเยี่ยม (3)" }, { v: 1.5, t: "ดี", c: "res-2", p: "ดี (2)" }, { v: 1.0, t: "ผ่าน", c: "res-1", p: "ผ่าน (1)" }, { v: 0, t: "ไม่ผ่าน", c: "res-0", p: "ไม่ผ่าน (0)" }];
  const l = levels.find(x => avg >= x.v);
  if (tEl) tEl.textContent = sum;
  if (rBadge) { rBadge.textContent = l.t; rBadge.className = `res-badge ${type}-result ${l.c}`; }
  if (fVal) fVal.value = l.p;
}

async function saveHolisticData(mode) {
  const records =[];
  $$(`${mode === 'homeroom' ? '#hrAssBody' : '#assBody'} tr[data-hsid]`).forEach(tr => records.push({
    studentId: tr.getAttribute('data-hsid'),
    char_scores: [...tr.querySelectorAll('.c-inp')].map(i => i.value), char_total: tr.querySelector('.c-total').textContent, char: tr.querySelector('.c-final-val').value,
    read_scores:[...tr.querySelectorAll('.r-inp')].map(i => i.value), read_total: tr.querySelector('.r-total').textContent, read: tr.querySelector('.r-final-val').value,
    skill_scores:[...tr.querySelectorAll('.s-inp')].map(i => i.value), skill_total: tr.querySelector('.s-total').textContent, skill: tr.querySelector('.s-final-val').value
  }));
  if (!records.length) return Utils.toast('ไม่พบข้อมูล', 'error');
  Utils.showLoading('กำลังบันทึก...');
  try { Utils.toast('✅ ' + await api('saveHolistic', { mode, year: $('gYear').value, classroom: $('gClass').value, subject: $('gSubj').value, records })); } catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// =====================================================
