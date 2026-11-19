// ═══════════════════════════════════════════
// 입고 대기 목록 & 파레트별 분할 적치
// ═══════════════════════════════════════════
var pendingListCache = [];
var ocrParsedRows    = [];
var receivingItem    = null;

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

    if (!pendingListCache.length) {
      wrap.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:28px 0;font-size:14px">현재 입고 대기 중인 품목이 없습니다</p>';
      return;
    }

    wrap.innerHTML = pendingListCache.map(function(item) {
      var pct = item.total_qty > 0 ? Math.min(100, Math.round((item.received_qty / item.total_qty) * 100)) : 0;
      var catBadge = item.cat ? '<span class="cat-lbl cl-' + item.cat + '">' + item.cat + '</span>' : '';
      return '<div class="card" style="padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:15px;font-weight:700;color:var(--txt)">' + (item.name || item.code) + catBadge + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:3px">' +
              (item.code || '-') +
              (item.supplier ? ' · 업체: <b>' + item.supplier + '</b>' : '') +
              (item.due_date ? ' · 예정일: ' + item.due_date : '') +
            '</div>' +
            (item.lot ? '<div style="font-size:12px;color:var(--txt2);margin-top:2px">Lot: <b>' + item.lot + '</b></div>' : '') +
          '</div>' +
          '<button type="button" onclick="deletePendingItem(' + item.id + ')" style="background:none;border:none;color:var(--txt2);font-size:16px;cursor:pointer;padding:2px 6px" title="대기 삭제">✕</button>' +
        '</div>' +

        '<div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div style="font-size:12px;color:var(--txt2)">' +
            '총 예정: <b>' + item.total_qty + item.unit + '</b> · 적치완료: <b style="color:#16a34a">' + item.received_qty + item.unit + '</b>' +
          '</div>' +
          '<div style="font-size:15px;font-weight:800;color:var(--blue)">' +
            '잔여 ' + item.remain_qty + item.unit +
          '</div>' +
        '</div>' +

        '<div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;margin-top:8px">' +
          '<div style="height:100%;width:' + pct + '%;background:var(--blue)"></div>' +
        '</div>' +

        '<button type="button" class="btn btn-dark" onclick="openReceiveModal(' + item.id + ')" style="margin-top:10px;padding:10px !important;font-size:14px">' +
          '📦 파레트 적치 / 부분 입고 처리' +
        '</button>' +
      '</div>';
    }).join('');
  } catch (e) {
    wrap.innerHTML = '<p style="text-align:center;color:#dc2626;padding:24px 0">불러오기 오류</p>';
  }
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

  document.getElementById('rcv-title').textContent = (item.name || item.code);
  document.getElementById('rcv-sub').textContent   = (item.code || '') + ' · 남은 대기 수량: ' + item.remain_qty + item.unit;
  document.getElementById('rcv-qty').value         = '';
  document.getElementById('rcv-qty').placeholder   = '예: 480 (최대 ' + item.remain_qty + ')';
  document.getElementById('rcv-lot').value         = item.lot || '';
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