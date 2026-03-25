// ===== シフト管理 =====
let staffList = JSON.parse(localStorage.getItem('migiude_staff') || '[]');
let shiftData = JSON.parse(localStorage.getItem('migiude_shift') || '{}');
let shiftYear, shiftMonth;
const SHIFT_TYPES = ['','早','遅','日','休','有','半'];

if (staffList.length === 0) {
  staffList = [
    {name:'薬剤師A', role:'薬剤師', color:'#534ab7'},
    {name:'薬剤師B', role:'薬剤師', color:'#1565c0'},
    {name:'事務A', role:'事務', color:'#2e7d32'},
    {name:'事務B', role:'事務', color:'#f57f17'},
    {name:'事務C', role:'事務', color:'#c62828'},
    {name:'事務D', role:'事務', color:'#00838f'},
  ];
  localStorage.setItem('migiude_staff', JSON.stringify(staffList));
}

function addStaff() {
  const name = document.getElementById('staff-add-name').value.trim();
  const role = document.getElementById('staff-add-role').value;
  const color = document.getElementById('staff-add-color').value;
  if (!name) return;
  staffList.push({name, role, color});
  localStorage.setItem('migiude_staff', JSON.stringify(staffList));
  document.getElementById('staff-add-name').value = '';
  renderStaffList();
  renderShift();
  updateCalAssignSelect();
  updateTaskAssignSelects();
}

function removeStaff(i) {
  staffList.splice(i, 1);
  localStorage.setItem('migiude_staff', JSON.stringify(staffList));
  renderStaffList();
  renderShift();
  updateCalAssignSelect();
  updateTaskAssignSelects();
}

function updateTaskAssignSelects() {
  ['task-add-assign','task-filter-person'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    const isFilter = id === 'task-filter-person';
    sel.innerHTML = isFilter ? '<option value="">全員</option>' : '<option value="">担当なし</option>';
    staffList.forEach(s => { sel.innerHTML += `<option value="${s.name}">${s.name}</option>`; });
    sel.value = current;
  });
}

function renderStaffList() {
  const el = document.getElementById('staff-list');
  if (!el) return;
  el.innerHTML = staffList.map((s, i) =>
    `<span class="staff-chip" style="background:${s.color}">${s.role === '薬剤師' ? '💊' : '📋'} ${s.name}<button onclick="removeStaff(${i})">×</button></span>`
  ).join('');
}

function shiftMove(d) { shiftMonth += d; if (shiftMonth > 12) { shiftMonth = 1; shiftYear++; } if (shiftMonth < 1) { shiftMonth = 12; shiftYear--; } renderShift(); }
function shiftToday() { const t = new Date(); shiftYear = t.getFullYear(); shiftMonth = t.getMonth()+1; renderShift(); }

function cycleShift(staffIdx, day) {
  const key = `${shiftYear}-${String(shiftMonth).padStart(2,'0')}`;
  if (!shiftData[key]) shiftData[key] = {};
  const cellKey = `${staffIdx}-${day}`;
  const current = shiftData[key][cellKey] || '';
  const idx = SHIFT_TYPES.indexOf(current);
  shiftData[key][cellKey] = SHIFT_TYPES[(idx + 1) % SHIFT_TYPES.length];
  localStorage.setItem('migiude_shift', JSON.stringify(shiftData));
  renderShift();
}

function renderShift() {
  const r = shiftYear - 2018;
  document.getElementById('shift-title').textContent = `R${r}年（${shiftYear}年）${shiftMonth}月`;

  const daysInMonth = new Date(shiftYear, shiftMonth, 0).getDate();
  const key = `${shiftYear}-${String(shiftMonth).padStart(2,'0')}`;
  const data = shiftData[key] || {};
  const today = new Date();
  const todayDay = (today.getFullYear() === shiftYear && today.getMonth()+1 === shiftMonth) ? today.getDate() : -1;

  // ヘッダー
  let th = '<tr><th style="text-align:left;position:sticky;left:0;background:#fff;z-index:1;min-width:90px">スタッフ</th>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(shiftYear, shiftMonth-1, d);
    const dow = ['日','月','火','水','木','金','土'][dt.getDay()];
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const isToday = d === todayDay;
    const color = dt.getDay() === 0 ? '#c62828' : dt.getDay() === 6 ? '#1565c0' : 'var(--text2)';
    const bg = isToday ? '#fffde7' : '';
    th += `<th style="text-align:center;min-width:36px;font-size:11px;color:${color};${bg ? 'background:'+bg : ''}">${d}<br>${dow}</th>`;
  }
  th += '<th style="min-width:40px;font-size:11px">出勤</th></tr>';
  document.getElementById('shift-thead').innerHTML = th;

  // 行
  let tbody = '';
  staffList.forEach((s, si) => {
    let workDays = 0;
    tbody += `<tr><td style="text-align:left;position:sticky;left:0;background:#fff;z-index:1;white-space:nowrap">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:4px"></span>
      <b>${s.name}</b><br><span style="font-size:10px;color:var(--text2)">${s.role}</span></td>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const val = data[`${si}-${d}`] || '';
      const isToday = d === todayDay;
      let bg = isToday ? '#fffde7' : '';
      let display = '';
      if (val === '休') { display = `<span style="color:#c62828;font-weight:bold">休</span>`; }
      else if (val === '有') { display = `<span style="color:#1565c0;font-weight:bold">有</span>`; }
      else if (val === '半') { display = `<span style="color:#f57f17;font-weight:bold">半</span>`; workDays += 0.5; }
      else if (val) { display = `<span class="shift-badge" style="background:${s.color}">${val}</span>`; workDays++; }
      tbody += `<td class="shift-cell" onclick="cycleShift(${si},${d})" style="${bg ? 'background:'+bg : ''}">${display}</td>`;
    }
    tbody += `<td style="text-align:center;font-weight:bold">${workDays || '-'}</td></tr>`;
  });

  // 合計行
  tbody += '<tr style="background:var(--bg)"><td style="text-align:left;position:sticky;left:0;background:var(--bg);z-index:1;font-weight:bold">合計</td>';
  for (let d = 1; d <= daysInMonth; d++) {
    let yakCount = 0, jimuCount = 0;
    staffList.forEach((s, si) => {
      const val = data[`${si}-${d}`] || '';
      if (val && val !== '休' && val !== '有') {
        if (s.role === '薬剤師') yakCount += (val === '半' ? 0.5 : 1);
        else jimuCount += (val === '半' ? 0.5 : 1);
      }
    });
    const hasStaff = yakCount + jimuCount > 0;
    tbody += `<td style="text-align:center;font-size:10px">${hasStaff ? `<span style="color:#534ab7">薬${yakCount}</span><br><span style="color:#2e7d32">事${jimuCount}</span>` : ''}</td>`;
  }
  tbody += '<td></td></tr>';

  document.getElementById('shift-tbody').innerHTML = tbody;
}

function initShift() {
  const t = new Date();
  shiftYear = t.getFullYear();
  shiftMonth = t.getMonth() + 1;
  renderStaffList();
  renderShift();
  renderYukyu();
}

// ===== 有給管理 =====
let yukyuData = JSON.parse(localStorage.getItem('migiude_yukyu') || '{}');

function getYukyuUsed(staffIdx) {
  // 全シフトデータから「有」の日数をカウント
  let used = 0;
  Object.keys(shiftData).forEach(monthKey => {
    const month = shiftData[monthKey];
    Object.keys(month).forEach(cellKey => {
      const [si] = cellKey.split('-');
      if (parseInt(si) === staffIdx && month[cellKey] === '有') used++;
    });
  });
  // 「半」は0.5日
  Object.keys(shiftData).forEach(monthKey => {
    const month = shiftData[monthKey];
    Object.keys(month).forEach(cellKey => {
      const [si] = cellKey.split('-');
      if (parseInt(si) === staffIdx && month[cellKey] === '半') used += 0.5;
    });
  });
  return used;
}

function setYukyu(staffIdx, field, value) {
  if (!yukyuData[staffIdx]) yukyuData[staffIdx] = {};
  yukyuData[staffIdx][field] = value;
  localStorage.setItem('migiude_yukyu', JSON.stringify(yukyuData));
  renderYukyu();
}

function renderYukyu() {
  const tbody = document.getElementById('yukyu-tbody');
  if (!tbody) return;

  tbody.innerHTML = staffList.map((s, i) => {
    const yk = yukyuData[i] || {};
    const granted = yk.granted || 10;
    const nextDate = yk.nextDate || '';
    const used = getYukyuUsed(i);
    const remaining = granted - used;
    const rate = granted > 0 ? Math.round(used / granted * 100) : 0;
    const rateColor = rate >= 100 ? '#c62828' : used >= 5 ? '#2e7d32' : '#f57f17';
    const remainColor = remaining <= 2 ? '#c62828' : remaining <= 5 ? '#f57f17' : '#2e7d32';

    return `<tr>
      <td style="text-align:left">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:4px"></span>
        <b>${s.name}</b>
      </td>
      <td style="text-align:left;font-size:12px;color:var(--text2)">${s.role}</td>
      <td style="text-align:center">
        <input type="number" value="${granted}" min="0" max="40" style="width:50px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px" onchange="setYukyu(${i},'granted',parseInt(this.value))">
      </td>
      <td style="text-align:center;font-weight:bold">${used}</td>
      <td style="text-align:center;font-weight:bold;color:${remainColor}">${remaining}</td>
      <td style="text-align:center;font-weight:bold;color:${rateColor}">${rate}%</td>
      <td style="text-align:center">
        <input type="date" value="${nextDate}" style="font-size:11px;border:1px solid var(--border);border-radius:4px;padding:2px" onchange="setYukyu(${i},'nextDate',this.value)">
      </td>
    </tr>`;
  }).join('');
}

// ===== タスク管理 =====
let dailyTasks = JSON.parse(localStorage.getItem('migiude_daily_tasks') || '[]');

// サンプルデータ（初回のみ）
if (dailyTasks.length === 0) {
  const today = new Date();
  const d = (offset) => { const t = new Date(today); t.setDate(t.getDate()+offset); return t.toISOString().split('T')[0]; };
  dailyTasks = [
    {id:1, text:'レセプト返戻 3件対応', assign:'事務A', due:d(1), priority:'high', done:false},
    {id:2, text:'麻薬帳簿の月次照合', assign:'薬剤師A', due:d(2), priority:'high', done:false},
    {id:3, text:'冷蔵庫温度記録の確認', assign:'事務B', due:d(0), priority:'normal', done:false},
    {id:4, text:'トレーシングレポート作成（田中様）', assign:'薬剤師B', due:d(3), priority:'normal', done:false},
    {id:5, text:'在宅訪問 佐藤様（14:00）', assign:'薬剤師A', due:d(0), priority:'high', done:false},
    {id:6, text:'後発品在庫確認・発注', assign:'事務C', due:d(1), priority:'normal', done:false},
    {id:7, text:'吸入指導チェックリスト印刷', assign:'事務D', due:d(4), priority:'low', done:false},
    {id:8, text:'R8届出様式の準備', assign:'薬剤師A', due:d(7), priority:'normal', done:false},
    {id:9, text:'期限切れ薬品の廃棄処理', assign:'事務A', due:d(-1), priority:'normal', done:false},
    {id:10, text:'かかりつけ薬剤師同意書 山田様', assign:'薬剤師B', due:d(2), priority:'normal', done:true},
  ];
  localStorage.setItem('migiude_daily_tasks', JSON.stringify(dailyTasks));
}

function addDailyTask() {
  const text = document.getElementById('task-add-text').value.trim();
  const assign = document.getElementById('task-add-assign').value;
  const due = document.getElementById('task-add-due').value;
  const priority = document.getElementById('task-add-priority').value;
  if (!text) return;
  dailyTasks.push({id: Date.now(), text, assign, due, priority, done: false});
  localStorage.setItem('migiude_daily_tasks', JSON.stringify(dailyTasks));
  document.getElementById('task-add-text').value = '';
  renderDailyTasks();
}

function toggleDailyTask(id) {
  const t = dailyTasks.find(t => t.id === id);
  if (t) t.done = !t.done;
  localStorage.setItem('migiude_daily_tasks', JSON.stringify(dailyTasks));
  renderDailyTasks();
}

function removeDailyTask(id) {
  dailyTasks = dailyTasks.filter(t => t.id !== id);
  localStorage.setItem('migiude_daily_tasks', JSON.stringify(dailyTasks));
  renderDailyTasks();
}

function taskCard(t) {
  const today = new Date().toISOString().split('T')[0];
  const overdue = t.due && t.due < today && !t.done;
  const prioColor = t.priority === 'high' ? '#c62828' : t.priority === 'low' ? '#9e9e97' : '';
  const prioLabel = t.priority === 'high' ? '高' : t.priority === 'low' ? '低' : '';
  const staff = t.assign ? staffList.find(s => s.name === t.assign) : null;

  return `<div class="task-card${t.done ? ' done' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:4px;${overdue ? 'border-left:3px solid #c62828' : ''}">
    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleDailyTask(${t.id})" style="width:16px;height:16px;accent-color:#534ab7;cursor:pointer;flex-shrink:0">
    <div style="flex:1;${t.done ? 'text-decoration:line-through;opacity:0.5' : ''}">
      <div style="font-size:13px;font-weight:bold">${t.text}</div>
      <div style="font-size:11px;color:var(--text2);display:flex;gap:8px;margin-top:2px">
        ${t.assign ? `<span style="color:${staff?.color || 'var(--text2)'}">${t.assign}</span>` : ''}
        ${t.due ? `<span${overdue ? ' style="color:#c62828;font-weight:bold"' : ''}>${t.due.replace(/-/g,'/')}</span>` : ''}
        ${prioLabel ? `<span style="color:${prioColor};font-weight:bold">${prioLabel}</span>` : ''}
      </div>
    </div>
    <button onclick="removeDailyTask(${t.id})" style="font-size:12px;border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer;background:var(--card)">削除</button>
  </div>`;
}

function renderDailyTasks() {
  const list = document.getElementById('daily-task-list');
  if (!list) return;

  // 担当selectを更新
  ['task-add-assign','task-filter-person'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    const isFilter = id.includes('filter');
    sel.innerHTML = (isFilter ? '<option value="">全員</option>' : '<option value="">担当なし</option>');
    staffList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name; opt.textContent = s.name;
      sel.appendChild(opt);
    });
    if (val) sel.value = val;
  });

  const view = document.getElementById('task-view')?.value || 'all';
  const filterPerson = document.getElementById('task-filter-person')?.value || '';

  // フィルタ
  let filtered = [...dailyTasks];
  if (view === 'active') filtered = filtered.filter(t => !t.done);
  if (filterPerson) filtered = filtered.filter(t => t.assign === filterPerson);

  // 進捗
  const done = dailyTasks.filter(t => t.done).length;
  const prog = document.getElementById('daily-task-progress');
  if (prog) prog.textContent = `${done} / ${dailyTasks.length} 完了`;

  if (filtered.length === 0) {
    list.innerHTML = '<p style="font-size:13px;color:var(--text2);padding:12px">タスクがありません</p>';
    return;
  }

  // 担当者別グルーピング
  if (view === 'person') {
    const groups = {};
    filtered.forEach(t => {
      const key = t.assign || '担当なし';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    let html = '';
    Object.keys(groups).sort().forEach(name => {
      const staff = staffList.find(s => s.name === name);
      const color = staff?.color || 'var(--text2)';
      const tasks = groups[name].sort((a,b) => a.done - b.done);
      const doneCount = tasks.filter(t=>t.done).length;
      html += `<div style="margin-bottom:14px">
        <div style="font-size:14px;font-weight:bold;color:${color};margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
          ${name} <span style="font-size:12px;font-weight:normal;color:var(--text2)">${doneCount}/${tasks.length}</span>
        </div>
        ${tasks.map(taskCard).join('')}
      </div>`;
    });
    list.innerHTML = html;
    return;
  }

  // 期限順
  if (view === 'due') {
    filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const da = a.due || '9999'; const db = b.due || '9999';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    const today = new Date().toISOString().split('T')[0];
    const groups = {overdue:[], today:[], upcoming:[], noDue:[], done:[]};
    filtered.forEach(t => {
      if (t.done) groups.done.push(t);
      else if (!t.due) groups.noDue.push(t);
      else if (t.due < today) groups.overdue.push(t);
      else if (t.due === today) groups.today.push(t);
      else groups.upcoming.push(t);
    });
    let html = '';
    if (groups.overdue.length) html += `<div style="font-size:13px;font-weight:bold;color:#c62828;margin:8px 0 4px">期限超過</div>${groups.overdue.map(taskCard).join('')}`;
    if (groups.today.length) html += `<div style="font-size:13px;font-weight:bold;color:#f57f17;margin:8px 0 4px">今日</div>${groups.today.map(taskCard).join('')}`;
    if (groups.upcoming.length) html += `<div style="font-size:13px;font-weight:bold;color:var(--text2);margin:8px 0 4px">今後</div>${groups.upcoming.map(taskCard).join('')}`;
    if (groups.noDue.length) html += `<div style="font-size:13px;font-weight:bold;color:var(--text2);margin:8px 0 4px">期限なし</div>${groups.noDue.map(taskCard).join('')}`;
    if (groups.done.length) html += `<div style="font-size:13px;font-weight:bold;color:var(--text2);margin:8px 0 4px">完了</div>${groups.done.map(taskCard).join('')}`;
    list.innerHTML = html;
    return;
  }

  // デフォルト: 未完了→完了、高優先→普通→低
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const p = {high:0, normal:1, low:2};
    return (p[a.priority]||1) - (p[b.priority]||1);
  });
  list.innerHTML = filtered.map(taskCard).join('');
}

function initDailyTasks() {
  renderDailyTasks();
}

// ===== 予製候補 =====
// レセプトDBが入ったら患者×処方の繰り返しパターンを検出する
// 現状はlocalStorageに手動登録した予製リストを管理
let yochoList = JSON.parse(localStorage.getItem('migiude_yocho') || '[]');

function toggleYocho() {
  const body = document.getElementById('yocho-body');
  const btn = document.getElementById('yocho-toggle');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    btn.textContent = '閉じる';
    renderYocho();
  } else {
    body.style.display = 'none';
    btn.textContent = '表示';
  }
}

function renderYocho() {
  const list = document.getElementById('yocho-list');

  // レセプトDBがない場合は手動登録モード
  let html = '';

  if (yochoList.length > 0) {
    html += yochoList.map((y, i) => {
      const nextDate = y.nextDate || '未定';
      return `<div class="yocho-card">
        <div class="yocho-patient">${y.patient}</div>
        <div class="yocho-rx">${y.rx}</div>
        <div class="yocho-days">${y.days}日分</div>
        <div class="yocho-next">次回: ${nextDate}</div>
        <button onclick="yochoToCal(${i})">カレンダーへ</button>
        <button onclick="removeYocho(${i})">削除</button>
      </div>`;
    }).join('');
  } else {
    html += '<p style="font-size:12px;color:var(--text2);margin-bottom:8px">予製候補がありません。下のフォームで手動追加するか、レセプト（UKE）を2ヶ月分以上読み込むと自動検出します。</p>';
  }

  // 手動追加フォーム
  html += `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:end">
    <div><div style="font-size:11px;color:var(--text2)">患者名</div>
      <input type="text" id="yocho-add-patient" placeholder="患者名" style="width:100px;padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:4px"></div>
    <div><div style="font-size:11px;color:var(--text2)">処方内容</div>
      <input type="text" id="yocho-add-rx" placeholder="薬品名・用法等" style="width:200px;padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:4px"></div>
    <div><div style="font-size:11px;color:var(--text2)">日数</div>
      <input type="number" id="yocho-add-days" value="28" min="1" style="width:60px;padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:4px"></div>
    <div><div style="font-size:11px;color:var(--text2)">次回予定日</div>
      <input type="date" id="yocho-add-next" style="padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:4px"></div>
    <button class="btn btn-primary" onclick="addYocho()" style="padding:4px 12px;font-size:12px">追加</button>
  </div>`;

  list.innerHTML = html;
}

function addYocho() {
  const patient = document.getElementById('yocho-add-patient').value.trim();
  const rx = document.getElementById('yocho-add-rx').value.trim();
  const days = parseInt(document.getElementById('yocho-add-days').value) || 28;
  const nextDate = document.getElementById('yocho-add-next').value;
  if (!patient || !rx) return;
  yochoList.push({patient, rx, days, nextDate});
  localStorage.setItem('migiude_yocho', JSON.stringify(yochoList));
  renderYocho();
}

function removeYocho(i) {
  yochoList.splice(i, 1);
  localStorage.setItem('migiude_yocho', JSON.stringify(yochoList));
  renderYocho();
}

function yochoToCal(i) {
  const y = yochoList[i];
  if (!y.nextDate) { alert('次回予定日が未定です'); return; }
  calEvents.push({
    date: y.nextDate,
    text: `予製: ${y.patient} ${y.rx}（${y.days}日分）`,
    type: 'teiki'
  });
  localStorage.setItem('migiude_cal', JSON.stringify(calEvents));
  alert(`${y.patient}の予製をカレンダー（${y.nextDate}）に追加しました`);
}

function initYocho() {
  // 予製データがあればセクションを表示
  if (yochoList.length > 0) {
    document.getElementById('yocho-section').style.display = '';
  }
  // レセプトデータがあれば常に表示
  // TODO: レセプトDB導入後に自動検出を追加
  document.getElementById('yocho-section').style.display = '';
}

// ===== 在庫・棚管理 =====
let shelves = JSON.parse(localStorage.getItem('migiude_shelves') || '[]');
let meds = JSON.parse(localStorage.getItem('migiude_meds') || '[]');
let medSortKey = 'name', medSortAsc = true;

// デフォルト棚
if (shelves.length === 0) {
  shelves = [
    {name:'棚A', desc:'内服薬（あ〜さ行）'},
    {name:'棚B', desc:'内服薬（た〜わ行）'},
    {name:'棚C', desc:'外用薬'},
    {name:'棚D', desc:'注射薬'},
    {name:'棚E', desc:'漢方薬'},
    {name:'麻薬金庫', desc:'麻薬（施錠管理）'},
    {name:'毒薬庫', desc:'毒薬（施錠管理）'},
    {name:'冷蔵庫', desc:'インスリン・バイオ・坐剤等'},
  ];
  localStorage.setItem('migiude_shelves', JSON.stringify(shelves));
}

function addShelf() {
  const name = document.getElementById('shelf-add-name').value.trim();
  const desc = document.getElementById('shelf-add-desc').value.trim();
  if (!name) return;
  shelves.push({name, desc});
  localStorage.setItem('migiude_shelves', JSON.stringify(shelves));
  document.getElementById('shelf-add-name').value = '';
  document.getElementById('shelf-add-desc').value = '';
  renderShelves();
}

function removeShelf(i) {
  shelves.splice(i, 1);
  localStorage.setItem('migiude_shelves', JSON.stringify(shelves));
  renderShelves();
}

function renderShelves() {
  const tbody = document.getElementById('shelf-tbody');
  if (!tbody) return;
  tbody.innerHTML = shelves.map((s, i) =>
    `<tr><td style="text-align:left;font-weight:bold">${s.name}</td><td style="text-align:left">${s.desc}</td><td style="text-align:center"><button onclick="removeShelf(${i})" style="font-size:11px;border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">削除</button></td></tr>`
  ).join('');
  // selectの更新
  ['med-add-shelf','med-filter-shelf'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    const isFilter = id.includes('filter');
    sel.innerHTML = (isFilter ? '<option value="">全ての棚</option>' : '') +
      shelves.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    if (val) sel.value = val;
  });
}

function addMed() {
  const name = document.getElementById('med-add-name').value.trim();
  const shelf = document.getElementById('med-add-shelf').value;
  const qty = parseInt(document.getElementById('med-add-qty').value) || 0;
  const exp = document.getElementById('med-add-exp').value;
  if (!name) return;
  meds.push({name, shelf, qty, exp, id: Date.now()});
  localStorage.setItem('migiude_meds', JSON.stringify(meds));
  document.getElementById('med-add-name').value = '';
  document.getElementById('med-add-qty').value = '1';
  renderMeds();
  updateMedSuggestions();
}

function removeMed(id) {
  meds = meds.filter(m => m.id !== id);
  localStorage.setItem('migiude_meds', JSON.stringify(meds));
  renderMeds();
}

function sortMeds(key) {
  if (medSortKey === key) medSortAsc = !medSortAsc;
  else { medSortKey = key; medSortAsc = true; }
  renderMeds();
}

function renderMeds() {
  const tbody = document.getElementById('med-tbody');
  if (!tbody) return;
  const search = (document.getElementById('med-search')?.value || '').toLowerCase();
  const shelfFilter = document.getElementById('med-filter-shelf')?.value || '';
  const expFilter = document.getElementById('med-filter-exp')?.checked;

  const now = new Date();
  const in3m = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  let filtered = meds.filter(m => {
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (shelfFilter && m.shelf !== shelfFilter) return false;
    if (expFilter && m.exp) {
      const [ey, em] = m.exp.split('-').map(Number);
      const expDate = new Date(ey, em - 1, 1);
      if (expDate > in3m) return false;
    }
    if (expFilter && !m.exp) return false;
    return true;
  });

  // ソート
  filtered.sort((a, b) => {
    let va = a[medSortKey] || '', vb = b[medSortKey] || '';
    if (medSortKey === 'qty') { va = a.qty || 0; vb = b.qty || 0; }
    if (va < vb) return medSortAsc ? -1 : 1;
    if (va > vb) return medSortAsc ? 1 : -1;
    return 0;
  });

  document.getElementById('med-count').textContent = `${filtered.length} / ${meds.length} 件`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text2)">該当する薬品がありません</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    // 期限ステータス
    let status = '', statusStyle = '';
    if (m.exp) {
      const [ey, em] = m.exp.split('-').map(Number);
      const expDate = new Date(ey, em - 1, 1);
      if (expDate <= now) {
        status = '期限切れ'; statusStyle = 'background:#ffebee;color:#c62828;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold';
      } else if (expDate <= in3m) {
        status = '3ヶ月以内'; statusStyle = 'background:#fff3e0;color:#e65100;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold';
      } else {
        status = 'OK'; statusStyle = 'background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold';
      }
    }
    const expDisp = m.exp ? m.exp.replace('-', '/') : '-';
    return `<tr>
      <td style="text-align:left;font-weight:bold">${m.name}</td>
      <td style="text-align:left">${m.shelf || '-'}</td>
      <td style="text-align:right">${m.qty}</td>
      <td style="text-align:center">${expDisp}</td>
      <td style="text-align:center"><span style="${statusStyle}">${status}</span></td>
      <td style="text-align:center"><button onclick="removeMed(${m.id})" style="font-size:11px;border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">削除</button></td>
    </tr>`;
  }).join('');
}

function updateMedSuggestions() {
  const dl = document.getElementById('med-suggestions');
  if (!dl) return;
  const names = [...new Set(meds.map(m => m.name))];
  dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
}

function initZaiko() {
  renderShelves();
  renderMeds();
  updateMedSuggestions();
  renderOrderLists();
  renderPlanOrders();
  renderOrderHistory();
  renderReturnHistory();
}

// ===== 発注管理 =====
let planOrders = JSON.parse(localStorage.getItem('migiude_plan_orders') || '[]');
let orderHistory = JSON.parse(localStorage.getItem('migiude_order_history') || '[]');
let returnHistory = JSON.parse(localStorage.getItem('migiude_return_history') || '[]');

function renderOrderLists() {
  const threshold = parseInt(document.getElementById('order-threshold')?.value) || 1;
  const meds = JSON.parse(localStorage.getItem('migiude_meds') || '[]');
  const shortage = meds.filter(m => (m.qty || 0) <= threshold);
  const tbody = document.getElementById('order-shortage-tbody');
  if (!tbody) return;
  tbody.innerHTML = shortage.length ? shortage.map((m, i) =>
    `<tr><td>${m.name}</td><td>${m.shelf||'-'}</td><td style="text-align:right;color:#c0392b;font-weight:bold">${m.qty||0}</td>` +
    `<td><input type="number" value="1" min="1" id="order-qty-${i}" style="width:60px;padding:2px 4px;font-size:13px;text-align:right;border:1px solid var(--border);border-radius:4px"></td>` +
    `<td style="text-align:center"><input type="checkbox" class="order-check-shortage" data-idx="${i}"></td></tr>`
  ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text2)">在庫切れなし</td></tr>';
}

function toggleOrderAll(type) {
  const all = document.getElementById('order-all-' + type)?.checked;
  document.querySelectorAll('.order-check-' + type).forEach(c => c.checked = all);
}

function exportOrderList(type) {
  const rows = document.querySelectorAll('.order-check-' + type + ':checked');
  if (!rows.length) { alert('発注する薬品を選択してください'); return; }
  const meds = JSON.parse(localStorage.getItem('migiude_meds') || '[]');
  const threshold = parseInt(document.getElementById('order-threshold')?.value) || 1;
  const shortage = meds.filter(m => (m.qty || 0) <= threshold);
  const lines = ['薬品名,在庫数,発注数'];
  rows.forEach(c => {
    const idx = parseInt(c.dataset.idx);
    const m = shortage[idx];
    const qty = document.getElementById('order-qty-' + idx)?.value || 1;
    lines.push(`${m.name},${m.qty||0},${qty}`);
    orderHistory.unshift({date: new Date().toISOString().slice(0,10), name: m.name, qty: parseInt(qty), type: '在庫切れ', status: '発注済'});
  });
  localStorage.setItem('migiude_order_history', JSON.stringify(orderHistory));
  // CSVダウンロード
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `order_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  renderOrderHistory();
  alert(`${rows.length}品目の発注リストを出力しました`);
}

// 予製・在宅用計画発注
function addPlanOrder() {
  const name = document.getElementById('plan-order-name')?.value.trim();
  const qty = parseInt(document.getElementById('plan-order-qty')?.value) || 1;
  const use = document.getElementById('plan-order-use')?.value || '予製';
  const date = document.getElementById('plan-order-date')?.value || '';
  if (!name) { alert('薬品名を入力してください'); return; }
  planOrders.push({name, qty, use, date, status: '未発注'});
  localStorage.setItem('migiude_plan_orders', JSON.stringify(planOrders));
  document.getElementById('plan-order-name').value = '';
  renderPlanOrders();
}

function renderPlanOrders() {
  const tbody = document.getElementById('plan-order-tbody');
  if (!tbody) return;
  tbody.innerHTML = planOrders.length ? planOrders.map((o, i) =>
    `<tr><td>${o.name}</td><td style="text-align:right">${o.qty}</td><td>${o.use}</td><td>${o.date||'-'}</td>` +
    `<td><select onchange="updatePlanStatus(${i},this.value)" style="font-size:12px;padding:2px;border:1px solid var(--border);border-radius:4px">` +
    `<option${o.status==='未発注'?' selected':''}>未発注</option><option${o.status==='発注済'?' selected':''}>発注済</option><option${o.status==='納品済'?' selected':''}>納品済</option></select></td>` +
    `<td><button onclick="deletePlanOrder(${i})" style="font-size:11px;color:#c0392b;background:none;border:none;cursor:pointer">✕</button></td></tr>`
  ).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text2)">計画発注なし</td></tr>';
}

