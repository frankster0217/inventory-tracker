import {createDemo,knownProducts,products,suppliers} from './data.mjs';
import {demoConsolidate,readSnapshot,receiptDraft,runReceiptPreview,supplierName,totalUnits,validateImport} from './model.mjs';
import {drawerModel} from './drawers.mjs?v=20261109-inventory';
import {button,escape,icon,initialFilter,moduleInventory,modules,openAttrs,recordLink,shippingRows,sourceForReceiving,views} from './views.mjs?v=20261109-inventory';

import {feedDrawer,feedSearch,feedView} from './feeds.mjs?v=20261109-inventory';
import {SUPABASE_URL,PUBLIC_KEY,loadInventoryCatalog} from '../src/data.mjs?v=20261109-inventory';
import {number} from '../src/core.mjs';

const demo=createDemo();
const $=id=>document.getElementById(id);
const main=$('main'),drawer=$('drawer'),search=$('search-dialog');
const liveMode=location.protocol==='https:'&&new URLSearchParams(location.search).get('demo')!=='1';
const state={
  liveMode,feed:{status:'loading',rows:[],error:null},stock:{items:[],importedAt:null,error:null},
  localPreview:['127.0.0.1','localhost'].includes(location.hostname),
  view:views[location.hash.slice(1)]?location.hash.slice(1):'dashboard',
  filter:liveMode?'all':initialFilter(location.hash.slice(1)),query:'',sort:'sku',channel:'',category:'',page:1,gallery:liveMode?'table':'gallery',inventoryMode:'demo',
  snapshot:null,snapshotItems:[],snapshotError:null,products,selected:{inventory:new Set(),shipping:new Set(),parcels:new Set()},
  ledger:new Map(),collapsed:false,
};
if(state.view==='shipping')state.sort='deadline';

const brandMark=`<span class="brand-mark">${icon('mark')}</span>`;
const openButton=(label,glyph,kind)=>`<button class="icon-btn" aria-label="${label}" title="${label}" ${openAttrs(kind,'')}>${icon(glyph)}${kind==='notifications'?'<span class="notice-dot"></span>':''}</button>`;
function renderShell(){
  document.querySelector('.shell').classList.toggle('collapsed',state.collapsed);
  const active=key=>state.view===key?'aria-current="page"':'';
  const previewLabel=liveMode?'私人資料':'示例資料';
  $('sidebar').innerHTML=`<a class="brand" href="#dashboard" data-go="dashboard" aria-label="Portolink Operations 首頁">${brandMark}<span class="brand-text"><span class="brand-name">Portolink</span><span class="brand-sub">Operations</span></span></a>
    <nav class="side-links" aria-label="主導覽">
    ${modules.map(([key,label])=>`<button class="side-link" type="button" data-go="${key}" aria-label="${label}" title="${label}" ${active(key)}>${icon(key)}<span class="side-copy">${label}</span></button>`).join('')}</nav>
    <div class="side-end"><button class="side-link side-collapse" data-action="sidebar" aria-label="${state.collapsed?'展開側邊欄':'收合側邊欄'}" aria-expanded="${!state.collapsed}">${icon('collapse')}<span class="side-copy">收合側邊欄</span></button>
    <span class="side-company">PORTO 3C / VOICity</span></div>`;
  $('topbar').innerHTML=`<a class="top-brand" href="#dashboard" data-go="dashboard" aria-label="Portolink 首頁">${brandMark}Portolink</a>
    <button class="search-trigger" type="button" data-action="search" aria-label="全域搜尋">${icon('search')}<span>全域搜尋</span><kbd>⌘ K</kbd></button>
    <div class="top-actions"><button class="source-label" ${openAttrs('sources','')} aria-label="${previewLabel} · 查看來源"><i></i>${previewLabel}</button>${openButton('通知','bell','notifications')}</div>`;
  const order=['dashboard','inventory','purchase','shipping'];
  $('mobile-nav').innerHTML=order.map(key=>{
    const [,label,,short]=modules.find(x=>x[0]===key);
    return `<button type="button" data-go="${key}" ${active(key)} aria-label="${label}">${icon(key)}${short}</button>`;
  }).join('')+`<button type="button" ${openAttrs('more','')} ${['parcels','receiving'].includes(state.view)?'aria-current="page"':''}>${icon('more')}更多</button>`;
}
function renderMain(){
  const sameView=main.dataset.view===state.view;
  const openDetails=new Set(sameView?[...main.querySelectorAll('details[open][data-disclosure]')].map(el=>el.dataset.disclosure):[]);
  main.dataset.view=state.view;
  main.innerHTML=liveMode?feedView(state.view,state):views[state.view](state,demo);
  for(const el of main.querySelectorAll('details[data-disclosure]'))el.open=openDetails.has(el.dataset.disclosure);
}
function render(){renderShell();renderMain();}
function closePanels(){
  if(drawer.open)drawer.close();
  if(search.open)search.close();
  drawer.replaceChildren();
  search.replaceChildren();
}
function navigate(view,filter=liveMode?'all':initialFilter(view),options={}){
  if(!views[view])return;
  closePanels();
  state.view=view;
  Object.assign(state,{filter,query:'',category:'',channel:'',page:1,sort:view==='shipping'?'deadline':'sku'});
  if(view==='inventory'&&options.snapshot)state.inventoryMode='snapshot';
  if(view==='inventory'&&['low','immediate','replenish','incoming','zero','sufficient'].includes(filter))state.inventoryMode='demo';
  if(location.hash!=='#'+view)history.pushState(null,'','#'+view);
  render();
  main.focus({preventScroll:true});
  window.scrollTo({top:0});
}
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'dashboard'));

