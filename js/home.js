// ===== 전역 변수 =====
let currentUser = null;
let currentUserRole = null;
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
// 상세보기 모달
const mealDetailModal = document.getElementById('meal-detail-modal');
const detailModalOverlay = document.getElementById('detail-modal-overlay');
const detailModalClose = document.getElementById('detail-modal-close');
const detailCloseBtn = document.getElementById('detail-close-btn');
const detailSelectedDate = document.getElementById('detail-selected-date');
const mealDetailList = document.getElementById('meal-detail-list');
const detailRestaurantName = document.getElementById('detail-restaurant-name');
const detailTotalAmount = document.getElementById('detail-total-amount');
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
    currentUserRole = access.role;
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


// ===== 멤버(그룹원) 유틸 =====
function getRegisteredMembers() {
    // groups/{groupId}/members 컬렉션에 등록된 멤버 중, 이름이 있는 항목만 사용
    return (members || []).filter(m => m && String(m.name || '').trim());
}

function getRegisteredMemberNames() {
    return getRegisteredMembers().map(m => String(m.name || '').trim());
}


// 공용 메뉴에 게스트 추가(방안 A)용 카운터
let sharedGuestCounter = 0;

function buildGuestCheckboxHtml(sharedId, guestName, checked = true) {
    sharedGuestCounter++;
    const guestId = `g${sharedId}_${sharedGuestCounter}`;
    const safeName = escapeHtml(guestName);
    const checkboxId = `shared-${sharedId}-guest-${guestId}`;
    return `
        <div class="member-checkbox guest" data-guest-id="${guestId}">
            <input type="checkbox" id="${checkboxId}" value="${safeName}" ${checked ? 'checked' : ''}>
            <label for="${checkboxId}">${safeName} (게스트)</label>
            <button type="button" class="guest-remove-btn" onclick="removeSharedGuest(${sharedId}, '${guestId}')">×</button>
        </div>
    `;
}

// 게스트 제거(공용 메뉴)
function removeSharedGuest(sharedId, guestId) {
    const item = sharedList.querySelector(`[data-shared-id="${sharedId}"]`);
    if (!item) return;
    const el = item.querySelector(`[data-guest-id="${guestId}"]`);
    if (el) el.remove();
    updateTotalAmount();
}

// 게스트 추가(공용 메뉴)
function addSharedGuest(sharedId) {
    const name = prompt('게스트 이름을 입력해 주세요.');
    const guestName = String(name || '').trim();
    if (!guestName) {
        alert('게스트 이름이 입력되지 않았습니다.');
        return;
    }

    const item = sharedList.querySelector(`[data-shared-id="${sharedId}"]`);
    if (!item) return;

    const container = item.querySelector('.member-select-container');
    if (!container) return;

    // 중복 방지(이미 같은 이름이 체크박스 목록에 있으면 추가하지 않음)
    const exists = Array.from(container.querySelectorAll('input[type="checkbox"]'))
        .some(cb => String(cb.value || '').trim() === guestName);
    if (exists) {
        alert('이미 함께 먹은 사람 목록에 있는 이름입니다.');
        return;
    }

    // + 게스트 추가 버튼(있으면) 앞에 삽입
    const addBtn = container.querySelector('.add-member-btn');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildGuestCheckboxHtml(sharedId, guestName, true).trim();
    const guestEl = wrapper.firstElementChild;
    if (addBtn) container.insertBefore(guestEl, addBtn);
    else container.appendChild(guestEl);

    updateTotalAmount();
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

// ===== 날짜 요소 생성 (개선 버전) =====
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

        // ⭐ 버튼 컨테이너 생성
        const btnContainer = document.createElement('div');
        btnContainer.className = 'day-actions';

        // ✏️ 수정 버튼 (항상 표시)
        const editBtn = document.createElement('button');
        editBtn.className = 'day-action-btn edit-btn';
        editBtn.type = 'button';
        editBtn.title = meal ? '수정' : '추가';
        editBtn.innerHTML = '✏️';
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openMealModal(date);
        });
        btnContainer.appendChild(editBtn);

        // ❌ 삭제 버튼 (기록이 있을 때만 표시)
        if (meal) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'day-action-btn delete-btn';
            deleteBtn.type = 'button';
            deleteBtn.title = '삭제';
            deleteBtn.innerHTML = '❌';
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!confirm('이 날짜의 식사 기록을 삭제하시겠습니까?')) {
                    return;
                }
                
                try {
                    await db.collection('groups').doc(groupId)
                        .collection('meals').doc(meal.id).delete();
                    
                    await loadMeals();
                    renderCalendar();
                } catch (error) {
                    console.error('삭제 오류:', error);
                    alert('삭제 중 오류가 발생했습니다.');
                }
            });
            btnContainer.appendChild(deleteBtn);
        }

        day.appendChild(btnContainer);

        if (meal) {
            day.classList.add('has-meal');
            
            // ⭐ 깔끔한 배지 (음식점 + 금액만)
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
            
            day.appendChild(badge);

            // 달력 셀 클릭 = 상세보기
            day.onclick = () => openMealDetailModal(date);
        } else {
            // 기록 없는 날: 달력 셀 클릭 = 추가
            day.onclick = () => openMealModal(date);
        }
    }
    
    return day;
}