function updatePlanStatus(i, val) {
  planOrders[i].status = val;
  if (val === '発注済') {
    orderHistory.unshift({date: new Date().toISOString().slice(0,10), name: planOrders[i].name, qty: planOrders[i].qty, type: planOrders[i].use, status: '発注済'});
    localStorage.setItem('migiude_order_history', JSON.stringify(orderHistory));
    renderOrderHistory();
  }
  localStorage.setItem('migiude_plan_orders', JSON.stringify(planOrders));
}

function deletePlanOrder(i) {
  planOrders.splice(i, 1);
  localStorage.setItem('migiude_plan_orders', JSON.stringify(planOrders));
  renderPlanOrders();
}

function renderOrderHistory() {
  const tbody = document.getElementById('order-history-tbody');
  if (!tbody) return;
  tbody.innerHTML = orderHistory.length ? orderHistory.slice(0, 50).map(o =>
    `<tr><td>${o.date}</td><td>${o.name}</td><td style="text-align:right">${o.qty}</td><td>${o.type}</td><td>${o.status}</td></tr>`
  ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text2)">発注履歴なし</td></tr>';
}

// 期限切れ検出
function renderExpiredList() {
  const meds = JSON.parse(localStorage.getItem('migiude_meds') || '[]');
  const today = new Date().toISOString().slice(0, 7);
  const expired = meds.filter(m => m.exp && m.exp <= today);
  const tbody = document.getElementById('expired-tbody');
  if (!tbody) return;
  tbody.innerHTML = expired.length ? expired.map((m, i) =>
    `<tr style="background:#fff5f5"><td>${m.name}</td><td>${m.shelf||'-'}</td><td style="text-align:right">${m.qty||0}</td>` +
    `<td style="color:#c0392b;font-weight:bold">${m.exp}</td>` +
    `<td><button onclick="registerHaikiFromExpired('${m.name}',${m.qty||0})" style="font-size:12px;padding:2px 8px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer">廃棄</button></td></tr>`
  ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text2)">期限切れなし</td></tr>';
}

function registerHaikiFromExpired(name, qty) {
  document.getElementById('haiki-name').value = name;
  document.getElementById('haiki-qty').value = qty;
  document.getElementById('haiki-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('haiki-reason').value = '期限切れ';
  showSubTab('zaiko-haiki', document.querySelectorAll('#page-zaiko .sub-tab')[2]);
}

// 不動在庫検出
function renderStagnantList() {
  const meds = JSON.parse(localStorage.getItem('migiude_meds') || '[]');
  const months = parseInt(document.getElementById('stagnant-months')?.value) || 6;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  // lastUsed が未設定 or cutoff以前のもの
  const stagnant = meds.filter(m => m.qty > 0 && (!m.lastUsed || m.lastUsed < cutoffStr));
  const tbody = document.getElementById('stagnant-tbody');
  if (!tbody) return;
  tbody.innerHTML = stagnant.length ? stagnant.map(m =>
    `<tr><td>${m.name}</td><td>${m.shelf||'-'}</td><td style="text-align:right">${m.qty}</td><td>${m.exp||'-'}</td>` +
    `<td style="color:#9C27B0">${m.lastUsed||'不明'}</td>` +
    `<td><button onclick="registerReturn('${m.name}',${m.qty})" style="font-size:12px;padding:2px 8px;background:#9C27B0;color:#fff;border:none;border-radius:4px;cursor:pointer">返却</button></td></tr>`
  ).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text2)">不動在庫なし</td></tr>';
}

function registerReturn(name, qty) {
  const dest = prompt(`${name} ${qty}個の返却先（卸名）を入力：`);
  if (!dest) return;
  const refund = prompt('返金額（円）：') || '0';
  returnHistory.unshift({date: new Date().toISOString().slice(0,10), name, qty, dest, refund: parseInt(refund)||0});
  localStorage.setItem('migiude_return_history', JSON.stringify(returnHistory));
  renderReturnHistory();
  renderStagnantList();
}

function renderReturnHistory() {
  const tbody = document.getElementById('return-history-tbody');
  if (!tbody) return;
  tbody.innerHTML = returnHistory.length ? returnHistory.map(r =>
    `<tr><td>${r.date}</td><td>${r.name}</td><td style="text-align:right">${r.qty}</td><td>${r.dest}</td><td style="text-align:right">${r.refund?.toLocaleString()||0}円</td></tr>`
  ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text2)">返却履歴なし</td></tr>';
}

// ===== 業務マニュアル動画 =====
let manualVideos = JSON.parse(localStorage.getItem('migiude_videos') || '{}');

function addVideo(key) {
  const input = document.getElementById('video-' + key + '-url');
  const url = input.value.trim();
  if (!url) return;
  if (!manualVideos[key]) manualVideos[key] = [];
  manualVideos[key].push(url);
  localStorage.setItem('migiude_videos', JSON.stringify(manualVideos));
  input.value = '';
  renderVideos(key);
}

function removeVideo(key, idx) {
  manualVideos[key].splice(idx, 1);
  localStorage.setItem('migiude_videos', JSON.stringify(manualVideos));
  renderVideos(key);
}

function renderVideos(key) {
  const list = document.getElementById('video-' + key + '-list');
  if (!list) return;
  const videos = manualVideos[key] || [];
  if (videos.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = videos.map((url, i) => {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) {
      return `<div style="position:relative">
        <iframe width="280" height="158" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen style="border-radius:6px"></iframe>
        <button onclick="removeVideo('${key}',${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px">&times;</button>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:4px;background:var(--card);border:1px solid var(--border);border-radius:4px;padding:4px 8px">
      <a href="${url}" target="_blank" style="font-size:12px;color:var(--purple);max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${url}</a>
      <button onclick="removeVideo('${key}',${i})" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:14px">&times;</button>
    </div>`;
  }).join('');
}

function initManualVideos() {
  ['chozai','kasan','todoke','receipt','zaitaku','daily'].forEach(renderVideos);
}

// ===== カレンダー =====
let calYear = 2026, calMonth = 3; // 表示中の年月
let calEvents = []; // {date:'2026-05-31', text:'...', type:'todoke'}

// 固定イベント（R8改定関連）
const CAL_FIXED = [
  {date:'2026-04-01', text:'薬価改定 施行', type:'kigen'},
  {date:'2026-05-31', text:'R8届出 提出期限', type:'kigen'},
  {date:'2026-06-01', text:'R8調剤報酬改定 施行', type:'kigen'},
  {date:'2027-05-31', text:'後発体制加算 経過措置終了', type:'kigen'},
  // 定期業務
  {date:'*-*-01', text:'月次レセプト提出', type:'teiki'},
  {date:'*-*-10', text:'レセプト返戻対応期限', type:'teiki'},
  {date:'*-03-01', text:'施設基準 定例報告', type:'jimu'},
  {date:'*-04-01', text:'薬価改定（毎年）', type:'jimu'},
  {date:'*-07-01', text:'届出実績の集計開始', type:'jimu'},
];

function initCalendar() {
  const saved = JSON.parse(localStorage.getItem('migiude_cal') || '[]');
  calEvents = saved;
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth() + 1;
  // Excelスケジュールを読み込み（未取込なら）
  if (!localStorage.getItem('migiude_cal_imported')) {
    fetch('calendar_events.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (data.length) {
          const existing = new Set(calEvents.map(e => e.date + e.text));
          data.forEach(e => {
            const key = e.date + e.text;
            if (!existing.has(key)) {
              calEvents.push({date: e.date, text: e.text, type: e.source === '原尻' ? 'jimu' : 'teiki'});
            }
          });
          localStorage.setItem('migiude_cal', JSON.stringify(calEvents));
          localStorage.setItem('migiude_cal_imported', '1');
          renderCalendar();
        }
      })
      .catch(() => {});
  }
  renderCalendar();
  updateCalAssignSelect();
  updateTaskAssignSelects();
}

function calMove(d) { calMonth += d; if (calMonth > 12) { calMonth = 1; calYear++; } if (calMonth < 1) { calMonth = 12; calYear--; } renderCalendar(); }
function calToday() { const t = new Date(); calYear = t.getFullYear(); calMonth = t.getMonth()+1; renderCalendar(); }

function renderCalendar() {
  const r = calYear - 2018;
  document.getElementById('cal-title').textContent = `R${r}年（${calYear}年）${calMonth}月`;

  const first = new Date(calYear, calMonth-1, 1);
  const last = new Date(calYear, calMonth, 0);
  const startDay = first.getDay(); // 0=日
  const daysInMonth = last.getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // 全イベントを取得（固定＋カスタム）
  function getEvents(dateStr) {
    const evts = [];
    const [y,m,d] = dateStr.split('-');
    CAL_FIXED.forEach(e => {
      const [ey,em,ed] = e.date.split('-');
      if ((ey === '*' || ey === y) && (em === '*' || em === m) && (ed === '*' || ed === d)) {
        evts.push(e);
      }
    });
    calEvents.forEach(e => { if (e.date === dateStr) evts.push(e); });
    return evts;
  }

  let html = '';
  // 曜日ヘッダー
  ['日','月','火','水','木','金','土'].forEach(d => html += `<div class="cal-head">${d}</div>`);

  // 前月の空白
  for (let i = 0; i < startDay; i++) {
    html += '<div class="cal-cell other"></div>';
  }

  // 日付セル
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const evts = getEvents(dateStr);

    html += `<div class="cal-cell${isToday ? ' today' : ''}">`;
    html += `<div class="cal-day">${d}</div>`;
    evts.forEach(e => {
      html += `<div class="cal-evt ${e.type}" title="${e.text}">${e.text}</div>`;
    });
    html += `<div class="cal-add" onclick="prefillCalDate('${dateStr}')">+ 追加</div>`;
    html += '</div>';
  }

  // 末尾の空白
  const totalCells = startDay + daysInMonth;
  const remain = totalCells % 7 ? 7 - (totalCells % 7) : 0;
  for (let i = 0; i < remain; i++) {
    html += '<div class="cal-cell other"></div>';
  }

  document.getElementById('cal-grid').innerHTML = html;
}

function prefillCalDate(dateStr) {
  document.getElementById('cal-add-date').value = dateStr;
  document.getElementById('cal-add-text').focus();
}

function addCalEvent() {
  const date = document.getElementById('cal-add-date').value;
  const text = document.getElementById('cal-add-text').value.trim();
  const type = document.getElementById('cal-add-type').value;
  const assign = document.getElementById('cal-add-assign')?.value || '';
  if (!date || !text) return;
  const evt = {date, text, type, assign};
  calEvents.push(evt);
  localStorage.setItem('migiude_cal', JSON.stringify(calEvents));
  // タスクタイプならタスクタブにも連携
  if (type === 'task') {
    dailyTasks.push({
      id: Date.now(),
      text,
      assign,
      due: date,
      priority: 'normal',
      done: false,
      calLinked: true
    });
    localStorage.setItem('migiude_daily_tasks', JSON.stringify(dailyTasks));
    renderDailyTasks();
  }
  document.getElementById('cal-add-text').value = '';
  renderCalendar();
}

// カレンダーの担当者セレクトをスタッフと連動
function updateCalAssignSelect() {
  const sel = document.getElementById('cal-add-assign');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">担当なし</option>';
  staffList.forEach(s => {
    sel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
  });
  sel.value = current;
}

