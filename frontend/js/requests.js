// ═══════════════════════════════════════════
// requests.js - 불출 신청 / 관리
// ═══════════════════════════════════════════

var confirmingRequestId = null;
var rejectingRequestId  = null;
var selectedRaItem      = null;
var selectedRaFifo      = null;

// ─── 작업 잠금 (자재팀 동시 작업 방지) ───
var _reqLockTimer = null;

async function setReqLock(requestId, name) {
  await fetch(API + '/lock', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'REQ_' + requestId })
  }).catch(function(){});
}

async function clearReqLock(requestId) {
  await fetch(API + '/lock/REQ_' + requestId, {
    method: 'DELETE', credentials: 'include'
  }).catch(function(){});
}

function showReqLockBanner(name) {
  var existing = document.getElementById('req-lock-banner');
  if (existing) existing.remove();
  var banner = document.createElement('div');
  banner.id = 'req-lock-banner';
  banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#ff3b30;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
  banner.textContent = '⚠️ ' + name + ' 님이 작업 중입니다';
  document.body.appendChild(banner);
  setTimeout(function(){ banner.remove(); }, 3000);
}

function hideReqLockBanner() {
  var b = document.getElementById('req-lock-banner');
  if (b) b.remove();
}

// 상태 라벨
function reqStatusLabel(status) {
  if (status === 'pending')   return { text: '대기중', bg: '#fef9c3', color: '#854d0e' };
  if (status === 'confirmed') return { text: '확정',   bg: '#f0fdf4', color: '#166534' };
  if (status === 'rejected')  return { text: '반려',   bg: '#fef2f2', color: '#991b1b' };
  return { text: status, bg: '#f3f4f6', color: '#6b7280' };
}


// ═══════════════════════════════════════════
// 생산팀: 품번 끝자리로 품목 검색
// ═══════════════════════════════════════════
async function searchRaSuffix() {
  var suffix = document.getElementById('ra-suffix').value.trim();

  document.getElementById('ra-step2').style.display = 'none';
  document.getElementById('ra-step3').style.display = 'none';
  selectedRaItem = null;
  selectedRaFifo = null;

  if (suffix.length < 2) return;

  try {
    var res     = await fetch(API + '/fifo?code=' + encodeURIComponent(suffix), { credentials: 'include' });
    var json    = await res.json();
    var matches = json.data || [];

    if (!matches.length) {
      document.getElementById('ra-step2').style.display = 'block';
      document.getElementById('ra-item-list').innerHTML =
        '<p style="text-align:center;color:var(--txt2);padding:16px 0;font-size:14px">해당 품번 없음</p>';
      return;
    }

    var seen = {}, unique = [];
    matches.forEach(function(m) {
      if (m.code && !seen[m.code]) { seen[m.code] = true; unique.push(m); }
    });

    if (unique.length === 1) { selectRaItem(unique[0]); return; }

    document.getElementById('ra-step2').style.display = 'block';
    document.getElementById('ra-item-list').innerHTML = unique.map(function(item) {
      return '<div class="ra-item-card" data-code="' + item.code + '" ' +
        'style="padding:12px;border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:8px;cursor:pointer;background:var(--card);color:var(--txt)">' +
        '<div style="font-size:14px;font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
        '<div style="font-size:12px;color:var(--txt2);margin-top:3px">' + item.code + '</div>' +
        '</div>';
    }).join('');

    document.querySelectorAll('.ra-item-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var code  = this.dataset.code;
        var found = unique.find(function(u){ return u.code === code; });
        if (found) selectRaItem(found);
      });
    });

  } catch(e) { showToast('서버 연결 오류'); }
}


