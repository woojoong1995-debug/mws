// ═══════════════════════════════════════════
// 불출: 품번 끝자리로 품목 검색
// ═══════════════════════════════════════════
async function searchBySuffix() {
  var suffix = document.getElementById('dp-suffix').value.trim();

  // 이전 결과 초기화
  document.getElementById('dp-step2').style.display = 'none';
  document.getElementById('dp-step3').style.display = 'none';
  selectedDpItem   = null;
  selectedFifoItems = [];

  if (suffix.length < 2) return;

  try {
    var res     = await fetch(API + '/fifo?code=' + encodeURIComponent(suffix));
    var json    = await res.json();
    var matches = json.data || [];

    if (!matches.length) {
      document.getElementById('dp-step2').style.display = 'block';
      document.getElementById('dp-item-list').innerHTML = '<p style="text-align:center;color:var(--txt2);padding:16px 0;font-size:14px">해당 품번 없음</p>';
      return;
    }

    // 품번 기준 중복 제거 (대표 항목만)
    var seen = {};
    var unique = [];
    matches.forEach(function(m) {
      if (m.code && !seen[m.code]) {
        seen[m.code] = true;
        unique.push(m);
      }
    });

    // 1개면 바로 3단계로
    if (unique.length === 1) {
      selectDpItem(unique[0]);
      return;
    }

    // 여러 개면 선택 목록 표시
    document.getElementById('dp-step2').style.display = 'block';
    document.getElementById('dp-item-list').innerHTML = unique.map(function(item) {
      return '<div class="dp-item-card" data-code="' + item.code + '" style="padding:12px;border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:8px;cursor:pointer;background:var(--card);color:var(--txt)">' +
        '<div style="font-size:14px;font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
        '<div style="font-size:12px;color:var(--txt2);margin-top:3px">' + item.code + '</div>' +
        '</div>';
    }).join('');

    // 품목 카드 클릭 이벤트
    document.querySelectorAll('.dp-item-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var code = this.dataset.code;
        var found = unique.find(function(u){ return u.code === code; });
        if (found) selectDpItem(found);
      });
    });

  } catch(e) {
    showToast('서버 연결 오류');
  }
}


// ═══════════════════════════════════════════
// 불출: 품목 선택 → FIFO 목록 표시
// ═══════════════════════════════════════════
async function selectDpItem(item) {
  // 잠금 확인
  try {
    var lockRes = await fetch(API + '/lock/' + encodeURIComponent(item.code), { credentials: 'include' });
    var lockJson = await lockRes.json();
    if (lockJson.locked) {
      showToast('⚠️ ' + lockJson.name + ' 님이 작업 중입니다!');
      return;
    }
  } catch(e) {}
  // 잠금 등록
  fetch(API + '/lock', {
    method: 'POST', credentials: 'include',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ code: item.code })
  });

  selectedDpItem   = item;
  selectedFifoItems = [];

  document.getElementById('dp-step2').style.display = 'none';
  document.getElementById('dp-step3').style.display = 'block';

  // 선택된 품목 정보 표시
  document.getElementById('dp-selected-info').innerHTML =
    '<div style="font-size:13px;font-weight:600;color:var(--blue)">' + (item.name || '-') + '</div>' +
    '<div style="font-size:12px;color:var(--blue);margin-top:2px;opacity:.8">' + item.code + '</div>';

  // 품목 유형 자동 세팅
  setType('dp', (item.item_type === 'fabric' || item.itemType === 'fabric') ? 'fabric' : 'normal');

  // FIFO 순서 조회
  try {
    var res  = await fetch(API + '/fifo?code=' + encodeURIComponent(item.code), { credentials: 'include' });
    var json = await res.json();
    var list = json.data || [];

    var wrap = document.getElementById('dp-fifo-wrap');
    if (!list.length) { wrap.innerHTML = ''; return; }

    selectedFifoItems = [];

    // FIFO 목록 렌더링 (다중 선택)
    var rows = list.map(function(m, idx) {
      var qty  = m.item_type === 'fabric' ? (m.rolls + '롤/' + m.weight + 'kg' + (m.meters ? '/' + m.meters + 'm' : '')) : (m.qty + '개');
      var tag  = m.kind === 'hwanjip' ? '<span class="hj-tag">환입</span>' : '';
      var poTag = m.po ? ' · <span style="background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">PO:' + m.po + '</span>' : '';
      return '<div class="fifo-row" data-id="' + m.id + '" style="display:flex;align-items:center;gap:8px">' +
        '<input type="checkbox" class="fifo-chk" data-id="' + m.id + '" style="width:18px;height:18px;cursor:pointer;flex-shrink:0">' +
        '<div class="fifo-n">' + (idx + 1) + '</div>' +
        '<div class="fifo-info" style="flex:1">' +
          '<div class="fifo-name">' + (m.name || m.code) + tag + '</div>' +
          '<div class="fifo-sub">📍 ' + (m.loc || '-') + ' · ' + qty + (m.lot ? ' · Lot:' + m.lot : '') + poTag + '</div>' +
        '</div>' +
        '<div class="fifo-dt">' + m.date + '</div>' +
      '</div>';
    }).join('');

    wrap.innerHTML =
      '<div class="fifo-box">' +
        '<div class="fifo-hd" style="display:flex;justify-content:space-between;align-items:center">' +
          '<span>선입선출 순서 — 체크해서 선택</span>' +
          '<span id="dp-selected-count" style="font-size:12px;color:var(--txt2)">0개 선택</span>' +
        '</div>' +
        rows +
      '</div>';

    // 체크박스 클릭 이벤트
    wrap.querySelectorAll('.fifo-chk').forEach(function(chk) {
      chk.addEventListener('change', function() {
        var id    = parseInt(this.dataset.id);
        var found = list.find(function(m){ return m.id === id; });
        if (!found) return;

        if (this.checked) {
          selectedFifoItems.push(found);
          this.closest('.fifo-row').classList.add('selected');
        } else {
          selectedFifoItems = selectedFifoItems.filter(function(m){ return m.id !== id; });
          this.closest('.fifo-row').classList.remove('selected');
        }

        // 선택 개수 표시
        var countEl = document.getElementById('dp-selected-count');
        if (countEl) countEl.textContent = selectedFifoItems.length + '개 선택';

        // 선택된 항목들 합계 자동 입력
        var totalQty = 0, totalRolls = 0, totalWeight = 0, totalMeters = 0;
        var isFabric = selectedFifoItems.length > 0 && selectedFifoItems[0].item_type === 'fabric';
        selectedFifoItems.forEach(function(m) {
          if (isFabric) { totalRolls += (m.rolls || 0); totalWeight += (m.weight || 0); totalMeters += (m.meters || 0); }
          else          { totalQty   += (m.qty   || 0); }
        });

        if (isFabric) {
          document.getElementById('dp-rolls').value   = totalRolls;
          document.getElementById('dp-weight').value  = totalWeight;
          document.getElementById('dp-meters').value  = totalMeters;
        } else {
          document.getElementById('dp-qty').value = totalQty;
        }

        // 선택한 항목이 있으면 3단계 표시
        if (selectedFifoItems.length > 0) {
          document.getElementById('dp-step3').style.display = 'block';
        }
      });
    });

    // 1번 자동 선택
    if (list.length) {
      wrap.querySelectorAll('.fifo-row')[0].click();
    }

  } catch(e) {
    showToast('FIFO 조회 오류');
  }
}


