// ═══════════════════════════════════════════════════════════
//  ALGORITHMS v4.0 — Chỉ thuật toán MẠNH NHẤT
//  TX/MD5/Sicbo/XocDia: ensemblePredict()
//  Baccarat: ensembleBCR() — engine RIÊNG BIỆT
// ═══════════════════════════════════════════════════════════

// ─── UTILS ──────────────────────────────────────────────────
function norm(sc,lb){const t=lb.reduce((a,l)=>a+(sc[l]||0),0)||1;const r={};lb.forEach(l=>r[l]=(sc[l]||0)/t);return r}
function half(lb){const r={};lb.forEach(l=>r[l]=1/lb.length);return r}

// ════════════════════════════════════════════════════════════
//  PHẦN 1: TX / MD5 / SICBO / XÓC ĐĨA
// ════════════════════════════════════════════════════════════

// ── 1. WEIGHTED MARKOV (bậc 1-4, trọng số thời gian) ────────
function markovW(r,lb,order=2){
  if(r.length<order+3)return half(lb);
  const tr={};const n=r.length;
  for(let i=0;i<n-order;i++){
    const k=r.slice(i,i+order).join("|");const nx=r[i+order];
    if(!lb.includes(nx))continue;
    const w=Math.exp((i-n+1)*0.12);
    if(!tr[k])tr[k]={};tr[k][nx]=(tr[k][nx]||0)+w;
  }
  for(let o=order;o>=1;o--){
    const k=r.slice(-o).join("|");
    if(tr[k]){const tot=Object.values(tr[k]).reduce((a,b)=>a+b,0);if(tot>0){const res={};lb.forEach(l=>res[l]=(tr[k][l]||0)/tot);return res;}}
  }
  return half(lb);
}

// ── 2. KALMAN FILTER ─────────────────────────────────────────
function kalman(r,lb){
  if(r.length<8)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  let x=0.5,P=1;const Q=0.015,R=0.12;
  b.forEach(v=>{const Pp=P+Q;const K=Pp/(Pp+R);x+=K*(v-x);P=(1-K)*Pp;});
  x=Math.max(0.08,Math.min(0.92,x));
  return{[lb[0]]:x,[lb[1]]:1-x};
}

// ── 3. LSTM-INSPIRED (cell + gate) ───────────────────────────
function lstmI(r,lb){
  if(r.length<10)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  let cell=0.5,hidden=0.5;
  const sig=x=>1/(1+Math.exp(-x));
  b.forEach(v=>{
    const fg=sig(2*hidden+v-1.5);
    const ig=sig(2*(hidden+v)-1.5);
    const og=sig(2*hidden+v-0.5);
    cell=fg*cell+ig*Math.tanh(v+hidden-0.5);
    hidden=og*Math.tanh(cell);
  });
  hidden=Math.max(0.08,Math.min(0.92,hidden));
  return{[lb[0]]:hidden,[lb[1]]:1-hidden};
}

// ── 4. DEEP PATTERN MATCH ────────────────────────────────────
function deepPat(r,lb){
  if(r.length<12)return half(lb);
  const v={};lb.forEach(l=>v[l]=0);let totalW=0;
  for(let pl=2;pl<=Math.min(8,Math.floor(r.length/2));pl++){
    const cur=r.slice(-pl).join("|");
    for(let i=0;i<r.length-pl-1;i++){
      if(r.slice(i,i+pl).join("|")!==cur)continue;
      const nx=r[i+pl];if(!lb.includes(nx))continue;
      const w=Math.exp((i-r.length)*0.08)/pl;
      v[nx]+=w;totalW+=w;
    }
  }
  if(!totalW)return half(lb);
  return norm({[lb[0]]:v[lb[0]]||0,[lb[1]]:v[lb[1]]||0},lb);
}

// ── 5. HIDDEN MARKOV MODEL ───────────────────────────────────
function hmm(r,lb){
  if(r.length<15)return half(lb);
  const trans={};lb.forEach(a=>{trans[a]={};lb.forEach(b=>trans[a][b]=1/lb.length);});
  for(let i=0;i<r.length-1;i++){
    const a=r[i],b=r[i+1];if(!lb.includes(a)||!lb.includes(b))continue;
    const w=Math.exp((i-r.length+1)*0.1)*0.85;
    lb.forEach(x=>{trans[a][x]*=(1-w);});trans[a][b]+=w;
    const tot=lb.reduce((s,x)=>s+trans[a][x],0);
    lb.forEach(x=>trans[a][x]/=tot);
  }
  const last=r[r.length-1];if(!lb.includes(last))return half(lb);
  return norm({[lb[0]]:trans[last][lb[0]]||0.5,[lb[1]]:trans[last][lb[1]]||0.5},lb);
}

