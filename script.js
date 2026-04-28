// ===== GOLD PRICE & STATE =====
let goldPricePerGram = 95200; // 기본값 (fallback)
let lastPriceUpdate = '';

const S={pay:0,gold:0,locked:0,bonus:0,loan:0,creditLim:50000000,creditUsed:0,selCert:{w:0,p:0},selTier:{m:0,r:0},tx:[],refType:'point',verified:false,verifyInfo:{name:'',phone:'',method:'',date:''}};
const F=n=>n.toLocaleString('ko-KR');
const rateMap={6:2,12:4,24:9};
const CERT_WEIGHTS = [1, 5, 10, 50, 100, 1000];
const CERT_LABELS = ['1g','5g','10g','50g','100g','1kg'];
const CERT_UNITS = ['순금 99.9%','순금 99.9%','순금 99.9%','순금 99.9%','골드바','골드바'];
const CERT_BADGES = [null,null,'인기',null,'-2%','-3%'];
const CERT_DISCOUNTS = [1, 1, 1, 1, 0.98, 0.97]; // 100g -2%, 1kg -3%

// ===== FETCH GOLD PRICE =====
async function fetchGoldPrice() {
  const sources = [
    fetchFromGoldAPI,
    fetchFromMetalsAPI,
    fetchFromExchangeRate
  ];
  for (const src of sources) {
    try {
      const price = await src();
      if (price && price > 50000 && price < 500000) {
        goldPricePerGram = Math.round(price);
        const now = new Date();
        lastPriceUpdate = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        updateGoldPriceUI();
        toast(`금 시세 업데이트: ₩${F(goldPricePerGram)}/g`, 'info');
        return;
      }
    } catch(e) { console.warn('Price source failed:', e); }
  }
  // All failed - use fallback
  console.log('Using fallback gold price');
  updateGoldPriceUI();
}

// Source 1: GoldAPI.io (free tier: 5 req/day)
async function fetchFromGoldAPI() {
  const res = await fetch('https://www.goldapi.io/api/XAU/KRW', {
    headers: { 'x-access-token': 'goldapi-demo', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000)
  });
  const data = await res.json();
  if (data.price_gram_24k) return data.price_gram_24k;
  throw new Error('No data');
}

// Source 2: Metals API via exchangerate
async function fetchFromMetalsAPI() {
  const res = await fetch('https://api.metalpriceapi.com/v1/latest?api_key=demo&base=XAU&currencies=KRW', {
    signal: AbortSignal.timeout(5000)
  });
  const data = await res.json();
  if (data.rates && data.rates.KRW) {
    // XAU is per troy ounce (31.1035g)
    return data.rates.KRW / 31.1035;
  }
  throw new Error('No data');
}

// Source 3: Use USD gold + USD/KRW exchange rate
async function fetchFromExchangeRate() {
  // Fetch gold in USD (troy oz)
  const goldRes = await fetch('https://api.frankfurter.app/latest?from=XAU&to=USD', {
    signal: AbortSignal.timeout(5000)
  });
  // Fetch USD/KRW
  const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=KRW', {
    signal: AbortSignal.timeout(5000)
  });
  const goldData = await goldRes.json();
  const fxData = await fxRes.json();
  if (goldData.rates && goldData.rates.USD && fxData.rates && fxData.rates.KRW) {
    const usdPerOz = goldData.rates.USD;
    const krwPerUsd = fxData.rates.KRW;
    return (usdPerOz * krwPerUsd) / 31.1035;
  }
  throw new Error('No data');
}

// ===== UPDATE UI WITH LIVE PRICE =====
function updateGoldPriceUI() {
  // Update price banner
  const gpEl = document.getElementById('gp');
  if (gpEl) gpEl.textContent = '₩' + F(goldPricePerGram);
  
  const gpTime = document.getElementById('gpTime');
  if (gpTime) gpTime.textContent = lastPriceUpdate ? `${lastPriceUpdate} 실시간 시세` : '기본 시세 (API 연결 대기중)';

  // Update certificate cards
  const grid = document.getElementById('certGrid');
  if (grid) {
    grid.innerHTML = CERT_WEIGHTS.map((w, i) => {
      const rawPrice = goldPricePerGram * w;
      const price = Math.round(rawPrice * CERT_DISCOUNTS[i]);
      const badge = CERT_BADGES[i] ? `<div class="cd">${CERT_BADGES[i]}</div>` : '';
      return `<div class="cc" onclick="selC(this,${w},${price})">
        <div class="cw">${CERT_LABELS[i]}</div>
        <div class="cu">${CERT_UNITS[i]}</div>
        <div class="cp">₩${F(price)}</div>
        ${badge}
      </div>`;
    }).join('');
  }

  // Update calculator save value
  doCalc();
}

// ===== NAV =====
document.querySelectorAll('.nav-item').forEach(i=>i.onclick=e=>{e.preventDefault();go(i.dataset.p)});
function go(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
const el=document.getElementById('p-'+p);if(el)el.classList.add('active');const nv=document.querySelector(`.nav-item[data-p="${p}"]`);if(nv)nv.classList.add('active');upd();}

