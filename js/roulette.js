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

// 하단 네비게이션
const navHome = document.getElementById('nav-home');
const navMembers = document.getElementById('nav-members');
const navRestaurants = document.getElementById('nav-restaurants');
const navRoulette = document.getElementById('nav-roulette');
const navStats = document.getElementById('nav-stats');
const navSettings = document.getElementById('nav-settings');

// 룰렛 요소
const rouletteWheel = document.getElementById('roulette-wheel');
const rouletteCanvas = document.getElementById('roulette-canvas');
const ctx = rouletteCanvas.getContext('2d');

// 결과 요소
const resultContainer = document.getElementById('result-container');
const resultRestaurant = document.getElementById('result-restaurant');
const resultCategory = document.getElementById('result-category');
const startAgainBtn = document.getElementById('start-again-btn');

// 선택 요소
const selectionContainer = document.getElementById('selection-container');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const restaurantsChecklist = document.getElementById('restaurants-checklist');
const startRouletteBtn = document.getElementById('start-roulette-btn');

// 필터 버튼들
const filterBtns = document.querySelectorAll('.filter-btn');

// ===== URL에서 groupId 가져오기 =====
const urlParams = new URLSearchParams(window.location.search);
groupId = urlParams.get('groupId');

if (!groupId) {
    alert('그룹 정보가 없습니다.');
    window.location.href = 'groups.html';
}

if (navHome) navHome.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `home.html?groupId=${groupId}`;
});
if (navMembers) navMembers.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `members.html?groupId=${groupId}`;
});
if (navRestaurants) navRestaurants.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `restaurants.html?groupId=${groupId}`;
});
if (navStats) navStats.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `stats.html?groupId=${groupId}`;
});
if (navSettings) navSettings.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `settings.html?groupId=${groupId}`;
});
if (navRoulette) navRoulette.addEventListener('click', (e) => e.preventDefault());

