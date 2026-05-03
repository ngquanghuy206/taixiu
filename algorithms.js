// ═══════════════════════════════════════════════════════════
//  ALGORITHMS — Port từ Discord Bot  |  Tài Xỉu AI
//  by Nguyễn Quang Huy Dzi
// ═══════════════════════════════════════════════════════════

// ─── UTILS ───────────────────────────────────────────────────
function norm(sc,lb){const t=lb.reduce((a,l)=>a+(sc[l]||0),0)||1;const r={};lb.forEach(l=>r[l]=(sc[l]||0)/t);return r}
function half(lb){const r={};lb.forEach(l=>r[l]=0.5);return r}

// ─── WEIGHTED FREQUENCY ──────────────────────────────────────
function wfreq(r,lb,d=0.10){const s={};lb.forEach(l=>s[l]=0);const n=r.length;r.forEach((v,i)=>{if(s[v]!==undefined)s[v]+=Math.exp((i-n+1)*d)});return norm(s,lb)}

// ─── MARKOV ──────────────────────────────────────────────────
function markov(r,lb,o=1){
  if(r.length<o+2)return half(lb);
  const tr={};
  for(let i=0;i<r.length-o;i++){
    const k=r.slice(i,i+o).join("|");const nx=r[i+o];
    if(lb.includes(nx)){if(!tr[k])tr[k]={};tr[k][nx]=(tr[k][nx]||0)+1;}
  }
  const k=r.slice(-o).join("|");
  if(tr[k]){const tot=Object.values(tr[k]).reduce((a,b)=>a+b,0);if(tot>0){const res={};lb.forEach(l=>res[l]=(tr[k][l]||0)/tot);return res;}}
  return half(lb);
}
function markovW(r,lb){
  if(r.length<5)return half(lb);
  const s={};lb.forEach(l=>s[l]=0);
  const n=r.length;
  for(let i=0;i<n-1;i++){
    const a=r[i],b=r[i+1];
    if(lb.includes(a)&&lb.includes(b)){const w=Math.exp((i-n+1)*0.15);if(!s._tr)s._tr={};if(!s._tr[a])s._tr[a]={};s._tr[a][b]=(s._tr[a][b]||0)+w;}
  }
  const last=r[r.length-1];
  if(s._tr&&s._tr[last]){const tot=Object.values(s._tr[last]).reduce((a,b)=>a+b,0);if(tot>0){const res={};lb.forEach(l=>res[l]=(s._tr[last][l]||0)/tot);return res;}}
  return half(lb);
}

// ─── STREAK ──────────────────────────────────────────────────
function calcStreak(r){if(!r.length)return 0;let s=1;for(let i=r.length-2;i>=0;i--){if(r[i]===r[r.length-1])s++;else break;}return s;}
function streakB(r,lb){
  if(r.length<2)return half(lb);
  const s=calcStreak(r);const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  const sc={};
  if(s>=7){sc[ot]=0.86;sc[last]=0.14}
  else if(s>=5){sc[ot]=0.73;sc[last]=0.27}
  else if(s>=4){sc[ot]=0.65;sc[last]=0.35}
  else if(s>=3){sc[ot]=0.58;sc[last]=0.42}
  else if(s===2){sc[last]=0.54;sc[ot]=0.46}
  else return half(lb);
  return sc;
}
function antiStreak(r,lb){
  if(r.length<3)return half(lb);
  const s=calcStreak(r);const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(s>=6)return{[ot]:0.82,[last]:0.18};
  if(s>=4)return{[ot]:0.70,[last]:0.30};
  return half(lb);
}
function streakCont(r,lb){
  if(r.length<3)return half(lb);
  const s=calcStreak(r);const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(s===2)return{[last]:0.58,[ot]:0.42};
  return half(lb);
}

// ─── WINDOW VOTE ─────────────────────────────────────────────
function winV(r,lb,ws=[3,5,8,10,15,20]){
  const v={};lb.forEach(l=>v[l]=0);
  ws.forEach(w=>{
    if(r.length>=w){
      const c={};lb.forEach(l=>c[l]=r.slice(-w).filter(x=>x===l).length);
      const b=lb.reduce((a,b)=>c[a]>c[b]?a:b);v[b]+=1;
    }
  });
  const t=Object.values(v).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);
  const res={};lb.forEach(l=>res[l]=v[l]/t);return res;
}

// ─── BAYESIAN ────────────────────────────────────────────────
function bayR(r,lb){const s=r.slice(-15);const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length+1);const t=Object.values(c).reduce((a,b)=>a+b,0);const res={};lb.forEach(l=>res[l]=c[l]/t);return res;}
function bayLap(r,lb){const s=r.slice(-20);const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length+1);const t=s.length+lb.length;const res={};lb.forEach(l=>res[l]=c[l]/t);return res;}

