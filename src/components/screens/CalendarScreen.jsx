import { useState, useEffect, useMemo } from 'react';
import { DOW } from '../../lib/constants';
import { monthTxns } from '../../lib/derive';
import { MON, dim, dstr, money, pad, parseD, shortM, ymOf } from '../../lib/format';
import { I } from '../Icon';
import { TxRow } from '../ui';

export function CalendarScreen({st,ym,openTx}){
  const today=dstr(new Date());
  const p=ym.split('-').map(Number);
  const dateOf=d=>`${p[0]}-${pad(p[1])}-${pad(d)}`;
  const [sel,setSel]=useState(()=>ymOf(new Date())===ym?today:dateOf(1));
  useEffect(()=>{setSel(ymOf(new Date())===ym?dstr(new Date()):ym+'-01')},[ym]);

  const byDay=useMemo(()=>{
    const m={};
    monthTxns(st,ym).forEach(t=>{
      (m[t.date]=m[t.date]||{out:0,in:0,list:[]});
      m[t.date].list.push(t);
      if(t.type==='expense')m[t.date].out+=t.amount;
      if(t.type==='income')m[t.date].in+=t.amount;
    });
    return m;
  },[st,ym]);

  const first=new Date(p[0],p[1]-1,1);
  const lead=(first.getDay()+6)%7;
  const n=dim(ym);
  const cells=[];
  for(let i=0;i<lead;i++)cells.push(null);
  for(let d=1;d<=n;d++)cells.push(d);
  while(cells.length%7)cells.push(null);

  const day=byDay[sel]||{out:0,in:0,list:[]};
  const dt=parseD(sel);

  return (<div>
    <div className="card">
      <div className="cal">
        {DOW.map(d=><div className="dow" key={d}>{d}</div>)}
        {cells.map((d,i)=>{
          if(d===null)return <div className="cel mut" key={i}/>;
          const k=dateOf(d), v=byDay[k];
          return (
            <button key={i} className={'cel'+(k===today?' today':'')+(k===sel?' sel':'')}
              aria-pressed={k===sel} onClick={()=>setSel(k)}>
              <span className="d">{d}</span>
              {v&&v.out>0&&<span className="v out">−{shortM(v.out)}</span>}
              {v&&v.in>0&&<span className="v in">+{shortM(v.in)}</span>}
            </button>
          );
        })}
      </div>
    </div>

    <div className="sec-h">
      <h2>{DOW[(dt.getDay()+6)%7]}, {dt.getDate()} {MON[dt.getMonth()]}</h2>
      <span className="sub">
        {day.out>0&&<span style={{color:'var(--out)',fontWeight:600}}>−{money(day.out)}</span>}
        {day.out>0&&day.in>0&&<span> · </span>}
        {day.in>0&&<span style={{color:'var(--in)',fontWeight:600}}>+{money(day.in)}</span>}
        {day.out===0&&day.in===0&&<span>No activity</span>}
      </span>
    </div>

    <div className="card">
      {day.list.length===0
        ? <div className="empty"><b>Nothing on this day</b>Pick another date, or add a transaction below.</div>
        : day.list.map(t=><TxRow key={t.id} st={st} t={t} onClick={()=>openTx(t)}/>)}
    </div>

    <button className="btn gho blk" style={{marginTop:12}} onClick={()=>openTx({date:sel})}>
      <I n="plus" s={16}/> Add on {dt.getDate()} {MON[dt.getMonth()]}</button>
  </div>);
}
