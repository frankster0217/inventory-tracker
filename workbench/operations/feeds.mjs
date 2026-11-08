import {button, chip, escape, icon, liveInventoryLink, openAttrs, recordLink} from './views.mjs?v=20261108-feeds';

const sources={
  magicbuy:{label:'MagicBuy',url:'https://www.magicbuy.com.tw/app/#/dgorder/list',view:'purchase'},
  kkren:{label:'巧巧郎 KKren',url:'https://www.kkren.com.tw/app/index.html#/parcel',view:'parcels'},
  sf:{label:'順豐速運',url:'https://htm.sf-express.com/tw/tc/dynamic_function/waybill/',view:'parcels'},
  shopee_porto:{label:'Shopee · PORTO 3C',url:'https://seller.shopee.tw/portal/sale/order?type=toship&source=all',view:'shipping'},
  shopee_voicity:{label:'Shopee · VOICity',url:'https://seller.shopee.tw/portal/sale/order?type=toship&source=all',view:'shipping'},
};
const pages={
  dashboard:['營運總覽','查看最近一次查核的採購、物流和出貨。'],
  purchase:['採購','MagicBuy 訂單與已核對的包裹。'],
  parcels:['集運','查看巧巧郎的包裹和順豐直寄進度。'],
  shipping:['出貨','Shopee 賣家中心的待出貨佇列。'],
  inventory:['庫存','從既有庫存工作台查詢現有庫存。'],
  receiving:['3PL 倉儲','物流狀態與 3PL 點收分開追蹤。'],
};
const stageOptions={
  purchase:[['全部','all'],['未付款','未付款'],['已採購','已採購'],['已發貨','已發貨'],['已收貨','已收貨']],
  parcels:[['全部','all'],['巧巧郎','kkren'],['已入庫','已入庫'],['待入庫','待入庫'],['待出貨','待出貨'],['已出貨','已出貨'],['順豐直寄','sf']],
  shipping:[['全部','all'],['PORTO 3C','shopee_porto'],['VOICity','shopee_voicity']],
};
const taipei=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const timestamp=value=>{
  if(!value)return '時間未核對';
  if(/^\d{4}-\d\d-\d\d \d\d:\d\d/.test(value)&&!/[+-]\d\d:?\d\d$/.test(value))return value;
  const time=Date.parse(value);
  return Number.isFinite(time)?taipei.format(time):'時間未核對';
};
const stale=value=>Date.now()-Date.parse(value)>90*60*1000;
const itemList=r=>Array.isArray(r.items)?r.items:[];
const itemLabel=item=>escape(item.variant||item.name)+' × '+escape(item.quantity);
const purchaseItems=items=>items.length
  ?`<ul class="purchase-items">${items.map(item=>`<li><span class="purchase-item"><strong>${escape(item.name)}</strong><span class="purchase-quantity">× ${escape(item.quantity)}</span></span></li>`).join('')}</ul>`
  :'<strong>商品明細待核對</strong>';
function supplierLabel(record) {
  const name=escape(record.supplier||'供應商未核對');
  if(!record.supplier||typeof record.supplier_url!=='string')return name;
  let url;
  try { url=new URL(record.supplier_url); } catch { return name; }
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||
    !/^[a-z0-9-]+\.1688\.com$/.test(url.hostname)||
    /^(www|m|detail|s|air|im|login|trade|qr)\./.test(url.hostname))return name;
  return `<a class="purchase-supplier" href="${escape(url.origin)}/" target="_blank" rel="noopener noreferrer">${name}</a>`;
}
const purchaseMeta=record=>`<dl class="purchase-meta">
  <div><dt>日期</dt><dd>${record.date?`<time>${escape(record.date)}</time>`:'日期未核對'}</dd></div>
  <div><dt>供應商</dt><dd>${supplierLabel(record)}</dd></div>
  <div><dt>寄送地</dt><dd>${escape(record.route||'寄送地未核對')}</dd></div>
  <div><dt>MagicBuy</dt><dd class="purchase-number">${escape(record.id)}</dd></div>
</dl>`;
const trackingEvents=r=>Array.isArray(r.tracking?.events)?r.tracking.events:[];
const latestTracking=r=>trackingEvents(r)[0];
const trackingRef=r=>[r.tracking?.carrier,r.tracking?.waybill].filter(Boolean).join(' ');
const timeline=events=>`<ol class="feed-tracking-history">${events.map(event=>`<li><time>${escape(timestamp(event.at))}</time><strong>${escape(event.text)}</strong></li>`).join('')}</ol>`;
const trackingHistory=r=>`<section><h3>物流進度</h3>
  <p>${escape(trackingRef(r))} · 巧巧郎${r.tracking.checkedAt?' · 查核 '+escape(timestamp(r.tracking.checkedAt)):''}</p>
  ${timeline(trackingEvents(r))}</section>`;
