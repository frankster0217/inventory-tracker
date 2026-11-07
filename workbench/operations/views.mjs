import {categories, demoDay, knownProducts, routes, status, suppliers} from './data.mjs';
import {demoStock, supplierName, totalUnits} from './model.mjs';

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
export const liveInventoryLink = () => `<a class="button" href="https://frankster0217.github.io/inventory-tracker/workbench/#catalog">${icon('link')} 正式庫存</a>`;
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
const titles = {
  dashboard:['營運總覽','PORTO 3C / VOICity'],
  inventory:['庫存','商品主檔、實體庫存與通路對應。'],
  shipping:['出貨','從訂單檢查、標籤到 3PL 提交。'],
  purchase:['採購','管理採購單、供應商與在途商品。'],
  parcels:['集運','追蹤供應商包裹、合箱與台灣配送。'],
  receiving:['3PL 倉儲','核對到貨、入庫單及倉庫點收。'],
};

const match = (entry,query) => !query || entry.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
const itemCodes = record => record.lines.map(l=>l.sku).join(' ');
export const moduleInventory = (state,demo) => state.inventoryMode==='snapshot'?state.snapshotItems:state.products.map(product=>demoStock(product,demo));
const inventoryTabs = [['all','全部商品'],['categories','商品分類'],['master','商品主檔'],['movement','庫存異動'],['low','低庫存預警'],['channels','上架通路']];
const stockTabs = [['low','低庫存'],['immediate','立即補貨'],['replenish','建議補貨'],['incoming','採購在途'],['zero','缺貨'],['sufficient','暫不需補貨']];
const shippingTabs = [['all','全部訂單'],['process','待處理'],['label','待下載標籤'],['handoff','待交 3PL'],['shipped','已出貨'],['hold','出貨異常'],['history','歷史紀錄']];
const purchaseTabs = [['all','全部採購訂單'],['payment','待付款'],['seller','待賣家出貨'],['sent','已出貨'],['missing','採購異常'],['suppliers','供應商管理'],['history','採購歷史']];
const parcelTabs = [['all','全部包裹'],['waiting','待到漳州倉'],['storage','已到漳州倉'],['ready','待集運'],['grouped','已合箱'],['international','運輸中'],['delivery','台灣配送中'],['delivered','已送達'],['exception','物流異常']];
const receivingTabs = [['all','入庫預告'],['today','今日到貨'],['announce','待填入庫單'],['warehouse','待倉庫確認'],['received','已完成入庫'],['mismatch','入庫異常'],['ledger','Google Sheets 紀錄']];
const tabs = (list,current) => `<div class="tabs" role="group" aria-label="狀態篩選">${list.map(([value,label])=>`<button class="tab" type="button" data-filter="${value}" aria-pressed="${current===value}">${label}</button>`).join('')}</div>`;
const toggle = (options,current,action) => `<div class="toggle" role="group" aria-label="顯示方式">${options.map(([value,label,glyph])=>`<button data-${action}="${value}" aria-pressed="${current===value}">${glyph?icon(glyph):''}${label}</button>`).join('')}</div>`;
const field = (value,label='搜尋目前清單') => `<input type="search" class="field search-field" aria-label="${label}" placeholder="${label}" id="view-query" value="${escape(value)}">`;
const select = (id,title,options,current) => `<select id="${id}" class="select" aria-label="${title}">${options.map(([value,label])=>`<option value="${escape(value)}" ${value===current?'selected':''}>${escape(label)}</option>`).join('')}</select>`;
const table = (headers,rows) => `<div class="table-shell card" tabindex="0" aria-label="資料表"><table class="table responsive-rows"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((col,index)=>`<td><span class="mobile-column" aria-hidden="true">${headers[index].startsWith('<input')?'選取':headers[index]}</span>${col}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const cardPanel = (title,items,action='') => `<section class="card"><header class="panel-head"><h2>${title}</h2>${action}</header>${items}</section>`;
export function recordLink({label,detail='',glyph='link',sku,kind,id,mark=''}) {
  return `<button class="record-link" ${openAttrs(kind,id)}>${sku?shortProduct(sku):`<span class="kpi-icon">${icon(glyph)}</span>`}<span class="task-text"><strong>${escape(label)}</strong><small>${escape(detail)}</small></span>${mark}${icon('chevron')}</button>`;
}
const tick = (kind,id,state,label) => `<input type="checkbox" aria-label="${escape(label)}" data-pick="${kind}" value="${escape(id)}" ${state.selected[kind].has(id)?'checked':''}>`;
const total = lines => fmt(totalUnits(lines));
const itemCell = lines => `<div class="product-cell">${shortProduct(lines[0]?.sku)}<div class="cell-stack">${lines.map(x=>prodLink(x.sku)).join('')}</div></div>`;
const sourceForReceiving = (row,demo) => row.kind==='batch'?demo.batches.find(x=>x.id===row.ref):demo.parcels.find(x=>x.id===row.ref);
const latest = record => record.events.at(-1);
const titleHeader = (view,tools='') => {
  const data=modules.find(m=>m[0]===view);
  return `<header class="page-head"><div><p class="overline">${data[2]}</p><h1>${titles[view][0]}</h1><p>${titles[view][1]}</p></div><div class="head-tools">${tools}</div></header>`;
};

