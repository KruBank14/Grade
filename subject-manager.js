// =====================================================
// subject-manager.js — จัดการรายวิชาแต่ละชั้นเรียน (Admin)
// =====================================================
// ทุกวิชามี 1 ชีต กรอกได้ทั้งเทอม 1 และ 2
//
// วิชาต่อเนื่อง (isSeq):
//   - เก็บ flag isSeq = true ใน __CONFIG__
//   - เลขต่อเนื่องคำนวณจากชั้น ไม่ต้องกรอกรายวิชา:
//       ม.1 → เทอม 1 = เลขคี่ลำดับที่ 1 = 1, เทอม 2 = 2
//       ม.2 → เทอม 1 = 3, เทอม 2 = 4
//       ม.3 → เทอม 1 = 5, เทอม 2 = 6
//   - ปพ.5/ปพ.6 เทอม 1 → "เทคโนโลยี 1" (ม.1), "เทคโนโลยี 5" (ม.3)
//   - ปพ.5/ปพ.6 เทอม 2 → "เทคโนโลยี 2" (ม.1), "เทคโนโลยี 6" (ม.3)
//   - ปพ.5/ปพ.6 ทั้งปี  → "เทคโนโลยี" (ไม่มีเลข)
// =====================================================

// ── เลขต่อเนื่องของแต่ละชั้น ──────────────────────────
// ม.1 = 1/2, ม.2 = 3/4, ม.3 = 5/6
// ป.x ไม่มีวิชาต่อเนื่อง (คืน null)
const CLASS_SEQ_NUMS = {
  'ม.1': { t1: 1, t2: 2 },
  'ม.2': { t1: 3, t2: 4 },
  'ม.3': { t1: 5, t2: 6 }
};

