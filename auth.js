// =====================================================
// auth.js — AUTH & LOGIN (ระบบเข้าสู่ระบบด้วย PIN)
// =====================================================

function updDots(err = false) {
  $$(".dot").forEach((d, i) => {
    d.className = "dot" + (err ? " err" : (i < App.pin.length ? " on" : ""));
  });
}

function ap(n) {
  if (App.pin.length < 4) {
    App.pin += String(n);
    updDots();

    if (App.pin.length === 4) {
      setTimeout(doLogin, 150);
    }
  }
}

function dp() {
  App.pin = App.pin.slice(0, -1);
  updDots();
}

function cp() {
  App.pin = "";
  updDots();
}

async function doLogin() {
  Utils.showLoading("กำลังโหลด...");

  try {
    const [u, subs] = await Promise.all([
      api("login", { password: App.pin }),
      api("getAllSubjects", {})
    ]);

    App.user = u || {};

    // แยก seqSubjects ออกจาก subs
    // GAS ส่งมาเป็น key "__seq__ม.1": ["เทคโนโลยี", ...]
    App.subs = {};
    App.seqSubjects = {};
    const rawSubs = subs || {};
    for (const [key, val] of Object.entries(rawSubs)) {
      if (key.startsWith('__seq__')) {
        const cls = key.replace('__seq__', '');
        App.seqSubjects[cls] = val;
      } else {
        App.subs[key] = val;
      }
    }

    if ($("teacherTag")) {
      $("teacherTag").textContent = `🎓 ${App.user.name || ""}`;
      $("teacherTag").style.display = "flex";
    }

    ["btnGrade", "btnOut"].forEach(id => {
      if ($(id)) $(id).style.display = "inline-flex";
    });

    if (App.user.isAdmin) {
      if ($("btnAdmin")) $("btnAdmin").style.display = "inline-flex";

      if (typeof loadTeachers === "function") {
        await loadTeachers();
      }

      Utils.showPage("adminPage");
    } else {
      App.user.mySubjects = App.user.subjects
        ? String(App.user.subjects).split(",").filter(Boolean)
        : [];

      const cls = [...new Set(
        App.user.mySubjects
          .map(s => String(s).split("_")[0])
          .filter(Boolean)
      )];

      App.user.allowedClasses = cls;

      const sel = $("gClass");
      if (sel) {
        sel.innerHTML = cls.length
          ? cls.map(c => `<option value="${c}">${c}</option>`).join("")
          : `<option value="">ไม่มีสิทธิ์</option>`;

        if (cls.includes(App.user.classroom)) {
          sel.value = App.user.classroom;
        }
      }

      App.gradeTerm = 1; // default เทอม 1
      if (typeof switchGradeTerm === "function") {
        switchGradeTerm(1);
      } else if (typeof updateSubjDrop === "function") {
        updateSubjDrop();
      }

      Utils.showPage("gradePage");
    }

    cp();
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    updDots(true);
    setTimeout(cp, 500);
    Utils.toast(e.message || "เข้าสู่ระบบไม่สำเร็จ", "error");
  }

  Utils.hideLoading();
}

function logout() {
  App.user = null;
  App.subs = {};
  App.students = [];
  cp();

  ["teacherTag", "btnAdmin", "btnGrade", "btnOut"].forEach(id => {
    if ($(id)) $(id).style.display = "none";
  });

  if ($("settingsTabsWrap")) {
    $("settingsTabsWrap").classList.remove("is-visible");
  }

  Utils.showPage("loginPage");
}