export type GlassSurfaceRole = 'staticGroup' | 'recycledCard' | 'backdropOptical';
export type LocalGlassRenderer = 'native' | 'skia';
export declare function getSurfaceRendererPolicy(role: GlassSurfaceRole): LocalGlassRenderer;
export declare function getSurfaceRendererPolicyOverride(role: Exclude<GlassSurfaceRole, 'backdropOptical'>): LocalGlassRenderer | null;
export declare function setSurfaceRendererPolicyOverride(role: Exclude<GlassSurfaceRole, 'backdropOptical'>, renderer: LocalGlassRenderer | null): void;
