package com.richardbendler.sportforinstatime

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.graphics.PixelFormat
import android.content.IntentFilter
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
import android.view.inputmethod.InputMethodManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import java.util.Locale
import kotlin.math.abs
import com.richardbendler.sportforinstatime.SickOverrideStore

class InstaBlockerService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var currentPackage: String? = null
  private var lastForegroundWasHome: Boolean = false
  private var suspendedPackage: String? = null
  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var overlayText: TextView? = null
  private var overlayParams: WindowManager.LayoutParams? = null
  private var workoutOverlayView: View? = null
  private var workoutOverlayLabel: TextView? = null
  private var workoutOverlayTimer: TextView? = null
  private var workoutOverlayParams: WindowManager.LayoutParams? = null
  private var lastWidgetUpdateAt: Long = 0
  private var notificationManager: NotificationManager? = null
  private var notificationShadeActive: Boolean = false
  private var screenReceiverRegistered: Boolean = false

  private val notificationShadeGraceMs = 1000L
  private var lastNotificationShadeEventAt: Long = 0

  private val notificationChannelId = "restricted_timer"
  private val notificationId = 1001
  private var pendingHomeClear: Runnable? = null
  private val homeClearDelayMillis = 600L
  private val grayscalePrefKey = "grayscale_restricted_apps"

  private var grayscaleOverlayView: View? = null
  private var grayscaleOverlayShown = false

  private val ignoredPackagePrefixes = setOf(
    "com.android.systemui",
    "android",
    "com.android.permissioncontroller",
    "com.google.android.permissioncontroller"
  )
  private val appActivities = setOf(
    "com.richardbendler.sportforinstatime.MainActivity",
    "com.richardbendler.sportforinstatime.InstaBlockerActivity",
    "com.richardbendler.sportforinstatime.BrainMathActivity",
    "com.richardbendler.sportforinstatime.InstaPrefaceActivity",
    "com.richardbendler.sportforinstatime.SportWidgetConfigActivity"
  )

  private val ticker = object : Runnable {
    override fun run() {
      tickUsage()
      handler.postDelayed(this, 1000)
    }
  }

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        Intent.ACTION_SCREEN_OFF -> pauseForegroundAppForResume()
      }
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    setupOverlay()
    setupWorkoutOverlay()
    setupGrayscaleOverlay()
    setupNotificationChannel()
    registerScreenReceiver()
    handler.post(ticker)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val pkg = event?.packageName?.toString() ?: return
    val className = event.className?.toString()
    val eventTime = System.currentTimeMillis()
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      return
    }
    if (isNotificationShadeEvent(pkg, className)) {
      notificationShadeActive = true
      lastNotificationShadeEventAt = eventTime
      return
    }
    notificationShadeActive = false
    lastNotificationShadeEventAt = 0L
    if (pkg.startsWith("com.android.systemui")) {
      return
    }
    if (isInputMethodPackage(pkg)) {
      return
    }
    if (ignoredPackagePrefixes.any { pkg.startsWith(it) }) {
      return
    }
    if (!isLaunchablePackage(pkg)) {
      if (isHomePackage(pkg)) {
        scheduleForegroundClear()
      }
      syncGrayscaleState(false)
      return
    }
    if (pkg == applicationContext.packageName && !appActivities.contains(className)) {
      syncGrayscaleState(false)
      return
    }
    val now = System.currentTimeMillis()
    if (pkg == applicationContext.packageName) {
      currentPackage = pkg
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      syncGrayscaleState(false)
      return
    }
    val controlled = getControlledApps()
    if (!controlled.contains(pkg)) {
      if (isHomePackage(pkg)) {
        scheduleForegroundClear()
        syncGrayscaleState(false)
        return
      }
      currentPackage = pkg
      lastForegroundWasHome = false
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      syncGrayscaleState(false)
      return
    }
    cancelForegroundClear()
    if (currentPackage != null && currentPackage != pkg) {
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
    }
    val previousPackage = currentPackage
    val resumedSuspendedPackage = suspendedPackage == pkg
    currentPackage = pkg
    suspendedPackage = null
    val openedFromHome = lastForegroundWasHome
    lastForegroundWasHome = false
    val remaining = getRemainingSeconds()
    updateCountdownOverlay(remaining, true)
    updateCountdownNotification(remaining, true, pkg)
    syncGrayscaleState(true)
    if (shouldBlock(pkg)) {
      updateCountdownOverlay(0, true)
      updateCountdownNotification(0, false, null)
      launchBlocker(pkg)
      return
    }
    if (
      (previousPackage != pkg || openedFromHome) &&
      shouldShowPreface(pkg) &&
      openedFromHome &&
      !resumedSuspendedPackage
    ) {
      launchPreface(pkg, remaining)
    }
  }

  override fun onInterrupt() {}

  override fun onDestroy() {
    super.onDestroy()
    teardownOverlay()
    teardownGrayscaleOverlay()
    teardownWorkoutOverlay()
    updateCountdownNotification(0, false, null)
    unregisterScreenReceiver()
  }

  private fun tickUsage() {
    val pkg = currentPackage
    val now = System.currentTimeMillis()
    if (notificationShadeActive) {
      updateWorkoutOverlay()
      maybeUpdateWidgets()
      if (lastNotificationShadeEventAt > 0 &&
        now - lastNotificationShadeEventAt >= notificationShadeGraceMs
      ) {
        notificationShadeActive = false
        lastNotificationShadeEventAt = 0L
      }
    }
    if (pkg == null) {
      syncGrayscaleState(false)
      updateWorkoutOverlay()
      maybeUpdateWidgets()
      return
    }
    if (pkg == applicationContext.packageName) {
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      syncGrayscaleState(false)
      updateWorkoutOverlay()
      maybeUpdateWidgets()
      return
    }
    val controlled = getControlledApps()
    val isControlled = controlled.contains(pkg)
    syncGrayscaleState(isControlled)
    if (!isControlled) {
      updateCountdownOverlay(0, false)
      updateCountdownNotification(0, false, null)
      updateWorkoutOverlay()
      maybeUpdateWidgets()
      return
    }
    val prefs = getPrefs()
    if (SickOverrideStore.isOverrideActive(prefs, now)) {
      val limitMinutes = SickOverrideStore.getDailyLimitMinutes(prefs)
      if (limitMinutes > 0) {
        val usedSeconds = SickOverrideStore.addUsedSeconds(prefs, now, 1)
        if (usedSeconds >= limitMinutes * 60) {
          SickOverrideStore.clearOverride(prefs)
        }
      }
    }
    val result = ScreenTimeStore.consumeSeconds(prefs, now, 1)
    val remaining = result.remainingSeconds
    if (result.consumedSeconds > 0) {
      ScreenTimeStore.addUsedSeconds(prefs, now, result.consumedSeconds)
      ScreenTimeStore.addUsedSecondsForApp(prefs, now, pkg, result.consumedSeconds)
    }
    updateCountdownOverlay(remaining, true)
    updateCountdownNotification(remaining, true, pkg)
    updateWorkoutOverlay()
    maybeUpdateWidgets()
    if (remaining <= 0) {
      launchBlocker(pkg)
    }
  }

  private fun clearForegroundApp(fromHome: Boolean) {
    cancelForegroundClear()
    currentPackage = null
    if (fromHome) {
      lastForegroundWasHome = true
    }
    updateCountdownOverlay(0, false)
    updateCountdownNotification(0, false, null)
    syncGrayscaleState(false)
  }

  private fun pauseForegroundAppForResume() {
    val pkg = currentPackage
    if (pkg != null && getControlledApps().contains(pkg)) {
      suspendedPackage = pkg
    }
    clearForegroundApp(false)
  }

  private fun rememberCurrentPackageForResume() {
    val pkg = currentPackage
    if (pkg != null && getControlledApps().contains(pkg)) {
      suspendedPackage = pkg
    }
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
    if (SickOverrideStore.isOverrideActive(prefs, now)) {
      return false
    }
    val totals = ScreenTimeStore.getTotals(prefs, now)
    return totals.remainingSeconds <= 0
  }

  private fun launchBlocker(targetPackage: String?) {
    val intent = Intent(this, InstaBlockerActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    intent.putExtra("target_package", targetPackage)
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

  private fun setupWorkoutOverlay() {
    if (windowManager == null) {
      windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }
    if (workoutOverlayView != null) {
      return
    }
    val inflater = LayoutInflater.from(this)
    workoutOverlayView = inflater.inflate(R.layout.overlay_workout_timer, null)
    workoutOverlayLabel = workoutOverlayView?.findViewById(R.id.overlay_workout_label)
    workoutOverlayTimer = workoutOverlayView?.findViewById(R.id.overlay_workout_timer)
    workoutOverlayView?.setOnClickListener { openWorkoutSport() }
    workoutOverlayView?.visibility = View.GONE
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
    params.x = prefs.getInt("workout_overlay_x", defaultX)
    params.y = prefs.getInt("workout_overlay_y", defaultY)
    workoutOverlayParams = params
    workoutOverlayView?.setOnTouchListener(createWorkoutOverlayDragListener())
    windowManager?.addView(workoutOverlayView, params)
  }

  private fun teardownOverlay() {
    if (overlayView != null) {
      windowManager?.removeView(overlayView)
    }
    overlayView = null
    overlayText = null
  }

  private fun teardownWorkoutOverlay() {
    if (workoutOverlayView != null) {
      windowManager?.removeView(workoutOverlayView)
    }
    workoutOverlayView = null
    workoutOverlayLabel = null
    workoutOverlayTimer = null
    workoutOverlayParams = null
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

  private fun updateWorkoutOverlay() {
    val view = workoutOverlayView ?: return
    val prefs = getPrefs()
    val running = prefs.getBoolean("workout_overlay_running", false)
    val visible = prefs.getBoolean("workout_overlay_visible", false)
    val startTs = prefs.getLong("workout_overlay_start_ts", 0L)
    if (!running || !visible || startTs <= 0L) {
      view.visibility = View.GONE
      return
    }
    val elapsedSeconds = ((System.currentTimeMillis() - startTs) / 1000).toInt().coerceAtLeast(0)
    val minutes = (elapsedSeconds / 60).toString().padStart(2, '0')
    val seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
    val label = prefs.getString("workout_overlay_sport_label", null) ?: "Sport"
    workoutOverlayLabel?.text = label
    workoutOverlayTimer?.text = "$minutes:$seconds"
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

  private fun scheduleForegroundClear() {
    cancelForegroundClear()
    val runnable = Runnable {
      pendingHomeClear = null
      rememberCurrentPackageForResume()
      clearForegroundApp(true)
    }
    pendingHomeClear = runnable
    handler.postDelayed(runnable, homeClearDelayMillis)
  }

  private fun cancelForegroundClear() {
    pendingHomeClear?.let {
      handler.removeCallbacks(it)
      pendingHomeClear = null
    }
  }

  private fun openApp() {
    val intent = Intent(this, MainActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    startActivity(intent)
  }

  private fun openWorkoutSport() {
    val prefs = getPrefs()
    val sportId = prefs.getString("workout_overlay_sport_id", null)
    if (!sportId.isNullOrBlank()) {
      prefs.edit().putString("workout_overlay_open_sport_id", sportId).apply()
    }
    openApp()
  }

  private fun registerScreenReceiver() {
    if (screenReceiverRegistered) {
      return
    }
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(screenReceiver, filter)
    }
    screenReceiverRegistered = true
  }

  private fun unregisterScreenReceiver() {
    if (!screenReceiverRegistered) {
      return
    }
    unregisterReceiver(screenReceiver)
    screenReceiverRegistered = false
  }

  private fun isNotificationShadeEvent(pkg: String, className: String?): Boolean {
    if (!pkg.startsWith("com.android.systemui")) {
      return false
    }
    val normalized = className?.lowercase(Locale.getDefault()) ?: return true
    return normalized.contains("statusbar") ||
      normalized.contains("notification") ||
      normalized.contains("shade") ||
      normalized.contains("quicksettings")
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

  private fun syncGrayscaleState(isControlled: Boolean) {
    if (!shouldUseGrayscale() || !isControlled) {
      hideGrayscaleOverlay()
      return
    }
    showGrayscaleOverlay()
  }

  private fun shouldUseGrayscale(): Boolean {
    val prefs = getPrefs()
    return prefs.getBoolean(grayscalePrefKey, false)
  }

  private fun setupGrayscaleOverlay() {
    if (windowManager == null) {
      windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }
    if (grayscaleOverlayView != null) {
      return
    }
    val view = View(this)
    view.setBackgroundColor(android.graphics.Color.argb(150, 60, 60, 60))
    view.visibility = View.GONE
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    )
    params.gravity = Gravity.TOP or Gravity.START
    windowManager?.addView(view, params)
    grayscaleOverlayView = view
  }

  private fun teardownGrayscaleOverlay() {
    val view = grayscaleOverlayView ?: return
    windowManager?.removeView(view)
    grayscaleOverlayView = null
    grayscaleOverlayShown = false
  }

  private fun showGrayscaleOverlay() {
    if (grayscaleOverlayShown) {
      return
    }
    grayscaleOverlayView?.visibility = View.VISIBLE
    grayscaleOverlayShown = true
  }

  private fun hideGrayscaleOverlay() {
    if (!grayscaleOverlayShown) {
      return
    }
    grayscaleOverlayView?.visibility = View.GONE
    grayscaleOverlayShown = false
  }

  private fun createWorkoutOverlayDragListener(): View.OnTouchListener {
    val prefs = getPrefs()
    val threshold = (8 * resources.displayMetrics.density).toInt()
    var startX = 0
    var startY = 0
    var touchStartX = 0f
    var touchStartY = 0f
    var moved = false
    return View.OnTouchListener { view, event ->
      val params = workoutOverlayParams ?: return@OnTouchListener false
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
            prefs.edit().putInt("workout_overlay_x", params.x).putInt("workout_overlay_y", params.y).apply()
          } else {
            view.performClick()
          }
          true
        }
        else -> false
      }
    }
  }

  private fun isHomePackage(pkg: String): Boolean {
    val intent = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_HOME)
    val resolved = packageManager.queryIntentActivities(intent, 0)
    return resolved.any { it.activityInfo?.packageName == pkg }
  }

  private fun isLaunchablePackage(pkg: String): Boolean {
    return packageManager.getLaunchIntentForPackage(pkg) != null
  }

  private fun isInputMethodPackage(pkg: String): Boolean {
    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
      ?: return false
    return imm.enabledInputMethodList.any { it.packageName == pkg }
  }
}
