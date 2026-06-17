// ─────────────────────────────────────────────
// 서버 API 주소
// ─────────────────────────────────────────────
const API = window.location.origin + '/api';

// 현재 로그인한 사용자 정보
var currentUser = null;


// ═══════════════════════════════════════════
// 페이지 로드 시 로그인 상태 확인
// ═══════════════════════════════════════════
async function checkLoginStatus() {
  try {
    var res  = await fetch(API + '/auth/me', { credentials: 'include' });
    var json = await res.json();

    if (json.success) {
      // 로그인 된 상태 → 앱 화면 표시
      currentUser = json.user;
      showMainApp();
    } else {
      // 로그인 안 된 상태 → 로그인 화면 표시
      showAuthScreen();
    }
  } catch(e) {
    showAuthScreen();
  }
}


// ═══════════════════════════════════════════
// 로그인 화면 표시
// ═══════════════════════════════════════════
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('main-app')   .style.display = 'none';
}


// ═══════════════════════════════════════════
// 메인 앱 화면 표시
// ═══════════════════════════════════════════
function showMainApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app')   .style.display = 'block';

  document.getElementById('header-name').textContent = currentUser.name + ' 님';

  var adminTab     = document.getElementById('nav-admin');
  var adminHomeBtn = document.getElementById('home-admin-btn');
  if (currentUser.role === 'admin') {
    adminTab.style.display = 'block';
    if (adminHomeBtn) adminHomeBtn.style.display = 'flex';
  } else {
    adminTab.style.display = 'none';
    if (adminHomeBtn) adminHomeBtn.style.display = 'none';
  }

  var personFields = ['in-person', 'dp-person', 'hj-person'];
  personFields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = currentUser.name;
  });

  // 홈 날짜/인사말
  var days = ['일','월','화','수','목','금','토'];
  var now = new Date();
  document.getElementById('home-greeting').textContent = currentUser.name + ' 님, 안녕하세요 👋';
  document.getElementById('home-date').textContent =
    now.getFullYear() + '년 ' + (now.getMonth()+1) + '월 ' + now.getDate() + '일 (' + days[now.getDay()] + ')';

  // 홈으로 시작
  currentTab = '';
  switchTab('home', document.getElementById('nav-home'));
}


// ═══════════════════════════════════════════
// 로그인/회원가입 탭 전환
// ═══════════════════════════════════════════
function showAuthTab(tab) {
  var isLogin = tab === 'login';
  document.getElementById('login-form')   .style.display = isLogin ? 'block' : 'none';
  document.getElementById('register-form').style.display = isLogin ? 'none'  : 'block';
  document.getElementById('tab-login')   .style.background    = isLogin ? '#fff'        : 'transparent';
  document.getElementById('tab-login')   .style.color         = isLogin ? '#1a1a1a'     : '#6b7280';
  document.getElementById('tab-login')   .style.boxShadow     = isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
  document.getElementById('tab-register').style.background    = isLogin ? 'transparent' : '#fff';
  document.getElementById('tab-register').style.color         = isLogin ? '#6b7280'     : '#1a1a1a';
  document.getElementById('tab-register').style.boxShadow     = isLogin ? 'none'        : '0 1px 3px rgba(0,0,0,0.1)';
}


// ═══════════════════════════════════════════
// 로그인 처리
// ═══════════════════════════════════════════
async function doLogin() {
  var username = document.getElementById('login-username').value.trim();
  var password = document.getElementById('login-password').value.trim();
  var errDiv   = document.getElementById('login-error');

  if (!username || !password) {
    errDiv.style.display = 'block';
    errDiv.textContent   = '아이디와 비밀번호를 입력하세요';
    return;
  }

  try {
    var res  = await fetch(API + '/auth/login', {
      method     : 'POST',
      headers    : { 'Content-Type': 'application/json' },
      credentials: 'include',
      body       : JSON.stringify({ username, password })
    });
    var json = await res.json();

    if (json.success) {
      currentUser = json.user;
      errDiv.style.display = 'none';
      showMainApp();
    } else {
      errDiv.style.display = 'block';
      errDiv.textContent   = json.message;
    }
  } catch(e) {
    errDiv.style.display = 'block';
    errDiv.textContent   = '서버에 연결할 수 없습니다';
  }
}


