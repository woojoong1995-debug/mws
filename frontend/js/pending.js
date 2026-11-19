// ═══════════════════════════════════════════
// 입고 대기 목록 & 업체·카테고리별 파레트 분할 적치
// ═══════════════════════════════════════════
var pendingListCache      = [];
var ocrParsedRows         = [];
var receivingItem         = null;
var selectedPendingGroup  = null; // 현재 열어본 '업체||예정일' 키
var selectedPendingCat    = '';   // 업체 내부 카테고리 필터

async function loadPending() {
  var wrap = document.getElementById('pending-list');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    var res  = await fetch(API + '/pending', { credentials: 'include' });
    var json = await res.json();
    pendingListCache = json.data || [];

    var badge = document.getElementById('pending-nav-badge');
    if (badge) {
      badge.textContent = pendingListCache.length;
      badge.style.display = pendingListCache.length > 0 ? 'inline-block' : 'none';
    }

    renderPendingView();
  } catch (e) {
    wrap.innerHTML = '<p style="text-align:center;color:#dc2626;padding:24px 0">불러오기 오류</p>';
  }
}

// ── 1단계(업체·예정일별 폴더) / 2단계(업체 내 카테고리별 목록) 렌더링 ──
function renderPendingView() {
  var wrap = document.getElementById('pending-list');
  if (!wrap) return;

  if (!pendingListCache.length) {
    selectedPendingGroup = null;
    wrap.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:28px 0;font-size:14px">현재 입고 대기 중인 품목이 없습니다</p>';
    return;
  }

  // 업체 + 입고예정일 기준으로 그룹핑
  var groups = {};
  var groupOrder = [];
  pendingListCache.forEach(function(item) {
    var sup = (item.supplier || '').trim() || '업체 미지정';
    var dt  = (item.due_date || '').trim() || '날짜 미정';
    var key = sup + '||' + dt;
    if (!groups[key]) {
      groups[key] = { key: key, supplier: sup, due_date: dt, items: [], cats: {} };
      groupOrder.push(key);
    }
    groups[key].items.push(item);
    var c = item.cat || '기타';
    groups[key].cats[c] = (groups[key].cats[c] || 0) + 1;
  });

  // ── 2단계: 특정 업체 그룹 안으로 들어온 상태 ──
  if (selectedPendingGroup && groups[selectedPendingGroup]) {
    var grp = groups[selectedPendingGroup];
    var catKeys = Object.keys(grp.cats);
    if (selectedPendingCat && !grp.cats[selectedPendingCat]) {
      selectedPendingCat = '';
    }

    var filtered = selectedPendingCat
      ? grp.items.filter(function(i){ return (i.cat || '기타') === selectedPendingCat; })
      : grp.items;

    var catTabsHtml =
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px">' +
        '<button type="button" class="cat-btn ' + (selectedPendingCat === '' ? 'on' : '') + '" onclick="filterPendingCat(\'\')">전체 (' + grp.items.length + ')</button>' +
        catKeys.map(function(c) {
          var active = selectedPendingCat === c ? 'on' : '';
          return '<button type="button" class="cat-btn ' + active + '" onclick="filterPendingCat(\'' + c + '\')">' + c + ' (' + grp.cats[c] + ')</button>';
        }).join('') +
      '</div>';

    var headerHtml =
      '<div class="card" style="padding:14px 16px;margin-bottom:12px;border-left:4px solid var(--blue) !important">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<button type="button" onclick="closePendingGroup()" style="padding:7px 12px;border-radius:10px;border:1px solid var(--border2);background:var(--bg);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">← 업체 목록</button>' +
          '<div style="text-align:right">' +
            '<div style="font-size:16px;font-weight:800;color:var(--txt)">🏢 ' + grp.supplier + '</div>' +
            '<div style="font-size:12.5px;color:var(--txt2)">예정일: ' + grp.due_date + ' · 총 ' + grp.items.length + '건</div>' +
          '</div>' +
        '</div>' +
        catTabsHtml +
      '</div>';

    var cardsHtml = filtered.map(function(item) {
      var pct = item.total_qty > 0 ? Math.min(100, Math.round((item.received_qty / item.total_qty) * 100)) : 0;
      var catBadge = item.cat ? '<span class="cat-lbl cl-' + item.cat + '">' + item.cat + '</span>' : '';
      return '<div class="card" style="padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:15px;font-weight:700;color:var(--txt)">' + (item.name || item.code) + catBadge + '</div>' +
            '<div style="font-size:12.5px;color:var(--txt2);margin-top:3px">' +
              (item.code || '-') +
              (item.lot ? ' · Lot: <b>' + item.lot + '</b>' : '') +
              (item.po ? ' · PO: ' + item.po : '') +
            '</div>' +
          '</div>' +
          '<button type="button" onclick="deletePendingItem(' + item.id + ')" style="background:none;border:none;color:var(--txt2);font-size:16px;cursor:pointer;padding:2px 6px" title="대기 삭제">✕</button>' +
        '</div>' +

        '<div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div style="font-size:12.5px;color:var(--txt2)">' +
            '총 예정: <b>' + item.total_qty + item.unit + '</b> · 적치완료: <b style="color:#16a34a">' + item.received_qty + item.unit + '</b>' +
          '</div>' +
          '<div style="font-size:15px;font-weight:800;color:var(--blue)">' +
            '잔여 ' + item.remain_qty + item.unit +
          '</div>' +
        '</div>' +

        '<div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;margin-top:8px">' +
          '<div style="height:100%;width:' + pct + '%;background:var(--blue)"></div>' +
        '</div>' +

        '<button type="button" class="btn btn-dark" onclick="openReceiveModal(' + item.id + ')" style="margin-top:10px;padding:11px !important;font-size:14px">' +
          '📦 파레트 적치 / 부분 입고 처리' +
        '</button>' +
      '</div>';
    }).join('');

    wrap.innerHTML = headerHtml + cardsHtml;
    return;
  }

  // ── 1단계: 업체 · 예정일별 묶음 폴더 카드 목록 ──
  selectedPendingGroup = null;
  wrap.innerHTML = groupOrder.map(function(key) {
    var grp = groups[key];
    var catSummary = Object.keys(grp.cats).map(function(c) {
      return '<span class="cat-lbl cl-' + c + '" style="margin-left:0;margin-right:4px">' + c + ' ' + grp.cats[c] + '건</span>';
    }).join('');

    var totalItems = grp.items.length;
    var inProgress = grp.items.filter(function(i){ return (i.received_qty || 0) > 0; }).length;

    return '<div class="card" onclick="openPendingGroup(\'' + key.replace(/'/g, "\\'") + '\')" style="padding:16px;margin-bottom:10px;cursor:pointer;transition:transform .12s ease">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
        '<div style="min-width:0;flex:1">' +
          '<div style="font-size:16px;font-weight:800;color:var(--txt)">🏢 ' + grp.supplier + '</div>' +
          '<div style="font-size:13px;color:var(--txt2);margin-top:4px">' +
            '입고 예정일: <b>' + grp.due_date + '</b>' +
            (inProgress > 0 ? ' · <span style="color:var(--blue);font-weight:700">부분적치 ' + inProgress + '건 진행중</span>' : '') +
          '</div>' +
          '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">' + catSummary + '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' +
          '<div style="font-size:18px;font-weight:800;color:var(--blue)">' + totalItems + '건 ›</div>' +
          '<div style="font-size:11.5px;color:var(--txt2);margin-top:2px">눌러서 보기</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function openPendingGroup(key) {
  selectedPendingGroup = key;
  selectedPendingCat   = '';
  renderPendingView();
}

function closePendingGroup() {
  selectedPendingGroup = null;
  selectedPendingCat   = '';
  renderPendingView();
}

function filterPendingCat(cat) {
  selectedPendingCat = cat;
  renderPendingView();
}

// ── 수기 입고 대기 추가 ──
async function submitManualPending() {
  var code = document.getElementById('pd-code').value.trim().toUpperCase();
  var name = document.getElementById('pd-name').value.trim();
  var qty  = parseFloat(document.getElementById('pd-qty').value) || 0;
  var unit = document.getElementById('pd-unit').value;
  var lot  = document.getElementById('pd-lot').value.trim().toUpperCase();
  var sup  = document.getElementById('pd-supplier').value.trim();
  var dt   = document.getElementById('pd-date').value;

  if (!code && !name) { showToast('품번 또는 품목명을 입력하세요'); return; }
  if (qty <= 0)       { showToast('예정 수량을 입력하세요'); return; }

  try {
    var res = await fetch(API + '/pending', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, name: name, qty: qty, unit: unit, lot: lot, supplier: sup, due_date: dt })
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 입고 대기 등록 완료');
      ['pd-code','pd-name','pd-qty','pd-lot','pd-supplier'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.value = '';
      });
      loadPending();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch (e) {
    showToast('서버 연결 오류');
  }
}

// ── 거래명세서 사진 OCR 일괄 인식 ──
async function handleStatementOcr(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var btn = document.getElementById('btn-ocr-statement');
  btn.textContent = '🔄 명세서 AI 판독 중...';
  btn.disabled = true;

  try {
    var reader = new FileReader();
    reader.onload = async function() {
      var base64 = reader.result.split(',')[1];
      var res = await fetch(API + '/ocr/statement', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mime_type: file.type || 'image/jpeg' })
      });
      var json = await res.json();
      btn.textContent = '📷 거래명세서 촬영으로 일괄 대기 등록';
      btn.disabled = false;
      e.target.value = '';

      if (!json.success) {
        showToast('인식 실패: ' + (json.message || ''));
        return;
      }
      ocrParsedRows = json.items || [];
      renderOcrPreviewModal(json.supplier || '', json.due_date || todayStr());
    };
    reader.readAsDataURL(file);
  } catch (err) {
    btn.textContent = '📷 거래명세서 촬영으로 일괄 대기 등록';
    btn.disabled = false;
    showToast('OCR 오류');
  }
}