function upd(){
document.getElementById('hPay').textContent=F(S.pay)+' P';
document.getElementById('hGold').textContent=F(S.gold)+'g';
document.getElementById('s1').textContent=F(S.gold)+'g';
document.getElementById('s2').textContent=F(S.pay)+' P';
document.getElementById('s3').textContent=F(S.locked)+'g';
document.getElementById('s4').textContent=F(S.bonus)+'g';
document.getElementById('wAmt').textContent=F(S.pay)+' P';
document.getElementById('cUsed').textContent=F(S.creditUsed)+'원';
document.getElementById('cLim').textContent=F(S.creditLim)+'원';
document.getElementById('cFill').style.width=(S.creditUsed/S.creditLim*100)+'%';
// Asset value display
const totalGoldValue = (S.gold + S.locked) * goldPricePerGram;
const tvEl = document.getElementById('totalValue');
if(tvEl) tvEl.textContent = '₩' + F(totalGoldValue);
['m1','m2','m3','m4','m5'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.textContent=[F(S.gold)+'g',F(S.pay)+' P',F(S.locked)+'g',F(S.bonus)+'g',F(S.loan)+'원'][i]});
rTx();rHist();rPH();}

function toast(m,t='success'){const c=document.getElementById('toastC'),d=document.createElement('div');d.className='toast '+t;d.innerHTML=`<span>${t==='success'?'✅':t==='error'?'❌':'ℹ️'}</span>${m}`;c.appendChild(d);setTimeout(()=>d.remove(),3500);}

