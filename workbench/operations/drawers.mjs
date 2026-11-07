import {demoDay,knownProducts,routes,suppliers} from './data.mjs';
import {combineLines,demoStock,receiptDraft,supplierName,totalUnits} from './model.mjs';
import {activityRows,banner,button,chip,displayTime,empty,escape,fmt,liveInventoryLink,openAttrs,photo,recordLink,routeText,sourceForReceiving,stateChip,taskItems} from './views.mjs?v=20261108-focus';

const fact = (label,value) => `<div class="fact"><dt>${escape(label)}</dt><dd>${value}</dd></div>`;
const facts = pairs => `<dl class="facts">${pairs.map(([k,v])=>fact(k,v)).join('')}</dl>`;
const group = (label,content) => `<section><h3>${escape(label)}</h3>${content}</section>`;
const related = (label,rows) => group(label,rows.length?`<div class="drawer-list">${rows.map(recordLink).join('')}</div>`:'<p>目前無可顯示的對應紀錄。</p>');
const itemRows = (items,showPrices=false) => `<div class="drawer-list">${items.map(x=>recordLink({label:x.sku,detail:'數量 '+x.qty+(showPrices&&x.cost!==null?' · 單價 CNY '+fmt(x.cost):''),sku:x.sku,kind:'product',id:x.sku})).join('')}</div>`;
const timeline = events => group('物流時間線',events.length?`<ol class="timeline">${[...events].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).map(ev=>`<li><strong>${escape(ev.title)}</strong><small>${displayTime(ev.at)} · ${escape(ev.location)} · 來源 ${escape(ev.source)}</small></li>`).join('')}</ol>`:empty('尚無物流事件。'));
const record = (title,eyebrow,body) => ({title,eyebrow,body});
const sample = '示例紀錄';
const orderLink = o => ({label:o.id,detail:supplierName(o.supplier)+' · '+o.source,kind:'purchase',id:o.id,sku:o.lines[0].sku,mark:stateChip(o.status)});
const parcelLink = p => ({label:p.id,detail:p.carrier+' · '+p.waybill,kind:'parcel',id:p.id,sku:p.lines[0].sku,mark:stateChip(p.status)});
const receivingLink = r => ({label:r.id,detail:r.date+' · '+r.ref,kind:'receiving',id:r.id,sku:r.lines[0].sku,mark:stateChip(r.status)});
const batchLink = b => ({label:b.id,detail:b.parcels.length+' 個包裹 · '+b.location,kind:'batch',id:b.id,glyph:'parcels',mark:stateChip(b.status)});

