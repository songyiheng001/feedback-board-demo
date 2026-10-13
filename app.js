// ===== 演示数据：仅在本机仓库为空时初始化一次，之后以 localStorage 为准 =====
var DEMO_FEEDBACKS = [
  {
    id: 'F-001',
    category: '建议',
    status: '待处理',
    summary: '希望记住上次的导出格式，减少重复操作',
    source: '用户访谈',
    time: '2026-09-01 10:20',
    full: '每次导出报告都要重新选择格式，希望能记住上次的设置，减少重复操作。'
  },
  {
    id: 'F-002',
    category: '问题',
    status: '处理中',
    summary: '导出的 Excel 用 WPS 打开时提示文件格式损坏',
    source: '客服工单',
    time: '2026-09-03 14:05',
    full: '导出报告选择 Excel 格式后，下载的文件用 WPS 打开会提示“文件格式损坏，是否尝试恢复”，恢复后内容可以显示，但部分列错位。用 Office 打开则正常。'
  },
  {
    id: 'F-003',
    category: '表扬',
    status: '已解决',
    summary: '新版反馈提交流程比以前顺畅很多',
    source: '应用内评价',
    time: '2026-09-05 09:40',
    full: '新版反馈提交只需要三步就能完成，还能随时看到处理进度，比以前发邮件等回复顺畅很多，特意来表扬一下负责的同学。'
  },
  {
    id: 'F-004',
    category: '问题',
    status: '待处理',
    summary: '手机上查看长反馈时，底部按钮会被挡住',
    source: '用户访谈',
    time: '2026-09-08 16:50',
    full: '在手机上打开比较长的反馈详情时，滚动到底部后“提交”按钮经常被手机自带的返回栏挡住，要点很多次才能成功，希望能留出安全距离。'
  },
  {
    id: 'F-005',
    category: '建议',
    status: '处理中',
    summary: '希望反馈列表可以按提交时间排序',
    source: '邮件反馈',
    time: '2026-09-10 11:15',
    full: '现在反馈多了以后很难第一时间看到最新提交的内容，希望列表能按提交时间排序，最好支持最新和最早两种顺序切换。'
  },
  {
    id: 'F-006',
    category: '其他',
    status: '待处理',
    summary: '希望每周收到一份反馈处理进度小结',
    source: '内部群',
    time: '2026-09-12 17:30',
    full: '团队周会上经常要人工统计本周收到多少反馈、解决了多少，希望系统每周自动汇总一份处理进度小结，直接发到群里。'
  }
];

var STATUS_CLASS = {
  '待处理': 'pending',
  '处理中': 'doing',
  '已解决': 'done'
};

// ===== 06.2 运行模式分叉：本机回环地址为本地模式，其他地址一律按线上展示模式 =====
// 本地模式：完整功能（AI 建议、AI 摘要、本机保存）；线上模式：纯静态演示，不保存、不联网调模型
var LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
var isLocalMode = LOCAL_HOSTS.indexOf(location.hostname) !== -1;

// ===== 本机持久化（localStorage）：只存反馈数据，不存筛选、视图、AI 建议或摘要 =====
var STORAGE_KEY = 'feedback-board-feedbacks-v1';
var storageBroken = false; // 读取到损坏数据时置位：用演示数据继续，但不覆盖本地仓库

var storageError = document.getElementById('storageError');

function showStorageError(message) {
  if (!storageError) {
    return;
  }
  storageError.textContent = message;
  storageError.hidden = false;
}

// 启动时读取：有有效数组就用；从未存过才播种演示数据并保存；损坏则不覆盖
function loadFeedbacks() {
  // 线上展示模式：完全不读 localStorage，每次打开/刷新都恢复六条虚构样例
  if (!isLocalMode) {
    return DEMO_FEEDBACKS.slice();
  }
  var raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    storageBroken = true;
    showStorageError('无法读取本机存储，当前使用演示数据；本次改动可能无法保存。');
    return DEMO_FEEDBACKS.slice();
  }

  if (raw === null) {
    var seeded = DEMO_FEEDBACKS.slice();
    persist(seeded);
    return seeded;
  }

  try {
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('存储内容不是反馈数组');
    }
    return parsed;
  } catch (err) {
    storageBroken = true;
    showStorageError('本机保存的反馈数据无法读取（可能已损坏）。为避免覆盖，本次使用演示数据且不写入，请处理后再保存。');
    return DEMO_FEEDBACKS.slice();
  }
}

