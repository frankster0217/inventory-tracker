export const SUPABASE_URL='https://kyhwsxdtrgmrkwjpftjl.supabase.co';
// Public browser key, retained from the original app. Never put a service key here.
export const PUBLIC_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5aHdzeGR0cmdtcmt3anBmdGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzYwNTMsImV4cCI6MjA5NjE1MjA1M30.FpZevI14015RdYwoKr1DuHiMX8q7GBYpvNsReRw3FtQ';
export async function readAll(client,table,orderBy) {
  const rows=[];const size=1000;
  for(let offset=0;offset<200000;offset+=size) {
    const {data,error}=await client.from(table).select('*').order(orderBy,{ascending:true}).range(offset,offset+size-1);
    if(error)throw Object.assign(new Error(`${table}: ${error.message}`),{code:error.code,table});
    if(!Array.isArray(data))throw new Error(`${table}: invalid response`);
    rows.push(...data);if(data.length<size)return rows;
  }
  throw new Error(`${table}: pagination limit exceeded`);
}
async function readRpcRows(client,name,orderBy) {
  const rows=[];
  for(let offset=0;offset<200000;offset+=1000){
    const {data,error}=await client.rpc(name).order(orderBy,{ascending:true}).range(offset,offset+999);
    if(error)throw new Error(`${name}: ${error.message}`);
    if(!Array.isArray(data))throw new Error(`${name}: invalid response`);
    rows.push(...data);if(data.length<1000)return rows;
  }
  throw new Error(`${name}: pagination limit exceeded`);
}
export function readVelocity(client,name='get_sales_velocity_by_code') {
  return readRpcRows(client,name,'product_code');
}
async function optionalTable(client,table,orderBy) {
  try{return await readAll(client,table,orderBy);}catch(error){if(['PGRST205','42P01'].includes(error.code))return null;throw error;}
}
export async function loadSnapshot(client) {
  const tracker = Promise.all([
    readRpcRows(client,'get_sales_velocity_by_name','product_name'),
    readRpcRows(client,'get_pending_quantities','product_name'),
    readAll(client,'activity_overrides','product_name')
  ]).then(([salesByName, pendingByName, activityOverrides]) => ({salesByName, pendingByName, activityOverrides}),
    error => ({error:error.message}));
  const results=await Promise.allSettled([
    readAll(client,'inventory','product_id'),readAll(client,'inventory_meta','id'),
    readAll(client,'supplier_rules','supplier_id'),readAll(client,'archived_products','product_name'),
    readAll(client,'pending_orders','id'),readVelocity(client),
    readAll(client,'reorder_meta','product_name'),
    client.from('sales_orders').select('order_date,synced_at').order('synced_at',{ascending:false}).limit(1),
    optionalTable(client,'inventory_skus','product_id'),optionalTable(client,'operations_state','id'),tracker
  ]);
  const errors=results.filter(r=>r.status==='rejected');
  if(errors.length)throw new Error(errors.map(e=>e.reason.message).join('\n'));
  const [legacy,meta,suppliers,archived,pending,velocity,reorder,sales,canonical,state,trackerInputs]=results.map(r=>r.value);
  if(sales.error)throw new Error(`sales_orders: ${sales.error.message}`);
  const inventoryMeta=meta.find(m=>m.id===1);
  const currentCanonical=canonical?.filter(r=>r.present_in_latest_import===true);
  if(!legacy.length&&!canonical?.length)throw new Error('庫存清單未讀取成功；不能視為零庫存');
  if(!currentCanonical?.length&&legacy.length<(inventoryMeta?.row_count||0))throw new Error('庫存清單不完整；請重新同步');
  const ops=state?.find(s=>s.id==='purchase_sync')?.payload;
  const snapshot={captured_at:new Date().toISOString(),inventory:legacy,inventory_meta:inventoryMeta,suppliers,archived:archived.map(r=>r.product_name),pending_orders:pending,sales_velocity_by_code:velocity,reorder_meta:reorder,sales_freshness:{latest_sync:sales.data?.[0]?.synced_at,latest_order:sales.data?.[0]?.order_date},purchase_sync:ops||{complete:false},canonical:!!currentCanonical?.length};
  snapshot.tracker={...trackerInputs,inventory:legacy};
  if(currentCanonical?.length) {
    const sync=state?.find(s=>s.id==='stock_sync')?.payload;
    if(!sync?.complete||sync.row_count!==currentCanonical.length)throw new Error('新版 SKU 庫存尚未完成完整同步，暫停採購建議');
    snapshot.warehouse={captured_at:sync.checked_at,rows:currentCanonical.map(r=>({code:r.product_id,name:r.product_name,quantity:r.quantity,location:r.location,unit:r.unit,supplier_id:r.supplier_id,is_archived:r.is_archived}))};
    // New canonical assignments override the legacy compatibility source.
    snapshot.inventory=currentCanonical;
    snapshot.inventory_meta={last_import:sync.checked_at,row_count:sync.row_count};
  }
  return snapshot;
}

// Compare-and-set one exact SKU. Never change stock or allocate by product name.
export async function saveSkuPreferences(client,previous,next) {
  if(!previous?.product_id)throw new Error('缺少精確商品編號');
  if(typeof next.is_archived!=='boolean')throw new Error('封存狀態無效');
  const supplier=next.supplier_id||null;
  let request=client.from('inventory_skus').update({supplier_id:supplier,is_archived:next.is_archived})
    .eq('product_id',previous.product_id).eq('is_archived',previous.is_archived);
  request=previous.supplier_id?request.eq('supplier_id',previous.supplier_id):request.is('supplier_id',null);
  const {data,error}=await request.select('product_id,supplier_id,is_archived');
  if(error)throw new Error(error.message);
  if(data?.length!==1)throw new Error('這個 SKU 已由其他人更新，請重新整理後再核對');
  const {data:verified,error:readError}=await client.from('inventory_skus').select('product_id,supplier_id,is_archived').eq('product_id',previous.product_id).single();
  if(readError||verified?.supplier_id!==supplier||verified?.is_archived!==next.is_archived)throw new Error('儲存後讀回不一致，請重新整理核對');
  return verified;
}
