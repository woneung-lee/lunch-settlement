// ===== DOM 요소 =====
const tabBtns = document.querySelectorAll('.tab-btn');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// 로그인 요소
const loginId = document.getElementById('login-id');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

// 회원가입 요소
const signupId = document.getElementById('signup-id');
const signupPassword = document.getElementById('signup-password');
const signupPasswordConfirm = document.getElementById('signup-password-confirm');
const signupBtn = document.getElementById('signup-btn');
const idError = document.getElementById('id-error');
const passwordError = document.getElementById('password-error');
const passwordConfirmError = document.getElementById('password-confirm-error');
const signupError = document.getElementById('signup-error');

// ===== 유효성 검사 정규식 =====
const ID_REGEX = /^[a-z0-9_-]{5,20}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!"#$%&'()*+,\-./:;?@[\\\]^_`{|}~])[A-Za-z\d!"#$%&'()*+,\-./:;?@[\\\]^_`{|}~]{8,16}$/;

// ===== 탭 전환 =====
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // 모든 탭 버튼 비활성화
        tabBtns.forEach(b => b.classList.remove('active'));
        // 클릭한 탭 활성화
        btn.classList.add('active');
        
        // 폼 전환
        const tab = btn.dataset.tab;
        if (tab === 'login') {
            loginForm.classList.add('active');
            signupForm.classList.remove('active');
            clearErrors();
        } else {
            signupForm.classList.add('active');
            loginForm.classList.remove('active');
            clearErrors();
        }
    });
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

function clearErrors() {
    hideError(loginError);
    hideError(idError);
    hideError(passwordError);
    hideError(passwordConfirmError);
    hideError(signupError);
}

// ===== 아이디 유효성 검사 =====
function validateId(id) {
    if (!ID_REGEX.test(id)) {
        return {
            valid: false,
            message: '사용할 수 없는 아이디입니다. 다른 아이디를 입력해 주세요.'
        };
    }
    return { valid: true };
}

// ===== 비밀번호 유효성 검사 =====
function validatePassword(password) {
    if (!PASSWORD_REGEX.test(password)) {
        return {
            valid: false,
            message: '비밀번호는 8~16자, 영문/숫자/특수문자를 포함해야 합니다.'
        };
    }
    return { valid: true };
}

// ===== 실시간 입력 검증 =====
signupId.addEventListener('blur', () => {
    const result = validateId(signupId.value);
    if (!result.valid) {
        showError(idError, result.message);
    } else {
        hideError(idError);
    }
});

signupPassword.addEventListener('blur', () => {
    const result = validatePassword(signupPassword.value);
    if (!result.valid) {
        showError(passwordError, result.message);
    } else {
        hideError(passwordError);
    }
});

signupPasswordConfirm.addEventListener('blur', () => {
    if (signupPassword.value !== signupPasswordConfirm.value) {
        showError(passwordConfirmError, '비밀번호가 일치하지 않습니다.');
    } else {
        hideError(passwordConfirmError);
    }
});

// ===== 회원가입 =====
signupBtn.addEventListener('click', async () => {
    clearErrors();
    
    const id = signupId.value.trim();
    const password = signupPassword.value;
    const passwordConfirm = signupPasswordConfirm.value;
    
    // 유효성 검사
    const idValidation = validateId(id);
    if (!idValidation.valid) {
        showError(idError, idValidation.message);
        return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        showError(passwordError, passwordValidation.message);
        return;
    }
    
    if (password !== passwordConfirm) {
        showError(passwordConfirmError, '비밀번호가 일치하지 않습니다.');
        return;
    }
    
    // Firebase 이메일 형식으로 변환 (아이디@lunch-app.com)
    const email = `${id}@lunch-app.com`;
    
    signupBtn.disabled = true;
    signupBtn.textContent = '가입 중...';
    
    try {
        // Firebase 회원가입
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Firestore에 사용자 정보 저장
        await db.collection('users').doc(user.uid).set({
            userId: id,
            email: email,
            createdAt: timestamp(),
            updatedAt: timestamp()
        });
        
        // 그룹 목록 페이지로 이동
        window.location.href = 'groups.html';
        
    } catch (error) {
        console.error('회원가입 오류:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            showError(signupError, '타인이 이미 사용중이거나 탈퇴된 아이디입니다. 다른 아이디를 입력하여 가입을 시도하세요.');
        } else if (error.code === 'auth/weak-password') {
            showError(signupError, '비밀번호가 너무 약합니다.');
        } else {
            showError(signupError, '회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
        
        signupBtn.disabled = false;
        signupBtn.textContent = '회원가입';
    }
});

// ===== 로그인 =====
loginBtn.addEventListener('click', async () => {
    clearErrors();
    
    const id = loginId.value.trim();
    const password = loginPassword.value;
    
    if (!id || !password) {
        showError(loginError, '아이디와 비밀번호를 입력해주세요.');
        return;
    }
    
    // Firebase 이메일 형식으로 변환
    const email = `${id}@lunch-app.com`;
    
    loginBtn.disabled = true;
    loginBtn.textContent = '로그인 중...';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        
        // 그룹 목록 페이지로 이동
        window.location.href = 'groups.html';
        
    } catch (error) {
        console.error('로그인 오류:', error);
        
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showError(loginError, '아이디 또는 비밀번호가 올바르지 않습니다.');
        } else if (error.code === 'auth/invalid-email') {
            showError(loginError, '올바른 아이디를 입력해주세요.');
        } else {
            showError(loginError, '로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
        
        loginBtn.disabled = false;
        loginBtn.textContent = '로그인';
    }
});

// ===== Enter 키 이벤트 =====
loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginBtn.click();
    }
});

signupPasswordConfirm.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        signupBtn.click();
    }
});

// ===== 로그인 상태 확인 (이미 로그인되어 있으면 그룹 페이지로 이동) =====
auth.onAuthStateChanged((user) => {
    if (user && window.location.pathname === '/index.html') {
        window.location.href = 'groups.html';
    }
});
