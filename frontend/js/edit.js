// ═══════════════════════════════════════════
// 수정 모달 열기
// ═══════════════════════════════════════════
var editingId = null;
var editingData = null;

function openEditModal(id) {
  // 현재 재고 데이터에서 해당 항목 찾기
  fetch(API + '/inventory?limit=9999', { credentials: 'include' })
    .then(function(r){ return r.json(); })
    .then(function(json){
      var all = json.data || [];
      var item = all.find(function(d){ return d.id === id; });
      if (!item) { showToast('항목을 찾을 수 없습니다'); return; }

      editingId   = id;
      editingData = item;

      // 모달에 현재 값 채우기
      document.getElementById('edit-title').textContent = item.name || '항목 수정';
      document.getElementById('edit-name').value  = item.name  || '';
      document.getElementById('edit-code').value  = item.code  || '';
      document.getElementById('edit-lot').value   = item.lot   || '';
      document.getElementById('edit-date').value  = item.date  || '';
      document.getElementById('edit-note').value  = item.note  || '';
      document.getElementById('edit-cat').value = item.cat || '기타';

      // 수량 (유형에 따라)
      setEditType(item.item_type === 'fabric' ? 'fabric' : 'normal');
      if (item.item_type === 'fabric') {
        document.getElementById('edit-rolls').value   = item.rolls   || 0;
        document.getElementById('edit-weight').value  = item.weight  || 0;
        document.getElementById('edit-meters').value  = item.meters  || 0;
      } else {
        document.getElementById('edit-qty').value = item.qty || 0;
      }

      // 위치 파싱해서 폼에 채우기
      document.getElementById('edit-wh').value = item.wh || 'D';
      var loc = item.loc || '';

      // 렉/바닥/천막동 열 구분
      var wh = item.wh || 'D';
      if (wh === 'T' && loc.includes('열')) {
        // 천막동: 구역 + 열
        document.getElementById('edit-st').value = 'floor';
        document.getElementById('edit-rack-fields').style.display = 'none';
        document.getElementById('edit-floor-fields').style.display = 'none';
        document.getElementById('edit-t-fields').style.display = 'block';
        var zoneM = loc.match(/([A-D])구역/);
        var colM  = loc.match(/(\d+)열/);
        document.getElementById('edit-t-zone').value = zoneM ? zoneM[1] : '';
        document.getElementById('edit-col').value    = colM  ? colM[1]  : '';
      } else if (loc.includes('바닥')) {
        document.getElementById('edit-st').value = 'floor';
        document.getElementById('edit-rack-fields').style.display = 'none';
        document.getElementById('edit-floor-fields').style.display = 'block';
        document.getElementById('edit-t-fields').style.display = 'none';
        document.getElementById('edit-floc').value = loc.replace(/.*바닥\s*/, '');
      } else {
        document.getElementById('edit-st').value = 'rack';
        document.getElementById('edit-rack-fields').style.display = 'block';
        document.getElementById('edit-floor-fields').style.display = 'none';
        document.getElementById('edit-t-fields').style.display = 'none';
        // 구역/번호/층 파싱
        var zoneM = loc.match(/([A-F])구역/);
        var rackM = loc.match(/(\d+)번 렉/);
        var floorM= loc.match(/(\d+)층/);
        document.getElementById('edit-zone').value = zoneM  ? zoneM[1]  : '';
        document.getElementById('edit-rn').value   = rackM  ? rackM[1]  : '';
        document.getElementById('edit-fl').value   = floorM ? floorM[1] : '';
      }

      // 모달 표시
      var modal = document.getElementById('edit-modal');
      modal.style.display = 'flex';
    });
}

// 위치 문자열 생성 (수정 모달용)
function buildEditLoc() {
  var wh    = document.getElementById('edit-wh').value;
  var label = wh === 'D' ? 'D동' : '천막동';
  var st    = document.getElementById('edit-st').value;

  // 천막동: 구역 + 열
  if (wh === 'T') {
    var zone = document.getElementById('edit-t-zone').value;
    var col  = document.getElementById('edit-col').value;
    if (zone && col) return label + ' ' + zone + '구역 ' + col + '열';
    return label;
  }

  if (st === 'rack') {
    var zone  = document.getElementById('edit-zone').value;
    var rn    = document.getElementById('edit-rn').value;
    var fl    = document.getElementById('edit-fl').value;
    var parts = [label, zone?zone+'구역':'', rn?rn+'번 렉':'', fl?fl+'층':''].filter(Boolean);
    return parts.length > 1 ? parts.join(' ') : label;
  } else {
    var floc = document.getElementById('edit-floc').value;
    return floc ? label + ' 바닥 ' + floc : label;
  }
}

// 수정 모달 저장
function setEditType(type) {
  document.getElementById('edit-type-normal').classList.toggle('on', type === 'normal');
  document.getElementById('edit-type-fabric').classList.toggle('on', type === 'fabric');
  document.getElementById('edit-qty-normal').style.display = type === 'normal' ? 'block' : 'none';
  document.getElementById('edit-qty-fabric').style.display = type === 'fabric' ? 'block' : 'none';
  if (editingData) editingData.item_type = type;
}

async function saveEdit() {
  if (!editingId || !editingData) return;

  var loc = buildEditLoc();
  var updatedData = Object.assign({}, editingData, {
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
    updatedData.rolls  = parseFloat(document.getElementById('edit-rolls').value)   || 0;
    updatedData.weight = parseFloat(document.getElementById('edit-weight').value)  || 0;
    updatedData.meters = parseFloat(document.getElementById('edit-meters').value)  || 0;
    updatedData.qty    = updatedData.rolls;
  } else {
    updatedData.qty = parseFloat(document.getElementById('edit-qty').value) || 0;
  }

  try {
    var res  = await fetch(API + '/record/' + editingId, {
      method : 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(updatedData)
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 수정 완료!');
      document.getElementById('edit-modal').style.display = 'none';
      loadStock();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}

// ═══════════════════════════════════════════
// 불출 취소 (재고 자동 복원)
// ═══════════════════════════════════════════
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


// ═══════════════════════════════════════════
// 비밀번호 변경
// ═══════════════════════════════════════════