function renderOcrPreviewModal(supplier, dueDate) {
  var modal = document.getElementById('pending-ocr-modal');
  var body  = document.getElementById('pending-ocr-tbody');
  document.getElementById('pd-ocr-supplier').value = supplier;
  document.getElementById('pd-ocr-date').value     = dueDate;

  if (!ocrParsedRows.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px">인식된 품목이 없습니다</td></tr>';
  } else {
    body.innerHTML = ocrParsedRows.map(function(r, idx) {
      return '<tr>' +
        '<td><input type="text" value="' + (r.code || '') + '" onchange="ocrParsedRows[' + idx + '].code=this.value.toUpperCase()" style="padding:6px;font-size:12px"></td>' +
        '<td><input type="text" value="' + (r.name || '') + '" onchange="ocrParsedRows[' + idx + '].name=this.value" style="padding:6px;font-size:12px"></td>' +
        '<td><input type="number" value="' + (r.qty || 0) + '" onchange="ocrParsedRows[' + idx + '].qty=parseFloat(this.value)||0" style="padding:6px;font-size:12px;width:75px"></td>' +
        '<td><input type="text" value="' + (r.unit || '개') + '" onchange="ocrParsedRows[' + idx + '].unit=this.value" style="padding:6px;font-size:12px;width:55px"></td>' +
        '<td><button type="button" onclick="ocrParsedRows.splice(' + idx + ',1);renderOcrPreviewModal(document.getElementById(\'pd-ocr-supplier\').value, document.getElementById(\'pd-ocr-date\').value)" style="background:none;border:none;color:#dc2626;cursor:pointer">✕</button></td>' +
      '</tr>';
    }).join('');
  }
  modal.style.display = 'flex';
}

