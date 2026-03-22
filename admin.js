// 5. ADMIN & SUBJECTS
// =====================================================
async function loadTeachers() {
  Utils.showLoading('โหลดครู...');
  try {
    const ts = await api('getTeacherList');
    $('tTbody').innerHTML = ts.map(t => {
      const[id, name, , cls, , subsStr = ''] = [...t, ''];
      if (cls === '*') return '';
      const tags = (subsStr ? subsStr.split(',') :[]).map(s => {
        const [c, n] = s.split('_');
        return n ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary me-1" style="font-size:.74rem;">${c}: ${n}</span>` : '';
      }).join('');
      return `<tr>
        <td><b>${name}</b><br><span class="text-muted" style="font-size:.76rem;">ประจำชั้น ${cls}</span></td>
        <td>${tags || '<span class="text-muted" style="font-size:.78rem;">ยังไม่กำหนด</span>'}</td>
        <td style="text-align:center;"><button class="btn-sm" onclick="openModal('${id}','${name}','${cls}','${subsStr}')">⚙️</button></td>
      </tr>`;
    }).join('');
  } catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

function openModal(id, name, cls, subsStr) {
  App.editTid = id;
  App.editAssigned = subsStr ? subsStr.split(',') :[];
  $('modalName').textContent = name;
  const sel = $('mClassSel');
  sel.innerHTML = CONFIG.ALL_CLS.map(c => `<option>${c}</option>`).join('');
  if (CONFIG.ALL_CLS.includes(cls)) sel.value = cls;
  $('subModal').style.display = 'flex';
  renderMCbs(); renderMAssigned();
}
function closeModal() { $('subModal').style.display = 'none'; }

function renderMCbs() {
  const cls = $('mClassSel').value;
  const subs = App.subs[cls] ||[];
  $('mCbs').innerHTML = subs.length ? subs.map(s => {
    const v = `${cls}_${s}`;
    return `<label class="border p-2 rounded bg-white" style="cursor:pointer;font-size:.84rem;user-select:none;">
      <input type="checkbox" class="form-check-input me-1" value="${v}" ${App.editAssigned.includes(v) ? 'checked' : ''} onchange="toggleMSub(this)">${s}</label>`;
  }).join('') : '<span class="text-muted">ไม่มีรายวิชา</span>';
}

function toggleMSub(cb) { App.editAssigned = cb.checked ? [...new Set([...App.editAssigned, cb.value])] : App.editAssigned.filter(v => v !== cb.value); renderMAssigned(); }
function removeMSub(v) { App.editAssigned = App.editAssigned.filter(x => x !== v); renderMCbs(); renderMAssigned(); }
function renderMAssigned() {
  $('mAssigned').innerHTML = App.editAssigned.length ? App.editAssigned.map(s => {
    const [c, n] = s.split('_');
    return `<div class="badge-item">${c}: ${n || s} <button onclick="removeMSub('${s}')">×</button></div>`;
  }).join('') : '<div class="text-muted text-center mt-2" style="font-size:.8rem;">ยังไม่มีวิชา</div>';
}

async function saveModal() {
  Utils.showLoading('บันทึก...');
  try { await api('saveTeacherAssignments', { teacherId: App.editTid, subjects: App.editAssigned.join(',') }); Utils.toast('✅ บันทึกสำเร็จ'); closeModal(); loadTeachers(); } 
  catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

async function adminSetup() {
  const y = $('setupYear').value;
  if (!y || y < 2560) return Utils.toast('ปีไม่ถูกต้อง', 'error');
  if (!confirm(`สร้างฐานข้อมูลปี ${y}?`)) return;
  Utils.showLoading(`สร้างปี ${y}...`);
  try { Utils.toast(await api('setupGradeYear', { year: y })); } catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// ── กรองวิชาตามเทอม ──────────────────────────────────
// วิชาที่มีเลขท้าย: เลขคี่ = เทอม 1, เลขคู่ = เทอม 2
// วิชาที่ไม่มีเลข: แสดงทั้ง 2 เทอม
function _subjMatchesTerm(subjectName, term) {
  const m = String(subjectName).match(/\s+(\d+)\s*$/);
  if (!m) return true;           // ไม่มีเลข → แสดงทุกเทอม
  const n = parseInt(m[1]);
  return term === 1 ? (n % 2 === 1) : (n % 2 === 0);
}

function switchGradeTerm(term) {
  App.gradeTerm  = term;
  App.activeTerm = term;
  App.activeUnit = null; // reset tab หน่วยเมื่อสลับเทอม

  // สี Tab
  const btn1 = $('termTab1'), btn2 = $('termTab2');
  if (btn1) { btn1.style.background = term===1?'#6d28d9':'#fff'; btn1.style.color = term===1?'#fff':'#6d28d9'; }
  if (btn2) { btn2.style.background = term===2?'#6d28d9':'#fff'; btn2.style.color = term===2?'#fff':'#6d28d9'; }

  // อัปเดต label ปุ่มบันทึก
  const saveBtn = document.querySelector('.btn-save');
  if (saveBtn) saveBtn.textContent = `💾 บันทึกเทอม ${term}`;

  // อัปเดต dropdown เฉพาะเมื่อไม่ได้ล็อกอยู่
  if (!App.loadedSubject) { updateSubjDrop(); return; }

  // rebuild ตารางเทอมใหม่ (ถ้ามีข้อมูลอยู่แล้ว)
  if (App.students && App.students.length && typeof buildTable === 'function') buildTable();
}

function updateSubjDrop() {
  if (!App.gradeTerm) App.gradeTerm = 1;
  const term = App.gradeTerm;
  const cls  = $('gClass').value.trim();
  const sel  = $('gSubj');
  if (!sel) return;
  sel.innerHTML = '';

  // ตัวเลือกว่างเสมอเป็นค่าเริ่มต้น
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '— เลือกรายวิชา —';
  sel.appendChild(emptyOpt);

  let allSubs = [];

  if (App.user?.isAdmin) {
    if (!$('gClass').options.length) {
      $('gClass').innerHTML = CONFIG.ALL_CLS.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    allSubs = App.subs[cls] || [];
  } else {
    const mySubs = App.user?.mySubjects || [];
    allSubs = mySubs
      .map(s => s.trim())
      .filter(s => {
        const parts = s.split('_');
        return parts[0] && parts[0].trim() === cls;
      })
      .map(s => {
        const parts = s.split('_');
        parts.shift();
        return parts.join('_').trim();
      });
  }

  // กรองตามเทอม
  const filtered = allSubs.filter(s => _subjMatchesTerm(s, term));
  filtered.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
}

// =====================================================
