package com.newhu.liquidglass.local

import android.view.View
import java.util.WeakHashMap

object LocalGlassHardwareLayerExperiment {
    @Volatile
    private var enabled = false
    private val views = WeakHashMap<View, Unit>()

    fun register(view: View) {
        synchronized(views) { views[view] = Unit }
        view.setLayerType(if (enabled) View.LAYER_TYPE_HARDWARE else View.LAYER_TYPE_NONE, null)
    }

    fun unregister(view: View) {
        synchronized(views) { views.remove(view) }
    }

    fun setEnabled(value: Boolean) {
        enabled = value
        val attached = synchronized(views) { views.keys.toList() }
        attached.forEach { view ->
            view.post {
                view.setLayerType(if (value) View.LAYER_TYPE_HARDWARE else View.LAYER_TYPE_NONE, null)
            }
        }
    }
}
