// ═══════════════════════════════════════════
// 이력 및 날짜별 상세 조회 로드
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

    if (histKind === 'transfer') {
      params.set('kind', 'out');
      params.set('transfer_done', 'true');
    } else {
      params.set('kind', histKind);
    }

    var res  = await fetch(API + '/history?' + params, { credentials: 'include' });
    var json = await res.json();
    var outs = json.data || [];

    if (histKind === 'transfer') {
      outs = outs.filter(function(o){ return o.transfer_done; });
    } else if (histKind === 'out') {
      outs = outs.filter(function(o){ return !o.transfer_done; });
    }

    if (histCode) {
      outs = outs.filter(function(o){ return (o.code || '').toUpperCase().endsWith(histCode); });
    }

    document.getElementById('hs-total')   .textContent = json.total || 0;
    document.getElementById('hs-filtered').textContent = outs.length;

    if (!outs.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">해당 날짜/조건의 내역이 없습니다</p>';
      return;
    }

    outs.sort(function(a, b){ return (b.id || 0) - (a.id || 0); });

    var html = outs.map(function(item) {
      var isFabric = item.item_type === 'fabric';
      var qtyTxt = '';
      if (isFabric) {
        var fu = item.fabric_unit || 'roll';
        if (fu === 'kg')  qtyTxt = (item.weight || item.qty || 0) + ' kg';
        else if (fu === 'm')   qtyTxt = (item.meters || item.qty || 0) + ' m';
        else if (fu === 'set') qtyTxt = (item.qty || 0) + ' SET';
        else if (fu === 'ea')  qtyTxt = (item.qty || 0) + ' 개';
        else {
          qtyTxt = (item.rolls || 0) + '롤' + (item.weight ? ('<div style="font-size:12px;color:var(--blue);font-weight:600">전산: ' + item.weight + ' kg</div>') : '');
        }
      } else {
        qtyTxt = (item.qty || 0) + '개';
      }

      var locTxt = item.from_loc || item.loc || '-';
      var metaParts = [];
      if (item.lot)   metaParts.push('루트번호: <b>' + item.lot + '</b>');
      if (item.route) metaParts.push('<span style="background:var(--blue-bg);color:var(--blue);padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">루트:' + item.route + '</span>');
      if (item.po)    metaParts.push('<span style="background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">PO:' + item.po + '</span>');
      var metaLine = metaParts.length
        ? '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + metaParts.join(' · ') + '</div>'
        : '';

      var btns = '';
      if (histKind === 'out') {
        btns =
          '<button class="cancel-btn" data-id="' + item.id + '" style="margin-top:6px;font-size:11px;padding:4px 10px;border:1px solid #fca5a5;border-radius:6px;background:rgba(220,38,38,0.1);color:#ff453a;cursor:pointer">취소</button>' +
          '<button class="transfer-btn" data-id="' + item.id + '" style="margin-top:4px;font-size:11px;padding:4px 10px;border:1px solid #a78bfa;border-radius:6px;background:rgba(91,33,182,0.1);color:#5b21b6;cursor:pointer">전산 완료</button>';
      } else if ((histKind === 'in' || histKind === 'hwanjip') && currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager' || item.created_by === currentUser.username)) {
        btns = '<button class="hist-edit-btn" data-id="' + item.id + '" style="margin-top:6px;font-size:11px;padding:4px 10px;border:1px solid var(--border2);border-radius:6px;background:var(--card);color:var(--txt);cursor:pointer">수정/삭제</button>';
      }

      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:14px;font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + (item.code || '') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:6px">📍 ' + locTxt + '</div>' +
            metaLine +
            '<div style="font-size:12px;margin-top:4px"><b style="color:var(--blue)">' + (item.person || '미입력') + '</b> · ' + (item.date || '') + (item.time ? ' ' + item.time : '') + '</div>' +
            (item.note ? '<div style="font-size:11px;color:var(--txt2);margin-top:2px">📝 ' + item.note + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;flex-direction:column;align-items:flex-end">' +
            '<div class="item-qty" style="font-size:15px;font-weight:700">' + qtyTxt + '</div>' +
            btns +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html;

    document.querySelectorAll('.cancel-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        cancelOutbound(parseInt(this.dataset.id));
      });
    });

    document.querySelectorAll('.hist-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        openEditModal(parseInt(this.dataset.id));
      });
    });

    document.querySelectorAll('.transfer-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = parseInt(this.dataset.id);
        if (!confirm('전산 완료 처리하시겠습니까?')) return;
        fetch(API + '/record/' + id + '/transfer', {
          method: 'POST', credentials: 'include'
        })
        .then(function(r){ return r.json(); })
        .then(function(json){
          if (json.success) {
            showToast('✓ 전산 완료 처리됐습니다');
            loadHistory();
          } else {
            showToast('오류: ' + json.message);
          }
        })
        .catch(function(){ showToast('서버 연결 오류'); });
      });
    });

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0;font-size:14px">서버에 연결할 수 없습니다</p>';
  }
}