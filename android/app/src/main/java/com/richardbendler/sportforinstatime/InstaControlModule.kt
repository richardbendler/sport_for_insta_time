package com.richardbendler.sportforinstatime

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.AppOpsManager
import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.usage.UsageStatsManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.richardbendler.sportforinstatime.R
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class InstaControlModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val workoutNotificationChannelId = "workout_timer_channel"
  private val workoutNotificationId = 2002
  private var workoutNotificationManager: NotificationManager? = null

  override fun getName(): String = "InstaControl"

  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val activities = pm.queryIntentActivities(intent, 0)
      val packageMap = linkedMapOf<String, String>()
      for (resolveInfo in activities) {
        val activityInfo = resolveInfo.activityInfo ?: continue
        val packageName = activityInfo.packageName ?: continue
        if (packageName == reactContext.packageName) {
          continue
        }
        if (packageMap.containsKey(packageName)) {
          continue
        }
        val label = resolveInfo.loadLabel(pm)?.toString() ?: ""
        if (label.isBlank()) {
          continue
        }
        packageMap[packageName] = label
      }
      val resultList = packageMap.entries
        .map { mapOf("packageName" to it.key, "label" to it.value) }
        .toMutableList()
      resultList.sortBy { it["label"]?.lowercase(Locale.getDefault()) }
      val array = Arguments.createArray()
      for (entry in resultList) {
        val map = Arguments.createMap()
        map.putString("packageName", entry["packageName"])
        map.putString("label", entry["label"])
        array.pushMap(map)
      }
      promise.resolve(array)
    } catch (e: Exception) {
      promise.reject("INSTALLED_APPS_ERROR", e)
    }
  }

  @ReactMethod
  fun isAccessibilityEnabled(promise: Promise) {
    try {
      val manager =
        reactContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
      val enabledServices =
        manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      val serviceId = "${reactContext.packageName}/.InstaBlockerService"
      val enabled = enabledServices.any { it.id == serviceId }
      promise.resolve(enabled)
    } catch (e: Exception) {
      promise.reject("ACCESSIBILITY_CHECK_ERROR", e)
    }
  }

  @ReactMethod
  fun setAppLanguage(language: String?) {
    val prefs = getPrefs()
    if (language.isNullOrBlank()) {
      prefs.edit().remove("app_language").apply()
    } else {
      prefs.edit().putString("app_language", language).apply()
    }
  }

  @ReactMethod
  fun openAccessibilitySettings() {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun openUsageAccessSettings() {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
    } catch (e: Exception) {
      val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      fallback.data = android.net.Uri.parse("package:${reactContext.packageName}")
      fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(fallback)
    }
  }

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    try {
      val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        reactContext.packageName
      )
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    } catch (e: Exception) {
      promise.reject("USAGE_ACCESS_CHECK_ERROR", e)
    }
  }

  @ReactMethod
  fun getAppUsageStats(promise: Promise) {
    try {
      val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        reactContext.packageName
      )
      if (mode != AppOpsManager.MODE_ALLOWED) {
        promise.resolve(Arguments.createArray())
        return
      }
      val usageManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val calendar = Calendar.getInstance()
      calendar.set(Calendar.HOUR_OF_DAY, 0)
      calendar.set(Calendar.MINUTE, 0)
      calendar.set(Calendar.SECOND, 0)
      calendar.set(Calendar.MILLISECOND, 0)
      val start = calendar.timeInMillis
      val end = System.currentTimeMillis()
      val stats = usageManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        start,
        end
      )
      val array = Arguments.createArray()
      for (entry in stats) {
        val total = entry.totalTimeInForeground
        if (total <= 0) {
          continue
        }
        val map = Arguments.createMap()
        map.putString("packageName", entry.packageName)
        map.putDouble("totalTimeMs", total.toDouble())
        array.pushMap(map)
      }
      promise.resolve(array)
    } catch (e: Exception) {
      promise.reject("USAGE_STATS_ERROR", e)
    }
  }

  @ReactMethod
  fun setControlledApps(apps: ReadableArray) {
    val json = JSONArray()
    for (i in 0 until apps.size()) {
      val value = apps.getString(i)
      if (value != null) {
        json.put(value)
      }
    }
    val prefs = getPrefs()
    prefs.edit().putString("controlled_apps", json.toString()).apply()
  }

  @ReactMethod
  fun setDailyAllowanceSeconds(seconds: Int) {
    val prefs = getPrefs()
    val safeSeconds = if (seconds < 0) 0 else seconds
    prefs.edit().putInt("allowance_seconds", safeSeconds).apply()
  }

  @ReactMethod
  fun setPrefaceDelaySeconds(seconds: Int) {
    val prefs = getPrefs()
    val safeSeconds = if (seconds < 0) 0 else seconds
    prefs.edit().putInt("preface_delay_seconds", safeSeconds).apply()
  }

  @ReactMethod
  fun setGrayscaleRestrictedApps(enabled: Boolean) {
    val prefs = getPrefs()
    prefs.edit().putBoolean("grayscale_restricted_apps", enabled).apply()
  }

  @ReactMethod
  fun canWriteSecureSettings(promise: Promise) {
    val status = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.WRITE_SECURE_SETTINGS
    )
    promise.resolve(status == PackageManager.PERMISSION_GRANTED)
  }

  @ReactMethod
  fun upsertScreenTimeEntry(
    entryId: String,
    sportId: String?,
    createdAt: Double,
    totalSeconds: Int
  ) {
    val prefs = getPrefs()
    ScreenTimeStore.upsertEntry(
      prefs,
      entryId,
      sportId,
      createdAt.toLong(),
      totalSeconds
    )
    OverallWidgetProvider.refreshAll(reactContext)
  }

  @ReactMethod
  fun removeScreenTimeEntry(entryId: String) {
    ScreenTimeStore.removeEntry(getPrefs(), entryId)
  }

  @ReactMethod
  fun clearScreenTimeEntriesForSport(sportId: String) {
    ScreenTimeStore.clearEntriesForSport(getPrefs(), sportId)
  }

  @ReactMethod
  fun clearAllScreenTimeEntries() {
    ScreenTimeStore.clearAllEntries(getPrefs())
  }

  @ReactMethod
  fun updateOverallWidgets() {
    OverallWidgetProvider.refreshAll(reactContext)
  }

  @ReactMethod
  fun setOverallWidgetData(remainingSeconds: Int, totalSeconds: Int, carryoverSeconds: Int) {
    val prefs = getWidgetPrefs()
    prefs.edit()
      .putInt("overall_remaining", remainingSeconds.coerceAtLeast(0))
      .putInt("overall_total", totalSeconds.coerceAtLeast(0))
      .putInt("overall_carryover", carryoverSeconds.coerceAtLeast(0))
      .apply()
    OverallWidgetProvider.refreshAll(reactContext)
  }

  @ReactMethod
  fun getUsageState(promise: Promise) {
    try {
      val prefs = getPrefs()
      val now = System.currentTimeMillis()
      val today = todayKey()
      val used = ScreenTimeStore.getUsedSecondsToday(prefs, now)
      val totals = ScreenTimeStore.getTotals(prefs, now)
      val breakdown = ScreenTimeStore.getBreakdown(prefs, now)
      val byApp = ScreenTimeStore.getUsedByAppToday(prefs, now)
      val map = Arguments.createMap()
      map.putInt("remainingSeconds", totals.remainingSeconds)
      map.putInt("usedSeconds", used)
      map.putString("day", today)
      map.putInt("carryoverSeconds", breakdown.carryoverSeconds)
      map.putInt("entryCount", totals.entryCount)
      val bySport = Arguments.createMap()
      totals.remainingBySport.forEach { (sportKey, value) ->
        bySport.putInt(sportKey, value)
      }
      map.putMap("remainingBySport", bySport)
      val byAppMap = Arguments.createMap()
      byApp.forEach { (pkg, seconds) ->
        byAppMap.putInt(pkg, seconds)
      }
      map.putMap("usedByApp", byAppMap)
      OverallWidgetProvider.refreshAll(reactContext)
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("USAGE_STATE_ERROR", e)
    }
  }

  @ReactMethod
  fun getScreenTimeEntries(promise: Promise) {
    try {
      val prefs = getPrefs()
      val now = System.currentTimeMillis()
      val entries = ScreenTimeStore.getEntries(prefs, now)
      val list = Arguments.createArray()
      entries.forEach { entry ->
        val map = Arguments.createMap()
        map.putString("id", entry.id)
        map.putString("sportId", entry.sportId ?: "")
        map.putDouble("createdAt", entry.createdAt.toDouble())
        map.putDouble("lastDecayAt", entry.lastDecayAt.toDouble())
        map.putInt("remainingSeconds", entry.remainingSeconds)
        map.putInt("originalSeconds", entry.originalSeconds)
        list.pushMap(map)
      }
      promise.resolve(list)
    } catch (e: Exception) {
      promise.reject("SCREEN_TIME_ENTRIES_ERROR", e)
    }
  }

  @ReactMethod
  fun requestPinWidget(sportId: String, sportName: String, promise: Promise) {
    try {
      val manager = AppWidgetManager.getInstance(reactContext)
      val isOverall = sportId == "overall"
      val provider = if (isOverall) {
        ComponentName(reactContext, OverallWidgetProvider::class.java)
      } else {
        ComponentName(reactContext, SportWidgetProvider::class.java)
      }
      val supported = manager.isRequestPinAppWidgetSupported
      if (!supported) {
        promise.resolve(false)
        return
      }
      if (!isOverall) {
        val prefs = getWidgetPrefs()
        prefs.edit()
          .putString("pending_sport_id", sportId)
          .putString("pending_sport_name", sportName)
          .putString("last_widget_sport_id", sportId)
          .putString("last_widget_sport_name", sportName)
          .putLong("last_widget_request_time", System.currentTimeMillis())
          .apply()
      }
      val requested = manager.requestPinAppWidget(provider, null, null)
      promise.resolve(requested)
    } catch (e: Exception) {
      promise.reject("WIDGET_PIN_ERROR", e)
    }
  }

  @ReactMethod
  fun setWidgetSportData(
    sportId: String,
    title: String,
    value: String,
    screenTime: String,
    screenLabel: String,
    icon: String
  ) {
    val prefs = getWidgetPrefs()
    prefs.edit()
      .putString("${sportId}_title", title)
      .putString("${sportId}_value", value)
      .putString("${sportId}_screen", screenTime)
      .putString("${sportId}_screen_label", screenLabel)
      .putString("${sportId}_icon", icon)
      .apply()
  }

  @ReactMethod
  fun updateWidgets() {
    val manager = AppWidgetManager.getInstance(reactContext)
    val provider = ComponentName(reactContext, SportWidgetProvider::class.java)
    val ids = manager.getAppWidgetIds(provider)
    ids.forEach { id ->
      SportWidgetProvider.updateAppWidget(reactContext, manager, id)
    }
    OverallWidgetProvider.refreshAll(reactContext)
  }

  private fun getPrefs() =
    reactContext.getSharedPreferences("insta_control", Context.MODE_PRIVATE)

  private fun getWidgetPrefs() =
    reactContext.getSharedPreferences("widget_data", Context.MODE_PRIVATE)

  private fun todayKey(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date())
  }

  @ReactMethod
  fun showWorkoutNotification(title: String?, message: String?) {
    if (Build.VERSION.SDK_INT >= 33) {
      val status = ContextCompat.checkSelfPermission(
        reactContext,
        "android.permission.POST_NOTIFICATIONS"
      )
      if (status != PackageManager.PERMISSION_GRANTED) {
        return
      }
    }
    val manager = getWorkoutNotificationManager()
    val notification = NotificationCompat.Builder(
      reactContext,
      workoutNotificationChannelId
    )
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title ?: reactContext.getString(R.string.app_name))
      .setContentText(message ?: "")
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    manager.notify(workoutNotificationId, notification)
  }

  @ReactMethod
  fun clearWorkoutNotification() {
    getWorkoutNotificationManager().cancel(workoutNotificationId)
  }

  private fun getWorkoutNotificationManager(): NotificationManager {
    val manager = workoutNotificationManager
      ?: (reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).also {
        workoutNotificationManager = it
      }
    ensureWorkoutNotificationChannel(manager)
    return manager
  }

  private fun ensureWorkoutNotificationChannel(manager: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    if (manager.getNotificationChannel(workoutNotificationChannelId) != null) {
      return
    }
    val channel = NotificationChannel(
      workoutNotificationChannelId,
      "Workout timer",
      NotificationManager.IMPORTANCE_LOW
    )
    channel.setSound(null, null)
    channel.enableVibration(false)
    channel.setShowBadge(false)
    manager.createNotificationChannel(channel)
  }
}
