// ─────────────────────────────────────────────
// 서버 API 주소
// ─────────────────────────────────────────────
const API = window.location.origin + '/api';

var currentUser = null;

async function checkLoginStatus() {
  try {
    var res  = await fetch(API + '/auth/me', { credentials: 'include' });
    var json = await res.json();
    if (json.success) { currentUser = json.user; showMainApp(); }
    else              { showAuthScreen(); }
  } catch(e) { showAuthScreen(); }
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

// ═══════════════════════════════════════════
// 메인 앱 화면 표시 (팀에 따라 탭 분기)
// ═══════════════════════════════════════════
function showMainApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  document.getElementById('header-name').textContent = currentUser.name + ' 님';

  var team = currentUser.team || 'material';
  var role = currentUser.role;

  // 팀 배지
  var badge = document.getElementById('home-team-badge');
  if (role === 'admin') {
    badge.textContent = '운영자'; badge.style.background = '#ede9fe'; badge.style.color = '#5b21b6';
  } else if (team === 'production') {
    badge.textContent = '생산팀'; badge.style.background = '#dbeafe'; badge.style.color = '#1d4ed8';
  } else {
    badge.textContent = '자재팀'; badge.style.background = '#f0fdf4'; badge.style.color = '#166534';
  }

  // 탭 분기
  var materialTabs  = document.querySelectorAll('.material-tab');
  var productionTabs = document.querySelectorAll('.production-tab');

  if (role === 'admin' || team === 'material') {
    materialTabs.forEach(function(t){ t.style.display = 'block'; });
    productionTabs.forEach(function(t){ t.style.display = 'none'; });
    document.getElementById('nav-req-manage').style.display = 'block';
    document.getElementById('home-grid-material').style.display = 'grid';
    document.getElementById('home-grid-production').style.display = 'none';
  } else {
    materialTabs.forEach(function(t){ t.style.display = 'none'; });
    productionTabs.forEach(function(t){ t.style.display = 'block'; });
    document.getElementById('nav-req-manage').style.display = 'none';
    document.getElementById('home-grid-material').style.display = 'none';
    document.getElementById('home-grid-production').style.display = 'grid';
  }

  // 운영자 탭
  var adminTab = document.getElementById('nav-admin');
  var adminBtn = document.getElementById('home-admin-btn');
  if (role === 'admin') {
    adminTab.style.display = 'block';
    if (adminBtn) adminBtn.style.display = 'block';
  } else {
    adminTab.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
  }

  // 담당자 자동 입력
  ['in-person','dp-person','hj-person'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = currentUser.name;
  });

  // 인사말
  var days = ['일','월','화','수','목','금','토'];
  var now  = new Date();
  document.getElementById('home-greeting').textContent = currentUser.name + ' 님, 안녕하세요 👋';
  document.getElementById('home-date').textContent =
    now.getFullYear() + '년 ' + (now.getMonth()+1) + '월 ' + now.getDate() + '일 (' + days[now.getDay()] + ')';

  currentTab = '';
  switchTab('home', document.getElementById('nav-home'));
}

// 회원가입 팀 선택 토글
function selectRegTeam(team) {
  document.getElementById('reg-team').value = team;
  var matEl  = document.getElementById('reg-team-material');
  var prodEl = document.getElementById('reg-team-production');
  if (team === 'material') {
    matEl.style.background  = '#1a1a1a';     matEl.style.color  = '#fff';        matEl.style.borderColor  = '#1a1a1a';
    prodEl.style.background = 'var(--card)'; prodEl.style.color = 'var(--txt2)'; prodEl.style.borderColor = 'var(--border2)';
  } else {
    prodEl.style.background = '#1a1a1a';     prodEl.style.color  = '#fff';        prodEl.style.borderColor  = '#1a1a1a';
    matEl.style.background  = 'var(--card)'; matEl.style.color   = 'var(--txt2)'; matEl.style.borderColor   = 'var(--border2)';
  }
}

