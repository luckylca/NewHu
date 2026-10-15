package expo.modules.themepreview

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.os.Build
import com.newhu.liquidglass.local.LocalGlassRuntimeShaderPool
import com.newhu.liquidglass.local.LocalGlassShader
import com.newhu.liquidglass.local.RuntimeShaderBridge
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

class ExpoThemePreviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoThemePreview")

    View(ThemePreviewThumbnailView::class) {
      Name("ThemePreviewThumbnail")
      Prop("surfaceColor") { view: ThemePreviewThumbnailView, value: Int? ->
        view.surfaceColor = value ?: 0xFFF8FBFF.toInt()
      }
      Prop("outlineColor") { view: ThemePreviewThumbnailView, value: Int? ->
        view.outlineColor = value ?: 0x2928506F
      }
      Prop("primaryTextColor") { view: ThemePreviewThumbnailView, value: Int? ->
        view.primaryTextColor = value ?: 0xFF15181D.toInt()
      }
      Prop("secondaryTextColor") { view: ThemePreviewThumbnailView, value: Int? ->
        view.secondaryTextColor = value ?: 0xFF687181.toInt()
      }
      Prop("dotColor") { view: ThemePreviewThumbnailView, value: Int? ->
        view.dotColor = value ?: 0xFF3478F6.toInt()
      }
    }

    View(ThemePreviewLiquidGlassView::class) {
      Name("ThemePreviewLiquidGlass")
      Prop("barMaterial") { view: ThemePreviewLiquidGlassView, value: List<Double>? ->
        view.setMaterial(0, value?.let { values -> FloatArray(values.size) { values[it].toFloat() } })
      }
      Prop("cardMaterial") { view: ThemePreviewLiquidGlassView, value: List<Double>? ->
        view.setMaterial(1, value?.let { values -> FloatArray(values.size) { values[it].toFloat() } })
      }
      Prop("tabBarMaterial") { view: ThemePreviewLiquidGlassView, value: List<Double>? ->
        view.setMaterial(2, value?.let { values -> FloatArray(values.size) { values[it].toFloat() } })
      }
      Prop("outlineColor") { view: ThemePreviewLiquidGlassView, value: Int? ->
        view.outlineColor = value ?: 0x2928506F
      }
      Prop("primaryTextColor") { view: ThemePreviewLiquidGlassView, value: Int? ->
        view.primaryTextColor = value ?: 0xFF15181D.toInt()
      }
      Prop("secondaryTextColor") { view: ThemePreviewLiquidGlassView, value: Int? ->
        view.secondaryTextColor = value ?: 0xFF687181.toInt()
      }
      Prop("dotColor") { view: ThemePreviewLiquidGlassView, value: Int? ->
        view.dotColor = value ?: 0xFF3478F6.toInt()
      }
      OnViewDidUpdateProps { view: ThemePreviewLiquidGlassView -> view.onPreviewPropsUpdated() }
    }
  }
}

/**
 * One Fabric view draws the three independent local material panels and their
 * preview line art. Each panel still uses the exact shared Local Glass shader
 * and its own size/material uniforms; the ambient backdrop remains a sibling
 * behind this translucent canvas.
 */