// ── 6. KNN SEQUENCE ──────────────────────────────────────────
function knn(r,lb,k=7){
  if(r.length<k+4)return half(lb);
  const qLen=Math.min(5,Math.floor(r.length/3));
  const query=r.slice(-qLen);
  const dists=[];
  for(let i=0;i<r.length-qLen-1;i++){
    const win=r.slice(i,i+qLen);
    const dist=query.reduce((s,v,j)=>s+(v!==win[j]?1:0),0);
    dists.push([dist,r[i+qLen],r.length-i]);
  }
  dists.sort((a,b)=>a[0]-b[0]||(a[2]-b[2]));
  const votes={};lb.forEach(l=>votes[l]=0);
  dists.slice(0,k).forEach(([d,p,age])=>{if(lb.includes(p))votes[p]+=1/(d+1)/Math.log(age+2);});
  const t=Object.values(votes).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);
  return norm({[lb[0]]:votes[lb[0]]||0,[lb[1]]:votes[lb[1]]||0},lb);
}

// ── 7. LOGISTIC REGRESSION (multi-feature) ───────────────────
function logitReg(r,lb){
  if(r.length<12)return half(lb);
  const b=r.slice(-30).map(v=>v===lb[0]?1:0);const n=b.length;
  const r3=b.slice(-3).reduce((a,v)=>a+v,0)/3;
  const r8=b.slice(-8).reduce((a,v)=>a+v,0)/8;
  const r20=b.reduce((a,v)=>a+v,0)/n;
  const h1=b.slice(0,Math.floor(n/2));const h2=b.slice(Math.floor(n/2));
  const tr=(h2.reduce((a,v)=>a+v,0)/h2.length)-(h1.reduce((a,v)=>a+v,0)/h1.length);
  let streak=1;for(let i=b.length-2;i>=0;i--){if(b[i]===b[b.length-1])streak++;else break;}
  const sf=(b[b.length-1]===1?streak:-streak)/10;
  const logit=2.0*r3+1.2*r8-0.8*r20+1.5*tr+0.6*sf-0.8;
  const prob=1/(1+Math.exp(-logit*2.5));
  return{[lb[0]]:Math.max(0.08,Math.min(0.92,prob)),[lb[1]]:Math.max(0.08,Math.min(0.92,1-prob))};
}

// ── 8. HURST EXPONENT ────────────────────────────────────────
function hurstE(r,lb){
  if(r.length<20)return half(lb);
  const b=r.slice(-30).map(v=>v===lb[0]?1:0);
  const mean=b.reduce((a,v)=>a+v,0)/b.length;
  const cd=b.map((_,i)=>b.slice(0,i+1).reduce((a,v)=>a+v,0)-mean*(i+1));
  const R=Math.max(...cd)-Math.min(...cd);
  const S=Math.sqrt(b.reduce((a,v)=>a+(v-mean)**2,0)/b.length)+1e-9;
  const H=Math.log(R/S)/Math.log(b.length);
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(H>0.62)return{[last]:0.64,[ot]:0.36};
  if(H<0.38)return{[ot]:0.64,[last]:0.36};
  return half(lb);
}

// ── 9. ENTROPY WEIGHTED ENSEMBLE (meta) ──────────────────────
function entropyEns(r,lb){
  if(r.length<10)return half(lb);
  const fns=[
    ()=>markovW(r,lb,1),()=>markovW(r,lb,2),()=>markovW(r,lb,3),
    ()=>kalman(r,lb),()=>lstmI(r,lb),()=>deepPat(r,lb),
    ()=>hmm(r,lb),()=>knn(r,lb),()=>logitReg(r,lb),()=>hurstE(r,lb),
  ];
  const final={};lb.forEach(l=>final[l]=0);let totalW=0;
  fns.forEach(fn=>{
    let s;try{s=fn();}catch{s=half(lb);}
    const probs=lb.map(l=>Math.max(s[l]||0.5,1e-9));
    const ent=-probs.reduce((a,p)=>a+p*Math.log2(p),0);
    const maxEnt=Math.log2(lb.length);
    const w=Math.max((maxEnt-ent)/maxEnt,0.01)**1.5;
    lb.forEach(l=>final[l]+=(s[l]||0.5)*w);totalW+=w;
  });
  if(totalW>0)lb.forEach(l=>final[l]/=totalW);
  return norm(final,lb);
}