const waybills=r=>Array.isArray(r.waybills)?r.waybills:r.waybill?[r.waybill]:[];
const parcelMembers=r=>Array.isArray(r.members)?r.members:[];
const declaredNames=member=>Array.isArray(member.declared)?member.declared:[];
const supplierScans=r=>Array.isArray(r.supplierTracking)?r.supplierTracking.filter(scan=>
  waybills(r).includes(scan.waybill)&&Array.isArray(scan.events)&&scan.events.length):[];
const isShipment=source=>source==='kkren'||source==='sf';
const isConsolidation=r=>r.status==='待出貨'||r.status==='已出貨';
const parcelRefs=r=>[...waybills(r),...parcelMembers(r).map(member=>member.waybill)];
const matchesMember=(member,purchase)=>member.purchaseId?member.purchaseId===purchase.id:waybills(purchase).includes(member.waybill);
const recordKey=(source,id)=>source+'|'+id;
const sourceRows=feeds=>feeds.flatMap(feed=>(Array.isArray(feed.records)?feed.records:[]).map(record=>({feed,source:feed.source,record})));
const sourceLink=(source,r={})=>{
  const url=source.startsWith('shopee_')&&/^\/portal\/sale\/order\/\d+$/.test(r.href??'')
    ?'https://seller.shopee.tw'+r.href:sources[source].url;
  return `<a class="button" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${icon('link')} 開啟來源</a>`;
};
const badge=status=>chip(status,status==='未付款'||status==='待出貨'?'amber':status==='已入庫'?'green':'gray');
const feedStatus=feed=>`<span class="feed-time">${escape(feed?timestamp(feed.observed_at):'等待首次查核')}${feed&&stale(feed.observed_at)?' · 更新逾時':''}</span>`;
const searchText=r=>[r.id,r.supplier,r.status,r.route,trackingRef(r),latestTracking(r)?.text,...supplierScans(r).map(scan=>scan.events[0].text),...parcelRefs(r),...parcelMembers(r).flatMap(declaredNames),...itemList(r).flatMap(item=>[item.name,item.variant,item.sku,item.source_name])].filter(Boolean).join(' ');
const recordsFor=(feeds,view)=>sourceRows(feeds).filter(row=>sources[row.source]?.view===view);
function matchesShipment(shipment,purchase) {
  if(shipment.source==='sf'&&purchase.route!=='順豐直寄台灣')return false;
  if(shipment.source==='kkren'&&purchase.route==='順豐直寄台灣')return false;
  const r=shipment.record;
  return waybills(r).some(number=>waybills(purchase).includes(number))||
    parcelMembers(r).some(member=>matchesMember(member,purchase));
}
function matchesFor(feeds,source,record) {
  const rows=sourceRows(feeds);
  if(source==='magicbuy'){
    const shipments=rows.filter(row=>isShipment(row.source)&&matchesShipment(row,record));
    const consolidated=new Set(shipments.flatMap(row=>parcelMembers(row.record).map(member=>member.waybill)));
    return shipments.filter(row=>row.source!=='kkren'||isConsolidation(row.record)||!consolidated.has(row.record.waybill));
  }
  return isShipment(source)?rows.filter(row=>row.source==='magicbuy'&&matchesShipment({source,record},row.record)):[];
}
function shipmentContents(row,purchases) {
  const {source,record:r}=row;
  const consolidated=source==='kkren'&&isConsolidation(r);
  const members=consolidated?parcelMembers(r):waybills(r).map(waybill=>({waybill}));
  const parcels=members.map(member=>{
    const candidates=purchases.filter(p=>matchesMember(member,p.record));
    const purchase=candidates.length===1?candidates[0].record:null;
    if(purchase&&Array.isArray(member.items)&&member.items.length){
      const items=member.items.map(part=>{
        const item=itemList(purchase).find(item=>item.sku===part.sku);
        return {...item,...part,name:item?.name??part.sku};
      });
      return {...member,items};
    }
    const items=purchase&&waybills(purchase).length===1&&waybills(purchase)[0]===member.waybill
      ?itemList(purchase):[];
    return {...member,items};
  });
  const unresolved=parcels.filter(parcel=>!parcel.items.length);
  return {parcels,items:parcels.flatMap(parcel=>parcel.items),
    declared:[...new Set(unresolved.flatMap(declaredNames))],
    pending:unresolved.filter(parcel=>!declaredNames(parcel).length).length+Math.max(0,(Number(r.packageCount)||0)-members.length)};
}
function manifestContents(contents) {
  return `<section><h3>集運商品</h3>${contents.parcels.map(parcel=>{
    const declared=declaredNames(parcel);
    return `<div class="feed-parcel-group"><p><b>${escape([parcel.carrier,parcel.waybill].filter(Boolean).join(' '))}</b></p>
      ${parcel.items.length?purchaseItems(parcel.items):declared.length?`<p>申報品名（數量未核對）</p><ul class="feed-items">${declared.map(name=>`<li>${escape(name)}</li>`).join('')}</ul>`:'<p>商品明細待核對</p>'}</div>`;
  }).join('')}</section>`;
}
function shipmentEvent(source,r) {
  const event=latestTracking(r);
  if(event)return event;
  if(source==='sf')return {text:r.status??'順豐物流待核對',at:r.eventAt};
  const labels={'已入庫':'巧巧郎倉庫已收件','待入庫':'等待巧巧郎倉庫收件','待出貨':'等待集運出貨'};
  return {text:labels[r.status]??'等待物流掃描',at:r.eventAt};
}
function shipmentLabel(source,r) {
  const number=trackingRef(r)||waybills(r).join('、');
  return [sources[source].label,number||r.id].filter(Boolean).join(' · ');
}
const isSfWaybill=number=>/^SF[0-9]{10,18}$/.test(number);
const sfWaybillLink=number=>isSfWaybill(number)
  ?`<a class="button" href="${sources.sf.url}#search/bill-number/v/${number}" target="_blank" rel="noopener noreferrer">${icon('link')} 順豐查運單 ${number}</a>`:'';
