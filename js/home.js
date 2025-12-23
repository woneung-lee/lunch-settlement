// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let groupData = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = null;
let editingMealId = null;
let restaurants = [];
let members = [];
let mealsData = {};

// ===== DOM 요소 =====
const backBtn = document.getElementById('back-btn');
const groupNameDisplay = document.getElementById('group-name-display');
const currentMonthDisplay = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const calendarDays = document.getElementById('calendar-days');
const fabBtn = document.getElementById('fab-btn');

// 하단 네비게이션 요소
const navMembers = document.getElementById('nav-members');
const navRestaurants = document.getElementById('nav-restaurants');
const navRoulette = document.getElementById('nav-roulette');
const navStats = document.getElementById('nav-stats');
const navSettings = document.getElementById('nav-settings');

// 모달 요소
const mealModal = document.getElementById('meal-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const selectedDateDisplay = document.getElementById('selected-date');
const restaurantSelect = document.getElementById('restaurant-select');
const newRestaurantGroup = document.getElementById('new-restaurant-group');
const newRestaurantName = document.getElementById('new-restaurant-name');
const restaurantCategory = document.getElementById('restaurant-category');
const ordersList = document.getElementById('orders-list');
const sharedList = document.getElementById('shared-list');
const addOrderBtn = document.getElementById('add-order-btn');
const addSharedBtn = document.getElementById('add-shared-btn');
const totalAmountDisplay = document.getElementById('total-amount');
const mealError = document.getElementById('meal-error');
const cancelBtn = document.getElementById('cancel-btn');
const deleteMealBtn = document.getElementById('delete-meal-btn');
const saveMealBtn = document.getElementById('save-meal-btn');

// ===== URL에서 groupId 가져오기 =====
const urlParams = new URLSearchParams(window.location.search);
groupId = urlParams.get('groupId');

if (!groupId) {
    alert('그룹 정보가 없습니다.');
    window.location.href = 'groups.html';
}

// ===== 인증 상태 확인 =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    await loadGroupData();
    await loadRestaurants();
    await loadMembers();
    await loadMeals();
    renderCalendar();
});

