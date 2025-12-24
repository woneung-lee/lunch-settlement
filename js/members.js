// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let members = [];
let editingMemberId = null;

// ===== DOM 요소 =====
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const membersContainer = document.getElementById('members-container');
const membersList = document.getElementById('members-list');
const fabBtn = document.getElementById('fab-btn');

// 하단 네비게이션
const navHome = document.getElementById('nav-home');
const navMembers = document.getElementById('nav-members');
const navRestaurants = document.getElementById('nav-restaurants');
const navRoulette = document.getElementById('nav-roulette');
const navStats = document.getElementById('nav-stats');
const navSettings = document.getElementById('nav-settings');

// 모달 요소
const memberModal = document.getElementById('member-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const memberNameInput = document.getElementById('member-name');
const nameError = document.getElementById('name-error');
const memberError = document.getElementById('member-error');
const cancelBtn = document.getElementById('cancel-btn');
const deleteMemberBtn = document.getElementById('delete-member-btn');
const saveMemberBtn = document.getElementById('save-member-btn');

// ===== URL에서 groupId 가져오기 =====
const urlParams = new URLSearchParams(window.location.search);
groupId = urlParams.get('groupId');

if (!groupId) {
    alert('그룹 정보가 없습니다.');
    window.location.href = 'groups.html';
}

// 하단 네비게이션 이동(그룹ID 유지)
if (navHome) navHome.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `home.html?groupId=${groupId}`;
});
if (navRestaurants) navRestaurants.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `restaurants.html?groupId=${groupId}`;
});
if (navRoulette) navRoulette.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `roulette.html?groupId=${groupId}`;
});
if (navStats) navStats.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `stats.html?groupId=${groupId}`;
});
if (navSettings) navSettings.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `settings.html?groupId=${groupId}`;
});

// 현재 페이지 탭 클릭 시 이동 방지(선택사항이지만 UX상 안전)
if (navMembers) navMembers.addEventListener('click', (e) => e.preventDefault());

// ===== 인증 상태 확인 =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    await loadMembers();
});

// ===== 그룹원 목록 로드 =====
async function loadMembers() {
    try {
        showLoading();
        
        const snapshot = await db.collection('groups').doc(groupId)
            .collection('members')
            .orderBy('createdAt', 'desc')
            .get();
        
        members = [];
        snapshot.forEach(doc => {
            members.push({ id: doc.id, ...doc.data() });
        });
        
        renderMembers();
        showMembersList();
        
    } catch (error) {
        console.error('그룹원 목록 로드 오류:', error);
        alert('그룹원 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// ===== 그룹원 목록 렌더링 =====
function renderMembers() {
    membersList.innerHTML = '';
    
    members.forEach(member => {
        const card = createMemberCard(member);
        membersList.appendChild(card);
    });
}

// ===== 그룹원 카드 생성 =====
function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.onclick = () => openMemberModal(member.id);
    
    const createdDate = member.createdAt ? 
        new Date(member.createdAt.toDate()).toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : '날짜 정보 없음';
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-icon">👤</div>
        </div>
        <div class="card-name">${escapeHtml(member.name)}</div>
        <div class="card-info">
            <div class="card-info-item">
                <span class="card-info-icon">📅</span>
                <span>${createdDate}</span>
            </div>
        </div>
    `;
    
    return card;
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
    membersContainer.classList.add('hidden');
}

function showMembersList() {
    loadingState.classList.add('hidden');
    membersContainer.classList.remove('hidden');
}

// ===== 모달 열기 (새 그룹원 또는 수정) =====
function openMemberModal(memberId = null) {
    if (memberId) {
        // 기존 그룹원 수정
        const member = members.find(m => m.id === memberId);
        if (!member) return;
        
        editingMemberId = memberId;
        modalTitle.textContent = '그룹원 수정';
        deleteMemberBtn.classList.remove('hidden');
        
        memberNameInput.value = member.name;
    } else {
        // 새 그룹원 추가
        editingMemberId = null;
        modalTitle.textContent = '그룹원 추가';
        deleteMemberBtn.classList.add('hidden');
        
        memberNameInput.value = '';

        // 저장/삭제 버튼 상태 초기화(저장 중... 잔상 방지)
        saveMemberBtn.disabled = false;
        saveMemberBtn.textContent = '저장';
        deleteMemberBtn.disabled = false;
        deleteMemberBtn.textContent = '삭제';
    }
    
    memberModal.classList.remove('hidden');
    memberNameInput.focus();
    hideError(nameError);
    hideError(memberError);
}

// ===== 모달 닫기 =====
function closeMemberModal() {
    memberModal.classList.add('hidden');
    
    // 모달 닫을 때도 버튼 상태 초기화
    saveMemberBtn.disabled = false;
    saveMemberBtn.textContent = '저장';
    deleteMemberBtn.disabled = false;
    deleteMemberBtn.textContent = '삭제';
}

modalClose.addEventListener('click', closeMemberModal);
modalOverlay.addEventListener('click', closeMemberModal);
cancelBtn.addEventListener('click', closeMemberModal);

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !memberModal.classList.contains('hidden')) {
        closeMemberModal();
    }
});

// ===== FAB 클릭 =====
fabBtn.addEventListener('click', () => {
    openMemberModal();
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

// ===== 그룹원 저장 =====
saveMemberBtn.addEventListener('click', async () => {
    hideError(nameError);
    hideError(memberError);
    
    const name = memberNameInput.value.trim();
    
    // 유효성 검사
    if (!name) {
        showError(nameError, '이름을 입력해주세요.');
        return;
    }
    
    if (name.length > 20) {
        showError(nameError, '이름은 최대 20자까지 가능합니다.');
        return;
    }
    
    // 중복 확인 (수정 시 본인 제외)
    const duplicate = members.find(m => 
        m.name === name && m.id !== editingMemberId
    );
    
    if (duplicate) {
        showError(nameError, '이미 등록된 이름입니다.');
        return;
    }
    
    saveMemberBtn.disabled = true;
    saveMemberBtn.textContent = '저장 중...';
    
    try {
        const memberData = {
            name: name,
            updatedAt: timestamp()
        };
        
        if (editingMemberId) {
            // 기존 그룹원 수정
            await db.collection('groups').doc(groupId)
                .collection('members').doc(editingMemberId).update(memberData);
        } else {
            // 새 그룹원 추가
            memberData.createdAt = timestamp();
            await db.collection('groups').doc(groupId)
                .collection('members').add(memberData);
        }
        
        closeMemberModal();
        await loadMembers();
        
    } catch (error) {
        console.error('그룹원 저장 오류:', error);
        showError(memberError, '저장 중 오류가 발생했습니다.');
        
        saveMemberBtn.disabled = false;
        saveMemberBtn.textContent = '저장';
    }
});

// ===== 그룹원 삭제 =====
deleteMemberBtn.addEventListener('click', async () => {
    if (!confirm('이 그룹원을 삭제하시겠습니까?')) {
        return;
    }
    
    deleteMemberBtn.disabled = true;
    deleteMemberBtn.textContent = '삭제 중...';
    
    try {
        await db.collection('groups').doc(groupId)
            .collection('members').doc(editingMemberId).delete();
        
        await loadMembers();
        closeMemberModal();
        
    } catch (error) {
        console.error('그룹원 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
        
        deleteMemberBtn.disabled = false;
        deleteMemberBtn.textContent = '삭제';
    }
});

// ===== Enter 키로 저장 =====
memberNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveMemberBtn.click();
    }
});

// ===== 뒤로 가기 =====
backBtn.addEventListener('click', () => {
    window.location.href = `home.html?groupId=${groupId}`;
});
