package com.richardbendler.sportforinstatime

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

class InstaPrefaceActivity : AppCompatActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private var delaySeconds = 10
  private var countdownEndsAtMillis = 0L
  private var remainingSeconds = 0
  private var targetPackage: String? = null

  private lateinit var countdownText: TextView
  private lateinit var remainingText: TextView
  private lateinit var openButton: Button

  private val ticker = object : Runnable {
    override fun run() {
      delaySeconds = secondsUntilCountdownEnd()
      updateCountdown()
      if (delaySeconds > 0) {
        handler.postDelayed(this, 1000)
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLocaleFromPrefs()
    setContentView(R.layout.activity_insta_preface)
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN

    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val configuredDelaySeconds = prefs.getInt("preface_delay_seconds", delaySeconds).coerceAtLeast(0)
    val incomingPackage = intent.getStringExtra("target_package")
    countdownEndsAtMillis = savedInstanceState?.getLong(KEY_COUNTDOWN_ENDS_AT_MILLIS)
      ?.takeIf { it > 0L }
      ?: prefs.getLong(KEY_ACTIVE_COUNTDOWN_ENDS_AT_MILLIS, 0L)
        .takeIf {
          it > 0L &&
            prefs.getString(KEY_ACTIVE_TARGET_PACKAGE, null) == incomingPackage &&
            it > System.currentTimeMillis()
        }
      ?: (System.currentTimeMillis() + configuredDelaySeconds * 1000L)
    prefs.edit()
      .putString(KEY_ACTIVE_TARGET_PACKAGE, incomingPackage)
      .putLong(KEY_ACTIVE_COUNTDOWN_ENDS_AT_MILLIS, countdownEndsAtMillis)
      .apply()
    delaySeconds = secondsUntilCountdownEnd()

    remainingSeconds = intent.getIntExtra("remaining_seconds", 0)
    targetPackage = incomingPackage
    countdownText = findViewById(R.id.preface_countdown)
    remainingText = findViewById(R.id.preface_remaining)
    openButton = findViewById(R.id.preface_button)

    remainingText.text = formatTime(remainingSeconds)
    updateCountdown()

    openButton.setOnClickListener { openTargetApp() }
    if (delaySeconds > 0) {
      handler.postDelayed(ticker, 1000)
    }
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    outState.putLong(KEY_COUNTDOWN_ENDS_AT_MILLIS, countdownEndsAtMillis)
  }

  override fun onDestroy() {
    super.onDestroy()
    handler.removeCallbacks(ticker)
  }

  override fun onBackPressed() {
    goHome()
  }

  private fun updateCountdown() {
    countdownText.text = delaySeconds.toString().padStart(2, '0')
    val enabled = delaySeconds <= 0
    openButton.isEnabled = enabled
    openButton.alpha = if (enabled) 1f else 0.5f
  }

  private fun secondsUntilCountdownEnd(): Int {
    val remainingMillis = countdownEndsAtMillis - System.currentTimeMillis()
    return ((remainingMillis + 999L) / 1000L).toInt().coerceAtLeast(0)
  }

  private fun openTargetApp() {
    delaySeconds = secondsUntilCountdownEnd()
    updateCountdown()
    if (delaySeconds > 0) {
      return
    }
    val pkg = targetPackage ?: return
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val allowUntil = System.currentTimeMillis() + 60000L
    prefs.edit()
      .putString("preface_allow_package", pkg)
      .putLong("preface_allow_until", allowUntil)
      .remove(KEY_ACTIVE_TARGET_PACKAGE)
      .remove(KEY_ACTIVE_COUNTDOWN_ENDS_AT_MILLIS)
      .apply()
    val intent = packageManager.getLaunchIntentForPackage(pkg)
    if (intent != null) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      startActivity(intent)
    }
    finish()
  }

  private fun goHome() {
    clearActiveCountdown()
    val intent = Intent(Intent.ACTION_MAIN)
    intent.addCategory(Intent.CATEGORY_HOME)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
    startActivity(intent)
    finish()
  }

  private fun formatTime(seconds: Int): String {
    val minutes = (seconds / 60).toString().padStart(2, '0')
    val secs = (seconds % 60).toString().padStart(2, '0')
    return "$minutes:$secs"
  }

  private fun applyLocaleFromPrefs() {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val language = prefs.getString("app_language", null) ?: return
    val locale = Locale(language)
    Locale.setDefault(locale)
    val config = resources.configuration
    config.setLocale(locale)
    resources.updateConfiguration(config, resources.displayMetrics)
  }

  private fun clearActiveCountdown() {
    getSharedPreferences("insta_control", MODE_PRIVATE)
      .edit()
      .remove(KEY_ACTIVE_TARGET_PACKAGE)
      .remove(KEY_ACTIVE_COUNTDOWN_ENDS_AT_MILLIS)
      .apply()
  }

  companion object {
    private const val KEY_COUNTDOWN_ENDS_AT_MILLIS = "countdown_ends_at_millis"
    private const val KEY_ACTIVE_TARGET_PACKAGE = "preface_active_target_package"
    private const val KEY_ACTIVE_COUNTDOWN_ENDS_AT_MILLIS = "preface_active_countdown_ends_at_millis"
  }
}