// ─── EMA ─────────────────────────────────────────────────────
function emaS(r,lb,a=0.3){
  if(r.length<5)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);let e=b[0];b.slice(1).forEach(v=>e=a*v+(1-a)*e);
  if(e>0.58)return{[lb[0]]:Math.min(0.9,0.5+e*0.3),[lb[1]]:Math.max(0.1,1-0.5-e*0.3)};
  if(e<0.42)return{[lb[0]]:Math.max(0.1,0.5-e*0.3),[lb[1]]:Math.min(0.9,1-0.5+e*0.3)};
  return half(lb);
}
function doubleEma(r,lb){
  if(r.length<10)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  let e1=b[0],e2=b[0];
  b.slice(1).forEach(v=>{e1=0.3*v+(0.7)*e1;e2=0.15*v+(0.85)*e2;});
  if(e1>e2+0.05)return{[lb[0]]:0.63,[lb[1]]:0.37};
  if(e1<e2-0.05)return{[lb[0]]:0.37,[lb[1]]:0.63};
  return half(lb);
}

// ─── REGRESSION ──────────────────────────────────────────────
function regT(r,lb){
  if(r.length<8)return half(lb);
  const b=r.slice(-15).map(v=>v===lb[0]?1:0);const n=b.length;
  const xm=(n-1)/2;const ym=b.reduce((a,v)=>a+v,0)/n;
  const num=b.reduce((s,v,i)=>s+(i-xm)*(v-ym),0);
  const den=b.reduce((s,_,i)=>s+(i-xm)**2,0);
  if(!den)return half(lb);
  const sl=num/den;const p=Math.max(0.1,Math.min(0.9,ym+sl*(n-xm)));
  if(p>0.55)return{[lb[0]]:p,[lb[1]]:1-p};
  if(p<0.45)return{[lb[0]]:p,[lb[1]]:1-p};
  return half(lb);
}

// ─── TECHNICAL INDICATORS ────────────────────────────────────
function rsiS(r,lb){
  if(r.length<14)return half(lb);
  const b=r.slice(-15).map(v=>v===lb[0]?1:0);
  const g=b.slice(1).map((v,i)=>Math.max(v-b[i],0));
  const l=b.slice(1).map((v,i)=>Math.max(b[i]-v,0));
  const ag=g.reduce((a,b)=>a+b,0)/g.length;
  const al=l.reduce((a,b)=>a+b,0)/l.length;
  if(!al)return half(lb);
  const rsi=100-100/(1+ag/al);
  if(rsi>70)return{[lb[0]]:0.35,[lb[1]]:0.65};
  if(rsi<30)return{[lb[0]]:0.65,[lb[1]]:0.35};
  return half(lb);
}
function bbS(r,lb){
  if(r.length<15)return half(lb);
  const b=r.slice(-20).map(v=>v===lb[0]?1:0);
  const mean=b.reduce((a,v)=>a+v,0)/b.length;
  const std=Math.sqrt(b.reduce((a,v)=>a+(v-mean)**2,0)/b.length);
  const lv=b[b.length-1];
  if(lv>mean+2*std-0.1)return{[lb[0]]:0.35,[lb[1]]:0.65};
  if(lv<mean-2*std+0.1)return{[lb[0]]:0.65,[lb[1]]:0.35};
  return half(lb);
}
function macdS(r,lb){
  if(r.length<20)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  function ec(d,sp){let a=2/(sp+1),e=d[0];d.slice(1).forEach(v=>e=a*v+(1-a)*e);return e;}
  const e12=ec(b.slice(-12),12);const e26=ec(b.length>=26?b.slice(-26):b,26);
  const m=e12-e26;
  if(m>0.05)return{[lb[0]]:0.62,[lb[1]]:0.38};
  if(m<-0.05)return{[lb[0]]:0.38,[lb[1]]:0.62};
  return half(lb);
}
function macX(r,lb){
  if(r.length<12)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  const ms=b.slice(-5).reduce((a,v)=>a+v,0)/5;
  const ml=b.slice(-12).reduce((a,v)=>a+v,0)/12;
  if(ms>ml+0.05)return{[lb[0]]:0.62,[lb[1]]:0.38};
  if(ms<ml-0.05)return{[lb[0]]:0.38,[lb[1]]:0.62};
  return half(lb);
}
function stoS(r,lb){
  if(r.length<8)return half(lb);
  const b=r.slice(-14).map(v=>v===lb[0]?1:0);
  const h=Math.max(...b);const l=Math.min(...b);
  if(h===l)return half(lb);
  const k=(b[b.length-1]-l)/(h-l);
  if(k>0.7)return{[lb[0]]:0.40,[lb[1]]:0.60};
  if(k<0.3)return{[lb[0]]:0.60,[lb[1]]:0.40};
  return half(lb);
}
function ichS(r,lb){
  if(r.length<26)return half(lb);
  const b=r.slice(-26).map(v=>v===lb[0]?1:0);
  const ten=(Math.max(...b.slice(-9))+Math.min(...b.slice(-9)))/2;
  const kij=(Math.max(...b)+Math.min(...b))/2;
  if(ten>kij)return{[lb[0]]:0.62,[lb[1]]:0.38};
  if(ten<kij)return{[lb[0]]:0.38,[lb[1]]:0.62};
  return half(lb);
}
function mrS(r,lb){
  if(r.length<10)return half(lb);
  const b=r.slice(-20).map(v=>v===lb[0]?1:0);
  const lm=b.reduce((a,v)=>a+v,0)/b.length;
  const sm=b.slice(-5).reduce((a,v)=>a+v,0)/5;
  const d=sm-lm;
  if(d>0.15)return{[lb[0]]:0.37,[lb[1]]:0.63};
  if(d<-0.15)return{[lb[0]]:0.63,[lb[1]]:0.37};
  return half(lb);
}