function renderDrawer(kind,id){
  const content=liveMode&&['feed','sources','notifications'].includes(kind)
    ?feedDrawer(kind==='feed'?id:'sources',state):drawerModel(kind,id,state,demo);
  if(!content)return;
  const alreadyOpen=drawer.open;
  if(search.open)search.close();
  drawer.innerHTML=`<header class="drawer-head"><div><p class="overline">${escape(content.eyebrow)}</p><h2 id="drawer-title">${escape(content.title)}</h2></div><button class="icon-btn" type="button" data-action="close-drawer" aria-label="關閉明細">${icon('close')}</button></header><div class="drawer-content"><p class="drawer-feedback" role="status" hidden></p>${content.body}</div>`;
  if(!alreadyOpen)drawer.showModal();
  else drawer.scrollTo({top:0});
  drawer.querySelector('[data-action="close-drawer"]').focus({preventScroll:true});
}
for(const panel of [drawer,search]){
  panel.addEventListener('click',ev=>{if(ev.target===panel){const box=panel.getBoundingClientRect();if(ev.clientX<box.left||ev.clientX>box.right||ev.clientY<box.top||ev.clientY>box.bottom)panel.close();}});
}

function searchIndex(){
  if(liveMode)return [
    ...state.stock.items.map(p=>({label:p.sku,detail:p.name,glyph:'inventory',kind:'inventory-live',id:p.sku})),
    ...feedSearch(state),
  ];
  return [
    ...products.map(p=>({label:p.sku,detail:p.brand+' · '+p.name+' · 示例',sku:p.sku,kind:'product',id:p.sku})),
    ...demo.purchase.map(o=>({label:o.id,detail:o.source+' · '+supplierName(o.supplier)+' · '+o.lines.map(l=>l.sku).join(' '),glyph:'purchase',kind:'purchase',id:o.id})),
    ...demo.shipping.map(o=>({label:o.id,detail:o.source+' · '+o.brand+' · '+o.lines.map(l=>l.sku).join(' '),glyph:'shipping',kind:'shipping',id:o.id})),
    ...demo.parcels.map(p=>({label:p.waybill,detail:p.id+' · '+p.po+' · '+p.lines.map(l=>l.sku).join(' '),glyph:'parcels',kind:'parcel',id:p.id})),
    ...demo.batches.map(p=>({label:p.id,detail:p.waybill??'未有台灣運單',glyph:'parcels',kind:'batch',id:p.id})),
    ...demo.receiving.map(r=>({label:r.id,detail:r.ref+' · '+r.lines.map(l=>l.sku).join(' '),glyph:'receiving',kind:'receiving',id:r.id})),
    ...suppliers.map(s=>({label:s.name,detail:s.channels+' · 供應商示例',glyph:'purchase',kind:'supplier',id:s.id})),
    ...state.snapshotItems.map(p=>({label:p.sku,detail:p.name+' · 庫存快照',glyph:'inventory',kind:'snapshot',id:p.sku})),
  ];
}
function showResults(value){
  const key=value.trim().toLocaleLowerCase();
  const found=key?searchIndex().filter(row=>(row.label+' '+row.detail).toLocaleLowerCase().includes(key))
    .sort((a,b)=>Number(b.label.toLowerCase()===key)-Number(a.label.toLowerCase()===key)).slice(0,12):[];
  $('search-results').innerHTML=found.length?found.map(recordLink).join(''):
    `<div class="panel-pad muted">${key?'沒有符合的紀錄。':'輸入 SKU、採購單、供應商或物流單號。'}</div>`;
}
function openSearch(){
  if(search.open){$('global-query').focus();return;}
  if(drawer.open)drawer.close();
  search.innerHTML=`<header class="drawer-head"><div><p class="overline">GLOBAL SEARCH</p><h2 id="search-title">全域搜尋</h2></div><button class="icon-btn" data-action="close-search" aria-label="關閉搜尋">${icon('close')}</button></header>
    <div class="panel-pad"><input class="field" id="global-query" type="search" placeholder="例：MF296R 或 KK-DEMO-24" aria-label="搜尋全部工作區"></div><div id="search-results" class="search-results"></div>`;
  showResults('');
  search.showModal();
  $('global-query').focus();
}

