package expo.modules.newhuliquidglass

import com.newhu.liquidglass.backdrop.LiquidGlassBackdropSource
import com.newhu.liquidglass.backdrop.GlassViewController
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

internal object CoreLiquidGlassRegistry {
    private val providers = ConcurrentHashMap<String, WeakReference<ExpoGlassProviderCoreView>>()
    private val waiting = CopyOnWriteArrayList<Pair<String, WeakReference<GlassViewController>>>()
    @Volatile private var scrollTelemetryEnabled = false

    fun registerProvider(id: String, provider: ExpoGlassProviderCoreView) {
        providers[id] = WeakReference(provider)
        provider.setDetailedScrollTelemetryEnabled(scrollTelemetryEnabled)
        waiting.removeAll { (wantedId, reference) ->
            val controller = reference.get() ?: return@removeAll true
            if (wantedId != id) return@removeAll false
            controller.provider = provider
            true
        }
    }

    fun unregisterProvider(id: String, provider: ExpoGlassProviderCoreView) {
        if (providers[id]?.get() === provider) providers.remove(id)
    }

    fun provider(id: String): LiquidGlassBackdropSource? = providers[id]?.get()

    fun setScrollTelemetryEnabled(enabled: Boolean) {
        scrollTelemetryEnabled = enabled
        for (reference in providers.values) reference.get()?.setDetailedScrollTelemetryEnabled(enabled)
    }

    fun resolve(id: String, controller: GlassViewController) {
        val provider = providers[id]?.get()
        if (provider != null) {
            controller.provider = provider
        } else {
            controller.provider = null
            waiting.add(id to WeakReference(controller))
        }
    }

    fun cancelWaiting(controller: GlassViewController) {
        waiting.removeAll { (_, reference) ->
            val waitingController = reference.get()
            waitingController == null || waitingController === controller
        }
    }

    fun setCaptureMode(id: String, mode: String) {
        for ((providerId, reference) in providers.entries) {
            if (providerId == id || providerId.startsWith("$id:")) {
                reference.get()?.setCaptureModeImperatively(mode)
            }
        }
    }

    fun prepareFrozenBackdrop(id: String, blurRadiusDp: Float) {
        for ((providerId, reference) in providers.entries) {
            if (providerId == id || providerId.startsWith("$id:")) {
                reference.get()?.prepareFrozenBackdropImperatively(blurRadiusDp)
            }
        }
    }
}
