package com.richardbendler.sportforinstatime

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.TextView
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class InstaBlockerService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var currentPackage: String? = null
  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var overlayText: TextView? = null

  private val ticker = object : Runnable {
    override fun run() {
      tickUsage()
      handler.postDelayed(this, 1000)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    setupOverlay()
    handler.post(ticker)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val pkg = event?.packageName?.toString() ?: return
    currentPackage = pkg
    if (pkg == applicationContext.packageName) {
      updateCountdownOverlay(0, false)
      return
    }
    val controlled = getControlledApps()
    if (!controlled.contains(pkg)) {
      updateCountdownOverlay(0, false)
      return
    }
    if (shouldBlock(pkg)) {
      updateCountdownOverlay(0, true)
      launchBlocker()
    }
  }

  override fun onInterrupt() {}

  override fun onDestroy() {
    super.onDestroy()
    teardownOverlay()
  }

  private fun tickUsage() {
    val pkg = currentPackage ?: return
    if (pkg == applicationContext.packageName) {
      updateCountdownOverlay(0, false)
      return
    }
    val controlled = getControlledApps()
    if (!controlled.contains(pkg)) {
      updateCountdownOverlay(0, false)
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
      updateCountdownOverlay(0, true)
      launchBlocker()
      return
    }
    val used = prefs.getInt("used_seconds", 0) + 1
    prefs.edit().putInt("used_seconds", used).apply()
    val remaining = (allowance - used).coerceAtLeast(0)
    updateCountdownOverlay(remaining, true)
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
    params.x = (8 * density).toInt()
    params.y = (8 * density).toInt()
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

  private fun todayKey(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date())
  }
}
