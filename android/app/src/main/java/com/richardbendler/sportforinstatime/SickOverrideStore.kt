package com.richardbendler.sportforinstatime

import android.content.SharedPreferences

object SickOverrideStore {
  private const val PREF_KEY_SICK_OVERRIDE_UNTIL = "sick_override_until"

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
}
