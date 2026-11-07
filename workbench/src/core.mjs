// Verified purchasing and reports use exact warehouse codes.
export const DEFAULTS = Object.freeze({ targetWeeks: 4, leadTimeDays: 4, buffer: 1.10, maxAgeHours: 24 });
export const key = value => String(value ?? '').normalize('NFKC').trim();
export const number = value => value === null || value === '' || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const values = a => Array.isArray(a) ? a : [];
const group = (rows, field) => {
  const map = new Map();
  for (const row of rows) { const k = key(row[field]); if (!map.has(k)) map.set(k, []); map.get(k).push(row); }
  return map;
};
export const SERVICE_CODES = new Set(['G000001','G0000013','G0000014','G0000015','G0000016','G0000017','G000002','G000003','G000004','G000007','G000012','G000015','G000016','G000017','G000018','G000020','G000021','G000026','G000030','G000031','G000032','G000033','G000034','G000035','G000036','G000037','G000038']);
export const isService = code => SERVICE_CODES.has(key(code));

// Used by both purchasing and the full catalog; unknown assignments remain separate.
export function groupBySupplier(products,suppliers) {
  const supplierMap=new Map(values(suppliers).map(s=>[s.supplier_id,s]));
  return [...group(values(products),'supplier_id')].map(([id,rows])=>({
    id,name:supplierMap.get(id)?.name||'供應商待設定',rows,
    urgent:rows.filter(p=>p.urgent).length,actionable:rows.filter(p=>p.actionable).length,
    totalQty:rows.reduce((sum,p)=>sum+(p.quantityToBuy||0),0)
  })).sort((a,b)=>Number(!a.id)-Number(!b.id)||b.urgent-a.urgent||b.rows.length-a.rows.length||a.name.localeCompare(b.name,'zh-TW'));
}
export function parseItems(input) {
  let items = input;
  for (let depth = 0; typeof items === 'string' && depth < 2; depth++) {
    try { items = JSON.parse(items); } catch { return { items: [], error: '品項內容無法讀取' }; }
  }
  return Array.isArray(items) ? { items, error: null } : { items: [], error: '品項不是清單' };
}
export const UNPAID = new Set(['unpaid','draft','submitted_unpaid','awaiting_payment']);
export const CANCELLED = new Set(['cancelled','canceled','refunded']);
export const PAID = new Set(['ordered','paid','purchased','transit','awaiting_consolidation','in_transit','out_for_delivery','inbound_entered','partially_received','delivered','arrived','received']);
export const STATUS_LABELS = { unpaid:'待付款',draft:'草稿',submitted_unpaid:'待付款',awaiting_payment:'待付款',ordered:'已訂購',paid:'已付款',purchased:'已採購',transit:'運送中',in_transit:'運送中',awaiting_consolidation:'等待集運',out_for_delivery:'台灣配送中',inbound_entered:'已填入庫單',partially_received:'部分到貨',delivered:'已送達',arrived:'已收貨',received:'已收貨',cancelled:'已取消',canceled:'已取消',refunded:'已退款' };

export function reconcileWarehouse(inventory, warehouse) {
  const current = new Map(values(inventory).map(r => [key(r.product_id), r]));
  const byName = group(values(inventory), 'product_name');
  const all = values(warehouse?.rows);
  const nameGroups = group(all, 'name');
  const missing = all.filter(r => !current.has(key(r.code))).map(r => ({ ...r, service:isService(r.code), sameNameCodes: (byName.get(key(r.name)) || []).map(x => x.product_id) }));
  const warehouseCodes = new Set(all.map(r => key(r.code)));
  return {
    missing,
    nameCollisions:[...nameGroups].filter(([,rows]) => new Set(rows.map(r=>key(r.code))).size>1).map(([name,rows])=>({name,rows})),
    trackerOnly: all.length ? inventory.filter(r => !warehouseCodes.has(key(r.product_id))) : [],
    hasWarehouse:all.length>0,
  };
}

