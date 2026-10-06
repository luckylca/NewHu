package com.newhu.liquidglass.nativebenchmark

import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.util.Log
import com.newhu.liquidglass.backdrop.LiquidGlassView
import com.newhu.liquidglass.core.GlassColor
import com.newhu.liquidglass.core.GlassEngine
import com.newhu.liquidglass.core.GlassMaterial
import com.newhu.liquidglass.core.GlassOpticsModel
import com.newhu.liquidglass.core.shader.SdfScaleLensShader
import com.newhu.liquidglass.telemetry.GlassTelemetry

internal class VisualParityActivity : Activity() {
    private var engine: GlassEngine? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        window.statusBarColor = Color.rgb(244, 247, 252)
        window.navigationBarColor = Color.rgb(244, 247, 252)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(244, 247, 252)) }
        engine = GlassEngine(root)
        val sourceContent = FrameLayout(this).apply {
            addView(ParityBackdropView(this@VisualParityActivity), FrameLayout.LayoutParams(-1, -1))
        }
        val source = engine!!.createBackdropSource(sourceContent)
        val blurDp = when (intent.getStringExtra("blurCandidate")) {
            "zero" -> 0f
            "physical025" -> 0.25f / resources.displayMetrics.density
            "physical05" -> 0.5f / resources.displayMetrics.density
            else -> 0.25f
        }
        val glass = engine!!.createBackdropSurface(
            source = source,
            material = GlassMaterial(
                blurRadiusDp = blurDp,
                refractionAmount = 0f,
                refractionHeight = 0f,
                bodyRefractionAmount = 0f,
                chromaticAberration = 0f,
                saturation = 1f,
                tint = GlassColor(0f, 0f, 0f, 0f),
                highlightStrength = 0f,
                fresnelStrength = 0f,
                innerShadowStrength = 0f,
                cornerRadius = 100f,
                noiseStrength = 0f,
                highlightWidth = 0f,
                opticsModel = GlassOpticsModel.SDF_SCALE_LENS,
            ),
            layoutParams = FrameLayout.LayoutParams(dp(300), dp(200), Gravity.CENTER),
        )
        glass.controller.displacementOnlyDebug = intent.getBooleanExtra("displacementOnly", false)
        glass.controller.sdfDisplacementMapDebug = intent.getBooleanExtra("mapDebug", false)
        setContentView(root)
        Log.i(
            "LiquidGlassNative",
            "[GLASS_NATIVE_VISUAL] model=SDF_SCALE_LENS blurCandidate=${intent.getStringExtra("blurCandidate") ?: "dp025"} " +
                "blurDp=$blurDp density=${resources.displayMetrics.density} " +
                "sizeDp=300x200 maxRawDisplacementPx=${SdfScaleLensShader.maxRawDisplacementPx(dp(300).toFloat(), dp(200).toFloat())}",
        )
    }

    override fun onDestroy() {
        engine?.release()
        engine = null
        super.onDestroy()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class ParityBackdropView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val mountain = Path()

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val width = width.toFloat()
        val height = height.toFloat()
        val density = resources.displayMetrics.density
        paint.shader = LinearGradient(
            0f,
            0f,
            width,
            height,
            intArrayOf(Color.rgb(255, 224, 139), Color.rgb(159, 203, 255), Color.rgb(255, 194, 159)),
            null,
            Shader.TileMode.CLAMP,
        )
        canvas.drawRect(0f, 0f, width, height, paint)
        paint.shader = null

        val cell = 48f * density
        var row = 0
        var y = 0f
        while (y < height) {
            var column = 0
            var x = 0f
            while (x < width) {
                if ((row + column) % 2 == 0) {
                    paint.color = 0x557D9FC7
                    canvas.drawRect(x, y, x + cell, y + cell, paint)
                }
                column += 1
                x += cell
            }
            row += 1
            y += cell
        }

        paint.strokeWidth = density
        for (index in 0..(width / (64f * density)).toInt()) {
            val x = index * 64f * density
            paint.color = if (index % 4 == 0) 0xCC09316B.toInt() else 0x99203E78.toInt()
            canvas.drawLine(x, 0f, x, height, paint)
        }
        for (index in 0..(height / (64f * density)).toInt()) {
            val yLine = index * 64f * density
            paint.color = if (index % 4 == 0) 0xCC09316B.toInt() else 0x99203E78.toInt()
            canvas.drawLine(0f, yLine, width, yLine, paint)
        }
        drawBand(canvas, 0f, height * 0.31f, width, 10f * density, 0xFFE33557.toInt())
        drawBand(canvas, 0f, height * 0.68f, width, 10f * density, 0xFF204FEA.toInt())
        drawBand(canvas, width * 0.26f, 0f, 10f * density, height, 0xFF12AA68.toInt())
        drawBand(canvas, width * 0.76f, 0f, 10f * density, height, 0xFFE0A20A.toInt())
        drawLandscape(canvas, width * 0.08f, height * 0.72f, width * 0.34f, height * 0.21f, density)
        drawLabel(canvas, "TEXT + GRID", width * 0.07f, height * 0.11f, density)
        drawLabel(canvas, "COLOR STRIPES", width * 0.66f, height * 0.44f, density)
        drawLabel(canvas, "IMAGE + GRADIENT", width * 0.58f, height * 0.9f, density)
        paint.color = 0xFF132B4F.toInt()
        paint.textSize = 22f * density
        paint.typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
        canvas.drawText("Liquid Glass", width * 0.08f, height * 0.24f, paint)
        paint.textSize = 13f * density
        paint.typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL)
        canvas.drawText("300 × 200 · rounded SDF · edge scale mapping", width * 0.08f, height * 0.28f, paint)
    }

    private fun drawBand(canvas: Canvas, x: Float, y: Float, width: Float, height: Float, color: Int) {
        paint.style = Paint.Style.FILL
        paint.color = color
        canvas.drawRect(x, y, x + width, y + height, paint)
    }

    private fun drawLandscape(canvas: Canvas, x: Float, y: Float, width: Float, height: Float, density: Float) {
        canvas.save()
        canvas.clipRect(x, y, x + width, y + height)
        paint.shader = LinearGradient(x, y, x, y + height, intArrayOf(0xFF8BE0EE.toInt(), 0xFFF7D379.toInt(), 0xFF538D9A.toInt()), null, Shader.TileMode.CLAMP)
        canvas.drawRect(x, y, x + width, y + height, paint)
        paint.shader = null
        paint.color = 0xFFFFF7BD.toInt()
        canvas.drawCircle(x + width * 0.78f, y + height * 0.24f, 14f * density, paint)
        mountain.reset()
        mountain.moveTo(x, y + height)
        mountain.lineTo(x + width * 0.3f, y + height * 0.28f)
        mountain.lineTo(x + width * 0.53f, y + height * 0.79f)
        mountain.lineTo(x + width * 0.76f, y + height * 0.4f)
        mountain.lineTo(x + width, y + height)
        mountain.close()
        paint.color = 0xFF426C64.toInt()
        canvas.drawPath(mountain, paint)
        paint.color = 0xFF203F53.toInt()
        canvas.drawRect(x, y + height * 0.83f, x + width, y + height, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2f * density
        paint.color = Color.WHITE
        canvas.drawRoundRect(x, y, x + width, y + height, 12f * density, 12f * density, paint)
        paint.style = Paint.Style.FILL
        canvas.restore()
    }

    private fun drawLabel(canvas: Canvas, text: String, x: Float, y: Float, density: Float) {
        paint.typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
        paint.textSize = 12f * density
        val paddingX = 12f * density
        val paddingY = 8f * density
        val textWidth = paint.measureText(text)
        paint.color = 0xBBFFFFFF.toInt()
        canvas.drawRoundRect(x, y - 21f * density, x + textWidth + paddingX * 2f, y + paddingY, 8f * density, 8f * density, paint)
        paint.color = 0xFF142C52.toInt()
        canvas.drawText(text, x + paddingX, y, paint)
    }
}