function showAuthTab(tab) {
  var isLogin = tab === 'login';
  document.getElementById('login-form').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('register-form').style.display = isLogin ? 'none'  : 'block';
  document.getElementById('tab-login').style.background    = isLogin ? '#fff' : 'transparent';
  document.getElementById('tab-login').style.color         = isLogin ? '#1a1a1a' : '#6b7280';
  document.getElementById('tab-login').style.boxShadow     = isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
  document.getElementById('tab-register').style.background = isLogin ? 'transparent' : '#fff';
  document.getElementById('tab-register').style.color      = isLogin ? '#6b7280' : '#1a1a1a';
  document.getElementById('tab-register').style.boxShadow  = isLogin ? 'none' : '0 1px 3px rgba(0,0,0,0.1)';
}

async function doLogin() {
  var username = document.getElementById('login-username').value.trim();
  var password = document.getElementById('login-password').value.trim();
  var errDiv   = document.getElementById('login-error');
  if (!username || !password) { errDiv.style.display = 'block'; errDiv.textContent = '아이디와 비밀번호를 입력하세요'; return; }
  try {
    var res  = await fetch(API + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ username, password }) });
    var json = await res.json();
    if (json.success) { currentUser = json.user; errDiv.style.display = 'none'; showMainApp(); }
    else              { errDiv.style.display = 'block'; errDiv.textContent = json.message; }
  } catch(e) { errDiv.style.display = 'block'; errDiv.textContent = '서버에 연결할 수 없습니다'; }
}