// ─── PATTERN ─────────────────────────────────────────────────
function patC(r,lb,n){
  if(r.length<n+2)return half(lb);
  const cur=r.slice(-n).join("|");const fol={};lb.forEach(l=>fol[l]=0);
  for(let i=0;i<r.length-n-1;i++){if(r.slice(i,i+n).join("|")===cur&&lb.includes(r[i+n]))fol[r[i+n]]++;}
  const t=Object.values(fol).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);const res={};lb.forEach(l=>res[l]=fol[l]/t);return res;
}
function deepP(r,lb){
  if(r.length<15)return half(lb);
  const v={};lb.forEach(l=>v[l]=0);
  for(let pl=1;pl<Math.min(10,Math.floor(r.length/2));pl++){
    const cur=r.slice(-pl).join("|");
    for(let i=0;i<r.length-pl-1;i++){
      if(r.slice(i,i+pl).join("|")===cur&&lb.includes(r[i+pl]))
        v[r[i+pl]]+=Math.exp((i-r.length)*0.05)/pl;
    }
  }
  const t=Object.values(v).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);const res={};lb.forEach(l=>res[l]=v[l]/t);return res;
}

// ─── COMPLEXITY / CHAOS ──────────────────────────────────────
function kalS(r,lb){
  if(r.length<8)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);let x=0.5,P=1;const Q=0.01,R=0.1;
  b.forEach(v=>{const Pp=P+Q;const K=Pp/(Pp+R);x+=K*(v-x);P=(1-K)*Pp;});
  x=Math.max(0.1,Math.min(0.9,x));
  if(x>0.58)return{[lb[0]]:x,[lb[1]]:1-x};
  if(x<0.42)return{[lb[0]]:x,[lb[1]]:1-x};
  return half(lb);
}
function hurstS(r,lb){
  if(r.length<20)return half(lb);
  const b=r.slice(-20).map(v=>v===lb[0]?1:0);
  const mean=b.reduce((a,v)=>a+v,0)/b.length;
  const cd=b.map((_,i)=>b.slice(0,i+1).reduce((a,v)=>a+v,0)-mean*(i+1));
  const R=Math.max(...cd)-Math.min(...cd);
  const S=Math.sqrt(b.reduce((a,v)=>a+(v-mean)**2,0)/b.length);
  const RS=S>0?R/S:1;const H=RS>0?Math.log(RS)/Math.log(b.length):0.5;
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(H>0.6)return{[last]:0.62,[ot]:0.38};
  if(H<0.4)return{[ot]:0.62,[last]:0.38};
  return half(lb);
}
function lzS(r,lb){
  if(r.length<10)return half(lb);
  const seq=r.slice(-20).map(v=>v===lb[0]?"1":"0").join("");
  const subs=new Set();let i=0;
  while(i<seq.length){let j=i+1;while(j<=seq.length&&subs.has(seq.slice(i,j)))j++;if(j<=seq.length)subs.add(seq.slice(i,j));i=j;}
  const comp=subs.size/seq.length;const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(comp<0.35){const dom=lb.reduce((a,b)=>r.slice(-10).filter(x=>x===a).length>=r.slice(-10).filter(x=>x===b).length?a:b);return{[dom]:0.63,[lb.find(l=>l!==dom)]:0.37};}
  if(comp>0.65)return{[ot]:0.57,[last]:0.43};
  return half(lb);
}
function chi2S(r,lb){
  if(r.length<15)return half(lb);
  const s=r.slice(-30);const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length);
  const exp=s.length/lb.length;const chi=lb.reduce((a,l)=>a+(c[l]-exp)**2/exp,0);
  if(chi>4){const dom=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot=lb.find(l=>l!==dom);return{[ot]:0.60,[dom]:0.40};}
  return half(lb);
}
function zzS(r,lb){
  if(r.length<4)return half(lb);
  const alt=r.slice(1).filter((v,i)=>v!==r[i]).length/(r.length-1);
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(alt>=0.75)return{[ot]:0.65,[last]:0.35};
  if(alt<=0.25)return{[last]:0.65,[ot]:0.35};
  return half(lb);
}
function fibS(r,lb){
  const v={};lb.forEach(l=>v[l]=0);
  [3,5,8,13,21].forEach(f=>{
    if(r.length>=f){const c={};lb.forEach(l=>c[l]=r.slice(-f).filter(x=>x===l).length);
    const b=lb.reduce((a,b)=>c[a]>c[b]?a:b);v[b]+=1;}
  });
  const t=Object.values(v).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);const res={};lb.forEach(l=>res[l]=v[l]/t);return res;
}
function adaptT(r,lb){
  if(r.length<8)return half(lb);
  const s=r.slice(-10);const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length);
  const dom=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot=lb.find(l=>l!==dom);const ratio=c[dom]/s.length;
  if(ratio>=0.8)return{[ot]:0.70,[dom]:0.30};
  if(ratio>=0.7)return{[ot]:0.60,[dom]:0.40};
  if(ratio>=0.6)return{[dom]:0.55,[ot]:0.45};
  return half(lb);
}
function rleS(r,lb){
  if(r.length<6)return half(lb);
  const runs=[];let cv=r[0],cl=1;
  for(let i=1;i<r.length;i++){if(r[i]===cv)cl++;else{runs.push([cv,cl]);cv=r[i];cl=1;}}
  runs.push([cv,cl]);
  if(runs.length>=3){
    const lens=runs.slice(-3).map(x=>x[1]);const avg=lens.reduce((a,b)=>a+b,0)/lens.length;
    const last=runs[runs.length-1];const ot=lb.find(l=>l!==last[0]);
    if(last[1]>=avg*1.5)return{[ot]:0.65,[last[0]]:0.35};
  }
  return half(lb);
}
function perD(r,lb){
  if(r.length<12)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);let bp=null,bs=0;
  for(let p=2;p<Math.min(8,Math.floor(b.length/2));p++){
    const m=b.slice(0,-p).filter((v,i)=>v===b[i+p]).length/(b.length-p);
    if(m>bs){bs=m;bp=p;}
  }
  if(bp&&bs>0.70){const idx=r.length%bp;const h=[];for(let i=idx;i<r.length-bp;i+=bp)if(lb.includes(r[i]))h.push(r[i]);
    if(h.length){const c={};lb.forEach(l=>c[l]=h.filter(x=>x===l).length);const best=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot=lb.find(l=>l!==best);return{[best]:0.65,[ot]:0.35};}
  }
  return half(lb);
}
function acorS(r,lb){
  if(r.length<10)return half(lb);
  const b=r.slice(-20).map(v=>v===lb[0]?1:0);
  const mean=b.reduce((a,v)=>a+v,0)/b.length;
  const dem=b.map(x=>x-mean);const va=dem.reduce((a,x)=>a+x**2,0)||1;
  const lag1=dem.slice(0,-1).reduce((a,v,i)=>a+v*dem[i+1],0)/va;
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(lag1>0.3)return{[last]:0.62,[ot]:0.38};
  if(lag1<-0.3)return{[ot]:0.62,[last]:0.38};
  return half(lb);
}
function goldenW(r,lb){
  if(r.length<8)return half(lb);
  const w=Math.max(3,Math.floor(r.length/1.618));const s=r.slice(-w);
  const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length);
  const res={};lb.forEach(l=>res[l]=c[l]/s.length);return res;
}
function momO(r,lb){
  if(r.length<12)return half(lb);
  const b=r.slice(-12).map(v=>v===lb[0]?1:0);
  const m=b.slice(-4).reduce((a,v)=>a+v,0)/4-b.slice(0,4).reduce((a,v)=>a+v,0)/4;
  if(m>0.15)return{[lb[0]]:0.63,[lb[1]]:0.37};
  if(m<-0.15)return{[lb[0]]:0.37,[lb[1]]:0.63};
  return half(lb);
}
function trendD(r,lb){
  if(r.length<10)return half(lb);
  const half1=r.slice(0,Math.floor(r.length/2));
  const half2=r.slice(Math.floor(r.length/2));
  const res={};
  lb.forEach(l=>{
    const r1=half1.filter(x=>x===l).length/(half1.length||1);
    const r2=half2.filter(x=>x===l).length/(half2.length||1);
    res[l]=r2+(r2-r1)*0.5;
  });
  return norm(res,lb);
}
function recencyB(r,lb){
  if(r.length<5)return half(lb);
  const scores={};lb.forEach(l=>scores[l]=0);
  const ws=[0.4,0.25,0.15,0.10,0.07,0.03];
  [...r].reverse().slice(0,6).forEach((l,i)=>{if(scores[l]!==undefined)scores[l]+=ws[i]||0.01;});
  return norm(scores,lb);
}
function reversalD(r,lb){
  if(r.length<6)return half(lb);
  const s=r.slice(-6);const rev=s.slice(1).filter((v,i)=>v!==s[i]).length;
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(rev>=5)return{[ot]:0.68,[last]:0.32};
  if(rev<=1)return{[last]:0.68,[ot]:0.32};
  return half(lb);
}
function lastNV(r,lb,n){
  if(r.length<n)return half(lb);
  const s=r.slice(-n);const c={};lb.forEach(l=>c[l]=s.filter(x=>x===l).length);
  const best=lb.reduce((a,b)=>c[a]>c[b]?a:b);const ot=lb.find(l=>l!==best);
  const ratio=c[best]/n;
  const res={};res[best]=Math.min(0.9,0.3+ratio*0.4);res[ot]=1-res[best];
  return res;
}
function dualStreak(r,lb){
  if(r.length<4)return half(lb);
  let s=1;for(let i=r.length-2;i>=0;i--){if(r[i]===r[r.length-1])s++;else break;}
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(s>=4)return{[ot]:0.75,[last]:0.25};
  return half(lb);
}
function logitR(r,lb){
  if(r.length<12)return half(lb);
  const b=r.slice(-20).map(v=>v===lb[0]?1:0);const n=b.length;
  const r3=b.slice(-3).reduce((a,v)=>a+v,0)/3;
  const r8=b.slice(-8).reduce((a,v)=>a+v,0)/8;
  const ra=b.reduce((a,v)=>a+v,0)/n;
  const logit=1.5*r3+0.8*r8-0.5*ra-0.5;
  const prob=1/(1+Math.exp(-logit*3));
  return{[lb[0]]:Math.max(0.1,Math.min(0.9,prob)),[lb[1]]:Math.max(0.1,Math.min(0.9,1-prob))};
}
function lstmI(r,lb){
  if(r.length<10)return half(lb);
  const b=r.map(v=>v===lb[0]?1:0);
  let cell=0.5,hidden=0.5;
  b.forEach(v=>{
    const fg=1/(1+Math.exp(-(hidden+v-1)));
    const ig=1/(1+Math.exp(-(hidden+v)));
    cell=fg*cell+ig*Math.tanh(v+hidden-0.5);
    hidden=1/(1+Math.exp(-cell));
  });
  hidden=Math.max(0.1,Math.min(0.9,hidden));
  return{[lb[0]]:hidden,[lb[1]]:1-hidden};
}
function knnI(r,lb,k=5){
  if(r.length<k+3)return half(lb);
  const query=r.slice(-k);const dists=[];
  for(let i=0;i<r.length-k-1;i++){
    const window=r.slice(i,i+k);
    const dist=query.filter((v,j)=>v!==window[j]).length;
    if(i+k<r.length)dists.push([dist,r[i+k]]);
  }
  dists.sort((a,b)=>a[0]-b[0]);
  const topk=dists.slice(0,k);const votes={};lb.forEach(l=>votes[l]=0);
  topk.forEach(([d,p])=>{if(votes[p]!==undefined)votes[p]+=1/(d+1);});
  const t=Object.values(votes).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);const res={};lb.forEach(l=>res[l]=votes[l]/t);return res;
}
function hmm(r,lb){
  if(r.length<15)return half(lb);
  const trans={};lb.forEach(a=>trans[a]={};lb.forEach(b=>trans[a][b]=1));
  for(let i=0;i<r.length-1;i++){const a=r[i],b=r[i+1];if(trans[a]&&trans[a][b]!==undefined)trans[a][b]++;}
  lb.forEach(a=>{const t=Object.values(trans[a]).reduce((x,y)=>x+y,0);lb.forEach(b=>trans[a][b]/=t);});
  const last=r[r.length-1];const pr=trans[last];
  return norm({[lb[0]]:pr[lb[0]]||0.5,[lb[1]]:pr[lb[1]]||0.5},lb);
}
function entropyWE(r,lb){
  if(r.length<10)return half(lb);
  const fns=[()=>markov(r,lb,1),()=>markov(r,lb,2),()=>streakB(r,lb),()=>emaS(r,lb,0.3),()=>winV(r,lb),()=>bayR(r,lb)];
  const final={};lb.forEach(l=>final[l]=0);let totalW=0;
  fns.forEach(fn=>{
    let s;try{s=fn();}catch{s=half(lb);}
    const probs=lb.map(l=>s[l]||0.5);
    const ent=-probs.reduce((a,p)=>a+p*Math.log2(p+1e-9),0);
    const w=Math.max(1-ent,0.01);
    lb.forEach(l=>final[l]+=(s[l]||0.5)*w);
    totalW+=w;
  });
  if(totalW>0)lb.forEach(l=>final[l]/=totalW);
  return norm(final,lb);
}
function temporalPM(r,lb){
  if(r.length<12)return half(lb);
  const bv={};lb.forEach(l=>bv[l]=0);
  for(let pl=2;pl<Math.min(7,Math.floor(r.length/2));pl++){
    const cur=r.slice(-pl).join("|");
    const matches=[];
    for(let i=0;i<r.length-pl-1;i++){
      if(r.slice(i,i+pl).join("|")===cur&&lb.includes(r[i+pl]))matches.push(r[i+pl]);
    }
    if(matches.length){
      const c={};lb.forEach(l=>c[l]=matches.filter(x=>x===l).length);
      const t=matches.length;const w=1/pl;
      lb.forEach(l=>bv[l]+=c[l]/t*w);
    }
  }
  const t=Object.values(bv).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);const res={};lb.forEach(l=>res[l]=bv[l]/t);return res;
}
function pairA(r,lb){
  if(r.length<4)return half(lb);
  const pairs=[];for(let i=0;i<r.length-1;i+=2)pairs.push([r[i],r[i+1]]);
  const same=pairs.filter(([a,b])=>a===b).length;
  const diff=pairs.length-same;const t=same+diff||1;
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(diff/t>0.65)return{[ot]:0.60,[last]:0.40};
  if(same/t>0.65)return{[last]:0.60,[ot]:0.40};
  return half(lb);
}
function binomT(r,lb){
  if(r.length<10)return half(lb);
  const n=Math.min(r.length,30);const s=r.slice(-n);
  const k=s.filter(x=>x===lb[0]).length;const p=k/n;
  const z=(p-0.5)/Math.sqrt(0.25/n+1e-9);
  if(z>1.5)return{[lb[1]]:0.63,[lb[0]]:0.37};
  if(z<-1.5)return{[lb[0]]:0.63,[lb[1]]:0.37};
  return half(lb);
}
function runsT(r,lb){
  if(r.length<10)return half(lb);
  const s=r.slice(-20);let runs=1;
  for(let i=1;i<s.length;i++)if(s[i]!==s[i-1])runs++;
  const n1=s.filter(x=>x===lb[0]).length;const n2=s.length-n1;
  if(!n1||!n2)return half(lb);
  const expected=(2*n1*n2)/(n1+n2)+1;
  const last=r[r.length-1];const ot=lb.find(l=>l!==last);
  if(runs<expected*0.7)return{[last]:0.62,[ot]:0.38};
  if(runs>expected*1.3)return{[ot]:0.62,[last]:0.38};
  return half(lb);
}
function zigFib(r,lb){
  if(r.length<10)return half(lb);
  const zzv={};lb.forEach(l=>zzv[l]=0);
  [2,3,5,8,13].forEach(f=>{
    if(r.length<f+1)return;
    const sub=r.slice(-f);const zz=sub.slice(1).filter((v,i)=>v!==sub[i]).length/Math.max(sub.length-1,1);
    const last=r[r.length-1];const ot=lb.find(l=>l!==last);
    if(zz>0.7)zzv[ot]+=1/f;else if(zz<0.3)zzv[last]+=1/f;
  });
  const t=Object.values(zzv).reduce((a,b)=>a+b,0);
  if(!t)return half(lb);const res={};lb.forEach(l=>res[l]=zzv[l]/t);return res;
}

