// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let mealsData = [];
let statsData = {
    totalMeals: 0,
    totalAmount: 0,
    memberStats: [],
    restaurantVisits: [],
    restaurantSpending: []
};

// ===== DOM 요소 =====
const backBtn = document.getElementById('back-btn');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const loadStatsBtn = document.getElementById('load-stats-btn');
const presetBtns = document.querySelectorAll('.preset-btn');

const loadingState = document.getElementById('loading-state');
const statsContainer = document.getElementById('stats-container');
const emptyState = document.getElementById('empty-state');

// 요약 카드
const totalMealsEl = document.getElementById('total-meals');
const totalAmountEl = document.getElementById('total-amount');
const totalRestaurantsEl = document.getElementById('total-restaurants');

// 테이블
const membersTableBody = document.getElementById('members-table-body');
const visitTableBody = document.getElementById('visit-table-body');
const spendingTableBody = document.getElementById('spending-table-body');

// 내보내기 버튼
const exportExcelBtn = document.getElementById('export-excel-btn');
const exportImageBtn = document.getElementById('export-image-btn');

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
    initializeDates();
});

// ===== 날짜 초기화 (기본값: 이번 달) =====
function initializeDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    startDateInput.value = formatDateInput(firstDay);
    endDateInput.value = formatDateInput(lastDay);
}

// ===== 날짜 포맷 (YYYY-MM-DD) =====
function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ===== 기간 프리셋 =====
presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        const today = new Date();
        let startDate, endDate;
        
        switch (preset) {
            case 'this-month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'last-month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'this-year':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;
        }
        
        startDateInput.value = formatDateInput(startDate);
        endDateInput.value = formatDateInput(endDate);
    });
});

// ===== 통계 조회 =====
loadStatsBtn.addEventListener('click', async () => {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    if (!startDateInput.value || !endDateInput.value) {
        alert('시작일과 종료일을 선택해주세요.');
        return;
    }
    
    if (startDate > endDate) {
        alert('시작일이 종료일보다 늦을 수 없습니다.');
        return;
    }
    
    await loadMeals(startDate, endDate);
});

// ===== 식사 기록 로드 =====
async function loadMeals(startDate, endDate) {
    try {
        showLoading();
        
        // 시작일 00:00:00
        const startTimestamp = firebase.firestore.Timestamp.fromDate(
            new Date(startDate.setHours(0, 0, 0, 0))
        );
        
        // 종료일 23:59:59
        const endTimestamp = firebase.firestore.Timestamp.fromDate(
            new Date(endDate.setHours(23, 59, 59, 999))
        );
        
        const snapshot = await db.collection('groups').doc(groupId)
            .collection('meals')
            .where('date', '>=', startTimestamp)
            .where('date', '<=', endTimestamp)
            .get();
        
        mealsData = [];
        snapshot.forEach(doc => {
            mealsData.push({ id: doc.id, ...doc.data() });
        });
        
        if (mealsData.length === 0) {
            showEmptyState();
        } else {
            calculateStats();
            renderStats();
            showStatsContainer();
        }
        
    } catch (error) {
        console.error('식사 기록 로드 오류:', error);
        alert('통계를 불러오는 중 오류가 발생했습니다.');
        showEmptyState();
    }
}