// ═══════════════════════════════════════════
// 불출: MAX 버튼 (선택된 항목 전량)
// ═══════════════════════════════════════════
function setMaxQty() {
  if (!selectedFifoItems || selectedFifoItems.length === 0) { showToast('먼저 항목을 선택하세요'); return; }
  var totalQty = 0, totalRolls = 0, totalWeight = 0, totalMeters = 0;
  selectedFifoItems.forEach(function(m) {
    totalQty    += (m.qty     || 0);
    totalRolls  += (m.rolls   || 0);
    totalWeight += (m.weight  || 0);
    totalMeters += (m.meters  || 0);
  });
  if (selectedFifoItems[0].item_type === 'fabric') {
    document.getElementById('dp-rolls').value   = totalRolls;
    document.getElementById('dp-weight').value  = totalWeight;
    document.getElementById('dp-meters').value  = totalMeters;
  } else {
    document.getElementById('dp-qty').value = totalQty;
  }
}


// ═══════════════════════════════════════════
// 불출 확정
// ═══════════════════════════════════════════
async function submitDispatch() {
  if (!selectedDpItem)   { showToast('품목을 먼저 선택하세요'); return; }
  if (!selectedFifoItems || selectedFifoItems.length === 0) { showToast('불출할 항목을 선택하세요'); return; }

  var person = document.getElementById('dp-person').value.trim();
  if (!person) { showToast('담당자 이름을 입력하세요'); return; }

  var qty = 0, rolls = 0, weight = 0, meters = 0;
  if (dpType === 'fabric') {
    rolls  = parseFloat(document.getElementById('dp-rolls').value)   || 0;
    weight = parseFloat(document.getElementById('dp-weight').value)  || 0;
    meters = parseFloat(document.getElementById('dp-meters').value)  || 0;
    qty    = rolls;
  } else {
    qty = parseFloat(document.getElementById('dp-qty').value) || 0;
  }
  if (!qty) { showToast('수량을 입력하세요'); return; }

  try {
    var res  = await fetch(API + '/outbound', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_type : dpType,
        code      : selectedDpItem.code,
        name      : selectedDpItem.name,
        person, qty, rolls, weight, meters,
        from_ids : selectedFifoItems.map(function(m){ return m.id; }),
        from_id  : selectedFifoItems[0].id,
        from_loc : selectedFifoItems.map(function(m){ return m.loc || '' }).join(', '),
        date     : document.getElementById('dp-date').value,
        note     : document.getElementById('dp-note').value,
      })
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 불출 확정 완료!');
      if (selectedDpItem) fetch(API + '/lock/' + encodeURIComponent(selectedDpItem.code), { method: 'DELETE', credentials: 'include' });
      resetDispatch();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}


// ═══════════════════════════════════════════
// 불출 초기화 (다시 선택)
// ═══════════════════════════════════════════
function resetDispatch() {
  if (selectedDpItem) fetch(API + '/lock/' + encodeURIComponent(selectedDpItem.code), { method: 'DELETE', credentials: 'include' });
  selectedDpItem   = null;
  selectedFifoItems = [];
  document.getElementById('dp-suffix').value = '';
  document.getElementById('dp-step2').style.display = 'none';
  document.getElementById('dp-step3').style.display = 'none';
  document.getElementById('dp-fifo-wrap').innerHTML = '';
  ['dp-qty','dp-rolls','dp-weight','dp-meters','dp-note'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  // 담당자는 초기화하지 않고 현재 로그인 사용자로 유지
  var dpPerson = document.getElementById('dp-person');
  if (dpPerson && currentUser) dpPerson.value = currentUser.name;
  setType('dp', 'normal');
}

