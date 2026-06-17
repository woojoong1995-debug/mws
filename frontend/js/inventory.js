// ═══════════════════════════════════════════
// 재고 목록 로드
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

async function loadStock() {
  var q    = document.getElementById('st-q').value.trim();
  var list = document.getElementById('stock-list');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    var params = new URLSearchParams();
    if (q)          params.set('q',   q);
    if (currentCat) params.set('cat', currentCat);

    var res  = await fetch(API + '/inventory?' + params, { credentials: 'include' });
    var json = await res.json();
    var items = json.data || [];

    document.getElementById('st-total').textContent = json.total_in || 0;
    document.getElementById('st-today').textContent = json.today_in || 0;

    // 창고 필터
    if (currentStockWh === 'D')  items = items.filter(function(i){ return i.wh === 'D' && i.kind !== 'hwanjip'; });
    if (currentStockWh === 'T')  items = items.filter(function(i){ return i.wh === 'T' && i.kind !== 'hwanjip'; });
    if (currentStockWh === 'hj') items = items.filter(function(i){ return i.kind === 'hwanjip'; });

    if (!items.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">항목 없음</p>';
      return;
    }

    // 품번 기준 그룹핑
    var groups = {};
    var groupOrder = [];
    items.slice().reverse().forEach(function(item) {
      var key = item.code || item.name || 'unknown';
      if (!groups[key]) {
        groups[key] = { items: [], name: item.name, code: item.code, cat: item.cat, totalQty: 0, totalRolls: 0, totalMeters: 0 };
        groupOrder.push(key);
      }
      groups[key].items.push(item);
      if (item.item_type === 'fabric') {
        groups[key].totalRolls  += (item.rolls  || 0);
        groups[key].totalMeters += (item.meters || 0);
      } else {
        groups[key].totalQty += (item.qty || 0);
      }
    });

    var html = groupOrder.map(function(key, gi) {
      var g = groups[key];
      var isFabric = g.items[0].item_type === 'fabric';
      var totalTxt = isFabric
        ? (g.totalRolls + '롤' + (g.totalMeters ? '/' + g.totalMeters.toFixed(1) + 'm' : ''))
        : (g.totalQty + '개');
      var catLabel = g.cat ? '<span class="cat-lbl cl-' + g.cat + '">' + g.cat + '</span>' : '';
      var count = g.items.length;

      var rows = g.items.map(function(item) {
        var badgeCls   = item.kind === 'hwanjip' ? 'b-r' : item.wh === 'D' ? 'b-d' : 'b-t';
        var badgeLabel = item.kind === 'hwanjip' ? '환입' : item.wh === 'D' ? 'D동' : '천막';
        var qtyTxt     = isFabric ? (item.rolls + '롤/' + item.weight + 'kg' + (item.meters ? '/' + item.meters + 'm' : '')) : (item.qty + '개');
        var depCls     = item.depleted ? 'depleted' : '';
        var depBadge   = item.depleted ? '<span class="depleted-badge">소진</span>' : '';
        var canEdit    = currentUser.role === 'admin' || item.created_by === currentUser.username;
        return '<div class="stock-row ' + depCls + '" style="padding:10px 0;border-top:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<div style="min-width:0;flex:1">' +
              '<div style="font-size:12px;color:var(--txt2)">' + (item.lot ? 'Lot:' + item.lot : '-') + depBadge + '</div>' +
              '<div style="font-size:12px;color:var(--txt2);margin-top:2px">📍 ' + (item.loc || '-') + ' · ' + item.date + '</div>' +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
              '<span class="badge ' + badgeCls + '" style="display:block;margin-bottom:4px">' + badgeLabel + '</span>' +
              '<div class="item-qty" style="font-size:13px">' + qtyTxt + '</div>' +
              (canEdit ? '<button class="edit-btn" data-id="' + item.id + '" style="margin-top:4px;font-size:11px;padding:3px 10px;border:1px solid var(--border2);border-radius:6px;background:var(--card);color:var(--txt);cursor:pointer">수정</button>' : '') +
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
            '<div style="font-size:16px;font-weight:700;color:var(--txt)">' + totalTxt + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px" id="stock-arrow-' + gi + '">▼ 펼치기</div>' +
          '</div>' +
        '</div>' +
        '<div id="stock-detail-' + gi + '" style="display:none">' + rows + '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html;

    // 수정 버튼 이벤트
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

