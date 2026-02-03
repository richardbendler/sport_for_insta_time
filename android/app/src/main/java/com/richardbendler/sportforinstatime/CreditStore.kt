package com.richardbendler.sportforinstatime

import android.content.SharedPreferences
import kotlin.math.roundToInt

object CreditStore {
  private const val PREF_CREDIT_ENTRY_ID = "credit_entry_id"
  private const val PREF_CREDIT_MULTIPLIER = "credit_multiplier"
  private const val PREF_CREDIT_MINUTES = "credit_minutes"
  private const val PREF_CREDIT_LOCK_EXPIRES_AT = "credit_lock_expires_at"
  private const val CREDIT_LOCK_DURATION_MS = 3L * 24L * 60L * 60L * 1000L

  fun setCreditInfo(
    prefs: SharedPreferences,
    entryId: String,
    minutes: Int,
    multiplier: Float
  ) {
    prefs.edit()
      .putString(PREF_CREDIT_ENTRY_ID, entryId)
      .putInt(PREF_CREDIT_MINUTES, minutes)
      .putFloat(PREF_CREDIT_MULTIPLIER, multiplier)
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

  fun getCreditMultiplier(prefs: SharedPreferences): Float {
    return prefs.getFloat(PREF_CREDIT_MULTIPLIER, 1f)
  }

  fun getCreditMinutes(prefs: SharedPreferences): Int {
    return prefs.getInt(PREF_CREDIT_MINUTES, 0)
  }

  fun computeCreditMultiplier(totalSeconds: Int): Float {
    return if (totalSeconds <= 0) 1f else 0.8f
  }

  fun computePenaltyPercentForMinutes(minutes: Int): Int {
    return if (minutes <= 0) 0 else 20
  }

  fun scheduleCreditLock(prefs: SharedPreferences, now: Long) {
    prefs.edit()
      .putLong(PREF_CREDIT_LOCK_EXPIRES_AT, now + CREDIT_LOCK_DURATION_MS)
      .apply()
  }

  fun getCreditLockExpiresAt(prefs: SharedPreferences, now: Long): Long {
    val stored = prefs.getLong(PREF_CREDIT_LOCK_EXPIRES_AT, 0L)
    if (stored <= now) {
      if (stored != 0L) {
        prefs.edit().remove(PREF_CREDIT_LOCK_EXPIRES_AT).apply()
      }
      return 0L
    }
    return stored
  }
}
