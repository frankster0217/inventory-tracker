import {buildWorkbench,buildTrackerPlan,buildReport,groupBySupplier,PAID,UNPAID} from './core.mjs';
import {SUPABASE_URL,PUBLIC_KEY,loadSnapshot,saveSkuPreferences} from './data.mjs';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v===null||v===undefined?'—':Number(v).toLocaleString('zh-TW',{maximumFractionDigits:1});
const stamp=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'尚未確認';
const isPreview=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('preview')==='1';
const labels = { today: '今日採購', incoming: '採購與到貨', quality: '待整理', catalog: '商品' };
let client, snapshot, model, trackerPlan, tab = location.hash.slice(1) || 'today';
let query = '', filter = tab === 'today' && !isPreview ? 'ready' : 'all', issueLimit = 60, settings = {}, selectedSupplier = null, lastLoadAt = 0;
try { settings = JSON.parse(localStorage.getItem('workbench-settings') || '{}'); } catch {}

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  setTimeout(() => $('toast').hidden = true, 3500);
}

function badge(text, color = 'neutral') {
  return `<span class="badge ${color}">${esc(text)}</span>`;
}

function empty(title, detail = '') {
  return `<div class="empty"><strong>${esc(title)}</strong>${detail ? `<p>${esc(detail)}</p>` : ''}</div>`;
}

function search(placeholder = '搜尋商品或供應商') {
  return `<input id="workbench-search" class="search" type="search" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}" value="${esc(query)}">`;
}

function matches(p) {
  const term = query.trim().toLowerCase();
  return !term || [p.code, p.name, p.supplier, p.detail, p.title].join(' ').toLowerCase().includes(term);
}

function sourceBar() {
  const {stock, sales, purchases, purchasesComplete} = model.sources;
  $('sourcebar').innerHTML = [
    ['庫存', stamp(stock.timestamp), stock.fresh],
    ['銷售', stamp(sales.timestamp), sales.fresh],
    ['採購對帳', purchasesComplete ? stamp(purchases.timestamp) : '待核對', purchasesComplete],
  ].map(([label, value, ready]) => `<span class="source"><i class="dot ${ready ? '' : 'warn'}"></i><b>${label}</b> ${esc(value)}</span>`).join('');
  $('purchase-settings').innerHTML = `<div class="rule-settings">
    <label>目標庫存 <input data-setting="targetWeeks" aria-label="目標庫存週數" type="number" min="1" max="26" step="0.5" value="${model.cfg.targetWeeks}"> 週</label>
    <label>運送預留 <input data-setting="leadTimeDays" aria-label="預留運送天數" type="number" min="0" max="60" value="${model.cfg.leadTimeDays}"> 天</label>
    ${trackerPlan ? `<label>最低採購量 <input data-setting="minOrderQty" aria-label="最低採購量" type="number" min="1" max="50" value="${model.cfg.minOrderQty ?? 5}"> 件</label>` : ''}
  </div><p class="muted">以近 60 天銷量估算需求，再扣除庫存與已記錄的未到貨量。</p>`;
}

function stats() {
  const {ready, incoming, unpaid, issues} = model.stats;
  const complete = model.sources.purchasesComplete;
  const needsReview = model.issues.some(issue => issue.severity === 'block');
  const restock = trackerPlan?.filter(row => row.quantityToBuy > 0).length;
  return `<section class="stats" aria-label="採購概況">
    <button class="stat ${(restock ?? ready) ? 'emphasis' : ''}" data-filter="${trackerPlan || ready || !needsReview ? 'ready' : 'review'}"><span>需補貨</span><strong>${snapshot.tracker?.error ? '—' : restock ?? (!ready && needsReview ? '待核對' : ready)}</strong></button>
    <button class="stat" data-tab="incoming"><span>已付款未到</span><strong>${complete ? incoming : '待對帳'}</strong></button>
    <button class="stat" data-action="unpaid"><span>待付款</span><strong>${unpaid || (complete ? '0' : '—')}</strong></button>
    <button class="stat" data-tab="quality"><span>待整理</span><strong>${issues}</strong></button>
  </section>`;
}

