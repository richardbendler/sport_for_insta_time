package com.richardbendler.sportforinstatime

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class InstaBlockerService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var currentPackage: String? = null

  private val ticker = object : Runnable {
    override fun run() {
      tickUsage()
      handler.postDelayed(this, 1000)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    handler.post(ticker)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val pkg = event?.packageName?.toString() ?: return
    currentPackage = pkg
    if (shouldBlock(pkg)) {
      launchBlocker()
    }
  }

  override fun onInterrupt() {}

  private fun tickUsage() {
    val pkg = currentPackage ?: return
    if (pkg == applicationContext.packageName) {
      return
    }
    val controlled = getControlledApps()
    if (!controlled.contains(pkg)) {
      return
    }
    val prefs = getPrefs()
    val today = todayKey()
    val lastDay = prefs.getString("last_day", "") ?: ""
    if (lastDay != today) {
      prefs.edit().putInt("used_seconds", 0).putString("last_day", today).apply()
    }
    val allowance = prefs.getInt("allowance_seconds", 0)
    if (allowance <= 0) {
      launchBlocker()
      return
    }
    val used = prefs.getInt("used_seconds", 0) + 1
    prefs.edit().putInt("used_seconds", used).apply()
    if (used >= allowance) {
      launchBlocker()
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
    val today = todayKey()
    val lastDay = prefs.getString("last_day", "") ?: ""
    if (lastDay != today) {
      prefs.edit().putInt("used_seconds", 0).putString("last_day", today).apply()
    }
    val allowance = prefs.getInt("allowance_seconds", 0)
    val used = prefs.getInt("used_seconds", 0)
    return allowance <= 0 || used >= allowance
  }

  private fun launchBlocker() {
    val intent = Intent(this, InstaBlockerActivity::class.java)
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

  private fun todayKey(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date())
  }
}