// ===== 経営改善分析 =====
function analyzeKaizen() {
  // 直近データを集計
  const months = Object.keys(DB).sort();
  if (months.length === 0) {
    document.getElementById('kaizen-status').textContent = 'データがありません。先に月次報酬ページで月次データを保存してください。';
    return;
  }
  const latest = months.slice(-3); // 直近3ヶ月
  const avg = {};
  FIELDS.forEach(f => {
    let sum = 0, cnt = 0;
    latest.forEach(m => { if (DB[m] && DB[m][f]) { sum += DB[m][f]; cnt++; } });
    avg[f] = cnt ? sum / cnt : 0;
  });

  const rx = avg.rx_count || 1; // 月間受付回数
  const rxYear = rx * 12; // 年間受付回数
  const now = [], bench = [], long = [];
  let totalUp = 0; // 改善合計

  function card(cls, title, effect, body, tasks, upYen) {
    let h = `<div class="kaizen-card ${cls}"><div class="kaizen-title">${title} <span class="kaizen-effect">${effect}</span>`;
    if (upYen) {
      h += ` <span style="font-size:12px;font-weight:700;color:#2e7d32;margin-left:auto">年間 +${upYen.toLocaleString()}円</span>`;
      totalUp += upYen;
    }
    h += `</div><div class="kaizen-body">${body}`;
    if (tasks && tasks.length) {
      h += '<ul style="margin:8px 0 0;padding-left:18px">';
      tasks.forEach(t => h += `<li>${t}</li>`);
      h += '</ul>';
    }
    h += '</div></div>';
    return h;
  }

  // ===== すぐにできる =====

  // 手帳持参率 → 薬B→薬A切替による差額
  if (avg.techo_rate && avg.techo_rate < 95) {
    const bCnt = avg.fuyaku_b_cnt || 0;
    const gainPerMonth = Math.round(bCnt * 0.3) * (59-45) * 10; // 30%を薬Aに切替
    const gainYear = gainPerMonth * 12;
    now.push(card('high', '手帳持参率の向上', `現在${avg.techo_rate.toFixed(1)}% → 目標95%+`,
      `手帳持参率が高いほど服薬管理指導料（薬A）45点で算定できる割合が増える。薬B月${Math.round(bCnt)}件の30%を薬Aに切替で<b>月${gainPerMonth.toLocaleString()}円</b>。`,
      ['来局時に「お薬手帳はお持ちですか？」の声かけを徹底','手帳アプリの案内・導入サポート','待合室に手帳メリットの掲示'], gainYear));
  }

  // 後発品調剤率 → 体制加算の区分アップ
  if (avg.ge_rate && avg.ge_rate < 90) {
    const currentPt = avg.ge_rate >= 85 ? 28 : avg.ge_rate >= 80 ? 21 : 0;
    const targetPt = 30;
    const gainYear = (targetPt - currentPt) * 10 * rxYear;
    now.push(card('high', '後発医薬品調剤率の向上', `現在${avg.ge_rate.toFixed(1)}% → 目標90%+`,
      `R8では地域支援・医薬品供給対応体制加算の基本要件。90%以上で加算3（30点）→現在${currentPt}点との差<b>${targetPt-currentPt}点×${rxYear.toLocaleString()}枚</b>。`,
      ['変更不可の処方箋は処方医に一般名処方を依頼','患者への後発品説明を強化','在庫品目の後発品切替リスト作成'], gainYear));
  }

  // 重複防止→薬学的有害事象等防止加算
  const jukufuku = (avg.jukufuku_other_cnt || 0) + (avg.jukufuku_zan_cnt || 0);
  if (jukufuku < rx * 0.02) {
    const addCnt = Math.round(rx * 0.02) - Math.round(jukufuku);
    const gainYear = addCnt * 40 * 10 * 12;
    now.push(card('high', '疑義照会・処方変更提案の強化', '薬学的有害事象等防止加算（R8新設30〜50点）',
      `月${addCnt}件の増加見込み。40点×${addCnt}件×12ヶ月で<b>年${gainYear.toLocaleString()}円</b>。`,
      ['薬歴確認時の重複・相互作用チェックの徹底','疑義照会テンプレートの整備','算定漏れ防止のチェックリスト作成'], gainYear));
  }

  // 調剤後フォローアップ
  if ((avg.chozaigo_60_cnt || 0) === 0) {
    const estCnt = Math.max(3, Math.round(rx * 0.003));
    const gainYear = estCnt * 60 * 10 * 12;
    now.push(card('high', '調剤後フォローアップの開始', '調剤後薬剤管理指導料 60点/件',
      `糖尿病・心不全患者を月${estCnt}件フォローで<b>年${gainYear.toLocaleString()}円</b>。地域支援体制加算の届出薬局であれば即開始可能。`,
      ['対象患者（インスリン新規・心不全）のリストアップ','フォロー電話のスクリプト作成','処方医への報告書テンプレート準備'], gainYear));
  }

  // 服薬情報等提供料
  const johoCnt = (avg.fuyaku_joho1_cnt || 0) + (avg.fuyaku_joho2_cnt || 0);
  if (johoCnt < rx * 0.01) {
    const addCnt = Math.max(3, Math.round(rx * 0.01)) - Math.round(johoCnt);
    const gainYear = addCnt * 25 * 10 * 12; // 平均25点
    now.push(card('high', '服薬情報等提供（トレーシングレポート）の強化', '提供料1：30点 / 提供料2：20点',
      `月${addCnt}件増で<b>年${gainYear.toLocaleString()}円</b>。地域支援体制加算の実績要件（年30回以上/1万枚）にも直結。`,
      ['トレーシングレポートのテンプレート整備','副作用・服用状況の変化を見つけたら即レポート','門前医療機関との連携フロー構築'], gainYear));
  }

  // ===== ベンチマーク比較 =====

  const kakari = avg.kakari_76_cnt || 0;
  if (kakari < rx * 0.02) {
    const addCnt = Math.round(rx * 0.02) - Math.round(kakari);
    // R8: FU加算50点(3月1回)＋服薬管理指導料の差なし→FU加算のみ
    const gainYear = addCnt * 50 * 10 * 4; // 3月1回=年4回
    bench.push(card('mid', 'かかりつけ薬剤師の算定拡大', `月${Math.round(kakari)}件 → 目安：受付の2〜5%`,
      `月${addCnt}件増×R8 FU加算50点×年4回で<b>年${gainYear.toLocaleString()}円</b>。`,
      ['かかりつけ薬剤師の要件を満たす薬剤師の確認・育成','患者への同意取得の声かけ強化','慢性疾患・多剤服用の患者を優先的にアプローチ'], gainYear));
  }

  const zaitaku = (avg.zaitaku_1nin_cnt || 0) + (avg.zaitaku_2_9_cnt || 0) + (avg.zaitaku_10_cnt || 0);
  if (zaitaku < 2) {
    const addCnt = Math.max(2, 4 - Math.round(zaitaku));
    // 訪問1件=650点+薬学管理料等≒800点
    const gainYear = addCnt * 800 * 10 * 12;
    bench.push(card('mid', '在宅訪問件数の拡大', `月${Math.round(zaitaku)}件 → 月4件目標`,
      `月${addCnt}件増×約800点で<b>年${gainYear.toLocaleString()}円</b>。在宅薬学総合体制加算30点も全処方箋に上乗せ。`,
      ['ケアマネ・訪問看護ステーションへの営業','地域包括支援センターとの連携','在宅訪問の初回フローマニュアル整備'], gainYear));
  }

  if ((avg.gaifuku1_cnt || 0) < 1) {
    const gainYear = 2 * 185 * 10 * 12; // 月2件
    bench.push(card('mid', '残薬整理（外来服薬支援料1）の算定開始', '185点/回',
      `月2件で<b>年${gainYear.toLocaleString()}円</b>。地域支援の実績要件にもカウント。`,
      ['残薬が多い患者のスクリーニング','残薬確認→整理→処方医報告のフロー整備','ブラウンバッグ運動の実施'], gainYear));
  }

  if ((avg.kyunyu_30_cnt || 0) < 1) {
    const estPatients = Math.max(5, Math.round(rx * 0.01));
    const gainYear = estPatients * 30 * 10 * 2; // 6月に1回=年2回
    bench.push(card('mid', '吸入薬指導加算の算定', '30点 × 6月に1回（R8）',
      `対象患者${estPatients}名×年2回で<b>年${gainYear.toLocaleString()}円</b>。`,
      ['喘息・COPD処方の患者リスト作成','吸入指導チェックリスト・デバイスの準備','処方医への報告書テンプレート'], gainYear));
  }

  if ((avg.fukuyou1_cnt || 0) === 0) {
    const gainYear = 1 * 125 * 10 * 12; // 月1件
    bench.push(card('mid', 'ポリファーマシー対策（服用薬剤調整支援料）', '支援料1：125点',
      `月1件の減薬達成で<b>年${gainYear.toLocaleString()}円</b>。患者の安全と収益の両立。`,
      ['6剤以上の患者をレセコンで抽出','減薬提案書のテンプレート整備','処方医との合同カンファレンス'], gainYear));
  }

  // ===== 中長期 =====

  // 地域支援上位区分
  const currentChiiki = avg.chiiki_amt ? Math.round(avg.chiiki_amt / rx / 10) : 32;
  const targetChiiki = 59;
  if (currentChiiki < targetChiiki) {
    const gainYear = (targetChiiki - currentChiiki) * 10 * rxYear;
    long.push(card('low', '地域支援・医薬品供給対応体制加算の上位区分取得', `加算2：59点（現在${currentChiiki}点）`,
      `全処方箋で+${targetChiiki - currentChiiki}点×${rxYear.toLocaleString()}枚＝<b>年${gainYear.toLocaleString()}円</b>。`,
      ['現在の実績要件充足状況をR8改定ページで確認','不足している要件項目を重点的に取り組む','年間計画を作成し月次で進捗管理'], gainYear));
  }

  {
    const gainYear = 100 * 10 * zaitaku * 12; // 在宅件数×100点
    long.push(card('low', '在宅薬学総合体制加算2の取得', 'R8加算2イ：100点',
      `現在の在宅月${Math.round(zaitaku)}件×100点で<b>年${gainYear.toLocaleString()}円</b>（件数拡大でさらに増）。`,
      ['クリーンベンチの導入検討','麻薬小売業者免許の取得・麻薬備蓄の拡充','在宅がん患者の受入体制整備'], gainYear));
  }

  {
    const gainYear = 50 * 10 * Math.round(rxYear * 0.01); // 処方箋の1%
    long.push(card('low', 'バイオ後続品調剤体制の整備', 'R8新設：50点',
      `対象処方 年${Math.round(rxYear*0.01)}件×50点で<b>年${gainYear.toLocaleString()}円</b>。`,
      ['バイオ医薬品の保管設備（冷蔵庫等）の確認','バイオシミラーの在庫品目の拡充','患者向け説明資料の作成'], gainYear));
  }

  {
    const gainYear = 7 * 10 * rxYear; // 全処方箋に7点
    long.push(card('low', '電子処方箋の活用拡大', '電子的調剤情報連携体制整備加算 7点',
      `全処方箋に7点で<b>年${gainYear.toLocaleString()}円</b>。DX投資が収益に直結。`,
      ['マイナ保険証の利用促進（声かけ・掲示）','電子処方箋の受付フロー最適化','重複投薬チェック結果の活用・記録体制'], gainYear));
  }

  {
    const addKakari = Math.round(rx * 0.03);
    const gainYear = addKakari * 50 * 10 * 4; // FU加算50点×年4回
    long.push(card('low', 'かかりつけ薬剤師の人材育成', 'R8 FU加算50点 + 訪問加算230点',
      `薬剤師育成により月${addKakari}名増×FU加算年4回で<b>年${gainYear.toLocaleString()}円</b>。`,
      ['研修認定薬剤師の取得支援（費用補助・勤務調整）','地域の健康イベント・学校薬剤師等への参画','勤続年数要件を意識した人員配置'], gainYear));
  }

  // 表示
  document.getElementById('kaizen-now').innerHTML = now.length ? now.join('') : '<p style="color:var(--text2);font-size:13px">現在のデータでは即時改善項目はありません。</p>';
  document.getElementById('kaizen-bench').innerHTML = bench.length ? bench.join('') : '<p style="color:var(--text2);font-size:13px">ベンチマーク比較の結果、改善余地のある項目はありません。</p>';
  document.getElementById('kaizen-long').innerHTML = long.join('');

  const totalStr = totalUp.toLocaleString();
  document.getElementById('kaizen-status').innerHTML = `✓ 直近${latest.length}ヶ月のデータで分析（${latest[0]}〜${latest[latest.length-1]}）｜<b style="color:#2e7d32;font-size:15px">全改善実施で年間 +${totalStr}円</b>`;
  document.getElementById('kaizen-status').style.color = 'var(--teal)';
}

// ===== 事務タスク管理 =====
function toggleTask(cb) {
  const card = cb.closest('.task-card');
  card.classList.toggle('done', cb.checked);
  saveTaskState();
  updateTaskProgress();
}

function saveTaskState() {
  const state = {};
  document.querySelectorAll('.task-card[data-task]').forEach(card => {
    const cb = card.querySelector('input[type=checkbox]');
    if (cb) state[card.dataset.task] = cb.checked;
  });
  localStorage.setItem('pharmacy_tasks', JSON.stringify(state));
}

function loadTaskState() {
  const state = JSON.parse(localStorage.getItem('pharmacy_tasks') || '{}');
  document.querySelectorAll('.task-card[data-task]').forEach(card => {
    const cb = card.querySelector('input[type=checkbox]');
    if (cb && state[card.dataset.task]) {
      cb.checked = true;
      card.classList.add('done');
    }
  });
  updateTaskProgress();
}

function updateTaskProgress() {
  const all = document.querySelectorAll('.task-card[data-task]');
  const done = document.querySelectorAll('.task-card.done');
  const el = document.getElementById('task-progress');
  if (el) el.textContent = `${done.length} / ${all.length} 完了`;
}

// ======== State ========
let DB = {}; // { "2025-05": { ... } }

const MONTHS_ORDER = [];
function genMonths() {
  let d = new Date(2025, 4, 1); // 2025-05
  const end = new Date();
  while (d <= end) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!MONTHS_ORDER.includes(key)) MONTHS_ORDER.push(key);
    d.setMonth(d.getMonth()+1);
  }
}
genMonths();

function warekiLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const reiwa = y - 2018;
  return `R${reiwa}.${m}`;
}

// ======== Navigation ========
const LOCKED_PAGES = ['shishutsu', 'auto'];
let unlockedPages = {};

function showPage(id) {
  if (LOCKED_PAGES.includes(id) && !unlockedPages[id]) {
    const pw = prompt('パスワードを入力してください');
    if (!pw) return;
    const savedPw = localStorage.getItem('migiude_page_pw') || 'migiude';
    if (pw !== savedPw) { alert('パスワードが違います'); return; }
    unlockedPages[id] = true;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  // nav-tabのアクティブ化（onclickで呼ばれた要素を特定）
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.getAttribute('onclick') && t.getAttribute('onclick').includes("'" + id + "'")) t.classList.add('active');
  });
  if (id === 'input') renderMonthList();
  if (id === 'kaizen') { updateGoals(); renderTrend(); }
  if (id === 'calendar') renderCalendar();
}

function changePagePassword() {
  const current = prompt('現在のパスワード');
  const savedPw = localStorage.getItem('migiude_page_pw') || 'migiude';
  if (current !== savedPw) { alert('パスワードが違います'); return; }
  const newPw = prompt('新しいパスワード');
  if (!newPw) return;
  localStorage.setItem('migiude_page_pw', newPw);
  alert('パスワードを変更しました');
}

function showSubTab(paneId, tab) {
  const parent = tab.closest('.page');
  parent.querySelectorAll('.sub-pane').forEach(p => p.classList.remove('active'));
  parent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(paneId).classList.add('active');
  tab.classList.add('active');
}

// ======== Save / Load ========
const FIELDS = ['rx_count','rx_sheets','ge_rate','zai_count','avg_zai','total_reward','rx_price','techo_rate',
  'kihon45_cnt','kihon45_pt','kihon45_amt','chiiki_cnt','chiiki_pt','chiiki_amt',
  'kouhatsu_cnt','kouhatsu_pt','kouhatsu_amt','renkei_cnt','renkei_pt','renkei_amt',
  'dx8_cnt','dx8_pt','dx8_amt','dx10_cnt','dx10_pt','dx10_amt',
  'zaitaku15_cnt','zaitaku15_pt','zaitaku15_amt','yakan_cnt','yakan_pt','yakan_amt','kihon_total',
  'naifuku_zai','naifuku_yakuzai','naifuku_cnt','naifuku_amt',
  'sinsenn_zai','sinsenn_yakuzai','sinsenn_cnt','sinsenn_amt',
  'yuyaku_zai','yuyaku_yakuzai','yuyaku_cnt','yuyaku_amt',
  'tonpuku_zai','tonpuku_yakuzai','tonpuku_cnt','tonpuku_amt',
  'gaiyou_zai','gaiyou_yakuzai','gaiyou_cnt','gaiyou_amt',
  'chusya_zai','chusya_yakuzai','chusya_cnt','chusya_amt',
  'naiteki_zai','naiteki_yakuzai','naiteki_cnt','naiteki_amt',
  'zairyo_zai','zairyo_yakuzai','zairyo_cnt','zairyo_amt',
  'chozai_cnt_total','chozai_total',
  'kaz_nai_mayaku',
  'kaz_nai_doku',
  'kaz_nai_kakusei',
  'kaz_nai_mukyoko',
  'kaz_nai_keiryo',
  'kaz_nai_keiryo_yo',
  'kaz_nai_jika',
  'kaz_nai_jika_yo',
  'kaz_nai_mukin',
  'kaz_nai_jikou',
  'kaz_nai_total',
  'kaz_sin_mayaku',
  'kaz_sin_doku',
  'kaz_sin_kakusei',
  'kaz_sin_mukyoko',
  'kaz_sin_keiryo',
  'kaz_sin_keiryo_yo',
  'kaz_sin_jika',
  'kaz_sin_jika_yo',
  'kaz_sin_mukin',
  'kaz_sin_jikou',
  'kaz_sin_total',
  'kaz_yu_mayaku',
  'kaz_yu_doku',
  'kaz_yu_kakusei',
  'kaz_yu_mukyoko',
  'kaz_yu_keiryo',
  'kaz_yu_keiryo_yo',
  'kaz_yu_jika',
  'kaz_yu_jika_yo',
  'kaz_yu_mukin',
  'kaz_yu_jikou',
  'kaz_yu_total',
  'kaz_ton_mayaku',
  'kaz_ton_doku',
  'kaz_ton_kakusei',
  'kaz_ton_mukyoko',
  'kaz_ton_keiryo',
  'kaz_ton_keiryo_yo',
  'kaz_ton_jika',
  'kaz_ton_jika_yo',
  'kaz_ton_mukin',
  'kaz_ton_jikou',
  'kaz_ton_total',
  'kaz_gai_mayaku',
  'kaz_gai_doku',
  'kaz_gai_kakusei',
  'kaz_gai_mukyoko',
  'kaz_gai_keiryo',
  'kaz_gai_keiryo_yo',
  'kaz_gai_jika',
  'kaz_gai_jika_yo',
  'kaz_gai_mukin',
  'kaz_gai_jikou',
  'kaz_gai_total',
  'kaz_chu_mayaku',
  'kaz_chu_doku',
  'kaz_chu_kakusei',
  'kaz_chu_mukyoko',
  'kaz_chu_keiryo',
  'kaz_chu_keiryo_yo',
  'kaz_chu_jika',
  'kaz_chu_jika_yo',
  'kaz_chu_mukin',
  'kaz_chu_jikou',
  'kaz_chu_total',
  'kaz_nai2_mayaku',
  'kaz_nai2_doku',
  'kaz_nai2_kakusei',
  'kaz_nai2_mukyoko',
  'kaz_nai2_keiryo',
  'kaz_nai2_keiryo_yo',
  'kaz_nai2_jika',
  'kaz_nai2_jika_yo',
  'kaz_nai2_mukin',
  'kaz_nai2_jikou',
  'kaz_nai2_total',
  'kaz_mat_mayaku',
  'kaz_mat_doku',
  'kaz_mat_kakusei',
  'kaz_mat_mukyoko',
  'kaz_mat_keiryo',
  'kaz_mat_keiryo_yo',
  'kaz_mat_jika',
  'kaz_mat_jika_yo',
  'kaz_mat_mukin',
  'kaz_mat_jikou',
  'kaz_mat_total',
  'kaz_col_mayaku',
  'kaz_col_doku',
  'kaz_col_kakusei',
  'kaz_col_mukyoko',
  'kaz_col_keiryo',
  'kaz_col_keiryo_yo',
  'kaz_col_jika',
  'kaz_col_jika_yo',
  'kaz_col_mukin',
  'kaz_col_jikou',
  'chozai_kazan_total',
  'chmgr_nai_amt',
  'chmgr_7_cnt','chmgr_7_amt',
  'chmgr_8_14_cnt','chmgr_8_14_amt',
  'chmgr_15_28_cnt','chmgr_15_28_amt',
  'chmgr_29_cnt','chmgr_29_amt',
  'chmgr_other_cnt','chmgr_other_amt',
  'jukufuku_other_cnt','jukufuku_other_amt',
  'jukufuku_zan_cnt','jukufuku_zan_amt',
  'iryo_joho_cnt','iryo_joho_amt',
  'jikangai_kanri_amt',
  'fuyaku_a_cnt','fuyaku_a_amt',
  'fuyaku_b_cnt','fuyaku_b_amt',
  'fuyaku_c_cnt','fuyaku_c_amt',
  'fuyaku_3_cnt','fuyaku_3_amt',
  'fuyaku_toku2a_cnt','fuyaku_toku2a_amt',
  'kakari_76_cnt','kakari_76_amt',
  'mayaku_shido_cnt','mayaku_shido_amt',
  'tokutei_1i_cnt','tokutei_1i_amt',
  'tokutei_1ro_cnt','tokutei_1ro_amt',
  'tokutei_2_cnt','tokutei_2_amt',
  'tokutei_3i_cnt','tokutei_3i_amt',
  'tokutei_3ro_cnt','tokutei_3ro_amt',
  'nyuyoji_12_cnt','nyuyoji_12_amt',
  'shoni_350_cnt','shoni_350_amt',
  'kyunyu_30_cnt','kyunyu_30_amt',
  'chozaigo_60_cnt','chozaigo_60_amt',
  'kakari_291_cnt','kakari_291_amt',
  'fuyaku_joho1_cnt','fuyaku_joho1_amt',
  'fuyaku_joho2_cnt','fuyaku_joho2_amt',
  'fuyaku_joho3_cnt','fuyaku_joho3_amt',
  'gaifuku1_cnt','gaifuku1_amt',
  'gaifuku2_7_cnt','gaifuku2_7_amt',
  'gaifuku2_14_cnt','gaifuku2_14_amt',
  'gaifuku2_21_cnt','gaifuku2_21_amt',
  'gaifuku2_28_cnt','gaifuku2_28_amt',
  'gaifuku2_35_cnt','gaifuku2_35_amt',
  'gaifuku2_42_cnt','gaifuku2_42_amt',
  'gaifuku2_43_cnt','gaifuku2_43_amt',
  'setsurenkei_cnt','setsurenkei_amt',
  'fukuyou1_cnt','fukuyou1_amt',
  'fukuyou2_amt',
  'keikan_amt',
  'yakugaku_total',
  'zaitaku_1nin_cnt','zaitaku_1nin_amt',
  'zaitaku_2_9_cnt','zaitaku_2_9_amt',
  'zaitaku_10_cnt','zaitaku_10_amt',
  'zaitaku_kinkyu1_cnt','zaitaku_kinkyu1_amt',
  'zaitaku_kinkyu2_cnt','zaitaku_kinkyu2_amt',
  'zaitaku_kyodo_cnt','zaitaku_kyodo_amt',
  'zaitaku_mayaku_cnt','zaitaku_mayaku_amt',
  'zaitaku_nyuyoji_cnt','zaitaku_nyuyoji_amt',
  'zaitaku_shoni_cnt','zaitaku_shoni_amt',
  'zaitaku_mayaku_chu_cnt','zaitaku_mayaku_chu_amt',
  'zaitaku_chushin_cnt','zaitaku_chushin_amt',
  'yakan_homon_cnt','yakan_homon_amt',
  'kyujitsu_homon_cnt','kyujitsu_homon_amt',
  'shinya_homon_cnt','shinya_homon_amt',
  'zaitaku_jukufuku_other_cnt','zaitaku_jukufuku_other_amt',
  'zaitaku_jukufuku_zan_cnt','zaitaku_jukufuku_zan_amt',
  'taiin_kyodo_cnt','taiin_kyodo_amt',
  'zaitaku_iko_cnt','zaitaku_iko_amt',
  'zaitaku_total',
  'kaigo1_cnt','kaigo1_amt',
  'kaigo2_cnt','kaigo2_amt',
  'kaigo3_cnt','kaigo3_amt',
  'kaigo4_cnt','kaigo4_amt',
  'kaigo_y1_cnt','kaigo_y1_amt',
  'kaigo_y2_cnt','kaigo_y2_amt',
  'kaigo_y3_cnt','kaigo_y3_amt',
  'kaigo_mayaku_cnt','kaigo_mayaku_amt',
  'kaigo_chushin_cnt','kaigo_chushin_amt',
  'kaigo_total',
  'hoken_futan2','jhi_chozai_amt','sentei_amt','hokengai_amt','otc_amt','bussan_amt','hokengai_total','ika_total','kaigo_total_summary','other_total_summary','grand_total'];

function saveEntry(silent) {
  const month = document.getElementById('input-month').value;
  if (!month) { if (!silent) alert('月を選択してください'); return; }
  const entry = {};
  FIELDS.forEach(f => {
    const el = document.getElementById('e_' + f);
    if (el) entry[f] = el.value !== '' ? parseFloat(el.value) : null;
  });
  DB[month] = entry;
  localStorage.setItem('pharmacy_db', JSON.stringify(DB));
  autoSaveJSON(); // JSONファイルにも自動保存
  renderMonthList();
  updatePeriodSelect();
  updateGoals();
  if (!silent) alert(`${warekiLabel(month)} のデータを保存しました`);
}

function loadEntry() {
  const month = document.getElementById('input-month').value;
  if (!DB[month]) { clearFields(); updateGoals(); return; }
  const entry = DB[month];
  FIELDS.forEach(f => {
    const el = document.getElementById('e_' + f);
    if (el) el.value = entry[f] !== null && entry[f] !== undefined ? entry[f] : '';
  });
  updateGoals();
}

function clearFields() {
  FIELDS.forEach(f => { const el = document.getElementById('e_' + f); if (el) el.value = ''; });
}

function deleteEntry() {
  const month = document.getElementById('input-month').value;
  if (!DB[month]) return;
  if (!confirm(`${warekiLabel(month)} のデータを削除しますか？`)) return;
  delete DB[month];
  localStorage.setItem('pharmacy_db', JSON.stringify(DB));
  clearFields();
  renderMonthList();
  updatePeriodSelect();
}

function renderMonthList() {
  const el = document.getElementById('month-list');
  const current = document.getElementById('input-month').value;
  el.innerHTML = MONTHS_ORDER.map(m => {
    const has = DB[m] ? '●' : '';
    return `<div class="month-tab ${m===current?'active':''} ${DB[m]?'':'opacity50'}"
      onclick="selectMonth('${m}')"
      style="${DB[m]?'':'opacity:.5'}">${warekiLabel(m)} ${has}</div>`;
  }).join('');
}

function selectMonth(m) {
  document.getElementById('input-month').value = m;
  loadEntry();
  renderMonthList();
}

function updatePeriodSelect() {
  const sel = document.getElementById('period-select');
  const months = Object.keys(DB).sort();
  if (sel) {
    sel.innerHTML = '<option value="all">全期間（R7.5〜現在）</option>';
    months.forEach(m => {
      sel.innerHTML += `<option value="${m}">${warekiLabel(m)}</option>`;
    });
  }
  const cnt = document.getElementById('data-count');
  if (cnt) cnt.textContent = months.length > 0 ? `${months.length}ヶ月分のデータあり` : '';
}