export function buildPending(orders, products) {
  const byCode = new Map(products.map(p => [p.code,p]));
  const byName = group(products, 'name');
  const bySku = new Map(), issues=[], normalized=[];
  for (const order of values(orders)) {
    const status = key(order.status).toLowerCase();
    const parsed = parseItems(order.items);
    const id=String(order.id || order.source_order_id || 'unknown');
    const target={...order,id,status,statusLabel:STATUS_LABELS[status]||'狀態待確認',items:[],totalQty:0,pendingQty:0};
    if(parsed.error) issues.push({type:'purchase_items',severity:'block',code:id,title:'採購品項無法讀取',detail:parsed.error});
    if(!UNPAID.has(status)&&!CANCELLED.has(status)&&!PAID.has(status)) issues.push({type:'purchase_status',severity:'block',code:id,title:'採購狀態待確認',detail:status||'未填狀態'});
    for (const item of parsed.items) {
      const rawCode = key(item.product_id || item.sku || item.code);
      const name = key(item.name || item.product_name);
      let code=rawCode;
      if(!code) {
        const matches=byName.get(name)||[];
        if(matches.length===1) code=matches[0].code;
        else issues.push({type:'purchase_sku',severity:'block',code:name||id,title:'採購 SKU 待核對',detail:'缺少唯一商品編號，不能只按名稱扣除在途量'});
      }
      const qty=number(item.warehouse_qty ?? item.qty ?? item.quantity);
      const received=number(item.received_qty ?? item.quantity_received ?? (item.arrived===true?qty:0));
      const entry=number(item.inbound_entered_qty ?? 0);
      const valid=qty!==null&&qty>=0&&received!==null&&received>=0&&received<=qty;
      if(!valid) issues.push({type:'purchase_qty',severity:'block',code:code||name,title:'採購數量待核對',detail:'購買或到貨數量不正確'});
      const remaining=valid?Math.max(0,qty-received):null;
      const row={...item,code,name:name||byCode.get(code)?.name||code,qty,received,entry,remaining,matched:byCode.has(code)};
      target.items.push(row);target.totalQty+=qty||0;
      if(PAID.has(status)&&valid&&remaining>0) {
        target.pendingQty+=remaining;
        if(byCode.has(code)) bySku.set(code,(bySku.get(code)||0)+remaining);
        else issues.push({type:'purchase_missing_sku',severity:'block',code:code||name,title:'已購商品尚未建檔',detail:'先核對商品編號，再計入在途量'});
      }
    }
    normalized.push(target);
  }
  return {bySku,issues,orders:normalized.sort((a,b)=>String(b.order_date||b.created_at||'').localeCompare(String(a.order_date||a.created_at||'')))};
}

function freshness(timestamp,now,maxAge) {
  const time=Date.parse(timestamp), age=(now-time)/3600000;
  return {timestamp:timestamp||null,ageHours:Number.isFinite(age)?age:null,fresh:Number.isFinite(age)&&age>=-0.1&&age<=maxAge};
}

// The original tracker's estimates use its name-based sales and incoming totals.
// Keep these separate from the verified purchase recommendations.
export function buildTrackerPlan(snapshot, {targetWeeks, leadTimeDays, minOrderQty = 5}) {
  const {tracker} = snapshot;
  if (!tracker || tracker.error) return null;
  const byName = new Map(tracker.salesByName.map(row => [row.product_name, row]));
  const byCode = new Map(snapshot.sales_velocity_by_code.map(row => [row.product_code, row]));
  const incoming = new Map(tracker.pendingByName.map(row => [row.product_name, Number(row.pending_qty) || 0]));
  const overrides = new Map(tracker.activityOverrides.map(row => [row.product_name, row.category]));
  const supplierNames = new Map(snapshot.suppliers.map(row => [row.supplier_id, row.name]));
  const archived = new Set(snapshot.archived);
  const rows = [];
  for (const {product_id: code, product_name: name, supplier_id, quantity: stock} of tracker.inventory) {
    if (archived.has(name)) continue;
    const sold = byName.get(name) || byCode.get(code);
    const override = overrides.get(name);
    const active = override ? ['high', 'active'].includes(override) : sold?.days_m1 >= 3;
    if (!active || !(sold?.sold_m2 > 0)) continue;
    const quantity = number(stock);
    if (quantity === null) continue;
    const pending = incoming.get(name) || 0;
    const weekly = sold.sold_m2 / (60 / 7);
    const coverWeeks = quantity / weekly;
    const target = weekly * (targetWeeks + leadTimeDays / 7) * DEFAULTS.buffer;
    const rawNeed = Math.max(0, Math.ceil(target - quantity - pending));
    const quantityToBuy = rawNeed >= minOrderQty ? rawNeed : 0;
    rows.push({code, name, supplier_id, supplier:supplierNames.get(supplier_id) || '供應商待設定', quantity, pending, rawNeed, quantityToBuy, sold60:sold.sold_m2, urgent:coverWeeks < 1.5, coverWeeks});
  }
  return rows.sort((a,b) => Number(b.quantityToBuy > 0) - Number(a.quantityToBuy > 0) || a.coverWeeks - b.coverWeeks);
}