// ═══════════════════════════════════════════
// 생산팀: 품목 선택 → FIFO 목록 표시
// ═══════════════════════════════════════════
async function selectRaItem(item) {
  selectedRaItem = item;
  selectedRaFifo = null;

  document.getElementById('ra-step2').style.display = 'none';
  document.getElementById('ra-step3').style.display = 'block';

  document.getElementById('ra-selected-info').innerHTML =
    '<div style="font-size:13px;font-weight:600;color:var(--blue)">' + (item.name || '-') + '</div>' +
    '<div style="font-size:12px;color:var(--blue);margin-top:2px;opacity:.8">' + item.code + '</div>';

  try {
    var res  = await fetch(API + '/fifo?code=' + encodeURIComponent(item.code), { credentials: 'include' });
    var json = await res.json();
    var list = json.data || [];

    var wrap = document.getElementById('ra-fifo-wrap');
    if (!list.length) { wrap.innerHTML = ''; return; }

    var isFabric = list[0].item_type === 'fabric';

    // 전체 합계
    var totalQty = 0, totalRolls = 0;
    list.forEach(function(m) {
      if (isFabric) totalRolls += (m.rolls || 0);
      else          totalQty   += (m.qty   || 0);
    });
    var totalTxt = isFabric ? (totalRolls + '롤') : (totalQty + '개');

    var rows = list.map(function(m, idx) {
      var qty = isFabric
        ? (m.rolls + '롤/' + m.weight + 'kg' + (m.meters ? '/' + m.meters + 'm' : ''))
        : (m.qty + '개');
      var tag = m.kind === 'hwanjip' ? '<span class="hj-tag">환입</span>' : '';
      var poTag = m.po ? ' · <span style="background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">PO:' + m.po + '</span>' : '';

      return '<div class="fifo-row ra-fifo-row" data-id="' + m.id + '" style="cursor:pointer">' +
        '<div class="fifo-n">' + (idx + 1) + '</div>' +
        '<div class="fifo-info">' +
          '<div class="fifo-name">' + (m.name || m.code) + tag + '</div>' +
          '<div class="fifo-sub">📍 ' + (m.loc || '-') + ' · ' + qty + (m.lot ? ' · Lot:' + m.lot : '') + poTag + '</div>' +
        '</div>' +
        '<div class="fifo-dt">' + m.date + '</div>' +
      '</div>';
    }).join('');

    wrap.innerHTML =
      '<div class="fifo-box">' +
        '<div class="fifo-hd" style="display:flex;justify-content:space-between;align-items:center">' +
          '<span>재고 현황 (환입 우선 · 날짜순) — 탭해서 선택</span>' +
          '<span style="font-size:13px;font-weight:700;color:var(--txt)">총 ' + totalTxt + '</span>' +
        '</div>' +
        rows +
      '</div>';

    wrap.querySelectorAll('.ra-fifo-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var id    = parseInt(this.dataset.id);
        var found = list.find(function(m){ return m.id === id; });
        if (!found) return;
        wrap.querySelectorAll('.ra-fifo-row').forEach(function(r){ r.classList.remove('selected'); });
        this.classList.add('selected');
        selectedRaFifo = found;
        var maxVal = isFabric ? (found.rolls || 0) : (found.qty || 0);
        var unit   = isFabric ? '롤' : '개';
        document.getElementById('ra-max-hint').textContent = '선택된 항목: ' + maxVal + unit + (found.po ? ' · PO:' + found.po : '');
        document.getElementById('ra-max-btn').style.display = 'block';
      });
    });

    var qtyInput = document.getElementById('ra-qty');
    var firstQty = isFabric ? (list[0].rolls || 0) : (list[0].qty || 0);
    var unit     = isFabric ? '롤' : '개';
    qtyInput.placeholder = '최대 ' + firstQty + unit;

    document.getElementById('ra-max-btn').style.display = 'none';
    document.getElementById('ra-max-hint').textContent = '';

    if (list.length) wrap.querySelectorAll('.ra-fifo-row')[0].click();

  } catch(e) { showToast('재고 조회 오류'); }
}


// ═══════════════════════════════════════════
// 생산팀: MAX 버튼
// ═══════════════════════════════════════════
function setRaMax() {
  if (!selectedRaFifo) { showToast('먼저 항목을 선택하세요'); return; }
  var isFabric = selectedRaFifo.item_type === 'fabric';
  document.getElementById('ra-qty').value = isFabric
    ? (selectedRaFifo.rolls || 0)
    : (selectedRaFifo.qty   || 0);
}


