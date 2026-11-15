// Prepare a connector-executed, atomic compare-and-set update. This module
// contains no credentials and never changes source sites, Sheets or stock.
const normalize=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const allowed=new Set(['magicbuy','kkren','sf','inbound']);
const sources=new Set([...allowed,'shopee_porto','shopee_voicity']);
const comparable=feed=>feed?{...feed,observed_at:new Date(feed.observed_at).toISOString()}:feed;
export function trackingPublication(before,after){
  const owners=[...new Set(before.feeds.map(f=>f.owner_id))];
  if(owners.length!==1||!/^[0-9a-f-]{36}$/.test(owners[0]))throw new Error('One verified UUID owner is required');
  const original=new Map(before.feeds.map(f=>[f.source,f]));
  const changed=[];
  for(const feed of after){
    if(normalize(comparable(original.get(feed.source)))===normalize(comparable(feed)))continue;
    if(!allowed.has(feed.source)||feed.owner_id!==owners[0])throw new Error('Out-of-scope feed or owner');
    if(!Array.isArray(feed.records)||feed.records.length>500||!feed.coverage||[...feed.coverage].length>240)throw new Error('Invalid feed shape');
    if(new Set(feed.records.map(r=>r.id)).size!==feed.records.length)throw new Error('Duplicate record IDs');
    changed.push(feed);
  }
  if(!changed.length)return {sources:[],query:'select source,observed_at,jsonb_array_length(records) as record_count from public.portolink_source_feeds order by source;'};
  for(const [source,digest] of Object.entries(before.hashes))if(!sources.has(source)||!/^([0-9a-f]{32})$/.test(digest))throw new Error('Invalid source hash');
  const payload=Buffer.from(JSON.stringify(changed)).toString('base64');
  const query=`do $publish$
declare x record; expected jsonb := $hashes$${JSON.stringify(before.hashes)}$hashes$::jsonb;
begin
 if exists(select 1 from public.portolink_source_feeds where owner_id <> '${owners[0]}'::uuid) then raise exception 'Feed owner changed'; end if;
 for x in select * from jsonb_to_recordset(convert_from(decode('${payload}','base64'),'UTF8')::jsonb) as r(owner_id uuid,source text,observed_at timestamptz,coverage text,records jsonb)
 loop
  if x.owner_id <> '${owners[0]}'::uuid or x.source not in ('magicbuy','kkren','sf','inbound') then raise exception 'Out of scope feed'; end if;
  if expected ? x.source then
   update public.portolink_source_feeds f set records=x.records,coverage=x.coverage,observed_at=x.observed_at
    where f.owner_id=x.owner_id and f.source=x.source and md5(f.records::text)=expected->>x.source;
   if not found then raise exception 'Concurrent feed update: %',x.source; end if;
  else
   insert into public.portolink_source_feeds(owner_id,source,observed_at,coverage,records) values(x.owner_id,x.source,x.observed_at,x.coverage,x.records) on conflict do nothing;
   if not found then raise exception 'Concurrent feed insertion: %',x.source; end if;
  end if;
 end loop;
end $publish$;
select source,observed_at,jsonb_array_length(records) as record_count from public.portolink_source_feeds order by source;`;
  return {sources:changed.map(f=>f.source),query};
}