// 写入完整数组；新增、编辑、详情改状态、AI 采纳都走这同一个函数
function persist(data) {
  // 线上展示模式：改动只存在当前页面内存里，绝不写入 localStorage
  if (!isLocalMode) {
    return true;
  }
  if (storageBroken) {
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data || feedbacks));
    return true;
  } catch (err) {
    showStorageError('保存失败：可能是浏览器存储空间不足或禁用了本机存储，本次改动刷新后会丢失。');
    return false;
  }
}

var feedbacks = loadFeedbacks();

// ===== 视图状态：筛选条件不持久化，刷新后恢复默认 =====
var currentCategory = '全部';
var currentSource = '全部';
var currentStatusFilter = '全部';
var currentKeyword = '';
var currentId = null;

var listView = document.getElementById('listView');
var detailView = document.getElementById('detailView');
var formView = document.getElementById('formView');
var addFeedbackBtn = document.getElementById('addFeedbackBtn');
var exportBtn = document.getElementById('exportBtn');
var feedbackForm = document.getElementById('feedbackForm');
var contentInput = document.getElementById('contentInput');
var sourceInput = document.getElementById('sourceInput');
var categoryInput = document.getElementById('categoryInput');
var contentError = document.getElementById('contentError');
var sourceError = document.getElementById('sourceError');
var cancelBtn = document.getElementById('cancelBtn');
var editBtn = document.getElementById('editBtn');
var editView = document.getElementById('editView');
var editForm = document.getElementById('editForm');
var editId = document.getElementById('editId');
var editContent = document.getElementById('editContent');
var editSource = document.getElementById('editSource');
var editCreatedAt = document.getElementById('editCreatedAt');
var editCategory = document.getElementById('editCategory');
var editStatus = document.getElementById('editStatus');
var editCancelBtn = document.getElementById('editCancelBtn');
var listEl = document.getElementById('feedbackList');
var noMatchState = document.getElementById('noMatchState');
var noDataState = document.getElementById('noDataState');
var clearFilterBtn = document.getElementById('clearFilterBtn');
var filtersEl = document.getElementById('categoryFilters');
var sourceFiltersEl = document.getElementById('sourceFilters');
var statusFiltersEl = document.getElementById('statusFilters');
var activeFiltersEl = document.getElementById('activeFilters');
var activeCountEl = document.getElementById('activeCount');
var activeChipsEl = document.getElementById('activeChips');
var noMatchTextEl = document.getElementById('noMatchText');
var keywordInput = document.getElementById('keywordInput');
var detailMeta = document.getElementById('detailMeta');
var detailContent = document.getElementById('detailContent');
var statusOptions = document.getElementById('statusOptions');
var backBtn = document.getElementById('backBtn');

function findFeedback(id) {
  for (var i = 0; i < feedbacks.length; i++) {
    if (feedbacks[i].id === id) {
      return feedbacks[i];
    }
  }
  return null;
}

// 四条件（分类、来源、状态、关键字）共同筛选后的当前列表，列表渲染、摘要、导出共用
function getVisibleFeedbacks() {
  var list = [];
  feedbacks.forEach(function (item) {
    if (currentCategory !== '全部' && item.category !== currentCategory) {
      return;
    }
    if (currentSource !== '全部' && item.source !== currentSource) {
      return;
    }
    if (currentStatusFilter !== '全部' && item.status !== currentStatusFilter) {
      return;
    }
    // 关键字只匹配用户原话全文，不碰来源、分类、状态、编号、时间；英文不区分大小写
    if (currentKeyword && item.full.toLowerCase().indexOf(currentKeyword.toLowerCase()) === -1) {
      return;
    }
    list.push(item);
  });
  return list;
}

