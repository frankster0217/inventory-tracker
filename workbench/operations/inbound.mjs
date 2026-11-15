import {button,chip,escape,icon,openAttrs} from './views.mjs?v=20261116-tracking';

const when=value=>value?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)):'尚未核對';
const expired=value=>!value||Date.now()-Date.parse(value)>24*3600000;
const records=feed=>(feed?.records??[]).filter(r=>r.kind==='shipment');
const run=feed=>feed?.records?.find(r=>r.kind==='run');
const problem=r=>r.hold||!r.items.length||r.warehouseCountPending||(r.entered&&!r.historyVerified);
const stateLabel=r=>r.hold?'待確認':r.warehouseCountPending?'件數待核對':r.entered&&!r.historyVerified?'入庫紀錄待核對':r.entered?'已填單 · 待點收':r.items.length?'追蹤中':'內容待核對';
const products=r=>r.items.length?r.items.map(item=>`<span><strong>${escape(item.sku||item.name)}</strong> × ${escape(item.quantity)}</span>`).join(''):'<span>包裹內容尚未核對</span>';
const sheetState=r=>!r.entered?'尚未填單':r.historyVerified?'已填單 · 歷史已讀回':'已填單 · 歷史待核對';
const stamp=feed=>{
  const check=run(feed);
  return `<p class="inventory-notice" role="status">物流查核 ${escape(when(check?.trackingCheckedAt))}${expired(check?.trackingCheckedAt)?' · 資料待更新':''}。簽收、入庫單與倉庫點收分開記錄。</p>`;
};
const matches=(r,filter)=>filter==='all'||filter==='following'&&!r.entered&&!r.hold||filter==='submitted'&&r.entered||filter==='review'&&problem(r);
export function inboundSummary(feed){
  if(!feed)return '';
  const check=run(feed),rows=records(feed),issues=rows.filter(problem).sort((a,b)=>String(b.lastEvent?.at??'').localeCompare(String(a.lastEvent?.at??''))).slice(0,4),active=check?.currentItems??[];
  return `<section class="card inbound-overview"><header class="panel-head"><h2>入庫進度</h2>${button('查看入庫紀錄','data-go="receiving"','','arrow')}</header>${stamp(feed)}
    <div class="inbound-batch"><strong>最近批次 ${escape(check?.activeDate??'未確認')}</strong><span>${active.reduce((n,p)=>n+p.quantity,0)} 件已填單</span><small>待到貨 ${check?.pendingLines??'—'} 項 · ${check?.pendingUnits??'—'} 件</small></div>
    ${issues.map(r=>`<button class="record-link" ${openAttrs('feed','inbound|'+r.id)}><span class="task-text"><strong>${escape(r.items.map(i=>i.sku||i.name).join('、')||r.reference)}</strong><small>${escape(stateLabel(r))} · ${escape(r.reference)}</small></span>${icon('chevron')}</button>`).join('')}</section>`;
}
export function receivingView(state,feed){
  if(!feed)return '<div class="empty">尚未取得入庫追蹤資料，請重新讀取。</div>';
  const all=records(feed),filter=['all','following','submitted','review'].includes(state.filter)?state.filter:'all';
  const query=state.query.trim().toLocaleLowerCase();
  const rows=all.filter(r=>matches(r,filter)).filter(r=>[r.reference,...r.waybills,...r.items.flatMap(i=>[i.sku,i.name])].join(' ').toLocaleLowerCase().includes(query))
    .sort((a,b)=>Number(problem(b))-Number(problem(a))||String(b.effectiveDate??b.lastEvent?.at??'').localeCompare(String(a.effectiveDate??a.lastEvent?.at??'')));
  const check=run(feed);
  return `<div class="stages" aria-label="入庫狀態">${[['all','全部'],['following','追蹤中'],['submitted','已填入庫單'],['review','待核對']].map(([value,label])=>`<button class="tab" data-filter="${value}" aria-pressed="${filter===value}">${label}<span class="tab-count">${all.filter(r=>matches(r,value)).length}</span></button>`).join('')}</div>
    <div class="work-tools"><label class="search-field">${icon('search')}<input class="field" id="view-query" aria-label="搜尋入庫商品或運單" placeholder="搜尋商品、SKU 或運單" value="${escape(state.query)}"></label></div>
    ${stamp(feed)}<div class="feed-metadata"><span>工作表讀回 ${escape(when(check?.sheetsCheckedAt))}</span><span>目前批次 ${escape(check?.activeDate??'未確認')}</span></div>
    ${rows.length?`<div class="table-shell card inbound-table-shell"><table class="table inbound-table"><thead><tr><th>商品 / 包裹</th><th>物流</th><th>入庫單</th><th>倉庫點收</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button class="stock-item inbound-products" ${openAttrs('feed','inbound|'+r.id)}>${products(r)}<small>${escape(r.reference)}${r.batchScope?' · 同批合計':''}</small></button></td>
      <td><span class="mobile-column">物流 </span><strong>${escape(r.carrierStatus)}</strong><small>${escape(r.lastEvent?.text??'等待物流查核')}</small>${r.lastEvent?.at?`<time>${escape(when(r.lastEvent.at))}</time>`:''}</td>
      <td><span class="mobile-column">入庫單 </span>${escape(sheetState(r))}<small>${escape(r.effectiveDate??'')}${r.hold?' · 待確認':''}</small></td>
      <td><span class="mobile-column">倉庫點收 </span>${r.warehouseConfirmedQuantity===null?'未確認':escape(r.warehouseConfirmedQuantity)}${problem(r)?chip(stateLabel(r),'amber'):''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">沒有符合此篩選的入庫紀錄。</div>'}`;
}
export function receivingDrawer(record,feed){
  return {title:record.items.map(i=>i.sku||i.name).join('、')||record.reference,eyebrow:'3PL 入庫追蹤',body:`
    ${stamp(feed)}<div class="legend">${chip(stateLabel(record),problem(record)?'amber':'gray')}</div>
    <section><h3>商品與數量</h3><div class="inbound-products">${products(record)}</div>${record.quantityAllocationNote?`<p>${escape(record.quantityAllocationNote)}</p>`:''}</section>
    <section><h3>物流</h3><p><strong>${escape(record.carrierStatus)}</strong></p><p>${escape(record.lastEvent?.text??'等待來源更新')}</p><p>${escape(when(record.lastEvent?.at))}</p><p>本票查核 ${escape(when(record.checkedAt))}</p><p>${record.waybills.map(escape).join('、')}</p></section>
    <section><h3>入庫與點收</h3><p>${escape(sheetState(record))}${record.effectiveDate?' · '+escape(record.effectiveDate):''}</p><p>倉庫確認數量：${record.warehouseConfirmedQuantity===null?'尚未確認':escape(record.warehouseConfirmedQuantity)}</p>${record.warehouseCountPending?'<p>承運件數與境內包裹數待核對，未推定全數收齊。</p>':''}${record.holdReason?`<p>${escape(record.holdReason)}</p>`:''}</section>
    <details><summary>包裹關聯</summary><p>${escape(record.reference)}</p><p>${record.sellerWaybills.map(escape).join('、')}</p></details>`};
}
