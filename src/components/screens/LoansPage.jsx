import { useState } from 'react';
import { ask } from '../../lib/ask';
import { buildLoanPeriods, jarShort, loanStat } from '../../lib/derive';
import { MON, clamp, dstr, mLabel, mLabelLong, money, pad, parseD, uid, ymOfDate } from '../../lib/format';
import { I } from '../Icon';
import { Field, JarSelect, MoneyInput, Sheet, TagPicker, Vessel } from '../ui';

export function LoansPage({st,set,txw,toast}){
  const [open,setOpen]=useState(null);
  const [form,setForm]=useState(null);
  const [pay,setPay]=useState(null);
  const today=dstr(new Date());
  const totalOut=st.loans.reduce((a,g)=>a+loanStat(g).left,0);

  /* Mọi hàm dưới đây ghi GIAO DỊCH lên server trước, rồi mới sửa state trong bộ
     nhớ. Giao dịch gắn với khoản vay có thể nằm ở tháng khác tháng đang xem nên
     không còn tìm thấy trong d.txns — phải đọc/ghi qua txw theo id. */
  const saveLoan=async()=>{
    const f=form;
    if(f.id){
      const g=st.loans.find(x=>x.id===f.id);
      if(g&&g.txnId){
        let t;
        try{ t=await txw.get(g.txnId) }
        catch{ toast('Not saved — could not read the original expense'); return }
        if(t&&!await txw.put({...t,amount:f.total,date:f.date,jarId:f.jarId,
          tagIds:f.tagIds,note:'Lent · '+f.name.trim()}))return;
      }
      set(d=>{
        const g=d.loans.find(x=>x.id===f.id);
        g.payments=buildLoanPeriods(f.date,f.periods,f.total,g.payments);
        Object.assign(g,{name:f.name.trim(),note:f.note,total:f.total,date:f.date,
          jarId:f.jarId,tagIds:f.tagIds,periods:f.periods});
      });
    } else {
      const txId=uid();
      if(!await txw.put({id:txId,type:'expense',amount:f.total,date:f.date,jarId:f.jarId,
        fromJarId:null,toJarId:null,tagIds:f.tagIds,note:'Lent · '+f.name.trim()}))return;
      set(d=>{
        d.loans.push({id:uid(),name:f.name.trim(),note:f.note,total:f.total,date:f.date,
          jarId:f.jarId,tagIds:f.tagIds,txnId:txId,periods:f.periods,
          payments:buildLoanPeriods(f.date,f.periods,f.total,null)});
      });
    }
    setForm(null);
    toast(f.id?'Loan updated':'Loan recorded — '+money(f.total)+' ₫ deducted');
  };

  const delLoan=g=>ask('Delete this loan? The original expense and every repayment it created will be removed too.',async()=>{
    const ids=[g.txnId,...g.payments.map(p=>p.txnId)].filter(Boolean);
    if(!await txw.delMany(ids))return;
    set(d=>{d.loans=d.loans.filter(x=>x.id!==g.id)});
    setOpen(null); toast('Loan deleted');
  });

  const confirmPay=async()=>{
    const f=pay;
    const g=st.loans.find(x=>x.id===f.loanId);
    if(!g)return;
    const txId=uid();
    if(!await txw.put({id:txId,type:'income',amount:f.amount,date:f.date,jarId:f.jarId,
      fromJarId:null,toJarId:null,tagIds:g.tagIds||[],note:'Repaid · '+g.name}))return;
    set(d=>{
      const gg=d.loans.find(x=>x.id===f.loanId);
      const p=gg.payments.find(y=>y.i===f.i);
      Object.assign(p,{paid:true,paidAt:f.date,jarId:f.jarId,txnId:txId,amount:f.amount});
    });
    setPay(null); toast(money(f.amount)+' ₫ added back');
  };

  const undoPay=(g,p)=>ask('Undo this repayment? The income transaction will be removed.',async()=>{
    if(p.txnId&&!await txw.del(p.txnId))return;
    set(d=>{
      const gg=d.loans.find(x=>x.id===g.id);
      const pp=gg.payments.find(y=>y.i===p.i);
      Object.assign(pp,{paid:false,paidAt:null,jarId:null,txnId:null});
    });
  },'Undo');

  return (<div style={{paddingTop:4}}>
    <div className="card pad">
      <div className="eyebrow">Still owed to me</div>
      <div className="num" style={{fontSize:28,fontWeight:800,letterSpacing:'-.032em',margin:'1px 0 2px'}}>
        {money(totalOut)} <span style={{fontSize:14,color:'var(--muted)',fontWeight:600}}>₫</span></div>
      <div className="row-s">Across {st.loans.length} loan{st.loans.length===1?'':'s'}</div>
    </div>

    {st.loans.length===0 && <div className="card empty" style={{marginTop:12}}>
      <b>No loans yet</b>Record money you lent out so it stops looking like spending.</div>}

    {st.loans.map(g=>{
      const s=loanStat(g), pct=(s.got/g.total)*100;
      const due=s.next&&s.next.due<=today;
      return (
        <div className="card" key={g.id} style={{marginTop:12}}>
          <button className="row" onClick={()=>setOpen(g.id)}
            style={{alignItems:'stretch',flexDirection:'column',gap:9}}>
            <div style={{display:'flex',alignItems:'center',gap:10,width:'100%'}}>
              <div className="row-b">
                <div className="row-t">{g.name} {due&&<span className="pill due">Due</span>}</div>
                <div className="row-s">{g.note||jarShort(st,g.jarId)}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="amt sub">{money(s.left)}</div>
                <div className="row-s">Left</div>
              </div>
            </div>
            <Vessel pct={pct}/>
            <div style={{display:'flex',width:'100%',fontSize:11.5,color:'var(--muted)'}}>
              <span>Lent {money(g.total)} · {s.paidN}/{g.periods} back</span>
              <span className="grow"/>
              <span>{s.leftN} period{s.leftN===1?'':'s'} to go</span>
            </div>
          </button>
        </div>
      );
    })}

    {open && (()=>{
      const g=st.loans.find(x=>x.id===open); if(!g)return null;
      const s=loanStat(g);
      return (
        <Sheet title={g.name} onClose={()=>setOpen(null)}
          footer={<>
            <button className="btn dan sm" onClick={()=>delLoan(g)}><I n="trash" s={15}/></button>
            <button className="btn gho grow" onClick={()=>{setForm({...g});setOpen(null)}}>Edit loan</button>
          </>}>
          <div className="stat" style={{gridTemplateColumns:'1fr 1fr'}}>
            <div className="s"><div className="k">Lent</div><div className="v">{money(g.total)}</div></div>
            <div className="s"><div className="k">Back</div>
              <div className="v" style={{color:'var(--in)'}}>{money(s.got)}</div></div>
            <div className="s"><div className="k">Still owed</div>
              <div className="v" style={{color:'var(--out)'}}>{money(s.left)}</div></div>
            <div className="s"><div className="k">Taken from</div>
              <div className="v" style={{fontSize:14,lineHeight:1.25}}>{jarShort(st,g.jarId)}</div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>
                {mLabelLong(ymOfDate(g.date))}</div></div>
          </div>
          <div className="sec-h"><h2>Repayments</h2><span className="sub">Tap to record</span></div>
          <div className="card">
            {g.payments.map(p=>{
              const isDue=!p.paid&&p.due<=today;
              return (
                <button className="row" key={p.i} onClick={()=>p.paid?undoPay(g,p)
                  :setPay({loanId:g.id,i:p.i,amount:p.amount,date:today,jarId:g.jarId})}
                  style={{flexDirection:'column',alignItems:'stretch',gap:4}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div className={'chk'+(p.paid?' on':'')}>{p.paid&&<I n="check" s={13}/>}</div>
                    <div className="row-t grow" style={{minWidth:0}}>Period {p.i}</div>
                    {isDue&&<span className="pill due">Due</span>}
                    <div className="amt sub" style={p.paid?{opacity:.45}:null}>{money(p.amount)}</div>
                  </div>
                  <div className="row-s" style={{paddingLeft:32,whiteSpace:'normal',lineHeight:1.35}}>
                    Due {parseD(p.due).getDate()} {MON[parseD(p.due).getMonth()]} {parseD(p.due).getFullYear()}
                    {p.paid&&p.jarId?' → '+jarShort(st,p.jarId)
                      +' · '+mLabel(ymOfDate(p.paidAt||p.due)):''}</div>
                </button>
              );
            })}
          </div>
          <p className="mut" style={{fontSize:12.5}}>Recording a repayment creates an income transaction
            in the category you pick. Undoing it removes that transaction.</p>
        </Sheet>
      );
    })()}

    {pay && (()=>{
      const g=st.loans.find(x=>x.id===pay.loanId);
      return (
        <Sheet title={'Repayment · '+(g?g.name:'')} onClose={()=>setPay(null)}
          footer={<button className="btn pri blk" disabled={!pay.amount||!pay.jarId}
            onClick={confirmPay}>Add to category</button>}>
          <Field label="Amount received">
            <MoneyInput boxed autoFocus value={pay.amount}
              onChange={v=>setPay(s=>({...s,amount:v}))}/></Field>
          <Field label="Date"><input className="inp" type="date" value={pay.date}
            onChange={e=>setPay(s=>({...s,date:e.target.value}))}/></Field>
          <Field label="Add into category">
            <JarSelect st={st} value={pay.jarId} onChange={v=>setPay(s=>({...s,jarId:v}))}/></Field>
          <div className="card pad" style={{marginTop:2}}>
            <div className="tot"><span className="k">Lands in</span>
              <span className="v" style={{fontSize:14}}>
                {pay.jarId?jarShort(st,pay.jarId):'—'}</span></div>
            <div className="tot"><span className="k">For the month of</span>
              <span className="v" style={{fontSize:14}}>{mLabelLong(ymOfDate(pay.date))}</span></div>
          </div>
          <p className="mut" style={{fontSize:12.5,margin:'10px 0 0'}}>
            Does not have to be the category the money came from. Changing the date moves it
            to that month's budget.</p>
        </Sheet>
      );
    })()}

    {form && <Sheet title={form.id?'Edit loan':'New loan'} onClose={()=>setForm(null)}
      footer={<button className="btn pri blk"
        disabled={!form.name.trim()||!form.total||!form.jarId||!form.periods}
        onClick={saveLoan}>{form.id?'Save loan':'Record loan'}</button>}>
      <Field label="Who did you lend to"><input className="inp" autoFocus placeholder="e.g. Minh"
        value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))}/></Field>
      <Field label="Note"><input className="inp" placeholder="e.g. For his laptop"
        value={form.note} onChange={e=>setForm(s=>({...s,note:e.target.value}))}/></Field>
      <Field label="Amount lent">
        <MoneyInput boxed value={form.total} onChange={v=>setForm(s=>({...s,total:v}))}/></Field>
      <Field label="Take from category">
        <JarSelect st={st} value={form.jarId} onChange={v=>setForm(s=>({...s,jarId:v}))}/></Field>
      <div style={{display:'flex',gap:10}}>
        <div className="grow"><Field label="Repaid over (periods)">
          <input className="inp mono" type="number" min="1" max="60" value={form.periods}
            onChange={e=>setForm(s=>({...s,periods:clamp(Number(e.target.value)||1,1,60)}))}/></Field></div>
        <div className="grow"><Field label="Date lent"><input className="inp" type="date"
          value={form.date} onChange={e=>setForm(s=>({...s,date:e.target.value}))}/></Field></div>
      </div>
      <Field label="Tags">
        <TagPicker st={st} set={set} txw={txw} value={form.tagIds||[]}
          onChange={ids=>setForm(s=>({...s,tagIds:ids}))}/>
      </Field>
      {form.total>0&&form.periods>0&&<div className="card pad">
        <div className="tot"><span className="k">Each period</span>
          <span className="v" style={{fontSize:15}}>{money(form.total/form.periods)} ₫</span></div>
        <div className="tot"><span className="k">Taken from</span>
          <span className="v" style={{fontSize:14}}>
            {form.jarId?jarShort(st,form.jarId):'—'}</span></div>
        <div className="tot"><span className="k">In the month of</span>
          <span className="v" style={{fontSize:14}}>{mLabelLong(ymOfDate(form.date))}</span></div>
      </div>}
    </Sheet>}

    <div className="fixed-cta">
      <button className="btn pri blk" onClick={()=>setForm({name:'',note:'',total:0,
        date:today,jarId:st.jars[0]?st.jars[0].id:null,tagIds:[],periods:1})}>
        <I n="plus" s={16}/> New loan</button>
    </div>
  </div>);
}
