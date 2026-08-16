import { useState } from 'react';
import { ask } from '../lib/ask';
import { dstr, uid } from '../lib/format';
import { I } from './Icon';
import { Field, JarSelect, MoneyInput, Sheet, TagPicker } from './ui';

export function TxSheet({st,set,txw,tx,onClose,toast}){
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
        <MoneyInput boxed autoFocus value={f.amount} onChange={v=>setF(s=>({...s,amount:v}))}/>
      </Field>

      <Field label="Name"><input className="inp" placeholder="e.g. Groceries"
        value={f.note} onChange={e=>setF(s=>({...s,note:e.target.value}))}/></Field>

      {f.type==='transfer'?(<>
        <Field label="From category"><JarSelect st={st} value={f.fromJarId} onChange={v=>setF(s=>({...s,fromJarId:v}))}/></Field>
        <Field label="To category"><JarSelect st={st} value={f.toJarId} onChange={v=>setF(s=>({...s,toJarId:v}))}/></Field>
        {f.fromJarId===f.toJarId&&<p style={{color:'var(--out)',fontSize:12.5,marginTop:-6}}>Pick two different categories.</p>}
      </>):(
        <Field label={f.type==='expense'?'Deduct from category':'Add to category'}>
          <JarSelect st={st} value={f.jarId} onChange={v=>setF(s=>({...s,jarId:v}))}/></Field>
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