// ═══════════════════════════════════════════
// 회원가입 처리
// ═══════════════════════════════════════════
async function doRegister() {
  var name     = document.getElementById('reg-name')    .value.trim();
  var username = document.getElementById('reg-username').value.trim();
  var password = document.getElementById('reg-password').value.trim();
  var msgDiv   = document.getElementById('reg-msg');

  if (!name || !username || !password) {
    msgDiv.style.display    = 'block';
    msgDiv.style.background = '#fef2f2';
    msgDiv.style.color      = '#dc2626';
    msgDiv.textContent      = '모든 항목을 입력하세요';
    return;
  }

  try {
    var res  = await fetch(API + '/auth/register', {
      method     : 'POST',
      headers    : { 'Content-Type': 'application/json' },
      credentials: 'include',
      body       : JSON.stringify({ name, username, password })
    });
    var json = await res.json();

    msgDiv.style.display = 'block';
    if (json.success) {
      msgDiv.style.background = '#f0fdf4';
      msgDiv.style.color      = '#166534';
      msgDiv.textContent      = json.message;
      // 입력 초기화
      ['reg-name','reg-username','reg-password'].forEach(function(id){
        document.getElementById(id).value = '';
      });
    } else {
      msgDiv.style.background = '#fef2f2';
      msgDiv.style.color      = '#dc2626';
      msgDiv.textContent      = json.message;
    }
  } catch(e) {
    msgDiv.style.display    = 'block';
    msgDiv.style.background = '#fef2f2';
    msgDiv.style.color      = '#dc2626';
    msgDiv.textContent      = '서버에 연결할 수 없습니다';
  }
}


// ═══════════════════════════════════════════
// 로그아웃
// ═══════════════════════════════════════════
async function doLogout() {
  try {
    await fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' });
  } catch(e) {}
  currentUser = null;
  showAuthScreen();
}




// 오늘 날짜
const TODAY = new Date().toISOString().slice(0, 10);

// 현재 선택된 상태값
let inType  = 'normal';  // 입고 품목 유형
let dpType  = 'normal';  // 불출 품목 유형
let hjType  = 'normal';  // 환입 품목 유형
let currentCat = '';     // 재고 탭 카테고리 필터
let selectedDpItem  = null;  // 불출: 선택된 품목
let selectedFifoItem = null; // 불출: 선택된 FIFO 항목
let ocrData = {};        // OCR 추출 결과