export function buildWorkbench(snapshot, settings={}, now=Date.now()) {
  const cfg={...DEFAULTS,...settings};
  const inventory=values(snapshot.inventory), warehouse=snapshot.warehouse;
  const coverage=reconcileWarehouse(inventory,warehouse);
  const legacyByCode=new Map(inventory.map(r=>[key(r.product_id),r]));
  const sourceRows=coverage.hasWarehouse?warehouse.rows.map(r=>({product_id:r.code,product_name:r.name,quantity:r.quantity,unit:r.unit,location:r.location,is_archived:r.is_archived,supplier_id:r.supplier_id??legacyByCode.get(key(r.code))?.supplier_id??null})):inventory;
  const codeGroups=group(sourceRows,'product_id');
  const suppliers=values(snapshot.suppliers),supplierMap=new Map(suppliers.map(s=>[s.supplier_id,s]));
  const archived=new Set(values(snapshot.archived));
  const velocities=new Map(values(snapshot.sales_velocity_by_code).map(v=>[key(v.product_code),v]));
  const prefs=new Map(values(snapshot.supplier_preferences).map(x=>[key(x.product_id),x]));
  const issues=[...values(snapshot.source_issues)];
  const stockTime=coverage.hasWarehouse?warehouse.captured_at:snapshot.inventory_meta?.last_import;
  const stockFreshness=freshness(stockTime,now,cfg.maxAgeHours);
  const salesFreshness=freshness(snapshot.sales_freshness?.latest_sync,now,cfg.maxAgeHours);
  const purchaseFreshness=freshness(snapshot.purchase_sync?.checked_at,now,cfg.maxAgeHours);
  const purchasesComplete=snapshot.purchase_sync?.complete===true&&purchaseFreshness.fresh;
  const canonicalReady=coverage.hasWarehouse||snapshot.canonical===true;
  if(!canonicalReady) issues.push({type:'stock_identity_unverified',severity:'block',code:'source-skus',title:'完整 SKU 尚未核對',detail:'目前來源曾以同名品項合併；先確認完整的商品編號清單，再採用採購建議'});
  if(!stockFreshness.fresh) issues.push({type:'stock_stale',severity:'block',code:'source-stock',title:'庫存資料需要更新',detail:'最近一次完整庫存資料超過 24 小時或時間未確認'});
  if(!salesFreshness.fresh) issues.push({type:'sales_stale',severity:'block',code:'source-sales',title:'銷售資料需要更新',detail:'銷售同步時間超過 24 小時或未確認'});
  if(!purchasesComplete) issues.push({type:'purchases_unreconciled',severity:'block',code:'source-purchases',title:'先核對已買商品，避免重複採購',detail:'採購記錄尚未完成對帳；空白待到貨清單不代表沒有在途商品'});
  const products=[];
  for(const [code,rows] of codeGroups) {
    if(!code){issues.push({type:'missing_code',severity:'block',code:rows[0]?.product_name,title:'缺少商品編號',detail:'不能以品名代替 SKU'});continue;}
    const r=rows[0], qty=number(r.quantity), duplicate=rows.length>1;
    const archivedProduct=typeof r.is_archived==='boolean'?r.is_archived:archived.has(r.product_name);
    const pref=prefs.get(code),sid=pref?.supplier_id||r.supplier_id;
    const supplier=supplierMap.get(sid);
    const proposal=snapshot.supplier_proposals?.find(p=>key(p.product_id)===code);
    const sales=velocities.get(code),sold=sales?(number(sales.sold_m2)??0):null;
    const weekly=sold===null?null:Math.max(0,sold)*7/60;
    const p={code,name:r.product_name,quantity:qty,unit:r.unit||'',location:r.location||'',supplier_id:sid||null,supplier:supplier?.name||'供應商待設定',supplierLink:supplier?.shop_link||'',archived:archivedProduct,service:isService(code),duplicate,weekly,sold60:sold,days30:number(sales?.days_m1),proposal,issues:[]};
    if(duplicate){p.issues.push('SKU 重複');issues.push({type:'duplicate_sku',severity:'block',code,title:'同一 SKU 出現多筆資料',detail:'需先核對倉位及庫存，不能任意加總'});}
    if(qty===null){p.issues.push('庫存未確認');issues.push({type:'invalid_stock',severity:'block',code,title:'庫存數量無法確認',detail:'數量不是有效數字'});}
    if(!supplier&&!p.service&&!archivedProduct){p.issues.push('供應商未設定');issues.push({type:'supplier_missing',severity:'review',code,title:'尚未指派供應商',detail:r.product_name});}
    if(proposal&&proposal.supplier_id!==sid&&!p.service){p.issues.push('供應商需核對');issues.push({type:'supplier_mismatch',severity:'review',code,title:'供應商與採購紀錄不同',detail:`目前 ${p.supplier}；建議核對 ${supplierMap.get(proposal.supplier_id)?.name||proposal.supplier_id}`,proposal});}
    if(archivedProduct&&qty>0){issues.push({type:'archived_stock',severity:'review',code,title:'封存商品仍有庫存',detail:`${r.product_name} · ${qty} 件，需確認是否繼續販售`});}
    products.push(p);
  }
  const pending=buildPending(snapshot.pending_orders,products);issues.push(...pending.issues);
  for(const collision of coverage.nameCollisions) issues.push({type:'name_collision',severity:'review',code:collision.rows.map(r=>r.code).join(' / '),title:'同名商品有不同 SKU',detail:collision.rows.map(r=>`${r.code} ×${r.quantity}`).join('；')});
  for(const r of coverage.missing.filter(r=>!r.service)) issues.push({type:'warehouse_missing',severity:'review',code:r.code,title:r.sameNameCodes.length?'SKU 曾被同名資料覆蓋':'倉庫有此 SKU，追蹤器未收錄',detail:r.name});
  for(const r of coverage.trackerOnly) issues.push({type:'warehouse_absent',severity:'review',code:r.product_id,title:'追蹤器留有倉庫已不存在的 SKU',detail:r.product_name});
  const globalReady=canonicalReady&&stockFreshness.fresh&&salesFreshness.fresh&&purchasesComplete&&!pending.issues.some(i=>i.severity==='block');
  for(const p of products) {
    p.pending=pending.bySku.get(p.code)||0;
    p.coverDays=p.weekly>0&&p.quantity!==null?Math.max(0,p.quantity/p.weekly*7):null;
    p.rawNeed=p.weekly>0&&p.quantity!==null?Math.max(0,Math.ceil(p.weekly*(cfg.targetWeeks+cfg.leadTimeDays/7)*cfg.buffer-p.quantity-p.pending)):0;
    p.quantityToBuy=p.rawNeed;
    p.urgent=p.weekly>0&&p.quantity!==null&&(p.quantity<=0||p.coverDays<=cfg.leadTimeDays);
    p.actionable=globalReady&&!p.issues.length&&!p.archived&&!p.service;
    p.reviewNeeded=p.rawNeed>0&&!p.actionable;
  }
  const candidates=products.filter(p=>!p.service&&!p.archived&&p.rawNeed>0).sort((a,b)=>Number(b.urgent)-Number(a.urgent)||(a.coverDays??Infinity)-(b.coverDays??Infinity));
  const supplierGroups=groupBySupplier(candidates,suppliers);
  const actionable=candidates.filter(p=>p.actionable);
  return {cfg,products,candidates,supplierGroups,orders:pending.orders,issues,coverage,sources:{stock:stockFreshness,sales:salesFreshness,purchases:purchaseFreshness,purchasesComplete,canonical:coverage.hasWarehouse||snapshot.canonical===true},stats:{active:products.filter(p=>!p.archived&&!p.service).length,ready:actionable.length,urgent:actionable.filter(p=>p.urgent).length,draft:candidates.length-actionable.length,unpaid:pending.orders.filter(o=>UNPAID.has(o.status)).length,incoming:pending.orders.filter(o=>PAID.has(o.status)&&o.pendingQty>0).length,unassigned:products.filter(p=>!p.supplier_id&&!p.archived&&!p.service).length,issues:issues.length},capturedAt:snapshot.captured_at||new Date(now).toISOString()};
}

export function buildReport(model) {
  const date=new Date(model.capturedAt).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
  const incoming=model.sources.purchasesComplete?`${model.stats.incoming} paid orders incoming`:'incoming purchases: reconciliation incomplete';
  const lines=[`Purchase review — ${date}`,`${model.stats.ready} ready to buy · ${incoming} · ${model.stats.unpaid} awaiting payment`];
  const blockers=model.issues.filter(i=>i.severity==='block');
  if(blockers.length) lines.push('', 'Needs attention before purchasing:',...blockers.slice(0,5).map(i=>`• ${i.title}: ${i.detail}`),'','Purchase quantities below are withheld until the missing data is reconciled.');
  for(const supplier of model.supplierGroups) {
    const rows=supplier.rows.filter(p=>p.actionable);
    if(!rows.length)continue;
    lines.push('',supplier.name,...rows.map(p=>`• ${p.code} ×${p.quantityToBuy} — ${p.quantity} in stock, ${p.pending} incoming, ${p.coverDays?.toFixed(0)} days of stock`));
  }
  if(!model.stats.ready&&!blockers.length)lines.push('','No purchase action is needed from the verified data.');
  return lines.join('\n');
}