let toastTimer;
function announce(message){
  const toast=drawer.open?drawer.querySelector('.drawer-feedback'):$('toast');
  toast.textContent=message;
  toast.hidden=false;
  clearTimeout(toastTimer);
  if(!drawer.open)toastTimer=setTimeout(()=>{toast.hidden=true;},4000);
}
const csvValue = value => {
  const text=String(value??'');
  const protectedText=typeof value==='string'&&/^[=+\-@\t\r]/.test(text)?"'"+text:text;
  return '"'+protectedText.replaceAll('"','""')+'"';
};
function download(filename,data,mime){
  const url=URL.createObjectURL(new Blob([data],{type:mime}));
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const csv=(filename,rows)=>download(filename,'\uFEFF'+rows.map(row=>row.map(csvValue).join(',')).join('\r\n'),'text/csv;charset=utf-8');
const inboundHeader=['單號','商品編號','商品名稱','規格','位置','數量','明細備註'];

const actions={
  'refresh-feed':()=>void refreshFeed(),
  sidebar:()=>{state.collapsed=!state.collapsed;renderShell();$('sidebar').querySelector('[data-action="sidebar"]').focus();},
  search:openSearch,
  'close-drawer':()=>drawer.close(),
  'close-search':()=>search.close(),
  'clear-inventory-filters':()=>{Object.assign(state,{filter:'all',category:'',page:1});renderMain();$('view-query').focus({preventScroll:true});},
  consolidate:()=>{
    const batch=demoConsolidate(demo,state.selected.parcels);
    if(!batch){announce('請選取至少兩個已到漳州、尚未合箱的包裹。');return;}
    state.selected.parcels.clear();
    renderMain();
    demo.activity.unshift({time:'11:20',title:'本機合箱演練已建立',detail:batch.parcels.length+' 個包裹 · '+batch.id,icon:'parcels',ref:['batch',batch.id]});
    renderDrawer('batch',batch.id);
  },
  'record-inbound':button=>{
    const record=demo.receiving.find(x=>x.id===button.dataset.id);
    if(!record)return;
    const result=runReceiptPreview(record,sourceForReceiving(record,demo),state.ledger);
    if(result.ok){
      demo.activity.unshift({time:'11:20',title:'本機入庫提交成功',detail:record.id+' · '+totalUnits(record.lines)+' 件',icon:'receiving',ref:['receiving',record.id]});
      renderMain();
      renderDrawer('receiving',record.id);
    }
    announce(result.message);
  },
  'export-inbound':button=>{
    const record=demo.receiving.find(x=>x.id===button.dataset.id);
    if(!record)return;
    const draft=receiptDraft(record,sourceForReceiving(record,demo));
    if(!draft.allowed){announce(draft.reason);return;}
    csv('preview-'+record.id+'-inbound.csv',[inboundHeader,...draft.rows]);
  },
  'export-labels':()=>{
    const rows=demo.shipping.filter(x=>state.selected.shipping.has(x.id));
    csv('preview-shipping-label-review.csv',[['店家','通路','訂單','標籤狀態','3PL 提交','異常'],...rows.map(x=>[x.brand,x.source,x.id,x.label,x.handoff,x.error])]);
  },
  'export-inventory':()=>{
    const rows=moduleInventory(state,demo).filter(x=>state.selected.inventory.has(x.sku));
    csv('preview-inventory-'+state.inventoryMode+'.csv',[['資料來源','商品編號','商品名稱','現有庫存'],...rows.map(x=>[x.source,x.sku,x.name,x.stock])]);
  },
  'import-template':()=>download('preview-shipping-import.json',JSON.stringify([{id:'ES-DEMO-710',source:'EasyStore',brand:'VOICity',lines:[{sku:'HT813',qty:2}]}],null,2),'application/json'),
};
document.addEventListener('click',event=>{
  const element=event.target.closest('button,a[data-go]');
  if(!element)return;
  const d=element.dataset;
  if(d.go){event.preventDefault();navigate(d.go,d.jump||(liveMode?'all':initialFilter(d.go)),{snapshot:d.snapshot==='true'});return;}
  if(d.open){renderDrawer(d.open,d.id);return;}
  if(d.action){actions[d.action]?.(element);return;}
  if(d.filter){state.filter=d.filter;state.page=1;renderMain();main.querySelector('[aria-pressed="true"].tab')?.focus({preventScroll:true});return;}
  if(d.gallery){state.gallery=d.gallery;if(['master','channels'].includes(state.filter))state.filter='all';renderMain();return;}
  if(d.inventoryMode){state.inventoryMode=d.inventoryMode;state.selected.inventory.clear();Object.assign(state,{filter:'all',page:1,query:'',category:''});renderMain();return;}
  if(d.categoryButton){state.filter='all';state.category=d.categoryButton;state.page=1;renderMain();return;}
  if(d.page){state.page=Number(d.page);renderMain();return;}
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}
});
function updateQuery(event){
  const input=event.target;
  if(event.isComposing)return;
  if(input.id==='global-query'){showResults(input.value);return;}
  if(input.id!=='view-query'||state.query===input.value)return;
  const start=input.selectionStart,end=input.selectionEnd;
  state.query=input.value;
  state.page=1;
  renderMain();
  const current=$('view-query');
  current.focus({preventScroll:true});
  current.setSelectionRange(start,end);
}
document.addEventListener('input',updateQuery);
document.addEventListener('compositionend',updateQuery);
document.addEventListener('change',async event=>{
  const input=event.target;
  if(input.hasAttribute('data-filter-select')){
    const label=input.getAttribute('aria-label');
    state.filter=input.value;
    state.page=1;
    renderMain();
    [...main.querySelectorAll('[data-filter-select]')].find(x=>x.getAttribute('aria-label')===label)?.focus({preventScroll:true});
    return;
  }
  if(input.id==='import-file'&&input.files[0]){
    const message=$('import-status');
    try{
      if(input.files[0].size>500000)throw new Error('檔案超過範本大小限制。');
      const rows=validateImport(await input.files[0].text(),demo.shipping.map(x=>x.id));
      demo.shipping.push(...rows);
      state.filter='all';
      state.channel='';
      state.query='';
      renderMain();
      message.textContent='已匯入 '+rows.length+' 筆示例。';
    }catch(error){message.textContent=error.message;}
    return;
  }
  if(['channel','category','sort'].includes(input.id)){state[input.id]=input.value;state.page=1;renderMain();return;}
  if(input.dataset.selectVisible==='shipping'){
    for(const order of shippingRows(state,demo)){
      if(input.checked)state.selected.shipping.add(order.id);else state.selected.shipping.delete(order.id);
    }
    renderMain();
    return;
  }
  if(input.dataset.pick){
    const selected=state.selected[input.dataset.pick];
    if(input.checked)selected.add(input.value);else selected.delete(input.value);
    renderMain();
    const option=[...main.querySelectorAll('[data-pick]')].find(el=>el.dataset.pick===input.dataset.pick&&el.value===input.value);
    option?.focus({preventScroll:true});
  }
});
document.addEventListener('submit',event=>{
  const id=event.target.dataset.receive;
  if(!id)return;
  event.preventDefault();
  const record=demo.receiving.find(r=>r.id===id);
  if(!record?.written||record.carrier!=='delivered')return;
  const form=new FormData(event.target);
  const counts=record.lines.map((_,i)=>form.get('qty-'+i));
  if(counts.some(x=>x===null||x===''||!Number.isSafeInteger(Number(x))||Number(x)<0||Number(x)>100000)){announce('請確認每個品項的點收數量。');return;}
  record.actual=Object.fromEntries(record.lines.map((item,i)=>[item.sku,Number(counts[i])]));
  record.status=record.lines.every(item=>record.actual[item.sku]===item.qty)?'received':'mismatch';
  renderMain();
  renderDrawer('receiving',id);
  announce(record.status==='received'?'點收演練完成。':'已記錄數量差異。');
});

