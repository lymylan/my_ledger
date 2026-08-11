import React, { useState } from 'react';
import { ask } from '../../lib/ask';
import { GROUPS } from '../../lib/constants';
import { jarName } from '../../lib/derive';
import { money, pad, shortM, uid } from '../../lib/format';
import { I } from '../Icon';
import { Field, JarSelect, MoneyInput, Sheet } from '../ui';

export function PlanSetup({st,set,toast}){
  const [form,setForm]=useState(null);
  const total=st.template.reduce((a,b)=>a+b.amount,0);
  const missing=st.template.filter(t=>!t.jarId).length;
  const instOf=id=>st.installments.find(x=>x.id===id);

  const save=()=>{
    set(d=>{
      const rec={id:form.id||uid(),group:form.group,name:form.name.trim(),amount:form.amount,
        jarId:form.jarId,installmentId:form.group==='debt'?form.installmentId:null};
      if(form.id){const i=d.template.findIndex(x=>x.id===form.id);d.template[i]=rec}
      else d.template.push(rec);
    });
    setForm(null); toast('Plan item saved');
  };

  return (<div>
    <div className="card pad">
      <div className="eyebrow">Monthly plan template</div>
      <div className="num" style={{fontSize:28,fontWeight:800,letterSpacing:'-.032em',margin:'2px 0 2px'}}>
        {money(total)} <span style={{fontSize:14,color:'var(--muted)',fontWeight:600}}>₫</span></div>
      <div className="row-s">Used as the starting point every time you close a month</div>
      <div className="hr"/>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {GROUPS.map(g=>{
          const v=st.template.filter(i=>i.group===g.k).reduce((a,b)=>a+b.amount,0);
          const pct=total>0?Math.round(v/total*100):0;
          return <span className="pill wait" key={g.k}>{g.n}: {shortM(v)}
            <b style={{color:'var(--ink2)',marginLeft:2}}>{pct}%</b></span>;
        })}
      </div>
      {missing>0 && <p style={{color:'var(--warn)',fontSize:12.5,margin:'11px 0 0'}}>
        {missing} item{missing>1?'s have':' has'} no category. You will be asked to pick one when closing a month.</p>}
    </div>

    {GROUPS.map(g=>{
      const items=st.template.filter(i=>i.group===g.k);
      if(items.length===0)return null;
      return (
        <React.Fragment key={g.k}>
          <div className="sec-h"><h2>{g.n}</h2>
            <span className="sub">{money(items.reduce((a,b)=>a+b.amount,0))} ₫</span></div>
          <div className="card">
            {items.map(it=>{
              const inst=it.installmentId?instOf(it.installmentId):null;
              return (
                <button className="row" key={it.id} onClick={()=>setForm({...it})}>
                  <div className="row-b">
                    <div className="row-t">{it.name}</div>
                    <div className="row-s" style={!it.jarId?{color:'var(--warn)'}:null}>
                      {it.jarId?jarName(st,it.jarId):'No category yet'}
                      {inst?' · linked to '+inst.name:''}
                    </div>
                  </div>
                  <div className="amt sub">{money(it.amount)}</div>
                </button>
              );
            })}
          </div>
        </React.Fragment>
      );
    })}

    {st.template.length===0 && <div className="card empty">
      <b>No plan items yet</b>Add the fixed costs, debts and savings you set aside every month.</div>}

    <div className="fixed-cta">
      <button className="btn pri blk"
        onClick={()=>setForm({group:'basic',name:'',amount:0,jarId:null,installmentId:null})}>
        <I n="plus" s={16}/> Add item</button>
    </div>

    {form && <Sheet title={form.id?'Edit item':'Add item'} onClose={()=>setForm(null)}
      footer={<>
        {form.id&&<button className="btn dan sm" onClick={()=>ask('Remove this item from the plan?',()=>{
          set(d=>{d.template=d.template.filter(x=>x.id!==form.id)});setForm(null);toast('Item removed');
        },'Remove')}><I n="trash" s={15}/></button>}
        <button className="btn pri grow" disabled={!form.name.trim()} onClick={save}>Save item</button>
      </>}>
      <Field label="Group">
        <div className="seg">{GROUPS.map(g=><button key={g.k} className={form.group===g.k?'on':''}
          onClick={()=>setForm(s=>({...s,group:g.k,installmentId:g.k==='debt'?s.installmentId:null}))}>{g.n}</button>)}</div>
      </Field>

      {form.group==='debt' && <Field label="Linked installment">
        <select className="inp" value={form.installmentId||''} onChange={e=>{
          const id=e.target.value||null;
          const g=st.installments.find(x=>x.id===id);
          setForm(s=>({...s,installmentId:id,
            amount:g?g.per:s.amount,
            name:g&&!s.name.trim()?g.name:s.name,
            jarId:g&&g.jarId&&!s.jarId?g.jarId:s.jarId}));
        }}>
          <option value="">— Not linked —</option>
          {st.installments.map(g=>{
            const paid=g.payments.filter(p=>p.paid).length;
            return <option key={g.id} value={g.id}>{g.name} — {money(g.per)} ₫ · {paid}/{g.periods} paid</option>;
          })}
        </select>
        {st.installments.length===0 && <p className="mut" style={{fontSize:12.5,margin:'7px 0 0'}}>
          No installments yet. Add one in the Installments tab.</p>}
      </Field>}

      <Field label="Name"><input className="inp" autoFocus placeholder="e.g. Rent"
        value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))}/></Field>
      <Field label="Planned amount">
        <MoneyInput boxed value={form.amount} onChange={v=>setForm(s=>({...s,amount:v}))}/></Field>
      <Field label="Category"><JarSelect st={st} value={form.jarId}
        onChange={v=>setForm(s=>({...s,jarId:v}))} allowEmpty/></Field>
      <p className="mut" style={{fontSize:12.5,margin:0}}>
        This is a template only. Nothing moves until you close a month.</p>
    </Sheet>}
  </div>);
}
