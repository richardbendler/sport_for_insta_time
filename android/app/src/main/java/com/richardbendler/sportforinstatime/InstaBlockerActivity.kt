package com.richardbendler.sportforinstatime

import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class InstaBlockerActivity : AppCompatActivity() {
  private lateinit var creditSection: View
  private lateinit var creditButton: Button
  private lateinit var creditPenalty: TextView
  private lateinit var creditLockNotice: TextView
  private lateinit var sickButton: Button
  private lateinit var sickStatus: TextView
  private val CREDIT_MINUTES = 10
  private val SICK_OVERRIDE_DURATION_MS = 24L * 60L * 60L * 1000L
  private val SICK_MODE_ID = "sick_mode"
  private val SICK_QUESTION_HISTORY_KEY = "sick_question_history"

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
    creditButton = findViewById(R.id.blocker_credit_button)
    creditPenalty = findViewById(R.id.blocker_credit_penalty)
    creditLockNotice = findViewById(R.id.blocker_credit_lock_notice)
    creditButton.setOnClickListener { grantCredit() }
    sickButton = findViewById(R.id.blocker_sick_button)
    sickStatus = findViewById(R.id.blocker_sick_status)
    sickButton.setOnClickListener { showSickQuestionDialog() }
    updateCreditSection(true)
    updateSickSection()
  }

  override fun onBackPressed() {
    goHome()
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
    creditButton.visibility = View.VISIBLE
    creditPenalty.visibility = View.VISIBLE
    creditSection.visibility = View.VISIBLE
    creditButton.isEnabled = true
    updateCreditPenaltyText(CREDIT_MINUTES)
  }

  private fun showCreditLocked(lockExpiresAt: Long) {
    creditSection.visibility = View.VISIBLE
    creditLockNotice.visibility = View.VISIBLE
    creditButton.visibility = View.VISIBLE
    creditButton.isEnabled = false
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

  private fun sickEntryIdForTimestamp(timestamp: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val day = formatter.format(Date(timestamp))
    return "${SICK_MODE_ID}_$day"
  }

  private fun creditSickModeMinutes(prefs: SharedPreferences, now: Long) {
    val limitMinutes = SickOverrideStore.getDailyLimitMinutes(prefs)
    if (limitMinutes <= 0) {
      return
    }
    val totalSeconds = limitMinutes * 60
    val entryId = sickEntryIdForTimestamp(now)
    ScreenTimeStore.upsertEntry(prefs, entryId, SICK_MODE_ID, now, totalSeconds)
    OverallWidgetProvider.refreshAll(this)
  }

  private fun updateCreditPenaltyText(minutes: Int) {
    val penaltyPercent = CreditStore.computePenaltyPercentForMinutes(minutes)
    creditPenalty.text = getString(R.string.preface_credit_penalty, penaltyPercent)
  }

  private fun grantCredit() {
    val safeMinutes = CREDIT_MINUTES
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
    val lockedUntil = SickOverrideStore.getActivationCooldownUntil(prefs, now)
    val locked = lockedUntil > now
    val limitMinutes = SickOverrideStore.getDailyLimitMinutes(prefs).coerceAtLeast(0)
    sickStatus.visibility = when {
      active -> {
        sickStatus.text = getString(
          R.string.blocker_sick_status,
          limitMinutes
        )
        View.VISIBLE
      }
      locked -> {
        sickStatus.text = getString(
          R.string.blocker_sick_locked_status,
          formatLockExpiryLabel(lockedUntil)
        )
        View.VISIBLE
      }
      else -> View.GONE
    }
    sickButton.isEnabled = !active && !locked
  }

  private fun activateSickMode() {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val lockedUntil = SickOverrideStore.getActivationCooldownUntil(prefs, now)
    if (lockedUntil > now) {
      Toast.makeText(
        this,
        getString(
          R.string.blocker_sick_locked_status,
          formatLockExpiryLabel(lockedUntil)
        ),
        Toast.LENGTH_SHORT
      ).show()
      return
    }
    if (SickOverrideStore.isOverrideActive(prefs, now)) {
      return
    }
    val until = now + SICK_OVERRIDE_DURATION_MS
    SickOverrideStore.setOverrideUntil(prefs, until)
    SickOverrideStore.scheduleActivationCooldown(prefs, now)
    creditSickModeMinutes(prefs, now)
    Toast.makeText(
      this,
      getString(R.string.blocker_sick_success, SickOverrideStore.getDailyLimitMinutes(prefs)),
      Toast.LENGTH_LONG
    ).show()
    goHome()
    finish()
  }

  private fun showSickQuestionDialog() {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val dialogView = layoutInflater.inflate(R.layout.dialog_sick_questions, null)
    val reasonInput = dialogView.findViewById<EditText>(R.id.sick_question_reason)
    val severitySpinner = dialogView.findViewById<Spinner>(R.id.sick_question_severity)
    val noteInput = dialogView.findViewById<EditText>(R.id.sick_question_note)
    val adapter = ArrayAdapter.createFromResource(
      this,
      R.array.blocker_sick_severity_options,
      android.R.layout.simple_spinner_item
    )
    adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
    severitySpinner.adapter = adapter
    AlertDialog.Builder(this)
      .setTitle(R.string.blocker_sick_question_title)
      .setView(dialogView)
      .setPositiveButton(R.string.blocker_sick_question_submit) { _, _ ->
        val reason = reasonInput.text?.toString()?.trim().orEmpty()
        val severity = severitySpinner.selectedItem?.toString().orEmpty()
        val note = noteInput.text?.toString()?.trim().orEmpty()
        logSickQuestion(prefs, reason, severity, note, System.currentTimeMillis())
        activateSickMode()
      }
      .setNegativeButton(android.R.string.cancel, null)
      .show()
  }

  private fun logSickQuestion(
    prefs: SharedPreferences,
    reason: String,
    severity: String,
    note: String,
    timestamp: Long
  ) {
    val history = try {
      JSONArray(prefs.getString(SICK_QUESTION_HISTORY_KEY, "[]"))
    } catch (error: JSONException) {
      JSONArray()
    }
    val entry = JSONObject()
    entry.put("timestamp", timestamp)
    entry.put("reason", reason)
    entry.put("severity", severity)
    entry.put("note", note)
    history.put(entry)
    while (history.length() > 20) {
      history.remove(0)
    }
    prefs.edit().putString(SICK_QUESTION_HISTORY_KEY, history.toString()).apply()
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
