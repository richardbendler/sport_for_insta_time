package com.richardbendler.sportforinstatime

import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var mainContent: View
  private lateinit var successContent: View
  private lateinit var successTitle: TextView
  private lateinit var successMessage: TextView
  private lateinit var successContinueButton: Button
  private lateinit var creditSection: View
  private lateinit var creditButton: Button
  private lateinit var creditPenalty: TextView
  private lateinit var creditLockNotice: TextView
  private lateinit var sickSection: View
  private lateinit var sickButton: Button
  private lateinit var sickStatus: TextView
  private var targetPackage: String? = null
  private var pendingContinuePackage: String? = null
  private val CREDIT_MINUTES = 10
  private val SICK_OVERRIDE_DURATION_MS = 24L * 60L * 60L * 1000L
  private val SICK_MODE_ID = "sick_mode"
  private val SICK_QUESTION_HISTORY_KEY = "sick_question_history"
  private val autoContinueTicker = object : Runnable {
    override fun run() {
      if (canContinueToBlockedApp()) {
        continueToBlockedApp()
        return
      }
      handler.postDelayed(this, 1000)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLocaleFromPrefs()
    setContentView(R.layout.activity_insta_blocker)
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN
    targetPackage = intent.getStringExtra("target_package")

    val button = findViewById<Button>(R.id.blocker_button)
    button.setOnClickListener { goHome() }
    val openAppButton = findViewById<Button>(R.id.blocker_open_app)
    openAppButton.setOnClickListener { openApp() }
    mainContent = findViewById(R.id.blocker_main_content)
    successContent = findViewById(R.id.blocker_success_content)
    successTitle = findViewById(R.id.blocker_success_title)
    successMessage = findViewById(R.id.blocker_success_message)
    successContinueButton = findViewById(R.id.blocker_success_continue_button)
    successContinueButton.setOnClickListener { continueToBlockedApp() }
    creditSection = findViewById(R.id.blocker_credit_section)
    creditButton = findViewById(R.id.blocker_credit_button)
    creditPenalty = findViewById(R.id.blocker_credit_penalty)
    creditLockNotice = findViewById(R.id.blocker_credit_lock_notice)
    creditButton.setOnClickListener { showCreditWarningDialog() }
    sickSection = findViewById(R.id.blocker_sick_section)
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

  private fun showCreditWarningDialog() {
    AlertDialog.Builder(this)
      .setTitle(getString(R.string.preface_credit_warning_title))
      .setMessage(getString(R.string.preface_credit_warning_body))
      .setNegativeButton(getString(R.string.preface_credit_warning_cancel), null)
      .setPositiveButton(getString(R.string.preface_credit_warning_confirm)) { _, _ ->
        grantCredit()
      }
      .show()
  }

  private fun grantCredit() {
    val safeMinutes = CREDIT_MINUTES
    val totalSeconds = safeMinutes * 60
    val entryId = "credit_${System.currentTimeMillis()}"
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val lockExpiresAt = CreditStore.getCreditLockExpiresAt(prefs, now)
    if (lockExpiresAt > now) {
      showCreditLocked(lockExpiresAt)
      return
    }
    ScreenTimeStore.upsertEntry(prefs, entryId, null, now, totalSeconds)
    val multiplier = CreditStore.computeCreditMultiplier(totalSeconds)
    CreditStore.setCreditInfo(prefs, entryId, safeMinutes, multiplier)
    CreditStore.scheduleCreditLock(prefs, now)
    val penaltyPercent = CreditStore.computePenaltyPercentForMinutes(safeMinutes)
    showSuccessScreen(
      getString(R.string.blocker_success_credit_title),
      getString(R.string.preface_credit_success, safeMinutes, penaltyPercent)
    )
  }

  override fun onResume() {
    super.onResume()
    updateSickSection()
    if (canContinueToBlockedApp()) {
      continueToBlockedApp()
    } else {
      handler.postDelayed(autoContinueTicker, 1000)
    }
  }

  override fun onPause() {
    super.onPause()
    handler.removeCallbacks(autoContinueTicker)
  }

  override fun onDestroy() {
    super.onDestroy()
    handler.removeCallbacks(autoContinueTicker)
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
    showSuccessScreen(
      getString(R.string.blocker_success_sick_title),
      getString(R.string.blocker_sick_success, SickOverrideStore.getDailyLimitMinutes(prefs))
    )
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
    val dialog = AlertDialog.Builder(this)
      .setTitle(R.string.blocker_sick_question_title)
      .setView(dialogView)
      .setPositiveButton(R.string.blocker_sick_question_submit, null)
      .setNegativeButton(android.R.string.cancel, null)
      .create()
    dialog.setOnShowListener {
      val submitButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
      submitButton.setOnClickListener {
        val reason = reasonInput.text?.toString()?.trim().orEmpty()
        val note = noteInput.text?.toString()?.trim().orEmpty()
        val severitySelected = severitySpinner.selectedItemPosition > 0

        reasonInput.error = if (reason.isBlank()) {
          getString(R.string.blocker_sick_question_required_field)
        } else {
          null
        }
        noteInput.error = if (note.isBlank()) {
          getString(R.string.blocker_sick_question_required_field)
        } else {
          null
        }

        if (reason.isBlank() || note.isBlank() || !severitySelected) {
          Toast.makeText(
            this,
            getString(R.string.blocker_sick_question_required_all),
            Toast.LENGTH_SHORT
          ).show()
          return@setOnClickListener
        }

        val severity = severitySpinner.selectedItem?.toString().orEmpty()
        logSickQuestion(prefs, reason, severity, note, System.currentTimeMillis())
        activateSickMode()
        dialog.dismiss()
      }
    }
    dialog.show()
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

  private fun showSuccessScreen(title: String, message: String) {
    pendingContinuePackage = targetPackage
    successTitle.text = title
    successMessage.text = message
    mainContent.visibility = View.GONE
    creditSection.visibility = View.GONE
    sickSection.visibility = View.GONE
    sickStatus.visibility = View.GONE
    successContent.visibility = View.VISIBLE
  }

  private fun continueToBlockedApp() {
    val pkg = pendingContinuePackage ?: targetPackage
    if (!pkg.isNullOrBlank()) {
      val launchIntent = packageManager.getLaunchIntentForPackage(pkg)
      if (launchIntent != null) {
        getSharedPreferences("insta_control", MODE_PRIVATE)
          .edit()
          .putString("preface_allow_package", pkg)
          .putLong("preface_allow_until", System.currentTimeMillis() + 60000L)
          .apply()
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(launchIntent)
        finish()
        return
      }
    }
    openApp()
    finish()
  }

  private fun canContinueToBlockedApp(): Boolean {
    if (::successContent.isInitialized && successContent.visibility == View.VISIBLE) {
      return false
    }
    val pkg = pendingContinuePackage ?: targetPackage
    if (pkg.isNullOrBlank()) {
      return false
    }
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val now = System.currentTimeMillis()
    if (SickOverrideStore.isOverrideActive(prefs, now)) {
      return true
    }
    return ScreenTimeStore.getTotals(prefs, now).remainingSeconds > 0
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
