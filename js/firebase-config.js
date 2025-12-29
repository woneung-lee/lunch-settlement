// Firebase 설정
// Firebase Console에서 프로젝트를 만들고 아래 값을 채워주세요.
// https://console.firebase.google.com/

const firebaseConfig = {
  apiKey: "AIzaSyAXpp13ARkgrGMHBvccZI5WMz5S3FlC9gw",
  authDomain: "lunchbox-d547e.firebaseapp.com",
  projectId: "lunchbox-d547e",
  storageBucket: "lunchbox-d547e.firebasestorage.app",
  messagingSenderId: "726812509012",
  appId: "1:726812509012:web:ec734f89aa3a9f8c15bec1"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firebase 서비스 초기화
const auth = firebase.auth();
const db = firebase.firestore();

// Firestore 타임스탬프 헬퍼
const timestamp = firebase.firestore.FieldValue.serverTimestamp;
const Timestamp = firebase.firestore.Timestamp;

console.log('Firebase initialized successfully');

// 타임스탬프 헬퍼 함수
function timestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}
