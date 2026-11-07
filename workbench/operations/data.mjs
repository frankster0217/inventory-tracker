export const demoDay = '2026-11-06';
export const categories = ['4G / 5G 路由器','行動分享器','IP 電話','語音閘道器','IP PBX','耳機耳麥','天線','配件'];
export const routes = {
  A: ['MagicBuy → KKren → 台灣 3PL', '漳州倉集運'],
  B: ['Taobao → SF Express → 台灣 3PL', '順豐直寄'],
  C: ['Taobao → KKren → 台灣 3PL', '漳州倉集運'],
};
export const suppliers = [
  {id:'S-01',name:'華南通訊器材',channels:'MagicBuy · Aliwangwang',skus:['MF296R','F50','88dBi SMA-3m'],lead:6},
  {id:'S-02',name:'深灣企業通訊',channels:'Taobao · Aliwangwang',skus:['X301P','HT813','UCM6302A'],lead:4},
  {id:'S-03',name:'廣成語音設備',channels:'Taobao · WeChat',skus:['HT813','YHS34','X301P'],lead:7},
  {id:'S-04',name:'台灣網通配件',channels:'Direct',skus:['DWM-222W','88dBi SMA-3m'],lead:3},
];
const product = (sku,brand,name,category,photo,stock,reserved,sold,lead,threshold,channels) => ({
  sku,brand,name,category:categories[category],photo,stock,reserved,sold,lead,threshold,channels,
  suppliers:suppliers.filter(s=>s.skus.includes(sku)).map(s=>s.id),
});
export const products = [
  product('MF296R','ZTE','4G 插卡路由器',0,'mf296r',9,4,38,6,8,['Shopee','EasyStore','Coupang']),
  product('F50','ZTE','5G 行動分享器',1,'f50',4,3,24,6,5,['Shopee','EasyStore','Ruten']),
  product('X301P','Fanvil','PoE IP 電話',2,'x301p',7,4,32,4,6,['EasyStore','Shopee']),
  product('HT813','Grandstream','VoIP 類比語音閘道器',3,'ht813',18,3,14,7,5,['EasyStore','Ruten']),
  product('UCM6302A','Grandstream','IP PBX 企業電話總機',4,'ucm',8,1,5,4,3,['EasyStore']),
  product('YHS34','Yealink','QD 話務耳麥',5,'yhs34',0,0,12,7,4,['Shopee','EasyStore']),
  product('88dBi SMA-3m','PORTO','SMA 平板增益天線',6,'sma',29,2,17,6,7,['Shopee','Ruten']),
  product('DWM-222W','D-Link','4G USB 網卡',7,'dwm',13,2,11,3,5,['Shopee','EasyStore','Coupang']),
];
export const knownProducts = new Map(products.map(p=>[p.sku,p]));
export const status = {
  payment:['待付款','amber'], seller:['待賣家出貨','amber'], sent:['已出貨','blue'], missing:['缺少物流單號','red'],
  waiting:['待到漳州倉','gray'], storage:['已到漳州倉','blue'], ready:['待集運','amber'], grouped:['已合箱','blue'],
  international:['國際運輸中','blue'], delivery:['台灣配送中','amber'], delivered:['已送達','green'], exception:['物流異常','red'],
  process:['待處理','gray'], label:['待下載標籤','amber'], handoff:['待交 3PL','blue'], shipped:['已出貨','green'], hold:['出貨異常','red'],
  announce:['待填入庫單','amber'], warehouse:['待倉庫確認','blue'], received:['已完成入庫','green'], mismatch:['入庫異常','red'],
};
export const line = (sku,qty,cost=null) => ({sku,qty,cost});
export const event = (date,time,title,location,source) => ({at:date+'T'+time+':00+08:00',title,location,source});
const ev = (time,title,location,source) => event(demoDay,time,title,location,source);
const dated = (day,time,title,location,source) => event('2026-11-'+day,time,title,location,source);
export const createDemo = () => ({
  purchase:[
    {id:'PO-1106-01',supplier:'S-01',source:'MagicBuy',route:'A',status:'sent',paid:true,date:'11/03',ref:'MB-DEMO-8801',eta:'11/06',lines:[line('MF296R',12,168)],parcels:['PK-103','PK-104']},
    {id:'PO-1106-02',supplier:'S-02',source:'Taobao',route:'B',status:'sent',paid:true,date:'11/04',ref:'TB-DEMO-8802',eta:'11/06',lines:[line('X301P',10,156)],parcels:['PK-105']},
    {id:'PO-1106-03',supplier:'S-03',source:'Taobao',route:'C',status:'sent',paid:true,date:'11/02',ref:'TB-DEMO-8803',eta:'11/06',lines:[line('HT813',12,445)],parcels:['PK-106']},
    {id:'PO-1106-04',supplier:'S-01',source:'MagicBuy',route:'A',status:'payment',paid:false,date:'11/06',ref:'MB-DEMO-8804',eta:null,lines:[line('F50',10,229)],parcels:[]},
    {id:'PO-1106-05',supplier:'S-03',source:'Taobao',route:'C',status:'missing',paid:true,date:'11/03',ref:null,eta:null,lines:[line('YHS34',8,83)],parcels:[]},
    {id:'PO-1106-06',supplier:'S-04',source:'Direct',route:null,status:'seller',paid:true,date:'11/05',ref:'DIRECT-DEMO-6',eta:null,lines:[line('DWM-222W',6,72)],parcels:[]},
    {id:'PO-1106-07',supplier:'S-01',source:'MagicBuy',route:'A',status:'sent',paid:true,date:'11/02',ref:'MB-DEMO-8807',eta:null,lines:[line('88dBi SMA-3m',10,42)],parcels:['PK-107']},
    {id:'PO-1106-08',supplier:'S-02',source:'MagicBuy',route:'A',status:'sent',paid:true,date:'11/02',ref:'MB-DEMO-8808',eta:null,lines:[line('UCM6302A',2,620)],parcels:['PK-108']},
  ],
  shipping:[
    {id:'SP-DEMO-701',brand:'PORTO 3C',source:'Shopee',customer:'零售訂單 A',status:'label',due:'11/06 15:30',label:'待下載',handoff:'待提交',error:null,lines:[line('MF296R',1)]},
    {id:'ES-DEMO-702',brand:'VOICity',source:'EasyStore',customer:'企業訂單 B',status:'handoff',due:'11/06 16:30',label:'已備妥',handoff:'待提交',error:null,lines:[line('HT813',2)]},
    {id:'CP-DEMO-703',brand:'PORTO 3C',source:'Coupang',customer:'零售訂單 C',status:'hold',due:'11/06 14:00',label:'待下載',handoff:'暫緩',error:'贈品需核對',lines:[line('DWM-222W',1)]},
    {id:'RT-DEMO-704',brand:'VOICity',source:'Ruten',customer:'零售訂單 D',status:'process',due:'11/06 16:00',label:'未處理',handoff:'待提交',error:null,lines:[line('X301P',2)]},
    {id:'ES-DEMO-705',brand:'PORTO 3C',source:'EasyStore',customer:'零售訂單 E',status:'shipped',due:'11/06 12:00',label:'已備妥',handoff:'已提交',error:null,lines:[line('F50',1)]},
    {id:'SP-DEMO-706',brand:'VOICity',source:'Shopee',customer:'零售訂單 F',status:'label',due:'11/06 16:00',label:'待下載',handoff:'待提交',error:null,lines:[line('YHS34',1)]},
  ],
  parcels:[
    {id:'PK-103',po:'PO-1106-01',route:'A',batch:'KK-DEMO-24',status:'delivered',carrier:'中通快遞',waybill:'ZT-DEMO-3103',location:'台北 · 3PL',weight:5.4,lines:[line('MF296R',8)],events:[dated('03','14:24','賣家交寄','深圳','MagicBuy'),dated('04','09:16','漳州倉簽收','漳州倉','KKren'),dated('05','18:05','國際運輸中','漳州 → 台灣','KKren'),ev('10:12','已送達指定 3PL','台北','新竹物流')]},
    {id:'PK-104',po:'PO-1106-01',route:'A',batch:null,status:'waiting',carrier:'中通快遞',waybill:'ZT-DEMO-3104',location:'福建 · 國內轉運',weight:2.8,lines:[line('MF296R',4)],events:[dated('05','16:42','分箱交寄','深圳','MagicBuy'),ev('08:35','國內轉運','福建','中通快遞')]},
    {id:'PK-105',po:'PO-1106-02',route:'B',batch:null,status:'delivery',carrier:'SF Express',waybill:'SF-DEMO-3105',location:'台北 · 配送站',destination:'TW-3PL',weight:7.8,lines:[line('X301P',10)],events:[dated('04','18:24','賣家交寄','深圳','Taobao'),dated('05','20:18','抵達台灣轉運站','桃園','SF Express'),ev('09:48','快件正在派送中','台北','SF Express')]},
    {id:'PK-106',po:'PO-1106-03',route:'C',batch:'KK-DEMO-24',status:'delivered',carrier:'京東快遞',waybill:'JD-DEMO-3106',location:'台北 · 3PL',weight:4.3,lines:[line('HT813',12)],events:[dated('03','15:10','賣家交寄','廣州','Taobao'),dated('04','10:38','漳州倉簽收','漳州倉','KKren'),dated('05','18:05','國際運輸中','漳州 → 台灣','KKren'),ev('10:12','已送達指定 3PL','台北','新竹物流')]},
    {id:'PK-107',po:'PO-1106-07',route:'A',batch:null,status:'ready',carrier:'中通快遞',waybill:'ZT-DEMO-3107',location:'漳州倉',weight:8.4,lines:[line('88dBi SMA-3m',10)],events:[dated('04','13:15','賣家交寄','深圳','MagicBuy'),ev('08:05','漳州倉簽收，等待集運','漳州倉','KKren')]},
    {id:'PK-108',po:'PO-1106-08',route:'A',batch:null,status:'ready',carrier:'中通快遞',waybill:'ZT-DEMO-3108',location:'漳州倉',weight:2.1,lines:[line('UCM6302A',2)],events:[dated('04','11:25','賣家交寄','深圳','MagicBuy'),ev('09:21','漳州倉簽收，等待集運','漳州倉','KKren')]},
  ],
  batches:[
    {id:'KK-DEMO-24',status:'delivered',parcels:['PK-103','PK-106'],carrier:'新竹物流',waybill:'HCT-DEMO-24',location:'台北 · 3PL',destination:'TW-3PL',events:[dated('04','16:20','合箱完成 · 2 個包裹','漳州倉','KKren'),dated('05','18:05','國際運輸中','漳州 → 台灣','KKren'),ev('08:50','台灣末端配送中','蘆洲營業所','新竹物流'),ev('10:12','已送達指定 3PL','台北','新竹物流')]},
  ],
  receiving:[
    {id:'IN-DEMO-301',ref:'PK-105',kind:'parcel',date:demoDay,status:'announce',carrier:'delivery',source:'SF Express',written:false,actual:{},lines:[line('X301P',10)]},
    {id:'IN-DEMO-302',ref:'KK-DEMO-24',kind:'batch',date:demoDay,status:'warehouse',carrier:'delivered',source:'新竹物流',written:true,actual:{},lines:[line('MF296R',8),line('HT813',12)]},
    {id:'IN-DEMO-290',ref:'KK-DEMO-22',kind:null,date:'2026-11-05',status:'mismatch',carrier:'delivered',source:'黑貓',written:true,actual:{'F50':4},lines:[line('F50',6)]},
    {id:'IN-DEMO-282',ref:'SF-DEMO-282',kind:null,date:'2026-11-04',status:'received',carrier:'delivered',source:'SF Express',written:true,actual:{'DWM-222W':5},lines:[line('DWM-222W',5)]},
  ],
  activity:[
    {time:'11:02',title:'出貨批次去重完成',detail:'示例 · 已比對既有出庫單',icon:'check',ref:['shipping','ES-DEMO-705']},
    {time:'10:35',title:'合箱到貨事件已核對',detail:'示例 · 等待倉庫點收',icon:'warehouse',ref:['receiving','IN-DEMO-302']},
    {time:'09:00',title:'供應商補貨檢查',detail:'示例 · 更新待採購清單',icon:'cart',ref:['product','F50']},
  ],
});