async function doRegister() {
  var name     = document.getElementById('reg-name').value.trim();
  var username = document.getElementById('reg-username').value.trim();
  var password = document.getElementById('reg-password').value.trim();
  var team     = document.getElementById('reg-team').value;
  var msgDiv   = document.getElementById('reg-msg');
  if (!name || !username || !password) {
    msgDiv.style.display = 'block'; msgDiv.style.background = '#fef2f2'; msgDiv.style.color = '#dc2626';
    msgDiv.textContent = '모든 항목을 입력하세요'; return;
  }
  try {
    var res  = await fetch(API + '/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ name, username, password, team }) });
    var json = await res.json();
    msgDiv.style.display = 'block';
    if (json.success) {
      msgDiv.style.background = '#f0fdf4'; msgDiv.style.color = '#166534'; msgDiv.textContent = json.message;
      ['reg-name','reg-username','reg-password'].forEach(function(id){ document.getElementById(id).value = ''; });
      selectRegTeam('material');
    } else { msgDiv.style.background = '#fef2f2'; msgDiv.style.color = '#dc2626'; msgDiv.textContent = json.message; }
  } catch(e) { msgDiv.style.display = 'block'; msgDiv.style.background = '#fef2f2'; msgDiv.style.color = '#dc2626'; msgDiv.textContent = '서버에 연결할 수 없습니다'; }
}

async function doLogout() {
  try { await fetch(API + '/auth/logout', { method:'POST', credentials:'include' }); } catch(e) {}
  currentUser = null; showAuthScreen();
}

const TODAY = new Date().toISOString().slice(0, 10);
let inType = 'normal', dpType = 'normal', hjType = 'normal';
let currentCat = '', currentPsCat = '';
let selectedDpItem = null, selectedFifoItem = null;
let ocrData = {};

document.addEventListener('DOMContentLoaded', function () {
  checkLoginStatus();

  document.getElementById('btn-login')    .addEventListener('click', doLogin);
  document.getElementById('btn-register') .addEventListener('click', doRegister);
  document.getElementById('btn-logout')   .addEventListener('click', doLogout);
  document.getElementById('btn-change-pw').addEventListener('click', function(){
    document.getElementById('pw-msg').style.display = 'none';
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-modal').style.display = 'flex';
  });
  document.getElementById('pw-modal-close').addEventListener('click', function(){ document.getElementById('pw-modal').style.display = 'none'; });
  document.getElementById('pw-submit').addEventListener('click', doChangePassword);
  document.getElementById('login-password').addEventListener('keydown', function(e){ if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-username').addEventListener('keydown', function(e){ if (e.key === 'Enter') doLogin(); });

  ['in-date','dp-date','hj-date','ra-date'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = TODAY; });
  fetch(API + '/cleanup', { method:'POST', credentials:'include' }).catch(function(){});

  // 탭 네비게이션
  document.getElementById('nav-home')      .addEventListener('click', function(){ switchTab('home',       this); });
  document.getElementById('nav-inbound')   .addEventListener('click', function(){ switchTab('inbound',    this); });
  document.getElementById('nav-dispatch')  .addEventListener('click', function(){ switchTab('dispatch',   this); });
  document.getElementById('nav-hwanjip')   .addEventListener('click', function(){ switchTab('hwanjip',    this); });
  document.getElementById('nav-stock')     .addEventListener('click', function(){ switchTab('stock',      this); });
  document.getElementById('nav-history')   .addEventListener('click', function(){ switchTab('history',    this); });
  document.getElementById('nav-req-manage').addEventListener('click', function(){ switchTab('req-manage', this); });
  document.getElementById('nav-req-apply') .addEventListener('click', function(){ switchTab('req-apply',  this); });
  document.getElementById('nav-req-status').addEventListener('click', function(){ switchTab('req-status', this); });
  document.getElementById('nav-prod-stock').addEventListener('click', function(){ switchTab('prod-stock', this); });
  document.getElementById('nav-admin')     .addEventListener('click', function(){ switchTab('admin',      this); });

  // 입고
  document.getElementById('in-type-normal').addEventListener('click', function(){ setType('in','normal'); });
  document.getElementById('in-type-fabric').addEventListener('click', function(){ setType('in','fabric'); });
  document.getElementById('in-wh')  .addEventListener('change', function(){ updateWh('in'); });
  document.getElementById('in-st')  .addEventListener('change', function(){ updateStorage('in'); });
  document.getElementById('in-zone').addEventListener('change', function(){ updateLocPreview('in'); });
  document.getElementById('in-rn')  .addEventListener('input',  function(){ updateLocPreview('in'); });
  document.getElementById('in-fl')  .addEventListener('input',  function(){ updateLocPreview('in'); });
  document.getElementById('in-floc').addEventListener('input',  function(){ updateLocPreview('in'); });
  document.getElementById('in-name').addEventListener('input',  function(){ autoCat('in'); });
  document.getElementById('btn-submit-in').addEventListener('click', submitInbound);

  // 불출
  document.getElementById('dp-suffix')     .addEventListener('input', searchBySuffix);
  document.getElementById('dp-type-normal').addEventListener('click', function(){ setType('dp','normal'); });
  document.getElementById('dp-type-fabric').addEventListener('click', function(){ setType('dp','fabric'); });
  document.getElementById('btn-max')       .addEventListener('click', setMaxQty);
  document.getElementById('btn-max-fabric').addEventListener('click', setMaxQty);
  document.getElementById('btn-submit-dp') .addEventListener('click', submitDispatch);
  document.getElementById('btn-reset-dp')  .addEventListener('click', resetDispatch);

  // 환입
  document.getElementById('hj-type-normal').addEventListener('click', function(){ setType('hj','normal'); });
  document.getElementById('hj-type-fabric').addEventListener('click', function(){ setType('hj','fabric'); });
  document.getElementById('hj-wh')  .addEventListener('change', function(){ updateWh('hj'); });
  document.getElementById('hj-st')  .addEventListener('change', function(){ updateStorage('hj'); });
  document.getElementById('hj-zone').addEventListener('change', function(){ updateLocPreview('hj'); });
  document.getElementById('hj-rn')  .addEventListener('input',  function(){ updateLocPreview('hj'); });
  document.getElementById('hj-fl')  .addEventListener('input',  function(){ updateLocPreview('hj'); });
  document.getElementById('hj-floc').addEventListener('input',  function(){ updateLocPreview('hj'); });
  document.getElementById('hj-name').addEventListener('input',  function(){ autoCat('hj'); });
  document.getElementById('btn-submit-hj').addEventListener('click', submitReturn);

  // 재고
  document.getElementById('st-q').addEventListener('input', loadStock);
  document.querySelectorAll('.cat-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      currentCat = this.dataset.cat;
      document.querySelectorAll('.cat-btn').forEach(function(b){ b.classList.remove('on'); });
      this.classList.add('on'); loadStock();
    });
  });

  // 생산팀 재고
  document.getElementById('ps-q').addEventListener('input', loadProdStock);
  document.querySelectorAll('.ps-cat-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      currentPsCat = this.dataset.cat;
      document.querySelectorAll('.ps-cat-btn').forEach(function(b){ b.classList.remove('on'); });
      this.classList.add('on'); loadProdStock();
    });
  });

  // 이력
  document.getElementById('hs-date').addEventListener('change', loadHistory);
  document.getElementById('hs-code').addEventListener('input',  loadHistory);
  document.querySelectorAll('.hist-tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.hist-tab').forEach(function(b){ b.style.background='#f9fafb'; b.style.color='#6b7280'; b.classList.remove('on'); });
      this.style.background='#1a1a1a'; this.style.color='#fff'; this.classList.add('on'); loadHistory();
    });
  });

  // 불출 요청 탭 필터
  document.querySelectorAll('.req-tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.req-tab').forEach(function(b){ b.style.background='var(--card)'; b.style.color='var(--txt2)'; b.classList.remove('on'); });
      this.style.background='#1a1a1a'; this.style.color='#fff'; this.classList.add('on'); loadReqManage();
    });
  });

  // 불출 신청
  document.getElementById('rs-date').addEventListener('change', loadReqStatus);
  document.getElementById('ra-suffix').addEventListener('input', searchRaSuffix);
  document.getElementById('btn-submit-ra').addEventListener('click', submitRequest);
  document.getElementById('btn-reset-ra').addEventListener('click', resetRequest);

  // CSV
  document.getElementById('btn-export').addEventListener('click', function(){ window.open(API + '/export', '_blank'); });

  // 로고
  document.getElementById('logo-btn').addEventListener('click', function(){
    if (currentTab === 'home') return;
    document.getElementById('home-confirm-modal').style.display = 'flex';
  });
  document.getElementById('btn-home-cancel') .addEventListener('click', function(){ document.getElementById('home-confirm-modal').style.display = 'none'; });
  document.getElementById('btn-home-confirm').addEventListener('click', function(){
    document.getElementById('home-confirm-modal').style.display = 'none';
    currentTab = ''; switchTab('home', document.getElementById('nav-home'));
  });

  // 다크모드
  var savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('btn-theme').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  updateLogoTheme(savedTheme);
  function updateLogoTheme(theme) {
    var src = theme === 'dark' ? '/b-logo.png' : '/a-logo.png';
    var a = document.getElementById('logo-img'), b = document.getElementById('login-logo-img');
    if (a) a.src = src; if (b) b.src = src;
  }
  document.getElementById('btn-theme').addEventListener('click', function(){
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.textContent = next === 'dark' ? '☀️' : '🌙';
    updateLogoTheme(next);
  });

  // OCR
  document.getElementById('btn-ocr-camera-in').addEventListener('click', function(){ document.getElementById('ocr-file-in').click(); });
  document.getElementById('ocr-file-in').addEventListener('change', function(e){
    var btn = document.getElementById('btn-ocr-camera-in'); btn.textContent = '🔄 식별 중...'; btn.disabled = true;
    doOCR(e).then(function(){ applyOcrToInbound(); btn.textContent = '📷 식별표 촬영으로 자동 입력'; btn.disabled = false; })
            .catch(function(){ btn.textContent = '📷 식별표 촬영으로 자동 입력'; btn.disabled = false; });
  });
  document.getElementById('btn-ocr-camera-hj').addEventListener('click', function(){ document.getElementById('ocr-file-hj').click(); });
  document.getElementById('ocr-file-hj').addEventListener('change', function(e){
    var btn = document.getElementById('btn-ocr-camera-hj'); btn.textContent = '🔄 식별 중...'; btn.disabled = true;
    doOCR(e).then(function(){ applyOcrToReturn(); btn.textContent = '📷 식별표 촬영으로 자동 입력'; btn.disabled = false; })
            .catch(function(){ btn.textContent = '📷 식별표 촬영으로 자동 입력'; btn.disabled = false; });
  });

  // 데이터 초기화
  document.getElementById('btn-reset-data').addEventListener('click', function(){ document.getElementById('reset-pw').value = ''; document.getElementById('reset-modal').style.display = 'flex'; });
  document.getElementById('btn-reset-cancel').addEventListener('click', function(){ document.getElementById('reset-modal').style.display = 'none'; });
  document.getElementById('btn-reset-confirm').addEventListener('click', async function(){
    var pw = document.getElementById('reset-pw').value.trim();
    if (!pw) { showToast('비밀번호를 입력하세요'); return; }
    var res = await fetch(API + '/reset-data', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
    var json = await res.json();
    if (json.success) { document.getElementById('reset-modal').style.display = 'none'; showToast('✓ 전체 데이터가 초기화됐습니다'); loadHomeStats(); }
    else { showToast('오류: ' + json.message); }
  });

  // 수정 모달
  document.getElementById('edit-close')    .addEventListener('click', function(){ document.getElementById('edit-modal').style.display = 'none'; });
  document.getElementById('btn-edit-save') .addEventListener('click', saveEdit);
  document.getElementById('btn-edit-delete').addEventListener('click', async function(){
    if (!editingId) return;
    if (!confirm('이 항목을 삭제할까요?')) return;
    try {
      var res = await fetch(API + '/record/' + editingId, { method:'DELETE', credentials:'include' });
      var json = await res.json();
      if (json.success) { showToast('✓ 삭제 완료!'); document.getElementById('edit-modal').style.display = 'none'; loadStock(); }
    } catch(e) { showToast('서버 연결 오류'); }
  });
  document.getElementById('edit-modal').addEventListener('click', function(e){ if (e.target === this) this.style.display = 'none'; });
  document.getElementById('edit-st').addEventListener('change', function(){
    document.getElementById('edit-rack-fields') .style.display = this.value === 'rack'  ? 'block' : 'none';
    document.getElementById('edit-floor-fields').style.display = this.value === 'floor' ? 'block' : 'none';
  });
  document.getElementById('edit-wh').addEventListener('change', function(){
    document.getElementById('edit-rack-label').textContent = this.value === 'D' ? '렉 번호 (1~14)' : '렉 번호 (1~10)';
    document.getElementById('edit-rn').max = this.value === 'D' ? 14 : 10;
  });

  // 확정/반려 모달 취소 버튼
  document.getElementById('btn-confirm-cancel').addEventListener('click', function(){
    if (confirmingRequestId) clearReqLock(confirmingRequestId);
    confirmingRequestId = null;
    document.getElementById('confirm-modal').style.display = 'none';
  });
  document.getElementById('confirm-modal').addEventListener('click', function(e){
    if (e.target === this) {
      if (confirmingRequestId) clearReqLock(confirmingRequestId);
      confirmingRequestId = null;
      this.style.display = 'none';
    }
  });
  document.getElementById('btn-reject-cancel') .addEventListener('click', function(){ 
    if (rejectingRequestId) clearReqLock(rejectingRequestId);
    rejectingRequestId = null;
    document.getElementById('reject-modal').style.display = 'none'; 
  });

});