// ─── BACKTEST ────────────────────────────────────────────────
function backtest(fn,r,lb,window=15){
  if(r.length<8)return 0.5;
  let correct=0,total=0;
  const start=Math.max(6,r.length-Math.min(window,15));
  for(let i=start;i<r.length-1;i++){
    let s;try{s=fn(r.slice(0,i),lb);}catch{s=half(lb);}
    const pred=lb.reduce((a,b)=>(s[a]||0)>=(s[b]||0)?a:b);
    if(pred===r[i])correct++;
    total++;
  }
  return total>0?correct/total:0.5;
}

// ─── ALL METHODS ─────────────────────────────────────────────
const METHODS = {
  "wf":       (r,lb)=>wfreq(r,lb,0.10),
  "wf_fast":  (r,lb)=>wfreq(r,lb,0.20),
  "wf_slow":  (r,lb)=>wfreq(r,lb,0.05),
  "mk1":      (r,lb)=>markov(r,lb,1),
  "mk2":      (r,lb)=>markov(r,lb,2),
  "mk3":      (r,lb)=>markov(r,lb,3),
  "mk4":      (r,lb)=>markov(r,lb,4),
  "mk5":      (r,lb)=>markov(r,lb,5),
  "mk6":      (r,lb)=>markov(r,lb,6),
  "mk7":      (r,lb)=>markov(r,lb,7),
  "mk_w":     (r,lb)=>markovW(r,lb),
  "sb":       (r,lb)=>streakB(r,lb),
  "anti_sb":  (r,lb)=>antiStreak(r,lb),
  "str_cont": (r,lb)=>streakCont(r,lb),
  "alt":      (r,lb)=>zzS(r,lb),
  "wv":       (r,lb)=>winV(r,lb),
  "wv_lg":    (r,lb)=>winV(r,lb,[10,15,20]),
  "bay":      (r,lb)=>bayR(r,lb),
  "bay_lap":  (r,lb)=>bayLap(r,lb),
  "ema":      (r,lb)=>emaS(r,lb,0.3),
  "ema_f":    (r,lb)=>emaS(r,lb,0.5),
  "ema_s":    (r,lb)=>emaS(r,lb,0.15),
  "ema_uf":   (r,lb)=>emaS(r,lb,0.7),
  "ema_us":   (r,lb)=>emaS(r,lb,0.08),
  "dema":     (r,lb)=>doubleEma(r,lb),
  "reg":      (r,lb)=>regT(r,lb),
  "rsi":      (r,lb)=>rsiS(r,lb),
  "bb":       (r,lb)=>bbS(r,lb),
  "macd":     (r,lb)=>macdS(r,lb),
  "mac":      (r,lb)=>macX(r,lb),
  "sto":      (r,lb)=>stoS(r,lb),
  "ichi":     (r,lb)=>ichS(r,lb),
  "mr":       (r,lb)=>mrS(r,lb),
  "kalman":   (r,lb)=>kalS(r,lb),
  "hurst":    (r,lb)=>hurstS(r,lb),
  "lz":       (r,lb)=>lzS(r,lb),
  "chi2":     (r,lb)=>chi2S(r,lb),
  "fib":      (r,lb)=>fibS(r,lb),
  "golden":   (r,lb)=>goldenW(r,lb),
  "adapt":    (r,lb)=>adaptT(r,lb),
  "rle":      (r,lb)=>rleS(r,lb),
  "per":      (r,lb)=>perD(r,lb),
  "acor":     (r,lb)=>acorS(r,lb),
  "mom":      (r,lb)=>momO(r,lb),
  "trend":    (r,lb)=>trendD(r,lb),
  "rec":      (r,lb)=>recencyB(r,lb),
  "rev":      (r,lb)=>reversalD(r,lb),
  "dual":     (r,lb)=>dualStreak(r,lb),
  "l3v":      (r,lb)=>lastNV(r,lb,3),
  "l5v":      (r,lb)=>lastNV(r,lb,5),
  "l10v":     (r,lb)=>lastNV(r,lb,10),
  "l20v":     (r,lb)=>lastNV(r,lb,20),
  "pc2":      (r,lb)=>patC(r,lb,2),
  "pc3":      (r,lb)=>patC(r,lb,3),
  "pc4":      (r,lb)=>patC(r,lb,4),
  "pc5":      (r,lb)=>patC(r,lb,5),
  "pc6":      (r,lb)=>patC(r,lb,6),
  "dpat":     (r,lb)=>deepP(r,lb),
  "tpm":      (r,lb)=>temporalPM(r,lb),
  "pair":     (r,lb)=>pairA(r,lb),
  "binom":    (r,lb)=>binomT(r,lb),
  "runs":     (r,lb)=>runsT(r,lb),
  "logit":    (r,lb)=>logitR(r,lb),
  "lstm":     (r,lb)=>lstmI(r,lb),
  "knn":      (r,lb)=>knnI(r,lb),
  "hmm":      (r,lb)=>hmm(r,lb),
  "ent_we":   (r,lb)=>entropyWE(r,lb),
  "zfib":     (r,lb)=>zigFib(r,lb),
};

