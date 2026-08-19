import { useState, useMemo } from 'react';
import { ask } from '../lib/ask';
import { jarStats } from '../lib/derive';
import { dstr, money, uid, ymOfDate } from '../lib/format';
import { I } from './Icon';
import { Field, JarSelect, MoneyInput, Sheet, TagPicker } from './ui';

/* Số dư của category đang chọn và của cả account chứa nó, SAU khi áp số tiền đang
   nhập — để biết ngay còn lại bao nhiêu mà không phải thoát sheet ra xem.

   `left` là map jarId -> số dư đã điều chỉnh, tính sẵn ở TxSheet. Phải tính ở một
   chỗ chứ không để mỗi JarLeft tự tính: transfer trong CÙNG một account thì lọ đi
   giảm và lọ đến tăng, tổng của account không đổi — chỉ đúng khi cộng dồn từ cùng
   một map đã điều chỉnh cả hai chân.

   Ở module scope, không lồng trong TxSheet — xem README §4. */
export function JarLeft({st,left,jarId}){
  const jar=jarId?st.jars.find(j=>j.id===jarId):null;
  if(!jar||!left)return null;
  const acc=st.accounts.find(a=>a.id===jar.accountId);
  const cat=left[jar.id]||0;
  const total=st.jars.filter(j=>j.accountId===jar.accountId)
    .reduce((a,j)=>a+(left[j.id]||0),0);
  return (
    <div className="jar-left">
      <span>Category <b className={cat<0?'neg':''}>{money(cat)}</b></span>
      <span>{acc?acc.name:'Account'} <b className={total<0?'neg':''}>{money(total)}</b></span>
    </div>
  );
}

