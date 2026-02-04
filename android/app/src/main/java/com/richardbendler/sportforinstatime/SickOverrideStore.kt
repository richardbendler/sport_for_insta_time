package com.richardbendler.sportforinstatime

import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SickOverrideStore {
  private const val PREF_KEY_SICK_OVERRIDE_UNTIL = "sick_override_until"
  private const val PREF_KEY_SICK_ACTIVATION_LOCK_UNTIL = "sick_activation_lock_until"
  private const val PREF_KEY_SICK_DAILY_LIMIT_MINUTES = "sick_daily_limit_minutes"
  private const val PREF_KEY_SICK_USED_SECONDS = "sick_used_seconds"
  private const val PREF_KEY_SICK_USED_DAY = "sick_used_day"
  private const val DAY_FORMAT = "yyyy-MM-dd"
  const val DEFAULT_SICK_DAILY_LIMIT_MINUTES = 30
  private const val SICK_ACTIVATION_COOLDOWN_MS = 24L * 60L * 60L * 1000L

  fun setOverrideUntil(prefs: SharedPreferences, until: Long) {
    prefs.edit()
      .putLong(PREF_KEY_SICK_OVERRIDE_UNTIL, until.coerceAtLeast(0L))
      .apply()
  }

  fun clearOverride(prefs: SharedPreferences) {
    prefs.edit()
      .remove(PREF_KEY_SICK_OVERRIDE_UNTIL)
      .apply()
  }

  fun setDailyLimitMinutes(prefs: SharedPreferences, minutes: Int) {
    prefs.edit()
      .putInt(PREF_KEY_SICK_DAILY_LIMIT_MINUTES, minutes.coerceAtLeast(0))
      .apply()
  }

  fun scheduleActivationCooldown(prefs: SharedPreferences, now: Long) {
    prefs.edit()
      .putLong(PREF_KEY_SICK_ACTIVATION_LOCK_UNTIL, now + SICK_ACTIVATION_COOLDOWN_MS)
      .apply()
  }

  fun getDailyLimitMinutes(prefs: SharedPreferences): Int {
    return prefs.getInt(PREF_KEY_SICK_DAILY_LIMIT_MINUTES, DEFAULT_SICK_DAILY_LIMIT_MINUTES)
  }

  fun addUsedSeconds(prefs: SharedPreferences, now: Long, delta: Int): Int {
    if (delta <= 0) {
      return getUsedSeconds(prefs, now)
    }
    resetDailyUsageIfNeeded(prefs, now)
    val current = prefs.getInt(PREF_KEY_SICK_USED_SECONDS, 0)
    val next = current + delta
    prefs.edit()
      .putInt(PREF_KEY_SICK_USED_SECONDS, next)
      .putString(PREF_KEY_SICK_USED_DAY, todayKey(now))
      .apply()
    return next
  }

  fun getUsedSeconds(prefs: SharedPreferences, now: Long): Int {
    resetDailyUsageIfNeeded(prefs, now)
    return prefs.getInt(PREF_KEY_SICK_USED_SECONDS, 0)
  }

  fun isDailyLimitReached(prefs: SharedPreferences, now: Long): Boolean {
    val limitMinutes = getDailyLimitMinutes(prefs)
    if (limitMinutes <= 0) {
      return false
    }
    return getUsedSeconds(prefs, now) >= limitMinutes * 60
  }

  fun getOverrideUntil(prefs: SharedPreferences): Long {
    return prefs.getLong(PREF_KEY_SICK_OVERRIDE_UNTIL, 0L)
  }

  fun isOverrideActive(prefs: SharedPreferences, now: Long): Boolean {
    val until = getOverrideUntil(prefs)
    if (until <= now) {
      if (until != 0L) {
        prefs.edit().remove(PREF_KEY_SICK_OVERRIDE_UNTIL).apply()
      }
      return false
    }
    return true
  }

  fun getActivationCooldownUntil(prefs: SharedPreferences, now: Long): Long {
    val stored = prefs.getLong(PREF_KEY_SICK_ACTIVATION_LOCK_UNTIL, 0L)
    if (stored <= now) {
      if (stored != 0L) {
        prefs.edit().remove(PREF_KEY_SICK_ACTIVATION_LOCK_UNTIL).apply()
      }
      return 0L
    }
    return stored
  }

  private fun resetDailyUsageIfNeeded(prefs: SharedPreferences, now: Long) {
    val currentDay = todayKey(now)
    val storedDay = prefs.getString(PREF_KEY_SICK_USED_DAY, "") ?: ""
    if (storedDay != currentDay) {
      prefs.edit()
        .putInt(PREF_KEY_SICK_USED_SECONDS, 0)
        .putString(PREF_KEY_SICK_USED_DAY, currentDay)
        .apply()
    }
  }

  private fun todayKey(now: Long): String {
    val formatter = SimpleDateFormat(DAY_FORMAT, Locale.US)
    return formatter.format(Date(now))
  }
}