// ═══════════════════════════════════════════
// 생산팀: 불출 신청 초기화 (완전 초기화)
// ═══════════════════════════════════════════
function resetRequest() {
  selectedRaItem = null;
  selectedRaFifo = null;
  // 1단계부터 완전 초기화
  document.getElementById('ra-suffix').value = '';
  document.getElementById('ra-step2').style.display = 'none';
  document.getElementById('ra-step3').style.display = 'none';
  document.getElementById('ra-fifo-wrap').innerHTML = '';
  document.getElementById('ra-item-list').innerHTML = '';
  ['ra-qty','ra-note'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('ra-qty').placeholder = '0';
  document.getElementById('ra-date').value = TODAY;
  var maxBtn = document.getElementById('ra-max-btn');
  if (maxBtn) maxBtn.style.display = 'none';
  var maxHint = document.getElementById('ra-max-hint');
  if (maxHint) maxHint.textContent = '';
  selectRaFloor(2);
}


// ═══════════════════════════════════════════
// 생산팀: 불출 신청 제출
// ═══════════════════════════════════════════
async function submitRequest() {
  if (!selectedRaItem) { showToast('품목을 먼저 선택하세요'); return; }

  var qty  = parseFloat(document.getElementById('ra-qty').value) || 0;
  var date = document.getElementById('ra-date').value;
  var note = document.getElementById('ra-note').value;

  if (!qty) { showToast('수량을 입력하세요'); return; }

  try {
    var res  = await fetch(API + '/request', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code    : selectedRaItem.code,
        name    : selectedRaItem.name,
        fifo_id : selectedRaFifo ? selectedRaFifo.id : null,
        fifo_po : selectedRaFifo ? (selectedRaFifo.po || '') : '',
        floor   : document.getElementById('ra-floor').value,
        qty, date, note
      })
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 불출 신청 완료! 자재팀 확인 후 처리됩니다');
      resetRequest();  // 완전 초기화
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) { showToast('서버 연결 오류'); }
}


