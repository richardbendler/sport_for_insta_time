package com.richardbendler.sportforinstatime

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import com.facebook.react.bridge.*
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class InstaControlModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "InstaControl"

  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
      val resultList = mutableListOf<Map<String, String>>()
      for (app in apps) {
        val packageName = app.packageName ?: continue
        if (packageName == reactContext.packageName) {
          continue
        }
        val launchIntent = pm.getLaunchIntentForPackage(packageName) ?: continue
        val label = pm.getApplicationLabel(app).toString()
        if (label.isBlank()) {
          continue
        }
        resultList.add(mapOf("packageName" to packageName, "label" to label))
      }
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
  fun openAccessibilitySettings() {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
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
  fun getUsageState(promise: Promise) {
    try {
      val prefs = getPrefs()
      val today = todayKey()
      val lastDay = prefs.getString("last_day", "") ?: ""
      var used = prefs.getInt("used_seconds", 0)
      if (lastDay != today) {
        used = 0
        prefs.edit().putInt("used_seconds", 0).putString("last_day", today).apply()
      }
      val allowance = prefs.getInt("allowance_seconds", 0)
      val map = Arguments.createMap()
      map.putInt("allowanceSeconds", allowance)
      map.putInt("usedSeconds", used)
      map.putString("day", today)
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("USAGE_STATE_ERROR", e)
    }
  }

  @ReactMethod
  fun requestPinWidget(sportId: String, sportName: String, promise: Promise) {
    try {
      val manager = AppWidgetManager.getInstance(reactContext)
      val provider = ComponentName(reactContext, SportWidgetProvider::class.java)
      val supported = manager.isRequestPinAppWidgetSupported
      if (!supported) {
        promise.resolve(false)
        return
      }
      val prefs = getWidgetPrefs()
      prefs.edit()
        .putString("pending_sport_id", sportId)
        .putString("pending_sport_name", sportName)
        .apply()
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
  }

  private fun getPrefs() =
    reactContext.getSharedPreferences("insta_control", Context.MODE_PRIVATE)

  private fun getWidgetPrefs() =
    reactContext.getSharedPreferences("widget_data", Context.MODE_PRIVATE)

  private fun todayKey(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date())
  }
}
