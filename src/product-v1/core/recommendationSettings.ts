import type {HighQualityLevel} from "./highQualityPolicy";
import type {BubbleBreakIntensity} from "./bubbleBreakPolicy";
export interface RecommendationSettings {
  highQualityMode:{enabled:boolean;level:HighQualityLevel};
  bubbleBreakMode:{enabled:boolean;intensity:BubbleBreakIntensity};
}
export const DEFAULT_RECOMMENDATION_SETTINGS:RecommendationSettings={
  highQualityMode:{enabled:false,level:"medium"},
  bubbleBreakMode:{enabled:false,intensity:"medium"},
};
export const HIGH_QUALITY_MODE_V1="HIGH_QUALITY_MODE_V1" as const;
export const HIGH_QUALITY_MODE_V2="HIGH_QUALITY_MODE_V2" as const;
export const ACTIVE_HIGH_QUALITY_MODE=HIGH_QUALITY_MODE_V2;
export const BUBBLE_BREAK_MODE_V1="BUBBLE_BREAK_MODE_V1" as const;