// ═══════════════════════════════════════════
// 생산팀: 내 신청 현황 조회
// ═══════════════════════════════════════════
async function loadReqStatus() {
  var list = document.getElementById('req-status-list');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  var dateFilter = document.getElementById('rs-date') ? document.getElementById('rs-date').value : '';

  try {
    var params = new URLSearchParams();
    if (dateFilter) params.set('date', dateFilter);
    var res = await fetch(API + '/my-requests?' + params, { credentials: 'include'});
    var json = await res.json();
    var reqs = json.data || [];

    if (!reqs.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">신청 내역이 없습니다</p>';
      return;
    }

    list.innerHTML = reqs.map(function(r) {
      var st = reqStatusLabel(r.status);
      var extra = '';
      if (r.status === 'confirmed') {
        extra = '<div style="font-size:12px;color:#166534;margin-top:4px">✓ 확정 수량: ' + r.qty + '개 · ' + (r.confirmed_by || '') + ' · ' + (r.confirmed_at || '') + '</div>';
        if (r.from_loc) extra += '<div style="font-size:12px;color:var(--txt2)">📍 ' + r.from_loc + '</div>';
      } else if (r.status === 'rejected') {
        extra = '<div style="font-size:12px;color:#dc2626;margin-top:4px">✕ 반려 사유: ' + (r.reason || '-') + '</div>';
      }

      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:14px;font-weight:600;color:var(--txt)">' + (r.name || r.code || '-') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + (r.code || '') + ' · 신청 ' + r.qty + '개' + (r.floor ? ' · 🏢 ' + r.floor + '층' : '') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">📅 ' + (r.date || r.created || '') + (r.note ? ' · ' + r.note : '') + '</div>' +
            extra +
          '</div>' +
          '<span style="font-size:11px;padding:3px 8px;border-radius:6px;font-weight:600;background:' + st.bg + ';color:' + st.color + ';flex-shrink:0;margin-left:8px">' + st.text + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0">서버 연결 오류</p>';
  }
}


// ═══════════════════════════════════════════
// 자재팀: 불출 요청 목록 조회
// ═══════════════════════════════════════════
async function loadReqManage() {
  var list   = document.getElementById('req-manage-list');
  var status = document.querySelector('.req-tab.on')?.dataset.status || 'pending';
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    var res  = await fetch(API + '/requests?status=' + status, { credentials: 'include' });
    var json = await res.json();
    var reqs = json.data || [];

    // 통계
    var allRes  = await fetch(API + '/requests?status=all', { credentials: 'include' });
    var allJson = await allRes.json();
    var allReqs = allJson.data || [];
    var today   = new Date().toISOString().slice(0,10);
    document.getElementById('rm-pending')  .textContent = allReqs.filter(function(r){ return r.status === 'pending'; }).length;
    document.getElementById('rm-confirmed').textContent = allReqs.filter(function(r){ return r.status === 'confirmed' && r.confirmed_at === today; }).length;

    if (!reqs.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">해당 항목 없음</p>';
      return;
    }

    list.innerHTML = reqs.map(function(r) {
      var st   = reqStatusLabel(r.status);
      var btns = '';
      if (r.status === 'pending') {
        btns = '<div style="display:flex;gap:8px;margin-top:10px">' +
          '<button class="req-confirm-btn" data-id="' + r.id + '" data-qty="' + r.qty + '" data-name="' + (r.name || r.code) + '" data-code="' + (r.code || '') + '" data-floor="' + (r.floor || '') + '" data-fipo="' + (r.fifo_po || '') + '" ' +
            'style="flex:1;padding:8px;font-size:13px;font-weight:600;background:#1a1a1a;color:#fff;border:none;border-radius:8px;cursor:pointer">불출 확인</button>' +
          '<button class="req-reject-btn" data-id="' + r.id + '" ' +
            'style="flex:1;padding:8px;font-size:13px;font-weight:600;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;cursor:pointer">반려</button>' +
        '</div>';
      }

      var extra = '';
      if (r.status === 'confirmed') {
        extra = '<div style="font-size:12px;color:#166534;margin-top:4px">✓ 확정 ' + r.qty + '개 · ' + (r.confirmed_by || '') + ' · ' + (r.confirmed_at || '') + '</div>';
        if (r.from_loc) extra += '<div style="font-size:12px;color:var(--txt2)">📍 ' + r.from_loc + '</div>';
      } else if (r.status === 'rejected') {
        extra = '<div style="font-size:12px;color:#dc2626;margin-top:4px">✕ ' + (r.reason || '') + '</div>';
      }

      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:14px;font-weight:600;color:var(--txt)">' + (r.name || r.code || '-') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + (r.code || '') + ' · 신청 ' + r.qty + '개' + (r.floor ? ' · 🏢 ' + r.floor + '층' : '') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">👤 ' + (r.requested_name || '') + ' · ' + (r.date || r.created || '') + '</div>' +
            (r.note ? '<div style="font-size:12px;color:var(--txt2);margin-top:2px">📝 ' + r.note + '</div>' : '') +
            extra +
          '</div>' +
          '<span style="font-size:11px;padding:3px 8px;border-radius:6px;font-weight:600;background:' + st.bg + ';color:' + st.color + ';flex-shrink:0;margin-left:8px">' + st.text + '</span>' +
        '</div>' +
        btns +
      '</div>';
    }).join('');

    // 확정 버튼 - 잠금 포함
    document.querySelectorAll('.req-confirm-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var reqId   = parseInt(this.dataset.id);
        var reqQty  = this.dataset.qty;
        var reqCode = this.dataset.code;
        var reqName = this.dataset.name;

        // 잠금 확인
        try {
          var lockRes  = await fetch(API + '/lock/REQ_' + reqId, { credentials: 'include' });
          var lockJson = await lockRes.json();
          if (lockJson.locked && lockRes.name !== currentUser.name) {
            showReqLockBanner(lockJson.name);
            return;
          }
        } catch(e) {}

        // 잠금 등록
        await setReqLock(reqId, currentUser ? currentUser.name : '');
        confirmingRequestId = reqId;

        var reqFloor = this.dataset.floor;
        document.getElementById('confirm-qty').value = reqQty;
        document.getElementById('confirm-modal-info').textContent = reqName + ' · 신청 ' + reqQty + '개';
        // 배달 층수 표시
        var floorEl = document.getElementById('confirm-floor-info');
        if (floorEl) {
          if (reqFloor) {
            floorEl.style.display = 'block';
            floorEl.textContent = '🏢 현장 위치: ' + reqFloor + '층';
          } else {
            floorEl.style.display = 'none';
          }
        }
        document.getElementById('confirm-modal').style.display = 'flex';
        loadConfirmFifo(reqCode, this.dataset.fipo);
      });
    });

    // 반려 버튼
    document.querySelectorAll('.req-reject-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var reqId = parseInt(this.dataset.id);
        // 잠금 확인
        try {
          var lockRes  = await fetch(API + '/lock/REQ_' + reqId, { credentials: 'include'});
          var lockJson = await lockRes.json();
          if (lockJson.locked && lockJson.name !== currentUser.name) {
            showReqLockBanner(lockJson.name);
            return;
          }
        } catch(e) {}
        // 잠금 등록
        await setReqLock(reqId, currentUser ? currentUser.name : '');
        rejectingRequestId = reqId;
        document.getElementById('reject-reason').value = '';
        document.getElementById('reject-modal').style.display = 'flex';
      });
    });

    // 확정 모달 X 버튼 -> 잠금 즉시 해제
    document.getElementById('btn-confirm-cancel').onclick = function() {
      if (confirmingRequestId) clearReqLock(confirmingRequestId);
      confirmingRequestId = null;
      document.getElementById('confirm-modal').style.display = 'none';
    };

    // 확정 모달 확인
    document.getElementById('btn-confirm-ok').onclick = async function() {
      if (!confirmingRequestId) return;
      var qty = parseFloat(document.getElementById('confirm-qty').value) || 0;
      if (!qty) { showToast('수량을 입력하세요'); return; }
      if (!selectedConfirmFifo) { showToast('위치를 선택하세요'); return; }
      var fromId  = selectedConfirmFifo.id;
      var fromLoc = selectedConfirmFifo.loc || '';
      try {
        var res  = await fetch(API + '/request/' + confirmingRequestId, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qty, from_id: fromId, from_loc: fromLoc })
        });
        var json = await res.json();
        if (json.success) {
          await clearReqLock(confirmingRequestId);  // 잠금 해제
          document.getElementById('confirm-modal').style.display = 'none';
          showToast('✓ 불출 확정 완료!');
          confirmingRequestId = null;
          loadReqManage();
        } else { showToast('오류: ' + json.message); }
      } catch(e) { showToast('서버 연결 오류'); }
    };

    // 반려 모달 확인
    document.getElementById('btn-reject-ok').onclick = async function() {
      if (!rejectingRequestId) return;
      var reason = document.getElementById('reject-reason').value.trim();
      if (!reason) { showToast('반려 사유를 입력하세요'); return; }
      try {
        var res  = await fetch(API + '/request/' + rejectingRequestId + '/reject', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });
        var json = await res.json();
        if (json.success) {
          document.getElementById('reject-modal').style.display = 'none';
          showToast('반려 처리됐습니다');
          rejectingRequestId = null;
          loadReqManage();
        } else { showToast('오류: ' + json.message); }
      } catch(e) { showToast('서버 연결 오류'); }
    };

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0">서버 연결 오류</p>';
  }
}