// ── 10. TEMPORAL PATTERN MINING ──────────────────────────────
function temporalPM(r,lb){
  if(r.length<12)return half(lb);
  const bv={};lb.forEach(l=>bv[l]=0);let tw=0;
  for(let pl=2;pl<=Math.min(7,Math.floor(r.length/3));pl++){
    const cur=r.slice(-pl).join("|");const matches=[];
    for(let i=0;i<r.length-pl-1;i++){
      if(r.slice(i,i+pl).join("|")===cur&&lb.includes(r[i+pl]))matches.push([r[i+pl],i]);
    }
    if(!matches.length)continue;
    const c={};lb.forEach(l=>c[l]=0);
    matches.forEach(([kq,idx])=>{const w=Math.exp((idx-r.length)*0.08);c[kq]+=w;});
    const t2=Object.values(c).reduce((a,b)=>a+b,0)||1;
    const pw=1/pl;lb.forEach(l=>{bv[l]+=c[l]/t2*pw;tw+=pw;});
  }
  if(!tw)return half(lb);
  return norm({[lb[0]]:bv[lb[0]]||0,[lb[1]]:bv[lb[1]]||0},lb);
}

// ── 11. RSI DIVERGENCE ───────────────────────────────────────
function rsiDiv(r,lb){
  if(r.length<14)return half(lb);
  const b=r.slice(-16).map(v=>v===lb[0]?1:0);
  const g=b.slice(1).map((v,i)=>Math.max(v-b[i],0));
  const l=b.slice(1).map((v,i)=>Math.max(b[i]-v,0));
  const ag=g.reduce((a,b)=>a+b,0)/g.length||0;
  const al=l.reduce((a,b)=>a+b,0)/l.length||1e-9;
  const rsi=100-100/(1+ag/al);
  if(rsi>72)return{[lb[0]]:0.32,[lb[1]]:0.68};
  if(rsi<28)return{[lb[0]]:0.68,[lb[1]]:0.32};
  if(rsi>60)return{[lb[0]]:0.42,[lb[1]]:0.58};
  if(rsi<40)return{[lb[0]]:0.58,[lb[1]]:0.42};
  return half(lb);
}

// ── 12. MACD + SIGNAL LINE ───────────────────────────────────
function macdFull(r,lb){
  if(r.length<26)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  function ema(d,sp){let a=2/(sp+1),e=d[0];d.slice(1).forEach(v=>e=a*v+(1-a)*e);return e;}
  const e12=ema(b.slice(-12),12);const e26=ema(b.slice(-26),26);
  const m=e12-e26;
  let sig=b.slice(-9)[0];b.slice(-9).slice(1).forEach(v=>sig=0.25*v+0.75*sig);
  const hist=m-sig;
  if(hist>0.04)return{[lb[0]]:0.65,[lb[1]]:0.35};
  if(hist<-0.04)return{[lb[0]]:0.35,[lb[1]]:0.65};
  if(m>0.02)return{[lb[0]]:0.57,[lb[1]]:0.43};
  if(m<-0.02)return{[lb[0]]:0.43,[lb[1]]:0.57};
  return half(lb);
}

// ── 13. AUTOCORRELATION ──────────────────────────────────────
function acorP(r,lb){
  if(r.length<15)return half(lb);
  const b=r.slice(-25).map(v=>v===lb[0]?1:0);
  const mean=b.reduce((a,v)=>a+v,0)/b.length;
  const dem=b.map(x=>x-mean);const va=dem.reduce((a,x)=>a+x**2,0)||1;
  const lag1=dem.slice(0,-1).reduce((a,v,i)=>a+v*dem[i+1],0)/va;
  const lag2=dem.slice(0,-2).reduce((a,v,i)=>a+v*dem[i+2],0)/va;
  const combined=lag1*0.7+lag2*0.3;
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(combined>0.25)return{[last]:Math.min(0.72,0.62+combined*0.2),[ot]:Math.max(0.28,0.38-combined*0.2)};
  if(combined<-0.25)return{[ot]:Math.min(0.72,0.62-combined*0.2),[last]:Math.max(0.28,0.38+combined*0.2)};
  return half(lb);
}

// ── 14. LEMPEL-ZIV COMPLEXITY ────────────────────────────────
function lzComp(r,lb){
  if(r.length<12)return half(lb);
  const seq=r.slice(-24).map(v=>v===lb[0]?"1":"0").join("");
  const subs=new Set();let i=0;
  while(i<seq.length){let j=i+1;while(j<=seq.length&&subs.has(seq.slice(i,j)))j++;if(j<=seq.length)subs.add(seq.slice(i,j));i=j;}
  const comp=subs.size/seq.length;
  const c10=r.slice(-10);const cnt={};lb.forEach(l=>cnt[l]=c10.filter(x=>x===l).length);
  const dom=lb.reduce((a,b)=>cnt[a]>=cnt[b]?a:b);const ot=lb.find(l=>l!==dom);
  if(comp<0.32)return{[dom]:0.65,[ot]:0.35};
  if(comp>0.68)return{[ot]:0.58,[dom]:0.42};
  return half(lb);
}

