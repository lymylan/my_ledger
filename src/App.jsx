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
import { Brand, ErrorScreen, Sheet } from './components/ui';
import { ask, setAsk } from './lib/ask';
import { loanStat } from './lib/derive';
import { dstr, mLabelLong, money, shiftYm, ymOf, ymOfDate } from './lib/format';
import { auth } from './lib/firebase';
import { emptyState, migrate, parseBackup } from './lib/state';
import {
  loadState, loadMonthTxns, saveState, flushSave, resetSession, setSaveErrorHandler,
  setStaleHandler, readableStoreError,
  getTxn, putTxn, deleteTxn, deleteTxns, stripTagFromTxns, loadAllTxns, restoreAll,
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
  const [loadError,setLoadError]=useState(null);
  const [staleErr,setStaleErr]=useState(false);
  const [retry,setRetry]=useState(0);
  const tt=useRef(null);
  const fileRef=useRef(null);
  /* st và ym mới nhất, đọc được từ trong callback async mà không phải đưa chúng
     vào deps của effect (sẽ gây vòng lặp nạp lại). */
  const stRef=useRef(null);
  const ymRef=useRef(ym);

  /* Guard prev: thao tác txn là async, người dùng có thể đăng xuất giữa lúc chờ
     server trả về — khi đó prev đã là null. */
  const set=fn=>setSt(prev=>{if(!prev)return prev;const d=JSON.parse(JSON.stringify(prev));fn(d);return d});
  const toast=t=>{setMsg(t);clearTimeout(tt.current);tt.current=setTimeout(()=>setMsg(null),2200)};
  const openTx=t=>setTx(t||{});

  useEffect(()=>{stRef.current=st},[st]);
  useEffect(()=>{ymRef.current=ym},[ym]);

  /* onAuthStateChanged là nguồn sự thật cho trạng thái đăng nhập. Firebase khôi
     phục session từ IndexedDB nên lần gọi đầu có thể chậm vài trăm ms — đó là
     lý do `user` khởi tạo là undefined chứ không phải null: nếu không sẽ nháy
     màn đăng nhập một nhịp rồi mới vào app. */
  useEffect(()=>onAuthStateChanged(auth,u=>{
    setUser(u||null);
    setLoadError(null);
    setStaleErr(false);
    /* đăng xuất: đừng để write đang chờ ghi tiếp, và xoá luôn rev/lastSaved của
       người vừa thoát để phiên sau không mang theo. */
    if(!u){ resetSession(); stRef.current=null; setSt(null) }
  }),[]);

  /* Nạp sổ từ Firestore sau khi biết là ai. Tài khoản mới -> emptyState, mọi
     screen đã có empty state sẵn nên dùng được ngay.

     Effect này chạy lại KHI ĐỔI THÁNG, vì txns giờ nằm ở subcollection và chỉ
     nạp tháng đang xem. Phần state (accounts/jars/plans/…) chỉ đọc một lần —
     stRef.current đã có nghĩa là khỏi đọc lại.
     cancelled-guard cho StrictMode (effect gọi 2 lần trong dev). */
  useEffect(()=>{
    if(!user){ return }
    let cancelled=false;
    (async()=>{
      try{
        let base=stRef.current;
        if(!base){
          const s=await loadState();
          base=migrate(s||emptyState());
        }
        const txns=await loadMonthTxns(ym);
        /* prev||base: khi đổi tháng phải giữ mọi chỉnh sửa đang có trong bộ nhớ,
           chỉ thay mảng txns. Lấy `base` sẽ quay ngược state về lúc mới nạp. */
        if(!cancelled) setSt(prev=>({...(prev||base),txns}));
      }catch(e){
        /* KHÔNG rơi về emptyState ở đây: nếu Firestore lỗi mà ta hiện sổ trống
           thì effect saveState bên dưới sẽ ghi cái sổ trống đó lên, xoá sạch dữ
           liệu thật. Giữ st=null và hiện màn báo lỗi có nút thử lại.
           Đổi tháng mà query hỏng cũng vào đây: thà báo lỗi còn hơn hiện giao
           dịch tháng cũ dưới nhãn tháng mới — đọc sai số dư rồi ghi sai theo. */
        if(!cancelled) setLoadError(e);
      }
    })();
    return()=>{cancelled=true};
  },[user,ym,retry]);

  /* saveState tự bỏ qua khi payload không đổi, nên effect này chạy mỗi lần đổi
     tháng cũng không sinh write thừa. */
  useEffect(()=>{if(st)saveState(st)},[st]);
  useEffect(()=>{setAsk((msg,onOk,okLabel)=>setBox({msg,onOk,okLabel:okLabel||'Delete'}));
    return()=>{setAsk(null)}},[]);

  /* Ghi thất bại phải nhìn thấy được. Im lặng .catch() thì mất mạng sẽ trông
     như đã lưu xong — rất tệ với sổ chi tiêu. */
  useEffect(()=>{
    setSaveErrorHandler(e=>toast('Not saved — '+readableStoreError(e)));
    return()=>setSaveErrorHandler(null);
  },[]);

  /* Xung đột rev: nơi khác đã ghi bản mới hơn. storage.js đã ngừng ghi hẳn —
     ở đây chặn luôn cả UI, vì mọi thao tác tiếp theo đều dựa trên state cũ. */
  useEffect(()=>{
    setStaleHandler(()=>setStaleErr(true));
    return()=>setStaleHandler(null);
  },[]);

  /* ---- ghi giao dịch ----------------------------------------------------
     Mỗi giao dịch là một document riêng, nên ghi thẳng chứ không đi qua debounce
     của state. Thứ tự luôn là SERVER TRƯỚC, bộ nhớ sau: ghi hỏng thì không có
     dòng ma nào hiện lên rồi biến mất ở lần mở sau.
     Trả về true/false thay vì ném lỗi — nơi gọi chỉ cần biết có đóng sheet không. */
  const txFail=e=>{toast('Not saved — '+readableStoreError(e));return false};
  const txw={
    get:id=>getTxn(id),
    put:async t=>{
      try{ await putTxn(t) }catch(e){ return txFail(e) }
      set(d=>{
        const i=d.txns.findIndex(x=>x.id===t.id);
        /* Sửa ngày sang tháng khác thì giao dịch phải rời khỏi màn hình hiện tại,
           không thì nó nằm lại dưới nhãn tháng không còn đúng. */
        if(ymOfDate(t.date)!==ymRef.current){ if(i>=0) d.txns.splice(i,1) }
        else if(i>=0) d.txns[i]=t;
        else d.txns.push(t);
      });
      return true;
    },
    del:async id=>{
      try{ await deleteTxn(id) }catch(e){ return txFail(e) }
      set(d=>{d.txns=d.txns.filter(x=>x.id!==id)});
      return true;
    },
    delMany:async ids=>{
      try{ await deleteTxns(ids) }catch(e){ return txFail(e) }
      set(d=>{d.txns=d.txns.filter(x=>!ids.includes(x.id))});
      return true;
    },
    /* Xoá tag khỏi mọi giao dịch — kể cả các tháng không hiển thị, nên phải hỏi
       server chứ không quét mảng trong bộ nhớ như trước. */
    stripTag:async tagId=>{
      try{ await stripTagFromTxns(tagId) }catch(e){ return txFail(e) }
      set(d=>{d.txns.forEach(x=>{x.tagIds=(x.tagIds||[]).filter(id=>id!==tagId)})});
      return true;
    },
  };

  /* ---- backup ------------------------------------------------------------
     Lưới an toàn duy nhất: không có cache offline, và migration/khôi phục đều
     cần một bản nằm ngoài Firestore. Đây là chỗ DUY NHẤT đọc toàn bộ txns
     (tốn N document read) — thao tác thủ công nên chấp nhận được. */
  const downloadBackup=async()=>{
    try{
      const all=await loadAllTxns();
      const base={...st}; delete base.txns;
      const blob=new Blob([JSON.stringify({...base,txns:all},null,2)],{type:'application/json'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='ledger-'+dstr(new Date())+'.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Backup downloaded — '+all.length+' transaction'+(all.length===1?'':'s'));
    }catch(e){ toast('Backup failed — '+readableStoreError(e)) }
  };

  const restoreBackup=async e=>{
    const f=e.target.files&&e.target.files[0];
    e.target.value='';                       // reset để chọn lại cùng file vẫn kích hoạt onChange
    if(!f)return;
    let next;
    try{ next=parseBackup(await f.text()) }
    catch(err){ toast(err.message); return }
    const n=next.txns.length;
    ask('Restore '+n+' transaction'+(n===1?'':'s')+' from this file? Everything you have now will be replaced.',async()=>{
      try{
        const base=await restoreAll(next);
        const txns=await loadMonthTxns(ymRef.current);
        stRef.current=base;
        setSt({...base,txns});
        setCfg(false); setTab('jars'); setCatId(null);
        toast('Backup restored');
      }catch(err){ toast('Restore failed — '+readableStoreError(err)) }
    },'Restore');
  };

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
  /* Chặn trước cả loadError: khi tới đây thì state trong bộ nhớ đã cũ hơn server,
     mọi thao tác tiếp theo đều dựa trên số sai. Reload là lối ra duy nhất. */
  if(staleErr)return <ErrorScreen
    title="Your ledger changed somewhere else"
    message="Another tab or device saved a newer version of this ledger."
    hint="To avoid overwriting it, this tab stopped saving. Reload to pick up the newest version — anything you changed here in the last few seconds was not saved."
    onRetry={()=>window.location.reload()} retryLabel="Reload"/>;
  if(loadError)return <ErrorScreen
    title="Could not load your ledger"
    message={readableStoreError(loadError)}
    hint="Nothing was changed. Your data is still on the server — the app just could not read it this time."
    onRetry={()=>{setLoadError(null);setRetry(n=>n+1)}}
    extra={<button className="lnk" style={{display:'block',margin:'14px auto 0'}}
      onClick={doSignOut}>Sign out instead</button>}/>;
  if(!st)return <div className="empty" style={{paddingTop:120}}>Loading your ledger…</div>;

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
          ? <LoansPage st={st} set={set} txw={txw} toast={toast}/>
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

      {tx&&<TxSheet st={st} set={set} txw={txw} tx={tx} ym={ym} onClose={()=>setTx(null)} toast={toast}/>}
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

        <div className="sec-h"><h2>Backup</h2></div>
        <button className="btn gho blk" style={{marginBottom:9}}
          onClick={downloadBackup}>Download backup (.json)</button>
        <input ref={fileRef} type="file" accept="application/json,.json"
          style={{display:'none'}} onChange={restoreBackup}/>
        <button className="btn gho blk"
          onClick={()=>fileRef.current&&fileRef.current.click()}>Restore from backup (.json)</button>
        <p className="mut" style={{fontSize:12.5,marginTop:8}}>
          Your ledger lives only on the server — there is no offline copy. A downloaded
          backup is the only thing that survives losing access to this account.</p>

        <button className="btn gho blk" style={{marginTop:14}}
          onClick={()=>ask('Sign out?',doSignOut,'Sign out')}>Sign out</button>
      </Sheet>}
    </div>
  );
}
