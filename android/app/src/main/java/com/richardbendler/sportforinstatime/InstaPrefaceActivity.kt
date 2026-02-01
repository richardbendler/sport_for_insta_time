package com.richardbendler.sportforinstatime

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.SeekBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

class InstaPrefaceActivity : AppCompatActivity() {
  private companion object {
    private const val DEFAULT_CREDIT_MINUTES = 5
    private const val MIN_CREDIT_MINUTES = 1
    private const val MAX_CREDIT_MINUTES = 15
  }

  private val handler = Handler(Looper.getMainLooper())
  private var delaySeconds = 10
  private var remainingSeconds = 0
  private var targetPackage: String? = null
  private var borrowMinutes = DEFAULT_CREDIT_MINUTES

  private lateinit var countdownText: TextView
  private lateinit var remainingText: TextView
  private lateinit var openButton: Button
  private lateinit var creditButton: Button
  private lateinit var creditSlider: SeekBar
  private lateinit var creditValue: TextView
  private lateinit var creditPenalty: TextView

  private val ticker = object : Runnable {
    override fun run() {
      if (delaySeconds > 0) {
        delaySeconds -= 1
        updateCountdown()
        handler.postDelayed(this, 1000)
      } else {
        updateCountdown()
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLocaleFromPrefs()
    setContentView(R.layout.activity_insta_preface)
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN

    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    delaySeconds = prefs.getInt("preface_delay_seconds", delaySeconds).coerceAtLeast(0)

    remainingSeconds = intent.getIntExtra("remaining_seconds", 0)
    targetPackage = intent.getStringExtra("target_package")

    countdownText = findViewById(R.id.preface_countdown)
    remainingText = findViewById(R.id.preface_remaining)
    openButton = findViewById(R.id.preface_button)
    creditValue = findViewById(R.id.preface_credit_value)
    creditPenalty = findViewById(R.id.preface_credit_penalty)
    creditSlider = findViewById(R.id.preface_credit_slider)
    creditButton = findViewById(R.id.preface_credit_button)

    remainingText.text = formatTime(remainingSeconds)
    updateCountdown()

    creditSlider.max = MAX_CREDIT_MINUTES - MIN_CREDIT_MINUTES
    creditSlider.progress = borrowMinutes - MIN_CREDIT_MINUTES
    creditSlider.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
      override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
        borrowMinutes = MIN_CREDIT_MINUTES + progress
        updateCreditDisplay()
      }

      override fun onStartTrackingTouch(seekBar: SeekBar?) {}
      override fun onStopTrackingTouch(seekBar: SeekBar?) {}
    })
    updateCreditDisplay()

    creditButton.setOnClickListener { useCredit() }

    openButton.setOnClickListener { openTargetApp() }
    handler.postDelayed(ticker, 1000)
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
    creditButton.isEnabled = enabled
    creditButton.alpha = if (enabled) 1f else 0.5f
  }

  private fun openTargetApp() {
    if (delaySeconds > 0) {
      return
    }
    val pkg = targetPackage ?: return
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val allowUntil = System.currentTimeMillis() + 60000L
    prefs.edit()
      .putString("preface_allow_package", pkg)
      .putLong("preface_allow_until", allowUntil)
      .apply()
    val intent = packageManager.getLaunchIntentForPackage(pkg)
    if (intent != null) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      startActivity(intent)
    }
    finish()
  }

  private fun updateCreditDisplay() {
    creditValue.text = getString(R.string.preface_credit_minutes, borrowMinutes)
    val penaltyPercent = computePenaltyPercent(borrowMinutes)
    creditPenalty.text = getString(R.string.preface_credit_penalty_hint, penaltyPercent)
  }

  private fun computePenaltyMultiplier(minutes: Int): Float {
    val base = 1f - minutes * 0.02f
    return base.coerceAtLeast(0.5f)
  }

  private fun computePenaltyPercent(minutes: Int): Int {
    return (computePenaltyMultiplier(minutes) * 100).toInt()
  }

  private fun useCredit() {
    if (delaySeconds > 0) {
      return
    }
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val penalty = computePenaltyMultiplier(borrowMinutes)
    val granted = ScreenTimeStore.grantCredit(prefs, borrowMinutes, penalty)
    if (!granted) {
      return
    }
    remainingSeconds += borrowMinutes * 60
    remainingText.text = formatTime(remainingSeconds)
    openTargetApp()
  }

  private fun goHome() {
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
}