// ── 15. RUN-LENGTH ANALYSIS ───────────────────────────────────
function rleA(r,lb){
  if(r.length<8)return half(lb);
  const runs=[];let cv=r[0],cl=1;
  for(let i=1;i<r.length;i++){if(r[i]===cv)cl++;else{runs.push([cv,cl]);cv=r[i];cl=1;}}
  runs.push([cv,cl]);
  if(runs.length<3)return half(lb);
  const last=runs[runs.length-1];
  const lens=runs.slice(-6).map(x=>x[1]);
  const avg=lens.reduce((a,b)=>a+b,0)/lens.length;
  const std=Math.sqrt(lens.reduce((a,v)=>a+(v-avg)**2,0)/lens.length);
  const ot=lb.find(l=>l!==last[0]);
  if(last[1]>avg+std*1.2)return{[ot]:0.68,[last[0]]:0.32};
  if(last[1]<avg-std*0.5&&last[1]>=2)return{[last[0]]:0.60,[ot]:0.40};
  return half(lb);
}

// ── 16. ADAPTIVE THRESHOLD ───────────────────────────────────
function adaptThr(r,lb){
  if(r.length<8)return half(lb);
  const s=r.slice(-12);const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length);
  const dom=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot=lb.find(l=>l!==dom);
  const ratio=c[dom]/s.length;
  if(ratio>=0.83)return{[ot]:0.72,[dom]:0.28};
  if(ratio>=0.75)return{[ot]:0.62,[dom]:0.38};
  if(ratio>=0.67)return{[ot]:0.55,[dom]:0.45};
  if(ratio>=0.58)return{[dom]:0.55,[ot]:0.45};
  return half(lb);
}

// ── 17. DOUBLE EMA CROSSOVER ─────────────────────────────────
function dema(r,lb){
  if(r.length<12)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  let e1=b[0],e2=b[0];
  b.slice(1).forEach(v=>{e1=0.35*v+0.65*e1;e2=0.15*v+0.85*e2;});
  const diff=e1-e2;
  if(diff>0.08)return{[lb[0]]:0.65,[lb[1]]:0.35};
  if(diff<-0.08)return{[lb[0]]:0.35,[lb[1]]:0.65};
  if(diff>0.03)return{[lb[0]]:0.57,[lb[1]]:0.43};
  if(diff<-0.03)return{[lb[0]]:0.43,[lb[1]]:0.57};
  return half(lb);
}

// ── 18. CHI-SQUARE BIAS TEST ─────────────────────────────────
function chiSq(r,lb){
  if(r.length<20)return half(lb);
  const s=r.slice(-40);const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length);
  const exp=s.length/lb.length;
  const chi=lb.reduce((a,l)=>a+(c[l]-exp)**2/exp,0);
  if(chi>5.0){const dom=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot=lb.find(l=>l!==dom);return{[ot]:0.63,[dom]:0.37};}
  if(chi>3.0){const dom=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot=lb.find(l=>l!==dom);return{[ot]:0.57,[dom]:0.43};}
  return half(lb);
}

// ── 19. REVERSAL DETECTOR ────────────────────────────────────
function reversalD(r,lb){
  if(r.length<8)return half(lb);
  const s=r.slice(-8);const rev=s.slice(1).filter((v,i)=>v!==s[i]).length;
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(rev>=7)return{[ot]:0.70,[last]:0.30};
  if(rev<=1)return{[last]:0.70,[ot]:0.30};
  if(rev>=6)return{[ot]:0.60,[last]:0.40};
  if(rev<=2)return{[last]:0.58,[ot]:0.42};
  return half(lb);
}

// ── 20. PERIOD DETECTOR ──────────────────────────────────────
function periodD(r,lb){
  if(r.length<14)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  let bestP=null,bestScore=0.65;
  for(let p=2;p<=Math.min(10,Math.floor(b.length/3));p++){
    const m=b.slice(0,-p).filter((v,i)=>v===b[i+p]).length/(b.length-p);
    if(m>bestScore){bestScore=m;bestP=p;}
  }
  if(bestP){
    const idx=r.length%bestP;
    const hist=[];for(let i=idx;i<r.length-bestP;i+=bestP)if(lb.includes(r[i]))hist.push(r[i]);
    if(hist.length>=3){const c={};lb.forEach(l=>c[l]=hist.filter(x=>x===l).length);
      const best2=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot2=lb.find(l=>l!==best2);
      return{[best2]:Math.min(0.70,0.60+(bestScore-0.65)*0.5),[ot2]:Math.max(0.30,0.40-(bestScore-0.65)*0.5)};}
  }
  return half(lb);
}