function now(){const d=new Date();return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function addTx(type,desc,amt,status){S.tx.unshift({date:now(),type,desc,amt,status});}
const TL={buy:'매입',lock:'락업',pay:'결제',withdraw:'출금',refund:'환급',loan:'대출'};

// BUY
function selC(el,w,p){document.querySelectorAll('.cc').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');S.selCert={w,p};calcB();}
function calcB(){const q=parseInt(document.getElementById('bQty').value)||1;document.getElementById('bTotal').value='₩'+F(S.selCert.p*q);}

const PAY_LABELS={'card':'신용/체크카드','bank':'계좌이체','phone':'휴대폰결제','pay':'Pay포인트','kakao':'카카오페이','naver':'네이버페이','toss':'토스페이','samsung':'삼성페이','apple':'Apple Pay','culture':'문화상품권','book':'도서상품권','happy':'해피머니','gift':'기타 상품권','credit':'신용대출','collateral':'담보대출'};

function showPayDetail(method) {
  const box = document.getElementById('payDetailBox');
  const details = {
    card: `<div class="cib"><h4>💳 카드 결제</h4><div class="fg"><label>카드번호</label><input class="fc" placeholder="0000-0000-0000-0000"></div><div class="fg"><label>유효기간</label><div style="display:flex;gap:6px"><input class="fc" placeholder="MM" maxlength="2" style="flex:1"><input class="fc" placeholder="YY" maxlength="2" style="flex:1"></div></div><div class="fg"><label>CVC</label><input class="fc" type="password" placeholder="3자리" maxlength="3" style="max-width:120px"></div><p style="font-size:.72rem;color:var(--text3)">VISA, MasterCard, JCB, AMEX, 국내 모든 카드사 지원</p></div>`,
    bank: `<div class="cib"><h4>🏦 실시간 계좌이체</h4><div class="fg"><label>은행선택</label><select class="fc"><option>국민은행</option><option>신한은행</option><option>하나은행</option><option>우리은행</option><option>농협</option><option>기업은행</option><option>카카오뱅크</option><option>토스뱅크</option><option>케이뱅크</option></select></div><p style="font-size:.72rem;color:var(--text3)">공인인증서 또는 간편인증으로 즉시 이체</p></div>`,
    phone: `<div class="cib"><h4>📱 휴대폰 결제</h4><div class="fg"><label>통신사</label><select class="fc"><option>SKT</option><option>KT</option><option>LG U+</option><option>알뜰폰</option></select></div><div class="fg"><label>결제 번호</label><input class="fc" placeholder="01012345678"></div><p style="font-size:.72rem;color:var(--text3)">월 최대 100만원 · 결제금액은 통신요금에 합산 청구</p></div>`,
    pay: `<div class="cib"><h4>💰 Pay포인트 결제</h4><p style="font-size:.82rem">현재 보유: <strong style="color:var(--gold)">${F(S.pay)} P</strong></p></div>`,
    kakao: `<div class="cib"><h4>카카오페이</h4><p style="font-size:.82rem;color:var(--text2)">카카오톡에서 결제 승인 알림이 발송됩니다.</p></div>`,
    naver: `<div class="cib"><h4>네이버페이</h4><p style="font-size:.82rem;color:var(--text2)">네이버페이 결제 페이지로 이동합니다.</p></div>`,
    toss: `<div class="cib"><h4>토스페이</h4><p style="font-size:.82rem;color:var(--text2)">토스 앱에서 결제 승인 알림이 발송됩니다.</p></div>`,
    samsung: `<div class="cib"><h4>삼성페이</h4><p style="font-size:.82rem;color:var(--text2)">삼성페이 앱에서 생체인증 후 결제됩니다.</p></div>`,
    apple: `<div class="cib"><h4>Apple Pay</h4><p style="font-size:.82rem;color:var(--text2)">Face ID / Touch ID로 결제를 승인합니다.</p></div>`,
    culture: `<div class="cib"><h4>🎫 문화상품권</h4><div class="fg"><label>상품권 PIN</label><input class="fc" placeholder="핀번호 18자리"></div><p style="font-size:.72rem;color:var(--text3)">컬쳐랜드 발행 문화상품권 · 수수료 8%</p></div>`,
    book: `<div class="cib"><h4>📚 도서상품권</h4><div class="fg"><label>상품권 PIN</label><input class="fc" placeholder="핀번호 입력"></div><p style="font-size:.72rem;color:var(--text3)">북앤라이프 도서문화상품권 · 수수료 8%</p></div>`,
    happy: `<div class="cib"><h4>🎁 해피머니</h4><div class="fg"><label>상품권 PIN</label><input class="fc" placeholder="핀번호 입력"></div><p style="font-size:.72rem;color:var(--text3)">해피머니 온라인상품권 · 수수료 8%</p></div>`,
    gift: `<div class="cib"><h4>🎀 기타 상품권</h4><div class="fg"><label>상품권 종류</label><select class="fc"><option>신세계상품권</option><option>롯데상품권</option><option>구글플레이</option><option>기타</option></select></div><div class="fg"><label>핀번호</label><input class="fc" placeholder="핀번호 입력"></div><p style="font-size:.72rem;color:var(--text3)">수수료 10% · 1~2영업일 확인</p></div>`,
    credit: `<div class="cib"><h4>📋 신용대출 연계</h4><p style="font-size:.82rem;color:var(--text2)">한도: <strong style="color:var(--gold)">${F(S.creditLim - S.creditUsed)}원</strong> 잔여</p><p style="font-size:.72rem;color:var(--text3)">연 6.9%~12.5% · 대출 매입 페이지로 이동합니다</p></div>`,
    collateral: `<div class="cib"><h4>🏠 담보대출 연계</h4><p style="font-size:.82rem;color:var(--text2)">담보평가액의 최대 70%까지 매입 가능</p><p style="font-size:.72rem;color:var(--text3)">대출 매입 페이지에서 상세 설정</p></div>`
  };
  box.innerHTML = details[method] || '';
}

function doBuy(){if(!S.selCert.p)return toast('상품권을 선택하세요','error');
if(!S.verified) return toast('본인인증이 필요합니다. 본인인증 메뉴에서 인증을 완료해주세요.','error');
const q=parseInt(document.getElementById('bQty').value)||1,total=S.selCert.p*q,m=document.getElementById('bMethod').value;
const mLabel = PAY_LABELS[m] || m;
if(m==='pay'&&S.pay<total)return toast('포인트 부족','error');
if((m==='credit'||m==='collateral')&&(S.creditLim-S.creditUsed)<total)return toast('한도 부족','error');
const gram=S.selCert.w*q;
S.gold+=gram;S.pay+=total;
if(m==='pay')S.pay-=total;
if(m==='credit'||m==='collateral'){S.creditUsed+=total;S.loan+=total;}
const giftFee = ['culture','book','happy','gift'].includes(m) ? ' (수수료 8%)' : '';
addTx('buy',`금 ${gram}g 매입 (${mLabel}${giftFee})`,total,'done');
addTx('pay',`매입→Pay포인트 전환`,total,'done');
addSerial(gram);
toast(`금 ${gram}g 매입 완료! ${mLabel}로 결제 · ${F(total)}P 전환`);upd();}

// LOCKUP
function selT(el,m,r){document.querySelectorAll('.tc').forEach(c=>c.style.borderColor='');el.style.borderColor='var(--gold)';S.selTier={m,r};document.getElementById('lTier').value=`${m}개월 보관 (+${r}% 증량)`;calcL();}
function calcL(){const g=parseFloat(document.getElementById('lGram').value)||0,r=S.selTier.r||0;const bon=+(g*r/100).toFixed(2);document.getElementById('lBonus').value=bon+'g';document.getElementById('lFinal').value=(g+bon)+'g';}
function doLock(){if(!S.selTier.m)return toast('보관 기간을 선택하세요','error');const g=parseFloat(document.getElementById('lGram').value)||0;if(g<=0||g>S.gold)return toast('보관할 금이 부족합니다','error');
const bon=+(g*S.selTier.r/100).toFixed(2);
S.gold-=g;S.locked+=g;S.bonus+=bon;
addTx('lock',`${g}g ${S.selTier.m}개월 락업 (보너스 +${bon}g)`,g,'lock');
const ls=document.getElementById('lockStat');
ls.innerHTML=`<div style="padding:.6rem;border-bottom:1px solid var(--border);font-size:.84rem"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>🔒 ${g}g · ${S.selTier.m}개월</span><span class="sb lock">보관중</span></div><div style="color:var(--text2);font-size:.78rem">예정 보너스: +${bon}g · 최종: ${g+bon}g</div></div>`+ls.innerHTML.replace(/락업 내역 없음/g,'');
toast(`${g}g 락업 완료! ${S.selTier.m}개월 후 ${g+bon}g 수령 예정`);upd();}

// CALC
function doCalc(){const g=parseFloat(document.getElementById('cGram').value)||0,p=parseInt(document.getElementById('cPeriod').value),r=rateMap[p]||0;
const bon=+(g*r/100).toFixed(2),save=Math.round(g*goldPricePerGram*0.005*(p/12));
document.getElementById('crMain').textContent=(g+bon)+'g';
document.getElementById('crSub').textContent=`기본 ${g}g + 보너스 ${bon}g`;
document.getElementById('crBase').textContent=g+'g';
document.getElementById('crBon').textContent=bon+'g';
document.getElementById('crSave').textContent='₩'+F(save);}
doCalc();

// WALLET
function openM(id){document.getElementById(id).classList.add('active');}
function closeM(id){document.getElementById(id).classList.remove('active');}
document.querySelectorAll('.modal-ov').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.remove('active')});

