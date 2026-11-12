import {inventoryGroups,needsRestock} from './inventory.mjs?v=20261112-restock-list';
import {categories, demoDay, knownProducts, routes, status, suppliers} from './data.mjs';
import {demoStock, receiptDraft, supplierName, totalUnits} from './model.mjs';

const paths = {
  mark:'<path d="M5 19V5h8a4 4 0 0 1 0 8H9m-4 2h10"/>',
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  inventory:'<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4m-9 4v10m-4-7 2 1"/>',
  shipping:'<path d="M3 5h11v12H3zM14 9h4l3 4v4h-7M3 13H1"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  purchase:'<path d="M3 4h2l3 11h10l3-8H6m4-4h8m-4-2v4"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  parcels:'<path d="m4 7 4-2 4 2v5l-4 2-4-2zM4 7l4 2 4-2m-4 2v5m5-2 4-2 4 2v5l-4 2-4-2zm0 0 4 2 4-2m-4 2v5"/>',
  receiving:'<path d="m3 9 9-5 9 5v11H3zm4 11v-8h10v8M7 16h10"/>',
  search:'<circle cx="10.8" cy="10.8" r="5.8"/><path d="m15 15 5 5"/>',
  bell:'<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4zm5 3a2 2 0 0 0 4 0"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  left:'<path d="m15 6-6 6 6 6"/>',
  collapse:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m7-11-3 3 3 3"/>',
  warning:'<path d="m12 4 9 16H3zM12 10v4m0 3h.01"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  chart:'<path d="M4 20V4m0 16h16M8 15l4-5 3 2 5-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  table:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-18 5h18m-12-5v9"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5m-5 0a8 8 0 0 1 13-6l3 3M4 15l3 3a8 8 0 0 0 13-6"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  download:'<path d="M12 4v12m-5-5 5 5 5-5M4 17v3h16v-3"/>',
  lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  link:'<path d="M7 7h10v10m0-10L6 18"/>',
};
const iconAliases={cart:'purchase',warehouse:'receiving'};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[iconAliases[name]??name]??paths.inventory}</svg>`;
export const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = value => value===null||value===undefined?'—':typeof value==='number'?value.toLocaleString('zh-TW',{maximumFractionDigits:2}):escape(value);
export const chip = (label,tone='gray') => `<span class="status ${tone}"><i class="point"></i>${escape(label)}</span>`;
export const stateChip = value => chip(...(status[value]??['未核實','gray']));
export const openAttrs = (kind,id) => `data-open="${escape(kind)}" data-id="${escape(id)}"`;
const goAttrs = (view,filter='') => `data-go="${view}"${filter?` data-jump="${filter}"`:''}`;
export const button = (label,attrs='',type='',glyph='') => `<button type="button" class="button ${type}" ${attrs}>${glyph?icon(glyph):''}${escape(label)}</button>`;
export const empty = text => `<div class="empty">${escape(text)}</div>`;
export const banner = (text,tone='') => `<div class="banner ${tone}">${icon(tone?'lock':'warning')}<span>${escape(text)}</span></div>`;
export const routeText = route => routes[route]?.[0]??'路線待核對';
export const inventoryButton = () => button('查看庫存','data-go="inventory"','','inventory');
export const photo = (item,cls='thumb') => `<span class="${cls}">${item?.photo?`<img src="./assets/${item.photo}.png" alt="${escape(item.brand+' '+item.sku)}" loading="lazy" decoding="async">`:icon('inventory')}</span>`;
const shortProduct = sku => photo(knownProducts.get(sku));
const prodLink = (sku,kind='product')=>`<button class="link" ${openAttrs(kind,sku)}>${escape(sku)}</button>`;
const rowLink = (label,kind,id) => `<button class="link" ${openAttrs(kind,id)}>${escape(label)}</button>`;
const dateShort = at => new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at));
export const displayTime = dateShort;

export const modules = [
  ['dashboard','總覽','Overview','今日'],
  ['inventory','庫存','Inventory','庫存'],
  ['shipping','出貨','Shipping','出貨'],
  ['purchase','採購','Purchasing','採購'],
  ['parcels','集運','Consolidation','集運'],
  ['receiving','3PL 倉儲','Warehouse','倉儲'],
];
const titles = Object.fromEntries(modules.map(([key,label])=>[key,label]));
const purposes = {
  shipping:'檢查訂單、備妥標籤，再交給 3PL。',
  purchase:'查看供應商、付款和到貨進度。',
  parcels:'追蹤包裹，查看哪些已可集運。',
  receiving:'核對到貨、入庫單與倉庫點收。',
};
export const initialFilter = view => ({shipping:'process',parcels:'ready',receiving:'today'}[view]??'all');

const match = (entry,query) => !query || entry.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
const itemCodes = record => record.lines.map(l=>l.sku).join(' ');
export const moduleInventory = (state,demo) => state.inventoryMode==='snapshot'?state.snapshotItems:state.products.map(product=>demoStock(product,demo));
const inventoryViews = [['all','全部商品'],['categories','商品分類'],['master','商品主檔'],['movement','庫存異動'],['channels','上架通路']];
const stockTabs = [['low','低庫存'],['immediate','立即補貨'],['replenish','建議補貨'],['incoming','採購在途'],['zero','缺貨'],['sufficient','暫不需補貨']];
const stages = (list,current,count) => `<div class="stages" role="group" aria-label="作業狀態">${list.map(([value,label])=>`<button class="tab" type="button" data-filter="${value}" aria-pressed="${current===value}">${label}<span class="tab-count">${count(value)}</span></button>`).join('')}</div>`;
const toggle = (options,current,action) => `<div class="toggle" role="group" aria-label="顯示方式">${options.map(([value,label,glyph])=>`<button data-${action}="${value}" aria-pressed="${current===value}">${glyph?icon(glyph):''}${label}</button>`).join('')}</div>`;
const field = (value,label='搜尋目前清單') => `<label class="search-field">${icon('search')}<input type="text" inputmode="search" class="field" aria-label="${label}" placeholder="${label}" id="view-query" value="${escape(value)}"></label>`;
const select = (id,title,options,current) => `<select id="${id}" class="select" aria-label="${title}">${options.map(([value,label])=>`<option value="${escape(value)}" ${value===current?'selected':''}>${escape(label)}</option>`).join('')}</select>`;
const filterSelect = (label,list,current) => `<select class="select" data-filter-select aria-label="${label}">${list.some(([key])=>key===current)?'':'<option value="" disabled selected>選擇檢視</option>'}${list.map(([value,text])=>`<option value="${value}" ${current===value?'selected':''}>${text}</option>`).join('')}</select>`;
const toolbar = (query,label,controls='',advanced='') => `<div class="work-tools"><div class="filters">${field(query,label)}${controls}</div>${advanced?`<details class="extra-filters" data-disclosure="filters"><summary>篩選與排序</summary><div class="chips">${advanced}</div></details>`:''}</div>`;
const table = (headers,rows,layout='ledger',fields=[]) => `<div class="table-shell card" data-layout="${layout}" role="region" aria-label="資料表" tabindex="0"><table class="table responsive-rows" role="table"><thead role="rowgroup"><tr role="row">${headers.map((h,index)=>`<th role="columnheader" scope="col" data-cell="${fields[index]??''}">${h}</th>`).join('')}</tr></thead><tbody role="rowgroup">${rows.map(row=>`<tr role="row">${row.map((col,index)=>`<td role="cell" data-cell="${fields[index]??''}">${col}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const cardPanel = (title,items,action='') => `<section class="card"><header class="panel-head"><h2>${title}</h2>${action}</header>${items}</section>`;
export function recordLink({label,detail='',glyph='link',sku,kind,id,mark=''}) {
  return `<button class="record-link" ${openAttrs(kind,id)}>${sku?shortProduct(sku):`<span class="kpi-icon">${icon(glyph)}</span>`}<span class="task-text"><strong>${escape(label)}</strong><small>${escape(detail)}</small></span>${mark}${icon('chevron')}</button>`;
}
const tick = (kind,id,state,label) => `${kind==='parcels'?'':'<label class="pick-target">'}<input type="checkbox" aria-label="${escape(label)}" data-pick="${kind}" value="${escape(id)}" ${state.selected[kind].has(id)?'checked':''}>${kind==='parcels'?'':'</label>'}`;
const total = lines => fmt(totalUnits(lines));
const itemCell = lines => `<div class="product-cell">${shortProduct(lines[0]?.sku)}<div class="cell-stack">${lines.map(x=>`<span class="line-item">${prodLink(x.sku)}<span class="line-qty"> ×${fmt(x.qty)}</span></span>`).join('')}</div></div>`;
const sourceForReceiving = (row,demo) => row.kind==='batch'?demo.batches.find(x=>x.id===row.ref):demo.parcels.find(x=>x.id===row.ref);
const titleHeader = (view,tools='') => `<header class="page-head"><div><h1>${titles[view]}</h1>${purposes[view]?`<p>${purposes[view]}</p>`:''}</div>${tools?`<div class="head-tools">${tools}</div>`:''}</header>`;
const actionLink = (label,kind,id) => button(label,`${openAttrs(kind,id)} aria-label="${escape(label+' '+id)}"`,'row-action','chevron');
const recordIdentity = (label,kind,id,detail) => `<div class="cell-stack">${rowLink(label,kind,id)}<small>${escape(detail)}</small></div>`;
export function taskItems(demo) {
  const tasks=[];
  for(const p of demo.receiving.filter(r=>r.status==='announce'&&receiptDraft(r,sourceForReceiving(r,demo)).allowed)){
    const products=p.lines.map(l=>l.sku+' × '+l.qty).join('、');
    const delivery=p.carrier==='delivered'?'今天已送達 3PL':'今天配送至 3PL';
    tasks.push({title:'準備今日入庫單',subtitle:products+' · '+delivery,action:'查看入庫單',mark:delivery,tone:'amber',ref:['receiving',p.id],sku:p.lines[0].sku});
  }
  const shipping=demo.shipping.filter(o=>['hold','label','handoff'].includes(o.status)).sort((a,b)=>(a.due??'99').localeCompare(b.due??'99'));
  for(const p of shipping){
    const hold=p.status==='hold';
    const due=p.due?' · '+p.due.split(' ').at(-1)+' 前':'';
    const [title,mark]=hold?['核對出貨異常',p.error]:p.status==='handoff'?['準備交給 3PL','標籤已備妥']:['下載出貨標籤','待下載'];
    tasks.push({title,subtitle:p.source+' · '+(hold?p.error:p.lines[0].sku)+due,action:'查看訂單',mark,tone:hold?'red':'blue',ref:['shipping',p.id],sku:p.lines[0].sku});
  }
  for(const p of demo.parcels.filter(p=>p.status==='ready'&&!p.batch)) tasks.push({title:'漳州倉包裹待集運',subtitle:p.lines.map(l=>l.sku+' × '+l.qty).join('、')+' · '+p.id,action:'查看包裹',mark:'待集運',tone:'amber',ref:['parcel',p.id],sku:p.lines[0].sku});
  for(const p of demo.receiving.filter(r=>r.status==='warehouse')) tasks.push({title:'確認倉庫點收',subtitle:totalUnits(p.lines)+' 件已送達 · 等待倉庫確認',action:'查看入庫單',mark:'已送達',tone:'green',ref:['receiving',p.id],sku:p.lines[0].sku});
  for(const p of demo.purchase.filter(r=>r.status==='missing')) tasks.push({title:'核對賣家物流單號',subtitle:p.lines[0].sku+' · '+supplierName(p.supplier),action:'查看採購單',mark:'資料缺少',tone:'red',ref:['purchase',p.id],sku:p.lines[0].sku});
  for(const p of demo.purchase.filter(r=>r.status==='payment')) tasks.push({title:'查看待付款採購單',subtitle:p.lines[0].sku+' · '+p.source,action:'查看採購單',mark:'待付款',tone:'amber',ref:['purchase',p.id],sku:p.lines[0].sku});
  return tasks;
}
export function activityRows(demo) {
  return demo.activity.map(a=>`<button class="activity-row" ${openAttrs(...a.ref)}><span class="kpi-icon green">${icon(a.icon)}</span><span class="task-text"><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><time>${a.time}</time></button>`).join('');
}
export function dashboard(state,demo) {
  const tasks=taskItems(demo);
  const arrivals=demo.receiving.filter(r=>r.date===demoDay);
  const stock=state.products.map(p=>demoStock(p,demo));
  const warnings=stock.filter(p=>p.available<=p.threshold).sort((a,b)=>a.available-b.available);
  const summaries=[
    ['出貨待辦',demo.shipping.filter(o=>o.status!=='shipped').length,'shipping','all'],
    ['今日到貨',arrivals.length,'receiving','today'],
    ['待集運',demo.parcels.filter(p=>p.status==='ready').length,'parcels','ready'],
    ['低庫存',warnings.length,'inventory','low'],
  ];
  const taskRow=(task,index)=>`<button class="task-row ${index===0?'priority':''}" ${openAttrs(...task.ref)}>
    ${shortProduct(task.sku)}<span class="task-text">${index===0?'<span class="priority-label">優先處理</span>':''}<strong>${escape(task.title)}</strong><small>${escape(task.subtitle)}</small></span><span class="task-action">${task.action}</span>${icon('chevron')}</button>`;
  return `<div class="today-view">
    <header class="page-head today-head"><div><h1>今日工作</h1><p>11 月 6 日 · 示例作業日</p></div></header>
    <div class="day-summary card" aria-label="今日摘要">${summaries.map(([label,count,view,filter])=>`<button ${goAttrs(view,filter)}>${icon(view)}<span>${label}</span><b>${count}</b></button>`).join('')}</div>
    <section class="card task-list"><header class="panel-head"><h2>需要處理</h2><span class="muted">${tasks.length} 項</span></header>
      ${tasks.length?tasks.slice(0,3).map(taskRow).join(''):empty('目前沒有待辦事項。')}
      ${tasks.length>3?`<details class="task-more" data-disclosure="tasks"><summary>其他 ${tasks.length-3} 項待辦</summary>${tasks.slice(3).map(task=>taskRow(task,1)).join('')}</details>`:''}
    </section>
    <div class="dashboard-grid">
      ${cardPanel('今日到貨',arrivals.map(r=>recordLink({label:r.lines.map(x=>x.sku+' ×'+x.qty).join('、'),detail:status[r.carrier]?.[0]??'待核對',kind:'receiving',id:r.id,sku:r.lines[0].sku})).join('')||empty('沒有今日到貨。'))}
      ${cardPanel('低庫存',warnings.slice(0,2).map(p=>recordLink({label:p.sku,detail:`可用 ${p.available} · 在途 ${p.incoming}`,kind:'product',id:p.sku,sku:p.sku})).join('')||empty('沒有低庫存商品。'),button('查看全部',goAttrs('inventory','low'),'quiet'))}
    </div>
    <details class="card task-more" data-disclosure="activity"><summary>近期作業紀錄</summary>${activityRows(demo)}</details>
    <div class="today-footer">${button('資料來源',openAttrs('sources',''),'quiet','lock')} ${inventoryButton()}</div>
  </div>`;
}

const productStatus = p => p.archived?chip('已封存'):p.service?chip('非庫存項目'):p.source==='snapshot'?chip('庫存快照','blue')
  :p.available===0?chip('缺貨','red'):p.available<=p.threshold?chip('低庫存','amber'):chip('正常','green');
const stockMode = state => state.localPreview
  ? toggle([['demo','示例'],['snapshot','庫存快照']],state.inventoryMode,'inventory-mode')
  : '';
function inventoryTable(rows,state) {
  const snapshot=state.inventoryMode==='snapshot';
  const channels=state.filter==='channels';
  return table(['','商品 / SKU',snapshot?'現有':'可用','在途',channels?'上架平台':'狀態'],rows.map(p=>[
    tick('inventory',p.sku,state,'選取 '+p.sku),
    `<div class="product-cell">${photo(p)}<div class="cell-stack">${prodLink(p.sku,snapshot?'snapshot':'product')}<small>${escape(p.brand??p.name)}</small></div></div>`,
    `<span class="mobile-column">${snapshot?'現有':'可用'} </span>${fmt(snapshot?p.stock:p.available)}`,
    `<span class="mobile-column">在途 </span>${fmt(p.incoming)}`,
    channels?fmt(p.channels?.join(' · ')):productStatus(p)
  ]),'inventory',['pick','identity','available','incoming','status']);
}
function productCard(p) {
  return `<button class="card product-card" ${openAttrs(p.source==='snapshot'?'snapshot':'product',p.sku)}>${photo(p,'photo')}<span class="card-body">
    <span class="product-brand">${fmt(p.brand)}</span><strong class="product-code">${escape(p.sku)}</strong>
    <span class="stats-line"><span><b>${fmt(p.source==='snapshot'?p.stock:p.available)}</b>${p.source==='snapshot'?'現有':'可用'}</span><span><b>${fmt(p.incoming)}</b>在途</span></span>
    ${p.available<=p.threshold||p.archived||p.service?productStatus(p):''}</span></button>`;
}
const pageNav = (count,page,pages) => `<div class="page-nav"><span class="muted">${count} 項商品 · ${page} / ${pages}</span><div class="row-buttons">${button('上一頁',`data-page="${page-1}" ${page<=1?'disabled':''}`,'small','left')}${button('下一頁',`data-page="${page+1}" ${page>=pages?'disabled':''}`,'small','chevron')}</div></div>`;
const stockCount = p => p.stock===null?'待確認':`${fmt(p.stock)}${p.unit?' '+escape(p.unit):''}`;
export const incomingCount = p => p.incoming===null ? (p.recordedIncoming>0?`${fmt(p.recordedIncoming)}+ 待對帳`:'待對帳') : fmt(p.incoming);
export const suggestionCount = p => p.suggestion===null?'—':p.suggestion>0?`<strong class="replenish-number">${fmt(p.suggestion)}</strong>${p.verified?'':'<small class="estimate-label">估算</small>'}`:p.rawNeed>0?`<span class="muted">${fmt(p.rawNeed)} · 未達門檻</span>`:'—';
const inventoryNotice=stock=>{
  if(stock.planError)return `<p class="inventory-notice" role="status">${escape(stock.planError)}</p>`;
  if(!stock.model)return '';
  const issues=[];
  const pending=!stock.model.sources.purchasesComplete;
  const missingSalesTime=!stock.model.sources.sales.timestamp;
  if(pending||missingSalesTime)issues.push(`建議量為估算 · ${pending&&missingSalesTime?'在途及銷售同步時間':pending?'在途':'銷售同步時間'}待核對`);
  if(!stock.model.sources.stock.fresh)issues.push('庫存時間需核對，暫停計算。');
  if(!missingSalesTime&&!stock.model.sources.sales.fresh)issues.push('銷售資料過期，暫停計算。');
  return issues.length?`<p class="inventory-notice">${issues.join(' ')}</p>`:'';
};
const restockSupplierSections=(groups,renderItems,overview=false)=>`<div class="restock-groups">${groups.map((g,index)=>{
  const heading=overview?'h3':'h2',id=`${overview?'overview':'inventory'}-restock-supplier-${index}`;
  return `<section class="restock-supplier" aria-labelledby="${id}"><header class="restock-supplier-head"><${heading} id="${id}">${escape(g.name)}</${heading}><span>${g.items.length} 項商品</span></header>${renderItems(g.items)}</section>`;
}).join('')}</div>`;
export function restockOverview(state) {
  const {items,model,planError}=state.stock;
  const rows=items.filter(needsRestock).sort((a,b)=>Number(b.urgent)-Number(a.urgent)||(a.coverDays??Infinity)-(b.coverDays??Infinity));
  const groups=inventoryGroups(rows);
  return `<section class="card replenishment-overview" aria-label="需補貨"><header class="panel-head"><h2>需補貨 <span class="muted">${items.length?(items.some(p=>p.suggestion!==null)?rows.length+' 項':'—'):'讀取中'}</span></h2>${button('補貨明細','data-go="inventory" data-jump="restock"','','arrow')}</header>
    ${rows.length?restockSupplierSections(groups,items=>items.map(p=>`<button class="record-link" ${openAttrs('inventory-live',p.sku)}>${photo(p)}<span class="task-text"><strong>${escape(p.sku)}</strong><small>現有 ${stockCount(p)} · 在途 ${incomingCount(p)}</small></span><span class="replenishment-action"><span class="replenishment-action-label">建議補</span><span class="replenishment-value">${suggestionCount(p)}</span></span>${icon('chevron')}</button>`).join(''),true):
      `<p class="panel-pad muted">${escape(planError||(!items.length?'正在讀取庫存與銷售…':!model?'補貨資料尚未取得。':!model.sources.stock.fresh||!model.sources.sales.fresh?'資料需要更新，請重新整理。':'目前沒有達到補貨門檻的商品。'))}</p>`}
    ${inventoryNotice(state.stock)}</section>`;
}
export function liveInventory(state) {
  const {items,importedAt,error,cfg}=state.stock;
  if(!items.length)return `<section class="card feed-panel" role="status">${escape(error??'正在讀取庫存…')}</section>`;
  const restock=state.filter==='restock';
  const groups=inventoryGroups(items);
  const scoped=items.filter(p=>state.filter==='all'||(restock?needsRestock(p):state.filter==='archived'?p.archived:!p.archived&&p.stock===0));
  const searched=scoped.filter(p=>match([p.sku,p.name,p.supplier].join(' '),state.query));
  const matchingGroups=inventoryGroups(searched);
  const rows=searched.filter(p=>state.supplier==='all'||state.supplier===p.supplierId)
    .sort((a,b)=>(restock?Number(b.urgent)-Number(a.urgent):0)||(state.sort==='stock'?(a.stock??Infinity)-(b.stock??Infinity):0)||a.sku.localeCompare(b.sku,'zh-TW'));
  const pages=Math.max(1,Math.ceil(rows.length/24)),page=Math.min(state.page,pages);
  const chunk=rows.slice((page-1)*24,page*24);
  const stamp=Date.parse(importedAt);
  const imported=Number.isFinite(stamp)?'庫存匯入 '+dateShort(stamp):'庫存匯入時間未確認';
  const label=p=>p.archived?chip('已封存'):p.urgent?chip('優先補貨','amber'):needsRestock(p)?chip('需補貨','amber'):p.stock===0?chip('缺貨','amber'):'';
  const supplierCards=!restock&&state.supplier==='all'&&!state.query;
  const tabs=`<div class="stages inventory-tabs" role="group" aria-label="庫存檢視">${[['all','全部商品',items.length],['restock','需補貨',items.filter(needsRestock).length],['zero','缺貨',items.filter(p=>!p.archived&&p.stock===0).length],['archived','已封存',items.filter(p=>p.archived).length]].map(([value,title,count])=>`<button class="tab" data-filter="${value}" aria-pressed="${state.filter===value}">${title}<span class="tab-count">${items.some(p=>p.suggestion!==null)||value!=='restock'?count:'—'}</span></button>`).join('')}</div>`;
  const supplierSelect=select('supplier-filter','依供應商篩選',[['all','全部供應商'],...groups.map(g=>[g.id,g.name])],state.supplier);
  const tools=toolbar(state.query,'搜尋品名、SKU 或供應商',supplierSelect,
    toggle([['table','表格','table'],['gallery','圖庫','dashboard']],state.gallery,'gallery')+select('sort','排序',[['sku','SKU 排序'],['stock','庫存由低到高']],state.sort));
  const salesStamp=state.stock.model?.sources.sales.timestamp;
  const meta=`<div class="feed-metadata"><span>${imported}</span><span>讀取 ${dateShort(Date.now())}</span><span>銷售同步 ${salesStamp?dateShort(Date.parse(salesStamp)):'時間未確認'}</span>${error?`<span role="status">${escape(error)}</span>`:''}</div>`;
  const rules=restock?`<details class="restock-rules" data-disclosure="restock-rules"><summary>補貨依據 · 近 60 天銷量</summary><p>目標 ${fmt(cfg?.targetWeeks??4)} 週 + 交期 ${fmt(cfg?.leadTimeDays??4)} 天，預留 10%，扣除現有庫存及已核對在途。最低建議 ${fmt(cfg?.minOrderQty??5)} 件。</p></details>`:'';
  const cards=`<div class="supplier-grid" aria-label="依供應商分類">${matchingGroups.map(g=>`<button class="card supplier-card" data-supplier="${escape(g.id)}"><span class="supplier-card-label">${icon('purchase')}供應商</span><strong>${escape(g.name)}</strong><span class="supplier-card-foot"><span>${g.items.length} 項商品${restock?' · '+g.items.reduce((n,p)=>n+p.suggestion,0)+' 件建議補貨':''}</span>${icon('chevron')}</span></button>`).join('')}</div>`;
  const productList=(products,grouped=false)=>state.gallery==='table'
    ?table(['商品 / SKU','現有庫存','採購在途','建議補貨','狀態'],products.map(p=>[
      `<button type="button" class="product-cell stock-item" ${openAttrs('inventory-live',p.sku)} aria-label="${escape(p.sku)}">${photo(p)}<span class="cell-stack"><strong>${escape(p.sku)}</strong><small>${escape(p.name)}</small>${!grouped&&state.supplier==='all'?`<small>${escape(p.supplier)}</small>`:''}</span></button>`,
      `<span class="mobile-column">現有 </span><strong>${stockCount(p)}</strong>`,
      `<span class="mobile-column">在途 </span>${incomingCount(p)}`,
      `<span class="mobile-column">建議補 </span>${suggestionCount(p)}`,label(p)
    ]),'stock',['identity','available','incoming','replenish','status'])
    :`<div class="records">${products.map(p=>`<button class="card product-card" ${openAttrs('inventory-live',p.sku)}>${photo(p,'photo')}<span class="card-body">
      <strong class="product-code">${escape(p.sku)}</strong><span class="product-brand">${escape(p.name)}</span>
      <span class="stats-line"><span>現有 <b>${stockCount(p)}</b></span><span>在途 ${incomingCount(p)}</span></span>
      <span class="stock-card-replenish">建議補 ${suggestionCount(p)}</span>${label(p)}
    </span></button>`).join('')}</div>`;
  const supplierHeading=!restock&&state.supplier!=='all'?`<div class="supplier-heading">${button('全部供應商','data-supplier="all"','quiet','left')}<h2>${escape(groups.find(g=>g.id===state.supplier)?.name??'供應商未指派')}</h2></div>`:'';
  return tabs+tools+meta+inventoryNotice(state.stock)+rules+supplierHeading+(rows.length?
    (restock?restockSupplierSections(inventoryGroups(rows),items=>productList(items,true)):supplierCards?cards:productList(chunk)+(pages>1?pageNav(rows.length,page,pages):`<div class="page-nav muted">${rows.length} 項商品</div>`)):
    empty(restock&&state.stock.planError?'補貨資料暫時無法取得，請重新整理。':'找不到符合的商品。'));
}
export function inventory(state,demo) {
  const pool=moduleInventory(state,demo);
  const stock=state.inventoryMode==='snapshot';
  const selected=state.selected.inventory;
  const current=state.filter;
  const stockFilter={
    low:p=>Number.isFinite(p.available)&&p.available<=p.threshold,
    immediate:p=>p.suggestion>=5&&p.available<=p.sold*p.lead/60,
    replenish:p=>p.suggestion>=5,
    incoming:p=>p.incoming>0,
    zero:p=>p.available===0,
    sufficient:p=>Number.isFinite(p.suggestion)&&p.suggestion<5,
  }[current];
  const query=state.query;
  const view=current==='master'||current==='channels'?'table':state.gallery;
  const rows=pool.filter(p=>match([p.sku,p.name,p.brand,p.category,p.supplier,p.channels?.join(' ')].join(' '),query))
    .filter(p=>!state.category||p.category===state.category)
    .filter(p=>!stockFilter||(!p.archived&&stockFilter(p)))
    .sort((a,b)=>state.sort==='stock'?(a.stock??Infinity)-(b.stock??Infinity):a.sku.localeCompare(b.sku,'zh-TW'));
  const pages=Math.max(1,Math.ceil(rows.length/12));
  const page=Math.min(state.page,pages);
  const chunk=rows.slice((page-1)*12,page*12);
  const group=`<div class="records">${categories.map(name=>`<button class="card category-card" data-category-button="${escape(name)}">${icon('inventory')}<h3>${escape(name)}</h3><p>${pool.filter(p=>p.category===name).length} 項已分類</p></button>`).join('')}</div>`;
  const history=stock?empty('此快照只含庫存明細。異動來源尚未連接。'):cardPanel('近期點收',demo.receiving.filter(r=>Object.keys(r.actual).length).map(r=>recordLink({label:r.id,detail:r.date+' · '+r.lines.map(x=>x.sku).join(' / '),kind:'receiving',id:r.id,sku:r.lines[0].sku,mark:stateChip(r.status)})).join(''));
  const list=current==='categories'?group:current==='movement'?history:!rows.length
    ?empty(stock&&stockFilter?'保留量和補貨來源尚未核對。':'找不到符合的商品。')
    :view==='gallery'?`<div class="records">${chunk.map(productCard).join('')}</div>`:inventoryTable(chunk,state);
  const paginate=!['categories','movement'].includes(current)&&rows.length>0?pageNav(rows.length,page,pages):'';
  const inventoryTools=toggle([['gallery','圖庫','dashboard'],['table','表格','table']],view,'gallery');
  return titleHeader('inventory',stockMode(state))+
    (stock?banner(state.snapshot?'唯讀庫存快照 · 匯入 '+dateShort(state.snapshot.imported)+' · '+state.snapshot.items.length+' 筆原始 SKU。':state.snapshotError||'讀取庫存快照中…','info'):'')+
    toolbar(query,'搜尋品名或 SKU',select('category','商品分類',[['','全部分類'],...categories.map(c=>[c,c])],state.category)+inventoryTools,
      filterSelect('商品檢視',[...inventoryViews,...stockTabs],current)+select('sort','排序',[['sku','SKU 排序'],['stock','庫存由低到高']],state.sort))+
    (current!=='all'||state.category?`<div class="active-filter"><span>${escape([...inventoryViews,...stockTabs].find(x=>x[0]===current)?.[1]??'全部商品')}${state.category?' · '+escape(state.category):''}</span>${button('清除篩選','data-action="clear-inventory-filters"','quiet')}</div>`:'')+
    (selected.size&&view==='table'?`<div class="batchbar"><b>已選取 ${selected.size} 項</b>${button('匯出選取項目','data-action="export-inventory"','small','download')}</div>`:'')+
    (current==='channels'?banner('示例通路對應 · 平台庫存同步待連接','info'):'')+list+paginate;
}

const shippingStages = [['process','待處理'],['review','待檢查'],['handoff','待交 3PL'],['shipped','已出貨'],['hold','異常']];
const shippingViews = [['all','全部訂單'],['label','待下載標籤'],['history','歷史紀錄']];
const shippingMatch = (order,filter) => ({
  all:true, process:order.status!=='shipped', review:order.status==='process', history:order.status==='shipped',
}[filter]??order.status===filter);
export const shippingRows = (state,demo) => demo.shipping.filter(o=>shippingMatch(o,state.filter)
  &&(!state.channel||o.source===state.channel)&&match([o.id,o.brand,o.source,o.customer,itemCodes(o)].join(' '),state.query))
  .sort((a,b)=>state.sort==='deadline'?(a.due??'99').localeCompare(b.due??'99'):a.id.localeCompare(b.id));

export function shipping(state,demo) {
  const rows=shippingRows(state,demo);
  const selected=state.selected.shipping;
  const actions=selected.size?`<div class="batchbar"><b>已選取 ${selected.size} 筆</b><div class="row-buttons">${button('預檢訂單',openAttrs('shipcheck',''),'primary','check')}${button('匯出標籤清單','data-action="export-labels"','','download')}</div></div>`:'';
  const statusLabel={process:['待檢查','gray'],label:['待下載標籤','amber'],handoff:['待交 3PL','gray'],shipped:['已出貨','green'],hold:['出貨異常','red']};
  const next={process:'檢查訂單',label:'查看標籤',handoff:'查看交付',shipped:'查看訂單',hold:'核對異常'};
  return titleHeader('shipping',button('匯入訂單',openAttrs('import',''),'','upload'))+
    stages(shippingStages,state.filter,key=>demo.shipping.filter(o=>shippingMatch(o,key)).length)+
    toolbar(state.query,'搜尋訂單或 SKU','',filterSelect('其他出貨檢視',[['process','待處理'],...shippingViews],state.filter)+
      select('channel','通路',[['','全部通路'],...['Shopee','EasyStore','Ruten','Coupang'].map(x=>[x,x])],state.channel)+select('sort','排序',[['deadline','期限優先'],['id','訂單編號']],state.sort))+
    actions+(rows.length?table([
      `<input type="checkbox" data-select-visible="shipping" aria-label="選取可見訂單" ${rows.every(r=>selected.has(r.id))?'checked':''}>`,'訂單 / 平台','商品 / SKU','數量','出貨期限','狀態','操作'
    ],rows.map(o=>[
      tick('shipping',o.id,state,'選取 '+o.id),recordIdentity(o.id,'shipping',o.id,o.source+' · '+o.brand),itemCell(o.lines),
      total(o.lines),`<span class="mobile-column">期限 </span>${fmt(o.due)}`,
      o.error?chip(o.error,'red'):chip(...statusLabel[o.status]),actionLink(next[o.status],'shipping',o.id),
    ]),'shipping',['pick','identity','items','quantity','deadline','status','action']):empty('這個狀態沒有符合的訂單。'));
}
const purchaseStages = [['all','全部'],['payment','待付款'],['seller','待出貨'],['sent','運輸中'],['partial','部分到貨'],['complete','已完成']];
function purchaseProgress(order,demo) {
  if(order.status!=='sent')return order.status;
  const linked=demo.parcels.filter(p=>p.po===order.id);
  const delivered=linked.filter(p=>p.status==='delivered');
  const verified=delivered.filter(p=>demo.receiving.some(r=>r.status==='received'&&(p.id===r.ref||p.batch&&p.batch===r.ref)));
  const covers=parcels=>order.lines.every(line=>parcels.flatMap(p=>p.lines).filter(x=>x.sku===line.sku).reduce((n,x)=>n+x.qty,0)>=line.qty);
  if(verified.length&&covers(verified))return 'complete';
  if(delivered.length)return covers(delivered)?'delivered':'partial';
  return 'sent';
}
const purchaseMatch = (order,progress,filter) => ({
  all:true,history:order.status==='sent',sent:progress==='sent',
}[filter]??progress===filter);
export function purchase(state,demo) {
  const isSuppliers=state.filter==='suppliers';
  const orders=demo.purchase.map(order=>({order,progress:purchaseProgress(order,demo)}));
  const rows=orders.filter(({order:o,progress})=>purchaseMatch(o,progress,state.filter)
    &&match([o.id,supplierName(o.supplier),o.source,itemCodes(o),o.ref].join(' '),state.query))
    .sort((a,b)=>['payment','missing','seller','partial','sent','delivered','complete'].indexOf(a.progress)-['payment','missing','seller','partial','sent','delivered','complete'].indexOf(b.progress));
  const cards=suppliers.filter(s=>match([s.name,s.channels,s.skus.join(' ')].join(' '),state.query));
  const next={payment:'本人付款',seller:'等賣家交寄',missing:'核對運單',sent:'追蹤物流',partial:'追蹤其餘包裹',delivered:'待倉庫確認',complete:'查看紀錄'};
  const shipment={payment:'尚未交寄',seller:'待賣家交寄',missing:'缺少物流單號',sent:'運輸中',partial:'部分到貨',delivered:'已送達',complete:'倉庫已點收'};
  return titleHeader('purchase',button(isSuppliers?'回採購單':'供應商',goAttrs('purchase',isSuppliers?'all':'suppliers'))) +
    (isSuppliers?'':stages(purchaseStages,state.filter,key=>orders.filter(({order,progress})=>purchaseMatch(order,progress,key)).length))+
    toolbar(state.query,isSuppliers?'搜尋供應商或 SKU':'搜尋供應商、採購單或 SKU','',isSuppliers?'':filterSelect('其他採購檢視',[['all','全部採購單'],['delivered','已送達 · 待點收'],['missing','採購異常'],['history','採購歷史']],state.filter))+
    (isSuppliers?(cards.length?`<div class="records">${cards.map(s=>`<button class="card category-card" ${openAttrs('supplier',s.id)}><span class="kpi-icon">${icon('purchase')}</span><h3>${escape(s.name)}</h3><p>${escape(s.channels)}</p><div class="stats-line"><span><b>${s.skus.length}</b>供應商品</span><span><b>${demo.purchase.filter(p=>p.supplier===s.id).length}</b>採購單</span></div></button>`).join('')}</div>`:empty('找不到符合的供應商。'))
    :rows.length?table(['供應商 / 採購單','商品 / SKU','採購金額','付款','物流','下一步'],rows.map(({order:o,progress})=>[
      recordIdentity(supplierName(o.supplier),'purchase',o.id,o.id+' · '+o.source),itemCell(o.lines),
      'CNY '+fmt(o.lines.reduce((n,l)=>n+l.cost*l.qty,0)),
      chip(o.paid?'已付款':'待付款',o.paid?'gray':'amber'),
      chip(shipment[progress],progress==='missing'?'red':progress==='complete'?'green':'gray'),
      actionLink(next[progress],'purchase',o.id),
    ]),'purchase',['identity','items','cost','payment','status','action']):empty('這個狀態沒有符合的採購單。'));
}
const parcelStages = [['ready','待集運'],['waiting','待到漳州'],['storage','漳州已收'],['international','國際運輸中'],['delivery','台灣配送'],['delivered','已送達']];
const parcelMatch = (parcel,filter) => filter==='all'||parcel.status===filter||(filter==='storage'&&parcel.status==='ready');
export function parcels(state,demo) {
  const list=demo.parcels.filter(p=>parcelMatch(p,state.filter)&&match([p.id,p.po,p.waybill,p.location,itemCodes(p)].join(' '),state.query));
  const selected=state.selected.parcels;
  const batchRows=demo.batches.filter(b=>match([b.id,b.waybill,b.location].join(' '),state.query));
  const parcelNext={waiting:'等漳州倉簽收',storage:'核對漳州倉收件',ready:'可選入合箱演練',grouped:'查看集運批次',international:'追蹤國際運輸',delivery:'查看台灣配送',delivered:'查看送達紀錄',exception:'核對物流'};
  return titleHeader('parcels',button('採購路線',openAttrs('routes',''),'quiet','link'))+
    stages(parcelStages,state.filter,key=>demo.parcels.filter(p=>parcelMatch(p,key)).length)+
    toolbar(state.query,'搜尋包裹、運單或 SKU','',filterSelect('其他集運檢視',[['ready','待集運'],['all','全部包裹'],['grouped','已合箱'],['exception','物流異常']],state.filter))+
    (selected.size?`<div class="batchbar"><b>已選取 ${selected.size} 個待集運包裹</b>${button('模擬合箱','data-action="consolidate"','primary','parcels')}</div>`:'')+
    (list.length?`<div class="records parcel-list">${list.map(p=>{
      const supplier=supplierName(demo.purchase.find(o=>o.id===p.po)?.supplier);
      return `<article class="card record-card"><button class="card-button" ${openAttrs('parcel',p.id)}><div class="card-body parcel-body">
        <span class="card-top"><span class="parcel-location">${escape(p.location)}</span>${stateChip(p.status)}</span>
        <span class="parcel-products"><span class="parcel-pics">${p.lines.map(l=>shortProduct(l.sku)).join('')}</span><strong>${escape(p.lines.map(l=>l.sku+' ×'+l.qty).join(' / '))}</strong></span>
        <span class="parcel-meta"><span>${escape(supplier)} · ${p.id}</span><span>${escape(p.carrier)} · ${escape(p.waybill)}</span></span>
        <span class="parcel-next"><span>${escape(parcelNext[p.status])}</span>${icon('chevron')}</span></div></button>
        ${p.status==='ready'&&p.route!=='B'?`<label class="select-card">${tick('parcels',p.id,state,'選取包裹 '+p.id)} 加入合箱演練</label>`:''}</article>`;
    }).join('')}</div>`:empty('這個狀態沒有符合的包裹。'))+
    (batchRows.length?`<details class="card task-more batch-list" data-disclosure="batches"><summary>集運批次 <span class="muted">${batchRows.length} 批</span></summary>${batchRows.map(b=>recordLink({label:b.id,detail:b.parcels.length+' 個包裹 · '+b.location,kind:'batch',id:b.id,glyph:'parcels',mark:stateChip(b.status)})).join('')}</details>`:'');
}
const receivingStages = [['all','到貨預告'],['today','今日到貨'],['announce','待填入庫'],['warehouse','待點收'],['received','已完成'],['mismatch','異常']];
const receivingMatch = (record,filter) => filter==='all'||(filter==='today'?record.date===demoDay:
  filter.startsWith('carrier-')?record.date===demoDay&&record.carrier===filter.slice(8):record.status===filter);
export function receiving(state,demo) {
  const rows=demo.receiving.filter(r=>receivingMatch(r,state.filter)&&match([r.ref,r.id,r.source,itemCodes(r)].join(' '),state.query));
  const content=state.filter==='ledger'?ledgerView(state,demo):rows.length?table(['入庫參考','商品 / SKU','預計','物流','入庫單','點收','差異','操作'],
    rows.map(r=>{
      const draft=receiptDraft(r,sourceForReceiving(r,demo));
      const received=Object.keys(r.actual).length?Object.values(r.actual).reduce((sum,n)=>sum+n,0):null;
      const difference=received===null?null:received-totalUnits(r.lines);
      const sheetLabel=r.written?'已填入庫單':draft.allowed?'待填入庫':'待核對';
      const next=draft.allowed?'準備入庫單':r.status==='warehouse'&&r.carrier==='delivered'?'確認點收':'查看入庫';
      return [recordIdentity(r.id,'receiving',r.id,r.ref+' · '+r.source),itemCell(r.lines),total(r.lines),
        `<div class="cell-stack">${stateChip(r.carrier)}<small>${escape(r.date)}</small></div>`,chip(sheetLabel,r.written?'gray':'amber'),
        `<span class="mobile-column">${received===null?'待點收':'點收 '}</span><span class="${received===null?'desktop-only':''}">${fmt(received)}</span>`,
        r.status==='mismatch'?chip(difference?'差 '+(difference>0?'+':'')+difference:'品項差異','red'):difference===null?'<span class="desktop-only">—</span>':fmt(difference),
        actionLink(next,'receiving',r.id)];
    }),'receiving',['identity','items','quantity','carrier','status','received','difference','action']):empty('這個狀態沒有符合的入庫紀錄。');
  return titleHeader('receiving',button(state.filter==='ledger'?'回今日到貨':'提交紀錄',goAttrs('receiving',state.filter==='ledger'?'today':'ledger'),'','table'))+
    (state.filter==='ledger'?'':stages(receivingStages,state.filter.startsWith('carrier-')?'today':state.filter,key=>demo.receiving.filter(r=>receivingMatch(r,key)).length)+
      (state.filter==='ledger'?'':toolbar(state.query,'搜尋包裹、入庫單或 SKU','',filterSelect('今日配送狀態',[['today','今日全部'],['carrier-delivery','配送中'],['carrier-delivered','已送達']],state.filter))))+content;
}
function ledgerView(state,demo) {
  const baseline=demo.receiving.filter(r=>r.written&&!state.ledger.has(r.ref+'|'+r.date));
  const rows=[...baseline.map(r=>[rowLink(r.id,'receiving',r.id),r.date,chip('既有示例','blue'),r.lines.length]),
    ...[...state.ledger.values()].map(r=>[rowLink(r.recordId,'receiving',r.recordId),r.date,chip('本機記錄成功','green'),r.rows.length])];
  return rows.length?table(['入庫單','有效日期','寫入狀態','列數'],rows):empty('目前沒有提交紀錄。');
}
export const views = {dashboard,inventory,shipping,purchase,parcels,receiving};
export {sourceForReceiving};
