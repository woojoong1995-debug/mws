// ═══════════════════════════════════════════
// 오늘 날짜 (YYYY-MM-DD, 로컬 기준)
// ═══════════════════════════════════════════
function todayStr() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

// ═══════════════════════════════════════════
// 불출: 카테고리 필터 선택
// ═══════════════════════════════════════════
var dpCatFilter = '';

function pickDpCat(btn, cat) {
  dpCatFilter = cat;
  document.querySelectorAll('.dp-cat-btn').forEach(function(b){
    b.classList.toggle('on', b === btn);
  });
  var suffix = (document.getElementById('dp-suffix') || {}).value || '';
  if (suffix.trim().length >= 2 || cat) searchBySuffix();
}

// ═══════════════════════════════════════════
// 불출: 품번 끝자리로 품목 검색
// ═══════════════════════════════════════════
async function searchBySuffix() {
  var suffix = document.getElementById('dp-suffix').value.trim();

  document.getElementById('dp-step2').style.display = 'none';
  document.getElementById('dp-step3').style.display = 'none';
  selectedDpItem    = null;
  selectedFifoItems = [];

  if (suffix.length < 2 && !dpCatFilter) return;

  try {
    var params = new URLSearchParams();
    if (suffix)      params.set('code', suffix);
    if (dpCatFilter) params.set('cat', dpCatFilter);
    var res     = await fetch(API + '/fifo?' + params.toString(), { credentials: 'include' });
    var json    = await res.json();
    var matches = json.data || [];

    if (!matches.length) {
      document.getElementById('dp-step2').style.display = 'block';
      document.getElementById('dp-item-list').innerHTML = '<p style="text-align:center;color:var(--txt2);padding:16px 0;font-size:14px">해당 품목 없음</p>';
      return;
    }

    var seen = {}, unique = [];
    matches.forEach(function(m) {
      if (m.code && !seen[m.code]) {
        seen[m.code] = true;
        unique.push(m);
      }
    });

    if (unique.length === 1) {
      selectDpItem(unique[0]);
      return;
    }

    document.getElementById('dp-step2').style.display = 'block';
    document.getElementById('dp-item-list').innerHTML = unique.map(function(item) {
      return '<div class="dp-item-card" data-code="' + item.code + '" style="padding:12px;border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:8px;cursor:pointer;background:var(--card);color:var(--txt)">' +
        '<div style="font-size:14px;font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
        '<div style="font-size:12px;color:var(--txt2);margin-top:3px">' + item.code + '</div>' +
      '</div>';
    }).join('');

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
// 항목 수량 텍스트 포맷 헬퍼
// ═══════════════════════════════════════════
function formatFifoQty(m) {
  if (m.item_type === 'fabric') {
    var fu = m.fabric_unit || 'roll';
    if (fu === 'kg')  return (m.weight || m.qty || 0) + ' kg';
    if (fu === 'm')   return (m.meters || m.qty || 0) + ' m';
    if (fu === 'set') return (m.qty || 0) + ' SET';
    if (fu === 'ea')  return (m.qty || 0) + ' 개';
    var wTxt = m.weight ? (' (' + m.weight + 'kg)') : '';
    return (m.rolls || 0) + '롤' + wTxt;
  }
  return (m.qty || 0) + '개';
}

// ═══════════════════════════════════════════
// 불출: 품목 선택 → FIFO 목록 표시
// ═══════════════════════════════════════════
async function selectDpItem(item) {
  selectedDpItem    = item;
  selectedFifoItems = [];

  document.getElementById('dp-step2').style.display = 'none';
  document.getElementById('dp-step3').style.display = 'block';

  document.getElementById('dp-selected-info').innerHTML =
    '<div style="font-size:13px;font-weight:600;color:var(--blue)">' + (item.name || '-') + '</div>' +
    '<div style="font-size:12px;color:var(--blue);margin-top:2px;opacity:.8">' + item.code + '</div>';

  setType('dp', (item.item_type === 'fabric' || item.itemType === 'fabric') ? 'fabric' : 'normal');

  try {
    var res  = await fetch(API + '/fifo?code=' + encodeURIComponent(item.code), { credentials: 'include' });
    var json = await res.json();
    var list = json.data || [];

    var wrap = document.getElementById('dp-fifo-wrap');
    if (!list.length) { wrap.innerHTML = ''; return; }

    selectedFifoItems = [];

    var rows = list.map(function(m, idx) {
      var qty   = formatFifoQty(m);
      var tag   = m.kind === 'hwanjip' ? '<span class="hj-tag">환입</span>' : '';
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

    wrap.querySelectorAll('.fifo-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var chk = this.querySelector('.fifo-chk');
        if (!chk) return;
        chk.checked = !chk.checked;
        chk.dispatchEvent(new Event('change'));
      });
    });

    wrap.querySelectorAll('.fifo-chk').forEach(function(chk) {
      chk.addEventListener('change', function(e) {
        e.stopPropagation();
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

        var countEl = document.getElementById('dp-selected-count');
        if (countEl) countEl.textContent = selectedFifoItems.length + '개 선택';

        updateDispatchInputUI();
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
// 선택된 항목의 단위에 맞춰 불출 입력 UI 자동 전환
// ═══════════════════════════════════════════
function updateDispatchInputUI() {
  var normDiv = document.getElementById('dp-qty-normal');
  var fabDiv  = document.getElementById('dp-qty-fabric');
  var lbl     = document.getElementById('dp-qty-label');
  var uwInfo  = document.getElementById('dp-uw-info');

  if (!selectedFifoItems || selectedFifoItems.length === 0) return;

  var first = selectedFifoItems[0];
  if (first.item_type === 'fabric') {
    var fu = first.fabric_unit || 'roll';
    if (fu === 'roll') {
      // 롤 + KG 연동형
      normDiv.style.display = 'none';
      fabDiv.style.display  = 'block';
      var uw = first.unit_weight || ((first.rolls > 0 && first.weight > 0) ? (first.weight / first.rolls) : 0);
      if (uwInfo) {
        uwInfo.textContent = uw > 0
          ? ('💡 1롤당 무게: ' + (Math.round(uw * 1000000) / 1000000) + ' kg (롤 수 입력 시 자동 계산)')
          : '💡 롤 수와 차감 무게(kg)를 입력하세요';
      }
    } else {
      // 환입(KG), SET, 길이(M), 개수
      normDiv.style.display = 'block';
      fabDiv.style.display  = 'none';
      var map = {
        kg : '불출 무게 (kg)',
        set: '불출 수량 (SET)',
        m  : '불출 길이 (m)',
        ea : '불출 개수 (개)'
      };
      if (lbl) lbl.textContent = map[fu] || '불출 수량';
    }
  } else {
    normDiv.style.display = 'block';
    fabDiv.style.display  = 'none';
    if (lbl) lbl.textContent = '불출 수량 (개)';
  }
}

// 롤 수 입력 시 1롤당 무게로 차감 무게(kg) 자동 계산
function onDpRollInput() {
  if (!selectedFifoItems || selectedFifoItems.length === 0) return;
  var rolls = parseFloat(document.getElementById('dp-rolls').value) || 0;
  var first = selectedFifoItems[0];
  var uw = first.unit_weight || ((first.rolls > 0 && first.weight > 0) ? (first.weight / first.rolls) : 0);
  if (uw > 0) {
    document.getElementById('dp-weight').value = Math.round(rolls * uw * 1000) / 1000;
  }
}

// ═══════════════════════════════════════════
// 불출: MAX 버튼
// ═══════════════════════════════════════════
function setMaxQty() {
  if (!selectedFifoItems || selectedFifoItems.length === 0) { showToast('먼저 항목을 선택하세요'); return; }
  var first = selectedFifoItems[0];

  if (first.item_type === 'fabric') {
    var fu = first.fabric_unit || 'roll';
    if (fu === 'roll') {
      var totalRolls = 0, totalWeight = 0;
      selectedFifoItems.forEach(function(m) {
        totalRolls  += (m.rolls  || 0);
        totalWeight += (m.weight || 0);
      });
      document.getElementById('dp-rolls').value  = Math.round(totalRolls * 1000) / 1000;
      document.getElementById('dp-weight').value = Math.round(totalWeight * 1000) / 1000;
    } else if (fu === 'kg') {
      var sumW = selectedFifoItems.reduce(function(acc, m){ return acc + (m.weight || m.qty || 0); }, 0);
      document.getElementById('dp-qty').value = Math.round(sumW * 1000) / 1000;
    } else if (fu === 'm') {
      var sumM = selectedFifoItems.reduce(function(acc, m){ return acc + (m.meters || m.qty || 0); }, 0);
      document.getElementById('dp-qty').value = Math.round(sumM * 1000) / 1000;
    } else {
      var sumQ = selectedFifoItems.reduce(function(acc, m){ return acc + (m.qty || 0); }, 0);
      document.getElementById('dp-qty').value = sumQ;
    }
  } else {
    var totalQty = selectedFifoItems.reduce(function(acc, m){ return acc + (m.qty || 0); }, 0);
    document.getElementById('dp-qty').value = totalQty;
  }
}

// ═══════════════════════════════════════════
// 불출 확정
// ═══════════════════════════════════════════
async function submitDispatch() {
  if (!selectedDpItem) { showToast('품목을 먼저 선택하세요'); return; }
  if (!selectedFifoItems || selectedFifoItems.length === 0) { showToast('불출할 항목을 선택하세요'); return; }

  var person = document.getElementById('dp-person').value.trim();
  if (!person) { showToast('담당자 이름을 입력하세요'); return; }

  var first    = selectedFifoItems[0];
  var isFabric = first.item_type === 'fabric';
  var fu       = isFabric ? (first.fabric_unit || 'roll') : '';

  var dateVal  = todayStr();
  var noteVal  = document.getElementById('dp-note').value;
  var payloads = [];

  if (isFabric && fu === 'roll') {
    var rolls  = parseFloat(document.getElementById('dp-rolls').value)  || 0;
    var weight = parseFloat(document.getElementById('dp-weight').value) || 0;
    if (!rolls) { showToast('불출 롤 수를 입력하세요'); return; }

    var remRolls = rolls;
    selectedFifoItems.forEach(function(m) {
      var availRolls = m.rolls || 0;
      var takeRolls  = Math.min(remRolls, availRolls);
      remRolls = Math.round((remRolls - takeRolls) * 1000) / 1000;
      if (takeRolls <= 0) return;

      var uw = m.unit_weight || ((availRolls > 0 && (m.weight || 0) > 0) ? (m.weight / availRolls) : 0);
      var takeWeight = (takeRolls === availRolls && m.weight)
        ? m.weight
        : (uw > 0 ? Math.round(takeRolls * uw * 1000) / 1000 : weight);

      payloads.push({
        item_type  : 'fabric',
        fabric_unit: 'roll',
        unit_weight: uw,
        code       : selectedDpItem.code,
        name       : selectedDpItem.name,
        person     : person,
        from_id    : m.id,
        from_loc   : m.loc || '',
        lot        : m.lot || '',
        route      : m.route || '',
        po         : m.po || '',
        rolls      : takeRolls,
        weight     : takeWeight,
        meters     : 0,
        qty        : takeRolls,
        date       : dateVal,
        note       : noteVal
      });
    });
  } else if (isFabric) {
    // kg / m / set / ea
    var val = parseFloat(document.getElementById('dp-qty').value) || 0;
    if (!val) { showToast('불출 수량/무게를 입력하세요'); return; }

    var rem = val;
    selectedFifoItems.forEach(function(m) {
      var avail = fu === 'kg' ? (m.weight || m.qty || 0)
                : fu === 'm'  ? (m.meters || m.qty || 0)
                : (m.qty || 0);
      var take = Math.min(rem, avail);
      rem = Math.round((rem - take) * 1000) / 1000;
      if (take <= 0) return;

      payloads.push({
        item_type  : 'fabric',
        fabric_unit: fu,
        code       : selectedDpItem.code,
        name       : selectedDpItem.name,
        person     : person,
        from_id    : m.id,
        from_loc   : m.loc || '',
        lot        : m.lot || '',
        route      : m.route || '',
        po         : m.po || '',
        rolls      : 0,
        weight     : fu === 'kg' ? take : 0,
        meters     : fu === 'm'  ? take : 0,
        qty        : take,
        date       : dateVal,
        note       : noteVal
      });
    });
  } else {
    // 일반 품목
    var qty = parseFloat(document.getElementById('dp-qty').value) || 0;
    if (!qty) { showToast('수량을 입력하세요'); return; }

    var remQty = qty;
    selectedFifoItems.forEach(function(m) {
      var take = Math.min(remQty, m.qty || 0);
      remQty -= take;
      if (take <= 0) return;
      payloads.push({
        item_type: 'normal',
        code     : selectedDpItem.code,
        name     : selectedDpItem.name,
        person   : person,
        from_id  : m.id,
        from_loc : m.loc || '',
        lot      : m.lot || '',
        route    : m.route || '',
        po       : m.po || '',
        qty      : take,
        date     : dateVal,
        note     : noteVal
      });
    });
  }

  if (!payloads.length) { showToast('불출할 수량이 없습니다'); return; }

  try {
    var okCount = 0;
    for (var i = 0; i < payloads.length; i++) {
      var res  = await fetch(API + '/outbound', {
        method     : 'POST',
        credentials: 'include',
        headers    : { 'Content-Type': 'application/json' },
        body       : JSON.stringify(payloads[i])
      });
      var json = await res.json();
      if (json.success) okCount++;
      else showToast('오류: ' + json.message);
    }
    if (okCount > 0) {
      showToast('✓ 불출 확정 완료! (' + okCount + '건)');
      resetDispatch();
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}

function resetDispatch() {
  selectedDpItem    = null;
  selectedFifoItems = [];
  document.getElementById('dp-suffix').value = '';
  document.getElementById('dp-step2').style.display = 'none';
  document.getElementById('dp-step3').style.display = 'none';
  document.getElementById('dp-fifo-wrap').innerHTML = '';
  ['dp-qty','dp-rolls','dp-weight','dp-meters','dp-note'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var dpPerson = document.getElementById('dp-person');
  if (dpPerson && currentUser) dpPerson.value = currentUser.name;
}