package com.richardbendler.sportforinstatime

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.NumberPicker
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.text.DateFormat
import java.util.Date
import java.util.Locale

class InstaPrefaceActivity : AppCompatActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private var delaySeconds = 10
  private var remainingSeconds = 0
  private var targetPackage: String? = null

  private lateinit var countdownText: TextView
  private lateinit var remainingText: TextView
  private lateinit var openButton: Button
  private lateinit var creditSection: View
  private lateinit var creditPicker: NumberPicker
  private lateinit var creditButton: Button
  private lateinit var creditPenalty: TextView
  private lateinit var creditLockNotice: TextView

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
    val showCredit = intent.getBooleanExtra("preface_show_credit", remainingSeconds <= 0)

    countdownText = findViewById(R.id.preface_countdown)
    remainingText = findViewById(R.id.preface_remaining)
    openButton = findViewById(R.id.preface_button)
    creditSection = findViewById(R.id.preface_credit_section)
    creditPicker = findViewById(R.id.preface_credit_picker)
    creditButton = findViewById(R.id.preface_credit_button)
    creditPenalty = findViewById(R.id.preface_credit_penalty)
    creditLockNotice = findViewById(R.id.preface_credit_lock_notice)

    remainingText.text = formatTime(remainingSeconds)
    updateCountdown()

    updateCreditSection(showCredit)

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

  private fun setupCreditControls() {
    creditPicker.minValue = 1
    creditPicker.maxValue = 15
    creditPicker.wrapSelectorWheel = false
    creditPicker.setOnValueChangedListener { _, _, newVal ->
      updateCreditPenaltyText(newVal)
    }
    updateCreditPenaltyText(creditPicker.value)
    creditButton.setOnClickListener {
      grantCredit(creditPicker.value)
    }
  }

  private fun updateCreditSection(showCredit: Boolean) {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    if (!showCredit) {
      creditSection.visibility = View.GONE
      return
    }
    val now = System.currentTimeMillis()
    val lockExpiresAt = CreditStore.getCreditLockExpiresAt(prefs, now)
    if (lockExpiresAt > now) {
      showCreditLocked(lockExpiresAt)
      return
    }
    creditLockNotice.visibility = View.GONE
    creditPicker.visibility = View.VISIBLE
    creditButton.visibility = View.VISIBLE
    creditPenalty.visibility = View.VISIBLE
    creditSection.visibility = View.VISIBLE
    setupCreditControls()
  }

  private fun showCreditLocked(lockExpiresAt: Long) {
    creditSection.visibility = View.VISIBLE
    creditLockNotice.visibility = View.VISIBLE
    creditPicker.visibility = View.GONE
    creditButton.visibility = View.GONE
    creditPenalty.visibility = View.GONE
    creditLockNotice.text =
      getString(R.string.preface_credit_locked, formatLockExpiryLabel(lockExpiresAt))
  }

  private fun formatLockExpiryLabel(timestamp: Long): String {
    val formatter = DateFormat.getDateTimeInstance(
      DateFormat.SHORT,
      DateFormat.SHORT,
      Locale.getDefault()
    )
    return formatter.format(Date(timestamp))
  }

  private fun updateCreditPenaltyText(minutes: Int) {
    val penaltyPercent = CreditStore.computePenaltyPercentForMinutes(minutes)
    creditPenalty.text = getString(R.string.preface_credit_penalty, penaltyPercent)
  }

  private fun grantCredit(minutes: Int) {
    val safeMinutes = minutes.coerceIn(1, 15)
    val totalSeconds = safeMinutes * 60
    val entryId = "credit_${System.currentTimeMillis()}"
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val now = System.currentTimeMillis()
    ScreenTimeStore.upsertEntry(prefs, entryId, null, now, totalSeconds)
    val multiplier = CreditStore.computeCreditMultiplier(totalSeconds)
    CreditStore.setCreditInfo(prefs, entryId, safeMinutes, multiplier)
    CreditStore.scheduleCreditLock(prefs, now)
    remainingSeconds = totalSeconds
    remainingText.text = formatTime(remainingSeconds)
    creditSection.visibility = View.GONE
    val penaltyPercent = CreditStore.computePenaltyPercentForMinutes(safeMinutes)
    Toast.makeText(
      this,
      getString(R.string.preface_credit_success, safeMinutes, penaltyPercent),
      Toast.LENGTH_SHORT
    ).show()
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
