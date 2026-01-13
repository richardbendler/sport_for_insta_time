package com.richardbendler.sportforinstatime

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object ScreenTimeStore {
  private const val PREF_KEY_ENTRIES = "screen_time_entries"
  private const val PREF_KEY_USED = "used_seconds"
  private const val PREF_KEY_LAST_DAY = "last_day"
  private const val PREF_KEY_LEGACY_ALLOWANCE = "allowance_seconds"
  private const val DAY_MS = 24L * 60L * 60L * 1000L

  data class Entry(
    val id: String,
    val sportId: String?,
    val createdAt: Long,
    var remainingSeconds: Int,
    var lastDecayAt: Long,
    var originalSeconds: Int
  )

  data class Totals(
    val remainingSeconds: Int,
    val remainingBySport: Map<String, Int>,
    val entryCount: Int
  )

  data class ConsumptionResult(
    val remainingSeconds: Int,
    val consumedSeconds: Int
  )

  fun upsertEntry(
    prefs: SharedPreferences,
    entryId: String,
    sportId: String?,
    createdAt: Long,
    totalSeconds: Int
  ) {
    val safeSeconds = if (totalSeconds < 0) 0 else totalSeconds
    val now = System.currentTimeMillis()
    val entries = loadEntries(prefs)
    val changedByDecay = applyDecay(entries, now)
    val existing = entries.find { it.id == entryId }
    var changed = changedByDecay
    if (safeSeconds <= 0) {
      if (existing != null) {
        entries.remove(existing)
        changed = true
      }
      if (changed) {
        saveEntries(prefs, entries)
      }
      return
    }
    if (existing != null) {
      existing.originalSeconds = safeSeconds
      if (existing.remainingSeconds > safeSeconds) {
        existing.remainingSeconds = safeSeconds
      }
      changed = true
    } else {
      entries.add(
        Entry(
          id = entryId,
          sportId = sportId,
          createdAt = createdAt,
          remainingSeconds = safeSeconds,
          lastDecayAt = createdAt,
          originalSeconds = safeSeconds
        )
      )
      changed = true
    }
    if (changed) {
      saveEntries(prefs, entries)
    }
  }

  fun removeEntry(prefs: SharedPreferences, entryId: String) {
    val entries = loadEntries(prefs)
    val existing = entries.find { it.id == entryId } ?: return
    entries.remove(existing)
    saveEntries(prefs, entries)
  }

  fun clearAllEntries(prefs: SharedPreferences) {
    prefs.edit()
      .remove(PREF_KEY_ENTRIES)
      .putInt(PREF_KEY_LEGACY_ALLOWANCE, 0)
      .apply()
  }

  fun clearEntriesForSport(prefs: SharedPreferences, sportId: String) {
    val entries = loadEntries(prefs)
    val filtered = entries.filter { it.sportId != sportId }
    if (filtered.size == entries.size) {
      return
    }
    saveEntries(prefs, filtered)
  }

  fun getTotals(prefs: SharedPreferences, now: Long): Totals {
    val entries = ensureLegacyMigration(loadEntries(prefs), prefs, now)
    val changed = applyDecay(entries, now)
    val cleaned = entries.filter { it.remainingSeconds > 0 }
    val remainingBySport = mutableMapOf<String, Int>()
    var total = 0
    cleaned.forEach { entry ->
      total += entry.remainingSeconds
      val sportKey = entry.sportId
      if (!sportKey.isNullOrBlank()) {
        remainingBySport[sportKey] = (remainingBySport[sportKey] ?: 0) + entry.remainingSeconds
      }
    }
    if (changed || cleaned.size != entries.size) {
      saveEntries(prefs, cleaned)
    }
    return Totals(total, remainingBySport, cleaned.size)
  }

  fun consumeSeconds(prefs: SharedPreferences, now: Long, seconds: Int): ConsumptionResult {
    if (seconds <= 0) {
      val totals = getTotals(prefs, now)
      return ConsumptionResult(totals.remainingSeconds, 0)
    }
    val entries = ensureLegacyMigration(loadEntries(prefs), prefs, now)
    var changed = applyDecay(entries, now)
    val sorted = entries.sortedBy { it.createdAt }.toMutableList()
    var remainingToConsume = seconds
    for (entry in sorted) {
      if (remainingToConsume <= 0) {
        break
      }
      val available = entry.remainingSeconds
      if (available <= 0) {
        continue
      }
      val used = if (available <= remainingToConsume) available else remainingToConsume
      entry.remainingSeconds = available - used
      remainingToConsume -= used
      changed = true
    }
    val cleaned = sorted.filter { it.remainingSeconds > 0 }
    if (changed || cleaned.size != entries.size) {
      saveEntries(prefs, cleaned)
    }
    val totalRemaining = cleaned.sumOf { it.remainingSeconds }
    val consumed = seconds - remainingToConsume
    return ConsumptionResult(totalRemaining, consumed)
  }

  fun getUsedSecondsToday(prefs: SharedPreferences, now: Long): Int {
    val today = todayKey(now)
    val lastDay = prefs.getString(PREF_KEY_LAST_DAY, "") ?: ""
    var used = prefs.getInt(PREF_KEY_USED, 0)
    if (lastDay != today) {
      used = 0
      prefs.edit().putInt(PREF_KEY_USED, 0).putString(PREF_KEY_LAST_DAY, today).apply()
    }
    return used
  }

  fun addUsedSeconds(prefs: SharedPreferences, now: Long, delta: Int): Int {
    val current = getUsedSecondsToday(prefs, now)
    val next = (current + delta).coerceAtLeast(0)
    prefs.edit().putInt(PREF_KEY_USED, next).apply()
    return next
  }

  private fun loadEntries(prefs: SharedPreferences): MutableList<Entry> {
    val raw = prefs.getString(PREF_KEY_ENTRIES, null) ?: return mutableListOf()
    val array = try {
      JSONArray(raw)
    } catch (e: Exception) {
      return mutableListOf()
    }
    val entries = mutableListOf<Entry>()
    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      val parsed = parseEntry(obj) ?: continue
      entries.add(parsed)
    }
    return entries
  }

  private fun ensureLegacyMigration(
    entries: MutableList<Entry>,
    prefs: SharedPreferences,
    now: Long
  ): MutableList<Entry> {
    if (entries.isNotEmpty()) {
      return entries
    }
    val allowance = prefs.getInt(PREF_KEY_LEGACY_ALLOWANCE, 0)
    if (allowance <= 0) {
      return entries
    }
    val used = getUsedSecondsToday(prefs, now)
    val remaining = (allowance - used).coerceAtLeast(0)
    if (remaining <= 0) {
      prefs.edit().putInt(PREF_KEY_LEGACY_ALLOWANCE, 0).apply()
      return entries
    }
    entries.add(
      Entry(
        id = "legacy_$now",
        sportId = null,
        createdAt = now,
        remainingSeconds = remaining,
        lastDecayAt = now,
        originalSeconds = remaining
      )
    )
    saveEntries(prefs, entries)
    prefs.edit().putInt(PREF_KEY_LEGACY_ALLOWANCE, 0).apply()
    return entries
  }

  private fun saveEntries(prefs: SharedPreferences, entries: List<Entry>) {
    val array = JSONArray()
    entries.forEach { entry ->
      val obj = JSONObject()
      obj.put("id", entry.id)
      obj.put("sportId", entry.sportId ?: "")
      obj.put("createdAt", entry.createdAt)
      obj.put("remainingSeconds", entry.remainingSeconds)
      obj.put("lastDecayAt", entry.lastDecayAt)
      obj.put("originalSeconds", entry.originalSeconds)
      array.put(obj)
    }
    prefs.edit().putString(PREF_KEY_ENTRIES, array.toString()).apply()
  }

  private fun parseEntry(obj: JSONObject): Entry? {
    val id = obj.optString("id", "")
    if (id.isBlank()) {
      return null
    }
    val sportId = obj.optString("sportId", "")
    val createdAt = obj.optLong("createdAt", 0L)
    val remaining = obj.optInt("remainingSeconds", 0)
    val lastDecay = obj.optLong("lastDecayAt", createdAt)
    val original = obj.optInt("originalSeconds", remaining)
    return Entry(
      id = id,
      sportId = if (sportId.isBlank()) null else sportId,
      createdAt = createdAt,
      remainingSeconds = remaining,
      lastDecayAt = lastDecay,
      originalSeconds = original
    )
  }

  private fun applyDecay(entries: MutableList<Entry>, now: Long): Boolean {
    var changed = false
    val iterator = entries.iterator()
    while (iterator.hasNext()) {
      val entry = iterator.next()
      val elapsed = now - entry.lastDecayAt
      if (elapsed >= DAY_MS) {
        val steps = (elapsed / DAY_MS).toInt()
        val maxShift = 30
        val shift = if (steps > maxShift) maxShift else steps
        val divisor = 1 shl shift
        var remaining = entry.remainingSeconds
        remaining = if (steps > maxShift) 0 else remaining / divisor
        entry.remainingSeconds = remaining
        entry.lastDecayAt += steps * DAY_MS
        changed = true
      }
      if (entry.remainingSeconds <= 0) {
        iterator.remove()
        changed = true
      }
    }
    return changed
  }

  private fun todayKey(now: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date(now))
  }
}