// ── TX METHODS MAP ────────────────────────────────────────────
const METHODS = {
  "mk1":   (r,lb)=>markovW(r,lb,1),
  "mk2":   (r,lb)=>markovW(r,lb,2),
  "mk3":   (r,lb)=>markovW(r,lb,3),
  "mk4":   (r,lb)=>markovW(r,lb,4),
  "kalman":(r,lb)=>kalman(r,lb),
  "lstm":  (r,lb)=>lstmI(r,lb),
  "dpat":  (r,lb)=>deepPat(r,lb),
  "hmm":   (r,lb)=>hmm(r,lb),
  "knn":   (r,lb)=>knn(r,lb),
  "logit": (r,lb)=>logitReg(r,lb),
  "hurst": (r,lb)=>hurstE(r,lb),
  "ent":   (r,lb)=>entropyEns(r,lb),
  "tpm":   (r,lb)=>temporalPM(r,lb),
  "rsi":   (r,lb)=>rsiDiv(r,lb),
  "macd":  (r,lb)=>macdFull(r,lb),
  "acor":  (r,lb)=>acorP(r,lb),
  "lz":    (r,lb)=>lzComp(r,lb),
  "rle":   (r,lb)=>rleA(r,lb),
  "adapt": (r,lb)=>adaptThr(r,lb),
  "dema":  (r,lb)=>dema(r,lb),
  "chi2":  (r,lb)=>chiSq(r,lb),
  "rev":   (r,lb)=>reversalD(r,lb),
  "per":   (r,lb)=>periodD(r,lb),
};

const METHOD_NAMES = {
  "mk1":"Markov-1","mk2":"Markov-2","mk3":"Markov-3","mk4":"Markov-4",
  "kalman":"Kalman Filter","lstm":"LSTM Gate","dpat":"Deep Pattern",
  "hmm":"Hidden Markov","knn":"KNN Sequence","logit":"Logistic Reg",
  "hurst":"Hurst Exponent","ent":"Entropy Ensemble","tpm":"Temporal Mining",
  "rsi":"RSI Divergence","macd":"MACD Signal","acor":"Autocorrelation",
  "lz":"Lempel-Ziv","rle":"Run-Length","adapt":"Adaptive Threshold",
  "dema":"Double EMA","chi2":"Chi-Square","rev":"Reversal","per":"Period Detect",
};

// ════════════════════════════════════════════════════════════
//  PHẦN 2: BACCARAT ENGINE — HOÀN TOÀN RIÊNG BIỆT
//  BCR có Hòa (T), dùng full seq kể cả Hòa để phân tích
//  Nhưng chỉ predict Cái/Con (bỏ qua Hòa trong output)
// ════════════════════════════════════════════════════════════

// ── BCR 1. MARKOV CÓ HÒA (filtered predict) ──────────────────
function bcrMarkov(r,lb,order=2){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<order+3)return half(lb);
  const tr={};const n=seq.length;
  for(let i=0;i<n-order;i++){
    const k=seq.slice(i,i+order).join("|");const nx=seq[i+order];
    const w=Math.exp((i-n+1)*0.10);
    if(!tr[k])tr[k]={};tr[k][nx]=(tr[k][nx]||0)+w;
  }
  for(let o=order;o>=1;o--){
    const k=seq.slice(-o).join("|");
    if(tr[k]){const tot=Object.values(tr[k]).reduce((a,b)=>a+b,0);if(tot>0){const res={};lb.forEach(l=>res[l]=(tr[k][l]||0)/tot);return res;}}
  }
  return half(lb);
}

// ── BCR 2. BIG ROAD (chuẩn casino) ───────────────────────────
function bigRoad(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<6)return half(lb);
  const last=seq[seq.length-1];const ot=lb.find(l=>l!==last);
  let streak=1;for(let i=seq.length-2;i>=0;i--){if(seq[i]===last)streak++;else break;}
  const chops=seq.slice(-8).slice(1).reduce((a,v,i)=>a+(v!==seq.slice(-8)[i]?1:0),0);
  if(streak>=6)return{[ot]:0.70,[last]:0.30};
  if(streak>=4)return{[ot]:0.62,[last]:0.38};
  if(streak>=3)return{[ot]:0.55,[last]:0.45};
  if(chops>=6)return{[ot]:0.60,[last]:0.40};
  if(chops>=4)return{[ot]:0.55,[last]:0.45};
  return half(lb);
}