function purchaseNotice() {
  if (model.sources.purchasesComplete && tab === 'incoming') return '';
  if (!model.sources.purchasesComplete) {
    const message = tab === 'today' && trackerPlan ? '在途未對帳 · 建議量為估算' : '已購訂單待對帳';
    return `<div class="notice"><strong>${message}</strong>${tab === 'today' ? '<button class="button" data-tab="incoming">核對訂單 →</button>' : ''}</div>`;
  }
  if (model.issues.some(issue => issue.severity === 'block')) {
    return '<div class="notice"><strong>資料待核對</strong><button class="button" data-tab="quality">查看待辦 →</button></div>';
  }
  return '';
}

function productCell(label, value, className = '') {
  return `<td class="metric ${className}"><span class="cell-label" aria-hidden="true">${label}</span>${value}</td>`;
}

function productRow(p, mode) {
  const priority = mode === 'buy' && p.urgent && (trackerPlan ? p.quantityToBuy > 0 : p.actionable) ? badge('優先', 'red') : '';
  const product = `<td class="product-cell"><button class="product-button" data-product="${esc(p.code)}">${esc(p.code)}</button>${priority}</td>`;
  const stock = productCell('庫存', fmt(p.quantity), p.quantity === 0 ? 'stock-red' : '');
  if (mode === 'catalog') {
    const status = p.archived ? badge('已封存') : p.issues.length ? badge(p.issues[0], 'amber') : '—';
    return `<tr>${product}${stock}${productCell('狀態', status)}</tr>`;
  }
  if (trackerPlan) {
    const estimate = p.quantityToBuy > 0 ? `<strong class="buy-number">${fmt(p.quantityToBuy)}</strong>`
      : p.rawNeed > 0 ? badge(`低於門檻 (${fmt(p.rawNeed)})`) : '—';
    return `<tr>${product}${stock}${productCell('記錄未到', fmt(p.pending))}${productCell('建議買', estimate)}</tr>`;
  }
  const pending = model.sources.purchasesComplete ? fmt(p.pending) : '—';
  const suggestion = p.actionable && p.rawNeed
    ? `<strong class="buy-number">${fmt(p.quantityToBuy)}</strong>`
    : p.rawNeed ? badge('待核對', 'amber') : '—';
  return `<tr>${product}${stock}${productCell('未到', pending)}${productCell('建議買', suggestion)}</tr>`;
}

function productTable(rows, mode) {
  const columns = mode === 'catalog' ? ['庫存', '狀態'] : ['庫存', trackerPlan ? '記錄未到' : '未到', '建議買'];
  return `<table class="data-table ${mode}-table"><thead><tr><th scope="col">商品</th>${columns.map(col => `<th scope="col">${col}</th>`).join('')}</tr></thead><tbody>${rows.map(p => productRow(p, mode)).join('')}</tbody></table>`;
}

function purchaseGroups() {
  if (trackerPlan) {
    const rows = trackerPlan.filter(row => matches(row) && (
      filter === 'ready' ? row.quantityToBuy > 0 : filter === 'urgent' ? row.urgent : true
    ));
    return groupBySupplier(rows, snapshot.suppliers);
  }
  const rows = model.candidates.filter(p => matches(p) && (
    filter === 'ready' ? p.actionable : filter === 'urgent' ? p.urgent :
    filter === 'review' ? !p.actionable : true
  ));
  return groupBySupplier(rows, snapshot.suppliers);
}

function canCopyPurchaseList(group) {
  return group.rows.every(row => row.quantityToBuy > 0 && (
    trackerPlan ? model.products.some(product => product.code === row.code && product.actionable &&
      product.quantityToBuy === row.quantityToBuy && product.pending === row.pending && product.supplier_id === row.supplier_id)
      : row.actionable
  ));
}