export function TxSheet({st,set,txw,tx,ym,onClose,toast}){
  const isNew=!tx.id;
  const [f,setF]=useState(()=>({
    id:tx.id||null,
    type:tx.type||'expense',
    amount:tx.amount||0,
    date:tx.date||dstr(new Date()),
    jarId:tx.jarId||(st.jars[0]?st.jars[0].id:null),
    fromJarId:tx.fromJarId||(st.jars[0]?st.jars[0].id:null),
    toJarId:tx.toJarId||(st.jars[1]?st.jars[1].id:null),
    tagIds:tx.tagIds||[],
    note:tx.note||'',
  }));
  const valid=f.amount>0 && (f.type==='transfer'?(f.fromJarId&&f.toJarId&&f.fromJarId!==f.toJarId):!!f.jarId);

  /* Số tiền ĐÃ CHỐT, dùng để tính số dư hiển thị. Tách khỏi f.amount vì f.amount đổi
     mỗi ký tự — số dư nhảy theo từng chữ số vừa nhiễu vừa vô nghĩa (gõ "25" một nhịp
     thành 2 rồi 25). Chỉ cập nhật khi rời ô số tiền hoặc bấm nút gợi ý. */
  const [applied,setApplied]=useState(()=>tx.amount||0);

  /* Map jarId -> số dư SAU khi áp giao dịch đang nhập.

     Hai điểm dễ sai:
     1. Khi SỬA giao dịch đã có, phải bỏ nó ra khỏi jarStats trước đã. Không bỏ thì
        số cũ vẫn còn trong số dư, cộng thêm số mới vào là trừ hai lần.
     2. CHỈ tính khi ngày giao dịch nằm trong tháng đang nạp. `st.txns` giờ chỉ giữ
        một tháng (xem lib/storage.js) nên jarStats cho tháng khác sẽ ra số CAO HƠN
        thực tế vì không có giao dịch nào để trừ. Thà không hiện còn hơn hiện số sai
        — đổi ngày sang tháng khác thì dòng này tự ẩn. */
  const left=useMemo(()=>{
    if(ymOfDate(f.date)!==ym)return null;
    const src=f.id?{...st,txns:st.txns.filter(t=>t.id!==f.id)}:st;
    const js=jarStats(src,ym);
    const out={};
    Object.keys(js).forEach(k=>{out[k]=js[k].left});
    const amt=Number(applied)||0;
    if(amt>0){
      if(f.type==='transfer'){
        if(f.fromJarId in out)out[f.fromJarId]-=amt;
        if(f.toJarId in out)out[f.toJarId]+=amt;
      } else if(f.jarId in out){
        out[f.jarId]+=f.type==='income'?amt:-amt;
      }
    }
    return out;
  },[st,ym,applied,f.date,f.id,f.type,f.jarId,f.fromJarId,f.toJarId]);

  /* Ghi thẳng lên Firestore rồi mới đóng sheet. Ghi hỏng thì giữ sheet mở với
     nguyên số vừa nhập — trước đây sheet đóng ngay và người dùng tưởng đã lưu. */
  const [busy,setBusy]=useState(false);
  const save=async()=>{
    const rec={id:f.id||uid(),type:f.type,amount:f.amount,date:f.date,note:f.note.trim(),
      jarId:f.type==='transfer'?null:f.jarId,
      fromJarId:f.type==='transfer'?f.fromJarId:null,
      toJarId:f.type==='transfer'?f.toJarId:null,
      tagIds:f.tagIds};
    setBusy(true);
    const ok=await txw.put(rec);
    setBusy(false);
    if(!ok)return;
    onClose(); toast(isNew?'Transaction added':'Transaction updated');
  };
  const del=()=>ask('Delete this transaction?',async()=>{
    if(!await txw.del(f.id))return;
    onClose(); toast('Transaction deleted');
  });

  return (
    <Sheet title={isNew?'Add transaction':'Edit transaction'} onClose={onClose}
      footer={<>
        {!isNew&&<button className="btn dan sm" onClick={del}><I n="trash" s={15}/></button>}
        <button className="btn pri grow" disabled={!valid||busy} onClick={save}>
          {busy?'Saving…':isNew?'Save transaction':'Save changes'}</button>
      </>}>
      <div className="seg" style={{marginBottom:14}}>
        {[['expense','Expense','out'],['income','Income','in'],['transfer','Transfer','move']].map(([k,n,c])=>
          <button key={k} className={f.type===k?'on '+c:''} onClick={()=>setF(s=>({...s,type:k}))}>{n}</button>)}
      </div>

      <Field label="Amount">
        <MoneyInput boxed autoFocus value={f.amount}
          onChange={v=>setF(s=>({...s,amount:v}))} onCommit={setApplied}/>
      </Field>

      <Field label="Name"><input className="inp" placeholder="e.g. Groceries"
        value={f.note} onChange={e=>setF(s=>({...s,note:e.target.value}))}/></Field>

      {f.type==='transfer'?(<>
        <Field label="From category"><JarSelect st={st} value={f.fromJarId} onChange={v=>setF(s=>({...s,fromJarId:v}))}/>
          <JarLeft st={st} left={left} jarId={f.fromJarId}/></Field>
        <Field label="To category"><JarSelect st={st} value={f.toJarId} onChange={v=>setF(s=>({...s,toJarId:v}))}/>
          <JarLeft st={st} left={left} jarId={f.toJarId}/></Field>
        {f.fromJarId===f.toJarId&&<p style={{color:'var(--out)',fontSize:12.5,marginTop:-6}}>Pick two different categories.</p>}
      </>):(
        <Field label={f.type==='expense'?'Deduct from category':'Add to category'}>
          <JarSelect st={st} value={f.jarId} onChange={v=>setF(s=>({...s,jarId:v}))}/>
          <JarLeft st={st} left={left} jarId={f.jarId}/></Field>
      )}

      <Field label="Tag">
        <TagPicker st={st} set={set} txw={txw} value={f.tagIds}
          onChange={ids=>setF(s=>({...s,tagIds:ids}))}/>
      </Field>

      <Field label="Date"><input className="inp" type="date" value={f.date}
        onChange={e=>setF(s=>({...s,date:e.target.value}))}/></Field>
    </Sheet>
  );
}