// ═══════════════════════════════════════════
// 페이지 로드 완료 후 모든 이벤트 등록
// DOMContentLoaded: HTML이 완전히 파싱된 후 실행
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {

  // 로그인 상태 확인
  checkLoginStatus();

  // 로그인 폼 이벤트
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('btn-register').addEventListener('click', doRegister);
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-change-pw').addEventListener('click', function(){
    document.getElementById('pw-msg').style.display = 'none';
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-modal').style.display = 'flex';
  });
  document.getElementById('pw-modal-close').addEventListener('click', function(){
    document.getElementById('pw-modal').style.display = 'none';
  });
  document.getElementById('pw-submit').addEventListener('click', doChangePassword);

  // 엔터키로 로그인
  document.getElementById('login-password').addEventListener('keydown', function(e){
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-username').addEventListener('keydown', function(e){
    if (e.key === 'Enter') doLogin();
  });

  // 날짜 기본값 = 오늘
  ['in-date', 'dp-date', 'hj-date'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = TODAY;
  });

  // 서버에 소진 항목 정리 요청
  fetch(API + '/cleanup', { method: 'POST', credentials: 'include' }).catch(function(){});

  // ─────────────────────────────────────
  // 탭 네비게이션 이벤트
  // ─────────────────────────────────────
  document.getElementById('nav-home')    .addEventListener('click', function(){ switchTab('home',     this); });
  document.getElementById('nav-inbound') .addEventListener('click', function(){ switchTab('inbound',  this); });
  document.getElementById('nav-dispatch').addEventListener('click', function(){ switchTab('dispatch', this); });
  document.getElementById('nav-hwanjip') .addEventListener('click', function(){ switchTab('hwanjip',  this); });
  document.getElementById('nav-stock')   .addEventListener('click', function(){ switchTab('stock',    this); });
  document.getElementById('nav-history') .addEventListener('click', function(){ switchTab('history',  this); });
  document.getElementById('nav-admin')   .addEventListener('click', function(){ switchTab('admin',    this); });

  // ─────────────────────────────────────
  // 입고: 품목 유형 토글
  // ─────────────────────────────────────
  document.getElementById('in-type-normal').addEventListener('click', function(){ setType('in', 'normal'); });
  document.getElementById('in-type-fabric').addEventListener('click', function(){ setType('in', 'fabric'); });

  // ─────────────────────────────────────
  // 입고: 창고/보관방식 변경 시 위치 필드 업데이트
  // ─────────────────────────────────────
  document.getElementById('in-wh')  .addEventListener('change', function(){ updateWh('in'); });
  document.getElementById('in-st')  .addEventListener('change', function(){ updateStorage('in'); });
  document.getElementById('in-zone').addEventListener('change', function(){ updateLocPreview('in'); });
  document.getElementById('in-rn')  .addEventListener('input',  function(){ updateLocPreview('in'); });
  document.getElementById('in-fl')  .addEventListener('input',  function(){ updateLocPreview('in'); });
  document.getElementById('in-floc').addEventListener('input',  function(){ updateLocPreview('in'); });

  // ─────────────────────────────────────
  // 입고: 품목명 입력 시 카테고리 자동 감지
  // ─────────────────────────────────────
  document.getElementById('in-name').addEventListener('input', function(){ autoCat('in'); });

  // 입고 등록 버튼
  document.getElementById('btn-submit-in').addEventListener('click', submitInbound);

  // ─────────────────────────────────────
  // 불출: 품번 입력 시 품목 검색
  // ─────────────────────────────────────
  document.getElementById('dp-suffix').addEventListener('input', searchBySuffix);

  // 불출: 품목 유형 토글
  document.getElementById('dp-type-normal').addEventListener('click', function(){ setType('dp', 'normal'); });
  document.getElementById('dp-type-fabric').addEventListener('click', function(){ setType('dp', 'fabric'); });

  // 불출: MAX 버튼
  document.getElementById('btn-max')       .addEventListener('click', setMaxQty);
  document.getElementById('btn-max-fabric').addEventListener('click', setMaxQty);

  // 불출 확정 / 다시 선택
  document.getElementById('btn-submit-dp').addEventListener('click', submitDispatch);
  document.getElementById('btn-reset-dp') .addEventListener('click', resetDispatch);

  // ─────────────────────────────────────
  // 환입: 이벤트
  // ─────────────────────────────────────
  document.getElementById('hj-type-normal').addEventListener('click', function(){ setType('hj', 'normal'); });
  document.getElementById('hj-type-fabric').addEventListener('click', function(){ setType('hj', 'fabric'); });
  document.getElementById('hj-wh')  .addEventListener('change', function(){ updateWh('hj'); });
  document.getElementById('hj-st')  .addEventListener('change', function(){ updateStorage('hj'); });
  document.getElementById('hj-zone').addEventListener('change', function(){ updateLocPreview('hj'); });
  document.getElementById('hj-rn')  .addEventListener('input',  function(){ updateLocPreview('hj'); });
  document.getElementById('hj-fl')  .addEventListener('input',  function(){ updateLocPreview('hj'); });
  document.getElementById('hj-floc').addEventListener('input',  function(){ updateLocPreview('hj'); });
  document.getElementById('hj-name').addEventListener('input',  function(){ autoCat('hj'); });
  document.getElementById('btn-submit-hj').addEventListener('click', submitReturn);

  // ─────────────────────────────────────
  // 재고: 검색 + 카테고리 필터
  // ─────────────────────────────────────
  document.getElementById('st-q').addEventListener('input', loadStock);
  document.querySelectorAll('.cat-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentCat = this.dataset.cat;
      document.querySelectorAll('.cat-btn').forEach(function(b){ b.classList.remove('on'); });
      this.classList.add('on');
      loadStock();
    });
  });

  // 이력 날짜 필터 이벤트
  document.getElementById('hs-date').addEventListener('change', loadHistory);
  document.getElementById('hs-code').addEventListener('input', loadHistory);
  document.querySelectorAll('.hist-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.hist-tab').forEach(function(b){
        b.style.background = '#f9fafb';
        b.style.color = '#6b7280';
        b.classList.remove('on');
      });
      this.style.background = '#1a1a1a';
      this.style.color = '#fff';
      this.classList.add('on');
      loadHistory();
    });
  });
  // 빠른 날짜 선택 버튼 (1주일/1개월/3개월/전체)
  document.querySelectorAll('.hs-quick').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var days = parseInt(this.dataset.days);
      var today = new Date();
      var toStr = today.toISOString().slice(0, 10);

      if (days === 0) {
        // 전체: 필터 초기화
        document.getElementById('hs-from').value = '';
        document.getElementById('hs-to').value   = '';
      } else {
        var from = new Date(today);
        from.setDate(from.getDate() - days);
        document.getElementById('hs-from').value = from.toISOString().slice(0, 10);
        document.getElementById('hs-to').value   = toStr;
      }

      // 버튼 활성화 표시
      document.querySelectorAll('.hs-quick').forEach(function(b){
        b.style.background = '#f9fafb';
        b.style.borderColor = 'var(--border2)';
        b.style.color = 'var(--txt2)';
      });
      this.style.background   = 'var(--txt)';
      this.style.borderColor  = 'var(--txt)';
      this.style.color        = '#fff';

      loadHistory();
    });
  });

  // CSV 내보내기
  document.getElementById('btn-export').addEventListener('click', function(){
    window.open(API + '/export', '_blank');
  });

  // ─────────────────────────────────────
  // 탭 이벤트
  // ─────────────────────────────────────
  document.getElementById('nav-home')    .addEventListener('click', function(){ switchTab('home',     this); });
  document.getElementById('logo-btn').addEventListener('click', function(){
    if (currentTab === 'home') return;
    document.getElementById('home-confirm-modal').style.display = 'flex';
  });
  document.getElementById('btn-home-cancel').addEventListener('click', function(){
    document.getElementById('home-confirm-modal').style.display = 'none';
  });
  document.getElementById('btn-home-confirm').addEventListener('click', function(){
    document.getElementById('home-confirm-modal').style.display = 'none';
    currentTab = '';
    document.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('sec-home').classList.add('active');
    currentTab = 'home';
    loadHomeStats();
  });

  // 다크모드 토글
  var savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('btn-theme').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  updateLogoTheme(savedTheme);
  function updateLogoTheme(theme) {
    var src = theme === 'dark' ? '/b-logo.png' : '/a-logo.png';
    var logoImg = document.getElementById('logo-img');
    var loginLogoImg = document.getElementById('login-logo-img');
    if (logoImg) logoImg.src = src;
    if (loginLogoImg) loginLogoImg.src = src;
  }

  document.getElementById('btn-theme').addEventListener('click', function(){
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.textContent = next === 'dark' ? '☀️' : '🌙';
    updateLogoTheme(next);
  });

  // ─────────────────────────────────────
  // OCR: 입고/환입 카메라 버튼
  // ─────────────────────────────────────
  document.getElementById('btn-ocr-camera-in').addEventListener('click', function(){
    document.getElementById('ocr-file-in').click();
  });
  document.getElementById('ocr-file-in').addEventListener('change', function(e){
    var btn = document.getElementById('btn-ocr-camera-in');
    btn.textContent = '🔄 식별 중...';
    btn.disabled = true;
    doOCR(e).then(function(){
      applyOcrToInbound();
      btn.textContent = '📷 식별표 촬영으로 자동 입력';
      btn.disabled = false;
    }).catch(function(){
      btn.textContent = '📷 식별표 촬영으로 자동 입력';
      btn.disabled = false;
    });
  });
  document.getElementById('btn-ocr-camera-hj').addEventListener('click', function(){
    document.getElementById('ocr-file-hj').click();
  });
  document.getElementById('ocr-file-hj').addEventListener('change', function(e){
    var btn = document.getElementById('btn-ocr-camera-hj');
    btn.textContent = '🔄 식별 중...';
    btn.disabled = true;
    doOCR(e).then(function(){
      applyOcrToReturn();
      btn.textContent = '📷 식별표 촬영으로 자동 입력';
      btn.disabled = false;
    }).catch(function(){
      btn.textContent = '📷 식별표 촬영으로 자동 입력';
      btn.disabled = false;
    });
  });

  // ─────────────────────────────────────
  // 데이터 초기화
  // ─────────────────────────────────────
  document.getElementById('btn-reset-data').addEventListener('click', function(){
    document.getElementById('reset-pw').value = '';
    document.getElementById('reset-modal').style.display = 'flex';
  });
  document.getElementById('btn-reset-cancel').addEventListener('click', function(){
    document.getElementById('reset-modal').style.display = 'none';
  });
  document.getElementById('btn-reset-confirm').addEventListener('click', async function(){
    var pw = document.getElementById('reset-pw').value.trim();
    if (!pw) { showToast('비밀번호를 입력하세요'); return; }
    var res = await fetch(API + '/reset-data', {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ password: pw })
    });
    var json = await res.json();
    if (json.success) {
      document.getElementById('reset-modal').style.display = 'none';
      showToast('✓ 전체 데이터가 초기화됐습니다');
      loadHomeStats();
    } else {
      showToast('오류: ' + json.message);
    }
  });

  // 수정 모달 이벤트
  document.getElementById('edit-close')    .addEventListener('click', function(){ document.getElementById('edit-modal').style.display = 'none'; });
  document.getElementById('btn-edit-save') .addEventListener('click', saveEdit);
  document.getElementById('btn-edit-delete').addEventListener('click', async function(){
    if (!editingId) return;
    if (!confirm('이 항목을 삭제할까요?')) return;
    try {
      var res  = await fetch(API + '/record/' + editingId, { method: 'DELETE', credentials: 'include' });
      var json = await res.json();
      if (json.success) {
        showToast('✓ 삭제 완료!');
        document.getElementById('edit-modal').style.display = 'none';
        loadStock();
      }
    } catch(e) { showToast('서버 연결 오류'); }
  });
  document.getElementById('edit-modal').addEventListener('click', function(e){
    if (e.target === this) this.style.display = 'none';
  });
  document.getElementById('edit-st').addEventListener('change', function(){
    var v = this.value;
    document.getElementById('edit-rack-fields') .style.display = v === 'rack'  ? 'block' : 'none';
    document.getElementById('edit-floor-fields').style.display = v === 'floor' ? 'block' : 'none';
  });
  document.getElementById('edit-wh').addEventListener('change', function(){
    var rl = document.getElementById('edit-rack-label');
    var rn = document.getElementById('edit-rn');
    rl.textContent = this.value === 'D' ? '렉 번호 (1~14)' : '렉 번호 (1~10)';
    rn.max = this.value === 'D' ? 14 : 10;
  });

}); // DOMContentLoaded 끝


