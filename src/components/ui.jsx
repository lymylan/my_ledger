import { useState, useEffect } from 'react';
import { ask } from '../lib/ask';
import { TAG_COLORS, suggestAmounts } from '../lib/constants';
import { jarShort, tagOf } from '../lib/derive';
import { clamp, money, shortM, uid } from '../lib/format';
import { I } from './Icon';

export function Vessel({pct,low=false,md=false}){
  const p=clamp(pct,0,100);
  return (
    <div className={'vessel'+(md?' md':'')}>
      <div className={'fill'+(low?' low':'')} style={{width:p+'%'}}/>
    </div>
  );
}
export function Sheet({title,onClose,children,footer,wide}){
  useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose()};
    window.addEventListener('keydown',h);
    document.body.style.overflow='hidden';
    return()=>{window.removeEventListener('keydown',h);document.body.style.overflow=''};
  },[]);
  return (<>
    <div className="scrim" onClick={onClose}/>
    <div className="sheet" role="dialog" aria-modal="true">
      <div className="sheet-h">
        <h3>{title}</h3>
        <button className="iconbtn" onClick={onClose} aria-label="Close"><I n="x" s={17}/></button>
      </div>
      <div className="sheet-b">{children}</div>
      {footer && <div className="sheet-f">{footer}</div>}
    </div>
  </>);
}
export function MoneyInput({value,onChange,placeholder='0',autoFocus,boxed,center,quick,children}){
  const [picked,setPicked]=useState(false);
  const txt=value?Number(value).toLocaleString('vi-VN'):'';
  const on=e=>{const d=e.target.value.replace(/[^\d]/g,'');setPicked(false);onChange(d?Number(d):0)};
  const sug=picked?[]:suggestAmounts(value);

  const field=boxed
    ? <div className="amt-wrap">
        <input className="amt-field" inputMode="numeric" autoFocus={autoFocus}
          value={txt} placeholder={placeholder} onChange={on}/>
        <span className="amt-cur">₫</span>
      </div>
    : <input className="big-amt" inputMode="numeric" autoFocus={autoFocus} value={txt}
        placeholder={placeholder} onChange={on}/>;

  let foot=null;
  if(sug.length) foot=(
    <div className={'sugg'+(center?' mid':'')}>
      {sug.map(n=>(
        <button key={n} onClick={()=>{setPicked(true);onChange(n)}}>{money(n)}</button>
      ))}
    </div>
  );
  else if(quick) foot=(
    <div className="quick">
      {quick.map(v=><button key={v} onClick={()=>{setPicked(true);onChange(value+v)}}>+{shortM(v)}</button>)}
      <button onClick={()=>{setPicked(false);onChange(0)}}>Clear</button>
    </div>
  );

  return <>{field}{children}{foot}</>;
}
export function TagPicker({st,set,value,onChange}){
  const [newTag,setNewTag]=useState('');
  const [mgr,setMgr]=useState(false);
  const sel=value||[];
  const toggle=id=>onChange(sel.includes(id)?sel.filter(x=>x!==id):[...sel,id]);
  const add=name=>{
    const id=uid();
    set(d=>{d.tags.push({id,name:name.trim(),color:TAG_COLORS[d.tags.length%TAG_COLORS.length]})});
    onChange([...sel,id]); setNewTag('');
  };
  const del=t=>ask('Delete tag "'+t.name+'"? It will be removed from every transaction and loan using it.',()=>{
    set(d=>{
      d.tags=d.tags.filter(x=>x.id!==t.id);
      d.txns.forEach(x=>{x.tagIds=(x.tagIds||[]).filter(id=>id!==t.id)});
      (d.loans||[]).forEach(l=>{l.tagIds=(l.tagIds||[]).filter(id=>id!==t.id)});
    });
    onChange(sel.filter(id=>id!==t.id));
  });
  return (<>
    <div className="chips">
      {st.tags.map(t=>
        <button key={t.id} className={'chip'+(sel.includes(t.id)?' on':'')}
          onClick={()=>toggle(t.id)}>{t.name}</button>)}
      {st.tags.length===0&&<span className="mut" style={{fontSize:13}}>No tags yet.</span>}
    </div>
    <div style={{display:'flex',gap:6,marginTop:8}}>
      <input className="inp" placeholder="New tag…" value={newTag}
        onChange={e=>setNewTag(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter'&&newTag.trim()){e.preventDefault();add(newTag)}}}/>
      <button className="btn gho sm" disabled={!newTag.trim()} onClick={()=>add(newTag)}>Add</button>
      <button className="btn gho sm" aria-label="Manage tags" title="Manage tags"
        onClick={()=>setMgr(m=>!m)}
        style={mgr?{borderColor:'var(--indigo)',color:'var(--indigo)',background:'var(--indigo-soft)'}:null}>
        <I n="cog" s={15}/></button>
    </div>
    {mgr&&<div className="card" style={{marginTop:8}}>
      {st.tags.map(t=>(
        <div className="row" key={t.id} style={{gap:8,padding:'8px 10px'}}>
          <span style={{width:10,height:10,borderRadius:3,background:t.color,flex:'none'}}/>
          <input className="inp" style={{padding:'6px 9px',fontSize:13.5}} value={t.name}
            onChange={e=>{const v=e.target.value;
              set(d=>{const x=d.tags.find(y=>y.id===t.id);if(x)x.name=v})}}/>
          <button className="cat-ic" aria-label={'Delete '+t.name}
            onClick={()=>del(t)}><I n="trash" s={15}/></button>
        </div>
      ))}
      {st.tags.length===0&&<div className="empty" style={{padding:'18px'}}>
        <b>No tags yet</b>Create one in the box above.</div>}
    </div>}
  </>);
}
export function Field({label,children}){return <div className="field"><label>{label}</label>{children}</div>}
export function JarSelect({st,value,onChange,allowEmpty}){
  return (
    <select className="inp" value={value||''} onChange={e=>onChange(e.target.value||null)}>
      {allowEmpty && <option value="">— None —</option>}
      {st.accounts.map(a=>(
        <option key={'g'+a.id} disabled style={{fontWeight:700}}>{'── '+a.name+' ──'}</option>
      )).flatMap((opt,i)=>{
        const a=st.accounts[i];
        return [opt,...st.jars.filter(j=>j.accountId===a.id).map(j=>
          <option key={j.id} value={j.id}>{'   '+j.name}</option>)];
      })}
    </select>
  );
}

export function TxRow({st,t,onClick}){
  const cls=t.type==='expense'?'out':t.type==='income'?'in':'move';
  const sign=t.type==='expense'?'−':t.type==='income'?'+':'';
  const names=(t.tagIds||[]).map(id=>{const x=tagOf(st,id);return x?x.name:null}).filter(Boolean);
  const base=t.type==='transfer'
    ? jarShort(st,t.fromJarId)+' → '+jarShort(st,t.toJarId)
    : jarShort(st,t.jarId);
  const sub=base+(names.length?' · '+names.join(', '):'');
  return (
    <button className="row" onClick={onClick}>
      <div className={'dot '+cls}><I n={t.type==='transfer'?'arrow':t.type==='income'?'up':'dn'} s={16}/></div>
      <div className="row-b">
        <div className="row-t">{t.note||(t.type==='transfer'?'Transfer':t.type==='income'?'Income':'Expense')}</div>
        <div className="row-s">{sub}</div>
      </div>
      <div className={'amt '+cls} style={{fontSize:14.5}}>{sign}{money(t.amount)}</div>
    </button>
  );
}
