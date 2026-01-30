package com.richardbendler.sportforinstatime

import android.content.SharedPreferences
import kotlin.math.roundToInt

object CreditStore {
  private const val PREF_CREDIT_ENTRY_ID = "credit_entry_id"
  private const val PREF_CREDIT_MULTIPLIER = "credit_multiplier"
  private const val PREF_CREDIT_MINUTES = "credit_minutes"

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
    if (totalSeconds <= 0) {
      return 1f
    }
    val minutes = (totalSeconds / 60f).coerceAtLeast(1f)
    val normalized = (minutes / 15f).coerceAtMost(1f)
    val multiplier = 1f - 0.2f * normalized
    return multiplier.coerceIn(0.7f, 1f)
  }

  fun computePenaltyPercentForMinutes(minutes: Int): Int {
    val capped = minutes.coerceIn(1, 15)
    val normalized = capped / 15f
    return (0.2f * normalized * 100f).roundToInt()
  }
}
