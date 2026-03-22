// NEW MODULE: การอ่าน คิดวิเคราะห์ และเขียน (RTW)
  // 2. ฟังก์ชันคำนวณคะแนนและตัดเกรด
// ฟังก์ชันคำนวณคะแนน RTW และเลื่อนเคอร์เซอร์อัตโนมัติ (แบบเลื่อนลง)
function calcRTWRow(input) {
  if (!input) return;
  const tr = input.closest('tr');
  const max = parseFloat(input.getAttribute('max'));
  if (parseFloat(input.value) > max) { input.value = max; Utils.toast(`คะแนนเต็ม ${max}`, 'warning'); }
  
  const getV = (sel) => parseFloat(tr.querySelector(sel).value) || 0;
  
  // รวมการอ่าน
  const r1 = getV('.rtw-r1-1') + getV('.rtw-r1-2');
  const r2 = getV('.rtw-r2-1') + getV('.rtw-r2-2');
  tr.querySelector('.rtw-r1-sum').textContent = r1;
  tr.querySelector('.rtw-r2-sum').textContent = r2;

  // รวมการคิด
  const c1 = getV('.rtw-c1-3') + getV('.rtw-c1-4');
  const c2 = getV('.rtw-c2-3') + getV('.rtw-c2-4');
  tr.querySelector('.rtw-c1-sum').textContent = c1;
  tr.querySelector('.rtw-c2-sum').textContent = c2;

  // การเขียน
  const w1 = getV('.rtw-w1-5'), w2 = getV('.rtw-w2-5');

  // รวมทั้งหมด
  const grandTotal = r1 + r2 + c1 + c2 + w1 + w2;
  tr.querySelector('.rtw-grand-total').textContent = grandTotal;

  // ตัดเกรด
  const gBadge = tr.querySelector('.rtw-grade');
  let level = "ไม่ผ่าน (0)", cls = "res-0";
  if (grandTotal >= 86) { level = "ดีเยี่ยม (3)"; cls = "res-3"; }
  else if (grandTotal >= 70) { level = "ดี (2)"; cls = "res-2"; }
  else if (grandTotal >= 50) { level = "ผ่าน (1)"; cls = "res-1"; }
  gBadge.textContent = level; gBadge.className = `res-badge rtw-grade ${cls}`;

  // เลื่อนลงอัตโนมัติ (Vertical Auto-tab)
  if (document.activeElement === input && input.value.length >= 1) {
    // กรณีคะแนนเต็มเป็นเลข 2 หลัก (เช่น 10, 15) ต้องเช็คให้พิมพ์ครบก่อน
    if (max >= 10 && input.value.length < 2 && input.value < (max/10)) return; 
    
    const nextTr = tr.nextElementSibling;
    if (nextTr) {
      const currentClass = Array.from(input.classList).find(c => c.startsWith('rtw-'));
      const nextInp = nextTr.querySelector('.' + currentClass);
      if (nextInp) { nextInp.focus(); nextInp.select(); }
    }
  }
}

// 3. ฟังก์ชันบันทึกข้อมูล
async function saveRTWData() {
  const records = [];
  $$('#rtwBody tr[data-rtwsid]').forEach(tr => {
    const getV = sel => parseFloat(tr.querySelector(sel)?.value) || 0;
    records.push({
      studentId : tr.getAttribute('data-rtwsid'),
      r1_1  : getV('.rtw-r1-1'),
      r1_2  : getV('.rtw-r1-2'),
      r2_1  : getV('.rtw-r2-1'),
      r2_2  : getV('.rtw-r2-2'),
      c1_3  : getV('.rtw-c1-3'),
      c1_4  : getV('.rtw-c1-4'),
      c2_3  : getV('.rtw-c2-3'),
      c2_4  : getV('.rtw-c2-4'),
      w1_5  : getV('.rtw-w1-5'),
      w2_5  : getV('.rtw-w2-5'),
      total : tr.querySelector('.rtw-grand-total')?.textContent || '0',
      grade : tr.querySelector('.rtw-grade')?.textContent || ''
    });
  });

  if (!records.length) return Utils.toast('ไม่พบข้อมูล', 'error');
  Utils.showLoading('กำลังบันทึก...');
  try {
    const res = await api('saveRTW', {
      year      : $('gYear').value,
      classroom : $('gClass').value,
      subject   : $('gSubj').value,
      records   : records
    });
    Utils.toast('✅ ' + res);
  } catch (e) { Utils.toast(e.message, 'error'); }
  Utils.hideLoading();
}