// ===== 達成目標 =====
function updateGoals() {
  // R7.5〜R8.4の全月を集計
  const targetMonths = [];
  for (let y = 2025, m = 5; ; ) {
    targetMonths.push(`${y}-${String(m).padStart(2,'0')}`);
    m++; if (m > 12) { m = 1; y++; }
    if (y === 2026 && m > 4) break;
  }
  const existing = targetMonths.filter(m => DB[m]);
  if (existing.length === 0) {
    document.getElementById('goal-cards').innerHTML = '<p style="font-size:13px;color:var(--text2)">月次データを保存すると達成目標が表示されます。</p>';
    return;
  }

  // 累積値・月別値を計算
  const sum = (field) => {
    let total = 0;
    existing.forEach(m => { if (DB[m] && DB[m][field]) total += DB[m][field]; });
    return total;
  };
  // 選択中の月のデータ
  const selMonth = document.getElementById('input-month')?.value || '';
  const md = DB[selMonth] || {};
  const mv = (field) => md[field] || 0;

  // 年間処方箋受付回数（1万枚あたりの計算用）
  const rxTotal = sum('rx_count');
  const per10k = rxTotal ? 10000 / rxTotal : 0;

  // 月間目標 = 年間目標 / 12
  const monthTarget = (yearTarget) => Math.ceil(yearTarget / 12);

  // 達成目標の定義
  const goals = [
    { label:'時間外等・夜間休日等', cum: sum('yakan_cnt') + sum('jikangai_kanri_amt')/400, monthly: mv('yakan_cnt'), target: Math.ceil(40/per10k)||40, unit:'回', note:'要件ア：40回/万枚' },
    { label:'麻薬調剤', cum: sum('mayaku_shido_cnt'), monthly: mv('mayaku_shido_cnt'), target: Math.ceil(1/per10k)||1, unit:'回', note:'要件イ：1回/万枚' },
    { label:'重複防止等', cum: sum('jukufuku_other_cnt') + sum('jukufuku_zan_cnt'), monthly: mv('jukufuku_other_cnt') + mv('jukufuku_zan_cnt'), target: Math.ceil(20/per10k)||20, unit:'回', note:'要件ウ：20回/万枚' },
    { label:'かかりつけ薬剤師', cum: sum('kakari_76_cnt'), monthly: mv('kakari_76_cnt'), target: Math.ceil(20/per10k)||20, unit:'回', note:'要件エ（必須）：20回/万枚' },
    { label:'外来服薬支援料1', cum: sum('gaifuku1_cnt'), monthly: mv('gaifuku1_cnt'), target: Math.ceil(1/per10k)||1, unit:'回', note:'要件オ：1回/万枚' },
    { label:'服用薬剤調整支援料', cum: sum('fukuyou1_cnt'), monthly: mv('fukuyou1_cnt'), target: Math.ceil(1/per10k)||1, unit:'回', note:'要件カ：1回/万枚' },
    { label:'在宅訪問', cum: sum('zaitaku_1nin_cnt') + sum('zaitaku_2_9_cnt') + sum('zaitaku_10_cnt'), monthly: mv('zaitaku_1nin_cnt') + mv('zaitaku_2_9_cnt') + mv('zaitaku_10_cnt'), target: Math.ceil(24/per10k)||24, unit:'回', note:'要件キ：24回/万枚' },
    { label:'服薬情報等提供料', cum: sum('fuyaku_joho1_cnt') + sum('fuyaku_joho2_cnt') + sum('fuyaku_joho3_cnt'), monthly: mv('fuyaku_joho1_cnt') + mv('fuyaku_joho2_cnt') + mv('fuyaku_joho3_cnt'), target: Math.ceil(30/per10k)||30, unit:'回', note:'要件ク：30回/万枚' },
    { label:'小児特定加算', cum: sum('shoni_350_cnt'), monthly: mv('shoni_350_cnt'), target: Math.ceil(1/per10k)||1, unit:'回', note:'要件ケ：1回/万枚' },
    { label:'後発品調剤率', cum: existing.reduce((s,m)=>s+(DB[m]?.ge_rate||0),0)/existing.length, monthly: mv('ge_rate'), target: 85, unit:'%', note:'基本体制：85%以上', isRate:true },
  ];

  // 選択月の和暦ラベル
  const monthLabel = selMonth ? selMonth.replace(/(\d{4})-(\d{2})/, (_, y, m) => `R${parseInt(y)-2018}.${parseInt(m)}月`) : '';

  const container = document.getElementById('goal-cards');
  container.innerHTML = goals.map(g => {
    const cumPct = g.target > 0 ? Math.min(100, g.cum / g.target * 100) : 0;
    const cls = cumPct >= 100 ? 'ok' : cumPct >= 60 ? 'ng' : 'danger';
    const cumStr = g.isRate ? g.cum.toFixed(1) : Math.round(g.cum);
    const mTarget = g.isRate ? g.target : monthTarget(g.target);
    const mVal = g.isRate ? g.monthly.toFixed(1) : Math.round(g.monthly);
    const mPct = mTarget > 0 ? Math.min(100, (g.isRate ? g.monthly : g.monthly) / mTarget * 100) : 0;
    const mCls = mPct >= 100 ? '#2e7d32' : mPct >= 60 ? '#f57f17' : '#c62828';
    return `<div class="goal-card ${cls}">
      <div class="goal-label">${g.label}</div>
      <div class="goal-nums">
        <span class="goal-current">${cumStr}</span>
        <span class="goal-target">/ ${g.target}${g.unit}</span>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${cumPct}%"></div></div>
      <div style="font-size:10px;color:var(--text2);margin-top:2px">${g.note}（${existing.length}ヶ月累積）</div>
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;color:var(--text2)">${monthLabel || '当月'}</span>
        <span style="font-size:13px;font-weight:700;color:${mCls}">${mVal}</span>
        <span style="font-size:10px;color:var(--text2)">/ 月${mTarget}${g.unit}</span>
      </div>
    </div>`;
  }).join('');
}

// ===== 売上推移テーブル =====
function renderTrend() {
  const allMonths = Object.keys(DB).sort();
  const fmt = n => n ? n.toLocaleString() : '-';
  const pctSpan = (val) => {
    if (val === null || val === undefined) return '';
    const color = val > 0 ? '#2e7d32' : val < 0 ? '#c62828' : 'var(--text2)';
    const sign = val > 0 ? '+' : '';
    return `<div style="font-size:13px;color:${color};font-weight:bold">${sign}${val.toFixed(1)}%</div>`;
  };

  // 固定5年分（R4〜R8 = 2022〜2026）を常に表示
  const years = ['2022','2023','2024','2025','2026'];

  // 年ごとの月リスト（データがない年は空配列）
  const yearMonths = {};
  years.forEach(y => { yearMonths[y] = allMonths.filter(m => m.startsWith(y)); });

  // ヘッダー
  let th = '<tr><th style="text-align:left;position:sticky;left:0;background:#fff;z-index:1;min-width:160px">項目</th>';
  years.forEach(y => {
    const r = parseInt(y) - 2018;
    const mCnt = yearMonths[y].length;
    const sub = mCnt > 0 ? `${mCnt}ヶ月分` : 'データなし';
    th += `<th style="min-width:110px;text-align:right">R${r}年<br><span style="font-size:10px;color:var(--text2);font-weight:normal">${sub}</span></th>`;
  });
  th += '</tr>';
  document.getElementById('trend-thead').innerHTML = th;

  // 行定義
  const rows = [
    { label:'処方箋受付回数', field:'rx_count', unit:'回', sum:true },
    { label:'調剤報酬金額', field:'total_reward', unit:'円', sum:true },
    { label:'処方箋単価', field:'rx_price', unit:'円', avg:true },
    { label:'処方箋単価', field:'rx_price', unit:'円', avg:true },
  ];

  // 年間集計
  function calcYear(row, monthList) {
    if (!monthList || monthList.length === 0) return null; // データなし
    let total = 0, cnt = 0;
    monthList.forEach(m => {
      const d = DB[m] || {};
      let v = 0;
      if (row.fields) { v = row.fields.reduce((s, f) => s + (d[f] || 0), 0); }
      else { v = d[row.field] || 0; }
      if (v) { total += v; cnt++; }
    });
    if (row.avg && cnt > 0) return total / cnt;
    return total;
  }

  let tbody = '';
  rows.forEach(row => {
    const vals = years.map(y => calcYear(row, yearMonths[y]));

    tbody += `<tr><td style="text-align:left;position:sticky;left:0;background:#fff;z-index:1;font-weight:bold;white-space:nowrap">${row.label}</td>`;
    vals.forEach((v, i) => {
      if (v === null) { tbody += '<td style="text-align:right;color:var(--text2)">-</td>'; return; }
      let cell = row.isRate ? (v ? v.toFixed(1) + '%' : '-') : fmt(Math.round(v));

      // 前年比
      let yoy = '';
      if (i > 0 && vals[i-1] !== null && vals[i-1] !== 0 && v) {
        const change = (v - vals[i-1]) / vals[i-1] * 100;
        yoy = pctSpan(change);
      }

      tbody += `<td style="text-align:right">${cell}${yoy}</td>`;
    });
    tbody += '</tr>';
  });

  document.getElementById('trend-tbody').innerHTML = tbody;
}

// ===== R8実績入力 =====
function fillR8Jisseki() {
  const status = document.getElementById('r8-status');
  const extrapolate = document.getElementById('r8-extrapolate').checked;
  const skipYouken = document.getElementById('r8-skip-youken').checked;

  // R7.5〜R8.4（2025-05〜2026-04）のデータを集計
  const targetMonths = [];
  for (let y = 2025, m = 5; ; ) {
    targetMonths.push(`${y}-${String(m).padStart(2,'0')}`);
    m++; if (m > 12) { m = 1; y++; }
    if (y === 2026 && m > 4) break;
  }

  // DBからデータがある月を取得
  const existingMonths = targetMonths.filter(m => DB[m]);
  const missingCount = 12 - existingMonths.length;

  if (existingMonths.length === 0) {
    status.style.color = 'var(--coral)';
    status.textContent = 'データがありません。先に月次報酬ページで月次データを保存してください。';
    return;
  }

  // 要件指定がある項目（件数を人工的に増やしてはいけない項目）
  const YOUKEN_FIELDS = [
    'mayaku_shido_cnt',    // 麻薬調剤 1回以上
    'gaifuku1_cnt',        // 外来服薬支援料1 1回以上
    'fukuyou1_cnt',        // 服用薬剤調整支援料 1回以上
    'fukuyou2_amt',        // 服用薬剤調整支援料2
    'shoni_350_cnt',       // 小児特定加算 1回以上
    'kakari_76_cnt',       // かかりつけ薬剤師（→R8ではフォローアップ等に）
    'kakari_291_cnt',
    'zaitaku_1nin_cnt',    // 在宅訪問 24回以上
    'zaitaku_2_9_cnt',
    'zaitaku_10_cnt',
    'zaitaku_kinkyu1_cnt', // 在宅緊急
    'zaitaku_kinkyu2_cnt',
    'zaitaku_kyodo_cnt',
    'chozaigo_60_cnt',     // 調剤後薬剤管理指導料
    'nyuyoji_12_cnt',      // 乳幼児
    'tokutei_2_cnt',       // 特定薬剤管理指導加算2
  ];

  // 全FIELDSを合算
  const totals = {};
  FIELDS.forEach(f => { totals[f] = 0; });

  existingMonths.forEach(m => {
    const entry = DB[m];
    FIELDS.forEach(f => {
      if (entry[f] !== null && entry[f] !== undefined) {
        totals[f] += entry[f];
      }
    });
  });

  // 予測加算したフィールドを追跡
  const extrapolated = new Set();

  // 不足期間を予測加算（月平均×不足月数）
  if (extrapolate && missingCount > 0 && existingMonths.length > 0) {
    FIELDS.forEach(f => {
      // 要件指定項目はスキップ
      if (skipYouken && YOUKEN_FIELDS.includes(f)) return;
      // 率・平均値は加算しない
      if (f.includes('rate') || f.includes('avg') || f.includes('price') || f === 'rx_price') return;
      // 点数フィールドは加算しない
      if (f.endsWith('_pt')) return;
      // 値がない項目はスキップ
      if (!totals[f]) return;

      const avg = totals[f] / existingMonths.length;
      totals[f] += avg * missingCount;
      totals[f] = Math.round(totals[f]);
      extrapolated.add(f);
    });
  }

  // 率・平均値は平均で計算
  ['ge_rate','avg_zai','rx_price','techo_rate'].forEach(f => {
    if (existingMonths.length > 0) {
      totals[f] = totals[f] / existingMonths.length;
      totals[f] = Math.round(totals[f] * 100) / 100;
    }
  });

  // R8フォームに反映
  FIELDS.forEach(f => {
    const el = document.getElementById('r8_' + f);
    if (el) {
      // まずスタイルリセット
      el.style.color = '';
      if (totals[f]) {
        el.value = totals[f];
        // 予測加算されたフィールドは青字
        if (extrapolated.has(f)) {
          el.style.color = '#1a73e8';
        }
      }
    }
  });

  // ステータス
  let msg = `${existingMonths.length}ヶ月分の実績を入力しました`;
  if (extrapolate && missingCount > 0) {
    msg += `（不足${missingCount}ヶ月分を予測加算＝<span style="color:#1a73e8">青字</span>`;
    if (skipYouken) msg += '、要件項目は加算なし';
    msg += '）';
  }
  status.style.color = 'var(--teal)';
  status.innerHTML = '✓ ' + msg;
  calcR8Forecast();
}

function calcR8Forecast() {
  const g = id => parseFloat(document.getElementById(id)?.value) || 0;
  const fmt = n => n.toLocaleString();

  // R7点数マップ（R6改定の点数）
  const R6_PT = {
    kihon45:45, chiiki:32, kouhatsu:30, renkei:5, dx8:8, dx10:10, zaitaku15:15, yakan:40
  };
  // R8点数はselectの値から取得
  const R8_PT = {
    kihon45: g('r8_kihon45_pt'), chiiki: g('r8_chiiki_pt'), renkei:5,
    dx8: g('r8_dx8_pt'), dx10: g('r8_dx10_pt'),
    zaitaku15: g('r8_zaitaku15_pt'), yakan:40
  };

  // 件数はR8フォームの値（＝年間実績）
  const CNT = {};
  ['kihon45','chiiki','kouhatsu','renkei','dx8','dx10','zaitaku15','yakan'].forEach(k => {
    CNT[k] = g('r8_' + k + '_cnt');
  });

  // 調剤基本料セクション: R7売上 = Σ(件数×R6点数×10)
  let r7_kihon = 0, r8_kihon = 0;
  ['kihon45','chiiki','renkei','dx8','dx10','zaitaku15','yakan'].forEach(k => {
    r7_kihon += CNT[k] * (R6_PT[k] || 0) * 10;
    r8_kihon += CNT[k] * (R8_PT[k] || 0) * 10;
  });
  // 後発体制加算はR8で廃止→R7にはあったがR8では0
  r7_kihon += CNT.kouhatsu * R6_PT.kouhatsu * 10;
  // R8では後発体制加算は地域支援に統合済み（chiikiの点数に含まれる）

  // 薬剤調製料・薬学管理料・在宅等はR8フォームのamt合計
  const amtFields = [
    'naifuku_amt','sinsenn_amt','yuyaku_amt','tonpuku_amt','gaiyou_amt',
    'chusya_amt','naiteki_amt','zairyo_amt',
    'chozai_kazan_total',
    'chmgr_nai_amt','chmgr_other_amt','jikangai_kanri_amt',
    'fuyaku_a_amt','fuyaku_b_amt','fuyaku_c_amt','fuyaku_3_amt','fuyaku_toku2a_amt',
    'mayaku_shido_amt','tokutei_1i_amt','tokutei_1ro_amt','tokutei_2_amt',
    'tokutei_3i_amt','tokutei_3ro_amt','nyuyoji_12_amt','shoni_350_amt',
    'kyunyu_30_amt','chozaigo_60_amt',
    'fuyaku_joho1_amt','fuyaku_joho2_amt','fuyaku_joho3_amt',
    'gaifuku1_amt','gaifuku2_7_amt','gaifuku2_14_amt','gaifuku2_21_amt',
    'gaifuku2_28_amt','gaifuku2_35_amt','gaifuku2_42_amt','gaifuku2_43_amt',
    'setsurenkei_amt','fukuyou1_amt','fukuyou2_amt','keikan_amt',
    'zaitaku_1nin_amt','zaitaku_2_9_amt','zaitaku_10_amt',
    'zaitaku_kinkyu1_amt','zaitaku_kinkyu2_amt','zaitaku_kyodo_amt',
    'zaitaku_mayaku_amt','zaitaku_nyuyoji_amt','zaitaku_shoni_amt',
    'zaitaku_mayaku_chu_amt','zaitaku_chushin_amt',
    'yakan_homon_amt','kyujitsu_homon_amt','shinya_homon_amt',
    'taiin_kyodo_amt','zaitaku_iko_amt',
    'kaigo1_amt','kaigo2_amt','kaigo3_amt','kaigo4_amt',
    'kaigo_y1_amt','kaigo_y2_amt','kaigo_y3_amt',
    'kaigo_mayaku_amt','kaigo_chushin_amt',
  ];

  // R7: e_ フォームから（DB合算値があれば）、なければr8_の値をそのまま使用
  // ただしR7実績＝R8フォームの金額（点数変更前）として計算が複雑なので
  // シンプルに: 薬学管理料等は点数変更なし→R7もR8も同額と仮定
  let r7_other = 0, r8_other = 0;
  amtFields.forEach(f => {
    const v = g('r8_' + f);
    r7_other += v;
    r8_other += v;
  });

  // R7で廃止された加算の売上を加算（重複防止加算・医療情報取得・かかりつけ）
  // これらはR8フォームから削除されているのでDBから取得
  const targetMonths = [];
  for (let y = 2025, m = 5; ; ) {
    targetMonths.push(`${y}-${String(m).padStart(2,'0')}`);
    m++; if (m > 12) { m = 1; y++; }
    if (y === 2026 && m > 4) break;
  }
  const existingMonths = targetMonths.filter(m => DB[m]);
  let r7_haishi = 0;
  const haishiFields = ['jukufuku_other_amt','jukufuku_zan_amt','iryo_joho_amt',
    'kakari_76_amt','kakari_291_amt',
    'zaitaku_jukufuku_other_amt','zaitaku_jukufuku_zan_amt'];
  existingMonths.forEach(m => {
    haishiFields.forEach(f => {
      if (DB[m][f]) r7_haishi += DB[m][f];
    });
  });
  // 不足月分の予測
  if (existingMonths.length > 0 && existingMonths.length < 12) {
    const ratio = 12 / existingMonths.length;
    r7_haishi = Math.round(r7_haishi * ratio);
  }

  // R8新設加算の売上
  const r8_bukka_baseup = g('r8_bukka_amt') + g('r8_baseup_amt');
  const r8_new = r8_bukka_baseup + g('r8_bio_amt')
    + g('r8_zanryaku_amt') + g('r8_yugai_amt') + g('r8_kakari_fu_amt')
    + g('r8_kakari_homon_amt') + g('r8_fukusuu_amt');

  // 薬価改定の影響（薬剤費ベース▲4.02%）
  // 薬剤料（yakuzai）の年間合計を推計
  let r7_yakuzai = 0;
  ['naifuku_yakuzai','sinsenn_yakuzai','yuyaku_yakuzai','tonpuku_yakuzai',
   'gaiyou_yakuzai','chusya_yakuzai','naiteki_yakuzai','zairyo_yakuzai'].forEach(f => {
    r7_yakuzai += g('r8_' + f.replace('_yakuzai','_amt')); // 近似：調剤料amtで代替
  });
  // より正確：DBの薬剤料合計
  let yakuzaiFromDB = 0;
  existingMonths.forEach(m => {
    ['naifuku_yakuzai','sinsenn_yakuzai','yuyaku_yakuzai','tonpuku_yakuzai',
     'gaiyou_yakuzai','chusya_yakuzai','naiteki_yakuzai','zairyo_yakuzai'].forEach(f => {
      if (DB[m][f]) yakuzaiFromDB += DB[m][f];
    });
  });
  if (existingMonths.length > 0 && existingMonths.length < 12) {
    yakuzaiFromDB = Math.round(yakuzaiFromDB * 12 / existingMonths.length);
  }
  const yakkaEnabled = document.getElementById('r8-yakka-check')?.checked;
  const yakkaRate = parseFloat(document.getElementById('r8-yakka-rate')?.value) || 4.02;
  const yakkaImpact = yakkaEnabled ? Math.round(yakuzaiFromDB * -yakkaRate / 100) : 0;

  // 技術料の増減（点数変更＋新設−廃止）
  const gijutsuDiff = (r8_kihon - r7_kihon) + r8_new - r7_haishi;

  // 総合
  const r7_total = r7_kihon + r7_other + r7_haishi + yakuzaiFromDB;
  const r8_total = r8_kihon + r8_other + r8_new + yakuzaiFromDB + yakkaImpact;
  const diff = r8_total - r7_total;
  const pct = r7_total ? (diff / r7_total * 100) : 0;

  // 表示
  document.getElementById('r8sum-r7').textContent = fmt(r7_total);
  document.getElementById('r8sum-r8').textContent = fmt(r8_total);

  const diffEl = document.getElementById('r8sum-diff');
  diffEl.textContent = (diff >= 0 ? '+' : '') + fmt(diff) + '円';
  diffEl.style.color = diff >= 0 ? '#2e7d32' : '#c62828';

  const pctEl = document.getElementById('r8sum-pct');
  pctEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
  pctEl.style.color = diff >= 0 ? '#2e7d32' : '#c62828';

  // 内訳
  const gEl = document.getElementById('r8sum-gijutsu');
  gEl.textContent = (gijutsuDiff >= 0 ? '+' : '') + fmt(gijutsuDiff) + '円';

  const yEl = document.getElementById('r8sum-yakka');
  yEl.textContent = (yakkaEnabled ? '' : '（OFF）') + fmt(yakkaImpact) + '円';
  document.getElementById('r8sum-yakka-note').textContent = yakkaEnabled ? `薬剤費ベース▲${yakkaRate}%（R8.4月〜）` : '薬価影響を反映していません';

  const bEl = document.getElementById('r8sum-bukka');
  bEl.textContent = '+' + fmt(r8_bukka_baseup) + '円';
}

function calcKihonRow(el) {
  const row = el.closest('tr');
  const cnt = row.querySelector('[id$="_cnt"]');
  const pt = row.querySelector('select[id$="_pt"],input[id$="_pt"]');
  const amt = row.querySelector('[id$="_amt"]');
  if (cnt && pt && amt) {
    const v = (parseFloat(cnt.value)||0) * (parseFloat(pt.value)||0) * 10;
    amt.value = v ? v : '';
  }
  // 調剤基本料合計を再計算
  const ids = ['e_kihon45_amt','e_chiiki_amt','e_kouhatsu_amt','e_renkei_amt','e_dx8_amt','e_dx10_amt','e_zaitaku15_amt','e_yakan_amt'];
  let total = 0;
  ids.forEach(id => { total += parseFloat(document.getElementById(id)?.value) || 0; });
  const totalEl = document.getElementById('e_kihon_total');
  if (totalEl) totalEl.value = total || '';
  calcGrandTotal();
}

function calcGrandTotal() {
  const get = id => parseFloat(document.getElementById('e_'+id)?.value)||0;
  const hokengai = get('jhi_chozai_amt') + get('sentei_amt') + get('hokengai_amt') + get('otc_amt') + get('bussan_amt');
  if (document.getElementById('e_hokengai_total')) document.getElementById('e_hokengai_total').value = hokengai || '';
  const ikaTotal = get('total_reward');
  const kaigoTotal = get('kaigo_total');
  const otherTotal = hokengai;
  const grand = ikaTotal + kaigoTotal + otherTotal;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('e_ika_total', ikaTotal);
  set('e_kaigo_total_summary', kaigoTotal);
  set('e_other_total_summary', otherTotal);
  set('e_grand_total', grand);
}

// ===== 算定チェック =====
const SANTEI_ITEMS = {
  // R6/R7（月次報酬ページ）: fieldPrefix → ラベルキーワード
  // 調剤基本料セクション
  'e_chiiki':       { label:'地域支援体制加算' },
  'e_kouhatsu':     { label:'後発医薬品調剤体制加算' },
  'e_renkei':       { label:'連携強化加算' },
  'e_dx8':          { label:'医療DX推進体制整備加算（8点）' },
  'e_dx10':         { label:'医療DX推進体制整備加算（10点）' },
  'e_zaitaku15':    { label:'在宅薬学総合体制加算' },
  // 薬学管理料
  'e_kakari_76':    { label:'かかりつけ薬剤師指導料' },
  'e_tokutei_2':    { label:'特定薬剤管理指導加算2' },
  'e_shoni_350':    { label:'小児特定加算（350点）' },
  'e_kyunyu_30':    { label:'吸入薬指導加算' },
  'e_chozaigo_60':  { label:'調剤後薬剤管理指導料' },
  'e_kakari_291':   { label:'かかりつけ薬剤師包括管理料' },
  // 在宅
  'e_zaitaku_1nin': { label:'在宅患者訪問薬剤管理指導料（単一1人）' },
  'e_zaitaku_2_9':  { label:'在宅患者訪問薬剤管理指導料（2人以上' },
  'e_zaitaku_10':   { label:'在宅患者訪問薬剤管理指導料（10人以上）' },
  'e_zaitaku_mayaku_chu': { label:'在宅患者医療用麻薬持続注射' },
  'e_zaitaku_chushin':    { label:'在宅中心静脈栄養法加算' },
};

