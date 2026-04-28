const S={pay:0,gold:0,locked:0,bonus:0,loan:0,creditLim:50000000,creditUsed:0,selCert:{w:0,p:0},selTier:{m:0,r:0},tx:[],refType:'point'};
const F=n=>n.toLocaleString('ko-KR');
const rateMap={6:2,12:4,24:9};

// NAV
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
const bon=+(g*r/100).toFixed(2),save=Math.round(g*95200*0.005*(p/12));
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

// LOAN
function doLoan(type){let amt;
if(type==='credit'){amt=parseInt(document.getElementById('clAmt').value);if(!amt)return toast('금액 입력','error');if(amt>50000000)return toast('신용대출 최대 5천만원','error');}
else{const v=parseInt(document.getElementById('coVal').value),a=parseInt(document.getElementById('coAmt').value);if(!v||!a)return toast('정보 입력','error');if(a>v*0.7)return toast(`최대 ${F(Math.floor(v*0.7))}원 가능`,'error');amt=a;}
if(amt>(S.creditLim-S.creditUsed))return toast('한도 초과','error');
S.creditUsed+=amt;S.loan+=amt;S.pay+=amt;const gram=+(amt/95200).toFixed(2);S.gold+=gram;
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
tb.innerHTML=r.map(t=>`<tr><td>${t.date}</td><td>${TL[t.type]||t.type}</td><td style="color:${t.amt>=0?'var(--green)':'var(--red)'}">${t.amt>=0?'+':''}${F(t.amt)}</td><td><span class="sb ${t.status}">${{done:'완료',pend:'처리중',lock:'보관중',rsv:'예약'}[t.status]||t.status}</span></td></tr>`).join('');}
function rHist(f='all'){const tb=document.getElementById('hTb'),l=f==='all'?S.tx:S.tx.filter(t=>t.type===f);
if(!l.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:1.5rem">내역 없음</td></tr>';return;}
tb.innerHTML=l.map(t=>`<tr><td>${t.date}</td><td>${TL[t.type]||t.type}</td><td>${t.desc}</td><td style="color:${t.amt>=0?'var(--green)':'var(--red)'}">${t.amt>=0?'+':''}${F(t.amt)}</td><td><span class="sb ${t.status}">${{done:'완료',pend:'처리중',lock:'보관중'}[t.status]||t.status}</span></td></tr>`).join('');}
function fHist(el,f){document.querySelectorAll('#p-history .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');rHist(f);}
function rPH(){const tb=document.getElementById('pHist'),l=S.tx.filter(t=>t.type==='pay').slice(0,8);
if(!l.length){tb.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:1.5rem">내역 없음</td></tr>';return;}
tb.innerHTML=l.map(t=>`<tr><td>${t.date}</td><td>${t.desc}</td><td style="color:${t.amt>=0?'var(--green)':'var(--red)'}">${t.amt>=0?'+':''}${F(t.amt)}P</td></tr>`).join('');}

// SERIAL
let serialNo=1000;
function addSerial(gram){const el=document.getElementById('serials');
const sn='AU-2026-'+String(serialNo++).padStart(6,'0');
const html=`<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border);font-size:.84rem"><span>🪙 ${sn}</span><span>${gram}g</span><span style="color:var(--green)">보관중</span></div>`;
if(el.querySelector('p'))el.innerHTML='';
el.innerHTML+=html;}

upd();
