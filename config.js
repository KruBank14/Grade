// =====================================================
// config.js — CONFIG + STATE + API (JSONP for GAS)
// ใช้คู่กับ Code.gs เวอร์ชัน doGet(action, callback, data)
// =====================================================

const CONFIG = {
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbwCVLa6GF1AvlhN79wiO6FsUpmbYLxWPH4_Ltf1aHJ4wO6QB-tHMZMYWGkTqUhhklFtSw/exec",
  ALL_CLS: [
    "ป.1","ป.2","ป.3","ป.4","ป.5","ป.6",
    "ม.1","ม.2","ม.3"
  ],
  JSONP_TIMEOUT: 25000
};

const App = {
  isSemMode: false,
  user: null,
  pin: "",
  subs: {},
  students: [],
  units: { 1: [], 2: [] },
  expanded: { 1: true, 2: true },
  editTid: null,
  editAssigned: [],
  ignoreR: false,
  termDates: {},
  holidays: [],
  schoolProfile: {
    school_name: "",
    director_name: "",
    director_position: "ผู้อำนวยการโรงเรียน",
    academic_head_name: "",
    academic_head_position: "หัวหน้าวิชาการ"
  }
};

// =====================================================
// DOM HELPERS
// =====================================================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// =====================================================
// UTILS
// =====================================================
const Utils = {
  toast: (msg, type = "success") => {
    const shelf = $("tshelf");
    if (!shelf) {
      console.log(`[${type}] ${msg}`);
      return;
    }

    const d = document.createElement("div");
    d.className = `tst ${type}`;
    d.textContent = msg;
    shelf.appendChild(d);
    setTimeout(() => d.remove(), 3000);
  },

  showLoading: (text = "...") => {
    if ($("pgov")) $("pgov").style.display = "flex";
    if ($("pgTxt")) $("pgTxt").textContent = text;
  },

  hideLoading: () => {
    if ($("pgov")) $("pgov").style.display = "none";
  },

  showPage: (id) => {
    $$(".pg").forEach(p => p.classList.remove("on"));
    const page = $(id);
    if (page) page.classList.add("on");

    const tabsWrap = $("settingsTabsWrap");
    if (tabsWrap) {
      tabsWrap.classList.toggle("is-visible", id === "gradePage");
    }

    window.scrollTo(0, 0);
  },

  calcGradeFrontend: (score) => {
    const s = Number(score) || 0;
    if (s >= 80) return "4";
    if (s >= 75) return "3.5";
    if (s >= 70) return "3";
    if (s >= 65) return "2.5";
    if (s >= 60) return "2";
    if (s >= 55) return "1.5";
    if (s >= 50) return "1";
    return "0";
  }
};

// =====================================================
// API (JSONP)
// รองรับ GitHub Pages -> Google Apps Script โดยไม่ติด CORS
// GET:
// ?action=login&callback=cb123&data={"password":"1234"}
// =====================================================
function api(action, data = {}) {
  const usePostActions = new Set([
    'saveGrades',
    'saveHolistic',
    'saveRTW',
    'saveGuidance',
    'saveScout',
    'saveTeacherAssignments',
    'saveSchoolProfile',
    'setupGradeYear',
    'saveSubjectsTemplate'
  ]);

  // ===== POST JSON =====
  if (usePostActions.has(String(action))) {
    return fetch(CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: String(action || ''),
        data: data || {}
      })
    })
    .then(async res => {
      const text = await res.text();
      let json = null;

      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error('เซิร์ฟเวอร์ส่งข้อมูลไม่ถูกต้อง');
      }

      if (!json) {
        throw new Error('ไม่พบข้อมูลตอบกลับจากเซิร์ฟเวอร์');
      }

      if (json.status === 'error') {
        throw new Error(json.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
      }

      if (json.status === 'success') {
        return json.data;
      }

      return json;
    })
    .catch(err => {
      throw new Error(err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    });
  }

  // ===== JSONP GET =====
  return new Promise((resolve, reject) => {
    if (!CONFIG.WEB_APP_URL || CONFIG.WEB_APP_URL.includes("PASTE_YOUR_LATEST_WEB_APP_URL_HERE")) {
      reject(new Error("ยังไม่ได้ใส่ WEB_APP_URL ล่าสุดใน config.js"));
      return;
    }

    const cbName = "__jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const script = document.createElement("script");
    let done = false;
    let timer = null;

    const cleanup = () => {
      done = true;
      if (timer) clearTimeout(timer);
      try {
        delete window[cbName];
      } catch (_) {
        window[cbName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[cbName] = (res) => {
      if (done) return;
      cleanup();

      if (!res) {
        reject(new Error("ไม่พบข้อมูลตอบกลับจากเซิร์ฟเวอร์"));
        return;
      }

      if (res.status === "error") {
        reject(new Error(res.message || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์"));
        return;
      }

      if (res.status === "success") {
        resolve(res.data);
        return;
      }

      resolve(res);
    };

    timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error("หมดเวลาการเชื่อมต่อเซิร์ฟเวอร์"));
    }, CONFIG.JSONP_TIMEOUT);

    const params = new URLSearchParams({
      action: String(action || ""),
      callback: cbName,
      data: JSON.stringify(data || {})
    });

    script.src = `${CONFIG.WEB_APP_URL}?${params.toString()}`;
    script.async = true;

    script.onerror = () => {
      if (done) return;
      cleanup();
      reject(new Error("โหลดสคริปต์จากเซิร์ฟเวอร์ไม่ได้"));
    };

    document.body.appendChild(script);
  });
}
