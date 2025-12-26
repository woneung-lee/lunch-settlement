// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let groupData = null;
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
const shareRestaurantCheckbox = document.getElementById('share-restaurant');
const shareDetails = document.getElementById('share-details');
const shareReasonTextarea = document.getElementById('share-reason');
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

// ===== 하단 네비게이션 링크 세팅 =====
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
        if (el.tagName && el.tagName.toLowerCase() === 'a') {
            el.setAttribute('href', url);
            return;
        }
        el.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = url;
        });
    });
})();

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

// ===== 인증 상태 확인 =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    const access = await ensureGroupAccess(user, groupId);
    if (!access) return;
    await loadGroupData();
    await loadRestaurants();
});

// ===== 그룹 데이터 로드 =====
async function loadGroupData() {
    try {
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (groupDoc.exists) {
            groupData = { id: groupDoc.id, ...groupDoc.data() };
        } else {
            alert('그룹을 찾을 수 없습니다.');
            window.location.href = 'groups.html';
        }
    } catch (error) {
        console.error('그룹 로드 오류:', error);
        alert('그룹 정보를 불러오는 중 오류가 발생했습니다.');
        window.location.href = 'groups.html';
    }
}

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
    if (restaurant.isShared) {
        card.classList.add('shared');
    }
    card.onclick = () => openRestaurantModal(restaurant.id);
    
    const createdDate = restaurant.createdAt ? 
        new Date(restaurant.createdAt.toDate()).toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : '날짜 정보 없음';
    
    const categoryEmoji = getCategoryEmoji(restaurant.category);
    const shareBadge = restaurant.isShared ? '<span class="share-badge">공유됨</span>' : '';
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-icon">${categoryEmoji}</div>
            <span class="category-badge">${escapeHtml(restaurant.category)}${shareBadge}</span>
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

// ===== HTML 이스케이프 =====
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
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.category;
        renderRestaurants();
    });
});

// ===== 공유 체크박스 토글 =====
shareRestaurantCheckbox.addEventListener('change', () => {
    if (shareRestaurantCheckbox.checked) {
        shareDetails.classList.remove('hidden');
        shareReasonTextarea.focus();
    } else {
        shareDetails.classList.add('hidden');
        shareReasonTextarea.value = '';
    }
});

// ===== 모달 열기 =====
function openRestaurantModal(restaurantId = null) {
    if (restaurantId) {
        const restaurant = restaurants.find(r => r.id === restaurantId);
        if (!restaurant) return;
        
        editingRestaurantId = restaurantId;
        modalTitle.textContent = '음식점 수정';
        deleteRestaurantBtn.classList.remove('hidden');
        
        restaurantNameInput.value = restaurant.name;
        restaurantCategorySelect.value = restaurant.category;
        shareRestaurantCheckbox.checked = restaurant.isShared || false;
        shareReasonTextarea.value = restaurant.shareReason || '';
        
        if (shareRestaurantCheckbox.checked) {
            shareDetails.classList.remove('hidden');
        } else {
            shareDetails.classList.add('hidden');
        }
    } else {
        editingRestaurantId = null;
        modalTitle.textContent = '음식점 추가';
        deleteRestaurantBtn.classList.add('hidden');
        
        restaurantNameInput.value = '';
        restaurantCategorySelect.value = '한식';
        shareRestaurantCheckbox.checked = false;
        shareReasonTextarea.value = '';
        shareDetails.classList.add('hidden');
    }
    
    restaurantModal.classList.remove('hidden');
    restaurantNameInput.focus();
    hideError(nameError);
    hideError(restaurantError);

    saveRestaurantBtn.disabled = false;
    saveRestaurantBtn.textContent = '저장';
    deleteRestaurantBtn.disabled = false;
    deleteRestaurantBtn.textContent = '삭제';
}

// ===== 모달 닫기 =====
function closeRestaurantModal() {
    restaurantModal.classList.add('hidden');
    saveRestaurantBtn.disabled = false;
    saveRestaurantBtn.textContent = '저장';
    deleteRestaurantBtn.disabled = false;
    deleteRestaurantBtn.textContent = '삭제';
}

