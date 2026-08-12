'use client';

import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AccountPage } from './components/AccountPage';
import { AuthGate } from './components/AuthGate';
import { I } from './components/Icon';
import { TxSheet } from './components/TxSheet';
import { CalendarScreen } from './components/screens/CalendarScreen';
import { CloseMonth } from './components/screens/CloseMonth';
import { Installments } from './components/screens/Installments';
import { JarsScreen } from './components/screens/JarsScreen';
import { LoansPage } from './components/screens/LoansPage';
import { PlanSetup } from './components/screens/PlanSetup';
import { ReportScreen } from './components/screens/ReportScreen';
import { Brand, Sheet } from './components/ui';
import { ask, setAsk } from './lib/ask';
import { loanStat } from './lib/derive';
import { dstr, mLabelLong, money, shiftYm, ymOf } from './lib/format';
import { auth } from './lib/firebase';
import { emptyState, migrate } from './lib/state';
import {
  loadState, saveState, flushSave, cancelPendingSave, setSaveErrorHandler,
} from './lib/storage';

const TABS=[
  {k:'jars',n:'Categories',i:'wallet'},
  {k:'cal',n:'Calendar',i:'cal'},
  {k:'add',n:'Add',i:'plus'},
  {k:'rep',n:'Report',i:'chart'},
  {k:'plan',n:'Installments',i:'card'},
];

