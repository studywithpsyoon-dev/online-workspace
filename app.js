/* ====================================================================
   CONFIG
   ==================================================================== */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAc6RFMA5FdsMCFCcErLGgbyrfNJt5SAus",
  authDomain:        "online-workplace.firebaseapp.com",
  databaseURL:       "https://online-workplace-default-rtdb.firebaseio.com",
  projectId:         "online-workplace",
  storageBucket:     "online-workplace.firebasestorage.app",
  messagingSenderId: "334115125119",
  appId:             "1:334115125119:web:e83bd82d1fa4ba44f10c4a"
};

const JITSI_ROOM = "24hr-online-workplace-cpk-2026";
const JITSI_URL = `https://meet.jit.si/${JITSI_ROOM}`;

const IS_FIREBASE_CONFIGURED = FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";

/* ====================================================================
   Firebase Init
   ==================================================================== */
let db = null;
let auth = null;
let googleProvider = null;
if (IS_FIREBASE_CONFIGURED) {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.database();
  auth = firebase.auth();
  googleProvider = new firebase.auth.GoogleAuthProvider();
}

/* ====================================================================
   Helpers
   ==================================================================== */
const { useState, useEffect, useRef, useCallback } = React;

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(sec)}`
    : `${pad(m)}:${pad(sec)}`;
}

function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${m}`;
}