function initSanteiChecks() {
  const saved = JSON.parse(localStorage.getItem('pharmacy_santei') || '{}');

  // 月次報酬ページ (e_) と R8ページ (r8_) の両方に適用
  ['e_', 'r8_'].forEach(prefix => {
    Object.keys(SANTEI_ITEMS).forEach(key => {
      const fieldId = prefix === 'e_' ? key : key.replace('e_', 'r8_');
      // _cnt フィールドの行を探す
      const cntEl = document.getElementById(fieldId + '_cnt');
      if (!cntEl) return;
      const tr = cntEl.closest('tr');
      if (!tr) return;
      const td = tr.querySelector('td.label');
      if (!td) return;
      // 既にチェックボックスがあればスキップ
      if (td.querySelector('.santei-cb')) return;

      const cbId = 'santei_' + fieldId;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'santei-cb';
      cb.id = cbId;
      cb.checked = saved[cbId] !== false; // デフォルトON
      cb.title = '算定する';
      cb.onchange = function() {
        toggleSantei(this);
      };
      td.insertBefore(cb, td.firstChild);

      // 初期状態を反映
      if (!cb.checked) {
        tr.classList.add('santei-off');
        disableRowInputs(tr, true);
      }
    });
  });
}

function toggleSantei(cb) {
  const tr = cb.closest('tr');
  if (cb.checked) {
    tr.classList.remove('santei-off');
    disableRowInputs(tr, false);
  } else {
    tr.classList.add('santei-off');
    disableRowInputs(tr, true);
  }
  saveSanteiState();
}

function disableRowInputs(tr, disabled) {
  tr.querySelectorAll('input[type=number],select').forEach(el => {
    if (el.classList.contains('santei-cb')) return;
    if (disabled) {
      el.dataset.savedValue = el.value;
      el.value = '';
      el.disabled = true;
    } else {
      el.disabled = false;
      if (el.dataset.savedValue) {
        el.value = el.dataset.savedValue;
        delete el.dataset.savedValue;
      }
    }
  });
}

function saveSanteiState() {
  const state = {};
  document.querySelectorAll('.santei-cb').forEach(cb => {
    state[cb.id] = cb.checked;
  });
  localStorage.setItem('pharmacy_santei', JSON.stringify(state));
}

// ======== 初期化 ========
// DB(UKE)データをJSONから読み込み
let UKE_DB = null;
function loadUkeDB() {
  fetch('db_export.json')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      UKE_DB = data;
      console.log(`UKE DB loaded: ${data.summary.length}ヶ月`);
      // 月次報酬のDBにUKEデータを自動マッピング
      data.summary.forEach(s => {
        const ym = s.year_month;
        if (!DB[ym]) DB[ym] = {};
        // 総点数→調剤報酬金額（1点=10円）
        if (!DB[ym].total_reward || DB[ym].total_reward === 0) {
          DB[ym].total_reward = s.total_points * 10;
        }
        // 処方箋枚数
        if (!DB[ym].rx_count || DB[ym].rx_count === 0) {
          // KIレコードの調剤基本料の件数から推定
          const kasan = data.kasan[ym] || [];
          const kihon = kasan.find(k => k.name.includes('調剤基本料'));
          if (kihon) {
            DB[ym].rx_count = kihon.count;
            DB[ym].rx_sheets = kihon.count;
          }
        }
        // 処方箋単価
        if (DB[ym].total_reward && DB[ym].rx_count) {
          DB[ym].rx_price = Math.round(DB[ym].total_reward / DB[ym].rx_count * 100) / 100;
        }
        // 加算データをマッピング（FIELDSのキー名に合わせる）
        const kasan = data.kasan[ym] || [];
        kasan.forEach(k => {
          const map = {
            '調剤基本料': {cnt: 'kihon45_cnt', amt: 'kihon45_amt'},
            '地域支援体制加算': {cnt: 'chiiki_cnt', amt: 'chiiki_amt'},
            '後発医薬品調剤体制加算': {cnt: 'kouhatsu_cnt', amt: 'kouhatsu_amt'},
            '連携強化加算': {cnt: 'renkei_cnt', amt: 'renkei_amt'},
            '医療DX推進体制整備加算': {cnt: 'dx8_cnt', amt: 'dx8_amt'},
            '在宅薬学総合体制加算': {cnt: 'zaitaku15_cnt', amt: 'zaitaku15_amt'},
            '夜間・休日等加算': {cnt: 'yakan_cnt', amt: 'yakan_amt'},
            '服薬管理指導料（３月以内再度処方箋・手帳あり）': {cnt: 'fuyaku_a_cnt', amt: 'fuyaku_a_amt'},
            '服薬管理指導料（３月以内再度処方箋・手帳なし）': {cnt: 'fuyaku_b_cnt', amt: 'fuyaku_b_amt'},
            '服薬管理指導料２': {cnt: 'fuyaku_c_cnt', amt: 'fuyaku_c_amt'},
            'かかりつけ薬剤師指導料': {cnt: 'kakari_76_cnt', amt: 'kakari_76_amt'},
            '在宅患者訪問薬剤管理指導料': {cnt: 'zaitaku_1nin_cnt', amt: 'zaitaku_1nin_amt'},
            '在宅移行初期管理料': {cnt: 'zaitaku_iko_cnt', amt: 'zaitaku_iko_amt'},
            '特定薬剤管理指導加算１（イ）': {cnt: 'tokutei_1i_cnt', amt: 'tokutei_1i_amt'},
            '特定薬剤管理指導加算1（ロ）': {cnt: 'tokutei_1ro_cnt', amt: 'tokutei_1ro_amt'},
            '特定薬剤管理指導加算3（イ）': {cnt: 'tokutei_3i_cnt', amt: 'tokutei_3i_amt'},
            '調剤物価対応料': {cnt: 'bukka_cnt', amt: 'bukka_amt'},
            '内服薬調剤管理料': {cnt: 'chmgr_29_cnt', amt: 'chmgr_29_amt'},
            '医療情報取得加算': {cnt: 'iryo_joho_cnt', amt: 'iryo_joho_amt'},
            '重複投薬': {cnt: 'jukufuku_other_cnt', amt: 'jukufuku_other_amt'},
            '服薬情報等提供料': {cnt: 'fuyaku_joho2_cnt', amt: 'fuyaku_joho2_amt'},
            '乳幼児服薬指導加算': {cnt: 'nyuyoji_12_cnt', amt: 'nyuyoji_12_amt'},
            '深夜訪問加算': {cnt: 'shinya_homon_cnt', amt: 'shinya_homon_amt'},
            '深夜加算': {cnt: 'shinya_cnt', amt: 'shinya_amt'},
            '時間外加算': {cnt: 'jikangai_kanri_cnt', amt: 'jikangai_kanri_amt'},
          };
          for (const [key, fields] of Object.entries(map)) {
            if (k.name.includes(key)) {
              DB[ym][fields.cnt] = (DB[ym][fields.cnt] || 0) + k.count;
              DB[ym][fields.amt] = (DB[ym][fields.amt] || 0) + Math.round(k.amount);
              break;
            }
          }
        });
        // 基本料合計
        DB[ym].kihon_total = (DB[ym].kihon45_amt||0)+(DB[ym].chiiki_amt||0)+(DB[ym].kouhatsu_amt||0)+(DB[ym].renkei_amt||0)+(DB[ym].dx8_amt||0)+(DB[ym].zaitaku15_amt||0);
        // 薬学管理料合計
        DB[ym].yakugaku_total = (DB[ym].fuyaku_a_amt||0)+(DB[ym].fuyaku_b_amt||0)+(DB[ym].fuyaku_c_amt||0)+(DB[ym].kakari_76_amt||0)+(DB[ym].tokutei_1i_amt||0)+(DB[ym].tokutei_3i_amt||0)+(DB[ym].nyuyoji_12_amt||0)+(DB[ym].iryo_joho_amt||0)+(DB[ym].chmgr_29_amt||0);
        // 在宅合計
        DB[ym].zaitaku_total = (DB[ym].zaitaku_1nin_amt||0)+(DB[ym].zaitaku_iko_amt||0);
      });
      localStorage.setItem('pharmacy_db', JSON.stringify(DB));
      updatePeriodSelect();
      renderMonthList();
      renderSuii();
    })
    .catch(() => console.log('db_export.json not found'));
}

function init() {
  const saved = localStorage.getItem('pharmacy_db');
  if (saved) DB = JSON.parse(saved);
  loadUkeDB();
  updatePeriodSelect();
  renderMonthList();
  loadTaskState();
  initSanteiChecks();
  initCalendar();
  initShift();
  initDailyTasks();
  initManualVideos();
  initZaiko();
  initYocho();
  renderHaiki();
  renderTanaoroshiHistory();
  updatePLperiods();
  updateGoals();
  // 初期表示は月次報酬タブ
  // R8サンプルデータ（添付Excelの値：R8.1-3月）
  if (Object.keys(DB).length === 0) {
    // デモ用サンプルを1件だけセット
    DB['2026-01'] = {
      rx_count:2839, rx_sheets:2841, ge_rate:95.28, zai_count:7592,
      total_reward:13694590, rx_price:4820.34, techo_rate:91.54, hoken_futan:320090,
      kihon45_cnt:2829, kihon45_pt:45, kihon45_amt:1273050,
      chiiki_cnt:2837, chiiki_pt:32, chiiki_amt:907840,
      kouhatsu_cnt:2837, kouhatsu_pt:30, kouhatsu_amt:851100,
      renkei_cnt:2837, renkei_pt:5, renkei_amt:141850,
      dx8_cnt:1848, dx8_pt:8, dx8_amt:147840,
      dx10_cnt:456, dx10_pt:10, dx10_amt:45600,
      zaitaku15_cnt:9, zaitaku15_pt:15, zaitaku15_amt:1350,
      yakan_cnt:62, yakan_pt:40, yakan_amt:24800, kihon_total:3405770,
      naifuku_zai:4454, naifuku_yakuzai:4049220, naifuku_cnt:3898, naifuku_pt:24, naifuku_amt:935520,
      tonpuku_zai:688, tonpuku_yakuzai:47850, tonpuku_cnt:673, tonpuku_pt:21, tonpuku_amt:141330,
      gaiyou_zai:2426, gaiyou_yakuzai:1577570, gaiyou_cnt:2377, gaiyou_pt:10, gaiyou_amt:237700,
      chusya_zai:12, chusya_yakuzai:513840, chusya_cnt:8, chusya_pt:26, chusya_amt:2080,
      yakuzai_total:6191610, chozai_total:1317730,
      chmgr_cnt:2515, chmgr_amt:581500, chmgr2_cnt:323, chmgr2_pt:4, chmgr2_amt:12920,
      fuku_a_cnt:1788, fuku_a_pt:45, fuku_a_amt:804600,
      fuku_b_cnt:170, fuku_b_pt:59, fuku_b_amt:100300,
      fuku_c_cnt:842, fuku_c_pt:59, fuku_c_amt:496780,
      kakari_cnt:23, kakari_pt:76, kakari_amt:17480,
      chofuku_cnt:20, chofuku_pt:40, chofuku_amt:8000,
      nyuyoji_cnt:1577, nyuyoji_pt:12, nyuyoji_amt:189240,
      tokutei1i_cnt:8, tokutei1i_pt:10, tokutei1i_amt:800,
      tokutei3i_cnt:142, tokutei3i_pt:5, tokutei3i_amt:7100,
      gaifuku2_cnt:19, gaifuku2_amt:29980,
      fukuyaku2_cnt:3, fukuyaku2_pt:20, fukuyaku2_amt:600,
      yakugaku_total:2290420,
      zaitaku1_cnt:4, zaitaku1_pt:650, zaitaku1_amt:26000,
      zaitaku_iko_cnt:1, zaitaku_iko_pt:230, zaitaku_iko_amt:2300, zaitaku_total:28300,
      kaigo1_cnt:4, kaigo1_pt:518, kaigo1_amt:20720,
      kaigo2_cnt:2, kaigo2_pt:518, kaigo2_amt:10360, kaigo_total:31080,
    };
    localStorage.setItem('pharmacy_db', JSON.stringify(DB));
    updatePeriodSelect();
    }
}


// ========== UKEパーサー ==========
const UKE_CODES = {
  '410005710':{name:'調剤基本料1',pt:45,cat:'基本料'},
  '410005810':{name:'調剤基本料2',pt:25,cat:'基本料'},
  '450001470':{name:'地域支援体制加算1',pt:32,cat:'体制加算'},
  '450001570':{name:'地域支援体制加算2',pt:40,cat:'体制加算'},
  '450001670':{name:'地域支援体制加算3',pt:50,cat:'体制加算'},
  '450001770':{name:'地域支援体制加算4',pt:60,cat:'体制加算'},
  '450000970':{name:'後発医薬品調剤体制加算1',pt:21,cat:'体制加算'},
  '450001070':{name:'後発医薬品調剤体制加算2',pt:28,cat:'体制加算'},
  '450001170':{name:'後発医薬品調剤体制加算3',pt:30,cat:'体制加算'},
  '410002970':{name:'連携強化加算',pt:5,cat:'体制加算'},
  '410003070':{name:'医療DX推進体制整備加算4点',pt:4,cat:'体制加算'},
  '410003170':{name:'医療DX推進体制整備加算8点',pt:8,cat:'体制加算'},
  '410003270':{name:'医療DX推進体制整備加算10点',pt:10,cat:'体制加算'},
  '410003470':{name:'在宅薬学総合体制加算1',pt:15,cat:'体制加算'},
  '410003570':{name:'在宅薬学総合体制加算2',pt:50,cat:'体制加算'},
  '440012010':{name:'服薬管理指導料1(薬A)',pt:45,cat:'薬学管理料'},
  '440012110':{name:'服薬管理指導料2(薬B)',pt:59,cat:'薬学管理料'},
  '440012210':{name:'服薬管理指導料3(薬C)',pt:59,cat:'薬学管理料'},
  '440011810':{name:'調剤管理料(内服)',pt:0,cat:'薬学管理料'},
  '440011910':{name:'調剤管理料(内服以外)',pt:4,cat:'薬学管理料'},
  '440020270':{name:'乳幼児服薬指導加算',pt:12,cat:'薬学管理料'},
  '440017770':{name:'特定薬剤管理指導加算1イ',pt:10,cat:'薬学管理料'},
  '440017870':{name:'特定薬剤管理指導加算1ロ',pt:5,cat:'薬学管理料'},
  '440018070':{name:'特定薬剤管理指導加算3イ',pt:5,cat:'薬学管理料'},
  '440014670':{name:'重複投薬・相互作用防止(残薬以外)',pt:40,cat:'薬学管理料'},
  '440014770':{name:'重複投薬・相互作用防止(残薬)',pt:20,cat:'薬学管理料'},
  '440016270':{name:'かかりつけ薬剤師指導料',pt:76,cat:'薬学管理料'},
  '440020170':{name:'服薬情報等提供料2',pt:20,cat:'薬学管理料'},
  '410004810':{name:'在宅患者訪問薬剤管理指導料1',pt:650,cat:'在宅'},
  '410005110':{name:'在宅移行初期管理料',pt:230,cat:'在宅'},
};

function parseUkeText(text) {
  const lines = text.split(/\r?\n/);
  const r = {pharmacy_name:'',billing_month:'',rx_count:0,total_points:0,kazan:{},unknown_codes:{}};
  for (const line of lines) {
    const cols = line.split(',');
    if (cols.length < 4) continue;
    const rec = cols[3].trim();
    if (rec==='YK' && cols.length>9) {
      if (!r.pharmacy_name) r.pharmacy_name = cols[8].trim();
      if (!r.billing_month) r.billing_month = cols[9].trim();
    } else if (rec==='RE') {
      r.rx_count++;
    } else if (rec==='KI' && cols.length>7) {
      let i=7;
      while (i+2<cols.length) {
        const cnt=parseInt(cols[i])||0, code=cols[i+1].trim(), pts=parseInt(cols[i+2])||0;
        if (code.length===9 && cnt>0) {
          if (UKE_CODES[code]) {
            const n=UKE_CODES[code].name;
            if (!r.kazan[n]) r.kazan[n]={count:0,points:0,cat:UKE_CODES[code].cat,code};
            r.kazan[n].count+=cnt; r.kazan[n].points+=pts*cnt;
          } else { r.unknown_codes[code]=(r.unknown_codes[code]||0)+1; }
        }
        i+=3;
      }
    } else if (rec==='GO' && cols.length>4) {
      r.total_points = parseInt(cols[4])||0;
    } else if (rec==='JY' && cols.length>5) {
      // JYは明細点数（GOが取れない場合のフォールバック）
      if (!r.total_points) r.total_points += parseInt(cols[5])||0;
    }
  }
  return r;
}

function ukeToEntry(merged) {
  const kz = merged.kazan;
  const MAP = {
    '調剤基本料1':              {cnt:'e_kihon45_cnt',    amt:'e_kihon45_amt'},
    '調剤基本料2':              {cnt:'e_kihon45_cnt',    amt:'e_kihon45_amt'},
    '地域支援体制加算1':        {cnt:'e_chiiki_cnt',     amt:'e_chiiki_amt'},
    '地域支援体制加算2':        {cnt:'e_chiiki_cnt',     amt:'e_chiiki_amt'},
    '地域支援体制加算3':        {cnt:'e_chiiki_cnt',     amt:'e_chiiki_amt'},
    '地域支援体制加算4':        {cnt:'e_chiiki_cnt',     amt:'e_chiiki_amt'},
    '後発医薬品調剤体制加算1':  {cnt:'e_kouhatsu_cnt',   amt:'e_kouhatsu_amt'},
    '後発医薬品調剤体制加算2':  {cnt:'e_kouhatsu_cnt',   amt:'e_kouhatsu_amt'},
    '後発医薬品調剤体制加算3':  {cnt:'e_kouhatsu_cnt',   amt:'e_kouhatsu_amt'},
    '連携強化加算':             {cnt:'e_renkei_cnt',     amt:'e_renkei_amt'},
    '医療DX推進体制整備加算8点':{cnt:'e_dx8_cnt',        amt:'e_dx8_amt'},
    '医療DX推進体制整備加算10点':{cnt:'e_dx10_cnt',      amt:'e_dx10_amt'},
    '医療DX推進体制整備加算4点':{cnt:'e_dx8_cnt',        amt:'e_dx8_amt'},
    '在宅薬学総合体制加算1':    {cnt:'e_zaitaku15_cnt',  amt:'e_zaitaku15_amt'},
    '服薬管理指導料1(薬A)':     {cnt:'e_fuku_a_cnt',     amt:'e_fuku_a_amt'},
    '服薬管理指導料2(薬B)':     {cnt:'e_fuku_b_cnt',     amt:'e_fuku_b_amt'},
    '服薬管理指導料3(薬C)':     {cnt:'e_fuku_c_cnt',     amt:'e_fuku_c_amt'},
    '調剤管理料(内服)':         {cnt:'e_chmgr_cnt',      amt:'e_chmgr_amt'},
    '調剤管理料(内服以外)':     {cnt:'e_chmgr2_cnt',     amt:'e_chmgr2_amt'},
    'かかりつけ薬剤師指導料':   {cnt:'e_kakari_cnt',     amt:'e_kakari_amt'},
    '乳幼児服薬指導加算':       {cnt:'e_nyuyoji_cnt',    amt:'e_nyuyoji_amt'},
    '特定薬剤管理指導加算1イ':  {cnt:'e_tokutei1i_cnt',  amt:'e_tokutei1i_amt'},
    '特定薬剤管理指導加算3イ':  {cnt:'e_tokutei3i_cnt',  amt:'e_tokutei3i_amt'},
    '重複投薬・相互作用防止(残薬以外)':{cnt:'e_chofuku_cnt',amt:'e_chofuku_amt'},
    '服薬情報等提供料2':        {cnt:'e_fukuyaku2_cnt',  amt:'e_fukuyaku2_amt'},
    '在宅患者訪問薬剤管理指導料1':{cnt:'e_zaitaku1_cnt', amt:'e_zaitaku1_amt'},
    '在宅移行初期管理料':       {cnt:'e_zaitaku_iko_cnt',amt:'e_zaitaku_iko_amt'},
  };
  clearFields();
  setField('e_rx_count', merged.rx_count,'uke');
  setField('e_total_reward', merged.total_points * 10,'uke');
  for (const [name, ids] of Object.entries(MAP)) {
    const v = kz[name];
    if (v) { addField(ids.cnt, v.count,'uke'); addField(ids.amt, v.points*10,'uke'); }
  }
  setField('e_kihon_total', sumFields(['e_kihon45_amt','e_chiiki_amt','e_kouhatsu_amt','e_renkei_amt','e_dx8_amt','e_dx10_amt','e_zaitaku15_amt']));
  setField('e_yakugaku_total', sumFields(['e_chmgr_amt','e_chmgr2_amt','e_fuku_a_amt','e_fuku_b_amt','e_fuku_c_amt','e_kakari_amt','e_chofuku_amt','e_nyuyoji_amt','e_tokutei1i_amt','e_tokutei3i_amt','e_gaifuku2_amt','e_fukuyaku2_amt']));
  setField('e_zaitaku_total', sumFields(['e_zaitaku1_amt','e_zaitaku_iko_amt']));
}

function setField(id,val,src=''){
  const el=document.getElementById(id);
  if(!el||!val) return;
  el.value=val;
  if(src){ el.classList.remove('src-tokei','src-naiyaku','src-uke'); el.classList.add('src-'+src); }
}
function addField(id,val,src=''){
  const el=document.getElementById(id);
  if(!el) return;
  el.value=(parseFloat(el.value)||0)+val;
  if(src){ el.classList.remove('src-tokei','src-naiyaku','src-uke'); el.classList.add('src-'+src); }
}
function sumFields(ids){return ids.reduce((s,id)=>{const el=document.getElementById(id);return s+(parseFloat(el?.value)||0);},0);}

function billingMonthToInputMonth(bm) {
  if (!bm||bm.length<6) return null;
  let y=parseInt(bm.slice(0,4)), m=parseInt(bm.slice(4,6))-1;
  if(m===0){m=12;y--;}
  return `${y}-${String(m).padStart(2,'0')}`;
}

async function handleUkeFile(files) {
  const status = document.getElementById('uke-status');
  status.textContent = '読み込み中...';
  const merged = {pharmacy_name:'',billing_month:'',rx_count:0,total_points:0,kazan:{},unknown_codes:{}};
  for (const file of Array.from(files)) {
    try {
      const text = await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=e=>res(e.target.result);
        r.onerror=rej;
        r.readAsText(file,'Shift-JIS');
      });
      const parsed = parseUkeText(text);
      if(parsed.pharmacy_name) merged.pharmacy_name=parsed.pharmacy_name;
      if(parsed.billing_month) merged.billing_month=parsed.billing_month;
      merged.rx_count+=parsed.rx_count;
      merged.total_points+=parsed.total_points;
      for(const[k,v] of Object.entries(parsed.kazan)){
        if(!merged.kazan[k]) merged.kazan[k]={...v};
        else{merged.kazan[k].count+=v.count;merged.kazan[k].points+=v.points;}
      }
    } catch(e) {
      status.style.color='var(--red)';
      status.textContent=`エラー: ${file.name} - ${e.message}`;
      return;
    }
  }
  const diagMonth = billingMonthToInputMonth(merged.billing_month);
  if(diagMonth) document.getElementById('input-month').value=diagMonth;
  ukeToEntry(merged);
  const unk = Object.keys(merged.unknown_codes).length;
  status.style.color='var(--teal)';
  status.textContent=`✓ ${merged.pharmacy_name||'UKE'} / 処方箋${merged.rx_count}件 / ${merged.total_points.toLocaleString()}点 を読み込みました。確認して「保存」してください。${unk>0?` （未知コード${unk}種）`:''}`;
  renderMonthList();
}


function handleCsvDrop(event) {
  event.preventDefault();
  handleCsvFiles(event.dataTransfer.files);
}
function handleKazanDrop(event) {
  event.preventDefault();
  handleCsvFiles(event.dataTransfer.files, 'kazan');
}

