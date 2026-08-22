export type BubbleBreakIntensity="low"|"medium"|"high";
export const BUBBLE_BREAK_SHARES:Record<BubbleBreakIntensity,number>={low:0.05,medium:0.10,high:0.20};
export const BUBBLE_BREAK_SAMPLING="DOMAIN_UNIFORM" as const;
export interface BubbleSeedRow {seedId:string;broadDomain:string;enabled?:boolean;[k:string]:unknown;}
export function fnv1a32(text:string):number{let h=2166136261>>>0;const bytes=new TextEncoder().encode(text);for(const b of bytes){h^=b;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
export function bubbleSlotCount(horizon:number,enabled:boolean,intensity:BubbleBreakIntensity="medium"):number{
  if(!enabled)return 0;const h=Math.max(0,Math.trunc(horizon));return Math.max(0,Math.min(h,Math.floor(h*BUBBLE_BREAK_SHARES[intensity]+0.5)));
}
export function knownInterestSlotCount(horizon:number,enabled:boolean,intensity:BubbleBreakIntensity="medium"):number{return Math.max(0,Math.trunc(horizon)-bubbleSlotCount(horizon,enabled,intensity));}
export function sampleDomainUniform(domains:string[],seed:string,slotIndex:number):string|null{const rows=[...new Set(domains.filter(Boolean))].sort();return rows.length?rows[fnv1a32(`${seed}:${slotIndex}`)%rows.length]!:null;}
export function sampleSeedUniform(seedIds:string[],seed:string,slotIndex:number):string|null{const rows=[...new Set(seedIds.filter(Boolean))].sort();return rows.length?rows[fnv1a32(`${seed}:${slotIndex}`)%rows.length]!:null;}
export function sampleDomainSeed(seedRows:BubbleSeedRow[],seed:string,slotIndex:number):BubbleSeedRow|null{
  const rows=seedRows.filter(x=>x.enabled!==false&&!!x.broadDomain);const domain=sampleDomainUniform(rows.map(x=>x.broadDomain),seed,slotIndex);if(!domain)return null;
  const pool=rows.filter(x=>x.broadDomain===domain).sort((a,b)=>a.seedId.localeCompare(b.seedId));return pool.length?pool[fnv1a32(`${seed}:${slotIndex}:${domain}`)%pool.length]!:null;
}
