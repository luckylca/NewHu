package com.newhu.liquidglass.core

import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.newhu.liquidglass.backdrop.FrozenBackdrop
import com.newhu.liquidglass.backdrop.GlassViewController
import com.newhu.liquidglass.backdrop.LiquidGlassProviderLayout
import com.newhu.liquidglass.backdrop.LiquidGlassView
import com.newhu.liquidglass.backdrop.GlassBackdropSourceHandle
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry

public class GlassEngine(private val rootView: ViewGroup) {
    private val sources = LinkedHashMap<String, GlassBackdropSourceHandle>()
    private val surfaces = LinkedHashSet<LiquidGlassView>()
    private val frozenBackdrops = LinkedHashSet<FrozenBackdrop>()
    private var nextSourceId = 0L

    public fun createBackdropSource(contentView: View): GlassBackdropSourceHandle {
        require(contentView.parent == null) { "Backdrop contentView must not already have a parent" }
        val sourceId = "source-${nextSourceId++}"
        val layout = LiquidGlassProviderLayout(rootView.context)
        layout.addView(contentView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ))
        rootView.addView(layout, 0, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ))
        return GlassBackdropSourceHandle(sourceId, layout).also { sources[sourceId] = it }
    }

    public fun createBackdropSurface(
        source: GlassBackdropSourceHandle,
        state: GlassSurfaceState,
        layoutParams: ViewGroup.LayoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ),
    ): LiquidGlassView {
        require(sources[source.id] === source) { "Backdrop source belongs to a different GlassEngine" }
        val surface = LiquidGlassView(rootView.context)
        surface.controller.provider = source
        surface.controller.applyMaterial(state.material)
        surface.controller.isGlassInteractive = state.interactive
        surface.controller.continuousBackdrop = state.continuousBackdrop
        surface.controller.motionX = state.motionX
        surface.controller.motionY = state.motionY
        surface.controller.displacementOnlyDebug = state.displacementOnlyDebug
        surface.controller.sdfDisplacementMapDebug = state.sdfDisplacementMapDebug
        rootView.addView(surface, layoutParams)
        surfaces.add(surface)
        return surface
    }

    public fun createBackdropSurface(
        source: GlassBackdropSourceHandle,
        material: GlassMaterial,
        layoutParams: ViewGroup.LayoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ),
    ): LiquidGlassView = createBackdropSurface(source, GlassSurfaceState(material), layoutParams)

    public fun prepareFrozenBackdrop(sourceId: String, blurRadiusDp: Float): FrozenBackdrop? {
        if (Build.VERSION.SDK_INT < 31) return null
        LiquidGlassPerfTelemetry.frozenSnapshotRequested()
        val source = sources[sourceId] ?: throw IllegalArgumentException("Unknown backdrop source: $sourceId")
        if (!source.hasRecording) {
            LiquidGlassPerfTelemetry.frozenSnapshotFailed()
            return null
        }
        return runCatching { FrozenBackdrop(source, source.id, blurRadiusDp) }
            .onSuccess {
                frozenBackdrops.add(it)
                LiquidGlassPerfTelemetry.frozenSnapshotBlurRecorded()
            }
            .onFailure { LiquidGlassPerfTelemetry.frozenSnapshotFailed() }
            .getOrNull()
    }

    public fun release() {
        surfaces.forEach { surface ->
            surface.controller.provider = null
            if (surface.parent === rootView) rootView.removeView(surface)
        }
        surfaces.clear()
        frozenBackdrops.forEach(FrozenBackdrop::release)
        frozenBackdrops.clear()
        sources.values.forEach { source ->
            if (source.layout.parent === rootView) rootView.removeView(source.layout)
        }
        sources.clear()
    }

    private fun GlassViewController.applyMaterial(material: GlassMaterial) {
        cornerRadiusDp = material.cornerRadius
        blurRadiusDp = material.blurRadiusDp
        refractionAmountDp = material.refractionAmount
        refractionHeightDp = material.refractionHeight
        bodyRefractionAmountDp = material.bodyRefractionAmount
        chromaticAberration = material.chromaticAberration
        saturation = material.saturation
        glassTintColor = material.tint.toColorInt()
        tintAlpha = material.tintAlpha
        noiseAlpha = material.noiseStrength
        highlightAlpha = material.highlightStrength
        specularStrength = material.specularStrength
        fresnelStrength = material.fresnelStrength
        innerShadowStrength = material.innerShadowStrength
        highlightWidthDp = material.highlightWidth
        lightAngleDegrees = material.lightAngleDegrees
        opticsModel = material.opticsModel
        sdfScaleLens = material.sdfScaleLens
    }
}
