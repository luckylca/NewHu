package com.newhu.liquidglass.backdrop

public class GlassBackdropSourceHandle internal constructor(
    public val id: String,
    internal val layout: LiquidGlassProviderLayout,
) : LiquidGlassBackdropSource by layout {
    public override fun setScrollSource(source: GlassScrollSource?) = layout.setScrollSource(source)
}
