// ═══════════════════════════════════════════
// 재고 목록 로드 (빠른 위치이동 버튼 포함)
// ═══════════════════════════════════════════
var currentStockWh = 'all';

function setStockWh(wh) {
  currentStockWh = wh;
  ['all','D','T','hj'].forEach(function(w) {
    var el = document.getElementById('st-wh-' + w);
    if (el) el.classList.toggle('on', w === wh);
  });
  loadStock();
}

function formatItemQtyText(item) {
  if (item.item_type === 'fabric') {
    var fu = item.fabric_unit || 'roll';
    if (fu === 'kg')  return (item.weight || item.qty || 0) + ' kg';
    if (fu === 'm')   return (item.meters || item.qty || 0) + ' m';
    if (fu === 'set') return (item.qty || 0) + ' SET';
    if (fu === 'ea')  return (item.qty || 0) + ' 개';
    var wStr = item.weight ? (' (' + item.weight + 'kg)') : '';
    var specStr = (item.spec_m) ? (' · ' + item.spec_m + 'm규격') : '';
    return (item.rolls || 0) + '롤' + wStr + specStr;
  }
  return (item.qty || 0) + '개';
}

async function loadStock() {
  var q        = (document.getElementById('st-q')    || {}).value.trim();
  var dateVal  = (document.getElementById('st-date') || {}).value || '';
  var list     = document.getElementById('stock-list');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    var params = new URLSearchParams();
    if (q)          params.set('q',    q);
    if (currentCat) params.set('cat',  currentCat);
    if (dateVal)    params.set('date', dateVal);

    var res   = await fetch(API + '/inventory?' + params, { credentials: 'include' });
    var json  = await res.json();
    var items = json.data || [];

    if (currentStockWh === 'D')  items = items.filter(function(i){ return i.wh === 'D' && i.kind !== 'hwanjip'; });
    if (currentStockWh === 'T')  items = items.filter(function(i){ return i.wh === 'T' && i.kind !== 'hwanjip'; });
    if (currentStockWh === 'hj') items = items.filter(function(i){ return i.kind === 'hwanjip'; });

    if (!items.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">조건에 맞는 재고가 없습니다</p>';
      return;
    }

    var groups = {};
    var groupOrder = [];
    items.forEach(function(item) {
      var key = item.code || item.name || 'unknown';
      if (!groups[key]) {
        groups[key] = {
          items: [], name: item.name, code: item.code, cat: item.cat,
          isFabric: item.item_type === 'fabric',
          totalQty: 0, totalRolls: 0, totalWeight: 0, totalMeters: 0, totalSet: 0
        };
        groupOrder.push(key);
      }
      groups[key].items.push(item);
      if (item.item_type === 'fabric') {
        var fu = item.fabric_unit || 'roll';
        if (fu === 'roll') {
          groups[key].totalRolls  += (item.rolls  || 0);
          groups[key].totalWeight += (item.weight || 0);
        } else if (fu === 'kg') {
          groups[key].totalWeight += (item.weight || item.qty || 0);
        } else if (fu === 'm') {
          groups[key].totalMeters += (item.meters || item.qty || 0);
        } else if (fu === 'set') {
          groups[key].totalSet    += (item.qty || 0);
        } else {
          groups[key].totalQty    += (item.qty || 0);
        }
      } else {
        groups[key].totalQty += (item.qty || 0);
      }
    });
    groupOrder.sort();

    var html = groupOrder.map(function(key, gi) {
      var g = groups[key];
      var totalParts = [];
      if (g.isFabric) {
        if (g.totalRolls > 0)  totalParts.push((Math.round(g.totalRolls * 1000) / 1000) + '롤');
        if (g.totalWeight > 0) totalParts.push((Math.round(g.totalWeight * 1000) / 1000) + 'kg');
        if (g.totalMeters > 0) totalParts.push((Math.round(g.totalMeters * 1000) / 1000) + 'm');
        if (g.totalSet > 0)    totalParts.push(g.totalSet + ' SET');
        if (g.totalQty > 0)    totalParts.push(g.totalQty + '개');
      } else {
        totalParts.push(g.totalQty + '개');
      }
      var totalTxt = totalParts.join(' / ') || '0';
      var catLabel = g.cat ? '<span class="cat-lbl cl-' + g.cat + '">' + g.cat + '</span>' : '';
      var count    = g.items.length;

      var rows = g.items.map(function(item) {
        var badgeCls   = item.kind === 'hwanjip' ? 'b-r' : item.wh === 'D' ? 'b-d' : 'b-t';
        var badgeLabel = item.kind === 'hwanjip' ? '환입' : item.wh === 'D' ? 'D동' : '천막동';
        var qtyTxt     = formatItemQtyText(item);
        var depCls     = item.depleted ? 'depleted' : '';
        var depBadge   = item.depleted ? '<span class="depleted-badge">소진</span>' : '';
        var canEdit    = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager' || item.created_by === currentUser.username);
        // 위치 이동은 자재팀/관리자/운영자 누구나 빠르게 가능
        var canMove    = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.team === 'material');

        return '<div class="stock-row ' + depCls + '" style="padding:10px 0;border-top:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<div style="min-width:0;flex:1">' +
              '<div style="font-size:12px;color:var(--txt2)">' + (item.lot ? 'Lot: <b>' + item.lot + '</b>' : '-') + depBadge + '</div>' +
              '<div style="font-size:13px;color:var(--txt);font-weight:600;margin-top:2px">📍 ' + (item.loc || '-') + ' <span style="font-weight:400;color:var(--txt2);font-size:12px">· ' + item.date + '</span></div>' +
              (item.po ? '<div style="font-size:12px;margin-top:2px"><span style="background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">PO: ' + item.po + '</span></div>' : '') +
              (item.note ? '<div style="font-size:11px;color:var(--txt2);margin-top:2px">📝 ' + item.note + '</div>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
              '<span class="badge ' + badgeCls + '" style="display:inline-block;margin-bottom:4px">' + badgeLabel + '</span>' +
              '<div class="item-qty" style="font-size:13px">' + qtyTxt + '</div>' +
              '<div style="display:flex;gap:4px;justify-content:flex-end;margin-top:5px">' +
                (canMove ? '<button class="move-btn" data-id="' + item.id + '" style="font-size:11px;padding:4px 8px;border:1px solid var(--blue);border-radius:6px;background:var(--blue-bg);color:var(--blue);font-weight:600;cursor:pointer">위치이동</button>' : '') +
                (canEdit ? '<button class="edit-btn" data-id="' + item.id + '" style="font-size:11px;padding:4px 8px;border:1px solid var(--border2);border-radius:6px;background:var(--card);color:var(--txt);cursor:pointer">수정</button>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="stock-group-card" style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">' +
        '<div class="stock-group-header" data-gi="' + gi + '" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleStockGroup(' + gi + ')">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:14px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (g.name || '-') + catLabel + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + (g.code || '') + ' · ' + count + '건</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
            '<div style="font-size:15px;font-weight:700;color:var(--txt)">' + totalTxt + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px" id="stock-arrow-' + gi + '">▼ 펼치기</div>' +
          '</div>' +
        '</div>' +
        '<div id="stock-detail-' + gi + '" style="display:none">' + rows + '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html;

    document.querySelectorAll('.move-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        openMoveModal(parseInt(this.dataset.id));
      });
    });

    document.querySelectorAll('.edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        openEditModal(parseInt(this.dataset.id));
      });
    });

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0;font-size:14px">서버에 연결할 수 없습니다</p>';
  }
}

function toggleStockGroup(gi) {
  var detail = document.getElementById('stock-detail-' + gi);
  var arrow  = document.getElementById('stock-arrow-' + gi);
  if (!detail) return;
  var open = detail.style.display === 'block';
  detail.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▼ 펼치기' : '▲ 접기';
}