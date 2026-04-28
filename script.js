// ===== GOLD PRICE & STATE =====
let goldPricePerGram = 95200; // 기본값 (fallback)
let lastPriceUpdate = '';

const S={pay:0,gold:0,locked:0,bonus:0,loan:0,creditLim:50000000,creditUsed:0,selCert:{w:0,p:0},selTier:{m:0,r:0},tx:[],refType:'point'};
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
function doBuy(){if(!S.selCert.p)return toast('상품권을 선택하세요','error');
const q=parseInt(document.getElementById('bQty').value)||1,total=S.selCert.p*q,m=document.getElementById('bMethod').value;
if(m==='Pay포인트'&&S.pay<total)return toast('포인트 부족','error');
if((m==='신용대출'||m==='담보대출')&&(S.creditLim-S.creditUsed)<total)return toast('한도 부족','error');
const gram=S.selCert.w*q;
S.gold+=gram;S.pay+=total;
if(m==='Pay포인트')S.pay-=total;
if(m==='신용대출'||m==='담보대출'){S.creditUsed+=total;S.loan+=total;}
addTx('buy',`금 ${gram}g 매입 (${m})`,total,'done');
addTx('pay',`매입→Pay포인트 전환`,total,'done');
addSerial(gram);
toast(`금 ${gram}g 매입 완료! ${F(total)}P 전환`);upd();}

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
    if (!this.certificates.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1.5rem">발행된 상품권이 없습니다</td></tr>'; return; }
    tb.innerHTML = this.certificates.slice().reverse().map(c => `<tr>
      <td>#${c.blockIndex}</td>
      <td style="color:var(--gold)">${c.serial}</td>
      <td>${c.weight}</td>
      <td>${c.owner}</td>
      <td><span class="hash-display">${c.hash.substring(0, 16)}...</span></td>
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
  toast(`✅ 상품권 발행 완료! ${result.serial} · Block #${result.block.index}`);
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

// ===== INIT =====
upd();
fetchGoldPrice();
setInterval(fetchGoldPrice, 300000);
