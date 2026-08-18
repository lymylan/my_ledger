import { useState, useMemo } from 'react';
import { ask } from '../../lib/ask';
import { ACC_COLORS, ACC_ICONS, accColor, accIcon } from '../../lib/constants';
import { monthSummary, monthTxns } from '../../lib/derive';
import { dstr, mLabelLong, money, pad, shiftYm, uid, ymOf } from '../../lib/format';
import { I } from '../Icon';
import { Field, InlineAdd, MoneyInput, Sheet, TxRow, Vessel, useDragList } from '../ui';

export function CatPage({st,j,ym,d,onEdit,openTx}){
  const acc=st.accounts.find(x=>x.id===j.accountId);
  const list=monthTxns(st,ym)
    .filter(t=>t.jarId===j.id||t.fromJarId===j.id||t.toJarId===j.id)
    .sort((a,b)=>a.date<b.date?1:-1);
  const p=d.open>0?(d.left/d.open)*100:0;
  return (<div style={{paddingTop:2}}>
    <div className="card pad">
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div className="dot" style={{background:accColor(acc),color:'#fff'}}>
          <I n={accIcon(acc)} s={17}/></div>
        <div className="row-t grow" style={{minWidth:0,overflow:'hidden',
          textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{acc?acc.name:''}</div>
        <button className="trail" aria-label={'Edit '+j.name} onClick={onEdit}>
          <I n="edit" s={15}/></button>
      </div>

      <div className="eyebrow" style={{marginTop:13}}>Remaining · {mLabelLong(ym)}</div>
      <div className="num" style={{fontSize:28,fontWeight:800,letterSpacing:'-.032em',
        margin:'1px 0 11px',color:d.left<0?'var(--out)':'var(--ink)'}}>
        {money(d.left)} <span style={{fontSize:14,color:'var(--muted)',fontWeight:600}}>₫</span></div>

      <Vessel pct={p} low={p<15}/>
      <div className="hr"/>

      <div className="figs">
        <div><span className="k">Start</span><b>{money(d.open)}</b></div>
        {d.out>0 && <div><span className="k">Out</span><b className="o">−{money(d.out)}</b></div>}
        {d.in>0 && <div><span className="k">In</span><b className="i">+{money(d.in)}</b></div>}
      </div>
    </div>

    <div className="sec-h"><h2>Transactions</h2>
      <span className="sub">{list.length} this month</span></div>
    <div className="card">
      {list.length===0
        ? <div className="empty"><b>No transactions</b>Nothing recorded for this category this month.</div>
        : list.map(t=><TxRow key={t.id} st={st} t={t} onClick={()=>openTx(t)}/>)}
    </div>

    <div className="fixed-cta">
      <button className="btn pri blk"
        onClick={()=>openTx({date:ymOf(new Date())===ym?dstr(new Date()):ym+'-01',jarId:j.id})}>
        <I n="plus" s={16}/> Add transaction</button>
    </div>
  </div>);
}

/* Một account trong chế độ sắp xếp.

   PHẢI là component chứ không thể là hàm render nội bộ: nó cần useDragList RIÊNG
   cho danh sách category của chính nó, mà hook thì không gọi được trong .map().
   Đúng luôn với rule react/no-unstable-nested-components — xem README §4. */
export function AccountReorderCard({a,i,jars,accDl,onReorderJars}){
  const jarDl=useDragList(jars.map(j=>j.id),onReorderJars);
  return (
    <div {...accDl.row(i,'card')}>
      <div className="ro-acc">
        <span {...accDl.handle(i)} aria-label={'Reorder '+a.name}><I n="grip" s={17}/></span>
        <div className="dot" style={{background:accColor(a),color:'#fff'}}>
          <I n={accIcon(a)} s={16}/></div>
        <div className="row-b">
          <div className="row-t">{a.name}</div>
          <div className="row-s">{jars.length} categor{jars.length===1?'y':'ies'}</div>
        </div>
      </div>
      <div {...jarDl.box}>
        {jars.map((j,k)=>(
          <div key={j.id} {...jarDl.row(k)}>
            <div className="ro-cat">
              <span {...jarDl.handle(k)} aria-label={'Reorder '+j.name}><I n="grip" s={15}/></span>
              <div className="row-t grow" style={{minWidth:0}}>{j.name}</div>
            </div>
          </div>
        ))}
      </div>
      {jars.length===0 && <div className="ro-hint">No categories in this account yet</div>}
    </div>
  );
}

export function JarsScreen({st,set,ym,toast,openTx,catId,setCatId,openClose}){
  const [openAcc,setOpenAcc]=useState(()=>st.accounts.map(a=>a.id));
  const [edit,setEdit]=useState(null);
  const [accForm,setAccForm]=useState(null);
  const [jarForm,setJarForm]=useState(null);
  const [reorder,setReorder]=useState(false);
  const s=useMemo(()=>monthSummary(st,ym),[st,ym]);
  const pageJar=catId?st.jars.find(x=>x.id===catId):null;
  /* Sheet che gần hết màn trên mobile nên mất dấu là đang thêm vào tài khoản
     nào — phải hiện rõ trong sheet. */
  const jarFormAcc=jarForm?st.accounts.find(a=>a.id===jarForm.accountId):null;

  const toggle=id=>setOpenAcc(o=>o.includes(id)?o.filter(x=>x!==id):[...o,id]);

  /* Thứ tự hiển thị CHÍNH LÀ thứ tự mảng — không có field `order` nào cả. Nên sắp
     xếp = sắp lại mảng, và nó tự bền qua saveState. Kèm theo: ledger/meta được
     ghi lại trong cùng transaction (accounts/jars đổi), nên client ngoài đọc meta
     cũng thấy đúng thứ tự người dùng chọn. */
  const reorderAccounts=ids=>set(d=>{
    d.accounts=ids.map(id=>d.accounts.find(a=>a.id===id));
  });

  /* Category của MỘT account, nhưng d.jars là một mảng phẳng trộn mọi account.
     Nên thay tại chỗ đúng các vị trí mà account này đang chiếm, thay vì gom
     lại — gom lại sẽ đổi thứ tự tương đối của category các account khác, thứ mà
     CloseMonth và JarSelect có dùng để hiển thị. */
  const reorderJars=(accId,ids)=>set(d=>{
    const slots=[];
    d.jars.forEach((j,i)=>{ if(j.accountId===accId) slots.push(i) });
    const ordered=ids.map(id=>d.jars.find(j=>j.id===id));
    slots.forEach((pos,k)=>{ d.jars[pos]=ordered[k] });
  });

  const accDl=useDragList(st.accounts.map(a=>a.id),reorderAccounts);

  const saveOpening=(jarId,amount)=>{
    set(d=>{ d.openings[ym]=d.openings[ym]||{}; d.openings[ym][jarId]=amount; });
    setEdit(null); toast('Allocation updated');
  };

  return (<div>
    {pageJar ? <CatPage st={st} j={pageJar} ym={ym} d={s.js[pageJar.id]}
      openTx={openTx}
      onEdit={()=>setEdit({jar:pageJar,amount:s.js[pageJar.id].open})}/> : <>
    <div className="card">
      <button className="row" onClick={openClose}>
        <div className="dot n"><I n="arrow" s={17}/></div>
        <div className="row-b">
          <div className="row-t">Close {mLabelLong(ym)}</div>
          <div className="row-s">Carry balances, add income, allocate {mLabelLong(shiftYm(ym,1))}</div>
        </div>
        <span className="trail"><I n="right" s={16}/></span>
      </button>
    </div>

    <div className="sec-h"><h2>Accounts &amp; categories</h2>
      {st.accounts.length>0 && <button className={'sec-ic'+(reorder?' on':'')}
        aria-pressed={reorder} title={reorder?'Done':'Reorder'}
        aria-label={reorder?'Done reordering':'Reorder accounts and categories'}
        onClick={()=>setReorder(v=>!v)}><I n={reorder?'check':'reorder'} s={15}/></button>}
      {!reorder && <button className="act" onClick={()=>{setAccForm({name:'',kind:'bank',color:ACC_COLORS[0],icon:'bank',cats:[]})}}>+ Add account</button>}</div>

    {reorder && <p className="mut" style={{fontSize:12.5,margin:'-2px 2px 10px'}}>
      Drag the handles to reorder. Accounts move among themselves; categories move
      inside their own account.</p>}

    {st.accounts.length===0 && <div className="card empty"><b>No accounts yet</b>
      Add a bank account or cash wallet to start splitting money into categories.</div>}

    {!reorder && st.accounts.map(a=>{
      const js=st.jars.filter(j=>j.accountId===a.id);
      const tot=js.reduce((x,j)=>({o:x.o+s.js[j.id].open,l:x.l+s.js[j.id].left}),{o:0,l:0});
      const on=openAcc.includes(a.id);
      return (
        <div className="card" key={a.id}>
          <div className="row acc-row">
            <button className="acc-edit" aria-label={'Edit '+a.name} onClick={()=>setAccForm({...a})}>
              <div className="dot" style={{background:accColor(a),color:'#fff'}}>
                <I n={accIcon(a)} s={17}/></div>
              <div className="row-b">
                <div className="acc-name">
                  <span className="row-t">{a.name}</span>
                  <span className="acc-ic"><I n="edit" s={13}/></span>
                </div>
                <div className="row-s">{js.length} categories</div>
              </div>
            </button>
            <button className="acc-toggle" aria-expanded={on}
              aria-label={on?'Collapse categories':'Expand categories'} onClick={()=>toggle(a.id)}>
              <div style={{textAlign:'right'}}>
                <div className="amt" style={{fontSize:15}}>{money(tot.l)}</div>
                <div className="row-s">Remaining</div>
              </div>
              <span className="trail"><I n={on?'up':'dn'} s={17}/></span>
            </button>
          </div>
          {on && <>
            {js.map(j=>{
              const d=s.js[j.id], p=d.open>0?(d.left/d.open)*100:0;
              return (
                <div className="row cat-row" key={j.id} role="button" tabIndex={0}
                  onClick={()=>setCatId(j.id)}
                  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setCatId(j.id)}}}
                  style={{alignItems:'stretch',flexDirection:'column',gap:3}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,width:'100%'}}>
                    <div className="row-t" style={{flex:1,minWidth:0,overflow:'hidden',
                      textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.name}</div>
                    <div className={'amt sub'+(d.left<0?' neg':'')}>{money(d.left)}</div>
                    <button className="trail" aria-label={'Edit '+j.name}
                      onClick={e=>{e.stopPropagation();setEdit({jar:j,amount:d.open})}}><I n="edit" s={14}/></button>
                  </div>
                  <div className="row-s">{[
                    'Start '+money(d.open),
                    d.out?'Out −'+money(d.out):null,
                    d.in?'In +'+money(d.in):null
                  ].filter(Boolean).join(' · ')}</div>
                  <Vessel pct={p} low={p<15}/>
                </div>
              );
            })}
            <div className="row cat-row" style={{gap:8}}>
              <button className="lnk" onClick={()=>setJarForm({accountId:a.id,name:''})}>+ Add category</button>
            </div>
          </>}
        </div>
      );
    })}

    {/* Chế độ sắp xếp dựng lại danh sách ở dạng gọn: bỏ số tiền, vessel, nút sửa,
        và luôn mở hết category. Ít thứ gây nhiễu, và quan trọng hơn là không thể
        vừa kéo vừa bấm nhầm vào chi tiết category. */}
    {reorder && <div {...accDl.box}>
      {st.accounts.map((a,i)=>(
        <AccountReorderCard key={a.id} a={a} i={i} accDl={accDl}
          jars={st.jars.filter(j=>j.accountId===a.id)}
          onReorderJars={ids=>reorderJars(a.id,ids)}/>
      ))}
    </div>}

    </>}

    {/* edit opening */}
    {edit && <Sheet title={'Category · '+edit.jar.name} onClose={()=>setEdit(null)}
      footer={<>
        <button className="btn dan sm" onClick={()=>ask('Delete this category? Linked transactions will lose their link.',()=>{
          set(d=>{d.jars=d.jars.filter(x=>x.id!==edit.jar.id)});setEdit(null);toast('Category deleted');
        })}><I n="trash" s={15}/></button>
        <button className="btn pri grow" onClick={()=>saveOpening(edit.jar.id,edit.amount)}>Save changes</button>
      </>}>
      <Field label="Category name">
        <input className="inp" value={edit.jar.name}
          onChange={e=>{const v=e.target.value;setEdit(s=>({...s,jar:{...s.jar,name:v}}));
            set(d=>{const j=d.jars.find(x=>x.id===edit.jar.id);if(j)j.name=v})}}/>
      </Field>
      <Field label={'Start amount · '+mLabelLong(ym)}>
        <MoneyInput boxed value={edit.amount} onChange={v=>setEdit(s=>({...s,amount:v}))}/>
      </Field>
      <p className="mut" style={{fontSize:12.5,margin:0}}>
        This is the amount allocated to the category this month. Applying the plan <i>adds</i> to this figure.
      </p>
    </Sheet>}

    {accForm && <Sheet title={accForm.id?'Edit account':'Add account'} onClose={()=>setAccForm(null)}
      footer={<>
        {accForm.id && <button className="btn dan sm" onClick={()=>ask('Delete this account and every category inside it?',()=>{
          set(d=>{d.jars=d.jars.filter(j=>j.accountId!==accForm.id);d.accounts=d.accounts.filter(a=>a.id!==accForm.id)});
          setAccForm(null);toast('Account deleted');
        })}><I n="trash" s={15}/></button>}
        <button className="btn pri grow" disabled={!accForm.name.trim()} onClick={()=>{
          const cats=(accForm.cats||[]);
          set(d=>{
            if(accForm.id){const a=d.accounts.find(x=>x.id===accForm.id);
              Object.assign(a,{name:accForm.name.trim(),kind:accForm.kind,color:accColor(accForm),icon:accIcon(accForm)})}
            else {
              const id=uid();
              d.accounts.push({id,name:accForm.name.trim(),kind:accForm.kind,
                color:accColor(accForm),icon:accIcon(accForm)});
              cats.forEach(n=>d.jars.push({id:uid(),accountId:id,name:n}));
            }
          });
          setAccForm(null);
          toast(accForm.id?'Account saved'
            :'Account added'+(cats.length?' with '+cats.length+' categor'+(cats.length>1?'ies':'y'):''));
        }}>Save account</button>
      </>}>
      <Field label="Account name"><input className="inp" autoFocus placeholder="e.g. Vietcombank"
        value={accForm.name} onChange={e=>setAccForm(s=>({...s,name:e.target.value}))}/></Field>
      <Field label="Colour">
        <div className="swatches">
          {ACC_COLORS.map(c=>(
            <button key={c} className={'sw'+(accColor(accForm)===c?' on':'')} style={{background:c}}
              aria-label="Choose colour" onClick={()=>setAccForm(s=>({...s,color:c}))}/>
          ))}
        </div>
      </Field>
      <Field label="Icon">
        <div className="swatches">
          {ACC_ICONS.map(ic=>(
            <button key={ic} className={'sw ic'+(accIcon(accForm)===ic?' on':'')}
              style={accIcon(accForm)===ic?{background:accColor(accForm),color:'#fff',borderColor:accColor(accForm)}:{color:accColor(accForm)}}
              aria-label="Choose icon"
              onClick={()=>setAccForm(s=>({...s,icon:ic}))}><I n={ic} s={18}/></button>
          ))}
        </div>
      </Field>

      {!accForm.id && <>
        <div className="hr"/>
        <Field label="Categories">
          <InlineAdd placeholder="e.g. Food"
            onAdd={n=>setAccForm(s=>({...s,cats:[...(s.cats||[]),n]}))}/>

          {(accForm.cats||[]).length>0 && <div className="card" style={{marginTop:8}}>
            {accForm.cats.map((c,i)=>(
              <div className="row" key={i} style={{padding:'8px 10px',gap:8}}>
                <span className="dot n" style={{width:24,height:24,borderRadius:7,fontSize:11}}>{i+1}</span>
                <div className="row-b"><div className="row-t">{c}</div></div>
                <button className="trail" aria-label={'Remove '+c}
                  onClick={()=>setAccForm(s=>({...s,cats:s.cats.filter((_,k)=>k!==i)}))}>
                  <I n="x" s={14}/></button>
              </div>
            ))}
          </div>}

          <p className="mut" style={{fontSize:12.5,margin:'8px 0 0'}}>
            Optional. Start amounts are set later, per month.</p>
        </Field>
      </>}
    </Sheet>}

    {jarForm && <Sheet title="Add category" onClose={()=>setJarForm(null)}
      footer={<button className="btn pri blk" disabled={!jarForm.name.trim()} onClick={()=>{
        set(d=>{d.jars.push({id:uid(),accountId:jarForm.accountId,name:jarForm.name.trim()})});
        setJarForm(null);toast('Category added');
      }}>Add category</button>}>
      <Field label="Account">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className="dot" style={{background:accColor(jarFormAcc),color:'#fff'}}>
            <I n={accIcon(jarFormAcc)} s={17}/></div>
          <div>
            <div style={{fontWeight:600}}>{jarFormAcc?jarFormAcc.name:'—'}</div>
            <div className="row-s">
              {st.jars.filter(j=>j.accountId===jarForm.accountId).length} categories already
            </div>
          </div>
        </div>
      </Field>
      <Field label="Category name"><input className="inp" autoFocus placeholder="e.g. Food"
        value={jarForm.name} onChange={e=>setJarForm(s=>({...s,name:e.target.value}))}/></Field>
    </Sheet>}
  </div>);
}