function formatDateTime(ts) {
  const d = new Date(ts);
  const mon = d.getMonth() + 1;
  const day = d.getDate();
  const dow = ['일','월','화','수','목','금','토'][d.getDay()];
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${mon}/${day} (${dow}) ${period} ${h12}:${m}`;
}

function getAvatarEmoji(name) {
  const emojis = ['🧑‍💻','👩‍💻','📖','✏️','🎧','☕','🌿','📚','💡','🖊️','🎨','🔬'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return emojis[Math.abs(hash) % emojis.length];
}

/* ====================================================================
   Toast Component
   ==================================================================== */
function Toast({ message }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (message) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 2500);
      return () => clearTimeout(t);
    }
  }, [message]);
  return <div className={`toast ${show ? 'show' : ''}`}>{message}</div>;
}

/* ====================================================================
   Main App
   ==================================================================== */
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [myKey, setMyKey] = useState(null);
  const [exitLogRef, setExitLogRef] = useState(null);
  const [enteredAt, setEnteredAt] = useState(null);
  const [members, setMembers] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState('');
  const [logs, setLogs] = useState([]);
  const [showJitsi, setShowJitsi] = useState(false);
  const toastKey = useRef(0);
  const timerRef = useRef(null);
  const myKeyRef = useRef(null);
  useEffect(() => { myKeyRef.current = myKey; }, [myKey]);

  // Google Auth 상태 리스너 + redirect 결과 처리
  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }
    auth.getRedirectResult().catch(err => console.error('Redirect error:', err));
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const displayName = user ? user.displayName : '';
  const photoURL = user ? user.photoURL : '';

  // 입실 상태 복원 (새로고침: sessionStorage / 다른 기기: Firebase 조회)
  useEffect(() => {
    if (authLoading || !user || !db) return;
    const saved = sessionStorage.getItem('checkInData');
    if (saved) {
      // 새로고침 복원
      try {
        const data = JSON.parse(saved);
        const ref = db.ref('workspace/currentMembers');
        const newRef = ref.push();
        newRef.onDisconnect().remove();
        newRef.set({ nickname: data.nickname, photoURL: data.photoURL || '', enteredAt: data.enteredAt }).then(() => {
          setMyKey(newRef.key);
          setEnteredAt(data.enteredAt);
          setIsCheckedIn(true);
          setShowJitsi(true);
          const autoExitRef = db.ref('workspace/log').push();
          autoExitRef.onDisconnect().set({
            nickname: data.nickname,
            photoURL: data.photoURL || '',
            action: 'exit',
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
          setExitLogRef(autoExitRef);
          if (data.autoExitKey) {
            db.ref(`workspace/log/${data.autoExitKey}`).remove();
          }
          sessionStorage.setItem('checkInData', JSON.stringify({
            ...data, autoExitKey: autoExitRef.key
          }));
        });
      } catch (e) { sessionStorage.removeItem('checkInData'); }
    } else {
      // 다른 기기에서 로그인 시 Firebase에서 기존 입실 확인
      db.ref('workspace/currentMembers').once('value', snap => {
        const data = snap.val() || {};
        const found = Object.entries(data).find(([, val]) => val.nickname === user.displayName);
        if (found) {
          const [key, val] = found;
          setMyKey(key);
          setEnteredAt(val.enteredAt);
          setIsCheckedIn(true);
          setShowJitsi(true);
          sessionStorage.setItem('checkInData', JSON.stringify({
            nickname: val.nickname, photoURL: val.photoURL || '', enteredAt: val.enteredAt
          }));
        }
      });
    }
  }, [authLoading, user]);

  // Google 로그인 (popup 시도 → 실패 시 redirect로 전환)
  const handleGoogleLogin = useCallback(() => {
    if (!auth) return;
    auth.signInWithPopup(googleProvider).catch(err => {
      console.error('Popup failed, trying redirect:', err.code);
      auth.signInWithRedirect(googleProvider);
    });
  }, []);

  // 로그아웃
  const handleLogout = useCallback(() => {
    if (isCheckedIn) handleCheckOut();
    sessionStorage.removeItem('checkInData');
    if (auth) auth.signOut();
  }, [isCheckedIn]);

  // 실시간 멤버 리스너 + 다른 기기에서 퇴실 감지
  useEffect(() => {
    if (!db) return;
    const ref = db.ref('workspace/currentMembers');
    const handler = ref.on('value', snap => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([key, val]) => ({
        key, ...val
      }));
      list.sort((a, b) => a.enteredAt - b.enteredAt);
      setMembers(list);
      // 내 항목이 사라졌으면 퇴실 상태로 전환
      if (myKeyRef.current && !data[myKeyRef.current]) {
        setIsCheckedIn(false);
        setMyKey(null);
        setEnteredAt(null);
        sessionStorage.removeItem('checkInData');
      }
    });
    return () => ref.off('value', handler);
  }, []);

  // 입퇴실 기록 리스너 (전체) + 7일 지난 로그 자동 삭제
  useEffect(() => {
    if (!db || !user) return;
    const ref = db.ref('workspace/log').orderByChild('timestamp').limitToLast(100);
    const handler = ref.on('value', snap => {
      const data = snap.val() || {};
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const list = [];
      Object.entries(data).forEach(([key, val]) => {
        if (val.timestamp < weekAgo) {
          db.ref(`workspace/log/${key}`).remove();
        } else {
          list.push({ key, ...val });
        }
      });
      list.sort((a, b) => b.timestamp - a.timestamp);
      // 같은 사용자의 동일 액션이 60초 이내에 중복되면 제거
      const deduped = list.filter((log, i) => {
        if (i === 0) return true;
        const prev = list.find((l, j) => j < i && l.nickname === log.nickname && l.action === log.action);
        if (prev && Math.abs(prev.timestamp - log.timestamp) < 60000) return false;
        return true;
      });
      setLogs(deduped);
    });
    return () => ref.off('value', handler);
  }, [user]);

  // 타이머
  useEffect(() => {
    if (isCheckedIn && enteredAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - enteredAt);
      }, 1000);
      return () => clearInterval(timerRef.current);
    } else {
      clearInterval(timerRef.current);
      setElapsed(0);
    }
  }, [isCheckedIn, enteredAt]);

  const showToast = useCallback((msg) => {
    toastKey.current += 1;
    setToast('');
    setTimeout(() => setToast(msg), 50);
  }, []);

  // 입실
  const handleCheckIn = useCallback(() => {
    const name = displayName;
    if (!name) return;
    if (!db) {
      showToast('Firebase가 설정되지 않았습니다');
      return;
    }

    const ref = db.ref('workspace/currentMembers');
    const newRef = ref.push();
    const now = Date.now();
    const photo = photoURL || '';
    const data = { nickname: name, photoURL: photo, enteredAt: now };

    newRef.onDisconnect().remove();

    const autoExitRef = db.ref('workspace/log').push();
    autoExitRef.onDisconnect().set({
      nickname: name,
      photoURL: photo,
      action: 'exit',
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    newRef.set(data).then(() => {
      setExitLogRef(autoExitRef);
      setMyKey(newRef.key);
      setEnteredAt(now);
      setIsCheckedIn(true);

      sessionStorage.setItem('checkInData', JSON.stringify({
        nickname: name, photoURL: photo, enteredAt: now, autoExitKey: autoExitRef.key
      }));

      const greetings = [
        `${name}님, 오늘도 좋은 작업 시간 되세요 ☕`,
        `${name}님, 오늘 계획한 작업 잘 마무리되길 응원해요 ✨`,
        `${name}님, 함께 하는 오늘도 화이팅이에요 ☕`,
        `${name}님, 차 한 잔과 함께 좋은 시작이에요 ☕`,
        `${name}님, 오늘도 좋은 하루 만들어가요 ✨`,
        `${name}님, 같이 작업하니 든든하네요 ☕`,
        `${name}님, 하나씩 해내는 오늘이 되길 응원해요 ✨`,
        `${name}님, 오늘도 차분하게 시작해봐요 ☕`,
      ];
      showToast(greetings[Math.floor(Math.random() * greetings.length)]);
      setShowJitsi(true);

      db.ref('workspace/log').push({
        nickname: name,
        photoURL: photo,
        action: 'enter',
        timestamp: now
      });
    });
  }, [displayName, showToast]);

  // 퇴실
  const handleCheckOut = useCallback(() => {
    if (!db || !myKey) return;

    if (exitLogRef) {
      exitLogRef.onDisconnect().cancel();
      setExitLogRef(null);
    }

    db.ref(`workspace/currentMembers/${myKey}`).remove().then(() => {
      const farewells = [
        `${displayName}님, 오늘도 수고하셨어요 ✨`,
        `${displayName}님, 오늘 하루도 잘 보내셨네요! 푹 쉬세요 🌙`,
        `${displayName}님, 좋은 작업 시간이었어요. 내일 또 만나요 ☕`,
        `${displayName}님, 오늘도 한 걸음 나아갔어요 ✨`,
        `${displayName}님, 해낸 만큼 충분해요. 수고하셨습니다 🌿`,
        `${displayName}님, 오늘의 노력이 내일의 성과가 될 거예요 ✨`,
        `${displayName}님, 퇴실 완료! 남은 하루도 좋은 시간 보내세요 ☕`,
        `${displayName}님, 고생 많으셨어요! 리프레시 타임이에요 🌙`,
      ];
      showToast(farewells[Math.floor(Math.random() * farewells.length)]);

      db.ref('workspace/log').push({
        nickname: displayName,
        photoURL: photoURL || '',
        action: 'exit',
        timestamp: Date.now()
      });

      setIsCheckedIn(false);
      setShowJitsi(false);
      setMyKey(null);
      setEnteredAt(null);
      sessionStorage.removeItem('checkInData');
    });
  }, [myKey, displayName, showToast]);

  return (
    <div className="container">

      {/* 헤더 */}
      <header className="header">
        <span className="header-icon">☕</span>
        <h1>24hr online workplace</h1>
        <p className="subtitle">각자의 자리에서 함께 하는 작업 공간</p>
      </header>

      {/* Firebase 미설정 안내 */}
      {!IS_FIREBASE_CONFIGURED && (
        <div className="config-banner">
          ⚙️ Firebase가 아직 설정되지 않았습니다.<br />
          <code>app.js</code> 상단의 <strong>FIREBASE_CONFIG</strong>에 설정값을 입력해 주세요.
        </div>
      )}

      {/* 실시간 현황 카드 */}
      <section className="card">
        <div className="card-title">
          <span className="icon">📡</span>
          실시간 현황
        </div>

        <div className="status-bar">
          <span className={`status-dot ${members.length > 0 ? 'active' : ''}`}></span>
          <span>현재 <span className="member-count">{members.length}</span>명 접속 중</span>
        </div>

        {/* 로그인 안 된 상태 */}
        {authLoading ? (
          <div className="auth-section">
            <span style={{ color: 'var(--text-light)', fontSize: 14 }}>로딩 중...</span>
          </div>
        ) : !user ? (
          <div className="auth-section">
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Google 계정으로 로그인하고 입실해보세요
            </p>
            <button className="btn-google" onClick={handleGoogleLogin}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
              Google로 로그인
            </button>
          </div>
        ) : (
          <div>
            {/* 로그인 사용자 + 입실/퇴실 */}
            <div className="user-bar">
              <div className="user-bar-info">
                {photoURL && <img className="user-bar-avatar" src={photoURL} alt="" referrerPolicy="no-referrer" />}
                <span style={{ fontWeight: 500 }}>{displayName}</span>
                {isCheckedIn && <span style={{ fontSize: 12, color: 'var(--green-dark)' }}>작업 중 {formatDuration(elapsed)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isCheckedIn ? (
                  <button className="btn btn-enter" onClick={handleCheckIn} style={{ padding: '8px 20px', fontSize: 14 }}>
                    ☕ 입실
                  </button>
                ) : (
                  <button className="btn btn-exit" onClick={handleCheckOut} style={{ padding: '8px 20px', fontSize: 14 }}>
                    퇴실
                  </button>
                )}
                <button className="btn-logout" onClick={handleLogout}>로그아웃</button>
              </div>
            </div>
          </div>
        )}

        {/* 접속자 목록 (로그인한 사용자만 볼 수 있음) */}
        {user ? (
          members.length > 0 ? (
            <ul className="member-list">
              {members.map(m => (
                <li key={m.key} className="member-item">
                  <div className="member-info">
                    {m.photoURL ? (
                      <img className="user-bar-avatar" src={m.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 32, height: 32 }} />
                    ) : (
                      <div className="member-avatar">{getAvatarEmoji(m.nickname)}</div>
                    )}
                    <div>
                      <div className="member-nickname">
                        {m.nickname} {m.key === myKey && <span style={{ fontSize: 11, color: 'var(--orange)' }}>(나)</span>}
                      </div>
                      <div className="member-time">{formatTime(m.enteredAt)} 입실</div>
                    </div>
                  </div>
                  <MemberDuration enteredAt={m.enteredAt} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="icon">🌙</span>
              아직 아무도 없어요. 첫 번째 입실자가 되어보세요!
            </div>
          )
        ) : null}

        {/* Jitsi 화상회의 (입실 중일 때) */}
        {isCheckedIn && (
          <div>
            <button
              className="btn-meet"
              onClick={() => setShowJitsi(prev => !prev)}
              style={{ fontSize: 14, padding: '12px', background: showJitsi ? 'var(--brown-light)' : undefined, opacity: showJitsi ? 0.85 : 1 }}
            >
              {showJitsi ? '🔽 화상회의 접기' : '🎥 화상회의 열기'}
            </button>
            <div className="jitsi-container" style={{ display: showJitsi ? 'block' : 'none' }}>
              <iframe
                src={`${JITSI_URL}#userInfo.displayName="${encodeURIComponent(displayName)}"`}
                allow="camera; microphone; display-capture; autoplay; fullscreen"
                className="jitsi-iframe"
              ></iframe>
            </div>
          </div>
        )}
      </section>

      {/* 입퇴실 기록 */}
      {logs.length > 0 && (
        <section className="card">
          <div className="card-title">
            <span className="icon">📝</span>
            입퇴실 기록
          </div>
          <ul className="member-list" style={{ maxHeight: '210px', overflowY: 'auto' }}>
            {logs.map(log => (
              <li key={log.key} className="member-item" style={{ padding: '10px 16px' }}>
                <div className="member-info">
                  {log.photoURL ? (
                    <img className="user-bar-avatar" src={log.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28 }} />
                  ) : (
                    <div className="member-avatar" style={{
                      width: 28, height: 28, fontSize: 12,
                      background: log.action === 'enter' ? 'var(--green-soft)' : 'var(--orange-soft)'
                    }}>
                      {log.action === 'enter' ? '🟢' : '👋'}
                    </div>
                  )}
                  <div>
                    <span className="member-nickname" style={{ fontSize: 14 }}>
                      선생님
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-light)', marginLeft: 6 }}>
                      {log.action === 'enter' ? '입실' : '퇴실'}
                    </span>
                  </div>
                </div>
                <span className="member-time" style={{ fontSize: 12 }}>{formatDateTime(log.timestamp)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 안내 */}
      <section className="card">
        <div className="card-title">
          <span className="icon">📋</span>
          온라인 작업 공간 사용 안내
        </div>
        <ul className="info-list">
          <li className="info-item">
            <span className="bullet">•</span>
            <span>본명 노출이 부담되면 <strong>구글 계정에서 이름 변경</strong> 후 참여</span>
          </li>
          <li className="info-item">
            <span className="bullet">•</span>
            <span>마이크 <strong>음소거</strong> 기본, 카메라는 자유 (책상/키보드 정도)</span>
          </li>
          <li className="info-item">
            <span className="bullet">•</span>
            <span>화상회의는 페이지 내에서 바로 참여할 수 있어요 (별도 설치 불필요)</span>
          </li>
        </ul>
      </section>

      {/* 푸터 */}
      <footer className="footer">
        24hr online workplace · since 2024
      </footer>

      <Toast message={toast} />
    </div>
  );
}

/* 멤버별 경과 시간 (개별 타이머) */
function MemberDuration({ enteredAt }) {
  const [dur, setDur] = useState(Date.now() - enteredAt);
  useEffect(() => {
    const id = setInterval(() => setDur(Date.now() - enteredAt), 1000);
    return () => clearInterval(id);
  }, [enteredAt]);
  return <span className="member-duration">{formatDuration(dur)}</span>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