// ===== CSV→フィールド マッピング =====
const CSV_FIELD_MAP = {
  // 基本指標
  rx_count: 'e_rx_count', rx_sheets: 'e_rx_sheets', ge_rate: 'e_ge_rate',
  zai_count: 'e_zai_count', avg_zai: 'e_avg_zai', total_reward: 'e_total_reward',
  rx_price: 'e_rx_price', techo_rate: 'e_techo_rate',
  // 保険外収入
  hoken_futan2: 'e_hoken_futan2', jhi_chozai_amt: 'e_jhi_chozai_amt',
  hokengai_amt: 'e_hokengai_amt', bussan_amt: 'e_bussan_amt',
  otc_amt: 'e_otc_amt', sentei_amt: 'e_sentei_amt',
  // 調剤基本料
  kihon_cnt: 'e_kihon45_cnt', kihon_amt: 'e_kihon45_amt',
  chiiki_shien_cnt: 'e_chiiki_cnt', chiiki_shien_amt: 'e_chiiki_amt',
  kouhatsu_taisei_cnt: 'e_kouhatsu_cnt', kouhatsu_taisei_amt: 'e_kouhatsu_amt',
  renkei_kyoka_cnt: 'e_renkei_cnt', renkei_kyoka_amt: 'e_renkei_amt',
  yakan_cnt: 'e_yakan_cnt', yakan_amt: 'e_yakan_amt',
  dx_cnt: 'e_dx8_cnt', dx_amt: 'e_dx8_amt',
  dx8_cnt: 'e_dx8_cnt', dx8_amt: 'e_dx8_amt', dx10_cnt: 'e_dx10_cnt', dx10_amt: 'e_dx10_amt',
  zaitaku_taisei_cnt: 'e_zaitaku15_cnt', zaitaku_taisei_amt: 'e_zaitaku15_amt',
  // 薬剤調製料
  naifuku_zai: 'e_naifuku_zai', naifuku_yakuzai: 'e_naifuku_yakuzai', naifuku_chozai: 'e_naifuku_amt',
  sinsenn_zai: 'e_sinsenn_zai', sinsenn_yakuzai: 'e_sinsenn_yakuzai', sinsenn_chozai: 'e_sinsenn_amt',
  yuyaku_zai: 'e_yuyaku_zai', yuyaku_yakuzai: 'e_yuyaku_yakuzai', yuyaku_chozai: 'e_yuyaku_amt',
  tonpuku_zai: 'e_tonpuku_zai', tonpuku_yakuzai: 'e_tonpuku_yakuzai', tonpuku_chozai: 'e_tonpuku_amt',
  gaiyou_zai: 'e_gaiyou_zai', gaiyou_yakuzai: 'e_gaiyou_yakuzai', gaiyou_chozai: 'e_gaiyou_amt',
  chusya_zai: 'e_chusya_zai', chusya_yakuzai: 'e_chusya_yakuzai', chusya_chozai: 'e_chusya_amt',
  naiteki_zai: 'e_naiteki_zai', naiteki_yakuzai: 'e_naiteki_yakuzai', naiteki_chozai: 'e_naiteki_amt',
  zairyo_zai: 'e_zairyo_zai', zairyo_yakuzai: 'e_zairyo_yakuzai', zairyo_chozai: 'e_zairyo_amt',
  chozai_total: 'e_chozai_total',
  // 薬剤調製料加算
  naifuku_mayaku:'e_kaz_nai_mayaku', naifuku_doku:'e_kaz_nai_doku', naifuku_kakusei:'e_kaz_nai_kakusei',
  naifuku_mukyoko:'e_kaz_nai_mukyoko', naifuku_keiryo:'e_kaz_nai_keiryo', naifuku_keiryo_yo:'e_kaz_nai_keiryo_yo',
  naifuku_jika:'e_kaz_nai_jika', naifuku_jika_yo:'e_kaz_nai_jika_yo', naifuku_mukin:'e_kaz_nai_mukin',
  naifuku_jikou:'e_kaz_nai_jikou', naifuku_kazan_total:'e_kaz_nai_total',
  tonpuku_mayaku:'e_kaz_ton_mayaku', tonpuku_doku:'e_kaz_ton_doku', tonpuku_kakusei:'e_kaz_ton_kakusei',
  tonpuku_mukyoko:'e_kaz_ton_mukyoko', tonpuku_keiryo:'e_kaz_ton_keiryo', tonpuku_keiryo_yo:'e_kaz_ton_keiryo_yo',
  tonpuku_jika:'e_kaz_ton_jika', tonpuku_jika_yo:'e_kaz_ton_jika_yo', tonpuku_mukin:'e_kaz_ton_mukin',
  tonpuku_jikou:'e_kaz_ton_jikou', tonpuku_kazan_total:'e_kaz_ton_total',
  gaiyou_mayaku:'e_kaz_gai_mayaku', gaiyou_doku:'e_kaz_gai_doku', gaiyou_kakusei:'e_kaz_gai_kakusei',
  gaiyou_mukyoko:'e_kaz_gai_mukyoko', gaiyou_keiryo:'e_kaz_gai_keiryo', gaiyou_keiryo_yo:'e_kaz_gai_keiryo_yo',
  gaiyou_jika:'e_kaz_gai_jika', gaiyou_jika_yo:'e_kaz_gai_jika_yo', gaiyou_mukin:'e_kaz_gai_mukin',
  gaiyou_jikou:'e_kaz_gai_jikou', gaiyou_kazan_total:'e_kaz_gai_total',
  chusya_mayaku:'e_kaz_chu_mayaku', chusya_doku:'e_kaz_chu_doku', chusya_kakusei:'e_kaz_chu_kakusei',
  chusya_mukyoko:'e_kaz_chu_mukyoko', chusya_keiryo:'e_kaz_chu_keiryo', chusya_keiryo_yo:'e_kaz_chu_keiryo_yo',
  chusya_jika:'e_kaz_chu_jika', chusya_jika_yo:'e_kaz_chu_jika_yo', chusya_mukin:'e_kaz_chu_mukin',
  chusya_jikou:'e_kaz_chu_jikou', chusya_kazan_total:'e_kaz_chu_total',
  naiteki_mayaku:'e_kaz_nai2_mayaku', naiteki_doku:'e_kaz_nai2_doku', naiteki_kakusei:'e_kaz_nai2_kakusei',
  naiteki_mukyoko:'e_kaz_nai2_mukyoko', naiteki_keiryo:'e_kaz_nai2_keiryo', naiteki_keiryo_yo:'e_kaz_nai2_keiryo_yo',
  naiteki_jika:'e_kaz_nai2_jika', naiteki_jika_yo:'e_kaz_nai2_jika_yo', naiteki_mukin:'e_kaz_nai2_mukin',
  naiteki_jikou:'e_kaz_nai2_jikou', naiteki_kazan_total:'e_kaz_nai2_total',
  kaz_total_kazan_total:'e_chozai_kazan_total',
  // 薬剤調製料加算（浸煎）
  sinsenn_mayaku:'e_kaz_sin_mayaku', sinsenn_doku:'e_kaz_sin_doku', sinsenn_kakusei:'e_kaz_sin_kakusei',
  sinsenn_mukyoko:'e_kaz_sin_mukyoko', sinsenn_keiryo:'e_kaz_sin_keiryo', sinsenn_keiryo_yo:'e_kaz_sin_keiryo_yo',
  sinsenn_jika:'e_kaz_sin_jika', sinsenn_jika_yo:'e_kaz_sin_jika_yo', sinsenn_mukin:'e_kaz_sin_mukin',
  sinsenn_jikou:'e_kaz_sin_jikou',
  // 薬剤調製料加算（湯薬）
  yuyaku_mayaku:'e_kaz_yu_mayaku', yuyaku_doku:'e_kaz_yu_doku', yuyaku_kakusei:'e_kaz_yu_kakusei',
  yuyaku_mukyoko:'e_kaz_yu_mukyoko', yuyaku_keiryo:'e_kaz_yu_keiryo', yuyaku_keiryo_yo:'e_kaz_yu_keiryo_yo',
  yuyaku_jika:'e_kaz_yu_jika', yuyaku_jika_yo:'e_kaz_yu_jika_yo', yuyaku_mukin:'e_kaz_yu_mukin',
  yuyaku_jikou:'e_kaz_yu_jikou',
  // 薬剤調製料加算（材料）
  zairyo_mayaku:'e_kaz_mat_mayaku', zairyo_doku:'e_kaz_mat_doku', zairyo_kakusei:'e_kaz_mat_kakusei',
  zairyo_mukyoko:'e_kaz_mat_mukyoko', zairyo_keiryo:'e_kaz_mat_keiryo', zairyo_keiryo_yo:'e_kaz_mat_keiryo_yo',
  zairyo_jika:'e_kaz_mat_jika', zairyo_jika_yo:'e_kaz_mat_jika_yo', zairyo_mukin:'e_kaz_mat_mukin',
  zairyo_jikou:'e_kaz_mat_jikou',
  // 薬剤調製料加算 合計行
  kaz_total_mayaku:'e_kaz_col_mayaku', kaz_total_doku:'e_kaz_col_doku', kaz_total_kakusei:'e_kaz_col_kakusei',
  kaz_total_mukyoko:'e_kaz_col_mukyoko', kaz_total_keiryo:'e_kaz_col_keiryo', kaz_total_keiryo_yo:'e_kaz_col_keiryo_yo',
  kaz_total_jika:'e_kaz_col_jika', kaz_total_jika_yo:'e_kaz_col_jika_yo', kaz_total_mukin:'e_kaz_col_mukin',
  kaz_total_jikou:'e_kaz_col_jikou',
  // 薬学管理料
  chmgr_nai_amt: 'e_chmgr_nai_amt', chmgr_other_cnt: 'e_chmgr_other_cnt', chmgr_other_amt: 'e_chmgr_other_amt',
  jukufuku_other_cnt: 'e_jukufuku_other_cnt', jukufuku_other_amt: 'e_jukufuku_other_amt',
  jukufuku_zan_cnt: 'e_jukufuku_zan_cnt', jukufuku_zan_amt: 'e_jukufuku_zan_amt',
  iryo_joho_cnt: 'e_iryo_joho_cnt', iryo_joho_amt: 'e_iryo_joho_amt',
  jikangai_kanri_amt: 'e_jikangai_kanri_amt',
  fuyaku_a_cnt: 'e_fuyaku_a_cnt', fuyaku_a_amt: 'e_fuyaku_a_amt',
  fuyaku_b_cnt: 'e_fuyaku_b_cnt', fuyaku_b_amt: 'e_fuyaku_b_amt',
  fuyaku_c_cnt: 'e_fuyaku_c_cnt', fuyaku_c_amt: 'e_fuyaku_c_amt',
  fuyaku_3_amt: 'e_fuyaku_3_amt', fuyaku_renkei_cnt: 'e_fuyaku_toku2a_cnt', fuyaku_renkei_amt: 'e_fuyaku_toku2a_amt',
  kakari_cnt: 'e_kakari_76_cnt', kakari_amt: 'e_kakari_76_amt',
  mayaku_shido_amt: 'e_mayaku_shido_amt',
  tokutei_1i_cnt: 'e_tokutei_1i_cnt', tokutei_1i_amt: 'e_tokutei_1i_amt',
  tokutei_1ro_cnt: 'e_tokutei_1ro_cnt', tokutei_1ro_amt: 'e_tokutei_1ro_amt',
  tokutei_2_amt: 'e_tokutei_2_amt',
  tokutei_3i_cnt: 'e_tokutei_3i_cnt', tokutei_3i_amt: 'e_tokutei_3i_amt',
  tokutei_3ro_amt: 'e_tokutei_3ro_amt',
  kyunyu_amt: 'e_kyunyu_30_amt', nyuyoji_cnt: 'e_nyuyoji_12_cnt', nyuyoji_amt: 'e_nyuyoji_12_amt',
  shoni_amt: 'e_shoni_350_amt', chozaigo_amt: 'e_chozaigo_60_amt',
  kakari_hokatsu_amt: 'e_kakari_291_amt',
  fuyaku_joho1_amt: 'e_fuyaku_joho1_amt', fuyaku_joho2_cnt: 'e_fuyaku_joho2_cnt', fuyaku_joho2_amt: 'e_fuyaku_joho2_amt',
  fuyaku_joho3_amt: 'e_fuyaku_joho3_amt',
  gaifuku1_amt: 'e_gaifuku1_amt', gaifuku2_amt: 'e_gaifuku2_14_amt',
  // 外来服薬支援料2（日数別）
  gaifuku2_7_cnt: 'e_gaifuku2_7_cnt', gaifuku2_7_amt: 'e_gaifuku2_7_amt',
  gaifuku2_14_cnt: 'e_gaifuku2_14_cnt', gaifuku2_14_amt: 'e_gaifuku2_14_amt',
  gaifuku2_21_cnt: 'e_gaifuku2_21_cnt', gaifuku2_21_amt: 'e_gaifuku2_21_amt',
  gaifuku2_28_cnt: 'e_gaifuku2_28_cnt', gaifuku2_28_amt: 'e_gaifuku2_28_amt',
  gaifuku2_35_cnt: 'e_gaifuku2_35_cnt', gaifuku2_35_amt: 'e_gaifuku2_35_amt',
  gaifuku2_42_cnt: 'e_gaifuku2_42_cnt', gaifuku2_42_amt: 'e_gaifuku2_42_amt',
  gaifuku2_43_cnt: 'e_gaifuku2_43_cnt', gaifuku2_43_amt: 'e_gaifuku2_43_amt',
  setsurenkei_amt: 'e_setsurenkei_amt', fukuyou1_amt: 'e_fukuyou1_amt', fukuyou2_amt: 'e_fukuyou2_amt',
  keikan_amt: 'e_keikan_amt',
  // 在宅
  zaitaku_1nin_cnt: 'e_zaitaku_1nin_cnt', zaitaku_1nin_amt: 'e_zaitaku_1nin_amt',
  zaitaku_other_cnt: 'e_zaitaku_2_9_cnt', zaitaku_other_amt: 'e_zaitaku_2_9_amt',
  zaitaku_kinkyu1_amt: 'e_zaitaku_kinkyu1_amt', zaitaku_kinkyu2_amt: 'e_zaitaku_kinkyu2_amt',
  zaitaku_kyodo_amt: 'e_zaitaku_kyodo_amt',
  zaitaku_mayaku_amt: 'e_zaitaku_mayaku_amt', zaitaku_nyuyoji_amt: 'e_zaitaku_nyuyoji_amt',
  zaitaku_shoni_amt: 'e_zaitaku_shoni_amt', zaitaku_mayaku_chu_amt: 'e_zaitaku_mayaku_chu_amt',
  zaitaku_chushin_amt: 'e_zaitaku_chushin_amt',
  yakan_homon_amt: 'e_yakan_homon_amt', kyujitsu_homon_amt: 'e_kyujitsu_homon_amt',
  shinya_homon_amt: 'e_shinya_homon_amt',
  taiin_kyodo_amt: 'e_taiin_kyodo_amt', zaitaku_iko_amt: 'e_zaitaku_iko_amt',
  // 介護
  kaigo1_cnt: 'e_kaigo1_cnt', kaigo1_amt: 'e_kaigo1_amt',
  kaigo2_cnt: 'e_kaigo2_cnt', kaigo2_amt: 'e_kaigo2_amt',
  kaigo3_cnt: 'e_kaigo3_cnt', kaigo3_amt: 'e_kaigo3_amt',
  kaigo4_cnt: 'e_kaigo4_cnt', kaigo4_amt: 'e_kaigo4_amt',
  kaigo_y1_cnt: 'e_kaigo_y1_cnt', kaigo_y1_amt: 'e_kaigo_y1_amt',
  kaigo_y2_cnt: 'e_kaigo_y2_cnt', kaigo_y2_amt: 'e_kaigo_y2_amt',
  kaigo_y3_cnt: 'e_kaigo_y3_cnt', kaigo_y3_amt: 'e_kaigo_y3_amt',
  kaigo_mayaku_cnt: 'e_kaigo_mayaku_cnt', kaigo_mayaku_amt: 'e_kaigo_mayaku_amt',
  kaigo_chushin_cnt: 'e_kaigo_chushin_cnt', kaigo_chushin_amt: 'e_kaigo_chushin_amt',
};

function parseCsvText(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const header = lines[0].split(',').map(h => h.trim());
  // 複数列形式（tokei_all.csv等）の判定
  const isMultiCol = header.length > 2 && /^\d{4}-\d{2}$/.test(header[1]);
  if (isMultiCol) {
    // 複数月を一括パース: { "2025-05": {key:val,...}, "2025-06": ... }
    const months = header.slice(1);
    const result = {};
    for (const m of months) result[m] = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const k = cols[0] ? cols[0].trim() : '';
      if (!k) continue;
      for (let j = 1; j < cols.length && j - 1 < months.length; j++) {
        result[months[j-1]][k] = cols[j] ? cols[j].trim() : '';
      }
    }
    return { multi: result, months };
  }
  // 単月キーバリュー形式
  const data = {};
  let yearMonth = null;
  for (let i = 1; i < lines.length; i++) {
    const [key, val] = lines[i].split(',');
    if (!key) continue;
    const k = key.trim();
    const v = val ? val.trim() : '';
    data[k] = v;
    if (k === 'year_month') yearMonth = v;
  }
  return { data, yearMonth };
}

function applyCsvToFields(data, source) {
  const cssClass = source === 'kazan' ? 'src-naiyaku' : 'src-tokei';
  // 統計表CSVはフル上書き、加算内訳CSVはマージ（既存値を残す）
  if (source !== 'kazan') clearFields();
  let matched = 0;
  for (const [csvKey, fieldId] of Object.entries(CSV_FIELD_MAP)) {
    if (data[csvKey] !== undefined && data[csvKey] !== '') {
      const el = document.getElementById(fieldId);
      if (el) {
        // 加算内訳CSVは既存値があればスキップ（空欄のみ補完）
        if (source === 'kazan' && el.value && el.value !== '0') continue;
        el.value = data[csvKey];
        if (!el.classList.contains('src-tokei') && !el.classList.contains('src-uke')) {
          el.classList.add(cssClass);
        }
        matched++;
      }
    }
  }
  // 合計を自動計算
  calcGrandTotal();
  return matched;
}

async function handleCsvFiles(files, source) {
  const status = document.getElementById('uke-status');
  if (!files || files.length === 0) return;
  const label = source === 'kazan' ? '加算内訳CSV' : '統計表CSV';
  const fileInputId = source === 'kazan' ? 'file-kazan' : 'file-csv';

  const fileList = Array.from(files);
  let totalProcessed = 0;

  for (const file of fileList) {
    try {
      status.textContent = `読み込み中: ${file.name}...`;
      // UTF-8で読み、失敗時はShift-JISで再試行
      let text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = () => rej(new Error('ファイル読み取り失敗'));
        r.readAsText(file, 'utf-8');
      });
      // Shift-JIS検出：UTF-8で読んだ時に置換文字が多い場合
      if ((text.match(/\uFFFD/g) || []).length > 3) {
        text = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.onerror = () => rej(new Error('ファイル読み取り失敗'));
          r.readAsText(file, 'shift-jis');
        });
      }

      const parsed = parseCsvText(text);
      if (!parsed) {
        status.style.color = 'var(--red)';
        const lineCount = text.split(/\r?\n/).filter(l => l.trim()).length;
        status.textContent = `CSV形式エラー: ${file.name}（${lineCount}行検出 — ヘッダー＋データが2行以上必要です）`;
        continue;
      }

      // 複数月形式（tokei_all.csv / kazan_all.csv等）
      if (parsed.multi) {
        for (const m of parsed.months) {
          document.getElementById('input-month').value = m;
          loadEntry();  // 既存データを読み込んでから上書き
          applyCsvToFields(parsed.multi[m], source);
          saveEntry(true);
          totalProcessed++;
        }
        status.style.color = 'var(--teal)';
        status.textContent = `✓ ${file.name}（${label}）→ ${parsed.months.length}ヶ月分を一括インポート・保存しました`;
        renderMonthList();
        document.getElementById(fileInputId).value = '';
        return;
      }

      // 単月形式
      if (parsed.yearMonth) {
        document.getElementById('input-month').value = parsed.yearMonth;
        loadEntry();  // 既存データを読み込んでから上書き
      }

      const matched = applyCsvToFields(parsed.data, source);
      totalProcessed++;

      // 複数ファイルの場合は自動保存
      if (fileList.length > 1) {
        saveEntry(true);
      }

      status.style.color = 'var(--teal)';
      status.textContent = `✓ ${file.name}（${label}）→ ${parsed.yearMonth || '?'} （${matched}項目）を読み込みました。確認して「保存」してください。`;
    } catch (err) {
      status.style.color = 'var(--red)';
      status.textContent = `エラー: ${file.name} - ${err.message}`;
      console.error('CSV読み込みエラー:', err);
    }
  }

  if (fileList.length > 1) {
    status.style.color = 'var(--teal)';
    status.textContent = `✓ ${totalProcessed}ファイル（${label}）を一括インポート・保存しました`;
  }
  renderMonthList();
  document.getElementById(fileInputId).value = '';
}

// ===== 自動JSONファイル保存 =====
let fileHandle = null; // File System Access APIのハンドル

async function autoSaveJSON() {
  const json = JSON.stringify(DB, null, 2);
  // File System Access API対応ブラウザ（Chrome等）
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch(e) { fileHandle = null; }
  }
  return false;
}

async function pickSaveFile() {
  // 初回のみファイル選択ダイアログ
  if (window.showSaveFilePicker) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: 'migiude_data.json',
        types: [{ description: 'JSON', accept: {'application/json': ['.json']} }]
      });
      localStorage.setItem('migiude_autosave', 'true');
      return true;
    } catch(e) { return false; }
  }
  return false;
}

async function saveToFile() {
  if (!fileHandle) {
    const ok = await pickSaveFile();
    if (!ok) return;
  }
  const saved = await autoSaveJSON();
  if (saved) {
    document.getElementById('uke-status').textContent = '✅ JSONファイルに自動保存しました';
  }
}