class ThemePreviewLiquidGlassView(
  context: Context,
  appContext: AppContext,
) : ExpoView(context, appContext) {
  private val panelHeightsDp = floatArrayOf(22f, 42f, 21f)
  private val panelClipRadiiDp = floatArrayOf(9f, 10f, 9f)
  private val panelMaterials = arrayOfNulls<FloatArray>(3)
  private val shaders = arrayOfNulls<Shader>(3)
  private val appliedWidthsPx = IntArray(3) { -1 }
  private val paints = Array(3) { Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL } }
  private val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val rect = RectF()
  private val path = Path()

  var outlineColor: Int = 0x2928506F
    set(value) { if (field != value) { field = value; invalidate() } }
  var primaryTextColor: Int = 0xFF15181D.toInt()
    set(value) { if (field != value) { field = value; invalidate() } }
  var secondaryTextColor: Int = 0xFF687181.toInt()
    set(value) { if (field != value) { field = value; invalidate() } }
  var dotColor: Int = 0xFF3478F6.toInt()
    set(value) { if (field != value) { field = value; invalidate() } }

  init {
    setWillNotDraw(false)
    setBackgroundColor(Color.TRANSPARENT)
  }

  fun setMaterial(index: Int, value: FloatArray?) {
    if (index !in panelMaterials.indices || value == null || value.size < 22) return
    val current = panelMaterials[index]
    if (current != null && current.contentEquals(value)) return
    panelMaterials[index] = value.copyOf()
  }

  fun onPreviewPropsUpdated() {
    for (index in panelMaterials.indices) updateShader(index)
    invalidate()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    onPreviewPropsUpdated()
  }

  override fun onDetachedFromWindow() {
    for (index in shaders.indices) {
      shaders[index]?.let(LocalGlassRuntimeShaderPool::release)
      shaders[index] = null
      paints[index].shader = null
      appliedWidthsPx[index] = -1
    }
    super.onDetachedFromWindow()
  }

  override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    for (index in panelMaterials.indices) updateShader(index)
  }

  private fun updateShader(index: Int) {
    val material = panelMaterials[index] ?: return
    if (width <= 0 || Build.VERSION.SDK_INT < 33) return

    val shader = shaders[index] ?: LocalGlassRuntimeShaderPool.acquire()?.also {
      shaders[index] = it
      paints[index].shader = it
    } ?: return

    val density = resources.displayMetrics.density.coerceAtLeast(1f)
    if (appliedWidthsPx[index] != width) {
      RuntimeShaderBridge.setFloatUniform(shader, "resolution", floatArrayOf(width / density, panelHeightsDp[index]))
      appliedWidthsPx[index] = width
    }

    RuntimeShaderBridge.setFloatUniform(shader, "baseTint", material.copyOfRange(0, 4))
    RuntimeShaderBridge.setFloatUniform(shader, "accentTint", material.copyOfRange(4, 8))
    RuntimeShaderBridge.setFloatUniform(shader, "highlightTint", material.copyOfRange(8, 12))
    RuntimeShaderBridge.setFloatUniform(shader, "innerShade", material.copyOfRange(12, 16))
    RuntimeShaderBridge.setFloatUniform(shader, "surfaceWarp", floatArrayOf(material[16]))
    RuntimeShaderBridge.setFloatUniform(shader, "chromatic", floatArrayOf(material[17]))
    RuntimeShaderBridge.setFloatUniform(shader, "highlightStrength", floatArrayOf(material[18]))
    RuntimeShaderBridge.setFloatUniform(shader, "noiseStrength", floatArrayOf(material[19]))
    RuntimeShaderBridge.setFloatUniform(shader, "materialOpacity", floatArrayOf(material[20]))
    RuntimeShaderBridge.setFloatUniform(shader, "cornerRadiusPx", floatArrayOf(material[21]))
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val density = resources.displayMetrics.density.coerceAtLeast(1f)
    val widthDp = width / density
    val heightDp = height / density
    if (widthDp <= 0f || heightDp <= 0f) return

    val cardTop = 22f + (heightDp - 22f - 21f - 42f) * 0.5f
    val tabsTop = heightDp - 21f
    val save = canvas.save()
    canvas.scale(density, density)

    drawPanel(canvas, 0, 0f, widthDp, 22f, false)
    drawHeaderLines(canvas, widthDp)
    drawPanel(canvas, 1, cardTop, widthDp, 42f, true)
    drawCardLines(canvas, widthDp, cardTop, 1f / density)
    drawPanel(canvas, 2, tabsTop, widthDp, 21f, true)
    drawTabLines(canvas, widthDp, tabsTop)

    canvas.restoreToCount(save)
  }

  private fun drawPanel(canvas: Canvas, index: Int, topDp: Float, widthDp: Float, heightDp: Float, outlined: Boolean) {
    val save = canvas.save()
    canvas.translate(0f, topDp)
    path.reset()
    path.addRoundRect(0f, 0f, widthDp, heightDp, panelClipRadiiDp[index], panelClipRadiiDp[index], Path.Direction.CW)
    canvas.clipPath(path)
    paints[index].shader = shaders[index]
    canvas.drawRect(0f, 0f, widthDp, heightDp, paints[index])
    canvas.restoreToCount(save)

    if (outlined) {
      val hairline = 1f / resources.displayMetrics.density.coerceAtLeast(1f)
      val halfStroke = hairline * 0.5f
      rect.set(halfStroke, topDp + halfStroke, widthDp - halfStroke, topDp + heightDp - halfStroke)
      outlinePaint.color = outlineColor
      outlinePaint.strokeWidth = hairline
      val radius = (panelClipRadiiDp[index] - halfStroke).coerceAtLeast(0f)
      canvas.drawRoundRect(rect, radius, radius, outlinePaint)
    }
  }

  private fun drawHeaderLines(canvas: Canvas, widthDp: Float) {
    val rowWidth = (widthDp - 12f).coerceAtLeast(0f)
    val centerY = 11f
    linePaint.color = dotColor
    canvas.drawCircle(9.5f, centerY, 3.5f, linePaint)
    drawLine(canvas, 18f, centerY - 2f, rowWidth * 0.45f, primaryTextColor)
    drawLine(canvas, 23f + rowWidth * 0.45f, centerY - 2f, rowWidth * 0.2f, secondaryTextColor)
  }

  private fun drawCardLines(canvas: Canvas, widthDp: Float, topDp: Float, hairlineDp: Float) {
    val contentWidth = (widthDp - 14f - 2f * hairlineDp).coerceAtLeast(0f)
    val linesTop = topDp + (42f - 13f) * 0.5f
    drawLine(canvas, hairlineDp + 7f, linesTop, contentWidth * 0.72f, primaryTextColor)
    drawLine(canvas, hairlineDp + 7f, linesTop + 9f, contentWidth * 0.48f, secondaryTextColor)
  }

  private fun drawTabLines(canvas: Canvas, widthDp: Float, topDp: Float) {
    val lineTop = topDp + (21f - 4f) * 0.5f
    drawLine(canvas, 0f, lineTop, widthDp * 0.4f, primaryTextColor)
    drawLine(canvas, widthDp * 0.4f + 5f, lineTop, widthDp * 0.18f, secondaryTextColor)
  }

  private fun drawLine(canvas: Canvas, leftDp: Float, topDp: Float, widthDp: Float, color: Int) {
    linePaint.color = color.withMultipliedAlpha(0.72f)
    rect.set(leftDp, topDp, leftDp + widthDp, topDp + 4f)
    canvas.drawRoundRect(rect, 4f, 4f, linePaint)
  }

  private fun Int.withMultipliedAlpha(multiplier: Float): Int {
    val sourceAlpha = (this ushr 24) and 0xFF
    val alpha = (sourceAlpha * multiplier).toInt().coerceIn(0, 255)
    return (this and 0x00FFFFFF) or (alpha shl 24)
  }
}


