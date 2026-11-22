// ═══════════════════════════════════════════
// 빠른 위치 이동 모달 (위치만 단독 변경 - D동 / 천막동 / 사무동 지원)
// ═══════════════════════════════════════════
var movingId   = null;
var movingData = null;

function openMoveModal(id) {
  fetch(API + '/inventory', { credentials: 'include' })
    .then(function(r){ return r.json(); })
    .then(function(json){
      var all  = json.data || [];
      var item = all.find(function(d){ return d.id === id; });
      if (!item) { showToast('항목을 찾을 수 없습니다'); return; }

      movingId   = id;
      movingData = item;

      document.getElementById('move-item-title').textContent = (item.name || item.code) + (item.lot ? ' (Lot: ' + item.lot + ')' : '');
      document.getElementById('move-current-loc').textContent = '현재 위치: ' + (item.loc || '-');

      var wh  = item.wh || 'D';
      var loc = item.loc || '';
      document.getElementById('move-wh').value = wh;
      onMoveWhChange();

      if (wh === 'T' || wh === 'O') {
        var tZoneM = loc.match(/([A-D])구역/);
        var tColM  = loc.match(/(\d+)열/);
        document.getElementById('move-t-zone').value = tZoneM ? tZoneM[1] : '';
        document.getElementById('move-col').value    = tColM  ? tColM[1]  : '';
      } else if (loc.includes('바닥')) {
        document.getElementById('move-st').value = 'floor';
        onMoveStChange();
        var dZoneM = loc.match(/(\d+)구역/);
        var dColM  = loc.match(/(\d+)열/);
        document.getElementById('move-d-fzone').value = dZoneM ? dZoneM[1] : '';
        document.getElementById('move-d-fcol').value  = dColM  ? dColM[1]  : '';
      } else {
        document.getElementById('move-st').value = 'rack';
        onMoveStChange();
        var rackPart = loc.replace(/^(?:D창고|D동)\s*/, '');
        var zoneM  = rackPart.match(/([A-F])(?:동|구역)/);
        var rackM  = rackPart.match(/(\d+)(?:호|번 렉)/);
        var floorM = rackPart.match(/(\d+)층/);
        document.getElementById('move-zone').value = zoneM  ? zoneM[1]  : '';
        document.getElementById('move-rn').value   = rackM  ? rackM[1]  : '';
        document.getElementById('move-fl').value   = floorM ? floorM[1] : '';
      }

      document.getElementById('move-modal').style.display = 'flex';
    });
}

function onMoveWhChange() {
  var wh = document.getElementById('move-wh').value;
  var st = document.getElementById('move-st');
  if (wh === 'T' || wh === 'O') {
    st.value = 'floor';
    st.disabled = true;
    document.getElementById('move-rack-fields') .style.display = 'none';
    document.getElementById('move-floor-fields').style.display = 'none';
    document.getElementById('move-t-fields')    .style.display = 'block';
  } else {
    st.disabled = false;
    onMoveStChange();
  }
}

function onMoveStChange() {
  var wh = document.getElementById('move-wh').value;
  if (wh === 'T' || wh === 'O') return;
  var st = document.getElementById('move-st').value;
  document.getElementById('move-rack-fields') .style.display = st === 'rack'  ? 'block' : 'none';
  document.getElementById('move-floor-fields').style.display = st === 'floor' ? 'block' : 'none';
  document.getElementById('move-t-fields')    .style.display = 'none';
}

function buildMoveLoc() {
  var wh = document.getElementById('move-wh').value;
  var st = document.getElementById('move-st').value;
  if (wh === 'T' || wh === 'O') {
    var whName = wh === 'T' ? '천막동' : '사무동';
    var zone   = document.getElementById('move-t-zone').value;
    var col    = document.getElementById('move-col').value;
    return (zone && col) ? (whName + ' ' + zone + '구역 ' + col + '열') : '';
  }
  if (st === 'rack') {
    var zone = document.getElementById('move-zone').value;
    var rn   = document.getElementById('move-rn').value;
    var fl   = document.getElementById('move-fl').value;
    var parts = ['D창고', zone ? zone + '동' : '', rn ? rn + '호' : '', fl ? fl + '층' : ''].filter(Boolean);
    return parts.length >= 2 ? parts.join(' ') : '';
  } else {
    var dZone = document.getElementById('move-d-fzone').value;
    var dCol  = document.getElementById('move-d-fcol').value;
    return (dZone && dCol) ? ('D창고 바닥 ' + dZone + '구역 ' + dCol + '열') : '';
  }
}

