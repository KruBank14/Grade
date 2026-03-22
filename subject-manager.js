// =====================================================
// subject-manager.js — จัดการรายวิชาแต่ละชั้นเรียน (Admin)
// =====================================================
// ประเภทวิชา:
//   "yearly"   = วิชาทั้งปี (ไม่มีเลขท้าย) → แสดงทั้ง 2 เทอม
//   "sequence" = วิชาต่อเนื่อง (มีเลขท้าย คี่=เทอม1, คู่=เทอม2)
// =====================================================

const SubjectMgr = {
  cls: '',        // ชั้นที่กำลังแก้ไข
  subjects: [],   // [{ name, type }]  type = 'yearly' | 'sequence'
  dirty: false,

  // ── เริ่มต้น: render dropdown ชั้น ──
  init() {
    const sel = $('smClassSel');
    if (!sel) return;
    sel.innerHTML = CONFIG.ALL_CLS.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.value = CONFIG.ALL_CLS[0];
    this.loadClass(CONFIG.ALL_CLS[0]);
  },

  // ── โหลดวิชาจาก App.subs ──
  loadClass(cls) {
    this.cls = cls;
    this.dirty = false;
    const raw = (App.subs && App.subs[cls]) ? [...App.subs[cls]] : [];
    this.subjects = raw.map(name => ({
      name: String(name).trim(),
      type: _smHasSeqNum_(name) ? 'sequence' : 'yearly'
    }));
    this.render();
  },

  // ── Render รายการวิชาทั้งหมด ──
  render() {
    const box = $('smSubjectList');
    if (!box) return;

    if (!this.subjects.length) {
      box.innerHTML = `<div class="text-center text-muted py-4" style="font-size:.85rem;">ยังไม่มีวิชาในชั้นนี้</div>`;
      this._updateDirtyUI();
      return;
    }

    box.innerHTML = this.subjects.map((s, i) => {
      const isSeq  = s.type === 'sequence';
      const badge  = isSeq
        ? `<span class="sm-badge seq">🔢 ต่อเนื่อง</span>`
        : `<span class="sm-badge year">📅 ทั้งปี</span>`;
      const hint = isSeq
        ? `<span class="sm-hint">${_smTermHint_(s.name)}</span>`
        : `<span class="sm-hint">แสดงทุกเทอม</span>`;

      return `<div class="sm-row" draggable="true" data-idx="${i}">
        <span class="sm-drag" title="ลากเพื่อเรียงลำดับ">⠿</span>
        <span class="sm-num">${i + 1}</span>
        <span class="sm-name">${_smEsc_(s.name)}</span>
        ${badge}
        ${hint}
        <div class="sm-actions">
          <button class="sm-btn-type" title="สลับประเภท" onclick="SubjectMgr.toggleType(${i})">
            ${isSeq ? '↩ เปลี่ยนเป็นทั้งปี' : '↪ เปลี่ยนเป็นต่อเนื่อง'}
          </button>
          <button class="sm-btn-del" title="ลบวิชา" onclick="SubjectMgr.deleteSubject(${i})">🗑</button>
        </div>
      </div>`;
    }).join('');

    this._initDrag(box);
    this._updateDirtyUI();
  },

  // ── สลับประเภทวิชา (yearly ↔ sequence) ──
  toggleType(idx) {
    const s = this.subjects[idx];
    if (!s) return;

    if (s.type === 'yearly') {
      // yearly → sequence: สร้าง 2 วิชา (คี่ + คู่)
      const base = s.name.replace(/\s+\d+$/, '').trim();
      const next = this._nextSeqNum(base);
      const odd  = next % 2 === 0 ? next - 1 : next;
      const startInput = prompt(
        `เปลี่ยน "${s.name}" เป็นวิชาต่อเนื่อง\n\n` +
        `ระบบจะสร้าง 2 วิชา:\n` +
        `  • ${base} [เลขคี่]  → เทอม 1\n` +
        `  • ${base} [เลขคู่]  → เทอม 2\n\n` +
        `กรอกเลขเริ่มต้น (แนะนำ: ${odd}):`,
        String(odd)
      );
      if (startInput === null) return;
      const n = parseInt(startInput);
      if (isNaN(n) || n < 1) return Utils.toast('เลขไม่ถูกต้อง', 'error');
      const o = n % 2 === 0 ? n - 1 : n;
      this.subjects.splice(idx, 1,
        { name: `${base} ${o}`,     type: 'sequence' },
        { name: `${base} ${o + 1}`, type: 'sequence' }
      );

    } else {
      // sequence → yearly: ตัดเลขท้ายออก
      const base = s.name.replace(/\s+\d+$/, '').trim();
      // หาวิชาคู่ที่มี base name เดียวกัน
      const pairIdx = this.subjects.findIndex((x, xi) =>
        xi !== idx &&
        x.type === 'sequence' &&
        x.name.replace(/\s+\d+$/, '').trim() === base
      );

      let msg = `เปลี่ยน "${s.name}" เป็นวิชาทั้งปี "${base}"?\n(เลขท้ายจะถูกตัดออก)`;
      if (pairIdx !== -1) {
        msg += `\n\nพบวิชาคู่ "${this.subjects[pairIdx].name}" ด้วย → จะรวมเป็นวิชาเดียวกัน`;
      }
      if (!confirm(msg)) return;

      if (pairIdx !== -1) {
        // ลบทั้งคู่แล้วใส่วิชาเดียว
        const minIdx = Math.min(idx, pairIdx);
        const maxIdx = Math.max(idx, pairIdx);
        this.subjects.splice(maxIdx, 1);
        this.subjects.splice(minIdx, 1, { name: base, type: 'yearly' });
      } else {
        this.subjects[idx] = { name: base, type: 'yearly' };
      }
    }

    this.dirty = true;
    this.render();
  },

  // ── ลบวิชา ──
  deleteSubject(idx) {
    const s = this.subjects[idx];
    if (!s) return;
    if (!confirm(`ลบวิชา "${s.name}" ออกจากชั้น ${this.cls}?`)) return;
    this.subjects.splice(idx, 1);
    this.dirty = true;
    this.render();
  },

  // ── เพิ่มวิชาใหม่ ──
  addSubject() {
    const nameEl = $('smNewName');
    const typeEl = $('smNewType');
    if (!nameEl || !typeEl) return;

    const name = nameEl.value.trim();
    const type = typeEl.value;

    if (!name) return Utils.toast('กรุณากรอกชื่อวิชา', 'error');
    if (name.length > 80) return Utils.toast('ชื่อวิชายาวเกินไป', 'error');

    if (type === 'sequence') {
      const base = name.replace(/\s+\d+$/, '').trim();
      const next = this._nextSeqNum(base);
      const odd  = next % 2 === 0 ? next - 1 : next;
      const startInput = prompt(
        `วิชาต่อเนื่อง "${base}"\n\n` +
        `ระบบจะสร้าง:\n` +
        `  • ${base} [เลขคี่]  → เทอม 1\n` +
        `  • ${base} [เลขคู่]  → เทอม 2\n\n` +
        `กรอกเลขเริ่มต้น (แนะนำ: ${odd}):`,
        String(odd)
      );
      if (startInput === null) return;
      const n = parseInt(startInput);
      if (isNaN(n) || n < 1) return Utils.toast('เลขไม่ถูกต้อง', 'error');
      const o = n % 2 === 0 ? n - 1 : n;
      this.subjects.push({ name: `${base} ${o}`,     type: 'sequence' });
      this.subjects.push({ name: `${base} ${o + 1}`, type: 'sequence' });
      Utils.toast(`✅ เพิ่ม "${base} ${o}" และ "${base} ${o + 1}" แล้ว`);
    } else {
      if (this.subjects.find(s => s.name === name)) {
        return Utils.toast(`วิชา "${name}" มีอยู่แล้ว`, 'error');
      }
      this.subjects.push({ name, type: 'yearly' });
      Utils.toast(`✅ เพิ่ม "${name}" แล้ว`);
    }

    nameEl.value = '';
    this.dirty = true;
    this.render();
  },

  // ── บันทึกไปที่ server ──
  async save() {
    if (!this.dirty) return Utils.toast('ยังไม่มีการเปลี่ยนแปลง');
    const count = this.subjects.length;
    if (!confirm(`บันทึกรายวิชาของ "${this.cls}" ใหม่?\n\nจำนวน ${count} วิชา:\n${this.subjects.map((s,i) => `  ${i+1}. ${s.name}`).join('\n')}`)) return;

    Utils.showLoading('กำลังบันทึก...');
    try {
      const subjectNames = this.subjects.map(s => s.name);
      await api('saveSubjectsTemplate', { classroom: this.cls, subjects: subjectNames });

      // อัปเดต App.subs ในหน่วยความจำ
      if (!App.subs) App.subs = {};
      App.subs[this.cls] = [...subjectNames];

      this.dirty = false;
      this._updateDirtyUI();
      Utils.toast(`✅ บันทึกวิชาของ ${this.cls} สำเร็จ (${count} วิชา)`);
    } catch(e) {
      Utils.toast(e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
    Utils.hideLoading();
  },

  // ── หาเลขถัดไปสำหรับวิชาต่อเนื่อง ──
  _nextSeqNum(baseName) {
    const base = baseName.replace(/\s+\d+$/, '').trim();
    const nums = this.subjects
      .filter(s => s.type === 'sequence' && s.name.replace(/\s+\d+$/, '').trim() === base)
      .map(s => parseInt(s.name.match(/(\d+)$/)?.[1] || '0'))
      .filter(n => !isNaN(n) && n > 0);
    if (!nums.length) return 1;
    const max = Math.max(...nums);
    // หาเลขคี่ถัดไปหลัง max
    return max % 2 === 0 ? max + 1 : max + 2;
  },

  // ── อัปเดตปุ่มบันทึก ──
  _updateDirtyUI() {
    const btn = $('smSaveBtn');
    if (!btn) return;
    if (this.dirty) {
      btn.style.opacity = '1';
      btn.textContent = '💾 บันทึกการเปลี่ยนแปลง *';
      btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
      btn.style.boxShadow = '0 4px 12px rgba(22,163,74,.3)';
    } else {
      btn.style.opacity = '0.5';
      btn.textContent = '💾 บันทึก';
      btn.style.boxShadow = 'none';
    }
  },

  // ── Drag-and-Drop เรียงลำดับ ──
  _initDrag(container) {
    let dragging = null;

    container.querySelectorAll('.sm-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragging = row;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { row.style.opacity = '0.35'; row.style.transform = 'scale(.98)'; }, 0);
      });

      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        row.style.transform = '';
        dragging = null;
        // อ่านลำดับใหม่จาก DOM
        const newOrder = [...container.querySelectorAll('.sm-row')]
          .map(r => parseInt(r.dataset.idx))
          .filter(n => !isNaN(n));
        if (newOrder.length === this.subjects.length) {
          const reordered = newOrder.map(i => this.subjects[i]);
          this.subjects = reordered;
          this.dirty = true;
          this.render();
        }
      });

      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragging || dragging === row) return;
        const rect = row.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        container.insertBefore(dragging, insertBefore ? row : row.nextSibling);
      });

      row.addEventListener('dragenter', e => { e.preventDefault(); });
    });
  }
};

// ── helper: ตรวจว่าชื่อวิชามีเลขท้ายหรือไม่ ──
function _smHasSeqNum_(name) {
  return /\s+\d+\s*$/.test(String(name || ''));
}

// ── helper: hint แสดงเทอม ──
function _smTermHint_(name) {
  const m = String(name || '').match(/(\d+)\s*$/);
  if (!m) return '';
  const n = parseInt(m[1]);
  return n % 2 === 1 ? '(เทอม 1)' : '(เทอม 2)';
}

// ── helper: escape HTML ──
function _smEsc_(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── เปิด/ปิด panel ──
function toggleSubjectManager() {
  const panel = $('smPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) SubjectMgr.init();
}

// ── เปลี่ยนชั้น ──
function smChangeClass(cls) {
  SubjectMgr.loadClass(cls);
}