function supplierView(groups, mode = 'buy') {
  if (!groups.length) return empty('沒有符合的商品');
  const selected = groups.find(group => group.id === selectedSupplier);
  if (selected) {
    const copy = mode === 'buy' && canCopyPurchaseList(selected)
      ? `<button class="button primary" data-copy-supplier="${esc(selected.id)}">複製採購清單</button>` : '';
    const total = mode === 'buy' && trackerPlan && selected.totalQty ? ` · 建議 ${fmt(selected.totalQty)} 件` : '';
    return `<div class="supplier-selection"><button class="button" data-action="all-suppliers">← 供應商</button></div>
      <section class="supplier-card">
        <header class="selected-supplier-heading"><div><h2>${esc(selected.name)}</h2><span class="muted">${selected.rows.length} 項商品${total}</span></div>${copy}</header>
        ${productTable(selected.rows, mode)}
      </section>`;
  }
  return `<div class="supplier-overview-heading"><h2>供應商</h2><span class="muted">${groups.length} 組</span></div>
    <div class="supplier-grid">${groups.map(g => {
      const urgent = g.rows.filter(row => row.urgent && row.rawNeed > 0 && (trackerPlan ? row.quantityToBuy > 0 : row.actionable)).length;
      const status = !g.id ? badge('待指派', 'amber')
        : mode === 'buy' && urgent ? badge(`${urgent} 項優先`, 'red') : '';
      return `<button class="supplier-tile ${g.id ? '' : 'unassigned-tile'}" data-supplier="${esc(g.id)}">
        <span class="supplier-tile-name">${esc(g.name)}</span>
        <span class="supplier-tile-meta"><span>${g.rows.length} 項商品${mode === 'buy' && trackerPlan && g.totalQty ? ` · ${fmt(g.totalQty)} 件` : ''}</span>${status}</span>
        <span class="tile-arrow" aria-hidden="true">›</span>
      </button>`;
    }).join('')}</div>`;
}

function filters(options) {
  return `<div class="filters">${Object.entries(options).map(([value, label]) =>
    `<button class="filter ${filter === value ? 'active' : ''}" data-filter="${value}" aria-pressed="${filter === value}">${label}</button>`
  ).join('')}</div>`;
}

function today() {
  if (snapshot.tracker?.error) return stats() + empty('補貨資料未載入', snapshot.tracker.error);
  const options = trackerPlan ? {ready: '需補貨', all: '全部', urgent: '低庫存'}
    : {all: '全部', ready: '需補貨', review: '待核對', urgent: '低庫存'};
  const groups = purchaseGroups();
  const showingSupplier = groups.some(group => group.id === selectedSupplier);
  return (showingSupplier ? '' : stats()) + purchaseNotice() + `<div class="toolbar">${search()}
    <select id="purchase-filter" class="select" aria-label="採購篩選">${Object.entries(options).map(([value, label]) =>
      `<option value="${value}" ${filter === value ? 'selected' : ''}>${label}</option>`
    ).join('')}</select></div>` + supplierView(groups);
}

function incoming() {
  const term = query.trim().toLowerCase();
  const orders = model.orders.filter(order =>
    filter === 'unpaid' ? UNPAID.has(order.status) : filter === 'paid' ? PAID.has(order.status) : true
  ).filter(order => !term || [order.supplier_name, order.source_order_id, ...order.items.flatMap(item => [item.code, item.name])].join(' ').toLowerCase().includes(term));
  return `<div class="toolbar">${search('搜尋商品、供應商或訂單')}${filters({all: '全部', unpaid: '待付款', paid: '已付款'})}</div>
    ${orders.length ? purchaseNotice() + orders.map(orderCard).join('') :
      empty(model.sources.purchasesComplete ? '沒有符合的訂單' : '採購記錄待對帳', model.sources.purchasesComplete ? '' : '請核對 MagicBuy 訂單。')}`;
}

function orderCard(order) {
  const received = ['arrived', 'received', 'delivered'].includes(order.status);
  const meta = [order.order_date, order.destination].filter(Boolean).join(' · ');
  const details = [
    order.source_order_id && `訂單 ${order.source_order_id}`,
    order.tracking && `物流 ${order.tracking}`,
    order.last_verified_at && `核對 ${stamp(order.last_verified_at)}`,
    order.notes,
  ].filter(Boolean);
  return `<article class="order-card"><header class="order-top">
    <div><h2>${esc(order.supplier_name || '供應商待核對')}</h2>${meta ? `<p class="muted">${esc(meta)}</p>` : ''}</div>
    ${badge(order.statusLabel, UNPAID.has(order.status) ? 'amber' : received ? 'green' : 'neutral')}
  </header>
  <ul class="order-items">${order.items.map(item => `<li><span>${esc(item.code || item.name)}</span><strong>×${fmt(item.qty)}</strong>
    ${item.received > 0 ? badge(`已收 ${fmt(item.received)}`, 'green') : ''}
    ${item.entry > 0 ? badge(`已填入庫 ${fmt(item.entry)}`) : ''}</li>`).join('')}</ul>
  ${details.length ? `<details class="order-notes"><summary>物流與備註</summary>${details.map(value => `<p>${esc(value)}</p>`).join('')}</details>` : ''}
  </article>`;
}

