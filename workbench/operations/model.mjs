import {DEFAULTS, isService, number} from '../src/core.mjs';
import {demoDay, knownProducts, line, suppliers} from './data.mjs';

const dateTaipei = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
export const taipeiDay = at => dateTaipei.format(new Date(at));
export const totalUnits = lines => lines.reduce((sum,row)=>sum+row.qty,0);
export const supplierName = id => suppliers.find(row=>row.id===id)?.name ?? '供應商待核對';
export function incomingFor(demo,sku) {
  const paid=new Set(demo.purchase.filter(p=>p.paid).map(p=>p.id));
  const ordered=demo.purchase.filter(p=>paid.has(p.id)).flatMap(p=>p.lines).filter(row=>row.sku===sku).reduce((sum,row)=>sum+row.qty,0);
  const received=demo.receiving.reduce((sum,row)=>{
    const parcels=row.kind==='batch'?demo.batches.find(b=>b.id===row.ref)?.parcels:row.kind==='parcel'?[row.ref]:[];
    const allocated=demo.parcels.filter(p=>parcels?.includes(p.id)&&paid.has(p.po)).flatMap(p=>p.lines)
      .filter(line=>line.sku===sku).reduce((amount,line)=>amount+line.qty,0);
    return sum+Math.min(allocated,row.actual[sku]??0);
  },0);
  return Math.max(0,ordered-received);
}

export function demoStock(product,demo) {
  const available=product.stock-product.reserved;
  const incoming=incomingFor(demo,product.sku);
  const target=product.sold/(60/7)*(DEFAULTS.targetWeeks+product.lead/7)*DEFAULTS.buffer;
  return {...product,available,incoming,suggestion:Math.max(0,Math.ceil(target-available-incoming)),archived:false,source:'demo'};
}

export function readSnapshot(snapshot) {
  const names=new Map(snapshot.suppliers);
  const archived=new Set(snapshot.archived);
  return snapshot.items.map(([sku,name,quantity,supplier])=>{
    const known=knownProducts.get(sku);
    return {sku,name,brand:known?.brand,category:known?.category,photo:known?.photo,
      stock:number(quantity),archived:archived.has(name),service:isService(sku),supplier:names.get(supplier),source:'snapshot'};
  });
}

export function receiptDraft(record,source) {
  const dateOk = record.date === demoDay && source?.destination==='TW-3PL' && source.events.some(entry=>
    ['SF Express','新竹物流','黑貓'].includes(entry.source) && taipeiDay(entry.at) === demoDay && (
      record.carrier === 'delivery' ? /派送中|配送中/.test(entry.title)
        : record.carrier === 'delivered' && /已送達指定 3PL/.test(entry.title)
    ));
  if(!dateOk) return {allowed:false,reason:'需要本日台灣 3PL 配送或簽收紀錄。'};
  if(record.written) return {allowed:false,reason:'此批已有提交紀錄。'};
  return {allowed:true,rows:record.lines.map(item=>['A',item.sku,knownProducts.get(item.sku).name,'台','示例倉位',item.qty,''])};
}

export function runReceiptPreview(record,source,ledger) {
  const key=record.ref+'|'+record.date;
  if(ledger.has(key)) return {ok:false,message:'已有本機寫入紀錄，已略過重複提交。'};
  const draft=receiptDraft(record,source);
  if(!draft.allowed) return {ok:false,message:draft.reason};
  ledger.set(key,{key,rows:draft.rows,recordId:record.id,date:record.date});
  record.written=true;
  record.status='warehouse';
  return {ok:true,message:'演練已記錄，可查看本機提交紀錄。'};
}

export function demoConsolidate(demo,selected) {
  const candidates=demo.parcels.filter(p=>selected.has(p.id)&&p.status==='ready'&&!p.batch&&p.route!=='B');
  if(candidates.length<2||candidates.length!==selected.size) return null;
  const id='KK-DEMO-'+String(25+demo.batches.length);
  const group={id,status:'grouped',parcels:candidates.map(p=>p.id),carrier:null,waybill:null,location:'漳州倉',events:[
    {at:demoDay+'T11:20:00+08:00',title:'本機演練合箱',source:'預覽操作',location:'漳州倉'}
  ]};
  candidates.forEach(p=>{p.batch=id;p.status='grouped';});
  demo.batches.push(group);
  return group;
}

export const combineLines = lines => [...lines.reduce((map,item)=>map.set(item.sku,(map.get(item.sku)??0)+item.qty),new Map())].map(([sku,qty])=>line(sku,qty));

export function validateImport(text,existingIds) {
  const parsed=JSON.parse(text);
  if(!Array.isArray(parsed)||!parsed.length||parsed.length>100) throw new Error('請使用範本格式，每次匯入 1–100 筆。');
  const ids=new Set(existingIds);
  return parsed.map(entry=>{
    if(!entry||typeof entry.id!=='string'||!/^[A-Za-z0-9-]{1,32}$/.test(entry.id)||ids.has(entry.id)) throw new Error('有重複或無效的示例訂單編號。');
    if(!['Shopee','EasyStore','Coupang','Ruten'].includes(entry.source)||!['PORTO 3C','VOICity'].includes(entry.brand)) throw new Error('通路或店家無法辨識。');
    if(!Array.isArray(entry.lines)||!entry.lines.length||entry.lines.some(row=>!row||!knownProducts.has(row.sku)||!Number.isSafeInteger(row.qty)||row.qty<1)) throw new Error('商品編號或數量無法核對。');
    ids.add(entry.id);
    return {id:entry.id,source:entry.source,brand:entry.brand,customer:'匯入演練',status:'process',due:null,label:'未處理',handoff:'待提交',error:null,lines:combineLines(entry.lines)};
  });
}