async function saveMoveLocation() {
  if (!movingId || !movingData) return;
  var newLoc = buildMoveLoc();
  if (!newLoc) { showToast('이동할 위치를 모두 선택하세요'); return; }

  var updated = Object.assign({}, movingData, {
    wh : document.getElementById('move-wh').value,
    loc: newLoc
  });

  try {
    var res  = await fetch(API + '/record/' + movingId, {
      method     : 'PUT',
      credentials: 'include',
      headers    : { 'Content-Type': 'application/json' },
      body       : JSON.stringify(updated)
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 위치 이동 완료: ' + newLoc);
      document.getElementById('move-modal').style.display = 'none';
      loadStock();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}

// ═══════════════════════════════════════════
// 전체 수정 모달 열기 (신규 입고 ↔ 환입 전환 포함)
// ═══════════════════════════════════════════
var editingId   = null;
var editingData = null;

function setEditKind(kind) {
  var btnIn = document.getElementById('edit-kind-in');
  var btnHj = document.getElementById('edit-kind-hwanjip');
  if (btnIn) btnIn.classList.toggle('on', kind === 'in');
  if (btnHj) btnHj.classList.toggle('on', kind === 'hwanjip');
  if (editingData) editingData.kind = kind;
}

function openEditModal(id) {
  fetch(API + '/inventory?limit=9999', { credentials: 'include' })
    .then(function(r){ return r.json(); })
    .then(function(json){
      var all  = json.data || [];
      var item = all.find(function(d){ return d.id === id; });
      if (!item) { showToast('항목을 찾을 수 없습니다'); return; }

      editingId   = id;
      editingData = item;

      setEditKind(item.kind === 'hwanjip' ? 'hwanjip' : 'in');
      document.getElementById('edit-title').textContent = item.name || '항목 수정';
      document.getElementById('edit-name').value  = item.name  || '';
      document.getElementById('edit-code').value  = item.code  || '';
      document.getElementById('edit-lot').value   = item.lot   || '';
      document.getElementById('edit-date').value  = item.date  || '';
      document.getElementById('edit-note').value  = item.note  || '';
      document.getElementById('edit-cat').value   = item.cat   || '기타';

      setEditType(item.item_type === 'fabric' ? 'fabric' : 'normal');
      if (item.item_type === 'fabric') {
        var fu = item.fabric_unit || 'roll';
        document.getElementById('edit-fabric-unit').value = fu;
        document.getElementById('edit-rolls').value  = (fu === 'roll') ? (item.rolls || 0) : (item.qty || 0);
        document.getElementById('edit-weight').value = item.weight || 0;
        document.getElementById('edit-meters').value = item.meters || 0;
      } else {
        document.getElementById('edit-qty').value = item.qty || 0;
      }

      var wh  = item.wh || 'D';
      var loc = item.loc || '';
      document.getElementById('edit-wh').value = wh;

      if (wh === 'T' || wh === 'O') {
        document.getElementById('edit-st').value = 'floor';
        document.getElementById('edit-rack-fields') .style.display = 'none';
        document.getElementById('edit-floor-fields').style.display = 'none';
        document.getElementById('edit-t-fields')    .style.display = 'block';
        var tZoneM = loc.match(/([A-D])구역/);
        var tColM  = loc.match(/(\d+)열/);
        document.getElementById('edit-t-zone').value = tZoneM ? tZoneM[1] : '';
        document.getElementById('edit-col').value    = tColM  ? tColM[1]  : '';
      } else if (loc.includes('바닥')) {
        document.getElementById('edit-st').value = 'floor';
        document.getElementById('edit-rack-fields') .style.display = 'none';
        document.getElementById('edit-floor-fields').style.display = 'block';
        document.getElementById('edit-t-fields')    .style.display = 'none';
        var dZoneM = loc.match(/(\d+)구역/);
        var dColM  = loc.match(/(\d+)열/);
        document.getElementById('edit-d-fzone').value = dZoneM ? dZoneM[1] : '';
        document.getElementById('edit-d-fcol').value  = dColM  ? dColM[1]  : '';
      } else {
        document.getElementById('edit-st').value = 'rack';
        document.getElementById('edit-rack-fields') .style.display = 'block';
        document.getElementById('edit-floor-fields').style.display = 'none';
        document.getElementById('edit-t-fields')    .style.display = 'none';
        var rackPart = loc.replace(/^(?:D창고|D동)\s*/, '');
        var zoneM  = rackPart.match(/([A-F])(?:동|구역)/);
        var rackM  = rackPart.match(/(\d+)(?:호|번 렉)/);
        var floorM = rackPart.match(/(\d+)층/);
        document.getElementById('edit-zone').value = zoneM  ? zoneM[1]  : '';
        document.getElementById('edit-rn').value   = rackM  ? rackM[1]  : '';
        document.getElementById('edit-fl').value   = floorM ? floorM[1] : '';
      }

      document.getElementById('edit-modal').style.display = 'flex';
    });
}

function buildEditLoc() {
  var wh = document.getElementById('edit-wh').value;
  var st = document.getElementById('edit-st').value;

  if (wh === 'T' || wh === 'O') {
    var whName = wh === 'T' ? '천막동' : '사무동';
    var zone   = document.getElementById('edit-t-zone').value;
    var col    = document.getElementById('edit-col').value;
    if (zone && col) return whName + ' ' + zone + '구역 ' + col + '열';
    return whName;
  }

  if (st === 'rack') {
    var zone  = document.getElementById('edit-zone').value;
    var rn    = document.getElementById('edit-rn').value;
    var fl    = document.getElementById('edit-fl').value;
    var parts = ['D창고', zone ? zone + '동' : '', rn ? rn + '호' : '', fl ? fl + '층' : ''].filter(Boolean);
    return parts.length >= 2 ? parts.join(' ') : 'D창고';
  } else {
    var dZone = document.getElementById('edit-d-fzone').value;
    var dCol  = document.getElementById('edit-d-fcol').value;
    if (dZone && dCol) return 'D창고 바닥 ' + dZone + '구역 ' + dCol + '열';
    return 'D창고 바닥';
  }
}

function setEditType(type) {
  document.getElementById('edit-type-normal').classList.toggle('on', type === 'normal');
  document.getElementById('edit-type-fabric').classList.toggle('on', type === 'fabric');
  document.getElementById('edit-qty-normal').style.display = type === 'normal' ? 'block' : 'none';
  document.getElementById('edit-qty-fabric').style.display = type === 'fabric' ? 'block' : 'none';
  if (editingData) editingData.item_type = type;
}

function onEditFabricUnitChange() {}

async function saveEdit() {
  if (!editingId || !editingData) return;

  var loc = buildEditLoc();
  var updatedData = Object.assign({}, editingData, {
    kind  : editingData.kind || 'in',
    name  : document.getElementById('edit-name').value.trim(),
    code  : document.getElementById('edit-code').value.trim(),
    lot   : document.getElementById('edit-lot').value.trim(),
    wh    : document.getElementById('edit-wh').value,
    loc   : loc,
    date  : document.getElementById('edit-date').value,
    note  : document.getElementById('edit-note').value,
    cat   : document.getElementById('edit-cat').value,
  });

  if (editingData.item_type === 'fabric') {
    var fu   = document.getElementById('edit-fabric-unit').value || 'roll';
    var rVal = parseFloat(document.getElementById('edit-rolls').value)  || 0;
    var wVal = parseFloat(document.getElementById('edit-weight').value) || 0;
    var mVal = parseFloat(document.getElementById('edit-meters').value) || 0;
    updatedData.fabric_unit = fu;
    if (fu === 'roll') {
      updatedData.rolls  = rVal;
      updatedData.weight = wVal;
      updatedData.meters = mVal;
      updatedData.qty    = rVal;
    } else if (fu === 'kg') {
      updatedData.weight = wVal || rVal;
      updatedData.qty    = updatedData.weight;
    } else if (fu === 'm') {
      updatedData.meters = mVal || rVal;
      updatedData.qty    = updatedData.meters;
    } else {
      updatedData.qty    = rVal;
    }
  } else {
    updatedData.qty = parseFloat(document.getElementById('edit-qty').value) || 0;
  }

  try {
    var res  = await fetch(API + '/record/' + editingId, {
      method     : 'PUT',
      credentials: 'include',
      headers    : { 'Content-Type': 'application/json' },
      body       : JSON.stringify(updatedData)
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 수정 완료!');
      document.getElementById('edit-modal').style.display = 'none';
      if (currentTab === 'history') loadHistory();
      else loadStock();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}

async function cancelOutbound(id) {
  try {
    var res  = await fetch(API + '/outbound/' + id, { method: 'DELETE', credentials: 'include' });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 불출 취소 완료! 재고가 복원됐어요');
      loadHistory();
    } else {
      showToast('취소 실패: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}