function exportJSON() {
  const json = JSON.stringify(DB, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'migiude_data.json';
  a.click();
  URL.revokeObjectURL(url);
  document.getElementById('uke-status').textContent = '✅ migiude_data.json にエクスポートしました';
}

function importJSON(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      // 既存データとマージ（上書き）
      Object.assign(DB, imported);
      localStorage.setItem('pharmacy_db', JSON.stringify(DB));
      updatePeriodSelect();
      renderMonthList();
      document.getElementById('uke-status').textContent =
        `✅ ${Object.keys(imported).length}ヶ月分のデータをインポートしました`;
    } catch(err) {
      document.getElementById('uke-status').textContent = `❌ インポートエラー: ${err.message}`;
    }
    input.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function handleUkeDrop(e) {
  e.preventDefault();
  const dropEl = e.currentTarget || e.target.closest('.import-panel');
  if (dropEl) dropEl.style.borderColor = '';
  handleUkeFile(e.dataTransfer.files);
}

// ===== 届出・要件モーダル =====
const ITEM_INFO = {
  // ===== 調剤基本料・体制加算 =====
  '調剤基本料':{t:'調剤基本料',d:'薬局が処方箋を受け付けた際の基本報酬。',n:'薬局の経営基盤を支える最も基本的な技術料。届出区分は受付回数・集中率・グループ規模で決定。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t84.pdf" target="_blank"><b>様式84</b></a>・<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t84.pdf" target="_blank"><b>85</b></a></li><li><b>基本料1（45点）</b>：2〜3・特別のいずれにも非該当</li><li><b>基本料2（29点）</b>：受付4,000回超＆上位3の集中率70%超 等</li><li><b>基本料3イ（24点）</b>：グループ3.5万〜4万回＆集中率95%超</li><li><b>基本料3ロ（19点）</b>：グループ40万回超＆集中率85%超</li><li><b>基本料3ハ（35点）</b>：グループ40万回超＆集中率85%以下</li><li><b>特別A（32点）</b>：同一敷地内＆集中率50%超</li><li><b>特別B（5点）</b>：届出なし</li>'},
  '地域支援体制加算':{t:'地域支援体制加算',d:'地域医療に貢献する薬局への評価。',n:'かかりつけ機能・在宅対応・24時間体制など、地域の医薬品供給拠点としての役割を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t87-3.pdf" target="_blank"><b>様式87の3</b></a>（共通基準）・<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t87-3-2.pdf" target="_blank"><b>様式87の3の2</b></a>（実績基準）</li><li><b>加算1（32点）</b>：基本料1＋必須1＋選択2以上</li><li><b>加算2（40点）</b>：基本料1＋選択8以上</li><li><b>加算3（10点）</b>：基本料1以外＋必須2＋選択1以上</li><li><b>加算4（32点）</b>：基本料1以外＋選択8以上</li><li style="font-size:12px;color:#666">基本体制：1,200品目以上、24時間対応、在宅体制 等</li>'},
  '後発医薬品調剤体制加算':{t:'後発医薬品調剤体制加算',d:'後発医薬品（ジェネリック）の使用促進への評価。',n:'医療費適正化のため、後発医薬品の調剤割合が高い薬局を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t87.pdf" target="_blank"><b>様式87</b></a></li><li><b>加算1（21点）</b>：調剤数量80%以上</li><li><b>加算2（28点）</b>：85%以上</li><li><b>加算3（30点）</b>：90%以上</li><li style="font-size:12px;color:#666">※50%以下は減算（▲5点）</li>'},
  '連携強化加算':{t:'連携強化加算（5点）',d:'災害・感染症発生時の対応体制への評価。',n:'新興感染症等に備えた体制整備・実績を評価し、有事の際の医薬品供給を確保する。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t87-3-4.pdf" target="_blank"><b>様式87の3の4</b></a></li><li><b>施設基準</b><ul><li>第二種協定指定医療機関の指定を受けていること</li><li>災害や新興感染症発生時等の対応についての地域の協議会・研修等に参加</li><li>新興感染症等の発生時に自治体の要請に応じて対応する体制（PCR検査、自宅療養者への薬剤交付等）</li><li>対応実績を有すること</li></ul></li>'},
  '医療DX推進体制整備加算':{t:'医療DX推進体制整備加算',d:'医療分野のデジタル化推進への評価。',n:'電子処方箋・マイナ保険証の普及を推進し、医療情報の利活用体制を整備する薬局を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t87-3-6.pdf" target="_blank"><b>様式87の3の6</b></a></li><li><b>施設基準</b><ul><li>電子処方箋の受付体制</li><li>電子薬歴の導入</li><li>マイナンバーカードの健康保険証利用の実績</li><li>マイナポータルの薬剤情報を活用した相談対応体制</li></ul></li><li><b>加算1（8点→R7:7点）</b>：マイナ保険証利用率15%以上（R7.1〜30%）</li><li><b>加算2（10点→R7:6点）</b>：マイナ保険証利用率10%以上（R7.1〜20%）</li><li><b>加算3（4点）</b>：マイナ保険証利用率5%以上（R7.1〜10%）</li>'},
  '在宅薬学総合体制加算':{t:'在宅薬学総合体制加算',d:'在宅医療に対応できる体制への評価。',n:'在宅訪問の実績と高度な在宅対応体制（無菌調製、麻薬管理等）を持つ薬局を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t87-3-5.pdf" target="_blank"><b>様式87の3の5</b></a></li><li><b>加算1（15点）施設基準</b><ul><li>在宅患者訪問薬剤管理指導料等の算定回数が年24回以上</li><li>緊急時の対応体制（24時間対応）</li><li>医療材料・衛生材料の供給体制</li></ul></li><li><b>加算2（50点）追加要件</b>：加算1の要件＋以下のいずれか<ul><li>医療用麻薬（注射薬含む）の備蓄＆無菌製剤処理体制</li><li>乳幼児・小児特定加算6回以上、かかりつけ薬剤師指導料24回以上、高度管理医療機器の販売許可 等</li></ul></li>'},
  '夜間・休日等加算':{t:'夜間・休日等加算（40点）',d:'開局時間外の調剤への評価。',n:'夜間・休日・深夜に調剤を行った場合の追加報酬。患者の緊急時のアクセスを確保する。'},
  // ===== 薬剤調製料 =====
  '薬剤調製料':{t:'薬剤調製料',d:'処方箋に基づき薬剤を調製する技術料。',n:'薬剤師が処方内容を確認し、薬剤を正確に調製・交付する行為への基本評価。剤形ごとに点数が異なる。',
    x:'<li><b>内服薬</b>：24点/剤（3剤分まで）</li><li><b>屯服薬</b>：21点</li><li><b>外用薬</b>：10点/調剤（3調剤分まで）</li><li><b>注射薬</b>：26点</li><li><b>内服用滴剤</b>：10点</li><li><b>浸煎薬</b>：190点</li>'},
  // ===== 薬剤調製料加算 =====
  '麻薬':{t:'麻薬加算（70点）',d:'麻薬を含む処方の調剤への加算。',n:'麻薬の厳格な管理（施錠保管・帳簿記録・廃棄管理）を要する調剤行為を評価。'},
  '毒薬':{t:'毒薬加算（8点）',d:'毒薬を含む処方の調剤への加算。',n:'毒薬の厳格な管理（施錠保管・記録）を要する調剤行為を評価。'},
  '覚醒剤':{t:'覚醒剤原料加算（8点）',d:'覚醒剤原料を含む処方の調剤への加算。',n:'覚醒剤原料の厳格な管理を要する調剤行為を評価。'},
  '向精神':{t:'向精神薬加算（8点）',d:'向精神薬を含む処方の調剤への加算。',n:'向精神薬の適切な管理を要する調剤行為を評価。'},
  '計量':{t:'計量混合加算',d:'散剤・液剤等の計量混合調剤への加算。',n:'既製品でなく、薬剤師が計量・混合して調製する手間を評価。',
    x:'<li><b>液剤</b>：35点</li><li><b>散剤・顆粒剤</b>：45点</li><li><b>軟・硬膏剤</b>：80点</li>'},
  '自家':{t:'自家製剤加算',d:'薬局で錠剤の粉砕・半錠加工等を行う場合の加算。',n:'市販されていない剤形への加工（錠剤→散剤、半錠等）を薬局が自ら行う技術を評価。'},
  '無菌':{t:'無菌製剤処理加算',d:'注射薬の無菌調製への加算。',n:'クリーンベンチ等を用いた無菌環境での注射薬混合調製を評価。在宅中心静脈栄養等に必要。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t88.pdf" target="_blank"><b>様式88</b></a></li><li><b>施設基準</b><ul><li>無菌製剤処理を行うための専用施設（クリーンベンチまたは安全キャビネット）を有すること</li><li>無菌製剤処理に関する十分な経験を有する薬剤師が配置されていること</li></ul></li><li><b>点数</b><ul><li>中心静脈栄養法用輸液：69点（6歳未満137点）</li><li>抗悪性腫瘍剤：79点（6歳未満147点）</li><li>麻薬：69点（6歳未満137点）</li></ul></li>'},
  '時間外':{t:'時間外加算（薬剤調製料）',d:'時間外の薬剤調製への加算。',n:'開局時間外に調剤を行った場合の追加評価。'},
  // ===== 薬学管理料 =====
  '調剤管理料':{t:'調剤管理料',d:'処方内容の分析・薬歴管理の技術料。',n:'処方箋受付時に薬剤服用歴を確認し、重複投薬・相互作用等を確認する薬学的管理を評価。',
    x:'<li>イ）7日分以下：4点</li><li>ロ）8〜14日分：28点</li><li>ハ）15〜28日分：50点</li><li>ニ）29日分以上：60点</li><li>内服以外：4点</li>'},
  '重複投薬・相互作用等防止加算':{t:'重複投薬・相互作用等防止加算',d:'処方変更の提案により重複投薬等を防止した場合の加算。',n:'薬剤師が処方医に疑義照会し、重複投薬・相互作用・副作用等を未然に防ぐ行為を評価。',
    x:'<li><b>残薬以外（40点）</b>：重複投薬・相互作用・副作用等</li><li><b>残薬調整（20点）</b>：残薬による投与量変更</li>'},
  '医療情報取得加算':{t:'医療情報取得加算（1点）',d:'マイナ保険証等で薬剤情報を取得した場合の加算。',n:'オンライン資格確認による薬剤情報・特定健診情報の活用を推進。年1回算定可。'},
  '時間外加算（調剤管理料）':{t:'時間外加算（調剤管理料）',d:'時間外の調剤管理への加算。',n:'開局時間外に調剤管理を行った場合の追加評価。'},
  '服薬管理指導料':{t:'服薬管理指導料',d:'患者への服薬指導・薬歴管理の技術料。',n:'薬剤師が患者に薬の効果・副作用・飲み方等を説明し、服薬状況を管理する行為を評価。',
    x:'<li><b>薬A（45点）</b>：手帳あり・3月以内の再調剤</li><li><b>薬B（59点）</b>：手帳なし・3月以内</li><li><b>薬C（59点）</b>：3月以外（初回等）</li><li><b>薬3（45点）</b>：特養入居者</li><li><b>特2A（59点）</b>：連携薬剤師による対応</li>'},
  'かかりつけ薬剤師指導料':{t:'かかりつけ薬剤師指導料（76点）',d:'かかりつけ薬剤師による一元的・継続的な薬学管理。',n:'患者が選んだかかりつけ薬剤師が、全ての処方薬を把握し、一元的・継続的に管理する行為を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t90.pdf" target="_blank"><b>様式90</b></a></li><li><b>施設基準</b><ul><li>薬剤師としての経験が3年以上</li><li>当該保険薬局に週32時間以上勤務（育児等短時間勤務は週24時間以上＆週4日以上）</li><li>当該保険薬局に6月以上在籍</li><li>研修認定薬剤師を取得していること</li><li>医療に係る地域活動の取組に参画していること</li></ul></li><li><b>算定要件</b><ul><li>患者から文書による同意を得ること</li><li>患者が指名した薬剤師が対応</li><li>服薬情報等提供料との併算定不可</li></ul></li>'},
  '麻薬管理指導加算':{t:'麻薬管理指導加算（22点/70点）',d:'麻薬処方患者への管理指導への加算。',n:'麻薬の服用管理・副作用モニタリング・残薬管理等を行い、適切な疼痛管理を支援する。'},
  '特定薬剤管理指導加算1':{t:'特定薬剤管理指導加算1',d:'ハイリスク薬の服薬指導への加算。',n:'特に安全管理が必要な医薬品（抗がん剤・免疫抑制剤等）の新規処方時や変化時の指導を評価。',
    x:'<li><b>イ）新規処方（10点）</b>：ハイリスク薬の新規処方時</li><li><b>ロ）変化時（5点）</b>：用量変更等の変化時</li>'},
  '特定薬剤管理指導加算2':{t:'特定薬剤管理指導加算2（100点）',d:'抗がん剤治療の服薬指導への加算。',n:'抗悪性腫瘍剤の注射療法を受ける患者への専門的な服薬管理を評価。月1回。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t92.pdf" target="_blank"><b>様式92</b></a></li><li><b>施設基準</b><ul><li>化学療法（がん薬物療法）に関する十分な経験を有する薬剤師が配置されていること</li><li>抗悪性腫瘍剤に係る適切な研修を修了していること</li></ul></li><li><b>算定要件</b><ul><li>抗悪性腫瘍剤の注射が処方された患者</li><li>悪性腫瘍の治療に係る調剤が行われる場合</li><li>レジメン等の確認・副作用モニタリング・処方医への情報提供</li></ul></li>'},
  '特定薬剤管理指導加算3':{t:'特定薬剤管理指導加算3',d:'RMP対象薬・選定療養の説明への加算。',n:'医薬品リスク管理計画(RMP)に基づく指導や、長期収載品の選定療養に関する説明を評価。',
    x:'<li><b>イ）RMP（5点）</b>：対象医薬品の初回処方時</li><li><b>ロ）選定療養・銘柄変更（10点）</b>：長期収載品の選択等の初回説明時</li>'},
  '乳幼児服薬指導加算':{t:'乳幼児服薬指導加算（12点）',d:'6歳未満の乳幼児への服薬指導への加算。',n:'乳幼児特有の服薬困難（味・剤形・投与量調整等）に対応した指導を評価。'},
  '小児特定加算':{t:'小児特定加算',d:'医療的ケア児への服薬指導への加算。',n:'人工呼吸器・経管栄養等の医療的ケアを必要とする18歳未満の患者への高度な服薬管理を評価。',type:'youken',
    x:'<li><b>算定要件</b><ul><li>18歳未満の医療的ケア児が対象</li><li>人工呼吸器管理、気管切開管理、経管栄養、酸素療法等の医療的ケアを必要とする患者</li><li>主治医から提供される医療的ケアの情報を踏まえた服薬管理</li></ul></li><li><b>点数</b>：服薬管理指導料 350点 / 在宅 450点（オンライン 350点）</li>'},
  '吸入薬指導加算':{t:'吸入薬指導加算（30点）',d:'吸入薬の使用方法の実技指導への加算。',n:'喘息・COPD患者が吸入薬を正しく使用できるよう、実技指導と処方医への情報提供を評価。3月に1回。',type:'youken',
    x:'<li><b>算定要件</b><ul><li>喘息または慢性閉塞性肺疾患（COPD）の患者が対象</li><li>吸入薬が処方されている患者に、吸入手技の実技指導を実施</li><li>文書（吸入指導チェックリスト等）を用いて指導内容を記録</li><li>処方医に対し吸入指導の結果を文書で情報提供すること</li></ul></li><li>3月に1回算定可</li>'},
  '調剤後薬剤管理指導料':{t:'調剤後薬剤管理指導料（60点）',d:'調剤後の電話等によるフォローアップへの評価。',n:'インスリン新規開始や心不全患者等の調剤後に、電話等で副作用・服用状況を確認し処方医に報告する行為を評価。',type:'youken',
    x:'<li><b>算定要件</b><ul><li>地域支援体制加算の届出を行っている薬局であること</li><li><b>対象患者</b>：①糖尿病患者（インスリン製剤・SU剤の新規処方または投与量変更時） ②慢性心不全患者（心疾患による入院歴あり）</li><li>調剤後に電話等により服用状況・副作用の有無等を確認</li><li>確認結果を踏まえた指導を実施し、処方医に文書で情報提供</li></ul></li><li>月1回算定可</li>'},
  'かかりつけ薬剤師包括管理料':{t:'かかりつけ薬剤師包括管理料（291点）',d:'かかりつけ薬剤師による包括的管理への評価。',n:'地域包括診療料等を算定する医療機関の処方について、かかりつけ薬剤師が包括的に管理する。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kantoshinetsu/r6-t90.pdf" target="_blank"><b>様式90</b></a>（かかりつけ薬剤師指導料と同じ）</li><li><b>施設基準</b><ul><li>かかりつけ薬剤師指導料の施設基準を全て満たすこと</li></ul></li><li><b>算定要件</b><ul><li>地域包括診療料・地域包括診療加算等を算定する医療機関の処方が対象</li><li>服薬管理指導料・服薬情報等提供料との併算定不可</li><li>調剤料・薬学管理料を包括して算定</li></ul></li>'},
  '服薬情報等提供料':{t:'服薬情報等提供料',d:'医療機関等への服薬情報の文書提供への評価。',n:'薬局が把握した服薬状況・副作用情報等を、処方医や介護関係者に文書で提供する行為を評価。',
    x:'<li><b>提供料1（30点）</b>：医療機関からの求めに応じて提供</li><li><b>提供料2（20点）</b>：薬剤師の判断で提供（医療機関・リフィル後・ケアマネ）</li><li><b>提供料3（50点）</b>：入院予定患者の情報提供。3月1回</li>'},
  '外来服薬支援料1':{t:'外来服薬支援料1（185点）',d:'残薬整理・服薬支援への評価。',n:'患者が自宅に持つ残薬を整理し、処方医に報告して処方調整につなげる行為を評価。月1回。'},
  '外来服薬支援料2':{t:'外来服薬支援料2',d:'一包化調剤への評価。',n:'多剤服用の患者が正しく服用できるよう、服用時点ごとに薬をまとめる一包化の手間を評価。',
    x:'<li>日数に応じて34点（7日）〜240点（43日以上）</li>'},
  '施設連携加算':{t:'施設連携加算（50点）',d:'介護施設との連携による服薬支援への評価。',n:'入所中の患者を訪問し、施設職員と協働して服薬管理・支援を行う行為を評価。月1回。'},
  '服用薬剤調整支援料':{t:'服用薬剤調整支援料',d:'ポリファーマシー（多剤服用）解消への評価。',n:'6種類以上の内服薬を服用する患者の減薬提案・実現を評価し、多剤服用リスクを低減する。',
    x:'<li><b>支援料1（125点）</b>：2種類以上の減少を実現。月1回</li><li><b>支援料2</b>：処方医への減薬提案。3月1回</li>'},
  '経管投薬支援料':{t:'経管投薬支援料',d:'経管栄養チューブからの投薬に関する支援への評価。',n:'経管栄養の患者に対し、簡易懸濁法等の適切な投薬方法を指導・支援する行為を評価。'},
  // ===== 在宅 =====
  '在宅患者訪問薬剤管理指導料':{t:'在宅患者訪問薬剤管理指導料',d:'在宅患者への訪問薬剤管理の基本報酬。',n:'通院困難な在宅療養患者の自宅を訪問し、残薬・副作用確認、服薬指導を行う行為を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kinki/r6-t89.pdf" target="_blank"><b>様式89</b></a></li><li><b>施設基準</b><ul><li>在宅患者に対する薬学的管理及び指導の体制</li><li>医師の指示に基づく薬学的管理指導計画の策定</li><li>緊急時の対応体制</li></ul></li><li><b>点数</b>：単一建物1人 650点 / 2〜9人 320点 / 10人以上 290点</li><li>月4回まで（末期悪性腫瘍等は週2回＆月8回まで）</li>'},
  '在宅患者緊急訪問薬剤管理指導料':{t:'在宅患者緊急訪問薬剤管理指導料',d:'緊急時の在宅訪問への評価。',n:'在宅患者の急変時に医師の指示で緊急訪問し、薬学的管理を行う行為を評価。',
    x:'<li><b>指導料1（500点）</b>：計画的訪問に係る疾患の急変</li><li><b>指導料2（200点）</b>：それ以外</li>'},
  '在宅患者緊急時等共同服薬指導料':{t:'在宅患者緊急時等共同服薬指導料（700点）',d:'多職種カンファレンスへの参加と服薬指導への評価。',n:'急変時に医師・看護師等と共同でカンファレンスに参加し、服薬指導を行う行為を評価。'},
  '麻薬管理加算（在宅）':{t:'麻薬管理加算（在宅）（100点）',d:'在宅患者の麻薬管理への加算。',n:'在宅で麻薬を使用する患者の疼痛管理・副作用モニタリング・残薬回収等を評価。'},
  '乳幼児加算（在宅）':{t:'乳幼児加算（在宅）（100点）',d:'6歳未満の在宅患者への訪問加算。',n:'乳幼児特有の服薬管理の困難さに対応した在宅訪問を評価。'},
  '在宅患者医療用麻薬持続注射療法加算':{t:'在宅患者医療用麻薬持続注射療法加算（250点）',d:'在宅での麻薬持続注射管理への加算。',n:'在宅でPCAポンプ等による麻薬持続注射を受ける患者の薬学管理を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kinki/r6-t89.pdf" target="_blank"><b>様式89</b></a></li><li><b>施設基準</b><ul><li>医療用麻薬持続注射療法を行っている在宅患者への薬学管理体制</li><li>麻薬の適切な保管・管理体制（帳簿管理・施錠保管）</li></ul></li><li>オンラインでの算定は不可</li>'},
  '在宅中心静脈栄養法加算':{t:'在宅中心静脈栄養法加算（150点）',d:'在宅での中心静脈栄養管理への加算。',n:'在宅でTPNを受ける患者の輸液管理・無菌調製等の薬学管理を評価。',type:'todoke',
    x:'<li class="todo-doc">届出先：地方厚生局｜届出様式：<a href="https://kouseikyoku.mhlw.go.jp/kinki/r6-t89.pdf" target="_blank"><b>様式89</b></a></li><li><b>施設基準</b><ul><li>在宅中心静脈栄養法を行っている患者への薬学管理体制</li><li>輸液セット・注射器等の必要な器材の供給体制</li></ul></li><li>オンラインでの算定は不可</li>'},
  '夜間訪問加算':{t:'夜間訪問加算（400点）',d:'夜間の在宅訪問への加算。',n:'夜間に在宅患者を訪問した場合の追加評価。'},
  '休日訪問加算':{t:'休日訪問加算（600点）',d:'休日の在宅訪問への加算。',n:'休日に在宅患者を訪問した場合の追加評価。'},
  '深夜訪問加算':{t:'深夜訪問加算（1000点）',d:'深夜の在宅訪問への加算。',n:'深夜に在宅患者を訪問した場合の追加評価。'},
  '在宅患者重複投薬・相互作用等防止管理料':{t:'在宅患者重複投薬・相互作用等防止管理料',d:'在宅患者の処方変更提案による副作用等防止への評価。',n:'在宅訪問時に重複投薬・相互作用等を発見し、処方変更提案を行う行為を評価。',
    x:'<li><b>残薬以外（40点）</b></li><li><b>残薬調整（20点）</b></li>'},
  '退院時共同指導料':{t:'退院時共同指導料（600点）',d:'退院時の多職種カンファレンスへの参加への評価。',n:'入院中の患者の退院に際し、病院スタッフと共同で退院後の服薬指導計画を策定する行為を評価。'},
  '在宅移行初期管理料':{t:'在宅移行初期管理料（230点）',d:'在宅移行時の初期管理への評価。',n:'退院直後等に在宅療養へ移行する患者の薬学管理体制を初期段階で整備する行為を評価。'},
  // ===== 介護 =====
  '薬剤師居宅療養管理指導費':{t:'薬剤師居宅療養管理指導費',d:'介護保険による在宅訪問薬剤管理の報酬。',n:'要介護・要支援の在宅患者に対し、薬剤師が訪問して服薬管理・指導を行う介護報酬。',
    x:'<li><b>単一建物1人（518単位）</b></li><li><b>2〜9人（379単位）</b></li><li><b>10人以上（342単位）</b></li><li><b>情報通信機器（46単位）</b></li><li>月4回まで（末期悪性腫瘍等は週2＆月8回）</li>'},
};

function showBadgeInfo(key) {
  showItemInfo(key);
}

function showItemInfo(key) {
  const info = ITEM_INFO[key];
  if (!info) return;
  const m = document.getElementById('badge-modal');
  m.querySelector('.modal-title').textContent = info.t;
  const bt = m.querySelector('.badge-type');
  if (info.type === 'todoke') {
    bt.textContent = '施設基準の届出が必要';
    bt.className = 'badge-type todoke'; bt.style.display = '';
  } else if (info.type === 'youken') {
    bt.textContent = '特定の算定要件あり';
    bt.className = 'badge-type youken'; bt.style.display = '';
  } else {
    bt.style.display = 'none';
  }
  let html = `<p>${info.d}</p><p><b>狙い：</b>${info.n}</p>`;
  if (info.x) html += `<ul>${info.x}</ul>`;
  m.querySelector('.modal-body').innerHTML = html;
  m.classList.add('active');
}

// ラベルにclickableクラスを付与
document.querySelectorAll('td.label').forEach(td => {
  const text = td.textContent.replace(/届出|要件/g,'').replace(/[（\(][\d.]+点[）\)]/g,'').replace(/[\s　◆]/g,'').trim();
  for (const key of Object.keys(ITEM_INFO)) {
    if (text.includes(key) || key.includes(text)) { td.classList.add('clickable'); break; }
  }
});

// ラベルクリックでモーダル表示（イベント委任）
document.addEventListener('click', e => {
  const td = e.target.closest('td.label');
  if (!td) return;
  const text = td.textContent.replace(/[（\(][\d.]+点[）\)]/g,'').replace(/[\s　◆]/g,'').replace(/[0-9〜日以上月回]+$/,'').trim();
  // テキストからキーをマッチ
  for (const key of Object.keys(ITEM_INFO)) {
    if (text.includes(key) || key.includes(text)) {
      showItemInfo(key);
      return;
    }
  }
});

// ======== 棚卸 ========
function startTanaoroshi() {
  const meds = JSON.parse(localStorage.getItem('migiude_meds') || '[]');
  if (!meds.length) { alert('在庫データがありません。先に在庫を登録してください。'); return; }
  const tbody = document.getElementById('tanaoroshi-tbody');
  if (!tbody) return;
  tbody.innerHTML = meds.map((m, i) => {
    return `<tr>
      <td>${m.name}</td>
      <td>${m.shelf||'-'}</td>
      <td style="text-align:right" class="tana-book">${m.qty}</td>
      <td><input type="number" class="tana-actual" data-idx="${i}" data-book="${m.qty}" value="" min="0" style="width:70px;text-align:right;padding:3px 6px;font-size:13px;border:1px solid var(--border);border-radius:4px" oninput="calcTanaDiff(this)"></td>
      <td style="text-align:right" class="tana-diff">-</td>
      <td><input type="text" class="tana-note" style="width:100%;padding:3px 6px;font-size:12px;border:1px solid var(--border);border-radius:4px" placeholder=""></td>
    </tr>`;
  }).join('');
  document.getElementById('tanaoroshi-status').textContent = `${meds.length}品目を読込済み。実数を入力してください。`;
  if (!document.getElementById('tanaoroshi-date').value) {
    document.getElementById('tanaoroshi-date').value = new Date().toISOString().slice(0, 10);
  }
}

function calcTanaDiff(el) {
  const book = parseInt(el.dataset.book) || 0;
  const actual = parseInt(el.value) || 0;
  const diff = actual - book;
  const diffCell = el.closest('tr').querySelector('.tana-diff');
  diffCell.textContent = diff;
  diffCell.style.color = diff < 0 ? '#c0392b' : diff > 0 ? '#2196F3' : 'inherit';
  // 合計更新
  let totalBook = 0, totalActual = 0, totalDiff = 0;
  document.querySelectorAll('.tana-actual').forEach(inp => {
    const b = parseInt(inp.dataset.book) || 0;
    const a = parseInt(inp.value) || 0;
    totalBook += b;
    if (inp.value !== '') { totalActual += a; totalDiff += (a - b); }
  });
  const s = id => document.getElementById(id);
  if (s('tana-book-total')) s('tana-book-total').textContent = totalBook;
  if (s('tana-actual-total')) s('tana-actual-total').textContent = totalActual;
  if (s('tana-diff-total')) { s('tana-diff-total').textContent = totalDiff; s('tana-diff-total').style.color = totalDiff < 0 ? '#c0392b' : totalDiff > 0 ? '#2196F3' : 'inherit'; }
}

function saveTanaoroshi() {
  const date = document.getElementById('tanaoroshi-date')?.value;
  if (!date) { alert('棚卸日を入力してください'); return; }
  const rows = document.querySelectorAll('.tana-actual');
  if (!rows.length) { alert('棚卸を開始してください'); return; }
  let totalBook = 0, totalActual = 0, count = 0;
  rows.forEach(inp => {
    const b = parseInt(inp.dataset.book) || 0;
    const a = parseInt(inp.value) || 0;
    totalBook += b;
    totalActual += a;
    count++;
  });
  const history = JSON.parse(localStorage.getItem('migiude_tanaoroshi') || '[]');
  history.unshift({ date, count, book: totalBook, actual: totalActual, diff: totalActual - totalBook });
  localStorage.setItem('migiude_tanaoroshi', JSON.stringify(history));
  renderTanaoroshiHistory();
  alert(date + ' の棚卸結果を保存しました');
}

function renderTanaoroshiHistory() {
  const tbody = document.getElementById('tanaoroshi-history');
  if (!tbody) return;
  const history = JSON.parse(localStorage.getItem('migiude_tanaoroshi') || '[]');
  tbody.innerHTML = history.slice(0, 12).map(h => {
    const diffColor = h.diff < 0 ? 'color:#c0392b' : h.diff > 0 ? 'color:#2196F3' : '';
    return `<tr><td>${h.date}</td><td style="text-align:right">${h.count}</td><td style="text-align:right">${h.book.toLocaleString()}</td><td style="text-align:right">${h.actual.toLocaleString()}</td><td style="text-align:right;${diffColor}">${h.diff >= 0 ? '+' : ''}${h.diff}</td></tr>`;
  }).join('');
}

// ======== 廃棄医薬品管理 ========
function getHaikiList() { return JSON.parse(localStorage.getItem('migiude_haiki') || '[]'); }
function saveHaikiList(list) { localStorage.setItem('migiude_haiki', JSON.stringify(list)); }

function addHaiki() {
  const name = document.getElementById('haiki-name')?.value.trim();
  if (!name) { alert('薬品名を入力してください'); return; }
  const qty = parseInt(document.getElementById('haiki-qty')?.value) || 1;
  const price = parseInt(document.getElementById('haiki-price')?.value) || 0;
  const date = document.getElementById('haiki-date')?.value || new Date().toISOString().slice(0,10);
  const reason = document.getElementById('haiki-reason')?.value || '期限切れ';
  const list = getHaikiList();
  list.push({ name, qty, price, loss: qty * price, date, reason, id: Date.now() });
  saveHaikiList(list);
  document.getElementById('haiki-name').value = '';
  renderHaiki();
}

function deleteHaiki(id) {
  const list = getHaikiList().filter(h => h.id !== id);
  saveHaikiList(list);
  renderHaiki();
}

function renderHaiki() {
  const tbody = document.getElementById('haiki-tbody');
  if (!tbody) return;
  const list = getHaikiList().sort((a,b) => b.date.localeCompare(a.date));
  let totalQty = 0, totalAmt = 0;
  tbody.innerHTML = list.map(h => {
    totalQty += h.qty; totalAmt += h.loss;
    return `<tr><td>${h.name}</td><td style="text-align:right">${h.qty}</td><td style="text-align:right">${h.loss.toLocaleString()}円</td><td style="text-align:center">${h.date}</td><td>${h.reason}</td><td style="text-align:center"><span style="color:#c0392b;cursor:pointer" onclick="deleteHaiki(${h.id})">×</span></td></tr>`;
  }).join('');
  const qtyEl = document.getElementById('haiki-total-qty');
  const amtEl = document.getElementById('haiki-total-amt');
  if (qtyEl) qtyEl.textContent = totalQty;
  if (amtEl) amtEl.textContent = totalAmt.toLocaleString() + '円';
}

// ======== 支出管理（PL取込） ========
function parseNum(s) { return parseInt((s||'0').toString().replace(/[,¥\\]/g,'')) || 0; }
function fmtNum(n) { return n.toLocaleString(); }

// CSV PLの科目名→PLフィールドのマッピング
const PL_MAP = {
  '売上高': 'uriage', '売上': 'uriage', '調剤報酬': 'chozai', '保険外収入': 'hokengai', '自費収入': 'hokengai',
  '売上原価': 'genka', '仕入高': 'shiire', '医薬品仕入': 'shiire', '医薬品仕入高': 'shiire', '商品仕入高': 'shiire',
  '給与手当': 'kyuyo', '給料手当': 'kyuyo', '給与': 'kyuyo', '役員報酬': 'kyuyo', '人件費': 'kyuyo',
  '法定福利費': 'fukuri', '福利厚生費': 'fukuri', '社会保険料': 'fukuri',
  '地代家賃': 'yachin', '家賃': 'yachin', '賃借料': 'yachin',
  'リース料': 'lease', 'リース': 'lease',
  '水道光熱費': 'kounetsu', '光熱費': 'kounetsu',
  '通信費': 'tsushin', '電話代': 'tsushin',
  '消耗品費': 'shomohin', '事務用品費': 'shomohin',
  '旅費交通費': 'kotsu', '交通費': 'kotsu', '車両費': 'kotsu',
  '研修費': 'kenshu', '教育研修費': 'kenshu', '研修教育費': 'kenshu',
  '減価償却費': 'genka_sh', '償却費': 'genka_sh',
  '保険料': 'hoken', '損害保険料': 'hoken',
};

function importPL() {
  const file = document.getElementById('pl-file')?.files[0];
  if (!file) { alert('ファイルを選択してください'); return; }
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => parsePLcsv(e.target.result, file.name);
    reader.readAsText(file, 'utf-8');
  } else {
    document.getElementById('pl-status').textContent = 'CSV形式で取り込んでください（Excel/PDFは今後対応予定）';
  }
}