// 4. ฟังก์ชันพิมพ์รายงาน (PDF)
// ฟังก์ชันพิมพ์รายงาน RTW แบบละเอียด (แยกครั้ง + รวมรายด้าน)
// ฟังก์ชันพิมพ์รายงาน RTW ครบชุด 3 หน้า (ปก + ตารางแยกครั้ง + เกณฑ์)
// ฟังก์ชันพิมพ์รายงาน RTW ครบชุด (ปกสวยงาม + ตาราง + เกณฑ์)
// ฟังก์ชันพิมพ์รายงาน RTW ครบชุด (ดึงครูประจำชั้นจากแท็บ RTW)
function printRTWReport() {
  const cls = $('gClass').value;
  const subj = $('gSubj').value;
  const directorName = "นางสาวสู่ขวัญ ตลับนาค";
  const academicHead = $('sp_academic_head_name').value || '........................................................';

  // --- ดึงชื่อครูประจำชั้นจากช่องในแท็บนี้โดยตรง ---
  let rawTeacherName = $('rtw_homeroom_teacher').value.trim();
  if (!rawTeacherName) rawTeacherName = '........................................................';
  
  // แยกชื่อครูด้วยคำว่า "และ", "/", หรือ "," เพื่อสร้างช่องเซ็นชื่อ
  let teachers = rawTeacherName.split(/\s*(?:และ|\/|,)\s*/).filter(t => t);
  if (teachers.length === 0) teachers = ['........................................................'];
  const displayTeacherName = teachers.join(' และ '); // แสดงบรรทัดด้านบน

  // 1. ดึงข้อมูลและคำนวณคะแนน
  const rows = [...$$('#rtwBody tr[data-rtwsid]')].map((tr, i) => {
    const getV = (s) => parseFloat(tr.querySelector(s).value) || 0;
    const r1 = getV('.rtw-r1-1') + getV('.rtw-r1-2');
    const r2 = getV('.rtw-r2-1') + getV('.rtw-r2-2');
    const c1 = getV('.rtw-c1-3') + getV('.rtw-c1-4');
    const c2 = getV('.rtw-c2-3') + getV('.rtw-c2-4');
    const w1 = getV('.rtw-w1-5');
    const w2 = getV('.rtw-w2-5');

    return {
      no: i + 1, 
      name: tr.querySelector('.ass-name').textContent,
      r1, r2, r_total: r1 + r2,
      c1, c2, c_total: c1 + c2,
      w1, w2, w_total: w1 + w2,
      grand_total: tr.querySelector('.rtw-grand-total').textContent,
      grade: tr.querySelector('.rtw-grade').textContent
    };
  });

  if (!rows.length) return Utils.toast('ไม่พบข้อมูลนักเรียน', 'error');

  // 2. คำนวณสถิติ
  const getLvl = (score, max) => {
    const p = (score / max) * 100;
    if (p >= 86) return 'ex'; if (p >= 70) return 'g'; if (p >= 50) return 'p'; return 'i';
  };

  const stats = {
    r: { ex: 0, g: 0, p: 0, i: 0 },
    c: { ex: 0, g: 0, p: 0, i: 0 },
    w: { ex: 0, g: 0, p: 0, i: 0 }
  };

  rows.forEach(row => {
    stats.r[getLvl(row.r_total, 30)]++;
    stats.c[getLvl(row.c_total, 40)]++;
    stats.w[getLvl(row.w_total, 30)]++;
  });

  // 3. กำหนดตัวชี้วัดตามระดับชั้น
  let indicators = [];
  if (cls.match(/[ป].[1-3]/)) {
    indicators = ["1. อ่านและหาประสบการณ์จากสื่อที่หลากหลาย", "2. จับประเด็นสำคัญ ข้อเท็จจริง ความคิดเห็น", "3. เปรียบเทียบแง่มุมต่างๆ เช่น ข้อดี-เสีย ประโยชน์-โทษ", "4. แสดงความคิดเห็นต่อเรื่องที่อ่านอย่างมีเหตุผล", "5. ถ่ายทอดความรู้สึกจากเรื่องที่อ่านโดยการเขียน"];
  } else if (cls.match(/[ป].[4-6]/)) {
    indicators = ["1. อ่านเพื่อหาข้อมูลสารสนเทศเสริมประสบการณ์", "2. จับประเด็นสำคัญ เชื่อมโยงความเป็นเหตุเป็นผล", "3. เชื่อมโยงความสัมพันธ์ของเรื่องราวและเหตุการณ์", "4. แสดงความคิดเห็นต่อเรื่องที่อ่านโดยมีเหตุผลสนับสนุน", "5. ถ่ายทอดความเข้าใจ ความคิดเห็น คุณค่าโดยการเขียน"];
  } else {
    indicators = ["1. คัดสรรสื่อเพื่อหาข้อมูลสารสนเทศตามวัตถุประสงค์", "2. จับประเด็นสำคัญ ประเด็นสนับสนุน และโต้แย้ง", "3. วิเคราะห์ วิจารณ์ความสมเหตุสมผลน่าเชื่อถือ", "4. สรุปคุณค่า แนวคิด แง่คิดที่ได้จากการอ่าน", "5. สรุป อภิปราย ขยายความ แสดงความเห็นโต้แย้งโดยการเขียน"];
  }

  // 4. สร้างเอกสาร HTML
  const win = window.open('', '_blank');
  const html = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8">
      <title>รายงานประเมินการอ่านคิดวิเคราะห์และเขียน</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: 'Sarabun', sans-serif; font-size: 15px; line-height: 1.5; color: #000; margin: 0; }
        .page { page-break-after: always; min-height: 260mm; position: relative; padding: 10px 20px; }
        
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .fw-bold { font-weight: bold; }
        
        .cover-logo { width: 95px; height: auto; margin-bottom: 15px; }
        .cover-title { font-size: 22px; font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px; }
        .cover-school { font-size: 20px; font-weight: bold; margin-bottom: 20px; }
        .cover-divider { border-top: 1px dashed #666; width: 60%; margin: 0 auto 25px; }
        
        .info-row { font-size: 16px; margin-bottom: 12px; }
        .fill-line { display: inline-block; border-bottom: 1.5px dotted #000; padding: 0 15px; color: #1e3a8a; font-weight: bold; }
        
        .summary-table { width: 95%; margin: 25px auto; border-collapse: collapse; box-shadow: 0 0 0 1px #000; }
        .summary-table th, .summary-table td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 15px; }
        .summary-table th { background: #f8fafc; font-weight: bold; }
        
        .sign-flex { display: flex; justify-content: center; gap: 40px; margin-top: 20px; text-align: center; font-size: 15px; flex-wrap: wrap; }
        .sign-box { min-width: 250px; margin-bottom: 10px; }
        .sign-name { margin-top: 15px; }
        
        .approval-card { border: 2px solid #000; border-radius: 8px; width: 85%; margin: 30px auto 0; padding: 15px; text-align: center; }
        .check-box { display: inline-block; width: 14px; height: 14px; border: 1px solid #000; vertical-align: middle; margin-right: 8px; margin-top: -2px; }

        .score-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .score-table th, .score-table td { border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 12px; }
        .score-table th { background: #f2f2f2; font-size: 11px; }
        .score-table .col-name { text-align: left; padding-left: 5px; width: 160px; }
      </style>
    </head>
    <body>

      <!-- ================= หน้า 1: ปก ================= -->
      <div class="page">
        <div class="text-center">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/The_Emblem_of_the_Ministry_of_Education_of_Thailand.svg/1200px-The_Emblem_of_the_Ministry_of_Education_of_Thailand.svg.png" class="cover-logo"><br>
          <div class="cover-title">แบบบันทึกผลการประเมินการอ่าน คิดวิเคราะห์และเขียน</div>
          <div class="cover-school">โรงเรียนบ้านคลอง 14</div>
          <div class="cover-divider"></div>
          
          <div class="info-row">ชั้น <span class="fill-line" style="min-width: 250px;">${cls}</span></div>
          <div class="info-row">ครูประจำชั้น/ครูที่ปรึกษา <span class="fill-line" style="min-width: 350px;">${displayTeacherName}</span></div>

          <table class="summary-table">
            <thead>
              <tr>
                <th rowspan="2" style="width:15%;">จำนวนนักเรียน<br>ทั้งหมด</th>
                <th rowspan="2" style="width:28%;">มาตรฐานการประเมิน<br>(อ่าน คิด เขียน)</th>
                <th colspan="4">จำนวนนักเรียนที่ได้รับระดับผลการประเมิน</th>
              </tr>
              <tr>
                <th style="width:14%;">ดีเยี่ยม</th><th style="width:14%;">ดี</th><th style="width:14%;">ผ่าน</th><th style="width:15%;">ควรปรับปรุง</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowspan="3" class="fw-bold" style="font-size: 18px;"><br><br>${rows.length} คน</td>
                <td class="text-left fw-bold" style="padding-left:15px;">1. การอ่าน</td>
                <td>${stats.r.ex}</td><td>${stats.r.g}</td><td>${stats.r.p}</td><td>${stats.r.i}</td>
              </tr>
              <tr>
                <td class="text-left fw-bold" style="padding-left:15px;">2. การคิดวิเคราะห์</td>
                <td>${stats.c.ex}</td><td>${stats.c.g}</td><td>${stats.c.p}</td><td>${stats.c.i}</td>
              </tr>
              <tr>
                <td class="text-left fw-bold" style="padding-left:15px;">3. การเขียน</td>
                <td>${stats.w.ex}</td><td>${stats.w.g}</td><td>${stats.w.p}</td><td>${stats.w.i}</td>
              </tr>
            </tbody>
          </table>

          <div class="text-left fw-bold" style="margin-top: 25px; padding-left: 20px; font-size: 16px;">การตัดสินผลและเห็นชอบ</div>
          
          <!-- ลายเซ็นครูประจำชั้น (แยกกล่องให้อัตโนมัติถ้ามีหลายคน) -->
          <div class="sign-flex">
            ${teachers.map(t => `
              <div class="sign-box">
                (ลงชื่อ)........................................................<br>
                <div class="sign-name">( ${t} )</div>
                <div>ครูประจำชั้น</div>
              </div>
            `).join('')}
          </div>

          <!-- ลายเซ็นวิชาการ -->
          <div class="sign-flex" style="margin-top: 5px;">
            <div class="sign-box">
              (ลงชื่อ)........................................................<br>
              <div class="sign-name">( ${academicHead} )</div>
              <div>ประธานกรรมการประเมินฯ</div>
            </div>
            <div class="sign-box">
              (ลงชื่อ)........................................................<br>
              <div class="sign-name">(........................................................)</div>
              <div>เลขานุการคณะกรรมการฯ</div>
            </div>
          </div>

          <div class="approval-card">
            <div class="fw-bold" style="font-size: 16px; margin-bottom: 15px;">การอนุมัติผลการประเมิน</div>
            <div style="display: flex; justify-content: center; gap: 60px; margin-bottom: 25px; font-size: 16px;">
              <span><span class="check-box"></span> อนุมัติ</span>
              <span><span class="check-box"></span> ไม่อนุมัติ</span>
            </div>
            (ลงชื่อ)....................................................................ผู้อำนวยการโรงเรียน<br>
            <div style="margin-top:10px;">( ${directorName} )</div>
            <div style="margin-top:5px;">วันที่ 31 เดือน มีนาคม พ.ศ. 2568</div>
          </div>
        </div>
      </div>

      <!-- ================= หน้า 2: ตารางคะแนนแยกครั้ง ================= -->
      <div class="page">
        <div class="text-center">
          <div class="fw-bold" style="font-size:18px;">สรุปคะแนนการประเมินการอ่าน คิดวิเคราะห์ และเขียน (แยกตามครั้ง)</div>
          <p style="font-size:15px; margin-top:5px;">วิชา ${subj} | ชั้น ${cls}</p>
        </div>
        <table class="score-table">
          <thead>
            <tr>
              <th rowspan="2" style="width:25px;">ที่</th><th rowspan="2" class="col-name">ชื่อ-นามสกุล</th>
              <th colspan="3" style="background:#eff6ff;">การอ่าน (30)</th>
              <th colspan="3" style="background:#fff7ed;">การคิดวิเคราะห์ (40)</th>
              <th colspan="3" style="background:#f0fdf4;">การเขียน (30)</th>
              <th rowspan="2" style="width:40px;">รวม<br>(100)</th><th rowspan="2" style="width:60px;">ระดับผล</th>
            </tr>
            <tr>
              <th style="background:#eff6ff; width:28px;">ค.1</th><th style="background:#eff6ff; width:28px;">ค.2</th><th style="background:#eff6ff; width:28px;">รวม</th>
              <th style="background:#fff7ed; width:28px;">ค.1</th><th style="background:#fff7ed; width:28px;">ค.2</th><th style="background:#fff7ed; width:28px;">รวม</th>
              <th style="background:#f0fdf4; width:28px;">ค.1</th><th style="background:#f0fdf4; width:28px;">ค.2</th><th style="background:#f0fdf4; width:28px;">รวม</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.no}</td><td class="col-name">${r.name}</td>
                <td style="background:#eff6ff;">${r.r1}</td><td style="background:#eff6ff;">${r.r2}</td><td class="fw-bold" style="background:#eff6ff;">${r.r_total}</td>
                <td style="background:#fff7ed;">${r.c1}</td><td style="background:#fff7ed;">${r.c2}</td><td class="fw-bold" style="background:#fff7ed;">${r.c_total}</td>
                <td style="background:#f0fdf4;">${r.w1}</td><td style="background:#f0fdf4;">${r.w2}</td><td class="fw-bold" style="background:#f0fdf4;">${r.w_total}</td>
                <td class="fw-bold" style="font-size:13px;">${r.grand_total}</td><td class="fw-bold">${r.grade}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- ================= หน้า 3: เกณฑ์และตัวชี้วัด ================= -->
      <div class="page">
        <div class="text-center">
          <div class="fw-bold" style="font-size:18px;">เกณฑ์การประเมินและตัวชี้วัด</div>
          <p>ความสามารถในการอ่าน คิดวิเคราะห์ และเขียน (ชั้น ${cls})</p>
        </div>
        <div style="margin-left: 20px; margin-right: 20px;">
          <div class="fw-bold" style="text-decoration: underline;">ตัวชี้วัดที่ประเมิน:</div>
          <div style="margin: 10px 0 20px 10px; line-height: 1.8;">
            ${indicators.map((txt) => `<div>${txt}</div>`).join('')}
          </div>
          
          <div class="fw-bold" style="text-decoration: underline; margin-top: 20px;">สัดส่วนคะแนน (100 คะแนน):</div>
          <div style="margin: 10px 0 20px 10px; line-height: 1.8;">
            <div><b>1. การอ่าน (30 คะแนน)</b> ประเมินจากตัวชี้วัดข้อที่ 1 และ 2<br><span style="color:#555; font-size:13px; margin-left:15px;">- ครั้งที่ 1 (15 คะแนน) / ครั้งที่ 2 (15 คะแนน)</span></div>
            <div><b>2. การคิดวิเคราะห์ (40 คะแนน)</b> ประเมินจากตัวชี้วัดข้อที่ 3 และ 4<br><span style="color:#555; font-size:13px; margin-left:15px;">- ครั้งที่ 1 (20 คะแนน) / ครั้งที่ 2 (20 คะแนน)</span></div>
            <div><b>3. การเขียน (30 คะแนน)</b> ประเมินจากตัวชี้วัดข้อที่ 5<br><span style="color:#555; font-size:13px; margin-left:15px;">- ครั้งที่ 1 (15 คะแนน) / ครั้งที่ 2 (15 คะแนน)</span></div>
          </div>

          <div class="fw-bold" style="text-decoration: underline; margin-top: 30px;">เกณฑ์การตัดสินคุณภาพ:</div>
          <table style="width: 80%; margin: 10px auto; border-collapse: collapse;">
            <tr style="background:#f8fafc;">
              <th style="border:1px solid #000; padding:8px;">ช่วงคะแนนร้อยละ</th>
              <th style="border:1px solid #000; padding:8px;">ระดับคุณภาพ</th>
              <th style="border:1px solid #000; padding:8px;">ความหมาย</th>
            </tr>
            <tr><td style="border:1px solid #000; text-align:center;">86 - 100</td><td style="border:1px solid #000; text-align:center;">ดีเยี่ยม (3)</td><td class="text-left" style="border:1px solid #000; padding-left:10px;">มีผลงานแสดงถึงความสามารถที่มีคุณภาพดีเลิศอยู่เสมอ</td></tr>
            <tr><td style="border:1px solid #000; text-align:center;">70 - 85</td><td style="border:1px solid #000; text-align:center;">ดี (2)</td><td class="text-left" style="border:1px solid #000; padding-left:10px;">มีผลงานแสดงถึงความสามารถที่มีคุณภาพเป็นที่ยอมรับ</td></tr>
            <tr><td style="border:1px solid #000; text-align:center;">50 - 69</td><td style="border:1px solid #000; text-align:center;">ผ่าน (1)</td><td class="text-left" style="border:1px solid #000; padding-left:10px;">มีผลงานแสดงถึงความสามารถที่มีข้อบกพร่องบางประการ</td></tr>
            <tr><td style="border:1px solid #000; text-align:center;">0 - 49</td><td style="border:1px solid #000; text-align:center;">ไม่ผ่าน (0)</td><td class="text-left" style="border:1px solid #000; padding-left:10px;">ไม่มีผลงาน หรือผลงานต้องได้รับการปรับปรุงหลายประการ</td></tr>
          </table>
          
          <div style="margin-top: 30px; font-size: 13px; font-style: italic; color: #555; text-align:center;">
            * การประเมินอ้างอิงตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช 2551
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  win.document.open(); win.document.write(html); win.document.close();
}

  // =====================================================
    function renderRTWTable() {
  const container = $('rtwContainer');
  if (!App.students.length) return;

  const cls = $('gClass').value.trim();
  
  // --- ระบบจดจำชื่อครูประจำชั้นแยกตามห้องเรียน ---
  App.hrMap = App.hrMap || {};
  let hrTeacherStr = App.hrMap[cls];
  if (hrTeacherStr === undefined) {
    hrTeacherStr = (App.user && App.user.classroom === cls) ? App.user.name : "";
  }

  let indicators =[];
  let title = "";
  if (cls.match(/[ป].[1-3]/)) {
    title = "ระดับชั้นประถมศึกษาปีที่ 1-3";
    indicators =["1. อ่านและหาประสบการณ์จากสื่อที่หลากหลาย", "2. จับประเด็นสำคัญ ข้อเท็จจริง ความคิดเห็น", "3. เปรียบเทียบแง่มุมต่างๆ (ข้อดี-เสีย/ประโยชน์-โทษ)", "4. แสดงความคิดเห็นต่อเรื่องที่อ่านอย่างมีเหตุผล", "5. ถ่ายทอดความรู้สึกจากเรื่องที่อ่านโดยการเขียน"];
  } else if (cls.match(/[ป].[4-6]/)) {
    title = "ระดับชั้นประถมศึกษาปีที่ 4-6";
    indicators =["1. อ่านเพื่อหาข้อมูลสารสนเทศเสริมประสบการณ์", "2. จับประเด็นสำคัญ เชื่อมโยงความเป็นเหตุผล", "3. เชื่อมโยงความสัมพันธ์ของเรื่องราวและเหตุการณ์", "4. แสดงความคิดเห็นโดยมีเหตุผลสนับสนุน", "5. ถ่ายทอดความคิดเห็นและคุณค่าโดยการเขียน"];
  } else {
    title = "ระดับชั้นมัธยมศึกษาปีที่ 1-3";
    indicators =["1. คัดสรรสื่อเพื่อหาข้อมูลสารสนเทศตามวัตถุประสงค์", "2. จับประเด็นสำคัญ ประเด็นสนับสนุน และโต้แย้ง", "3. วิเคราะห์ วิจารณ์ความสมเหตุสมผลน่าเชื่อถือ", "4. สรุปคุณค่า แนวคิด แง่คิดจากการอ่าน", "5. สรุป อภิปราย ขยายความ แสดงความเห็นโต้แย้งโดยการเขียน"];
  }

  const criteriaHtml = `
    <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:15px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
      
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px; background:#fff; padding:10px 15px; border-radius:6px; border:1px solid #e2e8f0;">
        <label style="font-weight:bold; color:#1e40af; margin:0; white-space:nowrap; font-size:0.9rem;">👨‍🏫 ครูประจำชั้น:</label>
        <input type="text" id="rtw_homeroom_teacher" value="${hrTeacherStr}" 
               oninput="App.hrMap[document.getElementById('gClass').value.trim()] = this.value; if(document.getElementById('guidance_teacher')) document.getElementById('guidance_teacher').value = this.value;" 
               style="flex:1; max-width:400px; padding:6px 10px; border:1px solid #94a3b8; border-radius:4px; font-weight:bold; font-family:inherit; font-size:0.9rem;" placeholder="นาย ก / นาง ข">
        <span style="font-size:0.75rem; color:#64748b;">(ระบบจำชื่อแยกตามชั้นอัตโนมัติ)</span>
      </div>

      <div style="font-weight:bold; color:#0f172a; margin-bottom:10px; font-size:0.95rem; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
        📖 เกณฑ์การประเมินและตัวชี้วัด (${title})
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:20px; font-size:0.85rem;">
          <div style="flex:1.5; min-width:300px;">
              <div style="font-weight:bold; color:#334155; margin-bottom:5px;">📌 ตัวชี้วัดที่ประเมิน:</div>
              <div style="color:#475569; line-height:1.6; margin-left:10px;">
                  ${indicators.map(i => `<div>${i}</div>`).join('')}
              </div>
          </div>
          <div style="flex:1; min-width:260px;">
              <div style="font-weight:bold; color:#334155; margin-bottom:5px;">📊 สัดส่วนคะแนน (100 คะแนน):</div>
              <div style="color:#475569; line-height:1.6; margin-left:10px; margin-bottom:12px;">
                  <div><b style="color:#1d4ed8;">การอ่าน (30):</b> วัดข้อ 1-2 (ครั้งละ 15)</div>
                  <div><b style="color:#c2410c;">การคิด (40):</b> วัดข้อ 3-4 (ครั้งละ 20)</div>
                  <div><b style="color:#15803d;">การเขียน (30):</b> วัดข้อ 5 (ครั้งละ 15)</div>
              </div>
          </div>
      </div>
    </div>
  `;
  
  $('rtwIndicatorLabel').innerHTML = criteriaHtml;
  $('rtwIndicatorLabel').className = "";
  $('rtwIndicatorLabel').style.border = "none";
  $('rtwIndicatorLabel').style.background = "transparent";

  const htmlRows = App.students.map((s, idx) => {
    const r = s.rtw_data || {};
    return `
      <tr data-rtwsid="${s.studentId}">
        <td class="ass-no">${idx + 1}</td>
        <td class="ass-name" style="text-align:left; background:#fff; position:sticky; left:0; z-index:10;">${s.name}</td>
        <td><input type="number" class="inp-ass rtw-r1-1" min="0" max="8" value="${r.r1_1||''}" oninput="calcRTWRow(this)"></td>
        <td><input type="number" class="inp-ass rtw-r1-2" min="0" max="7" value="${r.r1_2||''}" oninput="calcRTWRow(this)"></td>
        <td class="bg-sum rtw-r1-sum">-</td>
        <td><input type="number" class="inp-ass rtw-r2-1" min="0" max="8" value="${r.r2_1||''}" oninput="calcRTWRow(this)"></td>
        <td><input type="number" class="inp-ass rtw-r2-2" min="0" max="7" value="${r.r2_2||''}" oninput="calcRTWRow(this)"></td>
        <td class="bg-sum rtw-r2-sum">-</td>
        <td><input type="number" class="inp-ass rtw-c1-3" min="0" max="10" value="${r.c1_3||''}" oninput="calcRTWRow(this)"></td>
        <td><input type="number" class="inp-ass rtw-c1-4" min="0" max="10" value="${r.c1_4||''}" oninput="calcRTWRow(this)"></td>
        <td class="bg-sum rtw-c1-sum">-</td>
        <td><input type="number" class="inp-ass rtw-c2-3" min="0" max="10" value="${r.c2_3||''}" oninput="calcRTWRow(this)"></td>
        <td><input type="number" class="inp-ass rtw-c2-4" min="0" max="10" value="${r.c2_4||''}" oninput="calcRTWRow(this)"></td>
        <td class="bg-sum rtw-c2-sum">-</td>
        <td><input type="number" class="inp-ass rtw-w1-5" min="0" max="15" value="${r.w1_5||''}" oninput="calcRTWRow(this)"></td>
        <td><input type="number" class="inp-ass rtw-w2-5" min="0" max="15" value="${r.w2_5||''}" oninput="calcRTWRow(this)"></td>
        <td class="bg-sum rtw-grand-total" style="font-weight:bold; background:#e0f2fe!important; color:#0369a1;">-</td>
        <td><span class="res-badge rtw-grade">-</span></td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="ass-wrap">
      <table class="ass-tbl" id="rtwTable" style="font-size:12px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th rowspan="3">ที่</th><th rowspan="3" style="min-width:160px; z-index:20;">ชื่อ-นามสกุล</th>
            <th colspan="6" style="background:#dbeafe;">1. การอ่าน (30)</th>
            <th colspan="6" style="background:#ffedd5;">2. การคิดวิเคราะห์ (40)</th>
            <th colspan="2" style="background:#dcfce7;">3. การเขียน (30)</th>
            <th rowspan="3">รวม</th><th rowspan="3">ระดับ</th>
          </tr>
          <tr>
            <th colspan="3">ครั้งที่ 1 (15)</th><th colspan="3">ครั้งที่ 2 (15)</th>
            <th colspan="3">ครั้งที่ 1 (20)</th><th colspan="3">ครั้งที่ 2 (20)</th>
            <th>ค1(15)</th><th>ค2(15)</th>
          </tr>
          <tr style="font-size:10px;">
            <th style="background:#eff6ff;">ข้อ 1(8)</th><th style="background:#eff6ff;">ข้อ 2(7)</th><th class="bg-sum">รวม</th>
            <th style="background:#eff6ff;">ข้อ 1(8)</th><th style="background:#eff6ff;">ข้อ 2(7)</th><th class="bg-sum">รวม</th>
            <th style="background:#fff7ed;">ข้อ 3(10)</th><th style="background:#fff7ed;">ข้อ 4(10)</th><th class="bg-sum">รวม</th>
            <th style="background:#fff7ed;">ข้อ 3(10)</th><th style="background:#fff7ed;">ข้อ 4(10)</th><th class="bg-sum">รวม</th>
            <th style="background:#f0fdf4;">ข้อ 5(15)</th><th style="background:#f0fdf4;">ข้อ 5(15)</th>
          </tr>
        </thead>
        <tbody id="rtwBody">${htmlRows}</tbody>
      </table>
    </div>`;
    
  $$('#rtwBody tr[data-rtwsid]').forEach(tr => calcRTWRow(tr.querySelector('.rtw-r1-1')));
}
