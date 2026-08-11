import { dstr, parseD, ymOfDate } from './format';

export function monthTxns(st,ym){return st.txns.filter(t=>ymOfDate(t.date)===ym)}

export function jarStats(st,ym){
  const m={};
  st.jars.forEach(j=>{m[j.id]={open:(st.openings[ym]||{})[j.id]||0,in:0,out:0}});
  monthTxns(st,ym).forEach(t=>{
    if(t.type==='expense'&&m[t.jarId]) m[t.jarId].out+=t.amount;
    else if(t.type==='income'&&m[t.jarId]) m[t.jarId].in+=t.amount;
    else if(t.type==='transfer'){
      if(m[t.fromJarId]) m[t.fromJarId].out+=t.amount;
      if(m[t.toJarId]) m[t.toJarId].in+=t.amount;
    }
  });
  Object.keys(m).forEach(k=>{m[k].left=m[k].open+m[k].in-m[k].out});
  return m;
}
export function monthSummary(st,ym){
  let inc=0,out=0;
  monthTxns(st,ym).forEach(t=>{
    if(t.type==='income')inc+=t.amount; else if(t.type==='expense')out+=t.amount;
  });
  const js=jarStats(st,ym);
  let open=0,left=0;
  st.jars.forEach(j=>{open+=js[j.id].open;left+=js[j.id].left});
  return {inc,out,net:inc-out,open,left,js};
}
export const jarName=(st,id)=>{const j=st.jars.find(x=>x.id===id);if(!j)return '—';
  const a=st.accounts.find(x=>x.id===j.accountId);return (a?a.name+' · ':'')+j.name};
export const jarShort=(st,id)=>{const j=st.jars.find(x=>x.id===id);return j?j.name:'—'};
export const tagOf=(st,id)=>st.tags.find(t=>t.id===id);

/* Số dư mở đầu tháng mới, trích nguyên văn từ CloseMonth.commit().
   Đây là nơi bug lệch 38.5tr từng sống (số dư kết chuyển bị đếm 2 lần trong
   pool phân bổ). Tách ra thành hàm pure để test được bất biến:

     Σ computeOpenings(...) == carryTotal + income

   Bất biến CHỈ đúng khi mọi dòng đang tick đều đã có jarId — đó chính là lý do
   CloseMonth chặn cứng `unassigned > 0` trước khi cho chốt. Xem derive.test.js. */
export function computeOpenings({jars,carry,stats,items,restJar,remainder}){
  const o={};
  jars.forEach(j=>{o[j.id]=carry[j.id]?stats[j.id].left:0});
  items.filter(i=>i.checked&&i.jarId).forEach(i=>{o[i.jarId]=(o[i.jarId]||0)+i.amount});
  if(restJar&&remainder!==0)o[restJar]=(o[restJar]||0)+remainder;
  return o;
}

export function loanStat(g){
  const paid=g.payments.filter(p=>p.paid);
  const got=paid.reduce((a,b)=>a+b.amount,0);
  return {paidN:paid.length,got,left:g.total-got,leftN:g.periods-paid.length,
    next:g.payments.find(p=>!p.paid)};
}
export function buildLoanPeriods(start,n,total,old){
  const per=Math.round(total/n), d0=parseD(start), out=[];
  for(let i=0;i<n;i++){
    const d=new Date(d0.getFullYear(),d0.getMonth()+i+1,d0.getDate());
    const o=old&&old.find(p=>p.i===i+1);
    out.push({i:i+1,due:dstr(d),amount:o&&o.paid?o.amount:per,
      paid:o?o.paid:false,paidAt:o?o.paidAt:null,jarId:o?o.jarId:null,txnId:o?o.txnId:null});
  }
  return out;
}