class ThemePreviewThumbnailView(
  context: Context,
  appContext: AppContext,
) : ExpoView(context, appContext) {
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val rect = RectF()

  var surfaceColor: Int = 0xFFF8FBFF.toInt()
    set(value) { if (field != value) { field = value; invalidate() } }
  var outlineColor: Int = 0x2928506F
    set(value) { if (field != value) { field = value; invalidate() } }
  var primaryTextColor: Int = 0xFF15181D.toInt()
    set(value) { if (field != value) { field = value; invalidate() } }
  var secondaryTextColor: Int = 0xFF687181.toInt()
    set(value) { if (field != value) { field = value; invalidate() } }
  var dotColor: Int = 0xFF3478F6.toInt()
    set(value) { if (field != value) { field = value; invalidate() } }

  init {
    setWillNotDraw(false)
    setBackgroundColor(android.graphics.Color.TRANSPARENT)
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val density = resources.displayMetrics.density
    val widthDp = width / density
    val heightDp = height / density

    val headerHeight = 22f
    val cardHeight = 42f
    val tabsHeight = 21f
    val cardTop = headerHeight + (heightDp - headerHeight - tabsHeight - cardHeight) * 0.5f
    val tabsTop = heightDp - tabsHeight
    val hairline = 1f / density

    drawSurface(canvas, density, 0f, 0f, widthDp, headerHeight, 9f, false, hairline)
    drawHeaderLines(canvas, density, widthDp)
    drawSurface(canvas, density, 0f, cardTop, widthDp, cardHeight, 10f, true, hairline)
    drawCardLines(canvas, density, widthDp, cardTop, hairline)
    drawSurface(canvas, density, 0f, tabsTop, widthDp, tabsHeight, 9f, true, hairline)
    drawTabsLines(canvas, density, widthDp, tabsTop, tabsHeight)
  }

  private fun drawSurface(
    canvas: Canvas,
    density: Float,
    leftDp: Float,
    topDp: Float,
    widthDp: Float,
    heightDp: Float,
    radiusDp: Float,
    outline: Boolean,
    hairlineDp: Float,
  ) {
    rect.set(leftDp * density, topDp * density, (leftDp + widthDp) * density, (topDp + heightDp) * density)
    fillPaint.color = surfaceColor
    canvas.drawRoundRect(rect, radiusDp * density, radiusDp * density, fillPaint)
    if (outline) {
      strokePaint.color = outlineColor
      strokePaint.strokeWidth = hairlineDp * density
      val halfStroke = strokePaint.strokeWidth * 0.5f
      rect.inset(halfStroke, halfStroke)
      val radius = (radiusDp * density - halfStroke).coerceAtLeast(0f)
      canvas.drawRoundRect(rect, radius, radius, strokePaint)
    }
  }

  private fun drawHeaderLines(canvas: Canvas, density: Float, widthDp: Float) {
    val rowWidth = (widthDp - 12f).coerceAtLeast(0f)
    val centerY = 11f
    fillPaint.color = dotColor
    canvas.drawCircle(9.5f * density, centerY * density, 3.5f * density, fillPaint)
    drawLine(canvas, density, 18f, centerY - 2f, rowWidth * 0.45f, primaryTextColor)
    drawLine(canvas, density, 23f + rowWidth * 0.45f, centerY - 2f, rowWidth * 0.2f, secondaryTextColor)
  }

  private fun drawCardLines(canvas: Canvas, density: Float, widthDp: Float, topDp: Float, hairlineDp: Float) {
    val contentWidth = (widthDp - 14f - 2f * hairlineDp).coerceAtLeast(0f)
    val linesTop = topDp + (42f - 13f) * 0.5f
    drawLine(canvas, density, hairlineDp + 7f, linesTop, contentWidth * 0.72f, primaryTextColor)
    drawLine(canvas, density, hairlineDp + 7f, linesTop + 9f, contentWidth * 0.48f, secondaryTextColor)
  }

  private fun drawTabsLines(canvas: Canvas, density: Float, widthDp: Float, topDp: Float, heightDp: Float) {
    val lineTop = topDp + (heightDp - 4f) * 0.5f
    drawLine(canvas, density, 0f, lineTop, widthDp * 0.4f, primaryTextColor)
    drawLine(canvas, density, widthDp * 0.4f + 5f, lineTop, widthDp * 0.18f, secondaryTextColor)
  }

  private fun drawLine(canvas: Canvas, density: Float, leftDp: Float, topDp: Float, widthDp: Float, color: Int) {
    linePaint.color = color.withMultipliedAlpha(0.72f)
    val heightDp = 4f
    rect.set(leftDp * density, topDp * density, (leftDp + widthDp) * density, (topDp + heightDp) * density)
    canvas.drawRoundRect(rect, 4f * density, 4f * density, linePaint)
  }

  private fun Int.withMultipliedAlpha(multiplier: Float): Int {
    val sourceAlpha = (this ushr 24) and 0xFF
    val alpha = (sourceAlpha * multiplier).toInt().coerceIn(0, 255)
    return (this and 0x00FFFFFF) or (alpha shl 24)
  }
}