export function taskItems(demo) {
  const tasks=[];
  for(const p of demo.receiving.filter(r=>r.status==='announce')) tasks.push({title:'準備今日入庫單',subtitle:p.id+' · '+p.lines[0].sku+' ×'+totalUnits(p.lines),mark:'台灣配送中',tone:'amber',ref:['receiving',p.id],sku:p.lines[0].sku});
  for(const p of demo.shipping.filter(r=>r.status==='label')) tasks.push({title:'下載出貨標籤',subtitle:p.source+' · '+p.id,mark:'待下載',tone:'blue',ref:['shipping',p.id],sku:p.lines[0].sku});
  for(const p of demo.shipping.filter(r=>r.status==='hold')) tasks.push({title:'核對出貨異常',subtitle:p.source+' · '+p.id,mark:p.error,tone:'red',ref:['shipping',p.id],sku:p.lines[0].sku});
  for(const p of demo.purchase.filter(r=>r.status==='missing')) tasks.push({title:'核對賣家物流單號',subtitle:p.id+' · '+p.lines[0].sku,mark:'資料缺少',tone:'red',ref:['purchase',p.id],sku:p.lines[0].sku});
  for(const p of demo.receiving.filter(r=>r.status==='warehouse')) tasks.push({title:'確認倉庫點收',subtitle:p.ref+' · '+totalUnits(p.lines)+' 件',mark:'已送達',tone:'green',ref:['receiving',p.id],sku:p.lines[0].sku});
  for(const p of demo.purchase.filter(r=>r.status==='payment')) tasks.push({title:'查看待付款採購單',subtitle:p.id+' · '+p.lines[0].sku,mark:'待付款',tone:'amber',ref:['purchase',p.id],sku:p.lines[0].sku});
  return tasks;
}
export function activityRows(demo) {
  return demo.activity.map(a=>`<button class="activity-row" ${openAttrs(...a.ref)}><span class="kpi-icon green">${icon(a.icon)}</span><span class="task-text"><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><time>${a.time}</time></button>`).join('');
}
export function dashboard(state,demo) {
  const arrivals=demo.receiving.filter(r=>r.date===demoDay);
  const tasks=taskItems(demo);
  const stock=state.products.map(p=>demoStock(p,demo));
  const replenish=stock.filter(p=>p.suggestion>=5);
  const ship=demo.shipping.filter(o=>o.status!=='shipped');
  const counts=[
    ['需要處理',tasks.length,'warning','amber','data-scroll="tasks"'],
    ['今日到貨',arrivals.length,'receiving','green',goAttrs('receiving','today')],
    ['建議補貨',replenish.length,'chart','amber',goAttrs('inventory','replenish')],
    ['今日待出貨',ship.length,'shipping','blue',goAttrs('shipping','process')],
  ];
  const flow=[['purchase','採購'],['parcels','集運'],['shipping','台灣配送'],['receiving','3PL 點收']];
  const stageSets=[
    ['採購','purchase',[['payment','待付款'],['seller','待出貨'],['sent','已出貨'],['missing','缺少物流單號']],demo.purchase],
    ['集運','parcels',[['waiting','待到漳州倉'],['storage','已到漳州倉',demo.parcels.filter(p=>['storage','ready'].includes(p.status)).length],['ready','待集運'],['international','國際運輸中']],demo.parcels],
    ['3PL 入庫','receiving',[['carrier-delivered','今日已送達',arrivals.filter(x=>x.carrier==='delivered').length],['carrier-delivery','今日配送中',arrivals.filter(x=>x.carrier==='delivery').length],['announce','待填入庫單'],['warehouse','待倉庫確認'],['mismatch','入庫異常']],demo.receiving],
    ['庫存','inventory',[['low','低庫存',stock.filter(x=>x.available<=x.threshold).length],['replenish','建議補貨',replenish.length],['zero','缺貨商品',stock.filter(x=>x.available===0).length],['incoming','採購在途',stock.reduce((sum,x)=>sum+x.incoming,0)]],[]],
    ['出貨','shipping',[['process','今日待出貨',ship.length],['label','待下載標籤'],['handoff','待交 3PL'],['hold','出貨異常']],demo.shipping],
  ];
  return titleHeader('dashboard',chip('示例日 · 11/06 週五','outline')+button('資料來源',openAttrs('sources',''),'','lock'))+
    `<section class="hero"><div><p class="overline">Taiwan receiving</p><h2><b>${arrivals.length}</b> 批今日到貨</h2><p class="hero-copy">${arrivals.filter(x=>x.carrier==='delivery').length} 批配送中 · ${arrivals.filter(x=>x.carrier==='delivered').length} 批已送達</p>${button('查看今日到貨',goAttrs('receiving','today'),'primary','arrow')}</div>
    <div class="hero-route" aria-label="採購至倉庫點收">${flow.map(([glyph,label],i)=>`${i?'<span class="route-line"></span>':''}<div class="route-stop ${i===2?'active':''}"><span class="route-icon">${icon(glyph)}</span>${label}</div>`).join('')}</div></section>
    <div class="kpis">${counts.map(([label,count,glyph,tone,attrs])=>`<button class="card kpi" ${attrs}><span class="kpi-icon ${tone}">${icon(glyph)}</span><span><strong class="kpi-value">${count}</strong><span class="kpi-label">${label}</span></span></button>`).join('')}</div>
    <div class="dashboard-grid">
      <div id="tasks">${cardPanel('需要處理的事項',tasks.map(t=>`<button class="task-row" ${openAttrs(...t.ref)}>${shortProduct(t.sku)}<span class="task-text"><strong>${t.title}</strong><small>${escape(t.subtitle)}</small></span>${chip(t.mark,t.tone)}${icon('chevron')}</button>`).join(''),chip(tasks.length+' 筆待辦','amber'))}</div>
      <div class="stack">${cardPanel('今日到貨',arrivals.map(r=>recordLink({label:r.ref,detail:r.source+' · '+totalUnits(r.lines)+' 件',sku:r.lines[0].sku,kind:'receiving',id:r.id,mark:stateChip(r.carrier)})).join(''))}
      ${cardPanel('自動化紀錄',activityRows(demo),chip('示例'))}</div>
    </div>
    <div class="section-head"><h2>各環節進度</h2><span class="muted">本機演練 · 11:10</span></div>
    <div class="stage-grid">${stageSets.map(([name,view,list,rows])=>`<section class="card stage"><h3>${name}</h3>${list.map(([key,label,value])=>`<button ${goAttrs(view,key)}>${label}<b>${value??rows.filter(r=>r.status===key).length}</b></button>`).join('')}</section>`).join('')}</div>`;
}