const METHOD_NAMES = {
  "wf":"Tần Suất","wf_fast":"TS Nhanh","wf_slow":"TS Chậm",
  "mk1":"Markov-1","mk2":"Markov-2","mk3":"Markov-3","mk4":"Markov-4",
  "mk5":"Markov-5","mk6":"Markov-6","mk7":"Markov-7","mk_w":"Markov Trọng Số",
  "sb":"Streak Bias","anti_sb":"Anti-Streak","str_cont":"Streak Cont.",
  "alt":"Zigzag","wv":"Window Vote","wv_lg":"Window Lớn",
  "bay":"Bayes Gần","bay_lap":"Bayes-Laplace",
  "ema":"EMA","ema_f":"EMA Nhanh","ema_s":"EMA Chậm","ema_uf":"EMA Siêu Nhanh","ema_us":"EMA Siêu Chậm",
  "dema":"Double EMA","reg":"Hồi Quy","rsi":"RSI","bb":"Bollinger","macd":"MACD",
  "mac":"MA Cross","sto":"Stochastic","ichi":"Ichimoku","mr":"Mean Reversion",
  "kalman":"Kalman Filter","hurst":"Hurst","lz":"Lempel-Ziv","chi2":"Chi-Square",
  "fib":"Fibonacci","golden":"Tỷ Lệ Vàng","adapt":"Ngưỡng Thích Nghi",
  "rle":"Run-Length","per":"Chu Kỳ","acor":"Tự Tương Quan","mom":"Momentum",
  "trend":"Xu Hướng","rec":"Recency","rev":"Đảo Chiều","dual":"Dual Streak",
  "l3v":"Vote-3","l5v":"Vote-5","l10v":"Vote-10","l20v":"Vote-20",
  "pc2":"Cycle-2","pc3":"Cycle-3","pc4":"Cycle-4","pc5":"Cycle-5","pc6":"Cycle-6",
  "dpat":"Deep Pattern","tpm":"Khai Thác Mẫu","pair":"Cặp Đôi",
  "binom":"Binomial Test","runs":"Runs Test","logit":"Logistic Reg",
  "lstm":"LSTM","knn":"KNN","hmm":"Hidden Markov","ent_we":"Entropy Ensemble",
  "zfib":"Zigzag-Fibonacci",
};