// ===== 인증 상태 확인 =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
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
        snapshot.forEach(doc => {
            restaurants.push({ id: doc.id, ...doc.data() });
        });
        
        if (restaurants.length === 0) {
            showEmptyState();
        } else {
            renderRestaurantsChecklist();
            showRouletteContainer();
        }
        
    } catch (error) {
        console.error('음식점 목록 로드 오류:', error);
        alert('음식점 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// ===== 음식점 체크리스트 렌더링 =====
function renderRestaurantsChecklist() {
    restaurantsChecklist.innerHTML = '';
    
    // 필터링
    const filteredRestaurants = currentFilter === 'all' 
        ? restaurants 
        : restaurants.filter(r => r.category === currentFilter);
    
    if (filteredRestaurants.length === 0) {
        restaurantsChecklist.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
                <p style="color: var(--text-medium); font-size: 15px;">
                    해당 카테고리의 음식점이 없습니다.
                </p>
            </div>
        `;
        return;
    }
    
    filteredRestaurants.forEach(restaurant => {
        const item = createCheckboxItem(restaurant);
        restaurantsChecklist.appendChild(item);
    });
}

// ===== 체크박스 아이템 생성 =====
function createCheckboxItem(restaurant) {
    const item = document.createElement('div');
    item.className = 'restaurant-checkbox-item';
    
    const isChecked = selectedRestaurants.some(r => r.id === restaurant.id);
    if (isChecked) {
        item.classList.add('checked');
    }
    
    item.innerHTML = `
        <input type="checkbox" id="rest-${restaurant.id}" ${isChecked ? 'checked' : ''}>
        <label for="rest-${restaurant.id}" class="restaurant-checkbox-label">
            <div class="restaurant-checkbox-name">${escapeHtml(restaurant.name)}</div>
            <div class="restaurant-checkbox-category">${restaurant.category}</div>
        </label>
    `;
    
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            selectedRestaurants.push(restaurant);
            item.classList.add('checked');
        } else {
            selectedRestaurants = selectedRestaurants.filter(r => r.id !== restaurant.id);
            item.classList.remove('checked');
        }
        updateStartButton();
    });
    
    item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
    
    return item;
}

// ===== HTML 이스케이프 (XSS 방지) =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 카테고리 필터 =====
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentFilter = btn.dataset.category;
        renderRestaurantsChecklist();
    });
});

// ===== 전체 선택/해제 =====
selectAllBtn.addEventListener('click', () => {
    selectedRestaurants = [...restaurants];
    renderRestaurantsChecklist();
    updateStartButton();
});

deselectAllBtn.addEventListener('click', () => {
    selectedRestaurants = [];
    renderRestaurantsChecklist();
    updateStartButton();
});

// ===== 시작 버튼 활성화/비활성화 =====
function updateStartButton() {
    if (selectedRestaurants.length >= 2) {
        startRouletteBtn.disabled = false;
        startRouletteBtn.textContent = `룰렛 시작 🎰 (${selectedRestaurants.length}개 후보)`;
    } else {
        startRouletteBtn.disabled = true;
        startRouletteBtn.textContent = '최소 2개 이상 선택해주세요';
    }
}

// ===== 상태 표시 함수들 =====
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

// ===== 뒤로 가기 =====
backBtn.addEventListener('click', () => {
    window.location.href = `home.html?groupId=${groupId}`;
});

// ===== 음식점 관리로 이동 =====
goRestaurantsBtn.addEventListener('click', () => {
    window.location.href = `restaurants.html?groupId=${groupId}`;
});

// ===== 룰렛 휠 그리기 =====
function drawRouletteWheel() {
    const wheelSize = 320;
    rouletteCanvas.width = wheelSize;
    rouletteCanvas.height = wheelSize;
    
    const centerX = wheelSize / 2;
    const centerY = wheelSize / 2;
    const radius = wheelSize / 2 - 10;
    
    const sliceAngle = (2 * Math.PI) / selectedRestaurants.length;
    
    // 색상 팔레트
    const colors = [
        '#0066CC', '#00A9E0', '#FF6B35', '#06A77D',
        '#3385DB', '#FFB347', '#4ECDC4', '#95E1D3'
    ];
    
    selectedRestaurants.forEach((restaurant, index) => {
        const startAngle = index * sliceAngle - Math.PI / 2;
        const endAngle = (index + 1) * sliceAngle - Math.PI / 2;
        
        // 슬라이스 그리기
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 텍스트 그리기
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px sans-serif';
        
        const text = restaurant.name;
        const textRadius = radius * 0.65;
        
        // 텍스트가 길면 줄임
        const maxWidth = radius * 0.8;
        let displayText = text;
        if (ctx.measureText(text).width > maxWidth) {
            displayText = text.substring(0, 8) + '...';
        }
        
        ctx.fillText(displayText, textRadius, 0);
        ctx.restore();
    });
    
    // 중앙 원 그리기
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 4;
    ctx.stroke();
}

// ===== 룰렛 시작 =====
startRouletteBtn.addEventListener('click', () => {
    if (isSpinning || selectedRestaurants.length < 2) return;
    
    isSpinning = true;
    resultContainer.classList.add('hidden');
    selectionContainer.classList.add('hidden');
    
    // 룰렛 휠 그리기
    drawRouletteWheel();
    
    // 랜덤 회전 각도 계산 (최소 5바퀴)
    const minSpins = 5;
    const maxSpins = 8;
    const spins = minSpins + Math.random() * (maxSpins - minSpins);
    const randomDegree = Math.random() * 360;
    const totalRotation = (spins * 360) + randomDegree;
    
    // 애니메이션 적용
    rouletteCanvas.style.transform = `rotate(${totalRotation}deg)`;
    
    // 4초 후 결과 표시
    setTimeout(() => {
        showResult(randomDegree);
    }, 4000);
});

// ===== 결과 표시 =====
function showResult(finalDegree) {
    // 최종 각도를 0-360 범위로 정규화
    const normalizedDegree = (360 - (finalDegree % 360)) % 360;
    
    // 슬라이스 각도
    const sliceAngle = 360 / selectedRestaurants.length;
    
    // 포인터가 가리키는 슬라이스 찾기
    const selectedIndex = Math.floor(normalizedDegree / sliceAngle);
    const winner = selectedRestaurants[selectedIndex];
    
    // 결과 표시
    resultRestaurant.textContent = winner.name;
    resultCategory.textContent = winner.category;
    resultContainer.classList.remove('hidden');
    
    isSpinning = false;
}

// ===== 다시 시작 =====
startAgainBtn.addEventListener('click', () => {
    // 룰렛 휠 초기화
    rouletteCanvas.style.transform = 'rotate(0deg)';
    rouletteCanvas.style.transition = 'none';
    
    setTimeout(() => {
        rouletteCanvas.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        resultContainer.classList.add('hidden');
        selectionContainer.classList.remove('hidden');
        ctx.clearRect(0, 0, rouletteCanvas.width, rouletteCanvas.height);
    }, 50);
});

