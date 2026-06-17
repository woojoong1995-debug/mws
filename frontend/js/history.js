// ═══════════════════════════════════════════
// 불출 이력 로드 (날짜 필터 포함)
// ═══════════════════════════════════════════
async function loadHistory() {
  var list = document.getElementById('history-list');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  var histDate = document.getElementById('hs-date').value;
  var histCode = (document.getElementById('hs-code').value || '').trim().toUpperCase();
  var histKind = document.querySelector('.hist-tab.on')?.dataset.kind || 'out';

  try {
    var params = new URLSearchParams();
    if (histDate) params.set('date', histDate);
    params.set('kind', histKind);

    var res  = await fetch(API + '/history?' + params, { credentials: 'include' });
    var json = await res.json();
    var outs = json.data || [];

    // 품번 끝자리 필터
    if (histCode) outs = outs.filter(function(o){ return (o.code || '').toUpperCase().endsWith(histCode); });

    document.getElementById('hs-total')   .textContent = json.total    || 0;
    document.getElementById('hs-filtered').textContent = outs.length;

    if (!outs.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">이력 없음</p>';
      return;
    }

    // 품번 기준 그룹핑
    var groups = {};
    var groupOrder = [];
    outs.forEach(function(item) {
      var key = item.code || item.name || 'unknown';
      if (!groups[key]) {
        groups[key] = { items: [], name: item.name, code: item.code, totalQty: 0, totalRolls: 0, totalMeters: 0 };
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
      var count = g.items.length;

      var rows = g.items.map(function(item) {
        var qtyTxt = isFabric
          ? (item.rolls + '롤/' + item.weight + 'kg' + (item.meters ? '/' + item.meters + 'm' : ''))
          : (item.qty + '개');
        return '<div style="padding:10px 0;border-top:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<div style="min-width:0;flex:1">' +
              '<div style="font-size:12px;color:var(--txt2)">' + (item.lot ? 'Lot:' + item.lot : '') + '</div>' +
              '<div style="font-size:12px;color:var(--txt2);margin-top:2px">📍 ' + (item.from_loc || '-') + '</div>' +
              '<div style="font-size:12px;margin-top:2px"><b style="color:var(--blue)">' + (item.person || '미입력') + '</b> · ' + (item.date || '') + '</div>' +
              (item.note ? '<div style="font-size:11px;color:var(--txt2);margin-top:2px">📝 ' + item.note + '</div>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
              '<div class="item-qty" style="font-size:13px">' + qtyTxt + '</div>' +
              (histKind === 'out' ?
              '<button class="cancel-btn" data-id="' + item.id + '" style="margin-top:4px;font-size:11px;padding:3px 10px;border:1px solid #fca5a5;border-radius:6px;background:rgba(220,38,38,0.1);color:#ff453a;cursor:pointer">취소</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleHistGroup(' + gi + ')">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:14px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (g.name || '-') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + (g.code || '') + ' · ' + count + '건</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
            '<div style="font-size:16px;font-weight:700;color:var(--txt)">' + totalTxt + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px" id="hist-arrow-' + gi + '">▼ 펼치기</div>' +
          '</div>' +
        '</div>' +
        '<div id="hist-detail-' + gi + '" style="display:none">' + rows + '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html;

    // 불출 취소 버튼 이벤트
    document.querySelectorAll('.cancel-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        cancelOutbound(parseInt(this.dataset.id));
      });
    });

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0;font-size:14px">서버에 연결할 수 없습니다</p>';
  }
}

function toggleHistGroup(gi) {
  var detail = document.getElementById('hist-detail-' + gi);
  var arrow  = document.getElementById('hist-arrow-' + gi);
  if (!detail) return;
  var open = detail.style.display === 'block';
  detail.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▼ 펼치기' : '▲ 접기';
}

