import React, { useState, useMemo } from 'react';
import { jarShort, monthSummary, monthTxns, tagOf } from '../../lib/derive';
import { dim, mLabel, mLabelLong, money, pad, parseD, shiftYm, shortM, ymOf } from '../../lib/format';
import { I } from '../Icon';
import { Sheet } from '../ui';

export function ReportScreen({st,set,ym}){
  const [pick,setPick]=useState(false);
  const hidden=st.hiddenJars||[];
  const cur=monthSummary(st,ym), pm=shiftYm(ym,-1), prev=monthSummary(st,pm);
  const txns=monthTxns(st,ym);
  const n=dim(ym);
  const daily=Array.from({length:n},()=>0);
  txns.forEach(t=>{if(t.type==='expense')daily[parseD(t.date).getDate()-1]+=t.amount});
  const maxD=Math.max(...daily,1);
  const todayD=ymOf(new Date())===ym?new Date().getDate():-1;

  const byTag=useMemo(()=>{
    const m={};
    txns.filter(t=>t.type==='expense').forEach(t=>{
      const ids=(t.tagIds&&t.tagIds.length)?t.tagIds:['_'];
      const share=t.amount/ids.length;
      ids.forEach(k=>{m[k]=(m[k]||0)+share});
    });
    return Object.entries(m).map(([k,v])=>{
      const tg=tagOf(st,k);
      return {id:k,name:tg?tg.name:'Untagged',color:tg?tg.color:'#B9BFCE',v};
    }).sort((a,b)=>b.v-a.v);
  },[st,ym]);
  const tagTotal=byTag.reduce((a,b)=>a+b.v,0)||1;

  const byJar=st.jars.filter(j=>!hidden.includes(j.id))
    .map(j=>({j,...cur.js[j.id]})).filter(x=>x.open||x.out||x.in).sort((a,b)=>b.out-a.out);
  const top=txns.filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount).slice(0,5);
  const delta=(a,b)=>b===0?null:Math.round(((a-b)/b)*100);
  const dOut=delta(cur.out,prev.out), dIn=delta(cur.inc,prev.inc);
  const prevHas=prev.inc>0||prev.out>0;
  const dNet=cur.net-prev.net;

  // donut
  let acc=0; const R=52, C=2*Math.PI*R;
  const arcs=byTag.slice(0,8).map(t=>{
    const frac=t.v/tagTotal, seg={...t,dash:frac*C,off:-acc*C}; acc+=frac; return seg;
  });

  return (<div>
    <div className="card pad">
      <div className="eyebrow">Total income · {mLabelLong(ym)}</div>
      <div className="num" style={{fontSize:28,fontWeight:800,letterSpacing:'-.032em',
        margin:'1px 0 0',color:'var(--in)'}}>
        +{money(cur.inc)} <span style={{fontSize:14,color:'var(--muted)',fontWeight:600}}>₫</span></div>
      {dIn!=null&&<div className="dlt" style={{color:dIn>=0?'var(--in)':'var(--out)',marginTop:3}}>
        {dIn>=0?'▲':'▼'} {Math.abs(dIn)}% vs {mLabel(pm)}</div>}
      <div className="hr" style={{margin:'13px 0'}}/>
      <div className="figs split">
        <div>
          <span className="k">Net</span>
          <b style={{color:cur.net>=0?'var(--in)':'var(--out)'}}>
            {cur.net>=0?'+':'−'}{money(Math.abs(cur.net))}</b>
          {prevHas
            ? <span className="dlt" style={{color:dNet>=0?'var(--in)':'var(--out)'}}>
                {dNet>=0?'▲':'▼'} {money(Math.abs(dNet))} vs {mLabel(pm)}</span>
            : <span className="dlt" style={{color:'var(--muted)'}}>Income minus expense</span>}
        </div>
        <div>
          <span className="k">Total expense</span>
          <b className="o">−{money(cur.out)}</b>
          {dOut!=null&&<span className="dlt" style={{color:dOut>0?'var(--out)':'var(--in)'}}>
            {dOut>=0?'▲':'▼'} {Math.abs(dOut)}% vs {mLabel(pm)}</span>}
        </div>
      </div>
    </div>

    <div className="two">
      <div>
        <div className="sec-h"><h2>Daily spending</h2><span className="sub">Peak {shortM(maxD)} ₫</span></div>
        <div className="card pad">
          <div className="bars">
            {daily.map((v,i)=>(
              <i key={i} className={i+1===todayD?'tod':(v===maxD&&v>0?'hi':'')}
                 style={{height:Math.max(2,(v/maxD)*96)+'px'}} title={`Day ${i+1}: ${money(v)} ₫`}/>
            ))}
          </div>
          <div className="vessel-legend"><span>1</span><span>{Math.round(n/2)}</span><span>{n}</span></div>
        </div>

        <div className="sec-h"><h2>Largest expenses</h2></div>
        <div className="card">
          {top.length===0?<div className="empty"><b>No expenses yet</b>Nothing recorded this month.</div>
          :top.map((t,i)=>(
            <div className="row" key={t.id}>
              <div className="dot n" style={{fontFamily:'var(--f-disp)'}}>{i+1}</div>
              <div className="row-b"><div className="row-t">{t.note||'Expense'}</div>
                <div className="row-s">{parseD(t.date).getDate()}/{Number(ym.split('-')[1])} · {jarShort(st,t.jarId)}</div></div>
              <div className="amt out" style={{fontSize:14.5}}>−{money(t.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="sec-h"><h2>Spending by tag</h2></div>
        <div className="card pad">
          {byTag.length===0?<div className="empty" style={{padding:'18px 0'}}><b>No data yet</b>Tag your expenses to see the breakdown.</div>:<>
          <div style={{display:'flex',justifyContent:'center',padding:'4px 0 14px'}}>
            <svg width="150" height="150" viewBox="0 0 140 140">
              <g transform="rotate(-90 70 70)">
                {arcs.map(a=>(
                  <circle key={a.id} cx="70" cy="70" r={R} fill="none" stroke={a.color} strokeWidth="18"
                    strokeDasharray={`${a.dash} ${C}`} strokeDashoffset={a.off}/>
                ))}
              </g>
              <text x="70" y="66" textAnchor="middle" fontSize="17" fontWeight="800" fill="#14161F"
                style={{fontFamily:'var(--f-disp)'}}>{shortM(tagTotal)}</text>
              <text x="70" y="82" textAnchor="middle" fontSize="9.5" fill="#868DA1"
                style={{fontFamily:'var(--f-body)'}}>Total ₫</text>
            </svg>
          </div>
          {byTag.map(t=>(
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 0'}}>
              <span style={{width:9,height:9,borderRadius:3,background:t.color,flex:'none'}}/>
              <span className="grow" style={{fontSize:13.5,fontWeight:500}}>{t.name}</span>
              <span className="mut mono" style={{fontSize:12}}>{Math.round(t.v/tagTotal*100)}%</span>
              <span className="amt" style={{fontSize:13.5,minWidth:76,textAlign:'right'}}>{money(t.v)}</span>
            </div>
          ))}</>}
        </div>

        <div className="sec-h"><h2>By category</h2>
          <button className="act" onClick={()=>setPick(true)}>Customize</button></div>
        <div className="card">
          <table className="t">
            <thead><tr><th>Category</th><th className="r">Spent</th><th className="r">Left</th></tr></thead>
            <tbody>{byJar.map(x=>{
              const pv=prev.js[x.j.id]?prev.js[x.j.id].out:0;
              const dl=pv>0?Math.round((x.out-pv)/pv*100):null;
              return (
              <tr key={x.j.id}>
                <td><div style={{fontWeight:600}}>{x.j.name}</div>
                  <div className="row-s">{(st.accounts.find(a=>a.id===x.j.accountId)||{}).name}</div></td>
                <td className="r mono">
                  <div style={{color:'var(--out)',fontWeight:600}}>{x.out?'−'+money(x.out):'—'}</div>
                  {x.out>0&&dl!==null&&dl!==0&&<div style={{fontSize:11,fontWeight:600,
                    color:dl>0?'var(--out)':'var(--in)'}}>{dl>0?'▲':'▼'} {Math.abs(dl)}%</div>}
                  {x.out>0&&pv===0&&<div style={{fontSize:11,color:'var(--muted)'}}>new</div>}
                  {x.out>0&&dl===0&&<div style={{fontSize:11,color:'var(--muted)'}}>same</div>}
                </td>
                <td className="r mono" style={{fontWeight:700,color:x.left<0?'var(--out)':'inherit'}}>{money(x.left)}</td>
              </tr>
              );
            })}</tbody>
          </table>
          {byJar.length===0&&<div className="empty"><b>No active categories</b>
            {hidden.length>0?'Every category is hidden — use Customize to bring some back.':'Allocate money in the Categories tab.'}</div>}
        </div>

        {pick && <Sheet title="Show in report" onClose={()=>setPick(false)}>
          <p className="mut" style={{fontSize:12.5,margin:'0 0 12px'}}>
            Hidden categories still count toward totals — they just stay out of this table.</p>
          {st.accounts.map(a=>(
            <React.Fragment key={a.id}>
              <div className="sec-h"><h2>{a.name}</h2></div>
              <div className="card">
                {st.jars.filter(j=>j.accountId===a.id).map(j=>{
                  const on=!hidden.includes(j.id);
                  return (
                    <button className="row" key={j.id} onClick={()=>set(d=>{
                      const h=d.hiddenJars||[];
                      d.hiddenJars=h.includes(j.id)?h.filter(x=>x!==j.id):[...h,j.id];
                    })}>
                      <span className={'chk'+(on?' on':'')}>{on&&<I n="check" s={13}/>}</span>
                      <div className="row-b"><div className="row-t">{j.name}</div></div>
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </Sheet>}
      </div>
    </div>
  </div>);
}