async function confirmOcrPendingBatch() {
  if (!ocrParsedRows.length) { showToast('등록할 항목이 없습니다'); return; }
  var sup = document.getElementById('pd-ocr-supplier').value.trim();
  var dt  = document.getElementById('pd-ocr-date').value;
  var payload = ocrParsedRows.map(function(r) {
    return Object.assign({}, r, { supplier: sup, due_date: dt });
  });

  try {
    var res = await fetch(API + '/pending', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload })
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ ' + json.added + '건 입고 대기 등록 완료!');
      document.getElementById('pending-ocr-modal').style.display = 'none';
      loadPending();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch (e) {
    showToast('서버 연결 오류');
  }
}

// ── 파레트별 분할 적치 모달 ──
function openReceiveModal(id) {
  var item = pendingListCache.find(function(x){ return x.id === id; });
  if (!item) return;
  receivingItem = item;

  var autoLot = (item.lot || item.similar_id || '').trim().toUpperCase();

  document.getElementById('rcv-title').textContent = (item.name || item.code);
  document.getElementById('rcv-sub').textContent   = (item.code || '') + ' · 남은 대기 수량: ' + item.remain_qty + item.unit;
  document.getElementById('rcv-qty').value         = '';
  document.getElementById('rcv-qty').placeholder   = '예: 480 (최대 ' + item.remain_qty + ')';
  document.getElementById('rcv-lot').value         = autoLot;
  document.getElementById('rcv-po').value          = item.po || '';
  document.getElementById('rcv-date').value        = todayStr();
  document.getElementById('rcv-note').value        = item.note || '';
  document.getElementById('rcv-wh').value          = '';
  updateWh('rcv');

  document.getElementById('receive-modal').style.display = 'flex';
}

function setRcvAllQty() {
  if (!receivingItem) return;
  document.getElementById('rcv-qty').value = receivingItem.remain_qty;
}

async function submitReceivePart() {
  if (!receivingItem) return;
  var wh  = document.getElementById('rcv-wh').value;
  var loc = buildLoc('rcv');
  var qty = parseFloat(document.getElementById('rcv-qty').value) || 0;

  if (!wh)       { showToast('창고를 선택하세요'); return; }
  if (!loc)      { showToast('보관 위치를 모두 선택하세요'); return; }
  if (qty <= 0)  { showToast('적치할 수량을 입력하세요'); return; }

  try {
    var res = await fetch(API + '/pending/' + receivingItem.id + '/receive', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wh  : wh,
        loc : loc,
        qty : qty,
        lot : document.getElementById('rcv-lot').value.trim().toUpperCase(),
        po  : document.getElementById('rcv-po').value.trim(),
        date: document.getElementById('rcv-date').value,
        note: document.getElementById('rcv-note').value
      })
    });
    var json = await res.json();
    if (json.success) {
      document.getElementById('receive-modal').style.display = 'none';
      if (json.completed) {
        showToast('✓ 전량 적치 완료! 입고 대기가 종료되었습니다.');
      } else {
        showToast('✓ ' + qty + receivingItem.unit + ' 적치 완료! (남은 대기: ' + json.remain_qty + receivingItem.unit + ')');
      }
      loadPending();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch (e) {
    showToast('서버 연결 오류');
  }
}

async function deletePendingItem(id) {
  if (!confirm('이 입고 대기 항목을 삭제할까요?')) return;
  try {
    var res = await fetch(API + '/pending/' + id, { method: 'DELETE', credentials: 'include' });
    var json = await res.json();
    if (json.success) { showToast('✓ 삭제 완료'); loadPending(); }
  } catch (e) {}
}