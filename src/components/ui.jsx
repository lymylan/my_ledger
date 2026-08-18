import { useState, useEffect, useRef } from 'react';
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

/* Ô nhập + nút Add, thêm liên tiếp vào danh sách ngay bên dưới.
   Dùng ở: tag trong TxSheet, và Categories trong sheet Add account.

   Điểm mấu chốt là GIỮ FOCUS sau khi thêm. Mặc định bấm nút sẽ chuyển focus
   sang nút -> iOS đóng bàn phím -> muốn nhập tiếp phải chạm lại ô. Chặn bằng
   hai lớp:
     1. preventDefault ở onMouseDown  -> focus không rời ô ngay từ đầu
     2. focus() lại trong onClick     -> lớp dự phòng

   focus() phải gọi ĐỒNG BỘ trong user gesture. Đặt trong setTimeout hoặc sau
   await thì iOS sẽ không mở lại bàn phím. */
export function InlineAdd({ placeholder, onAdd, label = 'Add', children }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  const ok = text.trim().length > 0;

  const commit = () => {
    if (!ok) return;
    onAdd(text.trim());
    setText('');
    if (ref.current) ref.current.focus();
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input ref={ref} className="inp" placeholder={placeholder} value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }} />
      <button className="btn gho sm" disabled={!ok}
        onMouseDown={e => e.preventDefault()} onClick={commit}>{label}</button>
      {children}
    </div>
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
export function TagPicker({st,set,txw,value,onChange}){
  const [mgr,setMgr]=useState(false);
  const sel=value||[];
  const toggle=id=>onChange(sel.includes(id)?sel.filter(x=>x!==id):[...sel,id]);
  const add=name=>{
    const id=uid();
    set(d=>{d.tags.push({id,name:name.trim(),color:TAG_COLORS[d.tags.length%TAG_COLORS.length]})});
    onChange([...sel,id]);
  };
  /* Gỡ tag khỏi giao dịch TRƯỚC, rồi mới xoá tag khỏi state. Ngược lại thì một
     lỗi mạng giữa chừng để lại tagIds trỏ tới tag không còn tồn tại.
     txw.stripTag chạm mọi tháng, không chỉ tháng đang mở. */
  const del=t=>ask('Delete tag "'+t.name+'"? It will be removed from every transaction and loan using it.',async()=>{
    if(!await txw.stripTag(t.id))return;
    set(d=>{
      d.tags=d.tags.filter(x=>x.id!==t.id);
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
    <div style={{marginTop:8}}>
      <InlineAdd placeholder="New tag…" onAdd={add}>
        <button className="btn gho sm" aria-label="Manage tags" title="Manage tags"
          onMouseDown={e=>e.preventDefault()} onClick={()=>setMgr(m=>!m)}
          style={mgr?{borderColor:'var(--indigo)',color:'var(--indigo)',background:'var(--indigo-soft)'}:null}>
          <I n="cog" s={15}/></button>
      </InlineAdd>
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

/* ---- reorder bằng kéo-thả ------------------------------------------------

   Tự viết chứ không thêm thư viện: deps của project chỉ có firebase/next/react,
   và mọi thư viện DnD đủ dùng đều nặng hơn cả tính năng này.

   Dùng Pointer Events, KHÔNG dùng HTML5 drag-and-drop: dragstart/dragover không
   bắn trên touch, mà app này mobile-first. Pointer events cho cả chuột và ngón
   tay bằng một đường code.

   Ba điểm dễ sai, đã xử lý:

   1. `:scope > [data-di]` chứ không phải `[data-di]`. Danh sách category nằm
      LỒNG trong danh sách account, querySelectorAll không scope sẽ nhặt luôn các
      dòng category vào phép đo của list account.
   2. `to` lưu trong ref, không đọc từ state trong lúc thả. pointerup có thể xảy
      ra cùng frame với pointermove cuối, khi đó state chưa kịp cập nhật.
   3. `setPointerCapture` trên tay cầm, nên pointermove/up vẫn tới đúng nơi kể cả
      khi ngón tay đi ra ngoài phần tử. Kèm `touch-action:none` trên .grip —
      không có nó thì Safari iOS cuộn trang thay vì kéo.

   Đo rect MỘT LẦN lúc bắt đầu kéo. Thứ tự thật chỉ đổi khi thả, nên rect không
   bị lệch giữa đường. Đổi lại phải tự vẽ vạch đích — xem .dl-row.drop-* trong
   globals.css. Cách này chịu được dòng cao thấp khác nhau (card account cao khác
   dòng category), thứ mà kiểu "đẩy các dòng ở giữa" không làm được. */
export function useDragList(ids, onReorder) {
  const [drag, setDrag] = useState(null);   // {from,to} — chỉ để render
  const geo = useRef(null);

  const start = (e, from) => {
    if (e.button !== undefined && e.button !== 0) return;   // chỉ chuột trái
    /* Container tìm từ chính event, KHÔNG qua ref. Vừa gọn hơn (hook không cần
       ref cho container, nơi gọi không cần nhớ gắn) vừa tránh
       react-hooks/refs — React Compiler chặn chuyền ref qua thuộc tính khi render.
       closest() dừng ở container GẦN NHẤT, nên list category lồng trong list
       account vẫn tự tìm đúng của mình. */
    const box = e.currentTarget.closest('[data-dl]');
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();                                    // list lồng nhau
    const rects = [...box.querySelectorAll(':scope > [data-di]')]
      .map(el => el.getBoundingClientRect());
    if (rects.length < 2) return;                           // 0-1 phần tử: khỏi kéo
    geo.current = { rects, startY: e.clientY, from, to: from };
    setDrag({ from, to: from });
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* không sao */ }
  };

  const move = e => {
    const g = geo.current;
    if (!g) return;
    const c = g.rects[g.from].top + g.rects[g.from].height / 2 + (e.clientY - g.startY);
    const last = g.rects.length - 1;
    let to = g.from;
    if (c < g.rects[0].top) to = 0;
    else if (c > g.rects[last].bottom) to = last;
    else for (let i = 0; i <= last; i++) {
      if (c >= g.rects[i].top && c <= g.rects[i].bottom) { to = i; break }
    }
    if (to === g.to) return;
    g.to = to;
    setDrag(d => (d ? { ...d, to } : d));
  };

  const end = () => {
    const g = geo.current;
    geo.current = null;
    setDrag(null);
    if (!g || g.to === g.from) return;
    const next = [...ids];
    next.splice(g.to, 0, next.splice(g.from, 1)[0]);
    onReorder(next);
  };

  /* Vạch đích nằm ở cạnh trên khi kéo lên, cạnh dưới khi kéo xuống — khớp với
     ngữ nghĩa "thả vào đúng ô đang trỏ tới". */
  const rowClass = i => {
    if (!drag || drag.to === drag.from) return 'dl-row';
    if (i === drag.from) return 'dl-row dragging';
    if (i !== drag.to) return 'dl-row';
    return 'dl-row ' + (drag.to < drag.from ? 'drop-before' : 'drop-after');
  };

  return {
    box: { 'data-dl': '' },
    active: !!drag,
    /* `cls` để gộp class sẵn có của phần tử (ví dụ 'card') — spread props sau
       className thì className bị ghi đè mất. */
    row: (i, cls) => ({ 'data-di': '', className: (cls ? cls + ' ' : '') + rowClass(i) }),
    handle: i => ({
      className: 'grip', role: 'button', tabIndex: -1, 'aria-hidden': 'true',
      onPointerDown: e => start(e, i),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
    }),
  };
}