let feedClient, feedRequest=0, sessionOwner;
function clearStock(){
  Object.assign(state.stock,{items:[],importedAt:null,error:null});
}
function renderRefreshedStock(){
  if(state.view==='inventory'){
    const field=$('view-query');
    const selection=field&&document.activeElement===field?[field.selectionStart,field.selectionEnd]:null;
    renderMain();
    if(selection&&$('view-query')){
      $('view-query').focus({preventScroll:true});
      $('view-query').setSelectionRange(...selection);
    }
  }
  if(search.open)showResults($('global-query').value);
}
async function refreshStock(request){
  try{
    const {rows,suppliers,archived,importedAt}=await loadInventoryCatalog(feedClient);
    if(request!==feedRequest)return;
    const supplierNames=new Map(suppliers.map(row=>[row.supplier_id,row.name]));
    const archivedNames=new Set(archived.map(row=>row.product_name));
    const items=rows.map(row=>{
      const known=knownProducts.get(row.product_id);
      return {
        sku:row.product_id,name:row.product_name,stock:number(row.quantity),unit:row.unit,
        location:row.location,supplier:supplierNames.get(row.supplier_id),photo:known?.photo,brand:known?.brand,
        archived:row.is_archived??archivedNames.has(row.product_name)
      };
    });
    Object.assign(state.stock,{items,importedAt,error:null});
  }catch{
    if(request!==feedRequest)return;
    state.stock.error=state.stock.items.length?'更新失敗 · 顯示上次讀取的庫存':'庫存讀取失敗，請重新整理。';
  }
  renderRefreshedStock();
}
async function refreshFeed(){
  if(!liveMode)return;
  const request=++feedRequest;
  try{
    if(!window.supabase)throw Error('登入元件載入失敗，請重新整理。');
    if(!feedClient){
      feedClient=window.supabase.createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
      feedClient.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'){
          feedRequest++;
          sessionOwner=null;
          clearStock();
          Object.assign(state.feed,{status:'signed-out',rows:[],error:null});
          closePanels();
          renderMain();
        }else if(event==='SIGNED_IN'&&sessionOwner&&session?.user?.id!==sessionOwner){
          feedRequest++;
          sessionOwner=null;
          clearStock();
          Object.assign(state.feed,{status:'loading',rows:[],error:null});
          closePanels();
          renderMain();
          setTimeout(()=>void refreshFeed(),0);
        }
      });
    }
    const {data:{session},error:sessionError}=await feedClient.auth.getSession();
    if(request!==feedRequest)return;
    if(sessionError)throw Error('無法確認登入狀態，請重新整理。');
    if(!session?.user?.id){
      sessionOwner=null;
      clearStock();
      Object.assign(state.feed,{status:'signed-out',rows:[],error:null});
      closePanels();
      renderMain();
      return;
    }
    if(sessionOwner&&sessionOwner!==session.user.id){
      clearStock();
      Object.assign(state.feed,{status:'loading',rows:[],error:null});
      closePanels();
      renderMain();
    }
    sessionOwner=session.user.id;
    const {data,error}=await feedClient.from('portolink_source_feeds').select('source,observed_at,coverage,records').eq('owner_id',sessionOwner);
    if(request!==feedRequest)return;
    if(error||!Array.isArray(data))throw Error('私人作業資料讀取失敗，請重試。');
    Object.assign(state.feed,{status:'ready',rows:data,error:null});
    if(!data.length){
      clearStock();
      state.stock.error='這個帳號無法讀取私人庫存。';
      closePanels();
    }
    if(state.view==='inventory')renderRefreshedStock();
    else renderMain();
    if(data.length&&(state.view==='inventory'||!state.stock.items.length))await refreshStock(request);
  }catch(error){
    if(request!==feedRequest)return;
    clearStock();
    Object.assign(state.feed,{status:'error',rows:[],error:error.message});
    closePanels();
    renderMain();
  }
}
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id!=='feed-login'||!feedClient)return;
  event.preventDefault();
  const fields=new FormData(form);
  const submit=form.querySelector('button[type=submit]');
  const message=form.querySelector('[role=status]');
  submit.disabled=true;
  message.textContent='登入中…';
  try{
    const {error}=await feedClient.auth.signInWithPassword({email:String(fields.get('email')).trim(),password:String(fields.get('password'))});
    if(error){message.textContent='登入失敗，請檢查庫存工作台帳號和密碼。';return;}
    await refreshFeed();
  }catch{
    message.textContent='暫時無法登入，請重試。';
  }finally{
    form.elements.password.value='';
    submit.disabled=false;
  }
});
if(liveMode){
  window.addEventListener('load',()=>void refreshFeed(),{once:true});
  window.addEventListener('focus',()=>{if(!drawer.open&&!search.open&&state.feed.status==='ready')void refreshFeed();});
}

async function openSnapshot(){
  if(!state.localPreview)return;
  try{
    const result=await fetch('/__preview.json',{cache:'no-store',credentials:'omit'});
    if(!result.ok)throw new Error('本機庫存快照未載入。');
    const snapshot=await result.json();
    if(!Array.isArray(snapshot.items)||!snapshot.items.length)throw new Error('庫存快照格式不符。');
    state.snapshot=snapshot;
    state.snapshotItems=readSnapshot(snapshot);
  }catch(error){state.snapshotError=error.message;}
  if(state.inventoryMode==='snapshot')renderMain();
}
render();
void openSnapshot();
