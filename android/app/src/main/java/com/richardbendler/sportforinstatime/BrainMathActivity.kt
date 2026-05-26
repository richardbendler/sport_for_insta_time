package com.richardbendler.sportforinstatime

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.content.Context
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random

class BrainMathActivity : AppCompatActivity() {
  private lateinit var questionText: TextView
  private lateinit var rangeText: TextView
  private lateinit var statusText: TextView
  private lateinit var feedbackText: TextView
  private lateinit var answerInput: EditText
  private lateinit var submitButton: Button
  private lateinit var continueButton: Button
  private lateinit var backButton: Button
  private var targetPackage: String? = null
  private var expectedAnswer = 0
  private var taskStartedAt = 0L
  private var solvedCount = 0
  private var grantedThisSession = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLocaleFromPrefs()
    setContentView(R.layout.activity_brain_math)
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN
    targetPackage = intent.getStringExtra("target_package")

    questionText = findViewById(R.id.brain_question)
    rangeText = findViewById(R.id.brain_range)
    statusText = findViewById(R.id.brain_status)
    feedbackText = findViewById(R.id.brain_feedback)
    answerInput = findViewById(R.id.brain_answer)
    submitButton = findViewById(R.id.brain_submit)
    continueButton = findViewById(R.id.brain_continue_button)
    backButton = findViewById(R.id.brain_back_button)

    submitButton.setOnClickListener { submitAnswer() }
    answerInput.setOnEditorActionListener { _, actionId, _ ->
      if (actionId == EditorInfo.IME_ACTION_DONE) {
        submitAnswer()
        true
      } else {
        false
      }
    }
    continueButton.setOnClickListener { continueToBlockedApp() }
    backButton.setOnClickListener { finish() }