function doPay(){const a=parseInt(document.getElementById('payAmt').value),t=document.getElementById('payTo').value||'가맹점';
if(!a||a<=0)return toast('금액을 입력하세요','error');if(a>S.pay)return toast('포인트 부족','error');
S.pay-=a;addTx('pay',`${t} 결제`,-a,'done');toast(`${t}에 ${F(a)}P 결제 완료`);closeM('mPay');upd();}

function doWd(){const a=parseInt(document.getElementById('wdAmt').value),ac=document.getElementById('wdAcct').value;
if(!a||a<=0)return toast('금액 입력','error');if(!ac)return toast('계좌 입력','error');
if(a+1000>S.pay)return toast('잔액 부족(수수료 1,000원)','error');
S.pay-=(a+1000);addTx('withdraw',`출금 → ${ac}`,-a,'pend');toast(`${F(a)}원 출금 신청 완료`);closeM('mWd');upd();}

function doTf(){const t=document.getElementById('tfTo').value,a=parseInt(document.getElementById('tfAmt').value);
if(!t)return toast('수신자 입력','error');if(!a||a>S.pay)return toast('금액 확인','error');
S.pay-=a;addTx('pay',`${t}에게 송금`,-a,'done');toast(`${F(a)}P 송금 완료`);closeM('mTf');upd();}

// LOAN - uses live gold price for gram conversion
function doLoan(type){let amt;
if(type==='credit'){amt=parseInt(document.getElementById('clAmt').value);if(!amt)return toast('금액 입력','error');if(amt>50000000)return toast('신용대출 최대 5천만원','error');}
else{const v=parseInt(document.getElementById('coVal').value),a=parseInt(document.getElementById('coAmt').value);if(!v||!a)return toast('정보 입력','error');if(a>v*0.7)return toast(`최대 ${F(Math.floor(v*0.7))}원 가능`,'error');amt=a;}
if(amt>(S.creditLim-S.creditUsed))return toast('한도 초과','error');
S.creditUsed+=amt;S.loan+=amt;S.pay+=amt;const gram=+(amt/goldPricePerGram).toFixed(2);S.gold+=gram;
addTx('loan',`${type==='credit'?'신용':'담보'}대출 매입 ${gram}g`,amt,'done');
addTx('pay','대출매입→Pay전환',amt,'done');
addSerial(gram);
toast(`${type==='credit'?'신용':'담보'}대출 ${F(amt)}원 매입 완료! ${gram}g + ${F(amt)}P`);upd();}

// REFUND
function rTab(el,t){document.querySelectorAll('#p-refund .tab').forEach(x=>x.classList.remove('active'));el.classList.add('active');S.refType=t;}
function calcR(){const a=parseInt(document.getElementById('rfAmt').value)||0,fee=Math.round(a*0.03);
document.getElementById('rReq').textContent=F(a)+(S.refType==='point'?'원':'g');
document.getElementById('rFee').textContent=F(fee)+(S.refType==='point'?'원':'g');
document.getElementById('rNet').textContent=F(a-fee)+(S.refType==='point'?'원':'g');}
function doRefund(){const a=parseInt(document.getElementById('rfAmt').value),ac=document.getElementById('rfAcct').value;
if(!a||!ac)return toast('정보를 입력하세요','error');
const fee=Math.round(a*0.03);
if(S.refType==='point'){if(a>S.pay)return toast('포인트 부족','error');S.pay-=a;}
else{if(a>S.gold)return toast('보유 금 부족','error');S.gold-=a;}
addTx('refund',`${S.refType==='point'?'포인트':'실물'} 환급 (수수료 ${F(fee)})`,-a,'pend');
toast(`환급 신청 완료! 실수령 ${F(a-fee)}${S.refType==='point'?'원':'g'}`);upd();}