const SubjectMgr = {
  cls:      '',
  subjects: [],   // [{ name, isSeq }]
                  //   isSeq = false  → วิชาทั่วไป
                  //   isSeq = true   → วิชาต่อเนื่อง (เลขคำนวณจากชั้น)
  dirty:    false,

  // ── เริ่มต้น ──
  init() {
    const sel = $('smClassSel');
    if (!sel) return;
    sel.innerHTML = CONFIG.ALL_CLS.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.value = CONFIG.ALL_CLS[0];
    this.loadClass(CONFIG.ALL_CLS[0]);
  },

  // ── โหลดวิชาจาก App.subs ──
  // Auto-detect วิชาต่อเนื่อง: ชื่อที่มีเลขท้ายคี่/คู่ตรงกับชั้น
  // เช่น ม.3 มี "เทคโนโลยี 5","เทคโนโลยี 6" → { name:"เทคโนโลยี", isSeq:true }
  loadClass(cls) {
    this.cls   = cls;
    this.dirty = false;
    const raw  = (App.subs && App.subs[cls]) ? [...App.subs[cls]] : [];
    this.subjects = _smDetectSeq_(raw, cls);
    this.render();
  },

  // ── Render ──
  render() {
    const box = $('smSubjectList');
    if (!box) return;

    const seqNums   = CLASS_SEQ_NUMS[this.cls];
    const hasSeqCls = !!seqNums; // ชั้นนี้รองรับวิชาต่อเนื่องหรือไม่

    if (!this.subjects.length) {
      box.innerHTML = `<div class="text-center text-muted py-4" style="font-size:.85rem;">ยังไม่มีวิชาในชั้นนี้</div>`;
      this._updateDirtyUI();
      return;
    }

    box.innerHTML = this.subjects.map((s, i) => {
      const badge = s.isSeq && seqNums
        ? `<span class="sm-badge seq" title="เทอม 1 = ${s.name} ${seqNums.t1} | เทอม 2 = ${s.name} ${seqNums.t2}">
             🔢 ${seqNums.t1}/${seqNums.t2}
           </span>`
        : '';

      const typeBtn = hasSeqCls
        ? s.isSeq
          ? `<button class="sm-btn-type" onclick="SubjectMgr.toggleSeq(${i})" title="เปลี่ยนเป็นวิชาทั่วไป">↩ ทั่วไป</button>`
          : `<button class="sm-btn-type" onclick="SubjectMgr.toggleSeq(${i})" title="ตั้งเป็นวิชาต่อเนื่อง">↪ ต่อเนื่อง</button>`
        : '';

      return `<div class="sm-row" draggable="true" data-idx="${i}">
        <span class="sm-drag" title="ลากเพื่อเรียงลำดับ">⠿</span>
        <span class="sm-num">${i + 1}</span>
        <span class="sm-name">${_smEsc_(s.name)}</span>
        ${badge}
        <div class="sm-actions">
          ${typeBtn}
          <button class="sm-btn-del" onclick="SubjectMgr.deleteSubject(${i})">🗑</button>
        </div>
      </div>`;
    }).join('');

    // แสดง hint เลขต่อเนื่องของชั้น
    const hint = $('smSeqHint');
    if (hint) {
      if (seqNums) {
        const seqSubjects = this.subjects.filter(s => s.isSeq);
        hint.style.display = '';
        hint.innerHTML = `🔢 ชั้น <b>${this.cls}</b> — วิชาต่อเนื่อง: เทอม 1 ใช้เลข <b>${seqNums.t1}</b>, เทอม 2 ใช้เลข <b>${seqNums.t2}</b>` +
          (seqSubjects.length ? ` &nbsp;|&nbsp; มีวิชาต่อเนื่อง ${seqSubjects.length} วิชา` : '');
      } else {
        hint.style.display = 'none';
      }
    }

    this._initDrag(box);
    this._updateDirtyUI();
  },

  // ── toggle isSeq ──
  toggleSeq(idx) {
    const s      = this.subjects[idx];
    const seqNums = CLASS_SEQ_NUMS[this.cls];
    if (!seqNums) return Utils.toast('ชั้นนี้ไม่รองรับวิชาต่อเนื่อง', 'error');

    if (s.isSeq) {
      if (!confirm(`เปลี่ยน "${s.name}" เป็นวิชาทั่วไป?\n(จะไม่มีเลขต่อเนื่องในปพ.5/ปพ.6)`)) return;
    } else {
      if (!confirm(
        `ตั้ง "${s.name}" เป็นวิชาต่อเนื่อง?\n\n` +
        `ปพ.6 เทอม 1 → "${s.name} ${seqNums.t1}"\n` +
        `ปพ.6 เทอม 2 → "${s.name} ${seqNums.t2}"`
      )) return;
    }
    this.subjects[idx] = { ...s, isSeq: !s.isSeq };
    this.dirty = true;
    this.render();
  },

  // ── ลบวิชา ──
  deleteSubject(idx) {
    const s = this.subjects[idx];
    if (!confirm(`ลบวิชา "${s.name}" ออกจากชั้น ${this.cls}?\n\n⚠️ ชีตในไฟล์คะแนนจะถูกลบด้วยเมื่อกดบันทึก`)) return;
    this.subjects.splice(idx, 1);
    this.dirty = true;
    this.render();
  },

  // ── เพิ่มวิชาใหม่ ──
  addSubject() {
    const nameEl = $('smNewName');
    if (!nameEl) return;
    const name = nameEl.value.trim().replace(/\s+\d+\s*$/, '').trim();
    if (!name)            return Utils.toast('กรุณากรอกชื่อวิชา', 'error');
    if (name.length > 80) return Utils.toast('ชื่อวิชายาวเกินไป', 'error');
    if (this.subjects.find(s => s.name === name)) return Utils.toast(`วิชา "${name}" มีอยู่แล้ว`, 'error');
    this.subjects.push({ name, isSeq: false });
    nameEl.value = '';
    this.dirty   = true;
    this.render();
    Utils.toast(`✅ เพิ่ม "${name}" แล้ว`);
  },

  // ── บันทึก ──
  async save() {
    if (!this.dirty) return Utils.toast('ยังไม่มีการเปลี่ยนแปลง');

    const year = ($('smYear') ? $('smYear').value : '').trim();
    if (!year || Number(year) < 2560) return Utils.toast('กรุณาระบุปีการศึกษาที่ถูกต้อง', 'error');

    const seqNums   = CLASS_SEQ_NUMS[this.cls] || null;
    const seqSubjects = this.subjects.filter(s => s.isSeq).map(s => s.name);
    const subjectNames = this.subjects.map(s => s.name);

    if (!confirm(
      `บันทึกรายวิชาของ "${this.cls}" ปี ${year}?\n\n` +
      `${subjectNames.length} วิชา:\n` +
      `${this.subjects.map((s, i) => {
        const seq = s.isSeq && seqNums ? ` [ต่อเนื่อง เทอม1=${seqNums.t1}/เทอม2=${seqNums.t2}]` : '';
        return `  ${i + 1}. ${s.name}${seq}`;
      }).join('\n')}\n\n` +
      `⚠️ วิชาใหม่ → สร้างชีต  |  วิชาที่ลบ → ลบชีต (ข้อมูลหาย)`
    )) return;

    Utils.showLoading('กำลังบันทึกและ sync ชีต...');
    try {
      const result = await api('saveSubjectsTemplate', {
        classroom:    this.cls,
        subjects:     subjectNames,
        seqSubjects:  seqSubjects, // รายชื่อวิชาที่เป็น sequence
        year:         year
      });

      // อัปเดต App.subs ในหน่วยความจำ
      if (!App.subs) App.subs = {};
      App.subs[this.cls] = [...subjectNames];

      this.dirty = false;
      this._updateDirtyUI();
      Utils.toast(`✅ ${result}`);
    } catch(e) {
      Utils.toast(e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
    Utils.hideLoading();
  },

  // ── อัปเดตสไตล์ปุ่มบันทึก ──
  _updateDirtyUI() {
    const btn = $('smSaveBtn');
    if (!btn) return;
    if (this.dirty) {
      btn.style.opacity    = '1';
      btn.textContent      = '💾 บันทึกการเปลี่ยนแปลง *';
      btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
      btn.style.boxShadow  = '0 4px 12px rgba(22,163,74,.3)';
    } else {
      btn.style.opacity    = '0.5';
      btn.textContent      = '💾 บันทึก';
      btn.style.boxShadow  = 'none';
    }
  },

  // ── Drag-and-Drop ──
  _initDrag(container) {
    let dragging = null;
    container.querySelectorAll('.sm-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragging = row; e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { row.style.opacity='0.35'; row.style.transform='scale(.98)'; }, 0);
      });
      row.addEventListener('dragend', () => {
        row.style.opacity='1'; row.style.transform=''; dragging=null;
        const newOrder = [...container.querySelectorAll('.sm-row')]
          .map(r => parseInt(r.dataset.idx)).filter(n => !isNaN(n));
        if (newOrder.length === this.subjects.length) {
          this.subjects = newOrder.map(i => this.subjects[i]);
          this.dirty = true; this.render();
        }
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragging || dragging===row) return;
        const rect = row.getBoundingClientRect();
        container.insertBefore(dragging, e.clientY < rect.top+rect.height/2 ? row : row.nextSibling);
      });
      row.addEventListener('dragenter', e => e.preventDefault());
    });
  }
};

