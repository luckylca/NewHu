export type QualityTier = "NORMAL" | "HIGH" | "ULTRA_HIGH";
export type HighQualityLevel = "low" | "medium" | "high";
export interface EngagementStats { likeCount?: number; favoriteCount?: number; commentCount?: number; }
export interface HighQualityThreshold { minLikeCount:number; minFavoriteCount:number; minCommentCount:number; }
export const HIGH_QUALITY_THRESHOLDS:Record<HighQualityLevel,HighQualityThreshold> = {
  low:{minLikeCount:18,minFavoriteCount:63,minCommentCount:1},
  medium:{minLikeCount:90,minFavoriteCount:215,minCommentCount:9},
  high:{minLikeCount:289,minFavoriteCount:1148,minCommentCount:34},
};
export const ULTRA_HIGH_MIN_TOTAL_ENGAGEMENT = 160;
const nn=(x:number|undefined):number|undefined=>x===undefined?undefined:Math.max(0,Math.trunc(x));
export function qualityScore(s:EngagementStats):{score:number;knownSignals:number}{
  const l=nn(s.likeCount),f=nn(s.favoriteCount),c=nn(s.commentCount); const known=[l,f,c].filter(x=>x!==undefined).length;
  return {score:(l??0)+2*(f??0)+4*(c??0),knownSignals:known};
}
export function saveDominantQuality(s:EngagementStats,minimumTotal=ULTRA_HIGH_MIN_TOTAL_ENGAGEMENT):boolean{
  const l=nn(s.likeCount),f=nn(s.favoriteCount),c=nn(s.commentCount); if(l===undefined||f===undefined||f<=l)return false;
  return l+f+(c??0)>=Math.max(0,Math.trunc(minimumTotal));
}
export function anySignalEligible(s:EngagementStats,t:HighQualityThreshold):boolean{
  const l=nn(s.likeCount),f=nn(s.favoriteCount),c=nn(s.commentCount); const checks:boolean[]=[];
  if(l!==undefined)checks.push(l>=t.minLikeCount); if(f!==undefined)checks.push(f>=t.minFavoriteCount); if(c!==undefined)checks.push(c>=t.minCommentCount); return checks.some(Boolean);
}
export function qualityTier(s:EngagementStats,level:HighQualityLevel="medium"):QualityTier{
  if(saveDominantQuality(s))return "ULTRA_HIGH"; return anySignalEligible(s,HIGH_QUALITY_THRESHOLDS[level])?"HIGH":"NORMAL";
}
export function highQualityEligible(s:EngagementStats,enabled:boolean,level:HighQualityLevel="medium"):boolean{
  return !enabled || qualityTier(s,level)!=="NORMAL";
}