function quality() {
  const matchType = issue => filter === 'all' || (filter === 'sku'
    ? ['name_collision', 'warehouse_missing', 'warehouse_absent', 'duplicate_sku', 'purchase_sku'].includes(issue.type)
    : filter === 'supplier' ? issue.type.startsWith('supplier')
    : filter === 'archive' ? issue.type === 'archived_stock' : issue.severity === 'block');
  const issues = model.issues.filter(matchType).filter(matches);
  const sourceTitles = {
    purchases_unreconciled: '採購待對帳',
    stock_identity_unverified: 'SKU 待比對',
    stock_stale: '庫存待更新',
    sales_stale: '銷售待更新',
  };
  return `<div class="toolbar">${search('搜尋 SKU 或待辦')}${filters({all: '全部', source: '資料來源', sku: 'SKU', supplier: '供應商', archive: '封存'})}</div>
    <details class="audit-upload"><summary>比對 Cloudmaker 庫存</summary><p class="muted">上傳含零庫存商品的完整 CSV。</p><input type="file" id="warehouse-file" accept=".csv,text/csv" aria-label="上傳 Cloudmaker CSV 比對"></details>
    <div class="supplier-overview-heading"><h2>${issues.length} 項待整理</h2>${model.coverage.hasWarehouse ? badge(`已比對 ${snapshot.warehouse.rows.length} 個 SKU`) : ''}</div>
    <div class="issue-list">${issues.length ? issues.slice(0, issueLimit).map(issue => {
      const product = model.products.find(p => p.code === issue.code);
      const blocked = issue.severity === 'block';
      return `<article class="issue">${blocked ? badge('優先', 'amber') : ''}<div>
        <h3>${esc(blocked ? sourceTitles[issue.type] || issue.title : issue.code)}</h3>
        ${!blocked ? `<p>${esc(issue.title)}</p>` : ''}
        ${!['supplier_missing', 'warehouse_missing', 'warehouse_absent'].includes(issue.type) && issue.detail
          ? `<details class="order-notes"><summary>詳情</summary><p>${esc(issue.detail)}</p></details>` : ''}
      </div>${product ? `<button class="button" data-product="${esc(product.code)}">查看</button>` : ''}</article>`;
    }).join('') : empty('沒有待整理項目')}${issues.length > issueLimit ? '<button class="button" data-action="more-issues">顯示更多</button>' : ''}</div>`;
}

function catalog() {
  const rows = model.products.filter(p => filter === 'archived' ? p.archived
    : !p.service && !p.archived && (filter !== 'unassigned' || !p.supplier_id)).filter(matches);
  return `<div class="toolbar">${search()}${filters({all: '有效', unassigned: '未指派', archived: '封存'})}</div>`
    + supplierView(groupBySupplier(rows, snapshot.suppliers), 'catalog');
}

function render() {
  if (!model) return;
  sourceBar();
  $('section-name').textContent = labels[tab] || labels.today;
  $('workspace-date').textContent = new Date(model.capturedAt).toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'short',
  });
  document.querySelectorAll('.nav-item').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('main-content').innerHTML = ({today, incoming, quality, catalog}[tab] || today)();
}

function go(next, nextFilter = next === 'today' && trackerPlan ? 'ready' : 'all') {
  tab = next; filter = nextFilter; query = ''; issueLimit = 60; selectedSupplier = null;
  history.replaceState(null, '', '#' + tab);
  render();
  window.scrollTo({top: 0});
}