// ── Auto-detect วิชาต่อเนื่องจากรายชื่อดิบ + ชั้น ──────
// ถ้า App.subs ยังมีเลขท้าย (ข้อมูลเก่า) → detect จากเลขที่ตรงกับ CLASS_SEQ_NUMS ของชั้น
function _smDetectSeq_(rawList, cls) {
  const seqNums = CLASS_SEQ_NUMS[cls];
  const result  = [];
  const seen    = new Set();

  for (const raw of rawList) {
    const name = String(raw).trim();
    // มีเลขท้าย?
    const m = name.match(/^(.+?)\s+(\d+)\s*$/);
    if (m) {
      const base = m[1].trim(), num = parseInt(m[2]);
      if (seen.has(base)) continue; // de-duplicate
      // ตรวจว่าเลขนี้ตรงกับ seqNums ของชั้นหรือไม่
      const isSeq = seqNums && (num === seqNums.t1 || num === seqNums.t2);
      seen.add(base);
      result.push({ name: base, isSeq: !!isSeq });
    } else {
      if (seen.has(name)) continue;
      seen.add(name);
      result.push({ name, isSeq: false });
    }
  }
  return result;
}

// ── helpers ──
function _smEsc_(s)        { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toggleSubjectManager() { const p=$('smPanel'); if(!p) return; const o=p.style.display!=='none'; p.style.display=o?'none':'block'; if(!o) SubjectMgr.init(); }
function smChangeClass(cls) { SubjectMgr.loadClass(cls); }
