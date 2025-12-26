// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;

let restaurants = [];
let selectedRestaurants = [];
let currentFilter = 'all';
let isSpinning = false;

// ===== DOM 요소 =====
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const rouletteContainer = document.getElementById('roulette-container');
const emptyState = document.getElementById('empty-state');
const goRestaurantsBtn = document.getElementById('go-restaurants-btn');

const rouletteWheel = document.getElementById('roulette-wheel');
const rouletteCanvas = document.getElementById('roulette-canvas');
const ctx = rouletteCanvas.getContext('2d');

const selectionContainer = document.getElementById('selection-container');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const restaurantsChecklist = document.getElementById('restaurants-checklist');
const startRouletteBtn = document.getElementById('start-roulette-btn');

// 결과 모달
const resultModalOverlay = document.getElementById('result-modal-overlay');
const resultModalClose = document.getElementById('result-modal-close');
const resultRestaurant = document.getElementById('result-restaurant');
const resultCategory = document.getElementById('result-category');
const startAgainBtn = document.getElementById('start-again-btn');

// 네비게이션(있는 경우만)
const navIds = ['nav-home', 'nav-members', 'nav-restaurants', 'nav-roulette', 'nav-stats', 'nav-settings'];

// ===== 초기 설정 =====
(function init() {
    const params = new URLSearchParams(window.location.search);
    groupId = params.get('groupId');

    if (!groupId) {
        alert('그룹 정보가 없습니다.');
        window.location.href = 'groups.html';
        return;
    }

    // 네비게이션 href 세팅(그룹ID 유지)
    const routes = {
        'nav-home': `home.html?groupId=${groupId}`,
        'nav-members': `members.html?groupId=${groupId}`,
        'nav-restaurants': `restaurants.html?groupId=${groupId}`,
        'nav-roulette': `roulette.html?groupId=${groupId}`,
        'nav-stats': `stats.html?groupId=${groupId}`,
        'nav-settings': `settings.html?groupId=${groupId}`
    };
    navIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('href', routes[id] || '#');
    });
})();

// ===== 이벤트: 뒤로가기/이동 =====
backBtn.addEventListener('click', () => {
    window.location.href = `home.html?groupId=${groupId}`;
});

goRestaurantsBtn.addEventListener('click', () => {
    window.location.href = `restaurants.html?groupId=${groupId}`;
});

// ===== 인증 확인 =====
// ===== 그룹 접근 권한 확인(방 멤버십 기준) =====
async function ensureGroupAccess(user, groupId) {
    if (!user || !groupId) return null;

    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists) {
        alert('그룹을 찾을 수 없습니다.');
        window.location.href = 'groups.html';
        return null;
    }

    const group = groupDoc.data() || {};
    const gmRef = groupRef.collection('groupMembers').doc(user.uid);
    const gmDoc = await gmRef.get();

    // 정상: 방 멤버십 존재
    if (gmDoc.exists) {
        const gm = gmDoc.data() || {};
        return { group, role: gm.role || 'member' };
    }

    // 구버전 데이터 보정: ownerId는 방장으로 자동 등록
    if (group.ownerId && group.ownerId === user.uid) {
        await gmRef.set({
            userId: user.uid,
            role: 'owner',
            joinedAt: timestamp()
        }, { merge: true });
        return { group, role: 'owner' };
    }

    alert('해당 그룹에 대한 접근 권한이 없습니다.');
    window.location.href = 'groups.html';
    return null;
}

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    const access = await ensureGroupAccess(user, groupId);
    if (!access) return;
    await loadRestaurants();
});

// ===== 음식점 목록 로드 =====
async function loadRestaurants() {
    try {
        showLoading();

        const snapshot = await db.collection('groups').doc(groupId)
            .collection('restaurants')
            .orderBy('name')
            .get();

        restaurants = [];
        snapshot.forEach((doc) => {
            restaurants.push({ id: doc.id, ...doc.data() });
        });

        if (restaurants.length === 0) {
            showEmptyState();
            return;
        }

        // 기본: 전체 선택(사용성 유지)
        selectedRestaurants = restaurants.map(r => ({ id: r.id, name: r.name, category: r.category || '기타' }));

        renderRestaurantsChecklist();
        drawRouletteWheel();
        updateStartButton();
        showRouletteContainer();
    } catch (error) {
        console.error('음식점 목록 로드 실패:', error);
        alert('음식점 목록을 불러오지 못했습니다.');
        showEmptyState();
    }
}

