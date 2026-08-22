export const QUALITY_GUARD_RELATIVE_MARGIN = 0.12;
export const MAX_BURST = 3;
export const MAX_STARVATION_WINDOW = 12;
export const DEBT_MIN = -1.5;
export const DEBT_MAX = 2.5;
export const TARGET_NEIGHBORHOOD_L1 = 0.30;
export const PERCEPTIBLE_L1_IMPROVEMENT = 0.30;
const clamp=(x:number,lo:number,hi:number)=>Math.min(Math.max(x,lo),hi);

export interface RatioV2Entry { interestId:string; userTarget:number; pinned:boolean; }
export interface RatioQueueHead { interestId:string; baseScore:number; candidateId?:string; }
export interface RatioControllerStateV2 {
  version:2; entries:RatioV2Entry[]; mode:"AUTO"|"EXPLICIT"; ratioEpoch:number;
  allocationDebt:Record<string,number>; recentKnownAllocations:string[]; recentWindow:number;
  lastChangedAtKnownSlot:number; totalKnownSlots:number; currentBurstInterest:string|null; currentBurst:number;
  starvation:Record<string,number>; qualifiedOpportunities:Record<string,number>; allocationCounts:Record<string,number>;
  maxBurstSeen:number; maxStarvationSeen:number; substitutionCount:number; qualityLossSum:number; knownDecisions:number;
}
export interface AllocationDecisionV2 {
  interestId:string|null; reason:string; qualifiedInterests:string[]; bestBaseScore:number; selectedBaseScore:number;
  qualityLoss:number; substituted:boolean; supplyLimited:string[]; debtBefore:Record<string,number>; debtAfter:Record<string,number>;
}
function normalizeEntries(entries:RatioV2Entry[]):void { if(!entries.length)return; const v=entries.map(e=>Math.max(0,e.userTarget)); const s=v.reduce((a,b)=>a+b,0); entries.forEach((e,i)=>e.userTarget=s<=1e-12?1/entries.length:v[i]/s); }
function ensureKeys(s:RatioControllerStateV2):void { for(const e of s.entries){s.allocationDebt[e.interestId]??=0;s.starvation[e.interestId]??=0;s.qualifiedOpportunities[e.interestId]??=0;s.allocationCounts[e.interestId]??=0;} }
export function createRatioControllerV2(entries:RatioV2Entry[],mode:"AUTO"|"EXPLICIT"="AUTO"):RatioControllerStateV2 {
  const copy=entries.slice(0,9).map(e=>({...e,userTarget:Math.max(0,e.userTarget)})); normalizeEntries(copy);
  const s:RatioControllerStateV2={version:2,entries:copy,mode,ratioEpoch:0,allocationDebt:{},recentKnownAllocations:[],recentWindow:30,lastChangedAtKnownSlot:0,totalKnownSlots:0,currentBurstInterest:null,currentBurst:0,starvation:{},qualifiedOpportunities:{},allocationCounts:{},maxBurstSeen:0,maxStarvationSeen:0,substitutionCount:0,qualityLossSum:0,knownDecisions:0}; ensureKeys(s); return s;
}
export function targetMapV2(s:RatioControllerStateV2):Record<string,number>{return Object.fromEntries(s.entries.map(e=>[e.interestId,e.userTarget]));}
export function startNewRatioEpoch(s:RatioControllerStateV2,mode:"AUTO"|"EXPLICIT"):void {
  s.mode=mode;s.ratioEpoch+=1;s.allocationDebt=Object.fromEntries(s.entries.map(e=>[e.interestId,0]));s.recentKnownAllocations=[];s.lastChangedAtKnownSlot=s.totalKnownSlots;s.currentBurstInterest=null;s.currentBurst=0;s.starvation=Object.fromEntries(s.entries.map(e=>[e.interestId,0]));s.qualifiedOpportunities=Object.fromEntries(s.entries.map(e=>[e.interestId,0]));s.allocationCounts=Object.fromEntries(s.entries.map(e=>[e.interestId,0]));s.maxBurstSeen=0;s.maxStarvationSeen=0;s.substitutionCount=0;s.qualityLossSum=0;s.knownDecisions=0;
}
export function recentShareV2(s:RatioControllerStateV2,id:string,window=s.recentWindow):number {const h=s.recentKnownAllocations.slice(-Math.max(1,window));return h.length?h.filter(x=>x===id).length/h.length:0;}
export function ratioL1V2(s:RatioControllerStateV2,window=s.recentWindow):number{return s.entries.reduce((a,e)=>a+Math.abs(e.userTarget-recentShareV2(s,e.interestId,window)),0);}
export function setExplicitRatioV2(s:RatioControllerStateV2,interestId:string,value:number):void {
  let t=s.entries.find(e=>e.interestId===interestId);
  if(!t){if(s.entries.length>=9){const r=s.entries.filter(e=>!e.pinned).sort((a,b)=>a.userTarget-b.userTarget)[0];if(!r)throw new Error("all ratio entries are pinned");s.entries=s.entries.filter(e=>e!==r);}t={interestId,userTarget:0.05,pinned:false};s.entries.push(t);normalizeEntries(s.entries);}
  const pinnedOther=s.entries.filter(e=>e!==t&&e.pinned).reduce((a,e)=>a+e.userTarget,0);const available=Math.max(0,1-pinnedOther);t.userTarget=Math.min(clamp(value,0,1),available);
  const rest=s.entries.filter(e=>e!==t&&!e.pinned);const remaining=Math.max(0,available-t.userTarget);const old=rest.reduce((a,e)=>a+Math.max(0,e.userTarget),0);
  rest.forEach(e=>e.userTarget=old<=1e-12?remaining/rest.length:remaining*Math.max(0,e.userTarget)/old);normalizeEntries(s.entries);startNewRatioEpoch(s,"EXPLICIT");
}
export function setExplicitTargetsV2(s:RatioControllerStateV2,targets:Record<string,number>,pinned:string[]=[]):void {
  const pin=new Set(pinned),old=new Map(s.entries.map(e=>[e.interestId,e]));s.entries=Object.entries(targets).slice(0,9).map(([interestId,userTarget])=>({interestId,userTarget:Math.max(0,userTarget),pinned:pin.has(interestId)||!!old.get(interestId)?.pinned}));normalizeEntries(s.entries);startNewRatioEpoch(s,"EXPLICIT");
}
export function resetRatioToAutoV2(s:RatioControllerStateV2,profileTargets:Record<string,number>):void {
  const pinned=s.entries.filter(e=>e.pinned).map(e=>e.interestId),seen=new Set<string>(),chosen:RatioV2Entry[]=[];
  for(const id of pinned)if(profileTargets[id]!==undefined&&!seen.has(id)){chosen.push({interestId:id,userTarget:profileTargets[id],pinned:true});seen.add(id);}
  for(const [id,v] of Object.entries(profileTargets).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))){if(chosen.length>=9)break;if(!seen.has(id)){chosen.push({interestId:id,userTarget:v,pinned:false});seen.add(id);}}
  s.entries=chosen;normalizeEntries(s.entries);startNewRatioEpoch(s,"AUTO");
}
export function allocateKnownInterestSlotV2(s:RatioControllerStateV2,heads:RatioQueueHead[]):AllocationDecisionV2 {
  ensureKeys(s);const before={...s.allocationDebt},target=targetMapV2(s),relevant=heads.filter(h=>(target[h.interestId]??0)>0);
  if(!relevant.length)return{interestId:null,reason:"NO_KNOWN_QUEUE",qualifiedInterests:[],bestBaseScore:0,selectedBaseScore:0,qualityLoss:0,substituted:false,supplyLimited:Object.keys(target),debtBefore:before,debtAfter:{...s.allocationDebt}};
  const best=Math.max(...relevant.map(h=>h.baseScore)),qualified=relevant.filter(h=>h.baseScore>=best-QUALITY_GUARD_RELATIVE_MARGIN),qids=new Set(qualified.map(h=>h.interestId));
  const supplyLimited=Object.entries(target).filter(([id,v])=>v>0&&!qids.has(id)).map(([id])=>id).sort();
  for(const [id,r] of Object.entries(target)){s.allocationDebt[id]=clamp((s.allocationDebt[id]??0)+r,DEBT_MIN,DEBT_MAX);if(qids.has(id)){s.qualifiedOpportunities[id]=(s.qualifiedOpportunities[id]??0)+1;s.starvation[id]=(s.starvation[id]??0)+1;s.maxStarvationSeen=Math.max(s.maxStarvationSeen,s.starvation[id]);}}
  if(!qualified.length)return{interestId:null,reason:"QUALITY_GUARD_BLOCKED",qualifiedInterests:[],bestBaseScore:best,selectedBaseScore:0,qualityLoss:0,substituted:false,supplyLimited,debtBefore:before,debtAfter:{...s.allocationDebt}};
  const byId=new Map(qualified.map(h=>[h.interestId,h]));let eligible=[...qids];if(s.currentBurst>=MAX_BURST&&s.currentBurstInterest&&eligible.includes(s.currentBurstInterest)){if(eligible.length>1)eligible=eligible.filter(x=>x!==s.currentBurstInterest);else return{interestId:null,reason:"MAX_BURST_BLOCKED",qualifiedInterests:[...qids].sort(),bestBaseScore:best,selectedBaseScore:0,qualityLoss:0,substituted:false,supplyLimited,debtBefore:before,debtAfter:{...s.allocationDebt}};}
  const starved=eligible.filter(id=>(s.starvation[id]??0)>=MAX_STARVATION_WINDOW);const pool=starved.length?starved:eligible;
  const chosenId=pool.reduce((a,b)=>{if(starved.length){const sd=(s.starvation[a]??0)-(s.starvation[b]??0);if(sd!==0)return sd>=0?a:b;}const da=(s.allocationDebt[a]??0)-(s.allocationDebt[b]??0);if(Math.abs(da)>1e-12)return da>=0?a:b;const qa=byId.get(a)!.baseScore-byId.get(b)!.baseScore;if(Math.abs(qa)>1e-12)return qa>=0?a:b;return a.localeCompare(b)>=0?a:b;});
  const chosen=byId.get(chosenId)!,bestQuality=qualified.reduce((a,b)=>a.baseScore>=b.baseScore?a:b),substituted=chosenId!==bestQuality.interestId,qualityLoss=Math.max(0,best-chosen.baseScore);
  s.substitutionCount+=substituted?1:0;s.qualityLossSum+=qualityLoss;s.knownDecisions+=1;s.allocationDebt[chosenId]=clamp((s.allocationDebt[chosenId]??0)-1,DEBT_MIN,DEBT_MAX);s.totalKnownSlots+=1;s.allocationCounts[chosenId]=(s.allocationCounts[chosenId]??0)+1;s.recentKnownAllocations.push(chosenId);
  if(s.recentKnownAllocations.length>s.recentWindow*3)s.recentKnownAllocations=s.recentKnownAllocations.slice(-s.recentWindow*2);for(const id of qids)if(id===chosenId)s.starvation[id]=0;
  if(s.currentBurstInterest===chosenId)s.currentBurst+=1;else{s.currentBurstInterest=chosenId;s.currentBurst=1;}s.maxBurstSeen=Math.max(s.maxBurstSeen,s.currentBurst);
  return{interestId:chosenId,reason:starved.length?"STARVATION_GUARD":"ALLOCATION_DEBT",qualifiedInterests:[...qids].sort(),bestBaseScore:best,selectedBaseScore:chosen.baseScore,qualityLoss,substituted,supplyLimited,debtBefore:before,debtAfter:{...s.allocationDebt}};
}
export function supplyCapacityV2(s:RatioControllerStateV2):Record<string,number>{const d=Math.max(s.knownDecisions,1);return Object.fromEntries(s.entries.map(e=>[e.interestId,(s.qualifiedOpportunities[e.interestId]??0)/d]));}


export function observeNonRatioFillV2(s:RatioControllerStateV2):void { s.currentBurstInterest=null; s.currentBurst=0; }