// ===== 列表视图 =====
function renderList() {
  listEl.innerHTML = '';
  updateActiveConditions();

  var visible = getVisibleFeedbacks();

  // 空状态二：系统里一条数据都没有（正常空状态，无按钮）
  if (feedbacks.length === 0) {
    noDataState.hidden = false;
    noMatchState.hidden = true;
  } else {
    noDataState.hidden = true;
    // 空状态一：有数据，但当前四个条件一条都没匹配上
    if (visible.length === 0) {
      noMatchTextEl.textContent = buildNoMatchText();
      noMatchState.hidden = false;
    } else {
      noMatchState.hidden = true;
    }
  }

  visible.forEach(function (item) {
    var li = document.createElement('li');
    li.className = 'feedback-item';
    li.setAttribute('data-id', item.id);
    // 06.4 键盘可达：卡片可通过 Tab 聚焦，Enter 或空格与鼠标点击走同一个 openDetail
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', '查看反馈 ' + item.id + '：' + item.summary);

    var top = document.createElement('div');
    top.className = 'item-top';

    var status = document.createElement('span');
    status.className = 'status ' + STATUS_CLASS[item.status];
    status.textContent = item.status;

    var category = document.createElement('span');
    category.className = 'category-tag';
    if (item.category) {
      category.textContent = item.category;
    } else {
      // 未选择分类：统一显示“未分类”，且不会进入任何具体分类筛选
      category.textContent = '未分类';
      category.classList.add('is-uncategorized');
    }

    top.appendChild(status);
    top.appendChild(category);

    var summary = document.createElement('p');
    summary.className = 'item-summary';
    summary.textContent = item.summary;

    var meta = document.createElement('div');
    meta.className = 'item-meta';
    var source = document.createElement('span');
    source.textContent = item.source;
    var time = document.createElement('span');
    time.textContent = item.time;
    meta.appendChild(source);
    meta.appendChild(time);

    li.appendChild(top);
    li.appendChild(summary);
    li.appendChild(meta);
    listEl.appendChild(li);
  });

  // 导出按钮条数、AI 摘要按钮条数都跟随当前列表；列表重渲染即清掉上一批摘要
  syncExportButton(visible.length);
  syncSummaryBox(visible.length);
}

// 当前生效的筛选条件（“全部”和空关键字不算生效）
function getActiveConditions() {
  var conditions = [];
  if (currentCategory !== '全部') {
    conditions.push({ group: 'category', label: '分类：' + currentCategory });
  }
  if (currentSource !== '全部') {
    conditions.push({ group: 'source', label: '来源：' + currentSource });
  }
  if (currentStatusFilter !== '全部') {
    conditions.push({ group: 'status', label: '状态：' + currentStatusFilter });
  }
  if (currentKeyword) {
    conditions.push({ group: 'keyword', label: '关键字：' + currentKeyword });
  }
  return conditions;
}

// 生效条件区：显示数量，每个条件带单独撤销入口
function updateActiveConditions() {
  var conditions = getActiveConditions();
  activeChipsEl.innerHTML = '';

  if (conditions.length === 0) {
    activeFiltersEl.hidden = true;
    return;
  }

  activeFiltersEl.hidden = false;
  activeCountEl.textContent = '当前生效条件（' + conditions.length + '）';

  conditions.forEach(function (cond) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'active-chip';
    chip.setAttribute('data-remove-group', cond.group);

    var text = document.createElement('span');
    text.textContent = cond.label;
    var cross = document.createElement('span');
    cross.className = 'active-chip-x';
    cross.textContent = '×';

    chip.appendChild(text);
    chip.appendChild(cross);
    activeChipsEl.appendChild(chip);
  });
}

function buildNoMatchText() {
  var labels = getActiveConditions().map(function (c) { return c.label; });
  return '没有同时满足【' + labels.join('、') + '】的反馈';
}

function setActiveCategory(category) {
  currentCategory = category;
  var buttons = filtersEl.querySelectorAll('.filter-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle(
      'is-active',
      buttons[i].getAttribute('data-category') === category
    );
  }
  renderList();
}

function setActiveStatus(status) {
  currentStatusFilter = status;
  var buttons = statusFiltersEl.querySelectorAll('.filter-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle(
      'is-active',
      buttons[i].getAttribute('data-filter-status') === status
    );
  }
  renderList();
}

