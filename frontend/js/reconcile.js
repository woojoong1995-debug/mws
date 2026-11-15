// =====================================================
// reconcile.js - 본사 전산 CSV vs MWS 재고 자동 대조
// =====================================================

var _reconcileData = [];
var _reconcileFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
  var navRec = document.getElementById('nav-reconcile');
  if (navRec) {
    navRec.addEventListener('click', function() {
      switchTab('reconcile', navRec);
    });
  }
});

async function runReconcile() {
  var hqInput  = document.getElementById('rec-hq-file');
  var mwsInput = document.getElementById('rec-mws-file');

  if (!hqInput || !hqInput.files || !hqInput.files.length) {
    showToast('본사 전산 CSV 파일을 먼저 선택하세요');
    return;
  }

  var btn = document.getElementById('btn-run-reconcile');
  var origTxt = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 데이터 합산 및 대조 중...';

  try {
    var fd = new FormData();
    fd.append('hq_file', hqInput.files[0]);
    if (mwsInput && mwsInput.files && mwsInput.files.length) {
      fd.append('mws_file', mwsInput.files[0]);
    }

    var res  = await fetch(API + '/reconcile', {
      method: 'POST',
      credentials: 'include',
      body: fd
    });
    var json = await res.json();

    if (!json.success) {
      showToast('오류: ' + (json.message || '대조 실패'));
      return;
    }

    _reconcileData = json.results || [];
    var s = json.summary || { total: 0, match: 0, short: 0, over: 0 };

    document.getElementById('rec-cnt-all').textContent   = s.total;
    document.getElementById('rec-cnt-diff').textContent  = (s.short + s.over);
    document.getElementById('rec-cnt-short').textContent = s.short;
    document.getElementById('rec-cnt-over').textContent  = s.over;
    document.getElementById('rec-source-badge').textContent = '✓ 비교 기준: 본사 전산 CSV vs ' + (json.source || 'MWS 재고');

    document.getElementById('rec-result-area').style.display = 'block';
    // 차이가 있는 항목이 있으면 '차이 발생' 탭을 기본으로 보여주어 바로 확인 가능
    var defaultFilter = (s.short + s.over) > 0 ? 'diff' : 'all';
    var cardEl = document.querySelector('.rec-stat-card[data-filter="' + defaultFilter + '"]');
    filterReconcile(defaultFilter, cardEl);

    showToast('✓ 총 ' + s.total + '개 품번 대조 완료!');
  } catch (e) {
    showToast('서버 통신 오류가 발생했습니다');
  } finally {
    btn.disabled = false;
    btn.textContent = origTxt;
  }
}

function filterReconcile(filterType, el) {
  _reconcileFilter = filterType;
  document.querySelectorAll('.rec-stat-card').forEach(function(c) {
    c.classList.remove('on');
  });
  if (el) el.classList.add('on');
  renderReconcileTable();
}

function fmtNum(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function renderReconcileTable() {
  var tbody = document.getElementById('rec-tbody');
  if (!tbody) return;

  var q = (document.getElementById('rec-search').value || '').trim().toLowerCase();

  var filtered = _reconcileData.filter(function(item) {
    if (_reconcileFilter === 'diff'  && item.status === 'match') return false;
    if (_reconcileFilter === 'short' && item.status !== 'short') return false;
    if (_reconcileFilter === 'over'  && item.status !== 'over')  return false;

    if (q) {
      var codeMatch = (item.code || '').toLowerCase().includes(q);
      var nameMatch = (item.name || '').toLowerCase().includes(q);
      if (!codeMatch && !nameMatch) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--txt2)">해당 조건의 품목이 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(item) {
    var diffStr = item.diff > 0 ? ('+' + fmtNum(item.diff)) : fmtNum(item.diff);
    var diffColor = item.status === 'short' ? '#dc2626' : (item.status === 'over' ? '#2563eb' : '#16a34a');
    var badgeHtml = '';
    if (item.status === 'short') {
      badgeHtml = '<span class="rec-badge rec-badge-short">부족</span>';
    } else if (item.status === 'over') {
      badgeHtml = '<span class="rec-badge rec-badge-over">과다</span>';
    } else {
      badgeHtml = '<span class="rec-badge rec-badge-match">일치</span>';
    }

    return '<tr>' +
      '<td style="font-weight:700;color:var(--txt)">' + item.code + '</td>' +
      '<td style="color:var(--txt)">' + (item.name || '-') + '</td>' +
      '<td style="text-align:right;font-weight:600">' + fmtNum(item.hq_qty) + '</td>' +
      '<td style="text-align:right;font-weight:600">' + fmtNum(item.mws_qty) + '</td>' +
      '<td style="text-align:right;font-weight:800;color:' + diffColor + '">' + diffStr + '</td>' +
      '<td style="color:var(--txt2);font-weight:600">' + item.unit + '</td>' +
      '<td>' + badgeHtml + '</td>' +
    '</tr>';
  }).join('');
}

function downloadReconcileCsv() {
  if (!_reconcileData.length) {
    showToast('다운로드할 대조 결과가 없습니다');
    return;
  }
  var lines = ['\ufeff품번,품목명,본사전산,MWS재고,차이(MWS-본사),단위,상태'];
  var statusMap = { short: '부족', over: '과다', match: '일치' };

  _reconcileData.forEach(function(r) {
    var safeName = '"' + (r.name || '').replace(/"/g, '""') + '"';
    lines.push([
      r.code,
      safeName,
      r.hq_qty,
      r.mws_qty,
      r.diff,
      r.unit,
      statusMap[r.status] || r.status
    ].join(','));
  });

  var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = '재고대조결과_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}