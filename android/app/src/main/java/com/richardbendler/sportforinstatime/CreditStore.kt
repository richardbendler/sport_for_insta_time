package com.richardbendler.sportforinstatime

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Borrowed screen time. Credits no longer penalize the user factors; they are
// limited per day by the user's settings and recorded for the statistics.
object CreditStore {
  private const val PREF_CREDIT_ENTRY_ID = "credit_entry_id"
  private const val PREF_CREDIT_MULTIPLIER = "credit_multiplier"
  private const val PREF_CREDIT_MINUTES = "credit_minutes"
  private const val PREF_CREDIT_LOCK_EXPIRES_AT = "credit_lock_expires_at"
  private const val PREF_CREDIT_ENABLED = "credit_enabled"
  private const val PREF_CREDIT_MINUTES_PER_CREDIT = "credit_minutes_per_credit"
  private const val PREF_CREDIT_MAX_PER_DAY = "credit_max_per_day"
  private const val PREF_CREDIT_HISTORY = "credit_history"
  private const val HISTORY_MAX_AGE_MS = 90L * 24L * 60L * 60L * 1000L
  const val DEFAULT_MINUTES_PER_CREDIT = 10
  const val DEFAULT_MAX_PER_DAY = 1

  data class CreditRecord(val ts: Long, val minutes: Int)

  fun setSettings(prefs: SharedPreferences, enabled: Boolean, minutes: Int, maxPerDay: Int) {
    prefs.edit()
      .putBoolean(PREF_CREDIT_ENABLED, enabled)
      .putInt(PREF_CREDIT_MINUTES_PER_CREDIT, minutes.coerceIn(1, 120))
      .putInt(PREF_CREDIT_MAX_PER_DAY, maxPerDay.coerceIn(1, 20))
      .apply()
  }

  fun isEnabled(prefs: SharedPreferences): Boolean =
    prefs.getBoolean(PREF_CREDIT_ENABLED, true)

  fun getMinutesPerCredit(prefs: SharedPreferences): Int =
    prefs.getInt(PREF_CREDIT_MINUTES_PER_CREDIT, DEFAULT_MINUTES_PER_CREDIT).coerceIn(1, 120)

  fun getMaxPerDay(prefs: SharedPreferences): Int =
    prefs.getInt(PREF_CREDIT_MAX_PER_DAY, DEFAULT_MAX_PER_DAY).coerceIn(1, 20)

  fun getHistory(prefs: SharedPreferences): List<CreditRecord> {
    val raw = prefs.getString(PREF_CREDIT_HISTORY, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        val obj = array.optJSONObject(index) ?: return@mapNotNull null
        val ts = obj.optLong("ts", 0L)
        val minutes = obj.optInt("minutes", 0)
        if (ts > 0L && minutes > 0) CreditRecord(ts, minutes) else null
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun getCreditsTakenToday(prefs: SharedPreferences, now: Long): Int {
    val today = dayKey(now)
    return getHistory(prefs).count { dayKey(it.ts) == today }
  }

  fun canTakeCredit(prefs: SharedPreferences, now: Long): Boolean =
    isEnabled(prefs) && getCreditsTakenToday(prefs, now) < getMaxPerDay(prefs)

  fun recordCredit(prefs: SharedPreferences, now: Long, minutes: Int) {
    val history = getHistory(prefs).filter { now - it.ts <= HISTORY_MAX_AGE_MS } +
      CreditRecord(now, minutes)
    val array = JSONArray()
    history.forEach { record ->
      array.put(JSONObject().put("ts", record.ts).put("minutes", record.minutes))
    }
    prefs.edit().putString(PREF_CREDIT_HISTORY, array.toString()).apply()
  }

  fun setCreditInfo(prefs: SharedPreferences, entryId: String, minutes: Int) {
    prefs.edit()
      .putString(PREF_CREDIT_ENTRY_ID, entryId)
      .putInt(PREF_CREDIT_MINUTES, minutes)
      .remove(PREF_CREDIT_MULTIPLIER)
      .apply()
  }

  fun clearCreditInfo(prefs: SharedPreferences) {
    prefs.edit()
      .remove(PREF_CREDIT_ENTRY_ID)
      .remove(PREF_CREDIT_MINUTES)
      .remove(PREF_CREDIT_MULTIPLIER)
      .apply()
  }

  fun getCreditEntryId(prefs: SharedPreferences): String? {
    val stored = prefs.getString(PREF_CREDIT_ENTRY_ID, null)
    return if (stored.isNullOrBlank()) null else stored
  }

  // Credits used to lower the earned screen time; that penalty is gone.
  fun getCreditMultiplier(prefs: SharedPreferences): Float = 1f

  // The former 24h factor lock no longer exists. Clear a stored value from
  // older versions so the app restores the user factors right away.
  fun getCreditLockExpiresAt(prefs: SharedPreferences, now: Long): Long {
    if (prefs.contains(PREF_CREDIT_LOCK_EXPIRES_AT)) {
      prefs.edit().remove(PREF_CREDIT_LOCK_EXPIRES_AT).apply()
    }
    return 0L
  }

  private fun dayKey(timestamp: Long): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(timestamp))
}