// ===== 그룹 데이터 로드 =====
async function loadGroupData() {
    try {
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (groupDoc.exists) {
            groupData = groupDoc.data();
            groupNameDisplay.textContent = groupData.groupName;
            document.title = `${groupData.groupName} - 점심 정산`;
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
        const snapshot = await db.collection('groups').doc(groupId)
            .collection('restaurants')
            .orderBy('name')
            .get();
        
        restaurants = [];
        snapshot.forEach(doc => {
            restaurants.push({ id: doc.id, ...doc.data() });
        });
        
        updateRestaurantSelect();
    } catch (error) {
        console.error('음식점 목록 로드 오류:', error);
    }
}

// ===== 음식점 선택 옵션 업데이트 =====
function updateRestaurantSelect() {
    const currentValue = restaurantSelect.value;
    restaurantSelect.innerHTML = '<option value="">음식점을 선택하세요</option>';
    
    restaurants.forEach(restaurant => {
        const option = document.createElement('option');
        option.value = restaurant.id;
        option.textContent = `${restaurant.name} (${restaurant.category})`;
        restaurantSelect.appendChild(option);
    });
    
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = '+ 새 음식점 추가';
    restaurantSelect.appendChild(newOption);
    
    if (currentValue) {
        restaurantSelect.value = currentValue;
    }
}

// ===== 그룹원 목록 로드 =====
async function loadMembers() {
    try {
        const snapshot = await db.collection('groups').doc(groupId)
            .collection('members')
            .orderBy('createdAt')
            .get();
        
        members = [];
        snapshot.forEach(doc => {
            members.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('그룹원 목록 로드 오류:', error);
    }
}

// ===== 식사 기록 로드 =====
async function loadMeals() {
    try {
        const startDate = new Date(currentYear, currentMonth, 1);
        const endDate = new Date(currentYear, currentMonth + 1, 0);
        
        const snapshot = await db.collection('groups').doc(groupId)
            .collection('meals')
            .where('date', '>=', firebase.firestore.Timestamp.fromDate(startDate))
            .where('date', '<=', firebase.firestore.Timestamp.fromDate(endDate))
            .get();
        
        mealsData = {};
        snapshot.forEach(doc => {
            const meal = doc.data();
            const dateKey = getDateKey(meal.date.toDate());
            mealsData[dateKey] = { id: doc.id, ...meal };
        });
    } catch (error) {
        console.error('식사 기록 로드 오류:', error);
    }
}

// ===== 날짜 키 생성 (YYYY-MM-DD) =====
function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ===== 캘린더 렌더링 =====
function renderCalendar() {
    currentMonthDisplay.textContent = `${currentYear}년 ${currentMonth + 1}월`;
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevLastDate = new Date(currentYear, currentMonth, 0).getDate();
    
    calendarDays.innerHTML = '';
    
    // 이전 달 날짜
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = createDayElement(prevLastDate - i, true);
        calendarDays.appendChild(day);
    }
    
    // 현재 달 날짜
    const today = new Date();
    for (let date = 1; date <= lastDate; date++) {
        const isToday = currentYear === today.getFullYear() && 
                       currentMonth === today.getMonth() && 
                       date === today.getDate();
        const day = createDayElement(date, false, isToday);
        calendarDays.appendChild(day);
    }
    
    // 다음 달 날짜
    const remainingDays = 42 - (firstDay + lastDate);
    for (let date = 1; date <= remainingDays; date++) {
        const day = createDayElement(date, true);
        calendarDays.appendChild(day);
    }
}

// ===== 날짜 요소 생성 =====
function createDayElement(date, isOtherMonth, isToday = false) {
    const day = document.createElement('div');
    day.className = 'calendar-day';
    
    if (isOtherMonth) {
        day.classList.add('other-month');
    }
    
    if (isToday) {
        day.classList.add('today');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date;
    day.appendChild(dayNumber);
    
    // 식사 기록이 있는지 확인
    if (!isOtherMonth) {
        const dateKey = getDateKey(new Date(currentYear, currentMonth, date));
        const meal = mealsData[dateKey];
        
        if (meal) {
            day.classList.add('has-meal');
            const badge = createDayBadge(meal);
            day.appendChild(badge);
        }
        
        day.onclick = () => openMealModal(date);
    }
    
    return day;
}

// ===== 날짜 배지 생성 =====
function createDayBadge(meal) {
    const badge = document.createElement('div');
    badge.className = 'day-badge';
    
    // 음식점명
    if (meal.restaurantName) {
        const restaurantDiv = document.createElement('div');
        restaurantDiv.className = 'restaurant-name';
        restaurantDiv.textContent = meal.restaurantName;
        badge.appendChild(restaurantDiv);
    }
    
    // 전체 합계
    const totalDiv = document.createElement('div');
    totalDiv.className = 'total-amount';
    totalDiv.textContent = formatCurrency(meal.totalAmount || 0);
    badge.appendChild(totalDiv);
    
    return badge;
}

// ===== 금액 포맷 =====
function formatCurrency(amount) {
    return amount.toLocaleString() + '원';
}

// ===== 금액 입력(쉼표) 처리 헬퍼 =====
function parseAmount(value) {
    const raw = String(value || '').replace(/[^\d]/g, ''); // 숫자만 남김(쉼표/공백 제거)
    return raw ? parseInt(raw, 10) : 0;
}

function formatAmountInput(inputEl) {
    const raw = String(inputEl.value || '').replace(/[^\d]/g, '');
    if (!raw) {
        inputEl.value = '';
        return;
    }
    inputEl.value = parseInt(raw, 10).toLocaleString();
}

function bindAmountInput(inputEl) {
    inputEl.addEventListener('input', () => {
        formatAmountInput(inputEl);
        updateTotalAmount();
    });
    inputEl.addEventListener('blur', () => {
        formatAmountInput(inputEl);
        updateTotalAmount();
    });
}

// ===== 이전/다음 달 이동 =====
prevMonthBtn.addEventListener('click', async () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    await loadMeals();
    renderCalendar();
});

nextMonthBtn.addEventListener('click', async () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    await loadMeals();
    renderCalendar();
});

// ===== 뒤로 가기 =====
backBtn.addEventListener('click', () => {
    window.location.href = 'groups.html';
});

// ===== 하단 네비게이션 =====
navMembers.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `members.html?groupId=${groupId}`;
});

navRestaurants.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `restaurants.html?groupId=${groupId}`;
});

navRoulette.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `roulette.html?groupId=${groupId}`;
});

navStats.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `stats.html?groupId=${groupId}`;
});

navSettings.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `settings.html?groupId=${groupId}`;
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