// ===== 통계 계산 =====
function calculateStats() {
    // 초기화
    const memberTotals = {};
    const restaurantVisits = {};
    const restaurantSpending = {};
    let totalAmount = 0;
    
    // 각 식사 기록 처리
    mealsData.forEach(meal => {
        totalAmount += meal.totalAmount || 0;
        
        // 음식점 방문/지출 통계
        const restaurantKey = `${meal.restaurantName}|${meal.category}`;
        
        if (!restaurantVisits[restaurantKey]) {
            restaurantVisits[restaurantKey] = {
                name: meal.restaurantName,
                category: meal.category,
                count: 0,
                totalAmount: 0
            };
        }
        restaurantVisits[restaurantKey].count++;
        restaurantVisits[restaurantKey].totalAmount += meal.totalAmount || 0;
        
        // 개별 주문 처리
        if (meal.orders && meal.orders.length > 0) {
            meal.orders.forEach(order => {
                if (!memberTotals[order.memberName]) {
                    memberTotals[order.memberName] = 0;
                }
                memberTotals[order.memberName] += order.amount || 0;
            });
        }
        
        // 공용 메뉴 처리 (N분배)
        if (meal.shared && meal.shared.length > 0) {
            meal.shared.forEach(shared => {
                const splitAmount = Math.floor(shared.amount / shared.members.length);
                shared.members.forEach(memberName => {
                    if (!memberTotals[memberName]) {
                        memberTotals[memberName] = 0;
                    }
                    memberTotals[memberName] += splitAmount;
                });
            });
        }
    });
    
    // 사람별 통계 배열로 변환 및 정렬
    const memberStats = Object.entries(memberTotals)
        .map(([name, amount]) => ({
            name,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
    
    // 음식점별 방문 랭킹 (방문 횟수 기준)
    const restaurantVisitsArray = Object.values(restaurantVisits)
        .sort((a, b) => b.count - a.count);
    
    // 음식점별 지출 랭킹 (지출액 기준)
    const restaurantSpendingArray = Object.values(restaurantVisits)
        .sort((a, b) => b.totalAmount - a.totalAmount);
    
    // 결과 저장
    statsData = {
        totalMeals: mealsData.length,
        totalAmount: totalAmount,
        totalRestaurants: Object.keys(restaurantVisits).length,
        memberStats: memberStats,
        restaurantVisits: restaurantVisitsArray,
        restaurantSpending: restaurantSpendingArray
    };
}

// ===== 통계 렌더링 =====
function renderStats() {
    // 요약 카드
    totalMealsEl.textContent = `${statsData.totalMeals}회`;
    totalAmountEl.textContent = formatCurrency(statsData.totalAmount);
    totalRestaurantsEl.textContent = `${statsData.totalRestaurants}곳`;
    
    // 사람별 지출액 테이블
    membersTableBody.innerHTML = '';
    statsData.memberStats.forEach((member, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="rank rank-${index + 1 <= 3 ? index + 1 : ''}">${index + 1}</span></td>
            <td>${escapeHtml(member.name)}</td>
            <td class="amount">${formatCurrency(member.amount)}</td>
            <td class="percentage">${member.percentage}%</td>
        `;
        membersTableBody.appendChild(row);
    });
    
    // 음식점별 방문 랭킹
    visitTableBody.innerHTML = '';
    statsData.restaurantVisits.forEach((restaurant, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="rank rank-${index + 1 <= 3 ? index + 1 : ''}">${index + 1}</span></td>
            <td>${escapeHtml(restaurant.name)}</td>
            <td><span class="category-badge">${restaurant.category}</span></td>
            <td><strong>${restaurant.count}회</strong></td>
        `;
        visitTableBody.appendChild(row);
    });
    
    // 음식점별 지출 랭킹
    spendingTableBody.innerHTML = '';
    statsData.restaurantSpending.forEach((restaurant, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="rank rank-${index + 1 <= 3 ? index + 1 : ''}">${index + 1}</span></td>
            <td>${escapeHtml(restaurant.name)}</td>
            <td><span class="category-badge">${restaurant.category}</span></td>
            <td class="amount">${formatCurrency(restaurant.totalAmount)}</td>
        `;
        spendingTableBody.appendChild(row);
    });
}

// ===== 금액 포맷 =====
function formatCurrency(amount) {
    return amount.toLocaleString() + '원';
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
    statsContainer.classList.add('hidden');
    emptyState.classList.add('hidden');
}

function showStatsContainer() {
    loadingState.classList.add('hidden');
    statsContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

function showEmptyState() {
    loadingState.classList.add('hidden');
    statsContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

// ===== Excel 내보내기 =====
exportExcelBtn.addEventListener('click', () => {
    // 워크북 생성
    const wb = XLSX.utils.book_new();
    
    // 요약 시트
    const summaryData = [
        ['점심 정산 통계'],
        ['기간', `${startDateInput.value} ~ ${endDateInput.value}`],
        [],
        ['총 식사 횟수', statsData.totalMeals + '회'],
        ['총 지출 금액', statsData.totalAmount + '원'],
        ['방문 음식점', statsData.totalRestaurants + '곳']
    ];
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWS, '요약');
    
    // 사람별 지출액 시트
    const memberData = [
        ['순위', '이름', '지출액', '비율']
    ];
    statsData.memberStats.forEach((member, index) => {
        memberData.push([
            index + 1,
            member.name,
            member.amount,
            member.percentage + '%'
        ]);
    });
    const memberWS = XLSX.utils.aoa_to_sheet(memberData);
    XLSX.utils.book_append_sheet(wb, memberWS, '사람별 지출');
    
    // 음식점별 방문 랭킹 시트
    const visitData = [
        ['순위', '음식점', '카테고리', '방문 횟수']
    ];
    statsData.restaurantVisits.forEach((restaurant, index) => {
        visitData.push([
            index + 1,
            restaurant.name,
            restaurant.category,
            restaurant.count + '회'
        ]);
    });
    const visitWS = XLSX.utils.aoa_to_sheet(visitData);
    XLSX.utils.book_append_sheet(wb, visitWS, '방문 랭킹');
    
    // 음식점별 지출 랭킹 시트
    const spendingData = [
        ['순위', '음식점', '카테고리', '총 지출액']
    ];
    statsData.restaurantSpending.forEach((restaurant, index) => {
        spendingData.push([
            index + 1,
            restaurant.name,
            restaurant.category,
            restaurant.totalAmount
        ]);
    });
    const spendingWS = XLSX.utils.aoa_to_sheet(spendingData);
    XLSX.utils.book_append_sheet(wb, spendingWS, '지출 랭킹');
    
    // 파일 다운로드
    const fileName = `점심정산_${startDateInput.value}_${endDateInput.value}.xlsx`;
    XLSX.writeFile(wb, fileName);
});

// ===== 이미지 내보내기 =====
exportImageBtn.addEventListener('click', async () => {
    try {
        exportImageBtn.disabled = true;
        exportImageBtn.textContent = '이미지 생성 중...';
        
        // html2canvas로 캡처
        const canvas = await html2canvas(statsContainer, {
            backgroundColor: '#F5F7FA',
            scale: 2
        });
        
        // 이미지로 변환
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `점심정산_${startDateInput.value}_${endDateInput.value}.png`;
            a.click();
            URL.revokeObjectURL(url);
            
            exportImageBtn.disabled = false;
            exportImageBtn.textContent = '📸 이미지 저장';
        });
        
    } catch (error) {
        console.error('이미지 내보내기 오류:', error);
        alert('이미지 저장 중 오류가 발생했습니다.');
        
        exportImageBtn.disabled = false;
        exportImageBtn.textContent = '📸 이미지 저장';
    }
});

// ===== 뒤로 가기 =====
backBtn.addEventListener('click', () => {
    window.location.href = `home.html?groupId=${groupId}`;
});
