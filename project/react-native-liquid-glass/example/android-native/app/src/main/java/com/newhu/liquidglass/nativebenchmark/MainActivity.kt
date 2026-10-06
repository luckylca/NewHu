package com.newhu.liquidglass.nativebenchmark

import android.animation.ValueAnimator
import android.app.Activity
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.newhu.liquidglass.backdrop.FrozenBackdrop
import com.newhu.liquidglass.backdrop.LiquidGlassView
import com.newhu.liquidglass.core.GlassEngine
import com.newhu.liquidglass.core.GlassOpticsModel
import com.newhu.liquidglass.core.GlassRenderTier
import com.newhu.liquidglass.telemetry.GlassTelemetry
import kotlin.math.roundToInt

internal class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var root: FrameLayout
    private lateinit var recycler: RecyclerView
    private var engine: GlassEngine? = null
    private lateinit var frameMetrics: NativeFrameMetrics
    private var frozenBackdrop: FrozenBackdrop? = null
    private var scrollAnimator: ValueAnimator? = null
    private var benchmarkScrollSource: BenchmarkScrollSource? = null
    private val buildVariant: String
        get() = if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) "debug" else "release"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = Color.rgb(242, 246, 252)
        window.navigationBarColor = Color.rgb(242, 246, 252)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        val count = intent.getIntExtra("count", 80).coerceIn(5, 80)
        val legacyMode = intent.getStringExtra("mode")
        val backdropMode = intent.getStringExtra("backdrop") ?: legacyMode ?: "live"
        val localGlassEnabled = intent.getBooleanExtra("local", true)
        val telemetryEnabled = intent.getBooleanExtra("telemetry", true)
        val scrollCacheEnabled = intent.getBooleanExtra("scrollCache", false)
        val opticsModel = when (intent.getStringExtra("opticsModel")?.lowercase()) {
            "sdfscalelens" -> GlassOpticsModel.SDF_SCALE_LENS
            else -> GlassOpticsModel.HEIGHT_FIELD
        }
        val naiveScrollDriver = intent.getBooleanExtra("naiveScrollDriver", false)
        val sdfBlurRadiusDp = intent.getFloatExtra("blurDp", 0.25f).coerceAtLeast(0f)
        val frozenBlurRadiusDp = intent.getFloatExtra("frozenBlur", 32f).coerceAtLeast(0f)
        val tierOverride = when (intent.getStringExtra("tier")?.lowercase()) {
            "blur" -> GlassRenderTier.BLUR
            "scrim" -> GlassRenderTier.SCRIM
            else -> null
        }
        frameMetrics = NativeFrameMetrics(window)
        GlassTelemetry.setEnabled(telemetryEnabled)
        GlassTelemetry.setDisplayRefreshRate(display?.refreshRate ?: 0f)

        root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(242, 246, 252)) }
        recycler = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = CommentAdapter(count, localGlassEnabled)
            clipToPadding = false
            setPadding(dp(14), dp(96), dp(14), dp(20))
            overScrollMode = View.OVER_SCROLL_NEVER
            itemAnimator = null
        }
        if (backdropMode == "off") {
            root.addView(recycler, FrameLayout.LayoutParams(-1, -1))
        } else {
            engine = GlassEngine(root)
            val sourceContent = FrameLayout(this).apply {
                setBackgroundColor(Color.rgb(242, 246, 252))
                addView(recycler, FrameLayout.LayoutParams(-1, -1))
            }
            val source = engine!!.createBackdropSource(sourceContent)
            val topBarMaterial = if (opticsModel == GlassOpticsModel.SDF_SCALE_LENS) {
                SampleMaterials.topBar.copy(blurRadiusDp = sdfBlurRadiusDp)
            } else {
                SampleMaterials.topBar
            }
            val topBar = engine!!.createBackdropSurface(
                source = source,
                material = topBarMaterial.copy(opticsModel = opticsModel),
                layoutParams = FrameLayout.LayoutParams(-1, dp(82), Gravity.TOP),
            ).apply {
                setBackgroundColor(Color.TRANSPARENT)
                elevation = dp(4).toFloat()
                controller.tierOverride = tierOverride
            }
            if (scrollCacheEnabled && backdropMode == "live") {
                val scrollSource = BenchmarkScrollSource()
                benchmarkScrollSource = scrollSource
                source.setScrollSource(scrollSource)
                recycler.addOnScrollListener(object : RecyclerView.OnScrollListener() {
                    override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                        scrollSource.onScrolled(dy)
                    }
                })
            }
            addTopBarForeground(topBar, count)
            recycler.postDelayed({
                if (backdropMode == "frozen" && android.os.Build.VERSION.SDK_INT >= 31) {
                    frozenBackdrop = runCatching { engine?.prepareFrozenBackdrop(source.id, frozenBlurRadiusDp) }
                        .onFailure { Log.e(TAG, "frozen backdrop preparation failed", it) }
                        .getOrNull()
                    frozenBackdrop?.let { topBar.controller.provider = it }
                }
                recycler.postDelayed({
                    startBenchmark(count, backdropMode, localGlassEnabled, telemetryEnabled, naiveScrollDriver)
                }, 800L)
            }, 1_200L)
        }
        setContentView(root)

        Log.i(
            TAG,
            "[GLASS_NATIVE_READY] count=$count backdrop=$backdropMode local=$localGlassEnabled scrollCache=$scrollCacheEnabled " +
                "scrollDriver=${if (naiveScrollDriver) "query" else "target"} " +
                "optics=${opticsModel.name} sdfBlurDp=$sdfBlurRadiusDp tier=${tierOverride?.name ?: "shader"} frozenBlur=$frozenBlurRadiusDp " +
                "telemetry=$telemetryEnabled build=$buildVariant hz=${display?.refreshRate ?: 0f}",
        )
        if (backdropMode == "off") {
            recycler.postDelayed({
                startBenchmark(count, backdropMode, localGlassEnabled, telemetryEnabled, naiveScrollDriver)
            }, 1_200L)
        }
    }

    private fun addTopBarForeground(topBar: LiquidGlassView, count: Int) {
        val foreground = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(10), dp(20), dp(8))
        }
        foreground.addView(TextView(this).apply {
            text = "‹"
            textSize = 34f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(42, 74, 126))
        }, LinearLayout.LayoutParams(dp(38), -1))
        foreground.addView(TextView(this).apply {
            text = "评论 ($count)"
            textSize = 20f
            setTextColor(Color.rgb(31, 39, 52))
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }, LinearLayout.LayoutParams(0, -2, 1f))
        foreground.addView(TextView(this).apply {
            text = "···"
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(42, 74, 126))
        }, LinearLayout.LayoutParams(dp(42), -1))
        topBar.addView(foreground, FrameLayout.LayoutParams(-1, -1))
    }

    private fun startBenchmark(
        count: Int,
        backdropMode: String,
        localGlassEnabled: Boolean,
        telemetryEnabled: Boolean,
        naiveScrollDriver: Boolean,
    ) {
        val range = (recycler.computeVerticalScrollRange() - recycler.computeVerticalScrollExtent()).coerceAtLeast(dp(64))
        benchmarkScrollSource?.beginScroll()
        Log.i(
            TAG,
            "[GLASS_NATIVE_START] count=$count backdrop=$backdropMode local=$localGlassEnabled " +
                "telemetry=$telemetryEnabled build=$buildVariant rangePx=$range " +
                "scrollCache=${benchmarkScrollSource != null} overscanPx=${benchmarkScrollSource?.overscanPx ?: 0} " +
                "scrollDriver=${if (naiveScrollDriver) "query" else "target"}",
        )
        frameMetrics.start()
        var lastTarget = 0
        val animator = ValueAnimator.ofInt(0, range).apply {
            duration = 12_000L
            addUpdateListener { value ->
                val target = value.animatedValue as Int
                val delta = if (naiveScrollDriver) {
                    target - recycler.computeVerticalScrollOffset()
                } else {
                    target - lastTarget
                }
                lastTarget = target
                recycler.scrollBy(0, delta)
            }
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    benchmarkScrollSource?.endScroll()
                    val result = frameMetrics.stopAndReport("GLASS_NATIVE_METRICS")
                    Log.i(TAG, result)
                    Log.i(TAG, "[GLASS_NATIVE_LOCAL] ${GlassTelemetry.localGlassStats()}")
                    Log.i(TAG, "[GLASS_NATIVE_BACKDROP] ${GlassTelemetry.performanceStats()}")
                    Log.i(
                        TAG,
                        "[GLASS_NATIVE_FINISH] count=$count backdrop=$backdropMode local=$localGlassEnabled " +
                            "telemetry=$telemetryEnabled build=$buildVariant " +
                            "scrollOffsetY=${benchmarkScrollSource?.scrollOffsetY ?: 0}",
                    )
                }
            })
        }
        scrollAnimator = animator
        animator.start()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        scrollAnimator?.cancel()
        benchmarkScrollSource = null
        if (::frameMetrics.isInitialized) frameMetrics.release()
        engine?.release()
        super.onDestroy()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    private companion object {
        const val TAG = "LiquidGlassNative"
    }
}