// ── BCR 3. BEAD PLATE (6-column repeat) ──────────────────────
function beadPlate(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<12)return half(lb);
  const col6=[];for(let i=0;i<seq.length;i+=6)col6.push(seq.slice(i,i+6));
  if(col6.length<2)return half(lb);
  const lastCol=col6[col6.length-1];const pos=lastCol.length;
  const votes={};lb.forEach(l=>votes[l]=0);
  for(let c=Math.max(0,col6.length-4);c<col6.length-1;c++){
    const ref=col6[c];if(pos<ref.length&&lb.includes(ref[pos]))votes[ref[pos]]+=1/(col6.length-c);
  }
  const t=Object.values(votes).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);
  return norm(votes,lb);
}

// ── BCR 4. DERIVED ROAD (cockroach road) ─────────────────────
function derivedRoad(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<15)return half(lb);
  const derived=[];
  for(let i=2;i<seq.length;i++)derived.push(seq[i]===seq[i-2]?"S":"D");
  if(derived.length<6)return half(lb);
  const lastD=derived[derived.length-1];
  const last=seq[seq.length-1];const ot=lb.find(l=>l!==last);
  if(lastD==="S"){const prev=seq[seq.length-2];return{[prev]:0.60,[lb.find(l=>l!==prev)]:0.40};}
  return{[ot]:0.58,[last]:0.42};
}

// ── BCR 5. SHOE TREND (3-segment) ────────────────────────────
function shoeTrend(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<15)return half(lb);
  const n=seq.length;
  const s1=seq.slice(0,Math.floor(n/3));
  const s2=seq.slice(Math.floor(n/3),Math.floor(2*n/3));
  const s3=seq.slice(Math.floor(2*n/3));
  const rate={};lb.forEach(l=>{
    const r1=s1.filter(x=>x===l).length/(s1.length||1);
    const r2=s2.filter(x=>x===l).length/(s2.length||1);
    const r3=s3.filter(x=>x===l).length/(s3.length||1);
    rate[l]=r3+(r3-r2)*0.6+(r3-r1)*0.2;
  });
  return norm(rate,lb);
}

// ── BCR 6. KALMAN BCR ────────────────────────────────────────
function bcrKalman(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<8)return half(lb);
  const b=seq.map(v=>v===lb[0]?1:0);
  let x=0.5,P=1;const Q=0.02,R=0.10;
  b.forEach(v=>{const Pp=P+Q;const K=Pp/(Pp+R);x+=K*(v-x);P=(1-K)*Pp;});
  return{[lb[0]]:Math.max(0.08,Math.min(0.92,x)),[lb[1]]:Math.max(0.08,Math.min(0.92,1-x))};
}

// ── BCR 7. HÒA IMPACT (sau Hòa có bias) ──────────────────────
function tieImpact(r,lb){
  const afterTie=[];
  for(let i=0;i<r.length-1;i++){if(r[i]==="Hoa"&&lb.includes(r[i+1]))afterTie.push(r[i+1]);}
  if(afterTie.length<3)return half(lb);
  const c={};lb.forEach(l=>c[l]=afterTie.filter(x=>x===l).length);
  let tieStreak=0;for(let i=r.length-1;i>=0;i--){if(r[i]==="Hoa")tieStreak++;else break;}
  const bias=tieStreak>=2?1.4:1.0;
  const res={};lb.forEach(l=>res[l]=(c[l]/afterTie.length)*bias);
  return norm(res,lb);
}

// ── BCR 8. PATTERN MINING BCR ────────────────────────────────
function bcrPat(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<12)return half(lb);
  const v={};lb.forEach(l=>v[l]=0);let tw=0;
  for(let pl=2;pl<=Math.min(6,Math.floor(seq.length/3));pl++){
    const cur=seq.slice(-pl).join("|");
    for(let i=0;i<seq.length-pl-1;i++){
      if(seq.slice(i,i+pl).join("|")!==cur)continue;
      const nx=seq[i+pl];if(!lb.includes(nx))continue;
      const w=Math.exp((i-seq.length)*0.09)/pl;
      v[nx]+=w;tw+=w;
    }
  }
  if(!tw)return half(lb);
  return norm({[lb[0]]:v[lb[0]]||0,[lb[1]]:v[lb[1]]||0},lb);
}

