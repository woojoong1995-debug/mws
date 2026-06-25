// ═══════════════════════════════════════════
// 직원 관리 목록 로드 (운영자 전용)
// ═══════════════════════════════════════════
async function loadUsers() {
  var list = document.getElementById('admin-list');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    var res  = await fetch(API + '/users', { credentials: 'include' });
    var json = await res.json();
    var users = json.data || [];

    var total   = users.filter(function(u){ return u.status !== 'pending'; }).length;
    var pending = users.filter(function(u){ return u.status === 'pending'; }).length;
    document.getElementById('admin-total')  .textContent = total;
    document.getElementById('admin-pending').textContent = pending;

    if (!users.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0">직원 없음</p>';
      return;
    }

    // 상태별 정렬: 승인대기 → 활성 → 비활성
    var statusOrder = { pending: 0, active: 1, inactive: 2 };
    users.sort(function(a, b){ return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0); });

    list.innerHTML = users.map(function(u) {
      // 상태 배지
      var statusMap = {
        pending  : { label: '승인 대기', bg: '#fef9c3', color: '#854d0e' },
        active   : { label: '활성',     bg: '#f0fdf4', color: '#166534' },
        inactive : { label: '비활성',   bg: '#fef2f2', color: '#991b1b' },
      };
      var st = statusMap[u.status] || statusMap.active;

      // 역할 배지
      var roleBadge = u.role === 'admin'
        ? '<span style="font-size:11px;padding:2px 7px;border-radius:6px;background:#ede9fe;color:#5b21b6;font-weight:600;margin-left:4px">운영자</span>'
        : '';

      // 팀 배지
      var teamMap = { material: { label: '자재팀', bg: '#f0fdf4', color: '#166534' }, production: { label: '생산팀', bg: '#dbeafe', color: '#1d4ed8' } };
      var tm = teamMap[u.team] || teamMap.material;
      var teamBadge = u.role !== 'admin'
        ? '<span style="font-size:11px;padding:2px 7px;border-radius:6px;font-weight:600;margin-left:4px;background:' + tm.bg + ';color:' + tm.color + '">' + tm.label + '</span>'
        : '';

      // 버튼 구성
      var btns = '';
      if (u.status === 'pending') {
        btns = '<button class="user-action" data-id="' + u.id + '" data-action="approve" style="font-size:11px;padding:3px 8px;border:1px solid #86efac;border-radius:6px;background:#f0fdf4;color:#166534;cursor:pointer;margin-right:4px">승인</button>' +
               '<button class="user-action" data-id="' + u.id + '" data-action="reject"  style="font-size:11px;padding:3px 8px;border:1px solid #fca5a5;border-radius:6px;background:#fef2f2;color:#dc2626;cursor:pointer">거절</button>';
      } else if (u.status === 'active' && u.role !== 'admin') {
        btns = '<button class="user-action" data-id="' + u.id + '" data-action="deactivate" style="font-size:11px;padding:3px 8px;border:1px solid #fca5a5;border-radius:6px;background:#fef2f2;color:#dc2626;cursor:pointer">강제탈퇴</button>';
      } else if (u.status === 'inactive') {
        btns = '<button class="user-action" data-id="' + u.id + '" data-action="activate" style="font-size:11px;padding:3px 8px;border:1px solid #86efac;border-radius:6px;background:#f0fdf4;color:#166534;cursor:pointer">복구</button>';
      }

      return '<div class="item">' +
        '<div class="item-top">' +
          '<div>' +
            '<div class="item-name">' + u.name + roleBadge + teamBadge + '</div>' +
            '<div class="item-code">@' + u.username + ' · ' + u.created + '</div>' +
          '</div>' +
          '<div class="item-right">' +
            '<span style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:600;background:' + st.bg + ';color:' + st.color + '">' + st.label + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:8px">' + btns + '</div>' +
        '</div>';
    }).join('');

    // 버튼 이벤트 등록
    document.querySelectorAll('.user-action').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id     = parseInt(this.dataset.id);
        var action = this.dataset.action;
        handleUserAction(id, action);
      });
    });

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0">서버 연결 오류</p>';
  }
}


// ═══════════════════════════════════════════
// 직원 관리 액션 처리
// ═══════════════════════════════════════════
async function handleUserAction(id, action) {
  var confirmMsg = {
    approve    : '승인하시겠습니까?',
    reject     : '가입을 거절하시겠습니까?',
    deactivate : '강제 탈퇴시키겠습니까?',
    activate   : '계정을 복구하시겠습니까?',
  };
  if (!confirm(confirmMsg[action] || '진행하시겠습니까?')) return;

  try {
    var res  = await fetch(API + '/users/' + id + '/' + action, {
      method     : 'POST',
      credentials: 'include'
    });
    var json = await res.json();
    showToast(json.success ? '✓ ' + json.message : '오류: ' + json.message);
    if (json.success) loadUsers();
  } catch(e) {
    showToast('서버 연결 오류');
  }
}

