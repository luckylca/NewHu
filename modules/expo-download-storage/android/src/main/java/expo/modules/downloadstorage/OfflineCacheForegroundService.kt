package expo.modules.downloadstorage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import kotlin.math.roundToInt

private const val CHANNEL_ID = "offline-cache"
private const val NOTIFICATION_ID = 4201
private const val WAKE_LOCK_TIMEOUT_MS = 6 * 60 * 60 * 1000L

class OfflineCacheForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    createNotificationChannel()
    when (intent?.action) {
      ACTION_FINISH -> finishCaching(
        intent.getIntExtra(EXTRA_SUCCESS, 0),
        intent.getIntExtra(EXTRA_FAILED, 0),
        intent.getStringExtra(EXTRA_MESSAGE)
      )
      ACTION_STOP -> stopCaching()
      else -> {
        val progress = intent?.getIntExtra(EXTRA_PROGRESS, -1) ?: -1
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "正在准备离线缓存"
        val text = intent?.getStringExtra(EXTRA_TEXT) ?: "正在建立缓存任务"
        startAsForeground(buildProgressNotification(title, text, progress))
        acquireWakeLock()
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    super.onDestroy()
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    finishCaching(0, 1, "离线缓存运行时间过长，任务已停止")
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(CHANNEL_ID, "离线缓存", NotificationManager.IMPORTANCE_LOW).apply {
      description = "显示离线内容缓存进度并保持任务运行"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun startAsForeground(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildProgressNotification(title: String, text: String, progress: Int): Notification {
    val builder = notificationBuilder()
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)

    if (progress < 0) builder.setProgress(0, 0, true)
    else builder.setProgress(100, progress.coerceIn(0, 100), false)

    return builder.build()
  }

  private fun finishCaching(success: Int, failed: Int, message: String?) {
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()

    val resultText = message?.takeIf(String::isNotBlank)
      ?: if (failed > 0) "完成 $success 篇，$failed 篇失败" else "已完成 $success 篇离线缓存"
    val notification = notificationBuilder()
      .setContentTitle(if (failed > 0) "离线缓存已结束" else "离线缓存完成")
      .setContentText(resultText)
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setCategory(Notification.CATEGORY_STATUS)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .build()
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification)
  }

  private fun stopCaching() {
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun notificationBuilder(): Notification.Builder {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
      launchIntent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
      builder.setContentIntent(PendingIntent.getActivity(this, 0, launchIntent, pendingFlags))
    }
    return builder
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:offline-cache").apply {
      setReferenceCounted(false)
      acquire(WAKE_LOCK_TIMEOUT_MS)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
  }

  companion object {
    private const val ACTION_START = "expo.modules.downloadstorage.action.START_OFFLINE_CACHE"
    private const val ACTION_UPDATE = "expo.modules.downloadstorage.action.UPDATE_OFFLINE_CACHE"
    private const val ACTION_FINISH = "expo.modules.downloadstorage.action.FINISH_OFFLINE_CACHE"
    private const val ACTION_STOP = "expo.modules.downloadstorage.action.STOP_OFFLINE_CACHE"
    private const val EXTRA_PROGRESS = "progress"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_TEXT = "text"
    private const val EXTRA_SUCCESS = "success"
    private const val EXTRA_FAILED = "failed"
    private const val EXTRA_MESSAGE = "message"

    fun start(context: Context, total: Int) {
      val intent = serviceIntent(context, ACTION_START)
        .putExtra(EXTRA_PROGRESS, -1)
        .putExtra(EXTRA_TITLE, "正在准备离线缓存")
        .putExtra(EXTRA_TEXT, "计划缓存 ${total.coerceAtLeast(0)} 篇内容")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
    }

    fun update(context: Context, progress: Double, title: String, text: String) {
      context.startService(
        serviceIntent(context, ACTION_UPDATE)
          .putExtra(EXTRA_PROGRESS, (progress.coerceIn(0.0, 1.0) * 100).roundToInt())
          .putExtra(EXTRA_TITLE, title)
          .putExtra(EXTRA_TEXT, text)
      )
    }

    fun finish(context: Context, success: Int, failed: Int, message: String?) {
      context.startService(
        serviceIntent(context, ACTION_FINISH)
          .putExtra(EXTRA_SUCCESS, success.coerceAtLeast(0))
          .putExtra(EXTRA_FAILED, failed.coerceAtLeast(0))
          .putExtra(EXTRA_MESSAGE, message)
      )
    }

    fun stop(context: Context) {
      context.startService(serviceIntent(context, ACTION_STOP))
    }

    private fun serviceIntent(context: Context, action: String) =
      Intent(context, OfflineCacheForegroundService::class.java).setAction(action)
  }
}