// ── BCR 9. LOGISTIC BCR ──────────────────────────────────────
function bcrLogit(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  if(seq.length<12)return half(lb);
  const b=seq.slice(-30).map(v=>v===lb[0]?1:0);const n=b.length;
  const r4=b.slice(-4).reduce((a,v)=>a+v,0)/4;
  const r10=b.slice(-10).reduce((a,v)=>a+v,0)/Math.min(10,n);
  const ra=b.reduce((a,v)=>a+v,0)/n;
  let streak=1;for(let i=seq.length-2;i>=0;i--){if(seq[i]===seq[seq.length-1])streak++;else break;}
  const sf=(seq[seq.length-1]===lb[0]?streak:-streak)/8;
  const hoaR=r.slice(-20).filter(x=>x==="Hoa").length/20;
  const logit=2.2*r4+1.0*r10-0.9*ra+0.7*sf-0.6*hoaR-0.7;
  const prob=1/(1+Math.exp(-logit*2.2));
  return{[lb[0]]:Math.max(0.08,Math.min(0.92,prob)),[lb[1]]:Math.max(0.08,Math.min(0.92,1-prob))};
}

// ── BCR 10. HMM BCR ──────────────────────────────────────────
function bcrHmm(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  return hmm(seq,lb);
}

// ── BCR 11. KNN BCR ──────────────────────────────────────────
function bcrKnn(r,lb){
  const seq=r.filter(x=>lb.includes(x));
  return knn(seq,lb);
}

// ── BCR METHODS MAP ───────────────────────────────────────────
const BCR_METHODS = {
  "bcrMk1":    (r,lb)=>bcrMarkov(r,lb,1),
  "bcrMk2":    (r,lb)=>bcrMarkov(r,lb,2),
  "bcrMk3":    (r,lb)=>bcrMarkov(r,lb,3),
  "bigRoad":   (r,lb)=>bigRoad(r,lb),
  "beadPlate": (r,lb)=>beadPlate(r,lb),
  "derivedRd": (r,lb)=>derivedRoad(r,lb),
  "shoeTrend": (r,lb)=>shoeTrend(r,lb),
  "bcrKalman": (r,lb)=>bcrKalman(r,lb),
  "tieImpact": (r,lb)=>tieImpact(r,lb),
  "bcrPat":    (r,lb)=>bcrPat(r,lb),
  "bcrLogit":  (r,lb)=>bcrLogit(r,lb),
  "bcrHmm":    (r,lb)=>bcrHmm(r,lb),
  "bcrKnn":    (r,lb)=>bcrKnn(r,lb),
};

const BCR_METHOD_NAMES = {
  "bcrMk1":"BCR Markov-1","bcrMk2":"BCR Markov-2","bcrMk3":"BCR Markov-3",
  "bigRoad":"Big Road","beadPlate":"Bead Plate","derivedRd":"Cockroach Road",
  "shoeTrend":"Shoe Trend","bcrKalman":"Kalman BCR","tieImpact":"Tie Impact",
  "bcrPat":"BCR Pattern","bcrLogit":"Logistic BCR","bcrHmm":"HMM BCR","bcrKnn":"KNN BCR",
};

// ════════════════════════════════════════════════════════════
//  BACKTEST chung
// ════════════════════════════════════════════════════════════
function backtest(fn,r,lb,window=20){
  if(r.length<8)return 0.5;
  let correct=0,total=0;
  const start=Math.max(8,r.length-Math.min(window,20));
  for(let i=start;i<r.length-1;i++){
    let s;try{s=fn(r.slice(0,i),lb);}catch{s=half(lb);}
    const pred=lb.reduce((a,b)=>(s[a]||0)>=(s[b]||0)?a:b);
    if(pred===r[i])correct++;total++;
  }
  return total>0?correct/total:0.5;
}