const productStatus = p => p.archived?chip('已封存'):p.service?chip('非庫存項目'):p.source==='snapshot'?chip('庫存快照','blue')
  :p.available===0?chip('缺貨','red'):p.available<=p.threshold?chip('低庫存','amber'):chip('正常','green');
const stockMode = state => state.localPreview
  ? toggle([['demo','示例'],['snapshot','庫存快照']],state.inventoryMode,'inventory-mode')
  : liveInventoryLink();
function inventoryTable(rows,state) {
  return table(['選取','商品 / SKU','品牌','分類','現有','已保留','可用','採購在途','近 60 天銷量','建議補貨量','供應商','上架平台'],rows.map(p=>[
    tick('inventory',p.sku,state,'選取 '+p.sku),
    `<div class="product-cell">${photo(p)}<div class="cell-stack">${prodLink(p.sku,p.source==='snapshot'?'snapshot':'product')}<small>${escape(p.name)}</small></div></div>`,
    fmt(p.brand),fmt(p.category),fmt(p.stock),fmt(p.reserved),fmt(p.available),fmt(p.incoming),fmt(p.sold),fmt(p.suggestion),
    fmt(p.supplier??p.suppliers?.map(supplierName).join('、')),fmt(p.channels?.join(' · '))
  ]));
}
function productCard(p) {
  return `<button class="card product-card" ${openAttrs(p.source==='snapshot'?'snapshot':'product',p.sku)}>${photo(p,'photo')}<span class="card-body">
    <span class="card-top"><small>${fmt(p.brand)}</small>${productStatus(p)}</span><h3>${escape(p.sku)}</h3><p>${escape(p.name)}</p>
    <span class="stats-line"><span><b>${fmt(p.source==='snapshot'?p.stock:p.available)}</b>${p.source==='snapshot'?'現有庫存':'可用庫存'}</span><span><b>${fmt(p.incoming)}</b>採購在途</span></span></span></button>`;
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
  const paginate=!['categories','movement'].includes(current)&&rows.length>0?`<div class="page-nav"><span class="muted">${rows.length} 項商品 · ${page} / ${pages}</span><div class="row-buttons">${button('上一頁',`data-page="${page-1}" ${page<=1?'disabled':''}`,'small','left')}${button('下一頁',`data-page="${page+1}" ${page>=pages?'disabled':''}`,'small','chevron')}</div></div>`:'';
  return titleHeader('inventory',stockMode(state)+toggle([['gallery','圖庫','dashboard'],['table','表格','table']],state.gallery,'gallery'))+
    (stock?banner(state.snapshot?'唯讀庫存快照 · 匯入 '+dateShort(state.snapshot.imported)+' · '+state.snapshot.items.length+' 筆原始 SKU。':state.snapshotError||'讀取庫存快照中…','info'):banner('商品照片來自實際型錄。下方庫存、銷量及通路為演練資料。','info'))+
    `<div class="module-tools">${tabs(inventoryTabs,stockFilter?'low':current)}${stockFilter?tabs(stockTabs,current):''}<div class="filters">${field(query,'搜尋 SKU、品牌或品名')}<div class="chips">${select('category','商品分類',[['','全部分類'],...categories.map(c=>[c,c])],state.category)}${select('sort','排序',[['sku','SKU 排序'],['stock','庫存由低到高']],state.sort)}</div></div></div>
      ${selected.size&&view==='table'?`<div class="batchbar"><b>已選取 ${selected.size} 項</b>${button('匯出選取項目','data-action="export-inventory"','small','download')}</div>`:''}
      ${current==='channels'?banner('通路顯示已提供的範例對應。平台同步狀態未接入。','info'):''}${list}${paginate}`;
}