// ===== 모달 열기 (새 기록 또는 수정) =====
function openMealModal(date) {
    selectedDate = new Date(currentYear, currentMonth, date);
    const dateKey = getDateKey(selectedDate);
    const meal = mealsData[dateKey];
    
    if (meal) {
        // 기존 기록 수정
        editingMealId = meal.id;
        modalTitle.textContent = '식사 기록 수정';
        deleteMealBtn.classList.remove('hidden');
        loadMealData(meal);
    } else {
        // 새 기록 추가
        editingMealId = null;
        modalTitle.textContent = '식사 기록 추가';
        deleteMealBtn.classList.add('hidden');
        resetMealForm();
    }
    
    selectedDateDisplay.textContent = formatDate(selectedDate);
    mealModal.classList.remove('hidden');
    hideError(mealError);

    // 저장/삭제 버튼 상태 초기화(저장 중... 잔상 방지)
saveMealBtn.disabled = false;
saveMealBtn.textContent = '저장';
deleteMealBtn.disabled = false;
deleteMealBtn.textContent = '삭제';
    
}

// ===== 모달 닫기 =====
function closeMealModal() {
    mealModal.classList.add('hidden');
    resetMealForm();

    // 모달 닫을 때도 버튼 상태 초기화
saveMealBtn.disabled = false;
saveMealBtn.textContent = '저장';
deleteMealBtn.disabled = false;
deleteMealBtn.textContent = '삭제';
}

modalClose.addEventListener('click', closeMealModal);
modalOverlay.addEventListener('click', closeMealModal);
cancelBtn.addEventListener('click', closeMealModal);

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mealModal.classList.contains('hidden')) {
        closeMealModal();
    }
});

// ===== FAB 클릭 (오늘 날짜로 모달 열기) =====
fabBtn.addEventListener('click', () => {
    const today = new Date();
    if (today.getFullYear() === currentYear && today.getMonth() === currentMonth) {
        openMealModal(today.getDate());
    } else {
        // 현재 달의 1일로 열기
        openMealModal(1);
    }
});