// ===== 금액 포맷 =====
function formatCurrency(amount) {
    return amount.toLocaleString() + '원';
}

// 상세보기 모달 등에서 innerHTML 사용 시 XSS 방지용
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function closeMealDetailModal() {
    mealDetailModal.classList.add('hidden');
}

function openMealDetailModal(date) {
    const d = new Date(currentYear, currentMonth, date);
    const dateKey = getDateKey(d);
    const meal = mealsData[dateKey];

    if (!meal) {
        alert('해당 날짜에 기록이 없습니다.');
        return;
    }

    detailSelectedDate.textContent = formatDate(d);

    // 음식점명 표시
    const restName = meal.restaurantName || meal.restaurant || '';
    detailRestaurantName.textContent = restName ? `음식점: ${restName}` : '음식점: (미입력)';

    // 총합계(전체) 표시: totalAmount가 있으면 우선 사용, 없으면 orders+shared 합산
    let overallTotal = 0;
    if (meal.totalAmount != null) {
        overallTotal = Number(meal.totalAmount) || 0;
    } else {
        (meal.orders || []).forEach(o => { overallTotal += Number(o.amount) || 0; });
        (meal.shared || []).forEach(s => { overallTotal += Number(s.amount) || 0; });
    }
    detailTotalAmount.textContent = `총합계(전체): ${overallTotal.toLocaleString()}원`;


    // 사람별 요약(개별주문 + 공용메뉴 분배) 생성
    const map = new Map(); // name -> { menus:[], total:number }

    const addLine = (name, menu, amount) => {
        const key = name || '미지정';
        if (!map.has(key)) map.set(key, { menus: [], total: 0 });
        const obj = map.get(key);

        if (menu) obj.menus.push(menu);
        obj.total += (amount || 0);
    };

    // 개별 주문
    (meal.orders || []).forEach(o => {
        addLine(o.memberName, o.menu, o.amount || 0);
    });

    // 공용 메뉴: 참여자에게 1원 단위로 나눠 배분(총액 보존)
    (meal.shared || []).forEach(s => {
        const menu = s.menu || '(공용)';
        const total = s.amount || 0;
        const members = Array.isArray(s.members) ? s.members : [];
        const n = members.length;

        if (n <= 0) {
            addLine('공용', menu, total);
            return;
        }

        const base = Math.floor(total / n);
        const rem = total - (base * n);

        members.forEach((mName, idx) => {
            const pay = base + (idx < rem ? 1 : 0);
            addLine(mName, menu, pay);
        });
    });

    // 출력
    mealDetailList.innerHTML = '';
    if (map.size === 0) {
        mealDetailList.innerHTML = '<div class="detail-row"><div class="left">기록이 없습니다.</div><div class="right"></div></div>';
    } else {
        for (const [name, info] of map.entries()) {
            // 메뉴 중복 제거(순서 유지)
            const menus = [];
            const seen = new Set();
            (info.menus || []).forEach(m => {
                if (!m) return;
                if (seen.has(m)) return;
                seen.add(m);
                menus.push(m);
            });

            const leftText = `${name} / ${menus.join(', ') || '(메뉴 없음)'}`;
            const rightText = `${Number(info.total || 0).toLocaleString()}원`;

            const row = document.createElement('div');
            row.className = 'detail-row';
            row.innerHTML = `<div class="left">${escapeHtml(leftText)}</div><div class="right">${rightText}</div>`;
            mealDetailList.appendChild(row);
        }
    }

    mealDetailModal.classList.remove('hidden');
}

// 상세보기 닫기 이벤트
detailModalOverlay.addEventListener('click', closeMealDetailModal);
detailModalClose.addEventListener('click', closeMealDetailModal);
detailCloseBtn.addEventListener('click', closeMealDetailModal);


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


