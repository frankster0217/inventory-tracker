import {createHash} from 'node:crypto';

const list=value=>Array.isArray(value)?value:[];
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,16);
const time=value=>{
  if(typeof value!=='string')return -Infinity;
  const date=/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(value)&&!/(Z|[+-]\d\d:\d\d)$/.test(value)?value.replace(' ','T')+'+08:00':value;
  const n=Date.parse(date);return Number.isFinite(n)?n:-Infinity;
};
const latest=(...values)=>values.filter(v=>time(v)>-Infinity).sort((a,b)=>time(b)-time(a))[0]??null;
const unique=values=>[...new Set(values.filter(Boolean))];
const sameInbound=(actual,expected)=>!Array.isArray(expected)||expected.length<6?true:expected.concat(Array(7).fill('')).slice(0,7).every((value,index)=>index===5?Number(actual?.[index])===Number(value):(actual?.[index]??'')===(value??''));
const itemsFrom=(items,catalog)=>Object.entries(items??{}).map(([sku,quantity])=>({sku,name:catalog.get(sku)?.name??sku,quantity:Number(quantity)})).filter(i=>i.sku&&Number.isSafeInteger(i.quantity)&&i.quantity>0);
const eventsOf=record=>list(record.tracking?.events);
function mergeTimeline(record,{carrier,waybill,checkedAt,eventAt,eventText}){
  if(!eventAt||!eventText||time(eventAt)===-Infinity)return;
  if(record.tracking?.waybill&&record.tracking.waybill!==waybill){record.trackingConflict=true;return;}
  const events=[...eventsOf(record),{at:eventAt,text:eventText}];
  const distinct=[...new Map(events.map(e=>[`${e.at}|${e.text}`,e])).values()].sort((a,b)=>time(b.at)-time(a.at)).slice(0,10);
  record.tracking={carrier:carrier||record.tracking?.carrier||'',waybill,checkedAt:latest(record.tracking?.checkedAt,checkedAt),events:distinct};
  const text=distinct[0]?.text??'';
  record.carrierStatus=/順利送達|已簽收|已派送至本人|已由.+送達/.test(text)?'已送達':/配送中|正在派送中/.test(text)?'台灣配送中':'運輸中';
}
const sumItems=rows=>{
  const map=new Map();
  for(const row of rows){const current=map.get(row.sku);map.set(row.sku,{...row,quantity:(current?.quantity??0)+row.quantity});}
  return [...map.values()];
};