function detail(code) {
  const p = model.products.find(product => product.code === code);
  if (!p) return;
  const estimate = tab === 'today' ? trackerPlan?.find(row => row.code === code) : null;
  $('product-detail').innerHTML = `<h2>${esc(p.code)}</h2>${p.name !== p.code ? `<p class="muted">${esc(p.name)}</p>` : ''}
    <div class="detail-stats">
      <div>庫存<strong>${fmt(estimate?.quantity ?? p.quantity)}</strong>${esc(p.unit)}</div>
      <div>${estimate ? '記錄未到' : '未到'}<strong>${estimate ? fmt(estimate.pending) : model.sources.purchasesComplete ? fmt(p.pending) : '—'}</strong></div>
      <div>近 60 天銷量<strong>${fmt(estimate?.sold60 ?? p.sold60)}</strong></div>
    </div>
    <dl class="product-facts"><dt>供應商</dt><dd>${esc(p.supplier)}</dd><dt>倉位</dt><dd>${esc(p.location || '—')}</dd><dt>庫存可售</dt><dd>${p.coverDays === null ? '—' : fmt(p.coverDays) + ' 天'}</dd></dl>
    ${p.proposal ? `<p class="notice">${esc(p.proposal.reason || '供應商待核對')}</p>` : ''}
    ${p.issues.length ? badge(p.issues[0], 'amber') : ''}${preferenceForm(p)}`;
  if (!$('product-dialog').open) $('product-dialog').showModal();
}

function preferenceForm(p) {
  const disabled = isPreview || !snapshot.canonical;
  const lock = disabled ? 'disabled' : '';
  return `<form id="sku-preferences" data-code="${esc(p.code)}" class="preference-form">
    <label>主要供應商<select name="supplier" class="select" ${lock}><option value="">未指派</option>${snapshot.suppliers.map(s =>
      `<option value="${esc(s.supplier_id)}" ${s.supplier_id === p.supplier_id ? 'selected' : ''}>${esc(s.name)}</option>`
    ).join('')}</select></label>
    <label class="check-label"><input type="checkbox" name="archived" ${p.archived ? 'checked' : ''} ${lock}> 封存 SKU</label>
    ${disabled ? `<p class="muted">${isPreview ? '唯讀快照' : '完整 SKU 同步後可編輯'}</p>` : '<button type="submit" class="button primary">儲存</button>'}
    <p id="preference-status" role="status"></p>
  </form>`;
}

document.addEventListener('submit',async event=>{
 if(event.target.id!=='sku-preferences')return;
 event.preventDefault();if(isPreview||!snapshot.canonical)return;
 const form=event.target,code=form.dataset.code;
 const previous=snapshot.inventory.find(p=>p.product_id===code);if(!previous)return;
 const button=form.querySelector('button');button.disabled=true;
 try{
   const supplier_id=form.elements.supplier.value||null;
   if(supplier_id&&!snapshot.suppliers.some(s=>s.supplier_id===supplier_id))throw new Error('供應商未能核對');
   await saveSkuPreferences(client,previous,{supplier_id,is_archived:form.elements.archived.checked});
   await reload();detail(code);toast('已儲存並讀回核對此 SKU 的設定');
 }catch(error){$('preference-status').textContent=error.message;button.disabled=false;}
});

function updateModel() {
  model=buildWorkbench(snapshot,settings);
  trackerPlan=buildTrackerPlan(snapshot,model.cfg);
  render();
}