// ═══════════════════════════════════════════
// 탭 전환 (어떤 상황에서도 튕기지 않는 안전 버전)
// ═══════════════════════════════════════════
var currentTab = '';

function switchTab(name, btn) {
  if (currentTab === name) return;
  currentTab = name;

  // 1. 모든 섹션 및 네비게이션 버튼 불 끄기
  document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav button').forEach(function(b) { b.classList.remove('active'); });

  // 2. 선택한 섹션 활성화 (안전 검사)
  var targetSection = document.getElementById('sec-' + name);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // 3. [핵심] 네비게이션 버튼 불 켜기 (에러 방어막)
  var navBtn = btn;
  // 만약 btn이 안 넘어왔거나, 홈 화면의 대시보드 버튼이 넘어온 경우 하단 바에서 직접 찾습니다.
  if (!navBtn || !navBtn.closest || !navBtn.closest('.nav')) {
    navBtn = document.getElementById('nav-' + name);
  }
  // 찾은 버튼이 존재할 때만 클래스를 추가해서 에러를 원천 차단합니다.
  if (navBtn) {
    navBtn.classList.add('active');
  }

  // 4. 탭별 데이터 로드 (안전하게 실행 가능)
  if (name === 'stock')   if (typeof loadStock === 'function') loadStock();
  if (name === 'history') {
    var todayStr = new Date().toISOString().slice(0, 10);
    var dateInput = document.getElementById('hs-date');
    if (dateInput) dateInput.value = todayStr;
    if (typeof loadHistory === 'function') loadHistory();
  }
  if (name === 'admin')   if (typeof loadUsers === 'function') loadUsers();
  if (name === 'home')    if (typeof loadHomeStats === 'function') loadHomeStats();
}

