package expo.modules.newhuliquidglass

import android.app.Activity
import android.view.MotionEvent
import android.view.Window
import com.newhu.liquidglass.telemetry.EffectiveScrollFpsProbe
import java.util.WeakHashMap

/** Debug benchmark bridge for Activity input sampling before child dispatch. */
public object EffectiveScrollInputBridge {
    private data class CallbackRegistration(
        val original: Window.Callback,
        val probe: Window.Callback,
    )

    private val registrations = WeakHashMap<Window, CallbackRegistration>()

    /** Called only by the module's FLAG_DEBUGGABLE-gated telemetry switch. */
    @JvmStatic
    public fun setActivityInputObservation(activity: Activity?, enabled: Boolean) {
        if (activity == null) return
        activity.runOnUiThread {
            val window = activity.window
            if (enabled) {
                if (registrations.containsKey(window)) return@runOnUiThread
                val original = window.callback ?: return@runOnUiThread
                val probe = ProbeWindowCallback(original)
                registrations[window] = CallbackRegistration(original, probe)
                window.callback = probe
            } else {
                val registration = registrations.remove(window) ?: return@runOnUiThread
                if (window.callback === registration.probe) {
                    window.callback = registration.original
                }
            }
        }
    }
}

private class ProbeWindowCallback(
    private val delegate: Window.Callback,
) : Window.Callback by delegate {
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        EffectiveScrollFpsProbe.onMotionEvent(event)
        return delegate.dispatchTouchEvent(event)
    }
}