async function reload(){
 $('refresh').disabled=true;
 const modeBadge=$('preview-badge');
 try{
   if(isPreview){const r=await fetch('/__preview.json',{cache:'no-store'});if(!r.ok)throw new Error('找不到本機預覽資料');snapshot=await r.json();}
   else snapshot=await loadSnapshot(client);
   updateModel();lastLoadAt=Date.now();$('copy-report').disabled=false;
   if(!isPreview){
     modeBadge.textContent='即時連線';
     modeBadge.hidden=false;
   }
 }catch(error){if(!isPreview)modeBadge.hidden=true;model=null;$('copy-report').disabled=true;$('sourcebar').innerHTML=badge('更新失敗 · 暫停採購建議','red');$('main-content').innerHTML=empty('資料未能完整讀取',error.message);toast('讀取失敗；沒有把缺少資料當成零。');}
 finally{$('refresh').disabled=false;}
}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button,a');if(!b)return;
 if(b.hasAttribute('data-supplier')){selectedSupplier=b.dataset.supplier;render();window.scrollTo({top:0});}
 if(b.dataset.action==='all-suppliers'){selectedSupplier=null;render();document.querySelector('.supplier-overview-heading')?.scrollIntoView({block:'start'});}
 if(b.dataset.tab){event.preventDefault();go(b.dataset.tab);}
 if(b.dataset.filter){filter=b.dataset.filter;issueLimit=60;render();}
 if(b.dataset.product)detail(b.dataset.product);
 if(b.dataset.copySupplier){event.preventDefault();event.stopPropagation();const g=purchaseGroups().find(g=>g.id===b.dataset.copySupplier);if(g&&canCopyPurchaseList(g)){await navigator.clipboard.writeText(`${g.name}\n`+g.rows.map(p=>`${p.code} x ${p.quantityToBuy}`).join('\n'));toast('已複製核對完成的採購清單');}}
 if(b.dataset.action==='unpaid')go('incoming','unpaid');
 if(b.dataset.action==='more-issues'){issueLimit+=60;render();}
});
document.addEventListener('input',event=>{
 if(event.target.id==='workbench-search'){const position=event.target.selectionStart;query=event.target.value;render();const input=$('workbench-search');input.focus();input.setSelectionRange(position,position);}
});
document.addEventListener('change',async event=>{
 if(event.target.id==='purchase-filter'){filter=event.target.value;render();}
 if(event.target.dataset.setting){const v=Number(event.target.value);if(!event.target.value||!event.target.validity.valid||!Number.isFinite(v))return;settings[event.target.dataset.setting]=v;localStorage.setItem('workbench-settings',JSON.stringify(settings));updateModel();}
 if(event.target.id==='warehouse-file'&&event.target.files[0]){
   try{const file=event.target.files[0];const rows=parseCsv(await file.text());let normalized;
     if(rows[0]?.[0]?.replace(/^\uFEFF/,'')==='textBox9'&&rows[0].length===7)normalized=rows.slice(1).filter(r=>r.length===7&&r[2].trim()).map(r=>({code:r[2].trim(),name:r[3].trim(),unit:r[4],location:r[5],quantity:Number(r[6].replace(/,/g,''))}));
     else throw new Error('請使用 Cloudmaker 庫存單的完整 CSV 匯出格式。');
     if(!normalized.length||normalized.some(r=>!Number.isFinite(r.quantity)))throw new Error('有品項或數量無法讀取，請先確認匯出檔。');
     // This export has no generation timestamp. Do not mistake file modification time for stock freshness.
     snapshot={...snapshot,warehouse:{rows:normalized,captured_at:null,uploaded_at:new Date().toISOString()}};updateModel();toast(`已比對 ${normalized.length} 個 SKU；匯出時間未確認，僅供核對。`);
   }catch(error){toast(error.message);}
 }
});
export function parseCsv(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}if(quoted)throw new Error('CSV 引號不完整');return rows;}
$('close-dialog').onclick=()=>$('product-dialog').close();
$('refresh').onclick=reload;
// Poll only the live, visible workspace. Do not replace an open edit dialog.
function refreshIfDue(){if(!isPreview&&client&&!$('shell').hidden&&document.visibilityState==='visible'&&!$('product-dialog').open&&!$('refresh').disabled&&Date.now()-lastLoadAt>60000)void reload();}
if(!isPreview){setInterval(refreshIfDue,5*60*1000);window.addEventListener('focus',refreshIfDue);document.addEventListener('visibilitychange',refreshIfDue);}
$('sync-note').textContent=isPreview?'固定快照':'每 5 分鐘更新';
$('copy-report').onclick=async()=>{if(!model)return;try{await navigator.clipboard.writeText(buildReport(model));toast('已複製今日摘要');}catch{toast('無法複製，請檢查瀏覽器剪貼簿權限');}};
$('logout').onclick=async()=>{if(isPreview){toast('目前是本機快照預覽');return;}await client.auth.signOut();location.reload();};
$('login-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;$('login-error').textContent='';try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw error;$('login').hidden=true;$('shell').hidden=false;await reload();}catch(error){$('login-error').textContent=error.message;}finally{button.disabled=false;}};
if(isPreview){$('shell').hidden=false;$('preview-badge').hidden=false;$('logout').hidden=true;await reload();}
else if(!window.supabase){$('login').hidden=false;$('login-error').textContent='登入元件未載入，請重新整理。';}
else {client=window.supabase.createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true}});const {data:{session},error}=await client.auth.getSession();if(error)$('login-error').textContent=error.message;if(session){$('shell').hidden=false;await reload();}else $('login').hidden=false;}
