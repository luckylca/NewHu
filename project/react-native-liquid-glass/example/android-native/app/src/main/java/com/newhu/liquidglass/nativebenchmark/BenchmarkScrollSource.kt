package com.newhu.liquidglass.nativebenchmark

import com.newhu.liquidglass.backdrop.GlassScrollSource

internal class BenchmarkScrollSource : GlassScrollSource {
    override var scrollOffsetY: Int = 0
        private set
    override var isScrolling: Boolean = false
        private set
    override val overscanPx: Int = 800
    override val samplingMarginPx: Int = 192
    override var contentVersion: Long = 0L
        private set

    fun beginScroll() {
        isScrolling = true
    }

    fun endScroll() {
        isScrolling = false
        contentVersion += 1L
    }

    fun onScrolled(deltaY: Int) {
        scrollOffsetY = (scrollOffsetY + deltaY).coerceAtLeast(0)
    }
}
