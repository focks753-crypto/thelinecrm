/* 더라인 CRM — 상담 연락일 알림 발송 (GitHub Actions 매일 실행)
 * 조건: 상담(og10_cs) 중 status==='pending' && contactDate <= 오늘(KST) → 관리자 폰(og10_push 토큰)에 FCM 푸시
 * 필요: 환경변수 FIREBASE_SA = 서비스계정 JSON 문자열 (GitHub Secret)
 */
const admin = require('firebase-admin');

if (!process.env.FIREBASE_SA) { console.error('FIREBASE_SA 시크릿이 없습니다.'); process.exit(1); }
const sa = JSON.parse(process.env.FIREBASE_SA);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function todayKST() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000); // UTC+9
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD
}

(async () => {
  const today = todayKST();

  // 1) 상담 데이터 읽기 (og_data/og10_cs 문서의 value = JSON 배열)
  const doc = await db.collection('og_data').doc('og10_cs').get();
  let consults = [];
  if (doc.exists) { try { consults = JSON.parse(doc.data().value || '[]'); } catch (e) {} }

  const due = consults.filter(c => c && c.status === 'pending' && c.contactDate && c.contactDate <= today);
  if (!due.length) { console.log('연락 대상 없음 (오늘 ' + today + ')'); return; }

  // 2) 관리자 토큰 읽기
  const snap = await db.collection('og10_push').get();
  const items = snap.docs.map(d => ({ id: d.id, token: (d.data() || {}).token })).filter(x => x.token);
  if (!items.length) { console.log('등록된 푸시 토큰 없음'); return; }
  const tokens = items.map(x => x.token);

  // 3) 메시지 구성
  const names = due.map(c => c.name).slice(0, 5).join(', ') + (due.length > 5 ? ` 외 ${due.length - 5}명` : '');
  const title = `상담 연락 ${due.length}건`;
  const body = `${names} — 오늘 연락하기로 한 상담이에요`;
  const icon = 'https://focks753-crypto.github.io/thelinecrm/icons/icon-192.png';
  const link = 'https://focks753-crypto.github.io/thelinecrm/';

  // 4) 발송 (멀티캐스트)
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { notification: { title, body, icon }, fcmOptions: { link } },
    data: { title, body, tag: 'consult-reminder', url: link },
  });
  console.log(`대상 ${due.length}건 · 토큰 ${tokens.length}개 → 성공 ${res.successCount} / 실패 ${res.failureCount}`);

  // 5) 만료/무효 토큰 정리
  const bad = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code ? String(r.error.code) : '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument') || code.includes('invalid-registration-token')) {
        bad.push(items[i].id);
      }
    }
  });
  for (const id of bad) { await db.collection('og10_push').doc(id).delete().catch(() => {}); }
  if (bad.length) console.log(`만료 토큰 ${bad.length}개 정리`);
})().catch(e => { console.error('실패:', e); process.exit(1); });