// ═══════════════════════════════════════════
// 생산팀: 재고 현황 (읽기 전용)
// ═══════════════════════════════════════════
async function loadProdStock() {
  var q    = document.getElementById('ps-q').value.trim();
  var list = document.getElementById('prod-stock-list');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    var params = new URLSearchParams();
    if (q)            params.set('q',   q);
    if (currentPsCat) params.set('cat', currentPsCat);

    var res  = await fetch(API + '/inventory?' + params, { credentials: 'include' });
    var json = await res.json();
    var items = json.data || [];

    document.getElementById('ps-total').textContent = json.total_in || 0;
    document.getElementById('ps-today').textContent = json.today_in || 0;

    if (!items.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">항목 없음</p>';
      return;
    }

    var groups = {}, groupOrder = [];
    items.slice().reverse().forEach(function(item) {
      var key = item.code || item.name || 'unknown';
      if (!groups[key]) {
        groups[key] = { items: [], name: item.name, code: item.code, cat: item.cat, totalQty: 0, totalRolls: 0 };
        groupOrder.push(key);
      }
      groups[key].items.push(item);
      if (item.item_type === 'fabric') groups[key].totalRolls += (item.rolls || 0);
      else                             groups[key].totalQty   += (item.qty   || 0);
    });

    list.innerHTML = groupOrder.map(function(key, gi) {
      var g        = groups[key];
      var isFabric = g.items[0].item_type === 'fabric';
      var totalTxt = isFabric ? (g.totalRolls + '롤') : (g.totalQty + '개');
      var catLabel = g.cat ? '<span class="cat-lbl cl-' + g.cat + '">' + g.cat + '</span>' : '';

      var rows = g.items.map(function(item) {
        var qtyTxt    = isFabric ? (item.rolls + '롤/' + item.weight + 'kg') : (item.qty + '개');
        var kindBadge = item.kind === 'hwanjip' ? '<span class="hj-tag" style="margin-left:4px">환입</span>' : '';
        var poTag     = item.po ? ' · <span style="background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">PO:' + item.po + '</span>' : '';
        return '<div style="padding:10px 0;border-top:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between">' +
            '<div style="font-size:12px;color:var(--txt2)">📍 ' + (item.loc || '-') + ' · ' + item.date + kindBadge + poTag + '</div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--txt)">' + qtyTxt + '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleProdGroup(' + gi + ')">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:14px;font-weight:600;color:var(--txt)">' + (g.name || '-') + catLabel + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + (g.code || '') + ' · ' + g.items.length + '건</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
            '<div style="font-size:16px;font-weight:700;color:var(--txt)">' + totalTxt + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px" id="ps-arrow-' + gi + '">▼ 펼치기</div>' +
          '</div>' +
        '</div>' +
        '<div id="ps-detail-' + gi + '" style="display:none">' + rows + '</div>' +
      '</div>';
    }).join('');

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0">서버에 연결할 수 없습니다</p>';
  }
}

function toggleProdGroup(gi) {
  var detail = document.getElementById('ps-detail-' + gi);
  var arrow  = document.getElementById('ps-arrow-'  + gi);
  if (!detail) return;
  var open = detail.style.display === 'block';
  detail.style.display = open ? 'none' : 'block';
  arrow.textContent    = open ? '▼ 펼치기' : '▲ 접기';
}


// ═══════════════════════════════════════════
// 자재팀: 확정 모달 FIFO 목록 로드
// ═══════════════════════════════════════════
var confirmFifoList     = [];
var selectedConfirmFifo = null;

async function loadConfirmFifo(code, filterPo) {
  var wrap = document.getElementById('confirm-fifo-list');
  wrap.innerHTML = '<div style="font-size:13px;color:var(--txt2);padding:8px 0">재고 조회 중...</div>';
  confirmFifoList     = [];
  selectedConfirmFifo = null;

  if (!code) { wrap.innerHTML = ''; return; }

  try {
    var res  = await fetch(API + '/fifo?code=' + encodeURIComponent(code), { credentials: 'include' });
    var json = await res.json();
    var allList = json.data || [];

    // PO 번호 있으면 해당 PO 항목만 필터링
    if (filterPo) {
      confirmFifoList = allList.filter(function(m){ return m.po === filterPo; });
      if (!confirmFifoList.length) confirmFifoList = allList; // 없으면 전체
    } else {
      confirmFifoList = allList;
    }

    if (!confirmFifoList.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:#dc2626;padding:8px 0">재고 없음</p>';
      return;
    }

    var isFabric = confirmFifoList[0].item_type === 'fabric';

    wrap.innerHTML = confirmFifoList.map(function(m, idx) {
      var qty = isFabric
        ? (m.rolls + '롤/' + m.weight + 'kg' + (m.meters ? '/' + m.meters + 'm' : ''))
        : (m.qty + '개');
      var tag = m.kind === 'hwanjip' ? '<span class="hj-tag" style="margin-left:4px">환입</span>' : '';

      return '<div class="confirm-fifo-row" data-idx="' + idx + '" ' +
        'style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;cursor:pointer;background:var(--card)">' +
        '<div style="min-width:0;flex:1">' +
          '<div style="font-size:13px;font-weight:600;color:var(--txt)">📍 ' + (m.loc || '-') + tag + '</div>' +
          '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + m.date + (m.lot ? ' · Lot:' + m.lot : '') + '</div>' +
          (m.po ? '<div style="margin-top:4px"><span style="background:#fef9c3;color:#854d0e;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600">PO: ' + m.po + '</span></div>' : '') +
        '</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--txt);flex-shrink:0;margin-left:8px">' + qty + '</div>' +
      '</div>';
    }).join('');

    wrap.querySelectorAll('.confirm-fifo-row').forEach(function(row) {
      row.addEventListener('click', function() {
        wrap.querySelectorAll('.confirm-fifo-row').forEach(function(r){
          r.style.borderColor = 'var(--border)';
          r.style.background  = 'var(--card)';
        });
        this.style.borderColor = '#0a84ff';
        this.style.background  = 'var(--blue-bg)';
        var idx = parseInt(this.dataset.idx);
        selectedConfirmFifo = confirmFifoList[idx];
        var isFabric = selectedConfirmFifo.item_type === 'fabric';
        document.getElementById('confirm-qty').value = isFabric
          ? (selectedConfirmFifo.rolls || 0)
          : (selectedConfirmFifo.qty   || 0);
      });
    });

    if (wrap.querySelectorAll('.confirm-fifo-row').length) {
      wrap.querySelectorAll('.confirm-fifo-row')[0].click();
    }

  } catch(e) {
    wrap.innerHTML = '<p style="font-size:13px;color:#dc2626;padding:8px 0">재고 조회 오류</p>';
  }
}

function setConfirmMax() {
  if (!selectedConfirmFifo) { showToast('먼저 위치를 선택하세요'); return; }
  var isFabric = selectedConfirmFifo.item_type === 'fabric';
  document.getElementById('confirm-qty').value = isFabric
    ? (selectedConfirmFifo.rolls || 0)
    : (selectedConfirmFifo.qty   || 0);
}


// ═══════════════════════════════════════════
// 생산팀: 층수 선택 토글
// ═══════════════════════════════════════════
function selectRaFloor(floor) {
  document.getElementById('ra-floor').value = floor;
  var f2 = document.getElementById('ra-floor-2');
  var f3 = document.getElementById('ra-floor-3');
  if (!f2 || !f3) return;
  if (floor === 2 || floor === '2') {
    f2.style.background = '#1a1a1a'; f2.style.color = '#fff'; f2.style.borderColor = '#1a1a1a';
    f3.style.background = 'var(--card)'; f3.style.color = 'var(--txt2)'; f3.style.borderColor = 'var(--border2)';
  } else {
    f3.style.background = '#1a1a1a'; f3.style.color = '#fff'; f3.style.borderColor = '#1a1a1a';
    f2.style.background = 'var(--card)'; f2.style.color = 'var(--txt2)'; f2.style.borderColor = 'var(--border2)';
  }
}
