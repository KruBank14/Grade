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

function updateSubjDrop() {
  // .trim() เพื่อตัดช่องว่างที่อาจแอบซ่อนอยู่ออก
  const cls = $('gClass').value.trim(); 
  const sel = $('gSubj'); 
  if (!sel) return;
  sel.innerHTML = '';

  if (App.user?.isAdmin) {
    if (!$('gClass').options.length) {
      $('gClass').innerHTML = CONFIG.ALL_CLS.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    (App.subs[cls] ||[]).forEach(s => sel.innerHTML += `<option value="${s}">${s}</option>`);
  } else {
    // กรองและตัดคำแบบเซฟที่สุด ป้องกันบั๊กกรณีฐานข้อมูลพิมพ์เว้นวรรคติดมา
    const mySubs = App.user?.mySubjects ||[];
    const f = mySubs
      .map(s => s.trim()) // ตัดช่องว่างหัวท้ายของชุดข้อความก่อน
      .filter(s => {
         const parts = s.split('_');
         // เช็คว่าส่วนแรก (ชื่อชั้น) ตรงกับ Dropdown ไหม
         return parts[0] && parts[0].trim() === cls; 
      })
      .map(s => {
         const parts = s.split('_');
         parts.shift(); // ตัดชื่อชั้นทิ้ง
         return parts.join('_').trim(); // คืนค่าเฉพาะชื่อวิชา
      });

    if (f.length > 0) {
      f.forEach(s => sel.innerHTML += `<option value="${s}">${s}</option>`);
    } else {
      sel.innerHTML = '<option value="">-- ไม่พบวิชา --</option>';
    }
  }
}

// =====================================================