// ═══════════════════════════════════════════
// 탭 전환
// ═══════════════════════════════════════════
var currentTab = '';

function switchTab(name, btn) {
  if (currentTab === name) return;
  currentTab = name;
  document.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.nav button').forEach(function(b){ b.classList.remove('active'); });
  var sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  var navBtn = btn;
  if (!navBtn || !navBtn.closest || !navBtn.closest('.nav')) navBtn = document.getElementById('nav-' + name);
  if (navBtn) navBtn.classList.add('active');

  if (name === 'home') {
    ['in-name','in-code','in-lot','in-lot-fabric','in-qty','in-rn','in-fl','in-floc','in-route','in-po','in-rolls','in-weight','in-meters','in-note'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
    var inCat = document.getElementById('in-cat'); if (inCat) inCat.value = '';
    var inPrev = document.getElementById('in-loc-preview'); if (inPrev) inPrev.style.display = 'none';
    setType('in', 'normal');
    ['hj-code','hj-name','hj-lot','hj-qty','hj-po','hj-rolls','hj-weight','hj-meters','hj-route','hj-rn','hj-fl','hj-floc','hj-note'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
    var hjCat = document.getElementById('hj-cat'); if (hjCat) hjCat.value = '';
    var hjPrev = document.getElementById('hj-loc-preview'); if (hjPrev) hjPrev.style.display = 'none';
    setType('hj', 'normal');
  }

  if (name === 'stock')      if (typeof loadStock     === 'function') loadStock();
  if (name === 'prod-stock') if (typeof loadProdStock === 'function') loadProdStock();
  if (name === 'history') {
    var dateInput = document.getElementById('hs-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0,10);
    if (typeof loadHistory === 'function') loadHistory();
  }
  if (name === 'admin')      if (typeof loadUsers     === 'function') loadUsers();
  if (name === 'home')       if (typeof loadHomeStats === 'function') loadHomeStats();
  if (name === 'req-manage') if (typeof loadReqManage === 'function') loadReqManage();
  if (name === 'req-status') if (typeof loadReqStatus === 'function') loadReqStatus();
}
window.switchTab = switchTab;


async function loadHomeStats() {
  try {
    var today  = new Date().toISOString().slice(0,10);
    var invRes = await fetch(API + '/inventory', { credentials:'include' });
    var outRes = await fetch(API + '/history?kind=out&date=' + today, { credentials:'include' });
    var inv = await invRes.json(), out = await outRes.json();
    document.getElementById('home-today-in')   .textContent = inv.today_in  || 0;
    document.getElementById('home-total-in')   .textContent = inv.total_in  || 0;
    document.getElementById('home-total-stock').textContent = (inv.data || []).length;
    document.getElementById('home-today-out')  .textContent = out.today     || 0;
  } catch(e) {}
}

async function doChangePassword() {
  var current = document.getElementById('pw-current').value.trim();
  var newPw   = document.getElementById('pw-new').value.trim();
  var msgDiv  = document.getElementById('pw-msg');
  if (!current || !newPw) {
    msgDiv.style.display='block'; msgDiv.style.background='#fef2f2'; msgDiv.style.color='#dc2626';
    msgDiv.textContent='모든 항목을 입력하세요'; return;
  }
  try {
    var res  = await fetch(API + '/auth/change-password', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ current, new_password: newPw }) });
    var json = await res.json();
    msgDiv.style.display='block';
    msgDiv.style.background = json.success ? '#f0fdf4' : '#fef2f2';
    msgDiv.style.color      = json.success ? '#166534' : '#dc2626';
    msgDiv.textContent = json.message;
    if (json.success) { setTimeout(function(){ document.getElementById('pw-modal').style.display = 'none'; }, 1500); }
  } catch(e) {
    msgDiv.style.display='block'; msgDiv.style.background='#fef2f2'; msgDiv.style.color='#dc2626'; msgDiv.textContent='서버 연결 오류';
  }
}
