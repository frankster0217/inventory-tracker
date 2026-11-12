import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInventoryRows,inventoryGroups,needsRestock} from '../workbench/operations/inventory.mjs';
import {liveInventory,restockOverview} from '../workbench/operations/views.mjs';
const now=Date.parse('2026-11-11T11:00:00Z'),stamp=new Date(now).toISOString();
const suppliers=[{supplier_id:'hcx',name:'Supplier <ZTE>',sort_order:2},{supplier_id:'ahw',name:'Huawei',sort_order:1}];
const rows=[{product_id:'MF296R',product_name:'Router',quantity:2,supplier_id:'hcx'},{product_id:'NR5103e',product_name:'Router',quantity:4,supplier_id:'ahw'},{product_id:'Unknown',product_name:'Unknown',quantity:0,supplier_id:null}];
const catalog={rows,suppliers,archived:[],importedAt:stamp};
const base={inventory:rows,suppliers,archived:[],inventory_meta:{last_import:stamp},canonical:true,sales_freshness:{latest_sync:stamp},sales_velocity_by_code:[{product_code:'MF296R',sold_m2:60},{product_code:'NR5103e',sold_m2:22}],pending_orders:[],purchase_sync:{complete:true,checked_at:stamp}};
const item=(result,sku)=>result.items.find(p=>p.sku===sku);
test('exact SKU demand separates same-name products and subtracts only paid outstanding units',()=>{
 const result=buildInventoryRows(catalog,{...base,pending_orders:[
  {id:'paid',status:'paid',items:[{sku:'MF296R',quantity:10,received_qty:3}]},
  {id:'unpaid',status:'submitted_unpaid',items:[{sku:'MF296R',quantity:100}]},
  {id:'cancelled',status:'cancelled',items:[{sku:'MF296R',quantity:100}]}
 ]},{},now);
 assert.equal(item(result,'MF296R').incoming,7);
 assert.equal(item(result,'MF296R').suggestion,27);
 assert.equal(item(result,'NR5103e').suggestion,9);
 assert.equal(item(result,'MF296R').verified,true);
 assert.equal(item(result,'Unknown').suggestion,null);
});
test('incomplete incoming is unknown and estimates cannot become verified purchase actions',()=>{
 const result=buildInventoryRows(catalog,{...base,purchase_sync:{complete:false}},{},now);
 assert.equal(item(result,'MF296R').incoming,null);
 assert.equal(item(result,'MF296R').verified,false);
 assert.equal(item(result,'MF296R').suggestion,34);
});
test('stale sales or failed plan reads preserve inventory without a purchase recommendation',()=>{
 const stale={...base,sales_freshness:{latest_sync:'2026-11-08T00:00:00Z'}};
 assert.equal(item(buildInventoryRows(catalog,stale,{},now),'MF296R').suggestion,null);
 const failed=buildInventoryRows(catalog,null,{},now);
 assert.equal(item(failed,'MF296R').stock,2);
 assert.equal(item(failed,'MF296R').incoming,null);
 assert.equal(item(failed,'MF296R').suggestion,null);
});
test('supplier grouping preserves assignments and puts unassigned products in their own group',()=>{
 const result=buildInventoryRows(catalog,base,{},now);
 assert.deepEqual(inventoryGroups(result.items).map(g=>g.id),['ahw','hcx','']);
 assert.equal(result.items.filter(needsRestock).length,2);
});
test('inventory and dashboard link to one replenishment view with readable quantities and escaped names',()=>{
 const result=buildInventoryRows(catalog,base,{},now);
 const state={stock:{...result,importedAt:stamp},supplier:'all',filter:'all',query:'',gallery:'table',page:1,sort:'sku'};
 const landing=liveInventory(state);
 assert.match(landing,/需補貨/);assert.match(landing,/data-supplier="hcx"/);assert.match(landing,/Supplier &lt;ZTE&gt;/);
 const detail=liveInventory({...state,supplier:'hcx',filter:'restock'});
 assert.match(detail,/採購在途/);assert.match(detail,/建議補貨/);assert.match(detail,/>34<\/strong>/);
 assert.doesNotMatch(detail,/aria-label="NR5103e"/);
 assert.match(restockOverview(state),/data-go="inventory" data-jump="restock"/);
});

test('readable sales RPC with unknown sync time gives estimates, never verified purchases',()=>{
 const result=buildInventoryRows(catalog,{...base,sales_freshness:{latest_sync:undefined}},{},now);
 assert.equal(item(result,'NR5103e').suggestion,9);
 assert.equal(item(result,'NR5103e').verified,false);
 assert.equal(result.model.sources.sales.fresh,false);
});

test('replenishment shows every product immediately under its supplier, including beyond the old page limit',()=>{
 const result=buildInventoryRows(catalog,base,{},now);
 const source=item(result,'MF296R');
 const items=Array.from({length:28},(_,i)=>({...source,sku:`RESTOCK-${String(i+1).padStart(2,'0')}`}));
 items.push(item(result,'NR5103e'),{...source,sku:'UNASSIGNED',supplierId:'',supplier:'供應商未指派',supplierOrder:999});
 const state={stock:{...result,items,importedAt:stamp},supplier:'all',filter:'restock',query:'',gallery:'table',page:1,sort:'sku'};
 for(const html of [liveInventory(state),liveInventory({...state,gallery:'gallery'}),restockOverview(state)]){
  assert.equal((html.match(/data-open="inventory-live"/g)||[]).length,30);
  assert.match(html,/RESTOCK-28/);
  assert.match(html,/NR5103e/);
  assert.match(html,/UNASSIGNED/);
  assert.match(html,/Supplier &lt;ZTE&gt;/);
  assert.match(html,/供應商未指派/);
  assert.equal((html.match(/class="restock-supplier"/g)||[]).length,3);
  assert.doesNotMatch(html,/class="card supplier-card"|data-page=/);
 }
 const filtered=liveInventory({...state,query:'RESTOCK-28'});
 assert.equal((filtered.match(/data-open="inventory-live"/g)||[]).length,1);
 assert.doesNotMatch(filtered,/aria-label="RESTOCK-27"/);
 const oneSupplier=liveInventory({...state,supplier:'ahw'});
 assert.match(oneSupplier,/aria-label="NR5103e"/);
 assert.doesNotMatch(oneSupplier,/aria-label="RESTOCK-01"/);
});