function parsePLcsv(text, filename) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const data = { _source: filename, _date: new Date().toISOString().slice(0,10) };
  let period = '';

  for (const line of lines) {
    // 期間検出
    const pm = line.match(/(\d{4})[年\/\-](\d{1,2})/);
    if (pm && !period) period = pm[1] + '-' + pm[2].padStart(2, '0');

    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;
    const name = cols[0].replace(/\s/g, '');
    const val = parseNum(cols[cols.length - 1]) || parseNum(cols[1]);
    if (!val && val !== 0) continue;

    // マッピング
    for (const [key, field] of Object.entries(PL_MAP)) {
      if (name.includes(key)) {
        if (!data[field]) data[field] = 0;
        data[field] += Math.abs(val);
        break;
      }
    }
  }

  if (!period) period = new Date().toISOString().slice(0, 7);
  data._period = period;

  // 計算
  if (!data.uriage) data.uriage = (data.chozai || 0) + (data.hokengai || 0);
  if (!data.genka) data.genka = data.shiire || 0;
  data.arari = (data.uriage || 0) - (data.genka || 0);
  const hankanFields = ['kyuyo','fukuri','yachin','lease','kounetsu','tsushin','shomohin','kotsu','kenshu','genka_sh','hoken','other'];
  data.hankan = hankanFields.reduce((s, f) => s + (data[f] || 0), 0);
  data.rieki = data.arari - data.hankan;

  // 保存
  const allPL = JSON.parse(localStorage.getItem('migiude_pl') || '{}');
  allPL[period] = data;
  localStorage.setItem('migiude_pl', JSON.stringify(allPL));

  updatePLperiods();
  document.getElementById('pl-period').value = period;
  renderPL();
  document.getElementById('pl-status').textContent = `${filename} → ${period} 取込完了（${Object.keys(data).length}科目）`;
}

function updatePLperiods() {
  const sel = document.getElementById('pl-period');
  if (!sel) return;
  const allPL = JSON.parse(localStorage.getItem('migiude_pl') || '{}');
  const periods = Object.keys(allPL).sort().reverse();
  sel.innerHTML = periods.length ? periods.map(p => `<option value="${p}">${p}</option>`).join('') : '<option value="">データなし</option>';
}

function renderPL() {
  const period = document.getElementById('pl-period')?.value;
  if (!period) return;
  const allPL = JSON.parse(localStorage.getItem('migiude_pl') || '{}');
  const d = allPL[period] || {};
  const u = d.uriage || 0;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val != null && val !== 0 ? fmtNum(val) : '-'; };
  const rate = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = u ? (val / u * 100).toFixed(1) + '%' : '-'; };

  set('pl_uriage', d.uriage); set('pl_chozai', d.chozai); rate('pl_chozai_r', d.chozai||0);
  set('pl_hokengai', d.hokengai); rate('pl_hokengai_r', d.hokengai||0);
  set('pl_genka', d.genka); rate('pl_genka_r', d.genka||0);
  set('pl_shiire', d.shiire); rate('pl_shiire_r', d.shiire||0);
  set('pl_arari', d.arari); rate('pl_arari_r', d.arari||0);
  set('pl_hankan', d.hankan); rate('pl_hankan_r', d.hankan||0);
  set('pl_kyuyo', d.kyuyo); rate('pl_kyuyo_r', d.kyuyo||0);
  set('pl_fukuri', d.fukuri); rate('pl_fukuri_r', d.fukuri||0);
  set('pl_yachin', d.yachin); rate('pl_yachin_r', d.yachin||0);
  set('pl_lease', d.lease); rate('pl_lease_r', d.lease||0);
  set('pl_kounetsu', d.kounetsu); rate('pl_kounetsu_r', d.kounetsu||0);
  set('pl_tsushin', d.tsushin); rate('pl_tsushin_r', d.tsushin||0);
  set('pl_shomohin', d.shomohin); rate('pl_shomohin_r', d.shomohin||0);
  set('pl_kotsu', d.kotsu); rate('pl_kotsu_r', d.kotsu||0);
  set('pl_kenshu', d.kenshu); rate('pl_kenshu_r', d.kenshu||0);
  set('pl_genka_sh', d.genka_sh); rate('pl_genka_sh_r', d.genka_sh||0);
  set('pl_hoken', d.hoken); rate('pl_hoken_r', d.hoken||0);
  set('pl_other', d.other); rate('pl_other_r', d.other||0);

  const rEl = document.getElementById('pl_rieki');
  if(rEl) { rEl.textContent = fmtNum(d.rieki||0); rEl.style.color = (d.rieki||0) >= 0 ? '#27ae60' : '#c0392b'; }
  const rrEl = document.getElementById('pl_rieki_r');
  if(rrEl) rrEl.textContent = u ? ((d.rieki||0) / u * 100).toFixed(1) + '%' : '-';
}

function saveShishutsuManual() {
  const ym = document.getElementById('shishutsu-month')?.value;
  if (!ym) { alert('対象月を選択してください'); return; }
  const SH_MANUAL = ['sh_shiire','sh_kyuyo','sh_fukuri','sh_yachin','sh_lease','sh_kounetsu','sh_tsushin','sh_shomohin','sh_kotsu','sh_kenshu','sh_other'];
  const data = { _source: '手入力', _period: ym, _date: new Date().toISOString().slice(0,10) };
  const map = {sh_shiire:'shiire',sh_kyuyo:'kyuyo',sh_fukuri:'fukuri',sh_yachin:'yachin',sh_lease:'lease',sh_kounetsu:'kounetsu',sh_tsushin:'tsushin',sh_shomohin:'shomohin',sh_kotsu:'kotsu',sh_kenshu:'kenshu',sh_other:'other'};
  SH_MANUAL.forEach(id => { const el = document.getElementById(id); if(el) data[map[id]] = parseNum(el.value); });
  data.genka = data.shiire || 0;
  const hankanFields = ['kyuyo','fukuri','yachin','lease','kounetsu','tsushin','shomohin','kotsu','kenshu','other'];
  data.hankan = hankanFields.reduce((s, f) => s + (data[f] || 0), 0);
  // 月次報酬から売上取得
  const md = DB[ym] || {};
  data.chozai = parseNum(md.total_reward) || 0;
  data.hokengai = (parseNum(md.jhi_chozai_amt)||0) + (parseNum(md.hokengai_amt)||0) + (parseNum(md.otc_amt)||0);
  data.uriage = data.chozai + data.hokengai;
  data.arari = data.uriage - data.genka;
  data.rieki = data.arari - data.hankan;

  const allPL = JSON.parse(localStorage.getItem('migiude_pl') || '{}');
  allPL[ym] = data;
  localStorage.setItem('migiude_pl', JSON.stringify(allPL));
  updatePLperiods();
  document.getElementById('pl-period').value = ym;
  renderPL();
  alert(ym + ' の支出を保存しました');
}

// ======== 業務手順書（MD読込・表示） ========
let tejunshoMD = '';
let tejunshoHTML = '';

function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    const trimmed = line.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
    if (!trimmed) { if(inList){html+='</ul>';inList=false;} html += '<br>'; continue; }
    if (trimmed.startsWith('# ')) { if(inList){html+='</ul>';inList=false;} html += `<h1 style="font-size:20px;margin:16px 0 8px">${trimmed.slice(2)}</h1>`; continue; }
    if (trimmed.startsWith('## ')) { if(inList){html+='</ul>';inList=false;} const t=trimmed.slice(3).trim(); html += `<h2 class="tej-h2" id="${t}">${t}</h2>`; continue; }
    if (trimmed.startsWith('### ')) { if(inList){html+='</ul>';inList=false;} html += `<h3 class="tej-h3">${trimmed.slice(4)}</h3>`; continue; }
    if (trimmed.startsWith('#### ')) { if(inList){html+='</ul>';inList=false;} html += `<h4 class="tej-h4">${trimmed.slice(5)}</h4>`; continue; }
    if (trimmed === '---' || trimmed.match(/^-{3,}$/)) { if(inList){html+='</ul>';inList=false;} html += '<hr>'; continue; }
    if (trimmed.startsWith('- ')) { if(!inList){html+='<ul>';inList=true;} html += `<li>${trimmed.slice(2)}</li>`; continue; }
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) { if(inList){html+='</ul>';inList=false;} html += `<p><b>${trimmed.slice(2,-2)}</b></p>`; continue; }
    // 丸数字の行
    if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(trimmed)) { if(inList){html+='</ul>';inList=false;} html += `<p style="padding-left:16px">${trimmed}</p>`; continue; }
    if(inList){html+='</ul>';inList=false;}
    html += `<p>${trimmed}</p>`;
  }
  if(inList) html += '</ul>';
  return html;
}

function loadTejunsho() {
  fetch('マニュアル/業務手順書.md')
    .then(r => { if(!r.ok) throw new Error('ファイルが見つかりません'); return r.text(); })
    .then(md => {
      tejunshoMD = md;
      tejunshoHTML = mdToHtml(md);
      // 目次生成
      const toc = [];
      const h2re = /^## (.+)$/gm;
      let m;
      while ((m = h2re.exec(md)) !== null) {
        const title = m[1].replace(/[​\u200B]/g, '').trim();
        if (title && !title.startsWith('---') && title !== '目　次') {
          toc.push(title);
        }
      }
      const tocEl = document.getElementById('tejunsho-toc');
      if (tocEl) {
        tocEl.innerHTML = '<b>目次</b><br>' + toc.map(t =>
          `<a href="#" onclick="jumpTejunsho('${t.replace(/'/g,"\\'")}');return false" style="color:var(--accent);text-decoration:none;display:inline-block;margin:2px 8px">▸ ${t}</a>`
        ).join('<br>');
      }
      // 本文表示
      const bodyEl = document.getElementById('tejunsho-body');
      if (bodyEl) bodyEl.innerHTML = tejunshoHTML;
    })
    .catch(e => {
      const bodyEl = document.getElementById('tejunsho-body');
      if (bodyEl) bodyEl.innerHTML = '<p style="color:#c0392b">業務手順書の読み込みに失敗しました。<br>マニュアル/業務手順書.md が必要です。<br>エラー: ' + e.message + '</p>';
    });
}

function jumpTejunsho(title) {
  const bodyEl = document.getElementById('tejunsho-body');
  if (!bodyEl) return;
  const target = bodyEl.querySelector(`h2[id="${title}"]`);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function searchTejunsho() {
  const q = document.getElementById('tejunsho-search')?.value?.trim().toLowerCase();
  const bodyEl = document.getElementById('tejunsho-body');
  if (!bodyEl) return;
  if (!q) { bodyEl.innerHTML = tejunshoHTML; return; }
  // 検索ワードをハイライト
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  bodyEl.innerHTML = tejunshoHTML.replace(re, '<mark style="background:#fff176">$1</mark>');
}

// ページ切替時にMD読込
const origShowSubTab = window.showSubTab;
if (origShowSubTab) {
  window.showSubTab = function(id, el) {
    origShowSubTab(id, el);
    if (id === 'man-tejunsho' && !tejunshoMD) loadTejunsho();
  };
}

// ======== メモ・未処理項目 ========
let memos = JSON.parse(localStorage.getItem('migiude_memos') || '[]');
let memoFilter = 'all';

const MEMO_CAT_LABEL = {question:'質問',todo:'未処理',confirm:'確認事項',idea:'アイデア',bug:'不具合'};
const MEMO_CAT_COLOR = {question:'#2196F3',todo:'#FF5722',confirm:'#FF9800',idea:'#4CAF50',bug:'#c0392b'};
const MEMO_PRI_LABEL = {high:'高',mid:'中',low:'低'};
const MEMO_PRI_COLOR = {high:'#c0392b',mid:'#FF9800',low:'#999'};

function addMemo() {
  const text = document.getElementById('memo-text')?.value.trim();
  if (!text) return;
  const memo = {
    id: Date.now(),
    cat: document.getElementById('memo-cat').value,
    priority: document.getElementById('memo-priority').value,
    tag: document.getElementById('memo-tag')?.value.trim() || '',
    text: text,
    status: 'open',
    created: new Date().toISOString().slice(0,10),
    resolved: null,
    note: ''
  };
  memos.unshift(memo);
  saveMemos();
  document.getElementById('memo-text').value = '';
  document.getElementById('memo-tag').value = '';
  renderMemos();
}

function saveMemos() {
  localStorage.setItem('migiude_memos', JSON.stringify(memos));
}

function toggleMemoStatus(id) {
  const m = memos.find(x => x.id === id);
  if (!m) return;
  if (m.status === 'open') {
    m.status = 'done';
    m.resolved = new Date().toISOString().slice(0,10);
  } else {
    m.status = 'open';
    m.resolved = null;
  }
  saveMemos();
  renderMemos();
}

function deleteMemo(id) {
  if (!confirm('このメモを削除しますか？')) return;
  memos = memos.filter(x => x.id !== id);
  saveMemos();
  renderMemos();
}

function clearAllMemos() {
  if (!confirm('全てのメモを削除しますか？')) return;
  memos = [];
  saveMemos();
  renderMemos();
}

function filterMemo(cat, btn) {
  memoFilter = cat;
  document.querySelectorAll('.memo-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMemos();
}

function renderMemos() {
  const list = document.getElementById('memo-list');
  if (!list) return;
  const filtered = memoFilter === 'all' ? memos : memos.filter(m => m.cat === memoFilter);
  const open = filtered.filter(m => m.status === 'open');
  const done = filtered.filter(m => m.status === 'done');

  const countEl = document.getElementById('memo-count');
  if (countEl) countEl.textContent = `未処理 ${open.length}件 / 完了 ${done.length}件`;

  let html = '';

  // 未処理（優先度順）
  const priOrder = {high:0, mid:1, low:2};
  open.sort((a,b) => priOrder[a.priority] - priOrder[b.priority]);

  open.forEach(m => { html += memoCard(m); });

  // 完了（折りたたみ）
  if (done.length) {
    html += `<details style="margin-top:16px"><summary style="cursor:pointer;font-size:13px;color:var(--text2)">完了済み（${done.length}件）</summary>`;
    done.forEach(m => { html += memoCard(m); });
    html += '</details>';
  }

  if (!filtered.length) html = '<p style="color:var(--text2);font-size:13px;padding:20px">メモはありません</p>';
  list.innerHTML = html;
}

function memoCard(m) {
  const catColor = MEMO_CAT_COLOR[m.cat] || '#999';
  const catLabel = MEMO_CAT_LABEL[m.cat] || m.cat;
  const priColor = MEMO_PRI_COLOR[m.priority] || '#999';
  const priLabel = MEMO_PRI_LABEL[m.priority] || m.priority;
  const isDone = m.status === 'done';
  const checkIcon = isDone ? '&#9745;' : '&#9744;';
  const textStyle = isDone ? 'text-decoration:line-through;color:var(--text2)' : '';

  return `<div class="card" style="padding:12px;margin-bottom:8px;border-left:4px solid ${catColor};${isDone?'opacity:0.6':''}">
    <div style="display:flex;align-items:flex-start;gap:8px">
      <span onclick="toggleMemoStatus(${m.id})" style="cursor:pointer;font-size:20px;line-height:1">${checkIcon}</span>
      <div style="flex:1">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${catColor};color:#fff">${catLabel}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid ${priColor};color:${priColor}">${priLabel}</span>
          ${m.tag ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#f0f0f0;color:#666">${m.tag}</span>` : ''}
          <span style="font-size:11px;color:var(--text2);margin-left:auto">${m.created}${m.resolved ? ' → '+m.resolved : ''}</span>
        </div>
        <div style="font-size:13px;${textStyle};white-space:pre-wrap">${m.text}</div>
      </div>
      <button onclick="deleteMemo(${m.id})" style="padding:2px 8px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">削除</button>
    </div>
  </div>`;
}

init();
renderMemos();