function shipmentLinks(shipments) {
  return shipments.length?`<div class="drawer-list">${shipments.map(({source,record})=>{
    const event=shipmentEvent(source,record);
    return recordLink({label:event.text,detail:[shipmentLabel(source,record),event.at?timestamp(event.at):''].filter(Boolean).join(' · '),kind:'feed',id:recordKey(source,record.id)});
  }).join('')}</div>`:'';
}
function orderTracking(r,shipments) {
  const bills=waybills(r);
  const scans=supplierScans(r);
  const firstLeg=shipments.filter(row=>row.source==='sf'||!isConsolidation(row.record));
  const onward=shipments.filter(row=>row.source==='kkren'&&isConsolidation(row.record));
  const scanned=new Set([...scans.map(scan=>scan.waybill),...firstLeg.flatMap(row=>waybills(row.record))]);
  const registered=new Set(onward.flatMap(row=>parcelRefs(row.record)));
  const pending=bills.filter(number=>!scanned.has(number));
  const direct=r.route==='順豐直寄台灣';
  return `<section><h3>物流追蹤</h3><h4>供應商 → ${direct?'台灣':r.route==='漳州倉集運'?'漳州倉':'目的地待核對'}</h4>
    ${bills.length?'<p>賣家運單 '+bills.map(escape).join('、')+'</p>':'<p>等待賣家提供運單。</p>'}
    ${scans.map(scan=>`<div class="feed-parcel-group"><p><b>${escape(scan.waybill)}</b> · MagicBuy 運單掃描${scan.checkedAt?' · 查核 '+escape(timestamp(scan.checkedAt)):''}</p>${timeline(scan.events)}</div>`).join('')}
    ${shipmentLinks(firstLeg)}
    ${pending.map(number=>`<p>${escape(number)} · ${registered.has(number)?'已核對入倉並列入集運，暫無境內掃描明細':'尚無已核對的快遞掃描'}</p>`).join('')}
    <div class="feed-tracking-actions">${bills.map(sfWaybillLink).join(' ')}${pending.some(number=>!isSfWaybill(number))&&/^\d{10,20}$/.test(r.id)?`<a class="button" href="https://www.magicbuy.com.tw/app/#/dgorder/detail/${r.id}" target="_blank" rel="noopener noreferrer">開啟 MagicBuy 運單來源</a>`:''}</div>
    ${onward.length?`<h4>集運 → 台灣</h4>${shipmentLinks(onward)}`:''}
    </section>`;
}
function lineLabel(record) {
  const items=itemList(record);
  if(!items.length)return record.packageCount?record.packageCount+' 個包裹':record.weight??'未核對商品明細';
  return items.map(itemLabel).join('、');
}
function feedRow(row,feeds,contents) {
  const {source,record:r}=row;
  const related=matchesFor(feeds,source,r);
  const linked=related.map(x=>x.record.status).filter(Boolean).join(' · ');
  const details=[r.supplier,r.date,r.route,r.deadline?'出貨期限 '+r.deadline:null,r.eventAt?timestamp(r.eventAt):null,linked].filter(Boolean).map(escape).join(' · ');
  const meta=`<small>${escape(r.id)}${details?' · '+details:''}</small>`;
  const status=badge(r.status??'待核對');
  const open=openAttrs('feed',recordKey(source,r.id));
  if(source==='magicbuy')return `<div class="record-link feed-row purchase-order">
    <div class="purchase-products">${purchaseItems(itemList(r))}${linked?`<p class="purchase-tracking">${escape(linked)}</p>`:''}</div>
    ${purchaseMeta(r)}
    <button class="purchase-open" type="button" ${open} aria-label="查看訂單 ${escape(r.id)}，${escape(r.status??'待核對')}">${status}${icon('chevron')}</button></div>`;
  if(isShipment(source)){
    const event=shipmentEvent(source,r);
    const pending=contents.pending?'<small>'+contents.pending+' 件包裹的商品待核對</small>':'';
    const declared=contents.declared.length?`<span class="shipment-products"><b>${contents.declared.map(escape).join('、')}</b><small>巧巧郎申報品名 · 數量未核對</small></span>`:'';
    const details=[event.at?timestamp(event.at):null,shipmentLabel(source,r)].filter(Boolean).map(escape).join(' · ');
    return `<button class="record-link feed-row shipment-row" ${open}><span class="task-text">
      ${contents.items.length?`<span class="shipment-products">${contents.items.map(item=>`<span><b>${escape(item.sku||item.source_name||item.name)}</b> × ${escape(item.quantity)}</span>`).join('')}</span>`:declared?'':'<strong>商品與數量待核對</strong>'}
      ${declared}${pending}<span class="shipment-event">${escape(event.text)}</span><small>${details}</small></span>
      ${status}${icon('chevron')}</button>`;
  }
  return `<button class="record-link feed-row" ${open}>
    <span class="task-text"><strong>${lineLabel(r)}</strong>${meta}</span>
    ${status}${icon('chevron')}</button>`;
}
function sourceSummary(feeds) {
  return `<section class="card"><header class="panel-head"><h2>實際作業來源</h2></header>${Object.entries(sources).map(([source,spec])=>{
    const feed=feeds.find(f=>f.source===source);
    const count=feed?.records?.length;
    return `<button class="record-link" data-go="${spec.view}" data-jump="${source.startsWith('shopee')?source:source==='sf'?'sf':'all'}"><span class="task-text"><strong>${spec.label}${Number.isInteger(count)?' · '+count+' 筆':''}</strong><small>${escape(feed?.coverage??'等待首次查核')}</small></span>${feedStatus(feed)}${icon('chevron')}</button>`;
  }).join('')}</section>`;
}
export function feedView(view,state) {
  const [title,purpose]=pages[view];
  const {rows:feeds,status:mode,error}=state.feed;
  const heading=`<header class="page-head"><div><h1>${title}</h1><p>${purpose}</p></div><div class="head-tools">${mode==='ready'?button('讀取最新同步','data-action="refresh-feed"','','refresh'):''}</div></header>`;
  if(view==='inventory')return heading+`<section class="card feed-panel">${liveInventoryLink()}</section>`;
  if(mode==='signed-out')return heading+`<section class="card feed-panel"><h2>登入 Portolink</h2><p>使用原本的庫存工作台帳號，即可查看私人採購、物流和 Shopee 訂單。</p>
    <form id="feed-login"><label>電子郵件<input class="field" name="email" type="email" autocomplete="username" required></label><label>密碼<input class="field" name="password" type="password" autocomplete="current-password" required></label>
    ${button('登入','','primary').replace('type="button"','type="submit"')}<p class="feed-message" role="status"></p></form></section>`;
  if(mode!=='ready')return heading+`<section class="card feed-panel" role="status"><p>${escape(error??'正在讀取私人作業資料…')}</p>${mode==='error'?button('重新讀取','data-action="refresh-feed"','','refresh'):''}</section>`;
  if(view==='dashboard')return heading+sourceSummary(feeds);
  if(view==='receiving')return heading+`<section class="card feed-panel"><h2>3PL 入庫單</h2><p>從集運查核配送狀態，入庫與點收請使用既有工作表。</p>
    ${button('查看物流','data-go="parcels"')} <a class="button" href="https://docs.google.com/spreadsheets/d/1Aoq9QANYCQfNqam4ldaoMv4q6TaqQQ-wfcadzaKdEiE/edit" target="_blank" rel="noopener noreferrer">開啟入庫單</a></section>`;
  const rows=recordsFor(feeds,view);
  if(view==='shipping')rows.sort((a,b)=>(a.record.deadline??'9999').localeCompare(b.record.deadline??'9999'));
  if(view==='parcels')rows.sort((a,b)=>{
    const aTime=latestTracking(a.record)?.at??'';
    const bTime=latestTracking(b.record)?.at??'';
    return bTime.localeCompare(aTime);
  });
  const filter=(row,key)=>key==='all'||row.source===key||row.record.status===key;
  const query=state.query.trim().toLocaleLowerCase();
  const filtered=rows.filter(row=>filter(row,state.filter)).map(row=>({
    row,contents:view==='parcels'?shipmentContents(row,matchesFor(feeds,row.source,row.record)):null,
  })).filter(({row,contents})=>[searchText(row.record),...((contents?.items??[]).flatMap(item=>[item.sku,item.name]))].join(' ').toLocaleLowerCase().includes(query));
  const options=stageOptions[view];
  const feedKeys=Object.keys(sources).filter(key=>sources[key].view===view);
  const tools=`<div class="stages" role="group" aria-label="作業狀態">${options.map(([label,key])=>`<button class="tab" type="button" data-filter="${key}" aria-pressed="${state.filter===key}">${label}<span class="tab-count">${key.startsWith('shopee')&&!feeds.some(feed=>feed.source===key)?'—':rows.filter(row=>filter(row,key)).length}</span></button>`).join('')}</div>
    <div class="work-tools"><label class="search-field">${icon('search')}<input class="field" id="view-query" type="text" inputmode="search" placeholder="搜尋商品、訂單或運單" aria-label="搜尋商品、訂單或運單" value="${escape(state.query)}"></label></div>`;
  const metadata=feedKeys.map(key=>{const feed=feeds.find(row=>row.source===key);return `<span>${sources[key].label} · ${feedStatus(feed)}</span>`;}).join('');
  const trackingChecked=view==='parcels'?rows.reduce((max,row)=>{
    const checked=row.record.tracking?.checkedAt;
    return checked&&checked>max?checked:max;
  },''):'';
  const trackingMeta=trackingChecked?`<span>巧巧郎物流明細 · ${feedStatus({observed_at:trackingChecked})}</span>`:'';
  const notes=feeds.filter(f=>feedKeys.includes(f.source)).map(f=>f.coverage).join('。');
  const scopeUnavailable=state.filter.startsWith('shopee')&&!feeds.some(f=>f.source===state.filter);
  return heading+tools+`<div class="feed-metadata" aria-label="來源與更新時間">${metadata}${trackingMeta}</div>`+
    (filtered.length?`<section class="card">${filtered.map(({row,contents})=>feedRow(row,feeds,contents)).join('')}</section>`:`<div class="empty">${!rows.length||scopeUnavailable?'等待來源查核。':'此篩選沒有符合的紀錄。'}</div>`)+
    `<details class="feed-scope"><summary>查核範圍與原始來源</summary><p>${escape(notes||'尚未取得來源紀錄。')}</p>${feedKeys.map(key=>sourceLink(key)).join(' ')}</details>`;
}
export function feedDrawer(id,state) {
  if(state.feed.status!=='ready')return null;
  if(id==='sources')return {title:'資料來源',eyebrow:'私人資料',body:sourceSummary(state.feed.rows)};
  const row=sourceRows(state.feed.rows).find(x=>recordKey(x.source,x.record.id)===id);
  if(!row)return null;
  const {source,record:r,feed}=row;
  const related=matchesFor(state.feed.rows,source,r);
  const isPurchase=source==='magicbuy';
  const isKkren=source==='kkren';
  const shipment=isShipment(source);
  const contents=shipment?shipmentContents(row,related):null;
  const products=shipment&&parcelMembers(r).length?manifestContents(contents):`<section><h3>商品</h3>${isPurchase||shipment?purchaseItems(contents?.items??itemList(r)):`<ul class="feed-items">${itemList(r).map(item=>`<li>${itemLabel(item)}${item.variant&&item.name!==item.variant?`<small>${escape(item.name)}</small>`:''}</li>`).join('')||'<li>商品明細待核對</li>'}</ul>`}</section>`;
  return {title:isPurchase?'採購明細':r.id,eyebrow:sources[source].label,body:`
    <div class="legend">${badge(r.status??'待核對')} ${feedStatus(feed)}</div>
    ${isPurchase||shipment?products:''}
    ${isPurchase?orderTracking(r,related):''}
    ${shipment&&contents.pending?`<p>${contents.pending} 件包裹的商品待核對</p>`:''}
    ${isKkren&&latestTracking(r)?trackingHistory(r):shipment?`<section><h3>物流進度</h3><p>${escape(shipmentEvent(source,r).text)}${r.eventAt?' · '+escape(timestamp(r.eventAt)):''}</p>${source==='sf'?waybills(r).map(sfWaybillLink).join(' '):''}</section>`:''}
    <section><h3>紀錄明細</h3>${isPurchase?purchaseMeta(r):`<p>${[r.supplier,r.date,r.route,r.deadline?'出貨期限 '+r.deadline:null,r.eventAt?timestamp(r.eventAt):null,r.eta?'預計送達 '+r.eta:null,r.weight].filter(Boolean).map(escape).join(' · ')}</p>`}
    <p>${waybills(r).length?'運單 '+waybills(r).map(escape).join('、'):''}</p></section>
    ${isPurchase||shipment?'':products}
    ${!isPurchase&&related.length?`<section><h3>運單相符的紀錄</h3><div class="drawer-list">${related.map(x=>recordLink({label:x.record.id,detail:sources[x.source].label+' · '+x.record.status,kind:'feed',id:recordKey(x.source,x.record.id)})).join('')}</div></section>`:''}
    <div>${sourceLink(source,r)}</div>`};
}
export function feedSearch(state) {
  if(state.feed.status!=='ready')return [];
  return sourceRows(state.feed.rows).filter(row=>sources[row.source]).map(({source,record})=>({
    label:record.id,detail:sources[source].label+' · '+searchText(record),kind:'feed',id:recordKey(source,record.id),
  }));
}