    updateStatus()
    nextTask()
  }

  private fun submitAnswer() {
    val raw = answerInput.text?.toString()?.trim().orEmpty()
    val answer = raw.toIntOrNull()
    if (answer == null) {
      answerInput.error = getString(R.string.brain_answer_required)
      return
    }
    if (answer != expectedAnswer) {
      feedbackText.text = getString(R.string.brain_wrong_answer)
      feedbackText.setTextColor(0xffffb4b4.toInt())
      return
    }

    val now = System.currentTimeMillis()
    val elapsedMillis = (now - taskStartedAt).coerceAtLeast(0L)
    val rewardSeconds = rewardForElapsedMillis(elapsedMillis)
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val usedToday = getUsedSecondsToday(prefs, now)
    val remainingDaily = (DAILY_CAP_SECONDS - usedToday).coerceAtLeast(0)
    val grantedSeconds = rewardSeconds.coerceAtMost(remainingDaily)

    if (grantedSeconds > 0) {
      val entryId = "brain_math_$now"
      ScreenTimeStore.upsertEntry(prefs, entryId, BRAIN_SPORT_ID, now, grantedSeconds)
      setUsedSecondsToday(prefs, now, usedToday + grantedSeconds)
      OverallWidgetProvider.refreshAll(this)
      grantedThisSession += grantedSeconds
    }

    solvedCount += 1
    val elapsedLabel = String.format(Locale.getDefault(), "%.1f", elapsedMillis / 1000.0)
    feedbackText.text = if (grantedSeconds > 0) {
      getString(R.string.brain_correct_feedback, elapsedLabel, grantedSeconds)
    } else {
      getString(R.string.brain_limit_reached_feedback)
    }
    feedbackText.setTextColor(0xff86efac.toInt())
    updateStatus()

    if (getUsedSecondsToday(prefs, now) >= DAILY_CAP_SECONDS) {
      submitButton.isEnabled = false
      answerInput.isEnabled = false
      continueButton.visibility = View.VISIBLE
      hideKeyboard()
      return
    }
    continueButton.visibility = View.VISIBLE
    nextTask()
  }

  private fun nextTask() {
    val task = generateTask()
    expectedAnswer = task.answer
    questionText.text = task.question
    rangeText.text = getString(R.string.brain_range_label, task.rangeLabel)
    answerInput.text?.clear()
    answerInput.requestFocus()
    taskStartedAt = System.currentTimeMillis()
  }

  private fun updateStatus() {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val usedSeconds = getUsedSecondsToday(prefs, now)
    val remainingSeconds = (DAILY_CAP_SECONDS - usedSeconds).coerceAtLeast(0)
    statusText.text = getString(
      R.string.brain_status,
      grantedThisSession / 60,
      (remainingSeconds + 59) / 60,
      solvedCount
    )
  }

  private fun rewardForElapsedMillis(elapsedMillis: Long): Int {
    val seconds = elapsedMillis / 1000.0
    return when {
      seconds <= 3.0 -> 45
      seconds <= 6.0 -> 30
      seconds <= 10.0 -> 20
      seconds <= 15.0 -> 12
      seconds <= 25.0 -> 8
      else -> 5
    }
  }

  private fun generateTask(): Task {
    return when (Random.nextInt(3)) {
      0 -> generateHundredsTask()
      1 -> generateThousandsTask()
      else -> generateTenThousandsTask()
    }
  }

  private fun generateHundredsTask(): Task {
    return when (Random.nextInt(3)) {
      0 -> {
        val a = Random.nextInt(12, 96)
        val b = Random.nextInt(7, 89)
        Task("$a + $b", a + b, getString(R.string.brain_range_hundreds))
      }
      1 -> {
        val a = Random.nextInt(30, 160)
        val b = Random.nextInt(8, a)
        Task("$a - $b", a - b, getString(R.string.brain_range_hundreds))
      }
      else -> {
        val a = Random.nextInt(4, 13)
        val b = Random.nextInt(3, 13)
        Task("$a x $b", a * b, getString(R.string.brain_range_hundreds))
      }
    }
  }

  private fun generateThousandsTask(): Task {
    return when (Random.nextInt(3)) {
      0 -> {
        val a = Random.nextInt(120, 950)
        val b = Random.nextInt(80, 900)
        Task("$a + $b", a + b, getString(R.string.brain_range_thousands))
      }
      1 -> {
        val a = Random.nextInt(300, 1900)
        val b = Random.nextInt(80, a)
        Task("$a - $b", a - b, getString(R.string.brain_range_thousands))
      }
      else -> {
        val a = Random.nextInt(18, 99)
        val b = Random.nextInt(3, 10)
        Task("$a x $b", a * b, getString(R.string.brain_range_thousands))
      }
    }
  }

  private fun generateTenThousandsTask(): Task {
    return if (Random.nextBoolean()) {
      val a = Random.nextInt(1200, 9400)
      val b = Random.nextInt(700, 8700)
      Task("$a + $b", a + b, getString(R.string.brain_range_ten_thousands))
    } else {
      val a = Random.nextInt(2600, 18000)
      val b = Random.nextInt(900, a)
      Task("$a - $b", a - b, getString(R.string.brain_range_ten_thousands))
    }
  }

  private fun continueToBlockedApp() {
    val pkg = targetPackage
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
    finish()
  }

  private fun hideKeyboard() {
    val manager = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    manager?.hideSoftInputFromWindow(answerInput.windowToken, 0)
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

  private data class Task(
    val question: String,
    val answer: Int,
    val rangeLabel: String
  )

  companion object {
    const val DAILY_CAP_SECONDS = 30 * 60
    const val BRAIN_SPORT_ID = "brain_math"
    private const val PREF_BRAIN_USED_SECONDS = "brain_math_used_seconds"
    private const val PREF_BRAIN_USED_DAY = "brain_math_used_day"

    fun getUsedSecondsToday(prefs: SharedPreferences, now: Long): Int {
      ensureToday(prefs, now)
      return prefs.getInt(PREF_BRAIN_USED_SECONDS, 0)
    }

    private fun setUsedSecondsToday(prefs: SharedPreferences, now: Long, seconds: Int) {
      prefs.edit()
        .putString(PREF_BRAIN_USED_DAY, todayKey(now))
        .putInt(PREF_BRAIN_USED_SECONDS, seconds.coerceIn(0, DAILY_CAP_SECONDS))
        .apply()
    }

    private fun ensureToday(prefs: SharedPreferences, now: Long) {
      val today = todayKey(now)
      val storedDay = prefs.getString(PREF_BRAIN_USED_DAY, "") ?: ""
      if (storedDay != today) {
        prefs.edit()
          .putString(PREF_BRAIN_USED_DAY, today)
          .putInt(PREF_BRAIN_USED_SECONDS, 0)
          .apply()
      }
    }

    private fun todayKey(now: Long): String {
      val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
      return formatter.format(Date(now))
    }
  }
}
