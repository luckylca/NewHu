import type { CandidateArticle } from "./candidateAcquisition";
import { CandidateInventoryV3, supplyInterestV3, type SearchAcceptanceResultV3 } from "./candidateInventoryV3";
export const POPULARITY_VOTEUP_THRESHOLD=500;
export const POPULARITY_FAVORITE_THRESHOLD=250;
export const POPULARITY_COMMENT_THRESHOLD=50;
export const ULTRA_HIGH_MIN_TOTAL_ENGAGEMENT_V2=160;
export const ENGAGEMENT_TTL_HOURS=24;
export const HIGH_QUALITY_PRODUCT_SEMANTICS="COMMUNITY_ENGAGEMENT_QUALITY" as const;
export interface EngagementSnapshotV2{voteupCount:number|null;favoriteCount:number|null;commentCount:number|null;fetchedAt?:string|null}
export interface QualityMetadataV2{highQualityEligible:boolean;popularEligible:boolean;saveDominant:boolean;ultraHighQuality:boolean;eligibilityReason:"POPULAR"|"SAVE_DOMINANT"|"POPULAR_AND_SAVE_DOMINANT"|"NONE";tier:string}
export interface HighQualitySearchOptions{sort:"upvoted_count";vertical?:"answer"|"article";timeInterval?:string;searchSource:"Filter"}
export const DEFAULT_HIGH_QUALITY_SEARCH_OPTIONS:HighQualitySearchOptions={sort:"upvoted_count",searchSource:"Filter"};
const n=(v:number|null|undefined)=>v==null?null:Math.max(0,Math.trunc(v));
export function meetsPopularityRuleV2(s:EngagementSnapshotV2):boolean{const v=n(s.voteupCount),f=n(s.favoriteCount),c=n(s.commentCount);return (v!==null&&v>=500)||(f!==null&&f>=250)||(c!==null&&c>=50);}
export function isSaveDominantV2(s:EngagementSnapshotV2):boolean{const v=n(s.voteupCount),f=n(s.favoriteCount);return v!==null&&f!==null&&f>v;}
export function classifyQualityV2(s:EngagementSnapshotV2):QualityMetadataV2{const popular=meetsPopularityRuleV2(s),save=isSaveDominantV2(s),total=(n(s.voteupCount)??0)+(n(s.favoriteCount)??0)+(n(s.commentCount)??0),ultra=save&&total>=160;const reason=popular&&save?"POPULAR_AND_SAVE_DOMINANT":save?"SAVE_DOMINANT":popular?"POPULAR":"NONE";return{highQualityEligible:popular||save,popularEligible:popular,saveDominant:save,ultraHighQuality:ultra,eligibilityReason:reason,tier:ultra?"ULTRA_HIGH":(popular||save?reason:"NORMAL")};}
export function engagementFromCandidateV2(c:CandidateArticle):EngagementSnapshotV2{const rm=c.rawMetadata??{},e=(typeof rm.engagement==="object"&&rm.engagement!==null?rm.engagement:{}) as Record<string,unknown>;const get=(...ks:string[])=>{for(const k of ks){const v=e[k]??rm[k];if(typeof v==="number")return v;}return null};return{voteupCount:get("voteupCount","voteup_count"),favoriteCount:get("favoriteCount","favlists_count","favorite_count"),commentCount:get("commentCount","comment_count"),fetchedAt:typeof e.fetchedAt==="string"?e.fetchedAt:null};}
export function annotateQualityV2(c:CandidateArticle,s:EngagementSnapshotV2):QualityMetadataV2{const q=classifyQualityV2(s);c.rawMetadata.engagement={voteupCount:n(s.voteupCount),favoriteCount:n(s.favoriteCount),commentCount:n(s.commentCount),fetchedAt:s.fetchedAt??new Date().toISOString()};c.rawMetadata.quality={...q};return q;}
export function qualityFromCandidateV2(c:CandidateArticle):QualityMetadataV2{const q=c.rawMetadata?.quality;if(q&&typeof q==="object"){const x=q as Record<string,unknown>;return{highQualityEligible:!!x.highQualityEligible,popularEligible:!!x.popularEligible,saveDominant:!!x.saveDominant,ultraHighQuality:!!x.ultraHighQuality,eligibilityReason:String(x.eligibilityReason??"NONE") as QualityMetadataV2["eligibilityReason"],tier:String(x.tier??"NORMAL")};}return classifyQualityV2(engagementFromCandidateV2(c));}
export function highQualityEligibleV2(c:CandidateArticle):boolean{return c.qualified&&qualityFromCandidateV2(c).highQualityEligible;}
export function highQualityCountsV2(rows:CandidateArticle[]):Record<string,number>{const out:Record<string,number>={};for(const c of rows){if(!highQualityEligibleV2(c))continue;const i=supplyInterestV3(c);if(i)out[i]=(out[i]??0)+1;}return out;}
export function highQualityDeficitsV2(required:Record<string,number>,rows:CandidateArticle[]):Record<string,number>{const c=highQualityCountsV2(rows);return Object.fromEntries(Object.entries(required).map(([k,v])=>[k,Math.max(0,Math.trunc(v)-(c[k]??0))]));}
export function acceptHighQualitySearchBatchV2(inv:CandidateInventoryV3,rows:CandidateArticle[],targetInterest:string,requiredSupply:number):SearchAcceptanceResultV3{return inv.acceptSearchBatch(rows.filter(highQualityEligibleV2),targetInterest,requiredSupply,undefined,"freshness_first");}

export function applyHighQualityModeV2(rows:CandidateArticle[],enabled:boolean):CandidateArticle[]{return enabled?rows.filter(highQualityEligibleV2):[...rows];}
