import { useState, useEffect } from 'react';
import { ask } from '../lib/ask';
import { TAG_COLORS, suggestAmounts } from '../lib/constants';
import { jarShort, tagOf } from '../lib/derive';
import { clamp, money, shortM, uid } from '../lib/format';
import { I } from './Icon';

/* Logo + tên app, DÙNG CHUNG cho màn đăng nhập và cả hai chỗ ở top bar/sidebar.
   Trước đây ba chỗ tự dựng markup riêng nên dùng ba icon khác nhau (book, book,
   jar). Gom vào đây để không lệch lại được. */
export function Brand({ size = 26, gap = 8 }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap }}>
      <span style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3),
        background: 'var(--indigo)', color: '#fff', display: 'grid', placeItems: 'center',
        flexShrink: 0,
      }}>
        <I n="wallet" s={Math.round(size * 0.58)} />
      </span>
      My Ledger
    </span>
  );
}

/* Màn báo lỗi thay cho việc mắc ở "Loading…" vô thời hạn.
   Nguyên tắc: khi ở đây, app KHÔNG ghi gì lên Firestore — vì chưa đọc được dữ
   liệu thật, ghi lên là có nguy cơ đè mất sổ. */
export function ErrorScreen({ title, message, hint, onRetry, retryLabel = 'Try again', extra }) {
  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 'max(10vh, 48px)', textAlign: 'center' }}>
      <div style={{
        width: 46, height: 46, borderRadius: 14, margin: '0 auto 14px',
        background: 'var(--out-soft)', color: 'var(--out)', display: 'grid', placeItems: 'center',
      }}>
        <I n="x" s={22} />
      </div>
      <h2 style={{
        fontFamily: 'var(--f-disp)', fontSize: 17, fontWeight: 800,
        letterSpacing: '-.02em', margin: '0 0 6px',
      }}>{title}</h2>
      <p className="mut" style={{ fontSize: 13, margin: '0 0 4px', lineHeight: 1.5 }}>{message}</p>
      {hint && <p className="mut" style={{ fontSize: 12.5, margin: '0 0 18px', lineHeight: 1.5 }}>{hint}</p>}
      <div style={{ marginTop: 18 }}>
        <button className="btn pri blk" onClick={onRetry}>{retryLabel}</button>
        {extra}
      </div>
    </div>
  );
}

/* Ô mật khẩu có nút con mắt. Dùng ở màn đăng nhập và form đổi mật khẩu. */
export function PasswordInput({ id, value, onChange, placeholder, autoComplete, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input id={id} className="inp" type={show ? 'text' : 'password'}
        style={{ paddingRight: 42 }}
        autoComplete={autoComplete} autoFocus={autoFocus}
        placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          width: 34, height: 34, display: 'grid', placeItems: 'center',
          color: show ? 'var(--indigo)' : 'var(--muted)', borderRadius: 8,
        }}>
        <I n={show ? 'eye-off' : 'eye'} s={17} />
      </button>
    </div>
  );
}

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