function onOrderMemberSelectChange(orderId) {
    const item = orderList.querySelector(`[data-order-id="${orderId}"]`);
    if (!item) return;

    const sel = item.querySelector('.order-member-select');
    const guestInput = item.querySelector('.order-guest-name');
    if (!sel || !guestInput) return;

    const isGuest = sel.value === '__guest__';
    if (isGuest) {
        guestInput.classList.remove('hidden');
        guestInput.focus();
    } else {
        guestInput.classList.add('hidden');
        guestInput.value = '';
    }
}

function initOrderMemberUI(orderId, memberName) {
    const item = orderList.querySelector(`[data-order-id="${orderId}"]`);
    if (!item) return;

    const sel = item.querySelector('.order-member-select');
    const guestInput = item.querySelector('.order-guest-name');
    if (!sel || !guestInput) return;

    const name = String(memberName || '').trim();
    const registered = getRegisteredMembers().some(m => String(m.name || '').trim() === name);

    if (name && registered) {
        sel.value = name;
        guestInput.classList.add('hidden');
        guestInput.value = '';
    } else if (name) {
        sel.value = '__guest__';
        guestInput.classList.remove('hidden');
        guestInput.value = name;
    } else {
        sel.value = '';
        guestInput.classList.add('hidden');
        guestInput.value = '';
    }
}

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
                <select class="order-member-select" onchange="onOrderMemberSelectChange(${orderCounter})">
                    <option value="">선택하세요</option>
                    ${getRegisteredMembers().map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
                    <option value="__guest__">+ 게스트 직접입력</option>
                </select>
                <input type="text" class="order-guest-name hidden" placeholder="게스트 이름 입력" value="">
                <div class="order-helper">※ '그룹원'은 선택 가능하며, 목록에 없는 인원은 '게스트 직접입력'을 선택 후 이름을 입력해 주십시오.</div>
            </div>
            <div class="field-row">
<div class="form-group">
    <label>메뉴 (선택)</label>
    <input type="text" class="shared-menu" placeholder="메뉴명 (선택사항)" value="${sharedData?.menu || ''}">
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
    
    // 이름 선택 UI 초기화(등록 그룹원 vs 게스트)
    initOrderMemberUI(orderCounter, orderData?.memberName || '');
    
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
    
    const baseMembers = getRegisteredMembers();

    const memberCheckboxes = baseMembers.map(m => `
        <div class="member-checkbox">
            <input type="checkbox" id="shared-${sharedCounter}-${m.id}" value="${escapeHtml(m.name)}" ${sharedData?.members?.includes(m.name) ? 'checked' : ''}>
            <label for="shared-${sharedCounter}-${m.id}">${escapeHtml(m.name)}</label>
        </div>
    `).join('');

    // 기존 데이터에 '등록 멤버' 목록에 없는 이름이 포함되어 있으면, 게스트로 표시
    const existingMembers = Array.isArray(sharedData?.members) ? sharedData.members : [];
    const baseNameSet = new Set(baseMembers.map(m => String(m.name || '').trim()));
    const guestNames = existingMembers.filter(nm => !baseNameSet.has(String(nm || '').trim()));

    const guestCheckboxes = guestNames.map(nm => buildGuestCheckboxHtml(sharedCounter, nm, true)).join('');
sharedItem.innerHTML = `
        <div class="shared-item-header">
            <span class="item-number">공용 #${sharedCounter}</span>
            <button class="btn-remove-item" onclick="removeSharedItem(${sharedCounter})">×</button>
        </div>
        <div class="order-fields">
            <div class="field-row">
                <div class="form-group">
    <label>메뉴 (선택)</label>
    <input type="text" class="order-menu" placeholder="메뉴명 (선택사항)" value="${orderData?.menu || ''}">
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
                    ${guestCheckboxes}
                    <button type="button" class="add-member-btn" onclick="addSharedGuest(${sharedCounter})">+ 게스트 추가</button>
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
        const sel = item.querySelector('.order-member-select');
        const guestInput = item.querySelector('.order-guest-name');
        let memberName = '';
        if (sel && sel.value === '__guest__') {
            memberName = String(guestInput ? guestInput.value : '').trim();
        } else {
            memberName = String(sel ? sel.value : '').trim();
        }
        const menu = item.querySelector('.order-menu').value.trim();
        const amount = parseAmount(item.querySelector('.order-amount').value);
        
if (memberName && amount > 0) {
    orders.push({ memberName, menu: menu || '', amount });
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
        
if (amount > 0 && selectedMembers.length > 0) {
    shared.push({ menu: menu || '', amount, members: selectedMembers });
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
    // 이름 선택 UI 초기화(등록 그룹원 vs 게스트)
    initOrderMemberUI(orderCounter, orderData?.memberName || '');