export function buildTrackingFeeds({feeds,ledger,returnsLedger={},sheets}){
  const owners=unique(feeds.map(f=>f.owner_id));
  if(owners.length!==1)throw new Error('Expected exactly one verified feed owner');
  const output=structuredClone(feeds);
  const bySource=new Map(output.map(feed=>[feed.source,feed]));
  for(const source of ['magicbuy','kkren','sf'])if(!bySource.has(source))throw new Error(`Missing existing source ${source}`);
  const catalog=new Map();
  for(const row of list(sheets.history).slice(1))if(row[2])catalog.set(row[2],{name:row[3]});
  for(const row of list(sheets.pending).slice(1))if(row[9])catalog.set(row[9],{name:row[10]});
  const allocations=[...new Map(list(ledger.allocations).filter(a=>a.event_key).map(a=>[a.event_key,a])).values()];
  const byBatch=new Map(),bySeller=new Map();
  for(const a of allocations){
    if(a.kkren_batch){if(!byBatch.has(a.kkren_batch))byBatch.set(a.kkren_batch,[]);byBatch.get(a.kkren_batch).push(a);}
    if(a.waybill){if(!bySeller.has(a.waybill))bySeller.set(a.waybill,[]);bySeller.get(a.waybill).push(a);}
  }
  const parcelItems=new Map();
  for(const [waybill,rows] of bySeller)parcelItems.set(waybill,sumItems(rows.map(a=>({sku:a.model,name:a.inbound_values?.[2]??catalog.get(a.model)?.name??a.model,quantity:a.quantity}))));
  for(const [waybill,confirmed] of Object.entries(ledger.confirmed_kkren_carton_contents??{}))parcelItems.set(waybill,itemsFrom(confirmed.items,catalog));
  const magicbuy=bySource.get('magicbuy'),orders=new Map(magicbuy.records.map(record=>[record.id,record]));
  for(const order of Object.values(ledger.submitted_purchases??{})){
    const spec=order.specification;if(spec.source!=='magicbuy')continue;
    const record=orders.get(spec.order_reference)??{id:spec.order_reference};
    const legacy=ledger.verified_pending_purchases?.[spec.order_reference];
    const checkedAt=latest(order.payment_evidence?.verified_at,order.last_capture_evidence?.verified_at);
    if(time(record.checkedAt)>time(checkedAt))continue;
    const previousItems=list(record.items);
    Object.assign(record,{date:spec.submitted_at.slice(0,10),supplier:spec.supplier,route:spec.route.includes('KKren')?'漳州倉集運':'順豐直寄台灣',
      status:order.payment_status==='paid'?(legacy?.source_status??'已採購'):order.payment_status==='cancelled'?'已取消':order.payment_status==='refunded'?'已退款':'未付款',
      waybills:unique([...list(record.waybills),...Object.keys(order.parcels)]),checkedAt,
      items:order.items.map(item=>{
        const previous=previousItems.find(i=>i.source_name===item.model&&i.quantity===(item.catalog_quantity??item.quantity)&&((item.sku&&i.sku===item.sku)||(!item.sku&&i.mapping_status==='needs_review')));
        return {...(item.sku?{sku:item.sku}:{}),name:previous?.name??(item.sku?catalog.get(item.sku)?.name??item.model:item.model),
          source_name:item.model,quantity:item.catalog_quantity??item.quantity,skuPending:!item.sku,mapping_verified:!!item.sku,
          ...(previous?.mapping_status?{mapping_status:previous.mapping_status}:{})};
      })});
    orders.set(record.id,record);
  }
  magicbuy.records=[...orders.values()];
  const kkren=bySource.get('kkren'),consolidations=new Map(kkren.records.map(record=>[record.id,record]));
  const open=list(ledger.open_kkren_tracking);
  for(const entry of open){
    const id=entry.kkren_shipment_id;if(!id)continue;
    const record=consolidations.get(id)??{id,status:'已出貨',members:[]};
    const members=new Map(list(record.members).map(member=>[member.waybill,member]));
    if(list(entry.seller_waybills).length){
      if(unique(record.members?.map(m=>m.waybill)??[]).sort().join('|')!==unique(entry.seller_waybills).sort().join('|'))delete record.confirmedShipmentItems;
      record.members=entry.seller_waybills.map(waybill=>members.get(waybill)??{waybill});
      record.manifestCheckedAt=entry.last_list_checked_at??entry.verified_at;
    }
    record.stageCheckedAt=latest(record.stageCheckedAt,entry.last_list_checked_at);
    mergeTimeline(record,{carrier:entry.taiwan_carrier,waybill:entry.taiwan_waybill,checkedAt:entry.last_exact_timeline_checked_at??entry.verified_at,eventAt:entry.latest_event_at,eventText:entry.latest_event});
    consolidations.set(id,record);
  }
  for(const [id,rows] of byBatch){
    const record=consolidations.get(id)??{id,status:'已出貨',members:[]};
    const members=new Map(list(record.members).map(member=>[member.waybill,member]));
    for(const a of rows){
      if(a.waybill&&!members.has(a.waybill)){
        if(record.manifestCheckedAt)record.manifestConflict=true;
        else members.set(a.waybill,{waybill:a.waybill});
      }
      mergeTimeline(record,{carrier:a.courier,waybill:a.taiwan_waybill,checkedAt:a.delivery_verified_at??a.verified_at,
        eventAt:a.parent_carrier_delivered_at??a.latest_delivery_evidence?.event_at??a.delivered_at??a.courier_event_at??a.delivery_confirmed_by_3pl_at,
        eventText:a.parent_carrier_event??a.latest_delivery_evidence?.status??(a.delivered_at?'已簽收':a.courier_event??a.courier_status??(a.delivery_confirmed_by_3pl_at?'3PL 已確認收件（物流簽收時間未核對）':null))});
    }
    record.members=[...members.values()];consolidations.set(id,record);
  }
  for(const record of consolidations.values()){
    if(record.id.startsWith('S')){
      record.members=list(record.members).map(member=>parcelItems.has(member.waybill)?{...member,verifiedItems:parcelItems.get(member.waybill)}:member);
      // Per-carton allocations supersede an old shipment total only when every
      // manifest member has exact items. Partial manifests retain their holds.
      if(record.members.length&&record.members.every(m=>m.verifiedItems?.length))record.confirmedShipmentItems=sumItems(record.members.flatMap(m=>m.verifiedItems));
    }else if(parcelItems.has(record.waybill??record.id))record.confirmedShipmentItems=parcelItems.get(record.waybill??record.id);
  }
  kkren.records=[...consolidations.values()];
  const sf=bySource.get('sf'),sfRecords=new Map(sf.records.map(record=>[record.id,record]));
  for(const entry of list(ledger.discovered_direct_sf)){
    const record=sfRecords.get(entry.waybill)??{id:entry.waybill,waybill:entry.waybill};
    const checkedAt=latest(entry.delivery_verified_at,entry.verified_at);
    if(time(record.checkedAt)>time(checkedAt))continue;
    Object.assign(record,{checkedAt,status:entry.status??entry.courier_status??record.status,eventAt:entry.latest_event_at??entry.delivered_at});
    mergeTimeline(record,{carrier:'順豐',waybill:entry.waybill,checkedAt,eventAt:entry.latest_event_at??entry.delivered_at,eventText:entry.latest_event??entry.courier_status});
    sfRecords.set(record.id,record);
  }
  for(const batch of list(ledger.verified_received_batches))for(const waybill of list(batch.taiwan_waybills)){
    const record=sfRecords.get(waybill)??{id:waybill,waybill};
    // Combined verified contents belong to the batch, never to either carton.
    if(batch.combined_contents_verified){record.batchTotalItems=itemsFrom(batch.items,catalog);record.batchWaybills=batch.taiwan_waybills;record.batchId=hash(batch.batch_key);}
    sfRecords.set(waybill,record);
  }
  sf.records=[...sfRecords.values()];
  const grouped=new Map();
  for(const a of allocations){
    const group=a.received_batch_key??a.kkren_batch??a.taiwan_waybill??a.waybill;
    if(!group||!a.entered_inbound_on)continue;
    if(!grouped.has(group))grouped.set(group,[]);grouped.get(group).push(a);
  }
  const receiving=[];
  for(const [key,rows] of grouped){
    const first=rows[0],batch=list(ledger.verified_received_batches).find(b=>b.batch_key===key);
    const eventRows=rows.map(a=>({id:hash(a.event_key),sku:a.model,name:a.inbound_values?.[2]??catalog.get(a.model)?.name??a.model,quantity:a.quantity,
      effectiveDate:a.entered_inbound_on,historyVerified:!!(a.history_verified&&sheets.history?.[a.history_row-1]?.[0]===a.entered_inbound_on&&sheets.history[a.history_row-1]?.[2]===a.model&&Number(sheets.history[a.history_row-1]?.[6])===a.quantity&&sameInbound(sheets.history[a.history_row-1]?.slice(1),a.inbound_values))}));
    const deliveredAt=latest(batch?.batch_complete_delivered_at,...rows.map(a=>a.parent_carrier_delivered_at??a.delivered_at));
    const tracking=consolidations.get(first.kkren_batch)?.tracking;
    const dates=unique(rows.map(a=>a.entered_inbound_on));
    receiving.push({id:'shipment-'+hash(key),kind:'shipment',reference:first.kkren_batch??(batch?'順豐同批 '+batch.taiwan_waybills.length+' 箱':first.taiwan_waybill??first.waybill),
      waybills:unique(batch?.taiwan_waybills??rows.flatMap(a=>a.taiwan_waybills??[a.taiwan_waybill])),sellerWaybills:unique(rows.map(a=>a.waybill)),
      source:first.kkren_batch?'kkren':'sf',items:sumItems(eventRows),events:eventRows,effectiveDate:dates.length===1?dates[0]:null,
      entered:true,historyVerified:eventRows.every(a=>a.historyVerified),deliveredAt,carrierStatus:deliveredAt?'已送達':tracking?'已填入庫單':'物流待更新',
      lastEvent:tracking?.events[0]??(deliveredAt?{at:deliveredAt,text:'已簽收'}:null),checkedAt:latest(tracking?.checkedAt,...rows.map(a=>a.delivery_verified_at??a.verified_at)),
      warehouseConfirmedQuantity:null,warehouseCountPending:rows.some(a=>a.warehouse_quantity_confirmation_pending===true)||!!consolidations.get(first.kkren_batch)?.manifestConflict||!!consolidations.get(first.kkren_batch)?.trackingConflict,
      batchScope:!!batch,quantityAllocationNote:batch?'兩箱合計；未推定各箱分配':null});
  }
  for(const entry of open)if(!receiving.some(r=>r.reference===entry.kkren_shipment_id)){
    const record=consolidations.get(entry.kkren_shipment_id);
    receiving.push({id:'shipment-'+hash(entry.kkren_shipment_id),kind:'shipment',reference:entry.kkren_shipment_id,source:'kkren',waybills:[entry.taiwan_waybill],sellerWaybills:entry.seller_waybills,
      items:record?.confirmedShipmentItems??record?.members?.flatMap(m=>m.verifiedItems??[])??[],entered:false,historyVerified:false,effectiveDate:null,deliveredAt:entry.delivered_at??null,
      carrierStatus:record?.carrierStatus??'物流待更新',lastEvent:record?.tracking?.events[0]??null,checkedAt:record?.tracking?.checkedAt??entry.verified_at,warehouseConfirmedQuantity:null,warehouseCountPending:false});
  }
  for(const entry of list(returnsLedger.cases)){
    const rows=list(entry.items);if(!rows.length)continue;
    const entered=rows.every(item=>item.state==='entered');
    const effectiveDate=entered?(rows[0].effective_date_correction?.corrected_effective_date??rows[0].approved_effective_date??entry.effective_inbound_date??null):null;
    const events=rows.map(item=>{
      const row=item.destinations?.history_row??item.history_row;
      const hist=sheets.history?.[row-1];
      return {id:hash(item.event_key),sku:item.sku??'',name:item.name??item.visible_model??catalog.get(item.sku)?.name??item.sku??'商品待核對',quantity:item.quantity,
        historyVerified:!!(entered&&hist?.[0]===effectiveDate&&hist?.[2]===item.sku&&Number(hist?.[6])===item.quantity&&sameInbound(hist?.slice(1),item.inbound_values))};
    });
    receiving.push({id:'return-'+hash(entry.parcel_key??entry.case_ref),kind:'shipment',reference:entry.case_ref,source:'return',items:events,events,
      waybills:[],sellerWaybills:[],entered,effectiveDate,historyVerified:entered&&events.every(item=>item.historyVerified),
      carrierStatus:entered?'3PL 逆物流收件':'待退貨確認',lastEvent:entry.receipt_reported_at?{at:entry.receipt_reported_at,text:'3PL 退貨收件紀錄'}:null,
      checkedAt:returnsLedger.scan_checkpoint?.latest_reviewed_message_at,warehouseConfirmedQuantity:null,warehouseCountPending:false,
      hold:!entered,holdReason:entered?null:'退貨狀態／商品待確認；尚未填入庫單',quantityAllocationNote:null});
  }
  for(const discrepancy of list(returnsLedger.warehouse_discrepancy_observations).filter(d=>d.status==='needs_arrival_reconciliation')){
    receiving.push({id:'difference-'+hash(`${discrepancy.sku}|${discrepancy.history_date}|${discrepancy.observed_at}`),kind:'shipment',reference:'入庫數量差異',source:'reconciliation',
      items:[{sku:discrepancy.sku,name:catalog.get(discrepancy.sku)?.name??discrepancy.sku,quantity:discrepancy.history_quantity}],events:[],waybills:[],sellerWaybills:[],
      entered:true,effectiveDate:discrepancy.history_date,historyVerified:false,carrierStatus:'數量待核對',lastEvent:{at:discrepancy.observed_at,text:`倉庫回報 ${discrepancy.warehouse_reported_received_quantity}；入庫紀錄 ${discrepancy.history_quantity}`},
      checkedAt:discrepancy.observed_at,warehouseConfirmedQuantity:null,warehouseCountPending:true,holdReason:'既有倉庫數量差異尚未完成對帳，未自動改寫歷史數量。'});
  }
  const activeDate=ledger.current_inbound_summary?.effective_date??returnsLedger.active_batch_date??null;
  const currentItems=list(sheets.main).slice(1).filter(r=>r[1]).map(r=>({sku:r[1],name:r[2],quantity:Number(r[5]),note:r[6]??''}));
  const pending=list(sheets.pending).slice(1).filter(r=>r[0]);
  const run={id:'run',kind:'run',trackingCheckedAt:ledger.last_check?.at??null,sheetsCheckedAt:sheets.checkedAt,activeDate,
    currentItems,pendingLines:pending.length,pendingUnits:pending.reduce((n,r)=>n+(Number(r[7])||0),0),
    readOnlyProjection:true};
  const inbound={owner_id:owners[0],source:'inbound',observed_at:ledger.last_check?.at??sheets.checkedAt,
    coverage:'私有包裹分配及入庫紀錄；物流與工作表各自保留查核時間。配送／簽收、已填入庫單、倉庫點收分開；不調整庫存。',records:[run,...receiving]};
  const index=output.findIndex(f=>f.source==='inbound');if(index>=0)output[index]=inbound;else output.push(inbound);
  for(const feed of output){
    if(feed.records.length>500)throw new Error(`Source ${feed.source} exceeds the preserved feed capacity; paginate instead of truncating`);
    if(new Set(feed.records.map(r=>r.id)).size!==feed.records.length)throw new Error(`Duplicate source IDs: ${feed.source}`);
  }
  return output;
}

