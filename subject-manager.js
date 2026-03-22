// =====================================================
// subject-manager.js — จัดการรายวิชาแต่ละชั้นเรียน (Admin)
// =====================================================
// ทุกวิชามี 1 ชีต กรอกได้ทั้งเทอม 1 และ 2
//
// วิชาต่อเนื่อง (seqNums):
//   - ชีตชื่อ "เทคโนโลยี" (ไม่มีเลขท้าย)
//   - เก็บ seqNums: { t1: 5, t2: 6 } ใน __CONFIG__
//   - ปพ.5/ปพ.6 เทอม 1 → แสดง "เทคโนโลยี 5"
//   - ปพ.5/ปพ.6 เทอม 2 → แสดง "เทคโนโลยี 6"
//   - วิชาทั่วไปไม่มี seqNums → แสดงชื่อเดิม
// =====================================================

const SubjectMgr = {
  cls:      '',
  subjects: [],   // [{ name, seqNums }]
                  //   seqNums = null (วิชาทั่วไป)
                  //   seqNums = { t1: 5, t2: 6 } (วิชาต่อเนื่อง)
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
  // Auto-detect วิชาต่อเนื่อง: ชื่อที่มีเลขท้ายคู่ต่อเนื่องกัน
  // เช่น "เทคโนโลยี 5","เทคโนโลยี 6" → { name:"เทคโนโลยี", seqNums:{t1:5,t2:6} }
  loadClass(cls) {
    this.cls   = cls;
    this.dirty = false;
    const raw  = (App.subs && App.subs[cls]) ? [...App.subs[cls]] : [];
    this.subjects = _smDetectSeq_(raw);
    this.render();
  },

  // ── Render ──
  render() {
    const box = $('smSubjectList');
    if (!box) return;

    if (!this.subjects.length) {
      box.innerHTML = `<div class="text-center text-muted py-4" style="font-size:.85rem;">ยังไม่มีวิชาในชั้นนี้</div>`;
      this._updateDirtyUI();
      return;
    }

    box.innerHTML = this.subjects.map((s, i) => {
      const isSeq  = !!s.seqNums;
      const badge  = isSeq
        ? `<span class="sm-badge seq" title="เทอม 1 = ${s.name} ${s.seqNums.t1} / เทอม 2 = ${s.name} ${s.seqNums.t2}">
             🔢 ${s.seqNums.t1}/${s.seqNums.t2}
           </span>`
        : '';
      return `<div class="sm-row" draggable="true" data-idx="${i}">
        <span class="sm-drag" title="ลากเพื่อเรียงลำดับ">⠿</span>
        <span class="sm-num">${i + 1}</span>
        <span class="sm-name">${_smEsc_(s.name)}</span>
        ${badge}
        <div class="sm-actions">
          ${isSeq
            ? `<button class="sm-btn-seq" onclick="SubjectMgr.editSeq(${i})" title="แก้ไขเลขต่อเนื่อง">✏️ เลข ${s.seqNums.t1}/${s.seqNums.t2}</button>
               <button class="sm-btn-type" onclick="SubjectMgr.removeSeq(${i})" title="เปลี่ยนเป็นวิชาทั่วไป">↩ ทั่วไป</button>`
            : `<button class="sm-btn-type" onclick="SubjectMgr.addSeq(${i})" title="ตั้งเป็นวิชาต่อเนื่อง">↪ ต่อเนื่อง</button>`}
          <button class="sm-btn-del" onclick="SubjectMgr.deleteSubject(${i})">🗑</button>
        </div>
      </div>`;
    }).join('');

    this._initDrag(box);
    this._updateDirtyUI();
  },

  // ── กำหนดเลขต่อเนื่องให้วิชา ──
  addSeq(idx) {
    const s    = this.subjects[idx];
    const inp  = prompt(
      `กำหนดเลขต่อเนื่องสำหรับ "${s.name}"\n\n` +
      `รูปแบบ: เลขเทอม1/เลขเทอม2  เช่น 5/6 หรือ 1/2\n` +
      `(เลขคี่=เทอม 1, เลขคู่=เทอม 2)`,
      _smDefaultSeqNums_(this.cls, s.name)
    );
    if (!inp) return;
    const nums = _smParseSeqInput_(inp);
    if (!nums) return Utils.toast('รูปแบบไม่ถูกต้อง ใช้ เช่น 5/6', 'error');
    this.subjects[idx] = { ...s, seqNums: nums };
    this.dirty = true;
    this.render();
    Utils.toast(`✅ "${s.name}" เทอม 1 = ${nums.t1}, เทอม 2 = ${nums.t2}`);
  },

  // ── แก้ไขเลขต่อเนื่อง ──
  editSeq(idx) {
    const s   = this.subjects[idx];
    const cur = `${s.seqNums.t1}/${s.seqNums.t2}`;
    const inp = prompt(`แก้ไขเลขต่อเนื่องของ "${s.name}" (ปัจจุบัน: ${cur})`, cur);
    if (!inp) return;
    const nums = _smParseSeqInput_(inp);
    if (!nums) return Utils.toast('รูปแบบไม่ถูกต้อง ใช้ เช่น 5/6', 'error');
    this.subjects[idx] = { ...s, seqNums: nums };
    this.dirty = true;
    this.render();
  },

  // ── เอาเลขต่อเนื่องออก ──
  removeSeq(idx) {
    const s = this.subjects[idx];
    if (!confirm(`เปลี่ยน "${s.name}" เป็นวิชาทั่วไป (ไม่มีเลขต่อเนื่อง)?`)) return;
    this.subjects[idx] = { name: s.name, seqNums: null };
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
    // ตัดเลขท้ายออกเสมอ (ชีตใช้ชื่อ base)
    const name = nameEl.value.trim().replace(/\s+\d+\s*$/, '').trim();
    if (!name)           return Utils.toast('กรุณากรอกชื่อวิชา', 'error');
    if (name.length > 80) return Utils.toast('ชื่อวิชายาวเกินไป', 'error');
    if (this.subjects.find(s => s.name === name)) return Utils.toast(`วิชา "${name}" มีอยู่แล้ว`, 'error');
    this.subjects.push({ name, seqNums: null });
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

    const subjectNames = this.subjects.map(s => s.name);
    // seqMap: { "เทคโนโลยี": { t1: 5, t2: 6 }, ... }
    const seqMap = {};
    this.subjects.forEach(s => { if (s.seqNums) seqMap[s.name] = s.seqNums; });

    if (!confirm(
      `บันทึกรายวิชาของ "${this.cls}" ปี ${year}?\n\n` +
      `${subjectNames.length} วิชา:\n` +
      `${this.subjects.map((s, i) => {
        const seq = s.seqNums ? ` [ต่อเนื่อง ${s.seqNums.t1}/${s.seqNums.t2}]` : '';
        return `  ${i + 1}. ${s.name}${seq}`;
      }).join('\n')}\n\n` +
      `⚠️ วิชาใหม่ → สร้างชีตในไฟล์คะแนน\n` +
      `⚠️ วิชาที่ลบ → ลบชีต (ข้อมูลหาย)`
    )) return;

    Utils.showLoading('กำลังบันทึกและ sync ชีต...');
    try {
      const result = await api('saveSubjectsTemplate', {
        classroom: this.cls,
        subjects:  subjectNames,
        seqMap:    seqMap,
        year:      year
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

// ── Auto-detect วิชาต่อเนื่องจากรายชื่อดิบ ──
// เช่น ["เทคโนโลยี 5","เทคโนโลยี 6"] → [{ name:"เทคโนโลยี", seqNums:{t1:5,t2:6} }]
function _smDetectSeq_(rawList) {
  const result  = [];
  const seen    = new Set();
  // จัดกลุ่มตาม base name
  const groups  = {}; // { base: [{ name, num }] }
  for (const raw of rawList) {
    const name = String(raw).trim();
    const m    = name.match(/^(.+?)\s+(\d+)\s*$/);
    if (m) {
      const base = m[1].trim(), num = parseInt(m[2]);
      if (!groups[base]) groups[base] = [];
      groups[base].push({ name, num });
    } else {
      // วิชาไม่มีเลข
      if (!seen.has(name)) { seen.add(name); result.push({ name, seqNums: null }); }
    }
  }
  // แปลง groups → วิชาต่อเนื่อง
  // ถ้ามีแค่ 1 ตัว (เลขเดียว) → treat เป็นวิชาทั่วไป base
  for (const [base, items] of Object.entries(groups)) {
    if (seen.has(base)) continue;
    seen.add(base);
    if (items.length >= 2) {
      // หาเลขคี่ (t1) และเลขคู่ (t2)
      const odd  = items.find(x => x.num % 2 === 1);
      const even = items.find(x => x.num % 2 === 0);
      if (odd && even) {
        result.push({ name: base, seqNums: { t1: odd.num, t2: even.num } });
        continue;
      }
    }
    // fallback: วิชาทั่วไปชื่อ base
    result.push({ name: base, seqNums: null });
  }
  return result;
}

// ── แนะนำเลขเริ่มต้นตามชั้น ──
function _smDefaultSeqNums_(cls, subjectName) {
  // ม.1→1/2, ม.2→3/4, ม.3→5/6 (default pattern)
  const classMap = { 'ม.1':'1/2', 'ม.2':'3/4', 'ม.3':'5/6' };
  return classMap[cls] || '1/2';
}

// ── parse input "5/6" หรือ "5, 6" หรือ "5 6" ──
function _smParseSeqInput_(inp) {
  const m = String(inp).match(/(\d+)\s*[\/,\s]\s*(\d+)/);
  if (!m) return null;
  const t1 = parseInt(m[1]), t2 = parseInt(m[2]);
  if (isNaN(t1) || isNaN(t2) || t1 < 1 || t2 < 1) return null;
  return { t1, t2 };
}

// ── helpers ──
function _smEsc_(s)        { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toggleSubjectManager() { const p=$('smPanel'); if(!p) return; const o=p.style.display!=='none'; p.style.display=o?'none':'block'; if(!o) SubjectMgr.init(); }
function smChangeClass(cls) { SubjectMgr.loadClass(cls); }
