export type GlassSurfaceRole = 'staticGroup' | 'recycledCard' | 'backdropOptical';
export type LocalGlassRenderer = 'native' | 'skia';

type LocalRole = Exclude<GlassSurfaceRole, 'backdropOptical'>;

const overrides: Partial<Record<LocalRole, LocalGlassRenderer>> = {};

/**
 * Resolve the local material backend from the surface's reusable semantic role.
 * The matched Settings device A/B found no effective-cadence gain from Skia,
 * so local roles currently retain the native renderer. Backdrop optics never
 * pass through this local renderer policy.
 */
export function getSurfaceRendererPolicy(role: GlassSurfaceRole): LocalGlassRenderer {
    if (role === 'backdropOptical') return 'native';
    return overrides[role] ?? 'native';
}

export function getSurfaceRendererPolicyOverride(role: LocalRole) {
    return overrides[role] ?? null;
}

/** Diagnostic A/B control. Production calls are ignored. */
export function setSurfaceRendererPolicyOverride(
    role: LocalRole,
    renderer: LocalGlassRenderer | null,
) {
    if (!__DEV__) return;
    if (overrides[role] === renderer || (renderer == null && overrides[role] == null)) return;
    if (renderer == null) delete overrides[role];
    else overrides[role] = renderer;
}
