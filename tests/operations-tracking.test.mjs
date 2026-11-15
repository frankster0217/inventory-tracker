import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrackingFeeds} from '../tools/tracking-projection.mjs';
import {feedView,feedDrawer} from '../workbench/operations/feeds.mjs';
import {trackingPublication} from '../tools/tracking-publication.mjs';

const old='2026-11-10T09:20:30Z',checked='2026-11-13T13:00:00+08:00';
const feeds=[
 {owner_id:'fixture-owner',source:'magicbuy',observed_at:old,coverage:'old verified page',records:[{id:'PO-OLD',status:'已發貨',route:'漳州倉集運',waybills:['SELLER-UNKNOWN'],items:[{sku:'UNKNOWN',name:'Order total is not a carton allocation',quantity:100}]}]},
 {owner_id:'fixture-owner',source:'kkren',observed_at:old,coverage:'old verified page',records:[{id:'S-UNKNOWN',status:'已出貨',members:[{waybill:'SELLER-UNKNOWN'}]}]},
 {owner_id:'fixture-owner',source:'sf',observed_at:old,coverage:'old verified page',records:[]},
 {owner_id:'fixture-owner',source:'shopee_porto',observed_at:old,coverage:'preserve unrelated queue',records:[{id:'UNRELATED',items:[]}]}
];
const row=['2026-11-13','A','SKU-A','Exact product A','','Warehouse',6,''];
const ledger={last_check:{at:checked},current_inbound_summary:{effective_date:'2026-11-13'},allocations:[
 {event_key:'carton-a',kkren_batch:'S-EXACT',waybill:'SELLER-A',taiwan_waybill:'TW-A',courier:'HCT',model:'SKU-A',quantity:6,entered_inbound_on:'2026-11-13',history_verified:true,history_row:2,inbound_values:row.slice(1),delivered_at:'2026-11-13T11:30:00+08:00',verified_at:checked}
],open_kkren_tracking:[
 {kkren_shipment_id:'S-EXACT',taiwan_carrier:'HCT',taiwan_waybill:'TW-A',seller_waybills:['SELLER-A'],latest_event_at:'2026-11-13T11:30:00+08:00',latest_event:'已簽收',verified_at:checked},
 {kkren_shipment_id:'S-CUSTOMS',taiwan_carrier:'Black Cat',taiwan_waybill:'TW-B',seller_waybills:['SELLER-B'],latest_event_at:'2026-11-13T09:00:00+08:00',latest_event:'貨物已清出，即將轉交黑貓宅急便派件',verified_at:checked}
],discovered_direct_sf:[
 {waybill:'SF-CARTON1',status:'已簽收',latest_event_at:'2026-11-13T10:00:00+08:00',latest_event:'已派送至本人',verified_at:checked},
 {waybill:'SF-CARTON2',status:'已簽收',latest_event_at:'2026-11-13T11:00:00+08:00',latest_event:'已派送至本人',verified_at:checked}
],verified_received_batches:[{batch_key:'TWO-CARTON-BATCH',taiwan_waybills:['SF-CARTON1','SF-CARTON2'],combined_contents_verified:true,items:{'SKU-B':5}}]};
const sheets={checkedAt:'2026-11-15T10:00:00Z',main:[['header'],row.slice(1)],history:[['header'],row],pending:[['header'],['PO','','','','',10,4,6,'A','SKU-A','Exact product A']]};
const build=()=>buildTrackingFeeds({feeds,ledger,sheets});
const state=rows=>({feed:{status:'ready',rows},stock:{items:[],model:null},filter:'all',query:'',liveMode:true});
test('newer verified ledger events reach the dashboard without changing source snapshot dates or unrelated records',()=>{
 const before=JSON.stringify({feeds,ledger,sheets}),result=build();
 assert.equal(JSON.stringify({feeds,ledger,sheets}),before);
 assert.deepEqual(result.find(f=>f.source==='shopee_porto'),feeds.find(f=>f.source==='shopee_porto'));
 const kk=result.find(f=>f.source==='kkren');
 assert.equal(kk.observed_at,old);
 assert.equal(kk.records.find(r=>r.id==='S-EXACT').tracking.checkedAt,checked);
 assert.equal(kk.records.find(r=>r.id==='S-EXACT').carrierStatus,'已送達');
 assert.equal(kk.records.find(r=>r.id==='S-CUSTOMS').carrierStatus,'運輸中');
 const sf=result.find(f=>f.source==='sf');
 assert.equal(sf.records[0].batchTotalItems[0].quantity,5);
 assert.equal(sf.records[0].confirmedShipmentItems,undefined);
 assert.equal(sf.records[1].confirmedShipmentItems,undefined);
 assert.doesNotMatch(JSON.stringify(result),/supplier_note|payment_evidence|private_contact/);
});
test('actual receiving rows show archived sheet verification separately from unconfirmed warehouse stock',()=>{
 const result=build(),feed=result.find(f=>f.source==='inbound');
 const r=feed.records.find(r=>r.reference==='S-EXACT');
 assert.equal(r.historyVerified,true);assert.equal(r.warehouseConfirmedQuantity,null);
 const html=feedView('receiving',state(result));
 assert.match(html,/SKU-A/);assert.match(html,/已填單 · 歷史已讀回/);assert.match(html,/倉庫點收/);assert.match(html,/資料待更新/);
 assert.doesNotMatch(html,/入庫與點收請使用既有工作表/);
 const drawer=feedDrawer('inbound|'+r.id,state(result));
 assert.match(drawer.body,/尚未確認/);
});
test('shipment matching never copies an entire order into an unallocated carton and SF totals are explicitly combined',()=>{
 const s=state(build()),html=feedView('parcels',s);
 assert.doesNotMatch(html,/× 100/);
 assert.match(html,/本箱數量待核對/);
 assert.match(html,/同批兩箱合計，不代表本箱數量/);
 assert.match(feedDrawer('sf|SF-CARTON1',s).body,/同批兩箱合計（不是本箱數量）/);
});
test('history read-back mismatches are not marked verified',()=>{
 const bad=structuredClone(sheets);bad.history[1][6]=99;
 const feed=buildTrackingFeeds({feeds,ledger,sheets:bad}).find(f=>f.source==='inbound');
 assert.equal(feed.records.find(r=>r.reference==='S-EXACT').historyVerified,false);
 const wrongLocation=structuredClone(sheets);wrongLocation.history[1][5]='Wrong warehouse location';
 const mismatch=buildTrackingFeeds({feeds,ledger,sheets:wrongLocation}).find(f=>f.source==='inbound');
 assert.equal(mismatch.records.find(r=>r.reference==='S-EXACT').historyVerified,false);
});
test('multiple owners are rejected and repeated projection preserves unique record IDs and item counts',()=>{
 assert.throws(()=>buildTrackingFeeds({feeds:[...feeds,{...feeds[0],owner_id:'other-owner'}],ledger,sheets}),/exactly one/);
 const one=build(),two=buildTrackingFeeds({feeds:one,ledger,sheets});
 for(const f of two)assert.equal(new Set(f.records.map(r=>r.id)).size,f.records.length);
 assert.equal(two.find(f=>f.source==='kkren').records.find(r=>r.id==='S-EXACT').confirmedShipmentItems[0].quantity,6);
});
test('publication changes only operational sources, guards previous hashes and skips unchanged state',()=>{
 const owned=feeds.map(f=>({...f,owner_id:'00000000-0000-0000-0000-000000000001'}));
 const before={feeds:owned,hashes:Object.fromEntries(owned.map(f=>[f.source,'a'.repeat(32)]))};
 assert.deepEqual(trackingPublication(before,owned).sources,[]);
 const next=buildTrackingFeeds({feeds:owned,ledger,sheets});
 const publication=trackingPublication(before,next);
 assert.ok(publication.sources.includes('inbound'));
 assert.ok(!publication.sources.includes('shopee_porto'));
 assert.match(publication.query,/md5\(f.records::text\)=expected/);
 assert.match(publication.query,/Concurrent feed update/);
 const bad=structuredClone(owned);bad[3].records=[];
 assert.throws(()=>trackingPublication(before,bad),/Out-of-scope/);
});
