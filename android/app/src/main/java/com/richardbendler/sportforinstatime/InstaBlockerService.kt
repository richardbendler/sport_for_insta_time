package com.richardbendler.sportforinstatime

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.graphics.PixelFormat
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import kotlin.math.abs

class InstaBlockerService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var currentPackage: String? = null
  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var overlayText: TextView? = null
  private var overlayParams: WindowManager.LayoutParams? = null
  private var lastWidgetUpdateAt: Long = 0
  private var notificationManager: NotificationManager? = null

  private val notificationChannelId = "restricted_timer"
  private val notificationId = 1001

  private val ignoredPackages = setOf("com.android.systemui", "android")
  private val appActivities = setOf(
    "com.richardbendler.sportforinstatime.MainActivity",
    "com.richardbendler.sportforinstatime.InstaBlockerActivity",
    "com.richardbendler.sportforinstatime.InstaPrefaceActivity",
    "com.richardbendler.sportforinstatime.SportWidgetConfigActivity"
  )

  private val ticker = object : Runnable {
    override fun run() {
      tickUsage()
      handler.postDelayed(this, 1000)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    setupOverlay()
    setupNotificationChannel()
    handler.post(ticker)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val pkg = event?.packageName?.toString() ?: return
    val className = event.className?.toString()
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      return
    }
    if (ignoredPackages.contains(pkg) || !isLaunchablePackage(pkg)) {
      if (isHomePackage(pkg)) {
        clearForegroundApp()
      }
      return
    }
    if (pkg == applicationContext.packageName && !appActivities.contains(className)) {
      return
    }
    val now = System.currentTimeMillis()
    if (pkg == applicationContext.packageName) {
      currentPackage = pkg
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      return
    }
    val controlled = getControlledApps()
    if (!controlled.contains(pkg)) {
      if (isHomePackage(pkg)) {
        clearForegroundApp()
        return
      }
      currentPackage = pkg
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      return
    }
    val previousPackage = currentPackage
    currentPackage = pkg
    val remaining = getRemainingSeconds()
    updateCountdownOverlay(remaining, true)
    updateCountdownNotification(remaining, true, pkg)
    if (shouldBlock(pkg)) {
      updateCountdownOverlay(0, true)
      updateCountdownNotification(0, false, null)
      launchBlocker()
      return
    }
    if (previousPackage != pkg && shouldShowPreface(pkg)) {
      launchPreface(pkg, remaining)
    }
  }

  override fun onInterrupt() {}

  override fun onDestroy() {
    super.onDestroy()
    teardownOverlay()
    updateCountdownNotification(0, false, null)
  }

  private fun tickUsage() {
    val pkg = currentPackage ?: return
    if (pkg == applicationContext.packageName) {
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      return
    }
    val controlled = getControlledApps()
    if (!controlled.contains(pkg)) {
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      return
    }
    val prefs = getPrefs()
    val now = System.currentTimeMillis()
    val result = ScreenTimeStore.consumeSeconds(prefs, now, 1)
    val remaining = result.remainingSeconds
    if (result.consumedSeconds > 0) {
      ScreenTimeStore.addUsedSeconds(prefs, now, result.consumedSeconds)
    }
    updateCountdownOverlay(remaining, true)
    updateCountdownNotification(remaining, true, pkg)
    maybeUpdateWidgets()
    if (remaining <= 0) {
      launchBlocker()
    }
  }

  private fun clearForegroundApp() {
    currentPackage = null
    updateCountdownOverlay(0, false)
    updateCountdownNotification(0, false, null)
  }

  private fun shouldBlock(pkg: String): Boolean {
    if (pkg == applicationContext.packageName) {
      return false
    }
    val controlled = getControlledApps()
    if (!controlled.contains(pkg)) {
      return false
    }
    val prefs = getPrefs()
    val now = System.currentTimeMillis()
    val totals = ScreenTimeStore.getTotals(prefs, now)
    return totals.remainingSeconds <= 0
  }

  private fun launchBlocker() {
    val intent = Intent(this, InstaBlockerActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    startActivity(intent)
  }

  private fun setupOverlay() {
    if (windowManager != null) {
      return
    }
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val inflater = LayoutInflater.from(this)
    overlayView = inflater.inflate(R.layout.overlay_countdown, null)
    overlayText = overlayView?.findViewById(R.id.overlay_timer)
    overlayView?.setOnClickListener { openApp() }
    overlayView?.visibility = View.GONE
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    )
    params.gravity = Gravity.TOP or Gravity.START
    val density = resources.displayMetrics.density
    val prefs = getPrefs()
    val defaultX = (8 * density).toInt()
    val defaultY = (8 * density).toInt()
    params.x = prefs.getInt("overlay_x", defaultX)
    params.y = prefs.getInt("overlay_y", defaultY)
    overlayParams = params
    overlayView?.setOnTouchListener(createOverlayDragListener())
    windowManager?.addView(overlayView, params)
  }

  private fun teardownOverlay() {
    if (overlayView != null) {
      windowManager?.removeView(overlayView)
    }
    overlayView = null
    overlayText = null
    windowManager = null
  }

  private fun updateCountdownOverlay(remainingSeconds: Int, show: Boolean) {
    val view = overlayView ?: return
    if (!show) {
      view.visibility = View.GONE
      return
    }
    val minutes = (remainingSeconds / 60).toString().padStart(2, '0')
    val seconds = (remainingSeconds % 60).toString().padStart(2, '0')
    overlayText?.text = "$minutes:$seconds"
    view.visibility = View.VISIBLE
  }

  private fun setupNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      notificationChannelId,
      "Restricted app timer",
      NotificationManager.IMPORTANCE_LOW
    )
    channel.setSound(null, null)
    channel.enableVibration(false)
    manager.createNotificationChannel(channel)
    notificationManager = manager
  }

  private fun updateCountdownNotification(
    remainingSeconds: Int,
    show: Boolean,
    pkg: String?
  ) {
    val manager = notificationManager
      ?: getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager = manager
    if (!show || pkg == null) {
      manager.cancel(notificationId)
      return
    }
    if (Build.VERSION.SDK_INT >= 33) {
      val status = ContextCompat.checkSelfPermission(
        this,
        "android.permission.POST_NOTIFICATIONS"
      )
      if (status != PackageManager.PERMISSION_GRANTED) {
        return
      }
    }
    val appLabel = getAppLabel(pkg)
    val lang = getAppLanguage()
    val formatted = formatDuration(remainingSeconds)
    val title = when (lang) {
      "de" -> "Restzeit fuer $appLabel"
      "es" -> "Tiempo restante para $appLabel"
      "fr" -> "Temps restant pour $appLabel"
      else -> "Remaining time for $appLabel"
    }
    val text = when (lang) {
      "de" -> "Uebrig: $formatted"
      "es" -> "Queda: $formatted"
      "fr" -> "Reste: $formatted"
      else -> "Remaining: $formatted"
    }
    val notification = NotificationCompat.Builder(this, notificationChannelId)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(text)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    manager.notify(notificationId, notification)
  }

  private fun formatDuration(seconds: Int): String {
    val minutes = (seconds / 60).toString().padStart(2, '0')
    val remaining = (seconds % 60).toString().padStart(2, '0')
    return "$minutes:$remaining"
  }

  private fun getAppLabel(pkg: String): String {
    return try {
      val appInfo = packageManager.getApplicationInfo(pkg, 0)
      packageManager.getApplicationLabel(appInfo).toString()
    } catch (e: Exception) {
      pkg
    }
  }

  private fun getAppLanguage(): String {
    val prefs = getPrefs()
    return prefs.getString("app_language", "en") ?: "en"
  }

  private fun createOverlayDragListener(): View.OnTouchListener {
    val prefs = getPrefs()
    val threshold = (8 * resources.displayMetrics.density).toInt()
    var startX = 0
    var startY = 0
    var touchStartX = 0f
    var touchStartY = 0f
    var moved = false
    return View.OnTouchListener { view, event ->
      val params = overlayParams ?: return@OnTouchListener false
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchStartX = event.rawX
          touchStartY = event.rawY
          moved = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - touchStartX).toInt()
          val dy = (event.rawY - touchStartY).toInt()
          if (!moved && (abs(dx) > threshold || abs(dy) > threshold)) {
            moved = true
          }
          params.x = startX + dx
          params.y = startY + dy
          windowManager?.updateViewLayout(view, params)
          true
        }
        MotionEvent.ACTION_UP -> {
          if (moved) {
            prefs.edit().putInt("overlay_x", params.x).putInt("overlay_y", params.y).apply()
          } else {
            view.performClick()
          }
          true
        }
        else -> false
      }
    }
  }

  private fun shouldShowPreface(pkg: String): Boolean {
    val prefs = getPrefs()
    val allowedPkg = prefs.getString("preface_allow_package", null)
    val allowUntil = prefs.getLong("preface_allow_until", 0L)
    val now = System.currentTimeMillis()
    return !(allowedPkg == pkg && now < allowUntil)
  }

  private fun launchPreface(pkg: String, remainingSeconds: Int) {
    val intent = Intent(this, InstaPrefaceActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    intent.putExtra("target_package", pkg)
    intent.putExtra("remaining_seconds", remainingSeconds)
    startActivity(intent)
  }

  private fun getRemainingSeconds(): Int {
    val prefs = getPrefs()
    val now = System.currentTimeMillis()
    val totals = ScreenTimeStore.getTotals(prefs, now)
    return totals.remainingSeconds
  }

  private fun maybeUpdateWidgets() {
    val now = System.currentTimeMillis()
    if (now - lastWidgetUpdateAt < 5000) {
      return
    }
    lastWidgetUpdateAt = now
    SportWidgetProvider.refreshAll(applicationContext)
    OverallWidgetProvider.refreshAll(applicationContext)
  }

  private fun openApp() {
    val intent = Intent(this, MainActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    startActivity(intent)
  }

  private fun getControlledApps(): Set<String> {
    val prefs = getPrefs()
    val json = prefs.getString("controlled_apps", "[]") ?: "[]"
    val array = JSONArray(json)
    val result = mutableSetOf<String>()
    for (i in 0 until array.length()) {
      result.add(array.getString(i))
    }
    return result
  }

  private fun getPrefs() =
    applicationContext.getSharedPreferences("insta_control", Context.MODE_PRIVATE)

  private fun isHomePackage(pkg: String): Boolean {
    val intent = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_HOME)
    val resolved = packageManager.queryIntentActivities(intent, 0)
    return resolved.any { it.activityInfo?.packageName == pkg }
  }

  private fun isLaunchablePackage(pkg: String): Boolean {
    return packageManager.getLaunchIntentForPackage(pkg) != null
  }
}