// ─── ENSEMBLE WITH BACKTEST WEIGHTS ──────────────────────────
function ensemblePredict(results, lb) {
  const names = Object.keys(METHODS);
  const rawScores = {};
  names.forEach(name => {
    try { rawScores[name] = METHODS[name](results, lb); }
    catch { rawScores[name] = half(lb); }
  });

  // Backtest accuracy for weights
  const btAcc = {};
  names.forEach(name => {
    try { btAcc[name] = backtest(METHODS[name], results, lb); }
    catch { btAcc[name] = 0.5; }
  });

  // Dynamic weighting: higher accuracy → higher weight
  const minAcc = Math.min(...Object.values(btAcc));
  const adj = {};
  names.forEach(n => adj[n] = Math.max(btAcc[n] - minAcc, 0.005) ** 1.5);
  const totalAdj = Object.values(adj).reduce((a,b)=>a+b,0) || 1;
  const w = {};names.forEach(n => w[n] = adj[n] / totalAdj);

  const final = {};lb.forEach(l => final[l] = 0);
  names.forEach(name => {
    const s = rawScores[name];
    lb.forEach(l => final[l] += (s[l] || 0.5) * w[name]);
  });

  const normed = norm(final, lb);
  const best = lb.reduce((a,b) => normed[a] >= normed[b] ? a : b);
  const other = lb.find(l => l !== best);
  const margin = normed[best] - normed[other];

  // Vote count
  const votes = {};lb.forEach(l => votes[l] = 0);
  names.forEach(name => {
    const s = rawScores[name];
    const top = lb.reduce((a,b) => (s[a]||0) >= (s[b]||0) ? a : b);
    votes[top] = (votes[top] || 0) + 1;
  });
  const voteBest = votes[best] || 0;
  const voteRatio = voteBest / names.length;

  // Top method
  const topM = names.reduce((a,b) => btAcc[a] > btAcc[b] ? a : b);
  const topAcc = Math.round(btAcc[topM] * 100);
  const avgAcc = Object.values(btAcc).reduce((a,b)=>a+b,0) / names.length;

  const conf = Math.min(Math.round(
    normed[best] * 0.30 + voteRatio * 0.25 + avgAcc * 0.28 + margin * 0.17
  ) * 100, 94);

  return { best, conf, votes: voteBest, total: names.length, topM, topAcc, btAcc };
}