export default function App(){
  const [user,setUser]=useState(undefined);   // undefined = đang kiểm session · null = chưa đăng nhập
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
  const [accPage,setAccPage]=useState(false);
  const tt=useRef(null);

  const set=fn=>setSt(prev=>{const d=JSON.parse(JSON.stringify(prev));fn(d);return d});
  const toast=t=>{setMsg(t);clearTimeout(tt.current);tt.current=setTimeout(()=>setMsg(null),2200)};
  const openTx=t=>setTx(t||{});

  /* onAuthStateChanged là nguồn sự thật cho trạng thái đăng nhập. Firebase khôi
     phục session từ IndexedDB nên lần gọi đầu có thể chậm vài trăm ms — đó là
     lý do `user` khởi tạo là undefined chứ không phải null: nếu không sẽ nháy
     màn đăng nhập một nhịp rồi mới vào app. */
  useEffect(()=>onAuthStateChanged(auth,u=>{
    setUser(u||null);
    if(!u){ cancelPendingSave(); setSt(null) }   // đăng xuất: đừng để write đang chờ ghi tiếp
  }),[]);

  /* Nạp sổ từ Firestore sau khi biết là ai. Tài khoản mới -> emptyState, mọi
     screen đã có empty state sẵn nên dùng được ngay.
     cancelled-guard cho StrictMode (effect gọi 2 lần trong dev). */
  useEffect(()=>{
    if(!user){ return }
    let cancelled=false;
    (async()=>{
      try{
        const s=await loadState();
        if(!cancelled) setSt(migrate(s||emptyState()));
      }catch(e){
        /* KHÔNG rơi về emptyState ở đây: nếu Firestore lỗi mà ta hiện sổ trống
           thì effect saveState bên dưới sẽ ghi cái sổ trống đó lên, xoá sạch dữ
           liệu thật. Để `st` là null (màn Loading) và báo lỗi. */
        if(!cancelled) toast('Could not load your ledger: '+(e.message||'unknown'));
      }
    })();
    return()=>{cancelled=true};
  },[user]);

  useEffect(()=>{if(st)saveState(st)},[st]);
  useEffect(()=>{setAsk((msg,onOk,okLabel)=>setBox({msg,onOk,okLabel:okLabel||'Delete'}));
    return()=>{setAsk(null)}},[]);

  /* Ghi thất bại phải nhìn thấy được. Im lặng .catch() thì mất mạng sẽ trông
     như đã lưu xong — rất tệ với sổ chi tiêu. */
  useEffect(()=>{
    setSaveErrorHandler(e=>{
      const c=(e&&e.code)||'', m=(e&&e.message)||'';
      toast(c==='permission-denied' ? 'Not saved — permission denied.'
        : /offline|unavailable|network/i.test(c+m) ? 'Not saved — you are offline.'
        : 'Not saved: '+(m||'unknown error'));
    });
    return()=>setSaveErrorHandler(null);
  },[]);

  /* Thao tác cuối cùng còn nằm trong debounce 700ms sẽ mất nếu đóng tab ngay. */
  useEffect(()=>{
    const onHide=()=>{ if(document.visibilityState==='hidden') flushSave() };
    document.addEventListener('visibilitychange',onHide);
    window.addEventListener('pagehide',flushSave);
    return()=>{
      document.removeEventListener('visibilitychange',onHide);
      window.removeEventListener('pagehide',flushSave);
    };
  },[]);

  /* flushSave TRƯỚC khi signOut: sau khi đăng xuất thì stateRef() không còn
     currentUser để ghi, thao tác cuối trong debounce sẽ mất im lặng. */
  const doSignOut=async()=>{
    await flushSave();
    setCfg(false); setTab('jars'); setCatId(null);
    setClosing(false); setPlanPage(false); setLoanPage(false); setAccPage(false);
    await signOut(auth);
  };


  if(user===undefined)return <div className="empty" style={{paddingTop:120}}>Loading…</div>;
  if(!user)return <AuthGate/>;
  if(!st)return <div className="empty" style={{paddingTop:120}}>Loading…</div>;

  const catJar=catId?st.jars.find(x=>x.id===catId):null;
  const sub=!!catJar||closing||planPage||loanPage||accPage;
  const subTitle=closing?('Close '+mLabelLong(ym))
    :planPage?'Plan template':loanPage?'Money I lent':accPage?'Account'
    :(catJar?catJar.name:'');
  const leaveSub=()=>{setCatId(null);setClosing(false);setPlanPage(false);setLoanPage(false);setAccPage(false)};
  const go=k=>{
    setCatId(null); setClosing(false); setPlanPage(false); setLoanPage(false); setAccPage(false);
    if(k==='add') openTx({date: ymOf(new Date())===ym ? dstr(new Date()) : ym+'-01'});
    else setTab(k);
  };
  const Screen={jars:JarsScreen,cal:CalendarScreen,rep:ReportScreen,plan:Installments}[tab];

  return (
    <div className="app">
      <nav className="rail">
        <div className="brand" style={{padding:'6px 12px 14px'}}><Brand size={26}/></div>
        {TABS.filter(t=>t.k!=='add').map(t=>(
          <button key={t.k} className={'rb'+(tab===t.k&&!sub?' on':'')} onClick={()=>go(t.k)}>
            <I n={t.i} s={18}/>{t.n}</button>
        ))}
        <button className="rb add" onClick={()=>go('add')}><I n="plus" s={18}/>Add transaction</button>
        <div className="grow"/>
        <button className="rb" onClick={()=>setCfg(true)}><I n="cog" s={18}/>Settings</button>
      </nav>

      <main className={'main'+(sub?' sub':'')}>
        <div className="topbar"><div className="topbar-in">
          {sub ? (<>
            <button className="iconbtn" onClick={leaveSub} aria-label="Back">
              <I n="left" s={17}/></button>
            <div className="topbar-t">{subTitle}</div>
          </>) : (<>
            <div className="brand only-mob"><Brand size={24}/></div>
            <div className="mswitch">
              <button onClick={()=>setYm(y=>shiftYm(y,-1))} aria-label="Previous month"><I n="left" s={15}/></button>
              <span className="lbl">{mLabelLong(ym)}</span>
              <button onClick={()=>setYm(y=>shiftYm(y,1))} aria-label="Next month"><I n="right" s={15}/></button>
            </div>
            <button className="iconbtn" onClick={()=>setCfg(true)} aria-label="Settings"><I n="cog" s={16}/></button>
          </>)}
        </div></div>

        {closing
          ? <CloseMonth st={st} set={set} ym={ym} setYm={setYm} toast={toast}
              onDone={()=>setClosing(false)}/>
          : planPage
          ? <PlanSetup st={st} set={set} toast={toast}/>
          : loanPage
          ? <LoansPage st={st} set={set} toast={toast}/>
          : accPage
          ? <AccountPage user={user} toast={toast}/>
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
          <button className="row" onClick={()=>{setCfg(false);setAccPage(true)}}>
            <div className="dot n"><I n="key" s={17}/></div>
            <div className="row-b">
              <div className="row-t">Account</div>
              <div className="row-s">{user.email}</div>
            </div>
            <span className="trail"><I n="right" s={16}/></span>
          </button>
        </div>

        <button className="btn gho blk" style={{marginTop:9}}
          onClick={()=>ask('Sign out?',doSignOut,'Sign out')}>Sign out</button>
      </Sheet>}
    </div>
  );
}