export const shippingRows = (state,demo) => demo.shipping.filter(o=>(
  state.filter==='all'||(state.filter==='history'?o.status==='shipped':state.filter==='process'?o.status!=='shipped':o.status===state.filter)
)&&(!state.channel||o.source===state.channel)&&match([o.id,o.brand,o.source,o.customer,itemCodes(o)].join(' '),state.query))
  .sort((a,b)=>state.sort==='deadline'?(a.due??'99').localeCompare(b.due??'99'):a.id.localeCompare(b.id));

export function shipping(state,demo) {
  const rows=shippingRows(state,demo);
  const selected=state.selected.shipping;
  const actions=selected.size?`<div class="batchbar"><b>已選取 ${selected.size} 筆</b><div class="row-buttons">${button('出貨預檢',openAttrs('shipcheck',''),'small','check')}${button('匯出標籤清單','data-action="export-labels"','small','download')}</div></div>`:'';
  return titleHeader('shipping',button('匯入示例訂單',openAttrs('import',''),'primary','upload'))+
    `<div class="module-tools">${tabs(shippingTabs,state.filter)}<div class="filters">${field(state.query,'搜尋訂單、SKU 或店家')}<div class="chips">${select('channel','通路',[['','全部通路'],...['Shopee','EasyStore','Ruten','Coupang'].map(x=>[x,x])],state.channel)}${select('sort','排序',[['deadline','期限優先'],['id','訂單編號']],state.sort)}</div></div></div>`+
    actions+(rows.length?table([
      `<input type="checkbox" data-select-visible="shipping" aria-label="選取可見訂單" ${rows.every(r=>selected.has(r.id))?'checked':''}>`,'通路 / 店家','訂單 / 參考','商品 / SKU','數量','出貨期限','標籤','3PL 提交','異常'
    ],rows.map(o=>[tick('shipping',o.id,state,'選取 '+o.id),`<div class="cell-stack"><b>${escape(o.source)}</b><small>${escape(o.brand)}</small></div>`,
      `<div class="cell-stack">${rowLink(o.id,'shipping',o.id)}<small>${escape(o.customer)}</small></div>`,itemCell(o.lines),total(o.lines),fmt(o.due),
      chip(o.label,o.label==='已備妥'?'green':'amber'),chip(o.handoff,o.handoff==='已提交'?'green':'gray'),o.error?chip(o.error,'red'):'—'
    ])):empty('沒有符合的出貨訂單。'))+
    `<p class="muted" style="margin-top:11px">示例預檢與匯出在本機執行。既有作業日 16:30 截止與獨立歸檔流程。</p>`;
}
export function purchase(state,demo) {
  const isSuppliers=state.filter==='suppliers';
  const rows=demo.purchase.filter(o=>(state.filter==='all'||(state.filter==='history'?o.status==='sent':o.status===state.filter))
    &&match([o.id,supplierName(o.supplier),o.source,itemCodes(o),o.ref].join(' '),state.query));
  const cards=suppliers.filter(s=>match([s.name,s.channels,s.skus.join(' ')].join(' '),state.query));
  return titleHeader('purchase',button('供應商管理',goAttrs('purchase','suppliers'),'','inventory'))+
    `<div class="module-tools">${tabs(purchaseTabs,state.filter)}${field(state.query,'搜尋供應商、採購單或 SKU')}</div>`+
    (isSuppliers?(cards.length?`<div class="records">${cards.map(s=>`<button class="card category-card" ${openAttrs('supplier',s.id)}><span class="kpi-icon amber">${icon('purchase')}</span><h3>${escape(s.name)}</h3><p>${escape(s.channels)}</p><div class="stats-line"><span><b>${s.skus.length}</b>供應商品</span><span><b>${demo.purchase.filter(p=>p.supplier===s.id).length}</b>採購單</span></div></button>`).join('')}</div>`:empty('找不到符合的供應商。'))
    :rows.length?table(['採購單','供應商 / 來源','商品 / SKU','數量','採購狀態','付款','運送路線','下單日期','金額'],
      rows.map(o=>[rowLink(o.id,'purchase',o.id),`<div class="cell-stack">${rowLink(supplierName(o.supplier),'supplier',o.supplier)}<small>${o.source}</small></div>`,itemCell(o.lines),total(o.lines),
      stateChip(o.status),chip(o.paid?'已付款':'本人付款',o.paid?'green':'amber'),fmt(routes[o.route]?.[1]),o.date,'CNY '+fmt(o.lines.reduce((s,l)=>s+l.cost*l.qty,0))])):empty('沒有符合的採購單。'));
}
export function parcels(state,demo) {
  const list=demo.parcels.filter(p=>(state.filter==='all'||p.status===state.filter||(state.filter==='storage'&&p.status==='ready'))&&match([p.id,p.po,p.waybill,p.location,itemCodes(p)].join(' '),state.query));
  const selected=state.selected.parcels;
  const batchRows=demo.batches.filter(b=>match([b.id,b.waybill,b.location].join(' '),state.query));
  return titleHeader('parcels',button('三條採購路線',openAttrs('routes',''),'','link'))+
    `<div class="module-tools">${tabs(parcelTabs,state.filter)}${field(state.query,'搜尋物流單號、包裹或 SKU')}</div>`+
    (selected.size?`<div class="batchbar"><b>已選取 ${selected.size} 個待集運包裹</b>${button('模擬合箱','data-action="consolidate"','small primary','parcels')}</div>`:'')+
    (list.length?`<div class="records">${list.map(p=>`<article class="card record-card"><button class="card-button" ${openAttrs('parcel',p.id)}><div class="card-body parcel-body">
      <span class="card-top"><strong class="record-id">${p.id}</strong>${stateChip(p.status)}</span>
      <span class="parcel-pics">${p.lines.map(l=>shortProduct(l.sku)).join('')}</span><strong>${escape(p.lines.map(l=>l.sku+' ×'+l.qty).join(' / '))}</strong>
      <span class="parcel-meta"><span>${escape(supplierName(demo.purchase.find(o=>o.id===p.po)?.supplier))} · ${p.po}</span><span>${p.carrier} · ${p.waybill}</span><span>${p.location} · ${dateShort(latest(p).at)}</span></span>
      <span class="card-top"><small>${routes[p.route][1]} · ${p.weight} kg</small>${icon('chevron')}</span></div></button>
      ${p.status==='ready'?`<label class="select-card">${tick('parcels',p.id,state,'選取包裹 '+p.id)} 加入合箱演練</label>`:''}</article>`).join('')}</div>`:empty('沒有符合的包裹。'))+
    (batchRows.length?`<div class="section-head"><h2>集運批次</h2><span class="muted">${batchRows.length} 批</span></div>`+
      cardPanel('合箱與台灣配送',batchRows.map(b=>recordLink({label:b.id,detail:b.parcels.length+' 個包裹 · '+b.location,kind:'batch',id:b.id,glyph:'parcels',mark:stateChip(b.status)})).join('')):'');
}
export function receiving(state,demo) {
  const todayFilter=state.filter==='today'||state.filter.startsWith('carrier-');
  const rows=demo.receiving.filter(r=>(state.filter==='all'||(todayFilter?r.date===demoDay&&(state.filter==='today'||r.carrier===state.filter.slice(8)):r.status===state.filter))
    &&match([r.ref,r.id,r.source,itemCodes(r)].join(' '),state.query));
  const content=state.filter==='ledger'?ledgerView(state,demo):rows.length?table(['入庫參考','供應商 / 路線','商品 / SKU','預計','物流狀態','日期','Google Sheets','已點收','差異'],
    rows.map(r=>{
      const parcel=sourceForReceiving(r,demo);
      const ids=parcel?.parcels??(parcel?[parcel.id]:[]);
      const purchaseIds=demo.parcels.filter(p=>ids.includes(p.id)).map(p=>p.po);
      const names=[...new Set(demo.purchase.filter(p=>purchaseIds.includes(p.id)).map(p=>supplierName(p.supplier)))];
      const received=Object.keys(r.actual).length?Object.values(r.actual).reduce((sum,n)=>sum+n,0):null;
      return [`<div class="cell-stack">${rowLink(r.id,'receiving',r.id)}<small>${r.ref}</small></div>`,`<div class="cell-stack">${fmt(names.length?names.join(' / '):null)}<small>${r.source}</small></div>`,
        itemCell(r.lines),total(r.lines),stateChip(r.carrier),r.date,chip(r.written?'已記錄 · 示例':'待準備',r.written?'green':'amber'),fmt(received),received===null?'—':fmt(received-totalUnits(r.lines))];
    })):empty('沒有符合的入庫紀錄。');
  return titleHeader('receiving',button('提交紀錄',goAttrs('receiving','ledger'),'','table'))+
    banner('物流送達、入庫單提交及倉庫點收分開記錄。預覽中的提交只寫入本機演練紀錄。','info')+
    `<div class="module-tools">${tabs(receivingTabs,todayFilter?'today':state.filter)}${todayFilter?tabs([['today','全部今日到貨'],['carrier-delivery','配送中'],['carrier-delivered','已送達']],state.filter):''}${field(state.query,'搜尋包裹、入庫單或 SKU')}</div>${content}`;
}
function ledgerView(state,demo) {
  const baseline=demo.receiving.filter(r=>r.written&&!state.ledger.has(r.ref+'|'+r.date));
  const rows=[...baseline.map(r=>[rowLink(r.id,'receiving',r.id),r.date,chip('既有示例','blue'),r.lines.length]),
    ...[...state.ledger.values()].map(r=>[rowLink(r.recordId,'receiving',r.recordId),r.date,chip('本機記錄成功','green'),r.rows.length])];
  return rows.length?table(['入庫單','有效日期','寫入狀態','列數'],rows):empty('目前沒有提交紀錄。');
}
export const views = {dashboard,inventory,shipping,purchase,parcels,receiving};
export {sourceForReceiving};