// ===== 화면 상태 =====
function showLoading() {
    loadingState.classList.remove('hidden');
    rouletteContainer.classList.add('hidden');
    emptyState.classList.add('hidden');
}

function showRouletteContainer() {
    loadingState.classList.add('hidden');
    rouletteContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

function showEmptyState() {
    loadingState.classList.add('hidden');
    rouletteContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

// ===== 필터/선택 UI =====
filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-category') || 'all';
        renderRestaurantsChecklist();
    });
});

selectAllBtn.addEventListener('click', () => {
    const list = getFilteredRestaurants();
    list.forEach(r => {
        if (!selectedRestaurants.some(s => s.id === r.id)) {
            selectedRestaurants.push({ id: r.id, name: r.name, category: r.category || '기타' });
        }
    });
    renderRestaurantsChecklist();
    drawRouletteWheel();
    updateStartButton();
});

deselectAllBtn.addEventListener('click', () => {
    const list = getFilteredRestaurants();
    const idsToRemove = new Set(list.map(r => r.id));
    selectedRestaurants = selectedRestaurants.filter(s => !idsToRemove.has(s.id));
    renderRestaurantsChecklist();
    drawRouletteWheel();
    updateStartButton();
});

function getFilteredRestaurants() {
    if (currentFilter === 'all') return restaurants;
    return restaurants.filter(r => (r.category || '기타') === currentFilter);
}

function renderRestaurantsChecklist() {
    const list = getFilteredRestaurants();
    restaurantsChecklist.innerHTML = '';

    if (list.length === 0) {
        restaurantsChecklist.innerHTML = `<div style="padding:12px; color: var(--text-medium);">해당 카테고리에 음식점이 없습니다.</div>`;
        return;
    }

    list.forEach((r) => {
        restaurantsChecklist.appendChild(createCheckboxItem(r));
    });
}

function createCheckboxItem(restaurant) {
    const wrapper = document.createElement('div');
    wrapper.className = 'check-item';

    const left = document.createElement('div');
    left.className = 'check-left';

    const id = `rest-check-${restaurant.id}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = selectedRestaurants.some(s => s.id === restaurant.id);

    checkbox.addEventListener('change', () => {
        const exists = selectedRestaurants.some(s => s.id === restaurant.id);
        if (checkbox.checked && !exists) {
            selectedRestaurants.push({ id: restaurant.id, name: restaurant.name, category: restaurant.category || '기타' });
        }
        if (!checkbox.checked && exists) {
            selectedRestaurants = selectedRestaurants.filter(s => s.id !== restaurant.id);
        }
        drawRouletteWheel();
        updateStartButton();
    });

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.className = 'check-name';
    label.textContent = restaurant.name || '(이름 없음)';

    left.appendChild(checkbox);
    left.appendChild(label);

    const badge = document.createElement('div');
    badge.className = 'check-category';
    badge.textContent = restaurant.category || '기타';

    wrapper.appendChild(left);
    wrapper.appendChild(badge);

    return wrapper;
}

function updateStartButton() {
    if (selectedRestaurants.length >= 2) {
        startRouletteBtn.disabled = false;
        startRouletteBtn.textContent = `룰렛 시작 🎰 (${selectedRestaurants.length}개 후보)`;
    } else {
        startRouletteBtn.disabled = true;
        startRouletteBtn.textContent = '최소 2개 이상 선택해주세요';
    }
}

// ===== 룰렛 휠 그리기 =====
function drawRouletteWheel() {
    const count = selectedRestaurants.length;

    // 캔버스 DPI 대응
    const size = 320;
    const dpr = window.devicePixelRatio || 1;
    rouletteCanvas.width = Math.floor(size * dpr);
    rouletteCanvas.height = Math.floor(size * dpr);
    rouletteCanvas.style.width = `${size}px`;
    rouletteCanvas.style.height = `${size}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, size, size);

    // 후보가 너무 적으면 빈 원만 표시
    if (count < 2) {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, (size / 2) - 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
    }

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size / 2) - 6;

    const sliceAngle = (Math.PI * 2) / count;
    let startAngle = -Math.PI / 2; // 포인터가 위에 있으므로 -90도부터 시작

    const colors = [
        '#FFB3BA', '#BAE1FF', '#BAFFC9', '#FFFFBA',
        '#D7BAFF', '#FFD6A5', '#BDE0FE', '#CDEAC0',
        '#FEC5BB', '#A0C4FF', '#CAFFBF', '#FDFFB6'
    ];

    for (let i = 0; i < count; i++) {
        const endAngle = startAngle + sliceAngle;

        // slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        // slice border
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // text
        const name = selectedRestaurants[i].name || '';
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#1f2a37';
        ctx.font = '800 13px system-ui, -apple-system, Segoe UI, Roboto, Arial';

        const maxWidth = radius - 22;
        let displayText = name;
        if (ctx.measureText(displayText).width > maxWidth) {
            displayText = displayText.slice(0, 8) + '…';
        }
        ctx.fillText(displayText, radius - 14, 4);
        ctx.restore();

        startAngle = endAngle;
    }

    // center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.font = '900 12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LUNCH', centerX, centerY + 4);
}