// HISTORY
function rTx(){const tb=document.getElementById('rtx'),r=S.tx.slice(0,5);
if(!r.length){tb.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:1.5rem">거래 없음</td></tr>';return;}
tb.innerHTML=r.map(t=>`<tr><td>${t.date}</td><td>${TL[t.type]||t.type}</td><td style="color:${t.amt>=0?'var(--green)':'var(--red)'}">₩${t.amt>=0?'+':''}${F(t.amt)}</td><td><span class="sb ${t.status}">${{done:'완료',pend:'처리중',lock:'보관중',rsv:'예약'}[t.status]||t.status}</span></td></tr>`).join('');}
function rHist(f='all'){const tb=document.getElementById('hTb'),l=f==='all'?S.tx:S.tx.filter(t=>t.type===f);
if(!l.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:1.5rem">내역 없음</td></tr>';return;}
tb.innerHTML=l.map(t=>`<tr><td>${t.date}</td><td>${TL[t.type]||t.type}</td><td>${t.desc}</td><td style="color:${t.amt>=0?'var(--green)':'var(--red)'}">₩${t.amt>=0?'+':''}${F(t.amt)}</td><td><span class="sb ${t.status}">${{done:'완료',pend:'처리중',lock:'보관중'}[t.status]||t.status}</span></td></tr>`).join('');}
function fHist(el,f){document.querySelectorAll('#p-history .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');rHist(f);}
function rPH(){const tb=document.getElementById('pHist'),l=S.tx.filter(t=>t.type==='pay').slice(0,8);
if(!l.length){tb.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:1.5rem">내역 없음</td></tr>';return;}
tb.innerHTML=l.map(t=>`<tr><td>${t.date}</td><td>${t.desc}</td><td style="color:${t.amt>=0?'var(--green)':'var(--red)'}">₩${t.amt>=0?'+':''}${F(t.amt)}P</td></tr>`).join('');}

// SERIAL
let serialNo=1000;
function addSerial(gram){const el=document.getElementById('serials');
const sn='AU-2026-'+String(serialNo++).padStart(6,'0');
const html=`<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border);font-size:.84rem"><span>🪙 ${sn}</span><span>${gram}g (₩${F(Math.round(gram*goldPricePerGram))})</span><span style="color:var(--green)">보관중</span></div>`;
if(el.querySelector('p'))el.innerHTML='';
el.innerHTML+=html;}

// REFRESH BUTTON
function refreshPrice() {
  toast('금 시세를 업데이트 중...', 'info');
  fetchGoldPrice();
}

// ===== BLOCKCHAIN ENGINE =====
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = '';
  }
  async calculateHash() {
    return await sha256(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce);
  }
  async mineBlock(difficulty = 2) {
    const target = Array(difficulty + 1).join('0');
    while (!this.hash.substring(2, 2 + difficulty).startsWith(target.substring(0, difficulty))) {
      this.nonce++;
      this.hash = await this.calculateHash();
      if (this.nonce > 5000) break; // safety limit
    }
  }
}

class GoldChain {
  constructor() {
    this.chain = [];
    this.certificates = [];
    this.difficulty = 2;
  }
  async init() {
    const genesis = new Block(0, new Date().toISOString(), { type: 'genesis', message: 'GoldSafe Genesis Block - 금상품권 블록체인' }, '0x0000000000000000000000000000000000000000000000000000000000000000');
    genesis.hash = await genesis.calculateHash();
    this.chain = [genesis];
    this.renderExplorer();
  }
  getLatest() { return this.chain[this.chain.length - 1]; }
  async addBlock(data) {
    const prev = this.getLatest();
    const block = new Block(this.chain.length, new Date().toISOString(), data, prev.hash);
    await block.mineBlock(this.difficulty);
    this.chain.push(block);
    return block;
  }
  async isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];
      const recalc = await sha256(curr.index + curr.previousHash + curr.timestamp + JSON.stringify(curr.data) + curr.nonce);
      if (curr.hash !== recalc) return { valid: false, block: i, reason: '해시 불일치' };
      if (curr.previousHash !== prev.hash) return { valid: false, block: i, reason: '체인 링크 끊김' };
    }
    return { valid: true };
  }
  async mintCertificate(weight, owner, price) {
    const serial = 'AU-2026-' + String(1000 + this.certificates.length).padStart(6, '0');
    const certData = {
      type: 'GOLD_CERT_MINT',
      serial: serial,
      weight: weight + 'g',
      purity: '99.9%',
      owner: owner,
      priceKRW: price,
      goldPricePerGram: goldPricePerGram,
      issuer: 'GoldSafe Platform',
      issuedAt: new Date().toISOString()
    };
    const block = await this.addBlock(certData);
    this.certificates.push({ ...certData, blockIndex: block.index, hash: block.hash });
    return { block, serial, hash: block.hash };
  }
  findCertificate(query) {
    return this.certificates.find(c => c.serial === query || c.hash === query || c.hash.includes(query));
  }
  renderExplorer() {
    const el = document.getElementById('blockExplorer');
    if (!el) return;
    el.innerHTML = this.chain.slice().reverse().slice(0, 10).map(b => `
      <div class="block-card">
        <div class="block-hd">
          <span class="block-num">Block #${b.index}</span>
          <span class="block-time">${new Date(b.timestamp).toLocaleString('ko-KR')}</span>
        </div>
        <div class="block-hash" title="${b.hash}">${b.hash}</div>
        <div class="block-data">
          <span>📎 Prev: ${b.previousHash.substring(0, 18)}...</span>
          <span>🔢 Nonce: ${b.nonce}</span>
          ${b.data.serial ? `<span>🪙 ${b.data.serial}</span><span>⚖️ ${b.data.weight}</span>` : `<span>🏁 ${b.data.message || 'Genesis'}</span><span></span>`}
        </div>
      </div>
      ${b.index > 0 ? '<div class="block-link">⛓️ 연결됨</div>' : ''}
    `).join('');
    // Update stats
    const cl = document.getElementById('chainLen');
    if (cl) cl.textContent = this.chain.length;
    const cc = document.getElementById('chainCerts');
    if (cc) cc.textContent = this.certificates.length;
    // Update cert list table
    this.renderCertList();
  }
  renderCertList() {
    const tb = document.getElementById('certList');
    if (!tb) return;
    if (!this.certificates.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:1.5rem">발행된 상품권이 없습니다</td></tr>'; return; }
    tb.innerHTML = this.certificates.slice().reverse().map(c => `<tr>
      <td>#${c.blockIndex}</td>
      <td style="color:var(--gold)">${c.serial}</td>
      <td>${c.weight}</td>
      <td>${c.owner}</td>
      <td><span class="hash-display">${c.hash.substring(0, 16)}...</span></td>
      <td><button class="btn btn-o btn-sm" onclick="showQrCert('${c.serial}')">📱 QR</button></td>
      <td><span class="sb done">검증됨</span></td>
    </tr>`).join('');
  }
}