// ===== 날짜 포맷 (YYYY년 M월 D일) =====
function formatDate(date) {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// ===== 폼 초기화 =====
function resetMealForm() {
    restaurantSelect.value = '';
    newRestaurantGroup.classList.add('hidden');
    newRestaurantName.value = '';
    restaurantCategory.value = '한식';
    ordersList.innerHTML = '';
    sharedList.innerHTML = '';
    updateTotalAmount();
}

// ===== 기존 식사 기록 로드 =====
function loadMealData(meal) {
    // 음식점 선택
    if (meal.restaurantId) {
        restaurantSelect.value = meal.restaurantId;
    } else if (meal.restaurantName) {
        // 음식점이 삭제된 경우
        restaurantSelect.value = 'new';
        newRestaurantGroup.classList.remove('hidden');
        newRestaurantName.value = meal.restaurantName;
        restaurantCategory.value = meal.category || '한식';
    }
    
    // 개별 주문
    ordersList.innerHTML = '';
    if (meal.orders && meal.orders.length > 0) {
        meal.orders.forEach((order, index) => {
            addOrderItem(order);
        });
    }
    
    // 공용 메뉴
    sharedList.innerHTML = '';
    if (meal.shared && meal.shared.length > 0) {
        meal.shared.forEach((shared, index) => {
            addSharedItem(shared);
        });
    }
    
    updateTotalAmount();
}

// ===== 음식점 선택 변경 =====
restaurantSelect.addEventListener('change', () => {
    if (restaurantSelect.value === 'new') {
        newRestaurantGroup.classList.remove('hidden');
        newRestaurantName.focus();
    } else {
        newRestaurantGroup.classList.add('hidden');
    }
});

// ===== 개별 주문 추가 =====
let orderCounter = 0;
addOrderBtn.addEventListener('click', () => {
    addOrderItem();
});

function addOrderItem(orderData = null) {
    orderCounter++;
    const orderItem = document.createElement('div');
    orderItem.className = 'order-item';
    orderItem.dataset.orderId = orderCounter;
    
    orderItem.innerHTML = `
        <div class="order-item-header">
            <span class="item-number">주문 #${orderCounter}</span>
            <button class="btn-remove-item" onclick="removeOrderItem(${orderCounter})">×</button>
        </div>
        <div class="order-fields">
            <div class="form-group">
                <label>이름</label>
                <input type="text" class="order-member" placeholder="그룹원을 선택하거나 입력" list="members-list-${orderCounter}" value="${orderData?.memberName || ''}">
                <datalist id="members-list-${orderCounter}">
                    ${members.map(m => `<option value="${m.name}">`).join('')}
                </datalist>
            </div>
            <div class="field-row">
                <div class="form-group">
                    <label>메뉴</label>
                    <input type="text" class="order-menu" placeholder="메뉴명" value="${orderData?.menu || ''}">
                </div>
                <div class="form-group">
                    <label>금액</label>
<input type="text" inputmode="numeric" class="order-amount" placeholder="0" value="${orderData?.amount != null ? Number(orderData.amount).toLocaleString() : ''}">
                </div>
            </div>
        </div>
    `;
    
    ordersList.appendChild(orderItem);
    
    // 금액 입력 시 합계 업데이트
bindAmountInput(orderItem.querySelector('.order-amount'));
    
    return orderItem;
}

function removeOrderItem(orderId) {
    const item = ordersList.querySelector(`[data-order-id="${orderId}"]`);
    if (item) {
        item.remove();
        updateTotalAmount();
    }
}

// ===== 공용 메뉴 추가 =====
let sharedCounter = 0;
addSharedBtn.addEventListener('click', () => {
    addSharedItem();
});

function addSharedItem(sharedData = null) {
    sharedCounter++;
    const sharedItem = document.createElement('div');
    sharedItem.className = 'shared-item';
    sharedItem.dataset.sharedId = sharedCounter;
    
    const memberCheckboxes = members.map(m => `
        <div class="member-checkbox">
            <input type="checkbox" id="shared-${sharedCounter}-${m.id}" value="${m.name}" ${sharedData?.members?.includes(m.name) ? 'checked' : ''}>
            <label for="shared-${sharedCounter}-${m.id}">${m.name}</label>
        </div>
    `).join('');
    
    sharedItem.innerHTML = `
        <div class="shared-item-header">
            <span class="item-number">공용 #${sharedCounter}</span>
            <button class="btn-remove-item" onclick="removeSharedItem(${sharedCounter})">×</button>
        </div>
        <div class="order-fields">
            <div class="field-row">
                <div class="form-group">
                    <label>메뉴</label>
                    <input type="text" class="shared-menu" placeholder="메뉴명" value="${sharedData?.menu || ''}">
                </div>
                <div class="form-group">
                    <label>총 금액</label>
<input type="text" inputmode="numeric" class="shared-amount" placeholder="0" value="${sharedData?.amount != null ? Number(sharedData.amount).toLocaleString() : ''}">
                </div>
            </div>
            <div class="form-group">
                <label>함께 먹은 사람</label>
                <div class="member-select-container">
                    ${memberCheckboxes}
                </div>
            </div>
        </div>
    `;
    
    sharedList.appendChild(sharedItem);
    
// 금액 입력(쉼표 포맷) + 합계 업데이트
bindAmountInput(sharedItem.querySelector('.shared-amount'));

    
    return sharedItem;
}

function removeSharedItem(sharedId) {
    const item = sharedList.querySelector(`[data-shared-id="${sharedId}"]`);
    if (item) {
        item.remove();
        updateTotalAmount();
    }
}

// ===== 합계 계산 및 업데이트 =====
function updateTotalAmount() {
    let total = 0;
    
    // 개별 주문 합계
    ordersList.querySelectorAll('.order-amount').forEach(input => {
        const amount = parseAmount(input.value);
        total += amount;
    });
    
    // 공용 메뉴 합계
    sharedList.querySelectorAll('.shared-amount').forEach(input => {
        const amount = parseAmount(input.value);
        total += amount;
    });
    
    totalAmountDisplay.textContent = formatCurrency(total);
}

// ===== 식사 기록 저장 =====
saveMealBtn.addEventListener('click', async () => {
    hideError(mealError);
    
    // 음식점 검증
    let restaurantId = null;
    let restaurantName = '';
    let category = '';
    
    if (restaurantSelect.value === 'new') {
        restaurantName = newRestaurantName.value.trim();
        category = restaurantCategory.value;
        
        if (!restaurantName) {
            showError(mealError, '음식점 이름을 입력해주세요.');
            return;
        }
        
        // 새 음식점 저장
        try {
            const restaurantRef = await db.collection('groups').doc(groupId)
                .collection('restaurants').add({
                    name: restaurantName,
                    category: category,
                    createdAt: timestamp()
                });
            restaurantId = restaurantRef.id;
            await loadRestaurants();
        } catch (error) {
            console.error('음식점 저장 오류:', error);
            showError(mealError, '음식점 저장 중 오류가 발생했습니다.');
            return;
        }
    } else if (restaurantSelect.value) {
        restaurantId = restaurantSelect.value;
        const restaurant = restaurants.find(r => r.id === restaurantId);
        restaurantName = restaurant.name;
        category = restaurant.category;
    } else {
        showError(mealError, '음식점을 선택해주세요.');
        return;
    }
    
    // 개별 주문 수집
    const orders = [];
    const orderItems = ordersList.querySelectorAll('.order-item');
    for (let item of orderItems) {
        const memberName = item.querySelector('.order-member').value.trim();
        const menu = item.querySelector('.order-menu').value.trim();
        const amount = parseAmount(item.querySelector('.order-amount').value);
        
        if (memberName && menu && amount > 0) {
            orders.push({ memberName, menu, amount });
            
            // 새 그룹원인 경우 그룹원으로 추가
            if (!members.find(m => m.name === memberName)) {
                try {
                    await db.collection('groups').doc(groupId)
                        .collection('members').add({
                            name: memberName,
                            isFrequent: false,
                            createdAt: timestamp()
                        });
                } catch (error) {
                    console.error('그룹원 추가 오류:', error);
                }
            }
        }
    }
    
    // 공용 메뉴 수집
    const shared = [];
    const sharedItems = sharedList.querySelectorAll('.shared-item');
    for (let item of sharedItems) {
        const menu = item.querySelector('.shared-menu').value.trim();
        const amount = parseAmount(item.querySelector('.shared-amount').value);
        const memberCheckboxes = item.querySelectorAll('input[type="checkbox"]:checked');
        const selectedMembers = Array.from(memberCheckboxes).map(cb => cb.value);
        
        if (menu && amount > 0 && selectedMembers.length > 0) {
            shared.push({ menu, amount, members: selectedMembers });
        }
    }
    
    // 최소 1개 주문 또는 공용 메뉴 필요
    if (orders.length === 0 && shared.length === 0) {
        showError(mealError, '최소 1개 이상의 주문 또는 공용 메뉴를 입력해주세요.');
        return;
    }
    
    // 전체 금액 계산
    let totalAmount = 0;
    orders.forEach(order => totalAmount += order.amount);
    shared.forEach(item => totalAmount += item.amount);
    
    // 식사 기록 데이터
    const mealData = {
        date: firebase.firestore.Timestamp.fromDate(selectedDate),
        restaurantId: restaurantId,
        restaurantName: restaurantName,
        category: category,
        orders: orders,
        shared: shared,
        totalAmount: totalAmount,
        updatedAt: timestamp()
    };
    
    saveMealBtn.disabled = true;
    saveMealBtn.textContent = '저장 중...';
    
    try {
        if (editingMealId) {
            // 기존 기록 수정
            await db.collection('groups').doc(groupId)
                .collection('meals').doc(editingMealId).update(mealData);
        } else {
            // 새 기록 생성
            mealData.createdAt = timestamp();
            await db.collection('groups').doc(groupId)
                .collection('meals').add(mealData);
        }
        
// 먼저 모달을 닫아 체감 속도 개선(저장은 이미 완료된 상태)
closeMealModal();

// 로딩은 병렬 처리하여 시간 단축
await Promise.all([loadMembers(), loadMeals()]);
renderCalendar();
        
    } catch (error) {
        console.error('식사 기록 저장 오류:', error);
        showError(mealError, '저장 중 오류가 발생했습니다.');
        
        saveMealBtn.disabled = false;
        saveMealBtn.textContent = '저장';
    }
});

// ===== 식사 기록 삭제 =====
deleteMealBtn.addEventListener('click', async () => {
    if (!confirm('이 식사 기록을 삭제하시겠습니까?')) {
        return;
    }
    
    deleteMealBtn.disabled = true;
    deleteMealBtn.textContent = '삭제 중...';
    
    try {
        await db.collection('groups').doc(groupId)
            .collection('meals').doc(editingMealId).delete();
        
        await loadMeals();
        renderCalendar();
        closeMealModal();
        
    } catch (error) {
        console.error('식사 기록 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
        
        deleteMealBtn.disabled = false;
        deleteMealBtn.textContent = '삭제';
    }
});