// 혹시 파일이 쪼개지면서 스코프(범위)가 꼬였을 경우를 대비해 전역 window에 명시적으로 연결
window.switchTab = switchTab;

// ═══════════════════════════════════════════
// 홈 통계 로드
// ═══════════════════════════════════════════
async function loadHomeStats() {
  try {
    var today = new Date().toISOString().slice(0,10);
    var invRes = await fetch(API + '/inventory', { credentials: 'include' });
    var outRes = await fetch(API + '/history?kind=out&date=' + today, { credentials: 'include' });
    var inv = await invRes.json();
    var out = await outRes.json();
    document.getElementById('home-today-in').textContent    = inv.today_in  || 0;
    document.getElementById('home-total-in').textContent    = inv.total_in  || 0;
    document.getElementById('home-total-stock').textContent = (inv.data || []).length;
    document.getElementById('home-today-out').textContent   = out.today     || 0;
  } catch(e) { console.log('홈 통계 로드 실패', e); }
}

async function doChangePassword() {
  var current = document.getElementById('pw-current').value.trim();
  var newPw   = document.getElementById('pw-new').value.trim();
  var msgDiv  = document.getElementById('pw-msg');

  if (!current || !newPw) {
    msgDiv.style.display    = 'block';
    msgDiv.style.background = '#fef2f2';
    msgDiv.style.color      = '#dc2626';
    msgDiv.textContent      = '모든 항목을 입력하세요';
    return;
  }

  try {
    var res = await fetch(API + '/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, new_password: newPw })
    });
    var json = await res.json();
    masgDiv.style.display = 'block';
    msgDiv.style.background = json.success ? '#f0fdf4' : '#fef2f2';
    msgDiv.style.color = json.success ? '#166534' : '#dc2626';
    msgDiv.textContent = json.message;
    if (json.success) {
      setTimeoiut(function(){
        document.getElementById('pw-modal').style.display = 'none';
      }, 1500);
    }
  } catch(e) {
    msgDiv.style.display    = 'block';
    msgDiv.style.background = '#fef2f2';
    msgDiv.style.color      = '#dc2626';
    msgDiv.textContent      = '서버에 연결 오류';
  }
}
// ═══════════════════════════════════════════