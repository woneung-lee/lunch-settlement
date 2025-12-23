// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let restaurants = [];
let editingRestaurantId = null;
let currentFilter = 'all';

// ===== DOM 요소 =====
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const filterContainer = document.getElementById('filter-container');
const restaurantsContainer = document.getElementById('restaurants-container');
const restaurantsList = document.getElementById('restaurants-list');
const emptyState = document.getElementById('empty-state');
const fabBtn = document.getElementById('fab-btn');

// 필터 버튼들
const filterBtns = document.querySelectorAll('.filter-btn');

// 모달 요소
const restaurantModal = document.getElementById('restaurant-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const restaurantNameInput = document.getElementById('restaurant-name');
const restaurantCategorySelect = document.getElementById('restaurant-category');
const nameError = document.getElementById('name-error');
const restaurantError = document.getElementById('restaurant-error');
const cancelBtn = document.getElementById('cancel-btn');
const deleteRestaurantBtn = document.getElementById('delete-restaurant-btn');
const saveRestaurantBtn = document.getElementById('save-restaurant-btn');

// ===== URL에서 groupId 가져오기 =====
const urlParams = new URLSearchParams(window.location.search);
groupId = urlParams.get('groupId');

if (!groupId) {
    alert('그룹 정보가 없습니다.');
    window.location.href = 'groups.html';
}

// ===== 하단 네비게이션 링크 세팅(그룹ID 유지) =====
(function setupBottomNav() {
    const routes = {
        'nav-home': `home.html?groupId=${groupId}`,
        'nav-members': `members.html?groupId=${groupId}`,
        'nav-restaurants': `restaurants.html?groupId=${groupId}`,
        'nav-roulette': `roulette.html?groupId=${groupId}`,
        'nav-stats': `stats.html?groupId=${groupId}`,
        'nav-settings': `settings.html?groupId=${groupId}`,
    };

    Object.entries(routes).forEach(([id, url]) => {
        const el = document.getElementById(id);
        if (!el) return;

        // <a> 태그면 href를 세팅(가장 안정적)
        if (el.tagName && el.tagName.toLowerCase() === 'a') {
            el.setAttribute('href', url);
            return;
        }

        // <button> 등이라면 클릭 이동
        el.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = url;
        });
    });
})();

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
            .orderBy('createdAt', 'desc')
            .get();
        
        restaurants = [];
        snapshot.forEach(doc => {
            restaurants.push({ id: doc.id, ...doc.data() });
        });
        
        renderRestaurants();
        
        if (restaurants.length === 0) {
            showEmptyState();
        } else {
            showRestaurantsList();
        }
        
    } catch (error) {
        console.error('음식점 목록 로드 오류:', error);
        alert('음식점 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// ===== 음식점 목록 렌더링 =====
function renderRestaurants() {
    restaurantsList.innerHTML = '';
    
    // 필터링
    const filteredRestaurants = currentFilter === 'all' 
        ? restaurants 
        : restaurants.filter(r => r.category === currentFilter);
    
    if (filteredRestaurants.length === 0 && currentFilter !== 'all') {
        restaurantsList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
                <p style="color: var(--text-medium); font-size: 15px;">
                    해당 카테고리의 음식점이 없습니다.
                </p>
            </div>
        `;
        return;
    }
    
    filteredRestaurants.forEach(restaurant => {
        const card = createRestaurantCard(restaurant);
        restaurantsList.appendChild(card);
    });
}

// ===== 음식점 카드 생성 =====
function createRestaurantCard(restaurant) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.onclick = () => openRestaurantModal(restaurant.id);
    
    const createdDate = restaurant.createdAt ? 
        new Date(restaurant.createdAt.toDate()).toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : '날짜 정보 없음';
    
    const categoryEmoji = getCategoryEmoji(restaurant.category);
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-icon">${categoryEmoji}</div>
            <span class="category-badge">${escapeHtml(restaurant.category)}</span>
        </div>
        <div class="card-name">${escapeHtml(restaurant.name)}</div>
        <div class="card-info">
            <div class="card-info-item">
                <span class="card-info-icon">📅</span>
                <span>${createdDate}</span>
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

// ===== HTML 이스케이프 (XSS 방지) =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 상태 표시 함수들 =====
function showLoading() {
    loadingState.classList.remove('hidden');
    filterContainer.classList.add('hidden');
    restaurantsContainer.classList.add('hidden');
    emptyState.classList.add('hidden');
}

function showRestaurantsList() {
    loadingState.classList.add('hidden');
    filterContainer.classList.remove('hidden');
    restaurantsContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

function showEmptyState() {
    loadingState.classList.add('hidden');
    filterContainer.classList.add('hidden');
    restaurantsContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

// ===== 카테고리 필터 =====
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // 모든 버튼 비활성화
        filterBtns.forEach(b => b.classList.remove('active'));
        // 클릭한 버튼 활성화
        btn.classList.add('active');
        
        currentFilter = btn.dataset.category;
        renderRestaurants();
    });
});

// ===== 모달 열기 (새 음식점 또는 수정) =====
function openRestaurantModal(restaurantId = null) {
    if (restaurantId) {
        // 기존 음식점 수정
        const restaurant = restaurants.find(r => r.id === restaurantId);
        if (!restaurant) return;
        
        editingRestaurantId = restaurantId;
        modalTitle.textContent = '음식점 수정';
        deleteRestaurantBtn.classList.remove('hidden');
        
        restaurantNameInput.value = restaurant.name;
        restaurantCategorySelect.value = restaurant.category;
    } else {
        // 새 음식점 추가
        editingRestaurantId = null;
        modalTitle.textContent = '음식점 추가';
        deleteRestaurantBtn.classList.add('hidden');
        
        restaurantNameInput.value = '';
        restaurantCategorySelect.value = '한식';
    }
    
    restaurantModal.classList.remove('hidden');
    restaurantNameInput.focus();
    hideError(nameError);
    hideError(restaurantError);

    // 저장/삭제 버튼 상태 초기화(저장 중... 잔상 방지)
saveRestaurantBtn.disabled = false;
saveRestaurantBtn.textContent = '저장';
deleteRestaurantBtn.disabled = false;
deleteRestaurantBtn.textContent = '삭제';
}

// ===== 모달 닫기 =====
function closeRestaurantModal() {
    restaurantModal.classList.add('hidden');

    // 모달 닫을 때도 버튼 상태 초기화
saveRestaurantBtn.disabled = false;
saveRestaurantBtn.textContent = '저장';
deleteRestaurantBtn.disabled = false;
deleteRestaurantBtn.textContent = '삭제';
}

modalClose.addEventListener('click', closeRestaurantModal);
modalOverlay.addEventListener('click', closeRestaurantModal);
cancelBtn.addEventListener('click', closeRestaurantModal);

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !restaurantModal.classList.contains('hidden')) {
        closeRestaurantModal();
    }
});

// ===== FAB 클릭 =====
fabBtn.addEventListener('click', () => {
    openRestaurantModal();
});

// ===== 에러 메시지 표시/숨김 =====
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function hideError(element) {
    element.textContent = '';
    element.classList.remove('show');
}

// ===== 음식점 저장 =====
saveRestaurantBtn.addEventListener('click', async () => {
    hideError(nameError);
    hideError(restaurantError);
    
    const name = restaurantNameInput.value.trim();
    const category = restaurantCategorySelect.value;
    
    // 유효성 검사
    if (!name) {
        showError(nameError, '음식점 이름을 입력해주세요.');
        return;
    }
    
    if (name.length > 30) {
        showError(nameError, '음식점 이름은 최대 30자까지 가능합니다.');
        return;
    }
    
    // 중복 확인 (수정 시 본인 제외)
    const duplicate = restaurants.find(r => 
        r.name === name && r.category === category && r.id !== editingRestaurantId
    );
    
    if (duplicate) {
        showError(nameError, '이미 등록된 음식점입니다.');
        return;
    }
    
    saveRestaurantBtn.disabled = true;
    saveRestaurantBtn.textContent = '저장 중...';
    
    try {
        const restaurantData = {
            name: name,
            category: category,
            updatedAt: timestamp()
        };
        
        if (editingRestaurantId) {
            // 기존 음식점 수정
            await db.collection('groups').doc(groupId)
                .collection('restaurants').doc(editingRestaurantId).update(restaurantData);
        } else {
            // 새 음식점 추가
            restaurantData.createdAt = timestamp();
            await db.collection('groups').doc(groupId)
                .collection('restaurants').add(restaurantData);
        }
        
        await loadRestaurants();
        closeRestaurantModal();
        
    } catch (error) {
        console.error('음식점 저장 오류:', error);
        showError(restaurantError, '저장 중 오류가 발생했습니다.');
        
        saveRestaurantBtn.disabled = false;
        saveRestaurantBtn.textContent = '저장';
    }
});

// ===== 음식점 삭제 =====
deleteRestaurantBtn.addEventListener('click', async () => {
    if (!confirm('이 음식점을 삭제하시겠습니까?')) {
        return;
    }
    
    deleteRestaurantBtn.disabled = true;
    deleteRestaurantBtn.textContent = '삭제 중...';
    
    try {
        await db.collection('groups').doc(groupId)
            .collection('restaurants').doc(editingRestaurantId).delete();
        
        await loadRestaurants();
        closeRestaurantModal();
        
    } catch (error) {
        console.error('음식점 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
        
        deleteRestaurantBtn.disabled = false;
        deleteRestaurantBtn.textContent = '삭제';
    }
});

// ===== Enter 키로 저장 =====
restaurantNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveRestaurantBtn.click();
    }
});

// ===== 뒤로 가기 =====
backBtn.addEventListener('click', () => {
    window.location.href = `home.html?groupId=${groupId}`;
});