// ===== 룰렛 시작(회전) =====
startRouletteBtn.addEventListener('click', () => {
    if (isSpinning) return;
    if (selectedRestaurants.length < 2) return;

    isSpinning = true;

    // 선택 영역은 동작 중 가독성 위해 숨김(기존 동작 유지)
    selectionContainer.classList.add('hidden');

    // 회전 전에 휠 재그리기
    drawRouletteWheel();

    // 랜덤 회전 각도 계산 (최소 5바퀴)
    const minSpins = 5;
    const maxSpins = 8;
    const spins = minSpins + Math.random() * (maxSpins - minSpins);
    const randomDegree = Math.random() * 360;
    const totalRotation = (spins * 360) + randomDegree;

    // 회전 적용
    rouletteWheel.style.transform = `rotate(${totalRotation}deg)`;

    // 4초 후 결과 표시(팝업)
    setTimeout(() => {
        showResult(totalRotation);
    }, 4000);
});

// ===== 결과 표시(팝업) =====
function showResult(finalDegree) {
    // 최종 각도를 0-360 범위로 정규화(포인터 기준 보정)
    const normalizedDegree = (360 - (finalDegree % 360)) % 360;

    const sliceAngle = 360 / selectedRestaurants.length;
    const selectedIndex = Math.floor(normalizedDegree / sliceAngle);
    const winner = selectedRestaurants[selectedIndex];

    resultRestaurant.textContent = winner?.name || '';
    resultCategory.textContent = winner?.category || '';

    // 팝업 표시
    resultModalOverlay.classList.remove('hidden');
    resultModalOverlay.setAttribute('aria-hidden', 'false');

    isSpinning = false;
}

// ===== 팝업 닫기(×) =====
resultModalClose.addEventListener('click', () => {
    resultModalOverlay.classList.add('hidden');
    resultModalOverlay.setAttribute('aria-hidden', 'true');
    // 닫을 때는 후보 선택 다시 표시
    selectionContainer.classList.remove('hidden');
});

// ===== 다시 시작 =====
startAgainBtn.addEventListener('click', () => {
    // 팝업 닫기
    resultModalOverlay.classList.add('hidden');
    resultModalOverlay.setAttribute('aria-hidden', 'true');

    // 룰렛 휠 초기화
    rouletteWheel.style.transition = 'none';
    rouletteWheel.style.transform = 'rotate(0deg)';

    // transition 복원 + 선택 표시
    setTimeout(() => {
        rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        selectionContainer.classList.remove('hidden');
        drawRouletteWheel();
        updateStartButton();
    }, 50);
});