// ════════════════════════════════════════════════════════════
//  ENSEMBLE TX/MD5 — cho Tài Xỉu / Sicbo / Xóc Đĩa
// ════════════════════════════════════════════════════════════
function ensemblePredict(results, lb) {
  const names = Object.keys(METHODS);
  const rawScores = {};
  names.forEach(name => {
    try { rawScores[name] = METHODS[name](results, lb); }
    catch { rawScores[name] = half(lb); }
  });
  const btAcc = {};
  names.forEach(name => {
    try { btAcc[name] = backtest(METHODS[name], results, lb); }
    catch { btAcc[name] = 0.5; }
  });
  const minAcc = Math.min(...Object.values(btAcc));
  const adj = {}; names.forEach(n => adj[n] = Math.max(btAcc[n]-minAcc, 0.005)**2.0);
  const totalAdj = Object.values(adj).reduce((a,b)=>a+b,0)||1;
  const w = {}; names.forEach(n => w[n] = adj[n]/totalAdj);
  const final = {}; lb.forEach(l => final[l] = 0);
  names.forEach(name => { const s=rawScores[name]; lb.forEach(l => final[l]+=(s[l]||0.5)*w[name]); });
  const normed = norm(final, lb);
  const best = lb.reduce((a,b) => normed[a]>=normed[b]?a:b);
  const other = lb.find(l => l!==best);
  const margin = normed[best]-normed[other];
  const votes = {}; lb.forEach(l => votes[l] = 0);
  names.forEach(name => { const s=rawScores[name]; const top=lb.reduce((a,b)=>(s[a]||0)>=(s[b]||0)?a:b); votes[top]=(votes[top]||0)+1; });
  const voteBest = votes[best]||0;
  const voteRatio = voteBest/names.length;
  const topM = names.reduce((a,b) => btAcc[a]>btAcc[b]?a:b);
  const topAcc = Math.round(btAcc[topM]*100);
  const avgAcc = Object.values(btAcc).reduce((a,b)=>a+b,0)/names.length;
  const conf = Math.min(Math.round((normed[best]*0.30+voteRatio*0.25+avgAcc*0.28+margin*0.17)*100),94);
  return { best, conf, votes: voteBest, total: names.length, topM, topAcc, btAcc };
}

// ════════════════════════════════════════════════════════════
//  ENSEMBLE BCR — riêng cho Baccarat
// ════════════════════════════════════════════════════════════
function ensembleBCR(results, lb) {
  // lb = ["Cai","Con"]
  const names = Object.keys(BCR_METHODS);
  const rawScores = {};
  names.forEach(name => {
    try { rawScores[name] = BCR_METHODS[name](results, lb); }
    catch { rawScores[name] = half(lb); }
  });
  const btAcc = {};
  names.forEach(name => {
    const filtered=results.filter(x=>lb.includes(x));
    try { btAcc[name] = backtest((r,l)=>BCR_METHODS[name](r,l), filtered, lb); }
    catch { btAcc[name] = 0.5; }
  });
  const minAcc = Math.min(...Object.values(btAcc));
  const adj = {}; names.forEach(n => adj[n] = Math.max(btAcc[n]-minAcc, 0.005)**2.0);
  const totalAdj = Object.values(adj).reduce((a,b)=>a+b,0)||1;
  const w = {}; names.forEach(n => w[n] = adj[n]/totalAdj);
  const final = {}; lb.forEach(l => final[l] = 0);
  names.forEach(name => { const s=rawScores[name]; lb.forEach(l => final[l]+=(s[l]||0.5)*w[name]); });
  const normed = norm(final, lb);
  const best = lb.reduce((a,b) => normed[a]>=normed[b]?a:b);
  const other = lb.find(l => l!==best);
  const margin = normed[best]-normed[other];
  const votes = {}; lb.forEach(l => votes[l] = 0);
  names.forEach(name => { const s=rawScores[name]; const top=lb.reduce((a,b)=>(s[a]||0)>=(s[b]||0)?a:b); votes[top]=(votes[top]||0)+1; });
  const voteBest = votes[best]||0;
  const voteRatio = voteBest/names.length;
  const topM = names.reduce((a,b) => btAcc[a]>btAcc[b]?a:b);
  const topAcc = Math.round(btAcc[topM]*100);
  const avgAcc = Object.values(btAcc).reduce((a,b)=>a+b,0)/names.length;
  // BCR confidence cap thấp hơn TX (baccarat khó hơn)
  const conf = Math.min(Math.round((normed[best]*0.32+voteRatio*0.28+avgAcc*0.25+margin*0.15)*100),91);
  return { best, conf, votes: voteBest, total: names.length, topM, topAcc, btAcc };
}

// ─── EXPORT ──────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.ensemblePredict  = ensemblePredict;
  window.ensembleBCR      = ensembleBCR;
  window.METHODS          = METHODS;
  window.BCR_METHODS      = BCR_METHODS;
  window.METHOD_NAMES     = METHOD_NAMES;
  window.BCR_METHOD_NAMES = BCR_METHOD_NAMES;
  window.backtest         = backtest;
}

// ─── UI UTILITIES (dùng cho hiển thị, không liên quan predict) ─
function calcStreak(r) {
  if (!r || r.length === 0) return 0;
  let s = 1;
  for (let i = r.length - 2; i >= 0; i--) {
    if (r[i] === r[r.length - 1]) s++;
    else break;
  }
  return s;
}
if (typeof window !== 'undefined') window.calcStreak = calcStreak;
