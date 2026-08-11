import { useState } from 'react';
import { ask } from '../../lib/ask';
import { MON, clamp, dstr, money, parseD, uid } from '../../lib/format';
import { I } from '../Icon';
import { Field, JarSelect, MoneyInput, Sheet, Vessel } from '../ui';

export function Installments({st,set,toast}){
  const [open,setOpen]=useState(null);
  const [form,setForm]=useState(null);
  const today=dstr(new Date());

  const stat=g=>{
    const paid=g.payments.filter(p=>p.paid);
    const paidAmt=paid.reduce((a,b)=>a+b.amount,0);
    const next=g.payments.find(p=>!p.paid);
    return {paidN:paid.length,paidAmt,left:g.total-paidAmt,leftN:g.periods-paid.length,next};
  };

  return (<div>
    <div className="sec-h"><h2>Installments</h2>
      <button className="act" onClick={()=>setForm({name:'',note:'',total:0,periods:12,start:today,jarId:null})}>+ Add installment</button></div>

    {st.installments.length===0&&<div className="card empty"><b>No installments yet</b>Add one to track every period you owe.</div>}

    {st.installments.map(g=>{
      const s=stat(g), pct=(s.paidN/g.periods)*100;
      const due=s.next&&s.next.due<=today;
      return (
        <div className="card" key={g.id}>
          <button className="row" onClick={()=>setOpen(g.id)} style={{alignItems:'stretch',flexDirection:'column',gap:9}}>
            <div style={{display:'flex',alignItems:'center',gap:10,width:'100%'}}>
              <div className="row-b">
                <div className="row-t">{g.name} {due&&<span className="pill due">Due</span>}</div>
                <div className="row-s">{g.note||'—'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="amt" style={{fontSize:15}}>{money(g.per||g.payments[0].amount)}</div>
                <div className="row-s">Per period</div>
              </div>
            </div>
            <Vessel pct={pct} md/>
            <div style={{display:'flex',width:'100%',fontSize:11.5,color:'var(--muted)'}}>
              <span>Period {Math.min(s.paidN+1,g.periods)} of {g.periods} · Paid {money(s.paidAmt)}</span>
              <span className="grow"/>
              <span>{s.leftN} periods left · {money(s.left)} ₫</span>
            </div>
          </button>
        </div>
      );
    })}

    {open && (()=>{
      const g=st.installments.find(x=>x.id===open); if(!g)return null;
      const s=stat(g);
      return (
        <Sheet title={g.name} onClose={()=>setOpen(null)}
          footer={<>
            <button className="btn dan sm" onClick={()=>ask('Delete this installment?',()=>{
              set(d=>{d.installments=d.installments.filter(x=>x.id!==g.id)});setOpen(null);toast('Installment deleted');
            })}><I n="trash" s={15}/></button>
            <button className="btn gho grow" onClick={()=>{setForm({...g});setOpen(null)}}>Edit installment</button>
          </>}>
          <div className="stat" style={{gridTemplateColumns:'1fr 1fr'}}>
            <div className="s"><div className="k">Total amount</div><div className="v">{money(g.total)}</div></div>
            <div className="s"><div className="k">Paid</div><div className="v" style={{color:'var(--in)'}}>{money(s.paidAmt)}</div></div>
            <div className="s"><div className="k">Remaining</div><div className="v" style={{color:'var(--out)'}}>{money(s.left)}</div></div>
            <div className="s"><div className="k">Current period</div><div className="v">{Math.min(s.paidN+1,g.periods)}<span style={{fontSize:14,color:'var(--muted)'}}>/{g.periods}</span></div></div>
          </div>
          <div className="sec-h"><h2>Payment schedule</h2><span className="sub">Tap to toggle status</span></div>
          <div className="card">
            {g.payments.map(p=>{
              const isDue=!p.paid&&p.due<=today;
              return (
                <button className="row" key={p.i} onClick={()=>set(d=>{
                  const gg=d.installments.find(x=>x.id===g.id);
                  const pp=gg.payments.find(y=>y.i===p.i);
                  pp.paid=!pp.paid; pp.paidAt=pp.paid?dstr(new Date()):null;
                })}>
                  <div className={'chk'+(p.paid?' on':'')}>{p.paid&&<I n="check" s={13}/>}</div>
                  <div className="row-b">
                    <div className="row-t">Period {p.i}</div>
                    <div className="row-s">Due {parseD(p.due).getDate()} {MON[parseD(p.due).getMonth()]} {parseD(p.due).getFullYear()}
                      {p.paid&&p.paidAt?' · Paid '+parseD(p.paidAt).getDate()+' '+MON[parseD(p.paidAt).getMonth()]:''}</div>
                  </div>
                  {isDue&&<span className="pill due">Overdue</span>}
                  <div className="amt" style={{fontSize:14,opacity:p.paid?.45:1}}>{money(p.amount)}</div>
                </button>
              );
            })}
          </div>
          <p className="mut" style={{fontSize:12.5}}>Marking a period paid does not deduct from any category — record that expense separately.</p>
        </Sheet>
      );
    })()}

    {form && <Sheet title={form.id?'Edit installment':'Add installment'} onClose={()=>setForm(null)}
      footer={<button className="btn pri blk" disabled={!form.name.trim()||!form.total||!form.periods} onClick={()=>{
        const per=Math.round(form.total/form.periods);
        set(d=>{
          if(form.id){
            const g=d.installments.find(x=>x.id===form.id);
            const paidMap={}; g.payments.forEach(p=>paidMap[p.i]=p);
            const d0=parseD(form.start), pay=[];
            for(let i=0;i<form.periods;i++){
              const dt=new Date(d0.getFullYear(),d0.getMonth()+i,d0.getDate());
              const old=paidMap[i+1];
              pay.push({i:i+1,due:dstr(dt),amount:per,paid:old?old.paid:false,paidAt:old?old.paidAt:null});
            }
            Object.assign(g,{name:form.name.trim(),note:form.note,total:form.total,periods:form.periods,per,start:form.start,jarId:form.jarId,payments:pay});
          } else {
            const d0=parseD(form.start), pay=[];
            for(let i=0;i<form.periods;i++){
              const dt=new Date(d0.getFullYear(),d0.getMonth()+i,d0.getDate());
              pay.push({i:i+1,due:dstr(dt),amount:per,paid:false,paidAt:null});
            }
            d.installments.push({id:uid(),name:form.name.trim(),note:form.note,total:form.total,periods:form.periods,per,start:form.start,jarId:form.jarId,payments:pay});
          }
        });
        setForm(null);toast('Installment saved');
      }}>Save installment</button>}>
      <Field label="What is it for"><input className="inp" autoFocus placeholder="e.g. iPhone 16 Pro"
        value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))}/></Field>
      <Field label="Note"><input className="inp" placeholder="e.g. VCB credit card, 0%"
        value={form.note} onChange={e=>setForm(s=>({...s,note:e.target.value}))}/></Field>
      <Field label="Total amount"><MoneyInput boxed value={form.total} onChange={v=>setForm(s=>({...s,total:v}))}/></Field>
      <div style={{display:'flex',gap:10}}>
        <div className="grow"><Field label="Number of periods"><input className="inp mono" type="number" min="1" max="120"
          value={form.periods} onChange={e=>setForm(s=>({...s,periods:clamp(Number(e.target.value)||1,1,120)}))}/></Field></div>
        <div className="grow"><Field label="First period date"><input className="inp" type="date"
          value={form.start} onChange={e=>setForm(s=>({...s,start:e.target.value}))}/></Field></div>
      </div>
      <Field label="Paid from category (reference)"><JarSelect st={st} value={form.jarId} onChange={v=>setForm(s=>({...s,jarId:v}))} allowEmpty/></Field>
      {form.total>0&&form.periods>0&&<p className="mut" style={{fontSize:13,margin:0}}>
        Per period: <b className="mono" style={{color:'var(--ink)'}}>{money(form.total/form.periods)} ₫</b></p>}
    </Sheet>}
  </div>);
}
