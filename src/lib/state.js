import { TAG_COLORS } from './constants';
import { dstr, pad, parseD, shiftYm, uid, ymOf } from './format';

export function migrate(s){
  if(!s.closes) s.closes={};
  if(!s.hiddenJars) s.hiddenJars=[];
  if(!s.loans) s.loans=[];
  (s.txns||[]).forEach(t=>{
    if(!Array.isArray(t.tagIds)) t.tagIds = t.tagId ? [t.tagId] : [];
    delete t.tagId;
  });
  return s;
}
export function emptyState(){
  return {v:1,accounts:[],jars:[],openings:{},tags:[],txns:[],template:[],plans:{},installments:[],loans:[],closes:{},hiddenJars:[]};
}
export function seed(){
  const now=new Date(), ym=ymOf(now), pm=shiftYm(ym,-1);
  const day=(k,d)=>{const p=k.split('-');return `${p[0]}-${p[1]}-${pad(d)}`};
  const today=now.getDate();

  const accounts=[
    {id:'a1',name:'Vietcombank',kind:'bank',color:'#0F7A57',icon:'bank'},
    {id:'a2',name:'Techcombank',kind:'bank',color:'#C33F4C',icon:'card'},
    {id:'a3',name:'Cash & Momo',kind:'cash',color:'#6B54C6',icon:'wallet'},
  ];
  const jars=[
    {id:'j1',accountId:'a1',name:'Living'},
    {id:'j2',accountId:'a1',name:'Bills & utilities'},
    {id:'j3',accountId:'a1',name:'Installments'},
    {id:'j4',accountId:'a2',name:'Long-term savings'},
    {id:'j5',accountId:'a2',name:'Emergency fund'},
    {id:'j6',accountId:'a3',name:'Food'},
    {id:'j7',accountId:'a3',name:'Misc'},
  ];
  const tags=['Food','Transport','Bills','Shopping','Health','Fun','Family','Other']
    .map((n,i)=>({id:'t'+(i+1),name:n,color:TAG_COLORS[i%TAG_COLORS.length]}));

  const template=[
    {id:'p1',group:'basic',name:'Rent',amount:5000000,jarId:'j2'},
    {id:'p2',group:'basic',name:'Electricity & water',amount:1200000,jarId:'j2'},
    {id:'p3',group:'basic',name:'Internet & phone',amount:400000,jarId:'j2'},
    {id:'p4',group:'basic',name:'Monthly food',amount:4500000,jarId:'j6'},
    {id:'p5',group:'basic',name:'Fuel & transport',amount:800000,jarId:'j1'},
    {id:'p6',group:'basic',name:'Miscellaneous',amount:1500000,jarId:'j7'},
    {id:'p7',group:'debt',name:'iPhone instalment',amount:2670000,jarId:'j3'},
    {id:'p8',group:'debt',name:'Motorbike instalment',amount:2500000,jarId:'j3'},
    {id:'p9',group:'debt',name:'Washer instalment',amount:2000000,jarId:'j3'},
    {id:'p10',group:'save',name:'Long-term savings',amount:5000000,jarId:'j4'},
    {id:'p11',group:'save',name:'Emergency fund',amount:2000000,jarId:'j5'},
  ];
  const openings={};
  openings[ym]={}; openings[pm]={};
  template.forEach(t=>{
    openings[ym][t.jarId]=(openings[ym][t.jarId]||0)+t.amount;
    openings[pm][t.jarId]=(openings[pm][t.jarId]||0)+t.amount;
  });

  const plans={};
  plans[ym]={items:template.map(t=>({...t,checked:true,applied:true})),appliedAt:day(ym,1)};

  const T=(d,type,amount,jarId,tagId,note,extra)=>({id:uid(),date:d,type,amount,jarId:jarId||null,tagIds:tagId?[tagId]:[],note:note||'',...(extra||{})});
  let txns=[];
  const cur=[
    [1,'income',24000000,'j1','','Monthly salary'],
    [1,'expense',5000000,'j2','t3','Rent'],
    [1,'expense',2670000,'j3','t8','iPhone installment #6'],
    [2,'expense',185000,'j6','t1','Groceries'],
    [2,'expense',60000,'j1','t2','Grab to work'],
    [3,'expense',420000,'j2','t3','Electricity bill'],
    [3,'expense',95000,'j6','t1','Office lunch'],
    [4,'expense',1250000,'j7','t4','New shoes'],
    [4,'expense',72000,'j6','t1','Coffee & pastry'],
    [5,'expense',2500000,'j3','t8','Motorbike installment #10'],
    [5,'expense',340000,'j1','t2','Fuel'],
    [5,'income',1500000,'j7','','Project bonus'],
    [6,'expense',680000,'j6','t1','Family dinner'],
    [6,'expense',150000,'j7','t6','Movie tickets'],
    [7,'expense',260000,'j6','t1','Groceries'],
    [7,'expense',890000,'j1','t5','Health check-up'],
  ];
  cur.forEach(r=>{ if(r[0]<=Math.max(today,1)) txns.push(T(day(ym,r[0]),r[1],r[2],r[3],r[4],r[5])) });
  txns.push({...T(day(ym,Math.min(3,Math.max(today,1))),'transfer',3000000,null,null,'Cash withdrawal'),fromJarId:'j1',toJarId:'j6'});

  const prev=[
    [1,'income',24000000,'j1','','Monthly salary'],
    [1,'expense',5000000,'j2','t3','Rent'],
    [2,'expense',2670000,'j3','t8','iPhone installment #5'],
    [3,'expense',510000,'j2','t3','Utilities'],
    [5,'expense',2500000,'j3','t8','Motorbike installment #9'],
    [7,'expense',1800000,'j7','t4','Household goods'],
    [9,'expense',640000,'j6','t1','Weekend dining'],
    [12,'expense',420000,'j1','t2','Fuel'],
    [14,'expense',2000000,'j3','t8','Washer installment #2'],
    [16,'expense',1150000,'j6','t1','Groceries'],
    [19,'expense',300000,'j7','t6','Concert'],
    [22,'expense',760000,'j1','t5','Medicine & clinic'],
    [25,'expense',1400000,'j7','t7','Birthday gift'],
    [28,'expense',980000,'j6','t1','Groceries'],
  ];
  prev.forEach(r=>txns.push(T(day(pm,r[0]),r[1],r[2],r[3],r[4],r[5])));

  const mkPeriods=(start,n,per,paidCount)=>{
    const d0=parseD(start),out=[];
    for(let i=0;i<n;i++){
      const d=new Date(d0.getFullYear(),d0.getMonth()+i,d0.getDate());
      out.push({i:i+1,due:dstr(d),amount:per,paid:i<paidCount,paidAt:i<paidCount?dstr(d):null});
    }
    return out;
  };
  const s1=dstr(new Date(now.getFullYear(),now.getMonth()-5,15));
  const s2=dstr(new Date(now.getFullYear(),now.getMonth()-9,10));
  const s3=dstr(new Date(now.getFullYear(),now.getMonth()-2,1));
  const installments=[
    {id:'i1',name:'iPhone 16 Pro',note:'VCB credit card, 0%',total:32040000,periods:12,per:2670000,start:s1,jarId:'j3',payments:mkPeriods(s1,12,2670000,6)},
    {id:'i2',name:'Honda SH Mode',note:'Bank loan, 24 months',total:60000000,periods:24,per:2500000,start:s2,jarId:'j3',payments:mkPeriods(s2,24,2500000,10)},
    {id:'i3',name:'LG washing machine',note:'Store financing, 6 periods',total:12000000,periods:6,per:2000000,start:s3,jarId:'j3',payments:mkPeriods(s3,6,2000000,3)},
  ];

  const lendDate=day(pm,20), lendTx=uid();
  txns.push({id:lendTx,date:lendDate,type:'expense',amount:6000000,jarId:'j7',
    tagIds:['t7'],note:'Lent · Minh'});
  const loans=[{id:'L1',name:'Minh',note:'For his laptop',total:6000000,date:lendDate,
    jarId:'j7',tagIds:['t7'],txnId:lendTx,periods:3,
    payments:mkPeriods(lendDate,3,2000000,0).map(p=>({...p,jarId:null,txnId:null}))}];

  return {v:1,accounts,jars,openings,tags,txns,template,plans,installments,loans,closes:{},hiddenJars:[]};
}
