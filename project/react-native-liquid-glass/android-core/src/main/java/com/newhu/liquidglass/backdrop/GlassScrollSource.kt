package com.newhu.liquidglass.backdrop

/** Native scroll metadata used to reuse a cached backdrop window while content moves. */
public interface GlassScrollSource {
    public val scrollOffsetY: Int
    public val isScrolling: Boolean
    public val contentVersion: Long
        get() = 0L
    public val overscanPx: Int
        get() = 800
    public val samplingMarginPx: Int
        get() = 192
}