modalClose.addEventListener('click', closeRestaurantModal);
modalOverlay.addEventListener('click', closeRestaurantModal);
cancelBtn.addEventListener('click', closeRestaurantModal);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !restaurantModal.classList.contains('hidden')) {
        closeRestaurantModal();
    }
});

fabBtn.addEventListener('click', () => {
    openRestaurantModal();
});

// ===== 에러 메시지 =====
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
    const isShared = shareRestaurantCheckbox.checked;
    const shareReason = shareReasonTextarea.value.trim();
    
    // 유효성 검사
    if (!name) {
        showError(nameError, '음식점 이름을 입력해주세요.');
        return;
    }
    
    if (name.length > 30) {
        showError(nameError, '음식점 이름은 최대 30자까지 가능합니다.');
        return;
    }
    
    // 그룹 데이터에 지점 정보가 없으면 공유 불가
    if (isShared && !groupData.branchId) {
        showError(restaurantError, '지점 정보가 없는 그룹은 맛집을 공유할 수 없습니다.');
        return;
    }
    
    // 중복 확인
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
            isShared: isShared,
            shareReason: isShared ? shareReason : null,
            updatedAt: timestamp()
        };
        
        if (editingRestaurantId) {
            // 기존 음식점 수정
            await db.collection('groups').doc(groupId)
                .collection('restaurants').doc(editingRestaurantId).update(restaurantData);
            
            // 공유 상태 변경 처리
            if (isShared) {
                await shareRestaurant(editingRestaurantId, name, category, shareReason);
            } else {
                await unshareRestaurant(editingRestaurantId);
            }
        } else {
            // 새 음식점 추가
            restaurantData.createdAt = timestamp();
            const docRef = await db.collection('groups').doc(groupId)
                .collection('restaurants').add(restaurantData);
            
            // 공유 처리
            if (isShared) {
                await shareRestaurant(docRef.id, name, category, shareReason);
            }
        }
        
        closeRestaurantModal();
        await loadRestaurants();
        
    } catch (error) {
        console.error('음식점 저장 오류:', error);
        showError(restaurantError, '저장 중 오류가 발생했습니다.');
        
        saveRestaurantBtn.disabled = false;
        saveRestaurantBtn.textContent = '저장';
    }
});

// ===== 맛집 공유 =====
async function shareRestaurant(restaurantId, name, category, reason) {
    try {
        // sharedRestaurants 컬렉션에 추가
        await db.collection('sharedRestaurants').add({
            // 음식점 정보
            restaurantId: restaurantId,
            restaurantName: name,
            category: category,
            
            // 지점 정보
            branchId: groupData.branchId,
            branchName: groupData.branchName,
            branchFullPath: groupData.branchFullPath,
            branchType: groupData.branchType,
            branchLevel: groupData.branchLevel,
            
            // 그룹 정보 (그룹명만!)
            groupId: groupId,
            groupName: groupData.groupName,
            
            // 공유 내용
            reason: reason || '',
            
            // 내부 참조용 (UI에 절대 표시 안 함!)
            sharedBy: currentUser.uid,
            sharedAt: timestamp()
        });
    } catch (error) {
        console.error('맛집 공유 오류:', error);
        throw error;
    }
}

// ===== 맛집 공유 취소 =====
async function unshareRestaurant(restaurantId) {
    try {
        // 해당 음식점의 공유 기록 삭제
        const snapshot = await db.collection('sharedRestaurants')
            .where('groupId', '==', groupId)
            .where('restaurantId', '==', restaurantId)
            .get();
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error('맛집 공유 취소 오류:', error);
        throw error;
    }
}

// ===== 음식점 삭제 =====
deleteRestaurantBtn.addEventListener('click', async () => {
    if (!confirm('이 음식점을 삭제하시겠습니까?')) {
        return;
    }
    
    deleteRestaurantBtn.disabled = true;
    deleteRestaurantBtn.textContent = '삭제 중...';
    
    try {
        // 음식점 삭제
        await db.collection('groups').doc(groupId)
            .collection('restaurants').doc(editingRestaurantId).delete();
        
        // 공유 기록도 삭제
        await unshareRestaurant(editingRestaurantId);
        
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