function setActiveSource(source) {
  currentSource = source;
  var buttons = sourceFiltersEl.querySelectorAll('.filter-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle(
      'is-active',
      buttons[i].getAttribute('data-source') === source
    );
  }
  renderList();
}

// 关键字：随输入即时筛选；清空输入即恢复未使用关键字的状态
function setKeyword(value) {
  currentKeyword = value.trim();
  renderList();
}

// 单独撤销某一组条件，等于把那一组切回“全部”（关键字则清空输入）
function removeCondition(group) {
  if (group === 'category') {
    setActiveCategory('全部');
  } else if (group === 'source') {
    setActiveSource('全部');
  } else if (group === 'status') {
    setActiveStatus('全部');
  } else if (group === 'keyword') {
    keywordInput.value = '';
    setKeyword('');
  }
}

// ===== CSV 导出：只导出当前列表，6 列固定顺序，UTF-8 BOM，本机下载 =====
function syncExportButton(count) {
  exportBtn.textContent = '导出当前列表（' + count + ' 条）';
  exportBtn.disabled = count === 0;
}

function csvCell(value) {
  var text = value === null || value === undefined ? '' : String(value);
  // 含逗号、双引号或换行的字段用双引号包裹，内部双引号写成两个双引号，保证一条只占一行
  if (/[",\n\r]/.test(text)) {
    text = '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function todayText() {
  var d = new Date();
  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function exportCsv() {
  var visible = getVisibleFeedbacks();
  if (visible.length === 0) {
    return;
  }

  var rows = [['编号', '反馈内容', '反馈来源', '反馈分类', '处理状态', '提交时间']];
  visible.forEach(function (item) {
    rows.push([
      item.id,
      item.full,
      item.source,
      item.category || '未分类',
      item.status,
      item.time
    ]);
  });

  var csv = rows.map(function (row) {
    return row.map(csvCell).join(',');
  }).join('\r\n');

  var blob = new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '用户反馈-' + todayText() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== 详情视图 =====
function openDetail(id) {
  var item = findFeedback(id);
  if (!item) {
    return;
  }
  currentId = id;

  detailMeta.innerHTML = '';
  var idEl = document.createElement('span');
  idEl.className = 'feedback-id';
  idEl.textContent = item.id;

  var categoryEl = document.createElement('span');
  categoryEl.className = 'category-tag';
  if (item.category) {
    categoryEl.textContent = item.category;
  } else {
    categoryEl.textContent = '未分类';
    categoryEl.classList.add('is-uncategorized');
  }

  var sourceEl = document.createElement('span');
  sourceEl.textContent = '来源：' + item.source;

  var timeEl = document.createElement('span');
  timeEl.textContent = '提交时间：' + item.time;

  detailMeta.appendChild(idEl);
  detailMeta.appendChild(categoryEl);
  detailMeta.appendChild(sourceEl);
  detailMeta.appendChild(timeEl);

  detailContent.textContent = item.full;
  renderStatusOptions(item.status);
  resetClassifyArea(); // 每条反馈的 AI 建议独立，切换时不带上一条的结果

  listView.hidden = true;
  formView.hidden = true;
  editView.hidden = true;
  detailView.hidden = false;
  window.scrollTo(0, 0);
}

function renderStatusOptions(currentStatus) {
  var buttons = statusOptions.querySelectorAll('.status-option');
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    var value = btn.getAttribute('data-status');
    btn.className = 'status-option';
    btn.disabled = false;
    if (value === currentStatus) {
      btn.classList.add('is-checked');
      btn.classList.add(STATUS_CLASS[value]);
      // 当前状态：保持选中样式，但不可重复点击
      btn.disabled = true;
    }
  }
}

function backToList() {
  currentId = null;
  detailView.hidden = true;
  listView.hidden = false;
  renderList(); // 返回后列表状态与详情同步；筛选条件保持不变
  window.scrollTo(0, 0);
}

// ===== 新增反馈 =====
function nextFeedbackId() {
  // 取当前所有 F-xxx 编号中的最大数字，往后顺延，保证编号唯一且连续
  var max = 0;
  feedbacks.forEach(function (item) {
    var match = /^F-(\d+)$/.exec(item.id);
    if (match) {
      var num = parseInt(match[1], 10);
      if (num > max) {
        max = num;
      }
    }
  });
  return 'F-' + String(max + 1).padStart(3, '0');
}

function nowText() {
  // 生成当前提交时间，格式与演示数据一致：YYYY-MM-DD HH:mm
  var d = new Date();
  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function makeSummary(text) {
  // 列表摘要：去掉换行，超过 30 字截断（仅用于列表展示，不改用户原话全文）
  var oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > 30 ? oneLine.slice(0, 30) + '…' : oneLine;
}

function openForm() {
  feedbackForm.reset();
  categoryInput.value = ''; // reset 后恢复默认“暂不分类”
  contentError.hidden = true;
  sourceError.hidden = true;
  listView.hidden = true;
  detailView.hidden = true;
  formView.hidden = false;
  window.scrollTo(0, 0);
}

function closeForm() {
  formView.hidden = true;
  listView.hidden = false;
  window.scrollTo(0, 0);
}

function saveFeedback(e) {
  e.preventDefault(); // 不通过刷新页面提交

  var content = contentInput.value.trim();
  var source = sourceInput.value;
  var valid = true;

  if (!content) {
    contentError.hidden = false;
    valid = false;
  } else {
    contentError.hidden = true;
  }
  if (!source) {
    sourceError.hidden = false;
    valid = false;
  } else {
    sourceError.hidden = true;
  }
  if (!valid) {
    return;
  }

  feedbacks.push({
    id: nextFeedbackId(),
    category: categoryInput.value,
    status: '待处理', // 新增时状态固定，不由用户选择
    summary: makeSummary(content),
    source: source,
    time: nowText(),
    full: content
  });
  persist(); // 立即保存到本机

  // 返回完整反馈列表：四组条件都重置为默认
  setActiveCategory('全部');
  setActiveSource('全部');
  setActiveStatus('全部');
  keywordInput.value = '';
  setKeyword('');
  closeForm();
  renderList();
}

// ===== 编辑反馈：只有分类和状态可改 =====
function openEdit() {
  var item = findFeedback(currentId);
  if (!item) {
    return;
  }
  // 只读字段用静态文本展示，不做可输入控件
  editId.textContent = item.id;
  editContent.textContent = item.full;
  editSource.textContent = item.source;
  editCreatedAt.textContent = item.time;
  // 可改字段以下拉框展示，初值取当前数据
  editCategory.value = item.category;
  editStatus.value = item.status;

  listView.hidden = true;
  formView.hidden = true;
  detailView.hidden = true;
  editView.hidden = false;
  window.scrollTo(0, 0);
}

function cancelEdit() {
  // 不写任何数据：下拉框的临时改动直接丢弃，回到编辑前的详情
  openDetail(currentId);
}

function saveEdit(e) {
  e.preventDefault(); // 不刷新页面
  var item = findFeedback(currentId);
  if (!item) {
    return;
  }
  // 只更新这两个字段，其余字段一概不触碰
  item.category = editCategory.value;
  item.status = editStatus.value;
  persist(); // 立即保存到本机
  // 回到该反馈详情页并立即显示新值
  openDetail(currentId);
}

// ===== 事件绑定 =====
addFeedbackBtn.addEventListener('click', openForm);
cancelBtn.addEventListener('click', closeForm);
feedbackForm.addEventListener('submit', saveFeedback);
contentInput.addEventListener('input', function () {
  if (contentInput.value.trim()) {
    contentError.hidden = true;
  }
});
sourceInput.addEventListener('change', function () {
  if (sourceInput.value) {
    sourceError.hidden = true;
  }
});

filtersEl.addEventListener('click', function (e) {
  var target = e.target;
  if (target.className.indexOf('filter-btn') === -1) {
    return;
  }
  setActiveCategory(target.getAttribute('data-category'));
});

statusFiltersEl.addEventListener('click', function (e) {
  var target = e.target;
  if (target.className.indexOf('filter-btn') === -1) {
    return;
  }
  setActiveStatus(target.getAttribute('data-filter-status'));
});

sourceFiltersEl.addEventListener('click', function (e) {
  var target = e.target;
  if (target.className.indexOf('filter-btn') === -1) {
    return;
  }
  setActiveSource(target.getAttribute('data-source'));
});

// 生效条件标签：点哪个就单独撤销哪一组
activeChipsEl.addEventListener('click', function (e) {
  var chip = e.target.closest ? e.target.closest('.active-chip') : null;
  if (chip) {
    removeCondition(chip.getAttribute('data-remove-group'));
  }
});

// 关键字输入：边输边筛；清空即恢复
keywordInput.addEventListener('input', function () {
  setKeyword(keywordInput.value);
});

// 空状态一的出口：一次清除三组筛选和关键字，全部回到默认
clearFilterBtn.addEventListener('click', function () {
  setActiveCategory('全部');
  setActiveSource('全部');
  setActiveStatus('全部');
  keywordInput.value = '';
  setKeyword('');
});

exportBtn.addEventListener('click', exportCsv);

listEl.addEventListener('click', function (e) {
  var li = e.target.closest ? e.target.closest('.feedback-item') : null;
  if (li) {
    openDetail(li.getAttribute('data-id'));
  }
});

// 06.4 键盘操作：事件委托监听 keydown，Enter 或空格触发与鼠标点击相同的 openDetail，不复制打开逻辑
listEl.addEventListener('keydown', function (e) {
  var li = e.target.closest ? e.target.closest('.feedback-item') : null;
  if (!li) {
    return;
  }
  var key = e.key || '';
  if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
    // 空格默认会滚动页面，仅空格需要阻止默认行为
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
    }
    openDetail(li.getAttribute('data-id'));
  }
});

statusOptions.addEventListener('click', function (e) {
  var target = e.target;
  if (target.className.indexOf('status-option') === -1) {
    return;
  }
  var item = findFeedback(currentId);
  if (!item) {
    return;
  }
  item.status = target.getAttribute('data-status');
  renderStatusOptions(item.status);
  persist(); // 详情里改状态也立即保存
});

backBtn.addEventListener('click', backToList);
editBtn.addEventListener('click', openEdit);
editCancelBtn.addEventListener('click', cancelEdit);
editForm.addEventListener('submit', saveEdit);

// ===== AI 分类建议（详情视图，人工采纳后才写入并保存）=====
var classifyBtn = document.getElementById('classifyBtn');
var classifyStatus = document.getElementById('classifyStatus');
var classifyResult = document.getElementById('classifyResult');
var classifyValue = document.getElementById('classifyValue');
var adoptBtn = document.getElementById('adoptBtn');
var rejectBtn = document.getElementById('rejectBtn');
var pendingCategory = null; // 仅暂存“待确认”的建议，未采纳前不写入反馈对象、不保存

function resetClassifyArea() {
  pendingCategory = null;
  classifyResult.hidden = true;
  classifyStatus.hidden = true;
  classifyStatus.textContent = '';
  classifyStatus.classList.remove('is-error');
  classifyBtn.disabled = false;
  classifyBtn.textContent = '要个分类建议';
}

function askClassify() {
  // 线上模式保护：即使通过脚本触发隐藏按钮，也不发送任何模型请求
  if (!isLocalMode) {
    return;
  }
  var item = findFeedback(currentId);
  if (!item) {
    return;
  }
  // 每次重新生成：清掉上一次结果
  pendingCategory = null;
  classifyResult.hidden = true;
  classifyStatus.classList.remove('is-error');
  classifyStatus.hidden = false;
  classifyStatus.textContent = '正在生成……';
  classifyBtn.disabled = true;

  fetch('/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id, content: item.full }) // 只发 id 和用户原话
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.ok && data.category) {
        pendingCategory = data.category;
        classifyValue.textContent = data.category;
        classifyStatus.hidden = true;
        classifyResult.hidden = false;
      } else {
        classifyStatus.textContent = (data && data.message) || '这次没给出可用的分类建议，请重试。';
        classifyStatus.classList.add('is-error');
      }
    })
    .catch(function () {
      classifyStatus.textContent = '请求失败：请确认本机服务正在运行。';
      classifyStatus.classList.add('is-error');
    })
    .then(function () {
      classifyBtn.disabled = false;
    });
}

