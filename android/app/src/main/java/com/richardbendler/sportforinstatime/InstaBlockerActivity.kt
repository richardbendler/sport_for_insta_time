package com.richardbendler.sportforinstatime

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.NumberPicker
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale
import java.text.DateFormat
import java.util.Date

class InstaBlockerActivity : AppCompatActivity() {
  private lateinit var creditSection: View
  private lateinit var creditPicker: NumberPicker
  private lateinit var creditButton: Button
  private lateinit var creditPenalty: TextView
  private lateinit var creditLockNotice: TextView
  private lateinit var sickButton: Button
  private lateinit var sickStatus: TextView
  private val SICK_OVERRIDE_DURATION_MS = 24L * 60L * 60L * 1000L

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLocaleFromPrefs()
    setContentView(R.layout.activity_insta_blocker)
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN

    val button = findViewById<Button>(R.id.blocker_button)
    button.setOnClickListener { goHome() }
    val openAppButton = findViewById<Button>(R.id.blocker_open_app)
    openAppButton.setOnClickListener { openApp() }
    creditSection = findViewById(R.id.blocker_credit_section)
    creditPicker = findViewById(R.id.blocker_credit_picker)
    creditButton = findViewById(R.id.blocker_credit_button)
    creditPenalty = findViewById(R.id.blocker_credit_penalty)
    creditLockNotice = findViewById(R.id.blocker_credit_lock_notice)
    sickButton = findViewById(R.id.blocker_sick_button)
    sickStatus = findViewById(R.id.blocker_sick_status)
    sickButton.setOnClickListener { activateSickMode() }
    updateCreditSection(true)
    updateSickSection()
  }

  override fun onBackPressed() {
    goHome()
  }

  private fun setupCreditControls() {
    creditSection.visibility = View.VISIBLE
    creditPicker.minValue = 1
    creditPicker.maxValue = 15
    creditPicker.wrapSelectorWheel = false
    creditPicker.value = creditPicker.minValue
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
    val penaltyPercent = CreditStore.computePenaltyPercentForMinutes(safeMinutes)
    Toast.makeText(
      this,
      getString(R.string.preface_credit_success, safeMinutes, penaltyPercent),
      Toast.LENGTH_SHORT
    ).show()
    goHome()
    finish()
  }

  override fun onResume() {
    super.onResume()
    updateSickSection()
  }

  private fun updateSickSection() {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val active = SickOverrideStore.isOverrideActive(prefs, now)
    sickStatus.visibility = if (active) {
      val until = SickOverrideStore.getOverrideUntil(prefs)
      sickStatus.text = getString(
        R.string.blocker_sick_status,
        formatLockExpiryLabel(until)
      )
      View.VISIBLE
    } else {
      View.GONE
    }
    sickButton.isEnabled = !active
  }

  private fun activateSickMode() {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val until = now + SICK_OVERRIDE_DURATION_MS
    SickOverrideStore.setOverrideUntil(prefs, until)
    Toast.makeText(
      this,
      getString(R.string.blocker_sick_success, formatLockExpiryLabel(until)),
      Toast.LENGTH_LONG
    ).show()
    goHome()
    finish()
  }

  private fun goHome() {
    val intent = Intent(Intent.ACTION_MAIN)
    intent.addCategory(Intent.CATEGORY_HOME)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
    startActivity(intent)
  }

  private fun openApp() {
    val intent = Intent(this, MainActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
    startActivity(intent)
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