function productDrawer(kind,id,state,demo) {
  const stock=kind==='snapshot';
  const example=knownProducts.get(id);
  const p=stock?state.snapshotItems.find(item=>item.sku===id):example&&demoStock(example,demo);
  if(!p)return null;
  const suppliersForProduct=stock?[]:suppliers.filter(s=>p.suppliers.includes(s.id));
  const orders=stock?[]:demo.purchase.filter(o=>o.lines.some(x=>x.sku===id));
  const parcels=stock?[]:demo.parcels.filter(o=>o.lines.some(x=>x.sku===id));
  const receipts=stock?[]:demo.receiving.filter(o=>o.lines.some(x=>x.sku===id));
  return record(p.sku,stock?'庫存快照 · 唯讀':'商品主檔 · 示例',
    photo(p,'photo')+`<p>${escape(p.name)}</p>`+
    facts([['品牌',fmt(p.brand)],['商品分類',fmt(p.category)],['現有庫存',fmt(p.stock)],['已保留',fmt(p.reserved)],
      ['可用庫存',fmt(p.available)],['採購在途',fmt(p.incoming)],['近 60 天銷量',fmt(p.sold)],['建議補貨',p.suggestion===undefined?'待核實':fmt(p.suggestion)]])+
    (stock
      ?banner('保留量、採購在途、補貨與通路資料尚未核對。庫存數字來自 Supabase 快照。','info')+facts([['供應商',fmt(p.supplier)],['商品狀態',chip(p.archived?'已封存':'現有主檔')]])
      :related('供應商與參考價格',suppliersForProduct.map(s=>{
        const latest=demo.purchase.filter(o=>o.supplier===s.id).flatMap(o=>o.lines).find(x=>x.sku===id);
        return {label:s.name,detail:latest?.cost===undefined?'價格待核對':'最近示例單價 CNY '+latest.cost,kind:'supplier',id:s.id,glyph:'purchase'};
      }))+related('採購歷史',orders.map(orderLink))+related('在途包裹',parcels.map(parcelLink))+
      related('3PL 點收與庫存異動',receipts.map(receivingLink))+
      group('上架通路',`<div class="legend">${p.channels.map(c=>chip(c,'blue')).join('')}</div><p>示例對應 · 平台庫存同步待連接</p>`)));
}
function purchaseDrawer(order,demo) {
  const children=demo.parcels.filter(p=>p.po===order.id);
  return record(order.id,'採購單 · '+sample,
    facts([['供應商',button(supplierName(order.supplier),openAttrs('supplier',order.supplier),'small')],['來源平台',escape(order.source)],
      ['付款狀態',chip(order.paid?'已付款':'等待本人付款',order.paid?'green':'amber')],['訂單狀態',stateChip(order.status)],
      ['下單日期',escape(order.date)],['預計到貨',fmt(order.eta)],['平台參考',fmt(order.ref)],['總額','CNY '+fmt(order.lines.reduce((s,x)=>s+x.qty*x.cost,0))],
      ['賣家運單',fmt(children.length?children.map(x=>x.waybill).join(' / '):null)],['實際到貨',fmt(children.find(x=>x.status==='delivered')?.events.at(-1)?.at.slice(0,10))]])+
    banner(routeText(order.route),'info')+
    group('訂購品項與單價',itemRows(order.lines,true))+
    related('出貨與分箱',children.map(parcelLink))+
    (!order.paid?banner('付款由你在採購平台確認。'):''));
}
function supplierDrawer(s,demo) {
  const orders=demo.purchase.filter(o=>o.supplier===s.id);
  return record(s.name,'供應商 · '+sample,
    facts([['平台與聯絡渠道',escape(s.channels)],['常用交期',s.lead+' 天'],['聯絡帳號','待連接'],['店舖連結','待核對'],['在途採購單',orders.filter(o=>o.paid).length],['文件及報價單','待匯入']])+
    related('供應商品',s.skus.map(sku=>{
      const latest=orders.flatMap(o=>o.lines).find(x=>x.sku===sku);
      return {label:sku,detail:latest?'參考單價 CNY '+latest.cost:'參考價格待核對',kind:'product',id:sku,sku};
    }))+related('採購與歷史價格',orders.map(orderLink)));
}
function shippingDrawer(o) {
  return record(o.id,'出貨訂單 · '+sample,
    facts([['通路 / 店家',escape(o.source+' · '+o.brand)],['訂單參考',escape(o.customer)],['出貨期限',fmt(o.due)],['目前狀態',stateChip(o.status)],
      ['標籤',chip(o.label)],['3PL 提交',chip(o.handoff)],['異常',o.error?chip(o.error,'red'):'—']])+
    group('出貨品項',itemRows(o.lines))+
    banner('出貨預檢、標籤清單及提交規則在出貨模組演練。','info'));
}
function parcelDrawer(p,demo) {
  const po=demo.purchase.find(o=>o.id===p.po);
  const batch=demo.batches.find(b=>b.id===p.batch);
  const incoming=demo.receiving.filter(r=>r.ref===p.id||p.batch&&r.ref===p.batch);
  return record(p.id,'包裹 · '+sample,
    facts([['包裹狀態',stateChip(p.status)],['重量',p.weight+' kg'],['國內物流',escape(p.carrier)],['賣家運單',escape(p.waybill)],['所在位置',escape(p.location)],
      ['最近更新',displayTime(p.events.at(-1).at)]])+banner(routeText(p.route),'info')+
    group('包裹明細',itemRows(p.lines))+timeline(p.events)+
    related('關聯採購單',po?[orderLink(po)]:[])+related('關聯合箱',batch?[batchLink(batch)]:[])+related('3PL 入庫',incoming.map(receivingLink)));
}
function batchDrawer(b,demo) {
  const parcels=demo.parcels.filter(p=>b.parcels.includes(p.id));
  const inbound=demo.receiving.filter(r=>r.ref===b.id);
  return record(b.id,'集運批次 · '+sample,
    facts([['批次狀態',stateChip(b.status)],['合箱包裹',parcels.length],['台灣物流',fmt(b.carrier)],['台灣運單',fmt(b.waybill)],['目前位置',escape(b.location)]])+
    related('合箱包裹',parcels.map(parcelLink))+group('合箱品項',itemRows(combineLines(parcels.flatMap(p=>p.lines))))+
    timeline(b.events)+related('入庫單',inbound.map(receivingLink)));
}
function receivingDrawer(r,state,demo) {
  const source=sourceForReceiving(r,demo);
  const prepare=receiptDraft(r,source);
  const receiptState=Object.keys(r.actual).length>0;
  const units=receiptState?Object.values(r.actual).reduce((s,n)=>s+n,0):null;
  const rows=state.ledger.get(r.ref+'|'+r.date)?.rows??prepare.rows;
  const checklist=[['預計入庫',true],['台灣末端配送',r.carrier==='delivery'||r.carrier==='delivered'],['承運商已送達',r.carrier==='delivered'],
    ['入庫單已提交',r.written],['倉庫已點收',receiptState],['已核對可用',r.status==='received']];
  const recording=`<div class="legend">${checklist.map(([label,done])=>chip(label,done?'green':'gray')).join('')}</div>`;
  const preview=rows?.length?`<div class="table-shell card"><table class="table"><thead><tr>${['單號','商品編號','商品名稱','規格','位置','數量','明細備註'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
  const submit=prepare.allowed?`<div class="row-buttons">${button('記錄入庫演練',`data-action="record-inbound" data-id="${r.id}"`,'primary','check')}${button('下載 A:G 草稿',`data-action="export-inbound" data-id="${r.id}"`,'','download')}</div>`:`<p>${escape(prepare.reason)}</p>`;
  const countForm=r.written&&r.carrier==='delivered'&&r.status!=='received'
    ?`<form data-receive="${r.id}"><div class="facts">${r.lines.map((line,i)=>`<label class="fact">${escape(line.sku)} · 預計 ${line.qty}<input name="qty-${i}" class="field count-input" type="number" step="1" min="0" max="100000" required value="${r.actual[line.sku]??''}" aria-label="${escape(line.sku+' 點收數量')}"></label>`).join('')}</div><button class="button" type="submit" style="margin-top:9px">確認點收演練</button></form>`:'';
  return record(r.id,'3PL 收貨 · '+sample,
    facts([['入庫參考',escape(r.ref)],['承運來源',escape(r.source)],['有效日期',escape(r.date)],['物流狀態',stateChip(r.carrier)],
      ['入庫狀態',stateChip(r.status)],['預計數量',totalUnits(r.lines)],['已點收',fmt(units)],['差異',fmt(units===null?null:units-totalUnits(r.lines))]])+
    group('到貨與點收進度',recording)+group('本機入庫草稿 A:G',preview+submit)+
    group('倉庫點收',countForm||'<p>點收狀態獨立於物流與入庫單。</p>')+
    (source?timeline(source.events)+related('運送明細',r.kind==='batch'?[batchLink(source)]:[parcelLink(source)]):''));
}
function sourcesDrawer(state) {
  const snap=state.snapshot;
  const sources=[
    ['庫存 · Supabase',snap?snap.items.length+' 筆 · 匯入 '+displayTime(snap.imported):state.localPreview?'等待唯讀快照':'實際數量請查看正式庫存',snap?'blue':'gray'],
    ['MagicBuy / KKren / SF Express','現有簽入流程 · 尚未連入預覽','gray'],
    ['Taobao / Aliwangwang','Taobao 存取受限 · 供應商聊天或匯入待核對','amber'],
    ['Google Sheets / 市集','本機演練 · 正式資料流未接入','gray'],
  ];
  return record('資料來源與作業狀態','WORKBENCH STATUS',
    banner(state.localPreview?'示例資料與唯讀庫存快照分開顯示。':'展示商品及作業範例。正式資料在既有庫存工作台。','info')+
    facts(sources.map(([key,value,tone])=>[key,chip(tone==='blue'?'唯讀快照':'待連接',tone)+'<br>'+escape(value)]))+
    group('現有排程 · 台北工作日','<p>09:00 供應商採購檢查 · 11:00 3PL 到貨 · 16:30 出庫歸檔</p>')+
    `<div class="row-buttons">${state.localPreview?button('查看庫存快照','data-go="inventory" data-snapshot="true"','primary','inventory'):''}${liveInventoryLink()}</div>`);
}
function routeDrawer() {
  return record('採購與到貨路線','INBOUND ROUTES',Object.entries(routes).map(([id,[label,route]])=>group('路線 '+id,banner(label+' · '+route,'info'))).join('')+
    '<p>本人確認付款與集運。台灣配送中可準備入庫單，倉庫點收後才核對可用量。</p>');
}
function checkDrawer(state,demo) {
  const rows=demo.shipping.filter(x=>state.selected.shipping.has(x.id));
  const results=rows.map(o=>{
    const stockIssue=o.lines.some(l=>demoStock(knownProducts.get(l.sku),demo).available<l.qty);
    const duplicate=o.status==='shipped'||o.handoff==='已提交';
    const problems=[duplicate?'已有提交紀錄':null,stockIssue?'可用量不足':null,o.error].filter(Boolean);
    return recordLink({label:o.id,detail:problems.join(' · ')||'庫存與重複檢查通過',kind:'shipping',id:o.id,sku:o.lines[0].sku,mark:chip(problems.length?'暫緩':'可準備',problems.length?'amber':'green')});
  });
  return record('出貨批次預檢','PREVIEW CHECK',banner('示例檢查包含庫存、重複提交與已標記的贈品異常。','info')+
    (results.length?`<div class="drawer-list">${results.join('')}</div>`:empty('請先選取出貨訂單。')));
}
function importDrawer() {
  return record('匯入示例訂單','LOCAL IMPORT',
    banner('用範本檢查通路、商品編號、數量及重複訂單。匯入結果只留在此預覽。','info')+
    `<div class="row-buttons">${button('下載 JSON 範本','data-action="import-template"','','download')}</div><label class="fact">選取示例訂單 JSON<input class="field" type="file" id="import-file" accept=".json,application/json"></label><p id="import-status" role="status"></p>`);
}
export function drawerModel(kind,id,state,demo) {
  if(kind==='product'||kind==='snapshot')return productDrawer(kind,id,state,demo);
  if(kind==='sources')return sourcesDrawer(state);
  if(kind==='routes')return routeDrawer();
  if(kind==='shipcheck')return checkDrawer(state,demo);
  if(kind==='import')return importDrawer();
  if(kind==='notifications')return record('通知與作業紀錄','NOTIFICATIONS · 示例',
    related('待辦事項',taskItems(demo).map(t=>({label:t.title,detail:t.subtitle,kind:t.ref[0],id:t.ref[1],sku:t.sku,mark:chip(t.mark,t.tone)})))+
    group('近期操作',`<div class="drawer-list">${activityRows(demo)}</div>`));
  if(kind==='more')return record('更多工作區','PORTOLINK',`<div class="row-buttons">${button('集運','data-go="parcels"','','parcels')}${button('3PL 倉儲','data-go="receiving"','','receiving')}${button('資料來源',openAttrs('sources',''),'','lock')}</div>`);
  const find=(rows,make)=>{const row=rows.find(x=>x.id===id);return row?make(row):null;};
  const factories={
    purchase:()=>find(demo.purchase,x=>purchaseDrawer(x,demo)),supplier:()=>find(suppliers,x=>supplierDrawer(x,demo)),
    shipping:()=>find(demo.shipping,shippingDrawer),parcel:()=>find(demo.parcels,x=>parcelDrawer(x,demo)),
    batch:()=>find(demo.batches,x=>batchDrawer(x,demo)),receiving:()=>find(demo.receiving,x=>receivingDrawer(x,state,demo)),
  };
  return factories[kind]?.()??null;
}