function adoptCategory() {
  var item = findFeedback(currentId);
  if (!item || !pendingCategory) {
    return;
  }
  // 只有点击采纳，才真正写入 category，并走与新增/编辑相同的保存函数
  item.category = pendingCategory;
  persist();

  // 更新详情页分类显示
  var tag = detailMeta.querySelector('.category-tag');
  if (tag) {
    tag.textContent = item.category;
    tag.classList.remove('is-uncategorized');
  }
  renderList(); // 更新列表，但仍停留在详情视图（若当前筛选不含新分类，该条会按规则从列表隐藏）

  classifyResult.hidden = true;
  classifyStatus.classList.remove('is-error');
  classifyStatus.hidden = false;
  classifyStatus.textContent = '已采纳：' + item.category;
  pendingCategory = null;
}

function rejectCategory() {
  // 不采纳：不动 category、不保存、不留建议记录
  pendingCategory = null;
  classifyResult.hidden = true;
  classifyStatus.classList.remove('is-error');
  classifyStatus.hidden = false;
  classifyStatus.textContent = '未采纳';
}

classifyBtn.addEventListener('click', askClassify);
adoptBtn.addEventListener('click', adoptCategory);
rejectBtn.addEventListener('click', rejectCategory);

// ===== AI 摘要（列表顶部，只看四条件筛选后的当前列表；不保存、不导出）=====
var summaryBtn = document.getElementById('summaryBtn');
var summaryStatus = document.getElementById('summaryStatus');
var summaryResult = document.getElementById('summaryResult');
var summaryText = document.getElementById('summaryText');
var summaryIds = document.getElementById('summaryIds');

