import {buildWorkbench, DEFAULTS, number} from '../src/core.mjs';

export const INVENTORY_SETTINGS = {...DEFAULTS, minOrderQty:5};

// Read-only projection: the warehouse catalog remains the source of stock and supplier assignments.
export function buildInventoryRows(catalog, snapshot, settings={}, now=Date.now()) {
  const cfg={...INVENTORY_SETTINGS,...settings};
  const model=snapshot?buildWorkbench(snapshot,cfg,now):null;
  const plans=new Map(model?.products.map(p=>[p.code,p])??[]);
  const names=new Map(catalog.suppliers.map(s=>[s.supplier_id,s]));
  const archived=new Set(catalog.archived.map(p=>p.product_name));
  // The existing sales RPC is readable even when raw sales rows are not.
  // An unknown sync time permits a labelled estimate, never a verified buy action.
  const fresh=model?.sources.stock.fresh&&(model.sources.sales.fresh||!model.sources.sales.timestamp);
  const items=catalog.rows.map(row=>{
    const p=plans.get(row.product_id),supplier=names.get(row.supplier_id);
    const stock=number(row.quantity);
    const isArchived=row.is_archived??archived.has(row.product_name);
    const canEstimate=!!(fresh&&p&&p.sold60!==null&&!p.service&&!p.duplicate&&stock!==null&&stock===p.quantity&&!isArchived);
    const suggestion=canEstimate?(p.rawNeed>=cfg.minOrderQty?p.rawNeed:0):null;
    return {sku:row.product_id,name:row.product_name,stock,unit:row.unit,location:row.location,
      supplierId:row.supplier_id||'',supplier:supplier?.name||'供應商未指派',supplierOrder:supplier?.sort_order??999,
      archived:isArchived,sold60:p?.sold60??null,suggestion,rawNeed:canEstimate?p.rawNeed:null,
      incoming:model?.sources.purchasesComplete?p?.pending??0:null,recordedIncoming:p?.pending??null,
      verified:!!(canEstimate&&p.actionable),urgent:!!(canEstimate&&p.urgent&&suggestion>0),
      coverDays:p?.coverDays??null};
  });
  return {items,model,cfg};
}
export function inventoryGroups(items) {
  const groups=new Map();
  for(const item of items){
    if(!groups.has(item.supplierId))groups.set(item.supplierId,{id:item.supplierId,name:item.supplier,order:item.supplierOrder,items:[]});
    groups.get(item.supplierId).items.push(item);
  }
  return [...groups.values()].sort((a,b)=>Number(!a.id)-Number(!b.id)||a.order-b.order||a.name.localeCompare(b.name,'zh-TW'));
}
export const needsRestock=p=>!p.archived&&p.suggestion>0;
