'use client';

import { useState, useEffect, useRef } from 'react';
import { I } from './components/Icon';
import { TxSheet } from './components/TxSheet';
import { CalendarScreen } from './components/screens/CalendarScreen';
import { CloseMonth } from './components/screens/CloseMonth';
import { Installments } from './components/screens/Installments';
import { JarsScreen } from './components/screens/JarsScreen';
import { LoansPage } from './components/screens/LoansPage';
import { PlanSetup } from './components/screens/PlanSetup';
import { ReportScreen } from './components/screens/ReportScreen';
import { Sheet } from './components/ui';
import { ask, setAsk } from './lib/ask';
import { loanStat } from './lib/derive';
import { dstr, mLabelLong, money, shiftYm, ymOf } from './lib/format';
import { emptyState, migrate, parseBackup, seed } from './lib/state';
import { loadState, saveState, wipe } from './lib/storage';

const TABS=[
  {k:'jars',n:'Categories',i:'wallet'},
  {k:'cal',n:'Calendar',i:'cal'},
  {k:'add',n:'Add',i:'plus'},
  {k:'rep',n:'Report',i:'chart'},
  {k:'plan',n:'Installments',i:'card'},
];

export default function App(){
  const [st,setSt]=useState(null);
  const [tab,setTab]=useState('jars');
  const [ym,setYm]=useState(ymOf(new Date()));
  const [tx,setTx]=useState(null);
  const [msg,setMsg]=useState(null);
  const [cfg,setCfg]=useState(false);
  const [box,setBox]=useState(null);
  const [catId,setCatId]=useState(null);
  const [closing,setClosing]=useState(false);
  const [planPage,setPlanPage]=useState(false);
  const [loanPage,setLoanPage]=useState(false);
  const tt=useRef(null);
  const fileRef=useRef(null);

  /* cancelled-guard để effect an toàn với StrictMode (gọi 2 lần trong dev).
     Không có nó, lần chạy thứ nhất và thứ hai đều seed() với uid random khác
     nhau rồi đua nhau ghi vào storage. */
  useEffect(()=>{
    let cancelled=false;
    (async()=>{const s=await loadState();if(!cancelled)setSt(migrate(s||seed()))})();
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{if(st)saveState(st)},[st]);
  useEffect(()=>{setAsk((msg,onOk,okLabel)=>setBox({msg,onOk,okLabel:okLabel||'Delete'}));
    return()=>{setAsk(null)}},[]);

  const set=fn=>setSt(prev=>{const d=JSON.parse(JSON.stringify(prev));fn(d);return d});
  const toast=t=>{setMsg(t);clearTimeout(tt.current);tt.current=setTimeout(()=>setMsg(null),2200)};
  const openTx=t=>setTx(t||{});

  const restoreBackup=async e=>{
    const f=e.target.files&&e.target.files[0];
    e.target.value='';                       // reset để chọn lại cùng file vẫn kích hoạt onChange
    if(!f)return;
    let next;
    try{ next=parseBackup(await f.text()) }
    catch(err){ toast(err.message); return }
    const n=next.txns.length;
    ask('Restore '+n+' transaction'+(n===1?'':'s')+' from this file? Everything you have now will be replaced.',()=>{
      setSt(next); setCfg(false); setTab('jars'); setCatId(null); toast('Backup restored');
    },'Restore');
  };

  if(!st)return <div className="empty" style={{paddingTop:120}}>Loading…</div>;

  const catJar=catId?st.jars.find(x=>x.id===catId):null;
  const sub=!!catJar||closing||planPage||loanPage;
  const subTitle=closing?('Close '+mLabelLong(ym))
    :planPage?'Plan template':loanPage?'Money I lent':(catJar?catJar.name:'');
  const leaveSub=()=>{setCatId(null);setClosing(false);setPlanPage(false);setLoanPage(false)};
  const go=k=>{
    setCatId(null); setClosing(false); setPlanPage(false); setLoanPage(false);
    if(k==='add') openTx({date: ymOf(new Date())===ym ? dstr(new Date()) : ym+'-01'});
    else setTab(k);
  };
  const Screen={jars:JarsScreen,cal:CalendarScreen,rep:ReportScreen,plan:Installments}[tab];

  return (
    <div className="app">
      <nav className="rail">
        <div className="brand" style={{padding:'6px 12px 14px'}}>
          <span style={{width:26,height:26,borderRadius:8,background:'var(--indigo)',color:'#fff',display:'grid',placeItems:'center'}}>
            <I n="book" s={15}/></span>
          Ledger
        </div>
        {TABS.filter(t=>t.k!=='add').map(t=>(
          <button key={t.k} className={'rb'+(tab===t.k&&!sub?' on':'')} onClick={()=>go(t.k)}>
            <I n={t.i} s={18}/>{t.n}</button>
        ))}
        <button className="rb add" onClick={()=>go('add')}><I n="plus" s={18}/>Add transaction</button>
        <div className="grow"/>
        <button className="rb" onClick={()=>setCfg(true)}><I n="cog" s={18}/>Data</button>
      </nav>

      <main className={'main'+(sub?' sub':'')}>
        <div className="topbar"><div className="topbar-in">
          {sub ? (<>
            <button className="iconbtn" onClick={leaveSub} aria-label="Back">
              <I n="left" s={17}/></button>
            <div className="topbar-t">{subTitle}</div>
          </>) : (<>
            <div className="brand only-mob">
              <span style={{width:24,height:24,borderRadius:7,background:'var(--indigo)',color:'#fff',display:'grid',placeItems:'center'}}>
                <I n="book" s={14}/></span>Ledger
            </div>
            <div className="mswitch">
              <button onClick={()=>setYm(y=>shiftYm(y,-1))} aria-label="Previous month"><I n="left" s={15}/></button>
              <span className="lbl">{mLabelLong(ym)}</span>
              <button onClick={()=>setYm(y=>shiftYm(y,1))} aria-label="Next month"><I n="right" s={15}/></button>
            </div>
            <button className="iconbtn" onClick={()=>setCfg(true)} aria-label="Data"><I n="cog" s={16}/></button>
          </>)}
        </div></div>

        {closing
          ? <CloseMonth st={st} set={set} ym={ym} setYm={setYm} toast={toast}
              onDone={()=>setClosing(false)}/>
          : planPage
          ? <PlanSetup st={st} set={set} toast={toast}/>
          : loanPage
          ? <LoansPage st={st} set={set} toast={toast}/>
          : <Screen st={st} set={set} ym={ym} setYm={setYm} toast={toast} openTx={openTx}
              catId={catId} setCatId={setCatId} openClose={()=>setClosing(true)}/>}
      </main>

      {!sub && <nav className="nav">
        {TABS.map(t=>t.k==='add'
          ? <button key={t.k} className="fab" onClick={()=>go('add')} aria-label="Add transaction"><i><I n="plus" s={23}/></i></button>
          : <button key={t.k} className={tab===t.k?'on':''} onClick={()=>go(t.k)}>
              <I n={t.i} s={20}/>{t.n}</button>)}
      </nav>}

      {tx&&<TxSheet st={st} set={set} tx={tx} onClose={()=>setTx(null)} toast={toast}/>}
      {msg&&<div className="toast">{msg}</div>}

      {box&&<>
        <div className="scrim" style={{zIndex:70}} onClick={()=>setBox(null)}/>
        <div className="confirm-box" role="alertdialog" aria-modal="true">
          <p>{box.msg}</p>
          <div style={{display:'flex',gap:8}}>
            <button className="btn gho grow" onClick={()=>setBox(null)}>Cancel</button>
            <button className="btn dan grow" autoFocus
              onClick={()=>{const cb=box.onOk;setBox(null);cb()}}>{box.okLabel}</button>
          </div>
        </div>
      </>}

      {cfg&&<Sheet title="Settings" onClose={()=>setCfg(false)}>
        <div className="card" style={{marginBottom:6}}>
          <button className="row" onClick={()=>{setCfg(false);setPlanPage(true)}}>
            <div className="dot n"><I n="list" s={17}/></div>
            <div className="row-b">
              <div className="row-t">Plan template</div>
              <div className="row-s">{st.template.length} items · {money(st.template.reduce((a,b)=>a+b.amount,0))} ₫ per month</div>
            </div>
            <span className="trail"><I n="right" s={16}/></span>
          </button>
          <button className="row" onClick={()=>{setCfg(false);setLoanPage(true)}}>
            <div className="dot n"><I n="lend" s={17}/></div>
            <div className="row-b">
              <div className="row-t">Money I lent</div>
              <div className="row-s">
                {(st.loans||[]).length} loan{(st.loans||[]).length===1?'':'s'}
                {(st.loans||[]).length>0?' · '+money((st.loans||[]).reduce((a,g)=>a+loanStat(g).left,0))+' ₫ still owed':''}
              </div>
            </div>
            <span className="trail"><I n="right" s={16}/></span>
          </button>
        </div>

        <div className="sec-h"><h2>Data</h2></div>
        <div className="card">
          <div className="row"><div className="row-b"><div className="row-t">Transactions</div>
            <div className="row-s">Total records</div></div><div className="amt">{st.txns.length}</div></div>
          <div className="row"><div className="row-b"><div className="row-t">Categories</div>
            <div className="row-s">Across {st.accounts.length} accounts</div></div><div className="amt">{st.jars.length}</div></div>
          <div className="row"><div className="row-b"><div className="row-t">Installments</div>
            <div className="row-s">Being tracked</div></div><div className="amt">{st.installments.length}</div></div>
        </div>
        <p className="mut" style={{fontSize:12.5}}>Your data stays on this device. Nothing is sent anywhere.</p>
        <button className="btn gho blk" style={{marginBottom:9}} onClick={()=>{
          const blob=new Blob([JSON.stringify(st,null,2)],{type:'application/json'});
          const a=document.createElement('a');a.href=URL.createObjectURL(blob);
          a.download='ledger-'+dstr(new Date())+'.json';a.click();
        }}>Download backup (.json)</button>
        <input ref={fileRef} type="file" accept="application/json,.json"
          style={{display:'none'}} onChange={restoreBackup}/>
        <button className="btn gho blk" style={{marginBottom:9}}
          onClick={()=>fileRef.current&&fileRef.current.click()}>Restore from backup (.json)</button>
        <button className="btn gho blk" style={{marginBottom:9}}
          onClick={()=>ask('Load sample data? Everything you have now will be replaced.',()=>{
            setSt(seed());setCfg(false);toast('Sample data loaded');
          },'Load')}>Load sample data</button>
        <button className="btn dan blk"
          onClick={()=>ask('Erase all data and start fresh? This cannot be undone.',async()=>{
            await wipe();setSt(emptyState());setCfg(false);setTab('jars');toast('All data erased');
          },'Erase')}>Erase everything</button>
      </Sheet>}
    </div>
  );
}