const blockchain = new GoldChain();
blockchain.init();

async function mintCert() {
  const weight = parseInt(document.getElementById('mintWeight').value);
  const owner = document.getElementById('mintOwner').value || '미지정';
  const price = weight * goldPricePerGram;
  toast('⛓️ 블록 채굴 중... (SHA-256 해싱)', 'info');
  const result = await blockchain.mintCertificate(weight, owner, price);
  blockchain.renderExplorer();

  // Generate QR code in mint result area
  const qrArea = document.getElementById('mintQrResult');
  const qrData = JSON.stringify({ serial: result.serial, hash: result.hash, weight: weight + 'g', owner, purity: '99.9%', block: result.block.index });
  qrArea.innerHTML = `<div style="margin-bottom:.8rem"><strong style="color:var(--gold)">✅ 발행 완료!</strong></div><div id="mintQr" style="display:inline-block;padding:12px;background:#fff;border-radius:10px"></div><div style="margin-top:.8rem;font-size:.82rem;color:var(--text2)"><div style="color:var(--gold);font-weight:700;margin-bottom:4px">${result.serial}</div><span class="hash-display">${result.hash.substring(0, 32)}...</span></div><button class="btn btn-o btn-sm" style="margin-top:.8rem" onclick="showQrCert('${result.serial}')">📋 상세 보기</button>`;
  new QRCode(document.getElementById('mintQr'), { text: qrData, width: 180, height: 180, colorDark: '#1a1a28', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  toast(`✅ QR 상품권 발행! ${result.serial} · Block #${result.block.index}`);
}

// QR Certificate Detail Modal
function showQrCert(serial) {
  const cert = blockchain.findCertificate(serial);
  if (!cert) return toast('상품권을 찾을 수 없습니다', 'error');
  const qrContainer = document.getElementById('certQrDisplay');
  qrContainer.innerHTML = '';
  const qrData = JSON.stringify({ serial: cert.serial, hash: cert.hash, weight: cert.weight, owner: cert.owner, purity: cert.purity, block: cert.blockIndex });
  new QRCode(qrContainer, { text: qrData, width: 220, height: 220, colorDark: '#1a1a28', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  document.getElementById('certQrInfo').innerHTML = `<div class="rs" style="text-align:left"><div class="rr"><span>시리얼</span><span style="color:var(--gold);font-weight:700">${cert.serial}</span></div><div class="rr"><span>중량</span><span>${cert.weight}</span></div><div class="rr"><span>순도</span><span>${cert.purity}</span></div><div class="rr"><span>소유자</span><span>${cert.owner}</span></div><div class="rr"><span>블록</span><span>#${cert.blockIndex}</span></div><div class="rr"><span>발행일</span><span>${new Date(cert.issuedAt).toLocaleString('ko-KR')}</span></div></div><div class="block-hash" style="font-size:.65rem;margin-top:.5rem">${cert.hash}</div>`;
  openM('mQrCert');
}

function downloadQr() {
  const canvas = document.querySelector('#certQrDisplay canvas');
  if (!canvas) return toast('QR 코드가 없습니다', 'error');
  const link = document.createElement('a');
  link.download = 'goldsafe-qr-cert.png';
  link.href = canvas.toDataURL();
  link.click();
  toast('QR 코드 이미지 다운로드 완료');
}

function printQr() {
  const content = document.querySelector('#mQrCert .modal').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>금상품권 QR</title><style>body{font-family:sans-serif;padding:2rem;text-align:center} .rs{margin:1rem 0} .rr{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee} .block-hash{word-break:break-all;font-family:monospace;font-size:10px;color:#666;margin-top:8px} .btn,.modal-hd,.modal-x{display:none}</style></head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// QR Scan Verification
let qrScanner = null;

function switchVerifyMode(el, mode) {
  document.querySelectorAll('#p-chain .tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('verifyManual').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('verifyScan').style.display = mode === 'scan' ? 'block' : 'none';
  if (mode === 'manual') stopQrScan();
}

function startQrScan() {
  stopQrScan();
  qrScanner = new Html5Qrcode('qrReader');
  qrScanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
    (decoded) => {
      stopQrScan();
      try {
        const data = JSON.parse(decoded);
        if (data.serial) {
          document.getElementById('verifyInput').value = data.serial;
          verifyCert();
          toast('📷 QR 스캔 성공! 검증 중...', 'info');
        }
      } catch { document.getElementById('verifyInput').value = decoded; verifyCert(); }
    },
    () => {}
  ).catch(err => toast('카메라 접근 실패: ' + err, 'error'));
}

function stopQrScan() {
  if (qrScanner) { try { qrScanner.stop(); } catch {} qrScanner = null; }
}

async function verifyCert() {
  const input = document.getElementById('verifyInput').value.trim();
  const el = document.getElementById('verifyResult');
  if (!input) { toast('해시값 또는 시리얼번호를 입력하세요', 'error'); return; }
  const cert = blockchain.findCertificate(input);
  if (cert) {
    el.innerHTML = `<div class="verify-ok">
      <h4>✅ 정품 확인 - 위변조 없음</h4>
      <p style="font-size:.84rem;color:var(--text2);margin-bottom:.5rem">블록체인에 기록된 정품 금상품권입니다.</p>
      <div class="rs">
        <div class="rr"><span>시리얼</span><span style="color:var(--gold)">${cert.serial}</span></div>
        <div class="rr"><span>중량</span><span>${cert.weight}</span></div>
        <div class="rr"><span>순도</span><span>${cert.purity}</span></div>
        <div class="rr"><span>소유자</span><span>${cert.owner}</span></div>
        <div class="rr"><span>발행일</span><span>${new Date(cert.issuedAt).toLocaleString('ko-KR')}</span></div>
        <div class="rr"><span>블록</span><span>#${cert.blockIndex}</span></div>
      </div>
      <div class="block-hash" style="margin-top:.5rem">${cert.hash}</div>
      <button class="btn btn-p btn-sm" style="margin-top:.8rem" onclick="showQrCert('${cert.serial}')">🪙 QR 상품권 보기</button>
    </div>`;
  } else {
    el.innerHTML = `<div class="verify-fail">
      <h4>❌ 검증 실패 - 미등록 상품권</h4>
      <p style="font-size:.84rem;color:var(--text2)">블록체인에 등록되지 않은 상품권입니다. 위변조 가능성이 있습니다.</p>
    </div>`;
  }
}

async function validateChain() {
  const result = await blockchain.isChainValid();
  const el = document.getElementById('chainValid');
  if (result.valid) {
    if (el) el.textContent = '✅';
    toast('✅ 블록체인 무결성 검증 완료! 모든 블록이 정상입니다.', 'success');
  } else {
    if (el) el.textContent = '❌';
    toast(`❌ 무결성 오류 발견! Block #${result.block}: ${result.reason}`, 'error');
  }
}


// ===== IDENTITY VERIFICATION =====
let verifyTimerInterval = null;
let generatedCode = '';

function completeVerification(name, phone, method) {
  S.verified = true;
  S.verifyInfo = { name, phone, method, date: now() };
  // Update mypage
  const elName = document.getElementById('myName'); if(elName) elName.textContent = name;
  const elPhone = document.getElementById('myPhone'); if(elPhone) elPhone.textContent = phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3');
  const elStatus = document.getElementById('myVerifyStatus'); if(elStatus) { elStatus.textContent = '✅ 완료'; elStatus.style.color = 'var(--green)'; }
  const elGrade = document.getElementById('myGrade'); if(elGrade) elGrade.textContent = '골드 멤버';
  // Update verify page banner
  const banner = document.getElementById('verifyStatusBanner'); if(banner) { banner.style.display = 'block'; }
  const bannerInfo = document.getElementById('verifyBannerInfo');
  if(bannerInfo) bannerInfo.textContent = `${name}님 · ${method} · ${now()} 완료`;
  // Update pay methods on mypage
  updateMyPayMethods();
}

function updateMyPayMethods() {
  const el = document.getElementById('myPayMethods');
  if (!el) return;
  el.innerHTML = `<div class="rs">
    <div class="rr"><span>💳 카드결제</span><span style="color:var(--green)">사용가능</span></div>
    <div class="rr"><span>🏦 계좌이체</span><span style="color:var(--green)">사용가능</span></div>
    <div class="rr"><span>📱 휴대폰결제</span><span style="color:var(--green)">사용가능</span></div>
    <div class="rr"><span>💰 Pay포인트</span><span style="color:var(--green)">사용가능</span></div>
    <div class="rr"><span>📲 간편결제</span><span style="color:var(--green)">카카오/네이버/토스/삼성/Apple</span></div>
    <div class="rr"><span>🎫 상품권결제</span><span style="color:var(--green)">문화/도서/해피머니</span></div>
  </div>`;
}

// Phone Verification
function sendVerifyCode() {
  const name = document.getElementById('vName').value;
  const ssn1 = document.getElementById('vSSN1').value;
  const ssn2 = document.getElementById('vSSN2').value;
  const phone = document.getElementById('vPhone').value;
  if (!name) return toast('이름을 입력하세요', 'error');
  if (!ssn1 || ssn1.length !== 6) return toast('주민번호 앞자리 6자리를 입력하세요', 'error');
  if (!ssn2 || ssn2.length !== 7) return toast('주민번호 뒷자리 7자리를 입력하세요', 'error');
  if (!phone || phone.length < 10) return toast('휴대폰 번호를 입력하세요', 'error');
  // Generate 6-digit code
  generatedCode = String(Math.floor(100000 + Math.random() * 900000));
  document.getElementById('vCodeBox').style.display = 'block';
  toast(`📱 인증번호가 발송되었습니다: ${generatedCode}`, 'info');
  // Start 3 min timer
  let sec = 180;
  clearInterval(verifyTimerInterval);
  verifyTimerInterval = setInterval(() => {
    sec--;
    const m = Math.floor(sec / 60), s = sec % 60;
    document.getElementById('vTimer').textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (sec <= 0) { clearInterval(verifyTimerInterval); document.getElementById('vTimer').textContent = '만료'; generatedCode = ''; }
  }, 1000);
}

function doPhoneVerify() {
  const code = document.getElementById('vCode').value;
  if (!generatedCode) return toast('인증번호를 먼저 발송하세요', 'error');
  if (code !== generatedCode) return toast('인증번호가 일치하지 않습니다', 'error');
  clearInterval(verifyTimerInterval);
  const name = document.getElementById('vName').value;
  const phone = document.getElementById('vPhone').value;
  completeVerification(name, phone, '휴대폰 인증');
  toast(`✅ ${name}님 본인인증 완료! 모든 서비스를 이용할 수 있습니다.`);
}

// ID Card Verification
function doIdVerify() {
  const front = document.getElementById('idFront').files[0];
  const selfie = document.getElementById('idSelfie').files[0];
  const idType = document.getElementById('idType').value;
  if (!front) return toast('신분증 앞면 사진을 첨부하세요', 'error');
  if (!selfie) return toast('셀카 사진을 첨부하세요', 'error');
  // Simulate processing
  toast('🔄 신분증 OCR 분석 중...', 'info');
  setTimeout(() => {
    completeVerification('인증회원', '010-0000-0000', `${idType} 인증`);
    toast(`✅ ${idType} 인증 완료!`);
  }, 2000);
}

// iPin Verification
function doIpinVerify() {
  const id = document.getElementById('ipinId').value;
  const pw = document.getElementById('ipinPw').value;
  if (!id || !pw) return toast('아이핀 ID와 비밀번호를 입력하세요', 'error');
  toast('🔄 아이핀 인증 처리 중...', 'info');
  setTimeout(() => {
    completeVerification('인증회원', '010-0000-0000', '아이핀 인증');
    toast('✅ 아이핀 본인인증 완료!');
  }, 1500);
}

// Bank Account Verification
function doAcctVerify() {
  const bank = document.getElementById('acctBank').value;
  const num = document.getElementById('acctNum').value;
  const codeBox = document.getElementById('acctCodeBox');
  const code = document.getElementById('acctCode').value;
  if (!num) return toast('계좌번호를 입력하세요', 'error');
  if (codeBox.style.display === 'none') {
    codeBox.style.display = 'block';
    const randomName = '골드' + String(Math.floor(1000 + Math.random() * 9000));
    toast(`🏦 ${bank} 계좌로 1원 송금 완료! 입금자명: "${randomName}"을 입력하세요`, 'info');
    return;
  }
  if (!code || code.length < 2) return toast('입금자명을 확인하세요', 'error');
  completeVerification('인증회원', '010-0000-0000', `${bank} 계좌인증`);
  toast('✅ 계좌 인증 완료!');
}

// ===== AUTH SYSTEM =====
function switchAuth(el, mode) {
  document.querySelectorAll('#authTabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('authLogin').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('authSignup').style.display = mode === 'signup' ? 'block' : 'none';
}

function toggleAllAgree() {
  const all = document.getElementById('agreeAll').checked;
  document.querySelectorAll('.agreeItem').forEach(c => c.checked = all);
}

function enterApp(name) {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainHeader').style.display = '';
  document.getElementById('mainNav').style.display = '';
  document.getElementById('mainContent').style.display = '';
  // Re-register nav events after showing
  document.querySelectorAll('.nav-item').forEach(i => i.onclick = e => { e.preventDefault(); go(i.dataset.p); });
  toast(`환영합니다, ${name}님! 골드세이프에 오신 것을 환영합니다.`);
  upd();
}

function doLogin() {
  const id = document.getElementById('loginId').value;
  const pw = document.getElementById('loginPw').value;
  if (!id) return alert('이메일 또는 아이디를 입력하세요.');
  if (!pw) return alert('비밀번호를 입력하세요.');
  enterApp(id.split('@')[0] || '회원');
}

function doSignup() {
  const name = document.getElementById('signName').value;
  const email = document.getElementById('signEmail').value;
  const phone = document.getElementById('signPhone').value;
  const pw = document.getElementById('signPw').value;
  const pw2 = document.getElementById('signPw2').value;
  if (!name) return alert('이름을 입력하세요.');
  if (!email || !email.includes('@')) return alert('올바른 이메일을 입력하세요.');
  if (!phone || phone.length < 10) return alert('휴대폰 번호를 입력하세요.');
  if (!pw || pw.length < 8) return alert('비밀번호는 8자 이상 입력하세요.');
  if (pw !== pw2) return alert('비밀번호가 일치하지 않습니다.');
  // Check required agreements
  const items = document.querySelectorAll('.agreeItem');
  const required = [items[0], items[1], items[2]];
  if (!required.every(c => c.checked)) return alert('필수 약관에 모두 동의해주세요.');
  enterApp(name);
}

function socialLogin(provider) {
  const names = { kakao: '카카오', naver: '네이버', google: '구글' };
  enterApp(`${names[provider]} 회원`);
}

// Password strength indicator
document.addEventListener('DOMContentLoaded', () => {
  const pwInput = document.getElementById('signPw');
  if (pwInput) {
    pwInput.addEventListener('input', () => {
      const pw = pwInput.value;
      const el = document.getElementById('pwStrength');
      if (!el) return;
      let score = 0;
      if (pw.length >= 8) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      const labels = ['', '약함', '보통', '강함', '매우 강함'];
      const colors = ['', 'var(--red)', 'var(--gold)', 'var(--green)', 'var(--green)'];
      if (pw.length === 0) { el.innerHTML = ''; return; }
      el.innerHTML = `<span style="color:${colors[score]}">보안강도: ${'●'.repeat(score)}${'○'.repeat(4-score)} ${labels[score]}</span>`;
    });
  }
});

// ===== INIT =====
fetchGoldPrice();
setInterval(fetchGoldPrice, 300000);
