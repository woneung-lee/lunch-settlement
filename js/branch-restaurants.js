// ===== 전역 변수 =====
let currentUser = null;
let branches = [];
let selectedBranchId = null;
let sharedRestaurants = [];

// ===== DOM 요소 =====
const branchSelect = document.getElementById('branch-select');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const restaurantsContainer = document.getElementById('restaurants-container');
const restaurantsList = document.getElementById('restaurants-list');

// ===== 인증 상태 확인 =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    await loadBranches();
});

// ===== 지점 목록 로드 =====
async function loadBranches() {
    try {
        showLoading();
        
        const snapshot = await db.collection('branches')
            .orderBy('fullPath')
            .get();
        
        branches = [];
        snapshot.forEach(doc => {
            const branch = { id: doc.id, ...doc.data() };
            // 선택 가능한 지점만 표시 (본점 + 말단 조직)
            if (branch.selectable) {
                branches.push(branch);
            }
        });
        
        renderBranchSelect();
        
    } catch (error) {
        console.error('지점 목록 로드 오류:', error);
        alert('지점 목록을 불러오는 중 오류가 발생했습니다.');
        showEmptyState();
    }
}

// ===== 지점 선택 박스 렌더링 =====
function renderBranchSelect() {
    branchSelect.innerHTML = '<option value="">지점을 선택하세요</option>';
    
    // 본점 우선
    const headquarters = branches.filter(b => b.level === 0);
    headquarters.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id;
        option.textContent = `🏢 ${b.name}`;
        branchSelect.appendChild(option);
    });
    
    // 기타 지점들 (fullPath 기준 정렬)
    const others = branches.filter(b => b.level > 0);
    others.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id;
        option.textContent = b.fullPath.replace(/\//g, ' > ');
        branchSelect.appendChild(option);
    });
    
    // 초기 상태
    showEmptyState();
}

// ===== 지점 선택 이벤트 =====
branchSelect.addEventListener('change', async () => {
    selectedBranchId = branchSelect.value;
    
    if (!selectedBranchId) {
        showEmptyState();
        return;
    }
    
    await loadSharedRestaurants();
});

// ===== 공유 맛집 로드 =====
async function loadSharedRestaurants() {
    try {
        showLoading();
        
        const snapshot = await db.collection('sharedRestaurants')
            .where('branchId', '==', selectedBranchId)
            .orderBy('sharedAt', 'desc')
            .get();
        
        sharedRestaurants = [];
        snapshot.forEach(doc => {
            sharedRestaurants.push({ id: doc.id, ...doc.data() });
        });
        
        if (sharedRestaurants.length === 0) {
            showEmptyState();
        } else {
            renderRestaurants();
            showRestaurantsContainer();
        }
        
    } catch (error) {
        console.error('공유 맛집 로드 오류:', error);
        alert('맛집 목록을 불러오는 중 오류가 발생했습니다.');
        showEmptyState();
    }
}

// ===== 맛집 목록 렌더링 =====
function renderRestaurants() {
    restaurantsList.innerHTML = '';
    
    sharedRestaurants.forEach(restaurant => {
        const card = createRestaurantCard(restaurant);
        restaurantsList.appendChild(card);
    });
}

// ===== 맛집 카드 생성 =====
function createRestaurantCard(restaurant) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    
    const emoji = getCategoryEmoji(restaurant.category);
    const sharedDate = restaurant.sharedAt ? 
        new Date(restaurant.sharedAt.toDate()).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '날짜 정보 없음';
    
    const reasonHtml = restaurant.reason ? 
        `<div class="restaurant-reason">${escapeHtml(restaurant.reason)}</div>` : '';
    
    card.innerHTML = `
        <div class="restaurant-header">
            <div class="restaurant-name-row">
                <span class="restaurant-emoji">${emoji}</span>
                <span class="restaurant-name">${escapeHtml(restaurant.restaurantName)}</span>
            </div>
            <span class="restaurant-category">${escapeHtml(restaurant.category)}</span>
        </div>
        
        ${reasonHtml}
        
        <div class="restaurant-meta">
            <div class="meta-item">
                <span class="meta-icon">👥</span>
                <span>${escapeHtml(restaurant.groupName)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-icon">📅</span>
                <span>${sharedDate}</span>
            </div>
        </div>
    `;
    
    return card;
}

// ===== 카테고리별 이모지 =====
function getCategoryEmoji(category) {
    const emojiMap = {
        '한식': '🍚',
        '중식': '🥟',
        '일식': '🍱',
        '양식': '🍝',
        '분식': '🍜',
        '기타': '🍽️'
    };
    return emojiMap[category] || '🍽️';
}

// ===== HTML 이스케이프 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 상태 표시 함수들 =====
function showLoading() {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    restaurantsContainer.classList.add('hidden');
}

function showEmptyState() {
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    restaurantsContainer.classList.add('hidden');
}

function showRestaurantsContainer() {
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    restaurantsContainer.classList.remove('hidden');
}
