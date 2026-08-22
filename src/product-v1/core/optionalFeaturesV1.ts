import type {EngagementStats,HighQualityLevel} from "./highQualityPolicy";
import {highQualityEligible} from "./highQualityPolicy";
import type {BubbleBreakIntensity} from "./bubbleBreakPolicy";
import {bubbleSlotCount} from "./bubbleBreakPolicy";
export interface HighQualityModeSettingsV1{enabled:boolean;level:HighQualityLevel;}
export interface BubbleBreakModeSettingsV1{enabled:boolean;intensity:BubbleBreakIntensity;}
export function applyHighQualityGate<T>(items:T[],statsFor:(x:T)=>EngagementStats,settings:HighQualityModeSettingsV1):T[]{if(!settings.enabled)return [...items];return items.filter(x=>highQualityEligible(statsFor(x),true,settings.level));}
export function bubbleSlotPlan(horizon:number,settings:BubbleBreakModeSettingsV1):Array<"known"|"bubble">{const h=Math.max(0,Math.trunc(horizon)),n=bubbleSlotCount(h,settings.enabled,settings.intensity);if(n<=0)return Array(h).fill("known");const pos=new Set<number>();for(let i=0;i<n;i++)pos.add(Math.min(h-1,Math.max(0,Math.floor(((i+0.5)*h)/n))));while(pos.size<n){for(let i=0;i<h;i++)if(!pos.has(i)){pos.add(i);break;}}return Array.from({length:h},(_,i)=>pos.has(i)?"bubble":"known");}
export function optionalFeaturesDisabledZeroDiff<T>(items:T[],horizon=20):boolean{const out=applyHighQualityGate(items,()=>({}),{enabled:false,level:"medium"});const plan=bubbleSlotPlan(horizon,{enabled:false,intensity:"medium"});return JSON.stringify(out)===JSON.stringify(items)&&plan.every(x=>x==="known")&&plan.length===Math.max(0,Math.trunc(horizon));}