function syncSummaryBox(count) {
  summaryBtn.textContent = '生成摘要（当前 ' + count + ' 条）';
  summaryBtn.disabled = count === 0;
  // 列表重渲染（筛选变化、关键字输入、采纳后同步等）即清除上一批摘要，防止摘要与列表错位
  summaryResult.hidden = true;
  summaryStatus.hidden = true;
  summaryStatus.textContent = '';
  summaryStatus.classList.remove('is-error');
}

function generateSummary() {
  // 线上模式保护：即使通过脚本触发隐藏按钮，也不发送任何模型请求
  if (!isLocalMode) {
    return;
  }
  var visible = getVisibleFeedbacks();
  if (visible.length === 0) {
    return;
  }
  summaryResult.hidden = true;
  summaryStatus.classList.remove('is-error');
  summaryStatus.hidden = false;
  summaryStatus.textContent = '正在生成……';
  summaryBtn.disabled = true;

  var items = visible.map(function (item) {
    return { id: item.id, content: item.full }; // 只发 id 和用户原话
  });

  fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: items })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.ok && data.summary) {
        summaryText.textContent = data.summary;
        summaryIds.textContent = '涉及：' + (data.ids || []).join('、');
        summaryStatus.hidden = true;
        summaryResult.hidden = false;
      } else {
        summaryStatus.textContent = (data && data.message) || '摘要生成失败，请重试。';
        summaryStatus.classList.add('is-error');
      }
    })
    .catch(function () {
      summaryStatus.textContent = '请求失败：请确认本机服务正在运行。';
      summaryStatus.classList.add('is-error');
    })
    .then(function () {
      summaryBtn.disabled = getVisibleFeedbacks().length === 0;
    });
}

summaryBtn.addEventListener('click', generateSummary);

// ===== 06.2 线上展示模式 UI 分叉：标记改文案，AI 两个区域整体隐藏 =====
function applyOnlineModeUi() {
  var tag = document.querySelector('.demo-tag');
  if (tag) {
    tag.textContent = '线上演示 · 数据不会保存';
  }
  var classifyBox = document.getElementById('aiClassifyBox');
  var summaryBox = document.getElementById('aiSummaryBox');
  if (classifyBox) {
    classifyBox.hidden = true;
  }
  if (summaryBox) {
    summaryBox.hidden = true;
  }
}

// ===== 初始渲染 =====
if (!isLocalMode) {
  applyOnlineModeUi();
}
renderList();
