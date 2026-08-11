import React, { useState, useMemo } from 'react';
import { CUSTOM_C, GROUPS } from '../../lib/constants';
import { computeOpenings, monthSummary } from '../../lib/derive';
import { dstr, mLabelLong, money, pad, shiftYm, uid } from '../../lib/format';
import { I } from '../Icon';
import { Field, JarSelect, MoneyInput, Sheet } from '../ui';

export function AllocLine({st,it,custom,upd,dropItem,onNewCat}){
  const inst=it.installmentId?st.installments.find(x=>x.id===it.installmentId):null;
  const nextP=inst?inst.payments.find(p=>!p.paid):null;
  return (
    <div className="row" style={{flexDirection:'column',alignItems:'stretch',gap:8}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button className={'chk'+(it.checked?' on':'')}
          onClick={()=>upd(it.id,{checked:!it.checked})}>
          {it.checked&&<I n="check" s={13}/>}</button>
        {custom
          ? <input className="inp" style={{padding:'7px 9px',fontSize:14}} placeholder="Label, e.g. Tet fund"
              value={it.name} onChange={e=>upd(it.id,{name:e.target.value})}/>
          : <div className="row-b">
              <div className="row-t">{it.name}</div>
              {inst && <div className="row-s">{inst.name}
                {nextP?' · period '+nextP.i+' of '+inst.periods:' · fully paid'}</div>}
            </div>}
        <input className="inp mono" inputMode="numeric"
          style={{width:112,flex:'none',textAlign:'right',padding:'7px 9px',fontSize:14}}
          value={it.amount?Number(it.amount).toLocaleString('vi-VN'):''}
          onChange={e=>{const v=e.target.value.replace(/[^\d]/g,'');upd(it.id,{amount:v?Number(v):0})}}/>
        {custom && <button className="trail" aria-label="Remove line"
          onClick={()=>dropItem(it.id)}><I n="x" s={14}/></button>}
      </div>
      {it.checked && <div style={{display:'flex',gap:6}}>
        <div className="grow" style={{minWidth:0}}>
          <JarSelect st={st} value={it.jarId} onChange={v=>upd(it.id,{jarId:v})} allowEmpty/>
        </div>
        <button className="btn gho sm" aria-label="New category" title="New category"
          onClick={onNewCat} style={{padding:'0 11px',flex:'none'}}><I n="plus" s={16}/></button>
      </div>}
      {it.checked && !it.jarId &&
        <div style={{color:'var(--warn)',fontSize:12,fontWeight:600}}>Pick a category for this line</div>}
    </div>
  );
}

export function CloseMonth({st,set,ym,setYm,toast,onDone}){
  const next=shiftYm(ym,1);
  const s=useMemo(()=>monthSummary(st,ym),[st,ym]);
  const [step,setStep]=useState(1);
  const [carry,setCarry]=useState(()=>{const m={};st.jars.forEach(j=>{m[j.id]=true});return m});
  const [income,setIncome]=useState(0);
  const [items,setItems]=useState(()=>st.template.map(t=>({...t,checked:true})));
  const [newJarFor,setNewJarFor]=useState(null);
  const [njName,setNjName]=useState('');
  const [njAcc,setNjAcc]=useState(()=>st.accounts[0]?st.accounts[0].id:null);
  const [restJar,setRestJar]=useState(()=>{
    const sv=st.jars.find(j=>/sav|invest/i.test(j.name));
    return sv?sv.id:(st.jars[0]?st.jars[0].id:null);
  });

  const carryTotal=st.jars.reduce((a,j)=>a+(carry[j.id]?s.js[j.id].left:0),0);
  const available=income;
  const newTotal=carryTotal+income;
  const allocated=items.filter(i=>i.checked).reduce((a,b)=>a+b.amount,0);
  const remainder=available-allocated;
  const already=!!(st.plans[next]&&st.plans[next].appliedAt);
  const upd=(id,patch)=>setItems(list=>list.map(i=>i.id===id?{...i,...patch}:i));
  const unassigned=items.filter(i=>i.checked&&!i.jarId).length;
  const addCustom=()=>setItems(l=>[...l,{id:uid(),name:'',amount:Math.max(0,remainder),
    jarId:null,checked:true,custom:true}]);
  const dropItem=id=>setItems(l=>l.filter(i=>i.id!==id));
  const base=Math.max(income,allocated,1);
  const segs=[
    ...GROUPS.map(g=>({k:g.k,c:g.c,t:g.n,
      v:items.filter(i=>i.checked&&!i.custom&&i.group===g.k).reduce((a,b)=>a+b.amount,0)})),
    {k:'custom',c:CUSTOM_C,t:'Your own splits',
      v:items.filter(i=>i.checked&&i.custom).reduce((a,b)=>a+b.amount,0)}
  ].filter(x=>x.v>0);
  const blocked = unassigned>0
    ? unassigned+' line'+(unassigned>1?'s':'')+' need a category'
    : (remainder!==0 && !restJar) ? 'Choose where the remainder goes' : null;

  const commit=()=>{
    const o=computeOpenings({jars:st.jars,carry,stats:s.js,items,restJar,remainder});
    set(d=>{
      d.openings[next]=o;
      d.plans[next]={items:items.filter(i=>i.checked),appliedAt:dstr(new Date()),
        income,carried:carryTotal,allocated,remainder};
      d.closes=d.closes||{};
      d.closes[ym]={at:dstr(new Date()),carried:carryTotal,income,allocated,remainder};
    });
    setYm(next); onDone();
    toast(mLabelLong(next)+' is ready');
  };

  const custom=items.filter(i=>i.custom);

  if(st.jars.length===0) return (
    <div className="empty" style={{paddingTop:60}}>
      <b>No categories yet</b>Add an account and some categories before closing a month.</div>
  );

  return (<div style={{paddingTop:4}}>
    <div className="steps">
      {[1,2,3].map(n=><i key={n} className={step>=n?'on':''}/>)}
    </div>

    {step===1 && <>
      <div className="step-h">Ending balances</div>
      <p className="step-s">Pick what carries into {mLabelLong(next)}. An overspent category carries a
        negative amount, so the shortfall follows you instead of disappearing.</p>

      {already && <div className="card pad warn-card" style={{marginBottom:12}}>
        <div className="row-t" style={{color:'var(--warn)'}}>{mLabelLong(next)} already has a plan</div>
        <div className="row-s">Finishing this close will replace it.</div>
      </div>}

      {st.accounts.map(a=>(
        <React.Fragment key={a.id}>
          <div className="sec-h"><h2>{a.name}</h2></div>
          <div className="card">
            {st.jars.filter(j=>j.accountId===a.id).map(j=>{
              const d=s.js[j.id];
              return (
                <button className="row" key={j.id}
                  onClick={()=>setCarry(c=>({...c,[j.id]:!c[j.id]}))}>
                  <span className={'chk'+(carry[j.id]?' on':'')}>
                    {carry[j.id]&&<I n="check" s={13}/>}</span>
                  <div className="row-b">
                    <div className="row-t">{j.name}</div>
                    <div className="row-s">{carry[j.id]?'Carries over':'Resets to 0'}</div>
                  </div>
                  <div className={'amt sub'+(d.left<0?' neg':'')}
                    style={carry[j.id]?null:{opacity:.35}}>{money(d.left)}</div>
                </button>
              );
            })}
          </div>
        </React.Fragment>
      ))}

      <div className="card pad" style={{marginTop:12}}>
        <div className="tot"><span className="k">Carrying into {mLabelLong(next)}</span>
          <span className="v" style={{color:carryTotal<0?'var(--out)':'var(--ink)'}}>{money(carryTotal)} ₫</span></div>
      </div>
    </>}

    {step===2 && <>
      <div className="step-h">Income for {mLabelLong(next)}</div>
      <p className="step-s">Salary and anything else arriving at the start of the month.</p>
      <div className="card pad">
        <Field label="Income">
          <MoneyInput boxed autoFocus value={income} onChange={setIncome}/>
        </Field>
        <div className="hr"/>
        <div className="tot"><span className="k">Already carried into categories</span>
          <span className="v" style={{color:carryTotal<0?'var(--out)':'var(--ink)'}}>{money(carryTotal)}</span></div>
        <div className="tot"><span className="k" style={{color:'var(--ink)'}}>To allocate now</span>
          <span className="v" style={{color:'var(--indigo)'}}>{money(income)} ₫</span></div>
        <div className="hr"/>
        <div className="tot"><span className="k">{mLabelLong(next)} will start with</span>
          <span className="v">{money(newTotal)} ₫</span></div>
      </div>
    </>}

    {step===3 && <>
      <div className="step-h">Allocate {mLabelLong(next)}</div>
      <p className="step-s">Your plan template is only a starting point — change any amount, switch any
        category, or add your own lines to split what is left however you want.</p>

      {GROUPS.map(g=>{
        const list=items.filter(i=>!i.custom&&i.group===g.k);
        if(list.length===0)return null;
        return (
          <React.Fragment key={g.k}>
            <div className="sec-h"><span className="gdot" style={{background:g.c}}/><h2>{g.n}</h2>
              <span className="sub">{money(list.filter(i=>i.checked).reduce((a,b)=>a+b.amount,0))} ₫</span></div>
            <div className="card">{list.map(it=>
              <AllocLine key={it.id} st={st} it={it} upd={upd} dropItem={dropItem}
                onNewCat={()=>{setNjName('');setNewJarFor(it.id)}}/>)}</div>
          </React.Fragment>
        );
      })}

      <div className="sec-h"><span className="gdot" style={{background:CUSTOM_C}}/><h2>Your own splits</h2>
        <span className="sub">{money(custom.filter(i=>i.checked).reduce((a,b)=>a+b.amount,0))} ₫</span></div>
      <div className="card">
        {custom.length===0
          ? <div className="empty" style={{padding:'20px 16px'}}>
              <b>Nothing extra yet</b>Add a line to send part of the remaining money anywhere you like.</div>
          : custom.map(it=>
              <AllocLine key={it.id} st={st} it={it} custom upd={upd} dropItem={dropItem}
                onNewCat={()=>{setNjName('');setNewJarFor(it.id)}}/>)}
        <div className="row">
          <button className="lnk" onClick={addCustom}>
            {remainder>0?'+ Allocate the remaining '+money(remainder)+' ₫':'+ Add a split'}</button>
        </div>
      </div>

      <div className="card pad" style={{marginTop:12}}>
        <div className="tot"><span className="k">Income to allocate</span><span className="v">{money(income)}</span></div>
        <div className="tot"><span className="k">Allocated</span><span className="v">−{money(allocated)}</span></div>
        <div className="hr"/>
        <div className="tot"><span className="k" style={{color:'var(--ink)'}}>Remaining</span>
          <span className="v" style={{color:remainder<0?'var(--out)':remainder>0?'var(--warn)':'var(--in)'}}>
            {money(remainder)} ₫</span></div>

        {remainder!==0 && <>
          <div className="hr"/>
          <Field label={remainder>0?'Park anything still left in':'Take the shortfall from'}>
            <JarSelect st={st} value={restJar} onChange={setRestJar} allowEmpty/>
          </Field>
          <p className="mut" style={{fontSize:12.5,margin:0}}>
            {remainder>0
              ? 'Keep this separate from planned savings — it tells you whether a good month was intentional or just quiet.'
              : 'You allocated more than your income, so the difference comes out of carried-over money.'}</p>
        </>}

        {remainder===0 && <p style={{color:'var(--in)',fontSize:12.5,fontWeight:600,margin:'11px 0 0'}}>
          Every đồng has a job.</p>}

        <div className="hr"/>
        <div className="tot"><span className="k">Carried over</span><span className="v">{money(carryTotal)}</span></div>
        <div className="tot"><span className="k">Income</span><span className="v">{money(income)}</span></div>
        <div className="hr"/>
        <div className="tot"><span className="k" style={{color:'var(--ink)'}}>{mLabelLong(next)} starts with</span>
          <span className="v" style={{color:'var(--indigo)'}}>{money(newTotal)} ₫</span></div>
      </div>
    </>}

    {newJarFor && <Sheet title="New category" onClose={()=>setNewJarFor(null)}
      footer={<button className="btn pri blk" disabled={!njName.trim()||!njAcc} onClick={()=>{
        const id=uid();
        set(d=>{d.jars.push({id,accountId:njAcc,name:njName.trim()})});
        upd(newJarFor,{jarId:id});
        setNewJarFor(null); setNjName('');
      }}>Create and assign</button>}>
      <Field label="Account">
        <select className="inp" value={njAcc||''} onChange={e=>setNjAcc(e.target.value)}>
          {st.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Category name"><input className="inp" autoFocus placeholder="e.g. Sinking fund"
        value={njName} onChange={e=>setNjName(e.target.value)}/></Field>
      <p className="mut" style={{fontSize:12.5,margin:0}}>
        It starts at zero and receives this item's allocation.</p>
    </Sheet>}

    <div className="fixed-cta">
      {step===3 && <>
        <div className="cta-sum" style={{marginBottom:7}}>
          <span>Remaining to allocate</span>
          <b style={{color:remainder<0?'var(--out)':remainder>0?'var(--warn)':'var(--in)'}}>
            {money(remainder)} ₫</b>
        </div>
        <div className="allocbar">
          {segs.map(sg=><i key={sg.k} title={sg.t+' · '+money(sg.v)+' ₫'}
            style={{width:(sg.v/base*100)+'%',background:sg.c}}/>)}
          {remainder<0 && <span className="over" style={{left:(income/base*100)+'%'}}
            title="Income ends here"/>}
        </div>
      </>}
      <div className="cta-row">
        {step>1 && <button className="btn gho" onClick={()=>setStep(step-1)}>Back</button>}
        {step<3
          ? <button className="btn pri grow" onClick={()=>setStep(step+1)}>Continue</button>
          : <button className="btn pri grow" disabled={blocked!==null} onClick={commit}>
              {blocked||('Close '+mLabelLong(ym))}</button>}
      </div>
    </div>
  </div>);
}
