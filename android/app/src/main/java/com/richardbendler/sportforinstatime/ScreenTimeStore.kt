package com.richardbendler.sportforinstatime

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.comparisons.compareBy

object ScreenTimeStore {
  private const val PREF_KEY_ENTRIES = "screen_time_entries"
  private const val PREF_KEY_USED = "used_seconds"
  private const val PREF_KEY_USED_BY_APP = "used_seconds_by_app"
  private const val PREF_KEY_LAST_DAY = "last_day"
  private const val PREF_KEY_LEGACY_ALLOWANCE = "allowance_seconds"
  private const val DAY_MS = 24L * 60L * 60L * 1000L

  data class Entry(
    val id: String,
    val sportId: String?,
    val createdAt: Long,
    var remainingSeconds: Int,
    var lastDecayAt: Long,
    var originalSeconds: Int,
    var decayCount: Int
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

  data class Breakdown(
    val remainingSeconds: Int,
    val totalTodaySeconds: Int,
    val carryoverSeconds: Int
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
          originalSeconds = safeSeconds,
          decayCount = 0
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
    val persisted = entries.filter { shouldKeepEntry(it, now) }
    val cutoff = now - DAY_MS
    val recentEntries = entries.filter { it.remainingSeconds > 0 }
    val remainingBySport = mutableMapOf<String, Int>()
    var total = 0
    recentEntries.forEach { entry ->
      total += entry.remainingSeconds
      val sportKey = entry.sportId
      if (!sportKey.isNullOrBlank()) {
        remainingBySport[sportKey] = (remainingBySport[sportKey] ?: 0) + entry.remainingSeconds
      }
    }
    if (changed || persisted.size != entries.size) {
      saveEntries(prefs, persisted)
    }
    return Totals(total, remainingBySport, recentEntries.size)
  }

  fun getEntries(prefs: SharedPreferences, now: Long): List<Entry> {
    val entries = ensureLegacyMigration(loadEntries(prefs), prefs, now)
    val changed = applyDecay(entries, now)
    val persisted = entries.filter { shouldKeepEntry(it, now) }
    if (changed || persisted.size != entries.size) {
      saveEntries(prefs, persisted)
    }
    return entries.sortedByDescending { it.createdAt }
  }

  fun getBreakdown(prefs: SharedPreferences, now: Long): Breakdown {
    val entries = ensureLegacyMigration(loadEntries(prefs), prefs, now)
    val changed = applyDecay(entries, now)
    val cutoff = now - DAY_MS
    var remainingTotal = 0
    var totalToday = 0
    var carryover = 0
    entries.forEach { entry ->
      if (entry.createdAt >= cutoff && entry.remainingSeconds > 0) {
        remainingTotal += entry.remainingSeconds
      }
      if (entry.createdAt >= cutoff) {
        totalToday += entry.originalSeconds
      } else if (entry.remainingSeconds > 0) {
        carryover += entry.remainingSeconds
      }
    }
    val persisted = entries.filter { shouldKeepEntry(it, now) }
    if (changed || persisted.size != entries.size) {
      saveEntries(prefs, persisted)
    }
    return Breakdown(remainingTotal, totalToday, carryover)
  }

  fun consumeSeconds(prefs: SharedPreferences, now: Long, seconds: Int): ConsumptionResult {
    if (seconds <= 0) {
      val totals = getTotals(prefs, now)
      return ConsumptionResult(totals.remainingSeconds, 0)
    }
    val entries = ensureLegacyMigration(loadEntries(prefs), prefs, now)
    var changed = applyDecay(entries, now)
    val sorted = entries
      .sortedWith(compareBy({ it.createdAt }, { it.id }))
      .toMutableList()
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
    val cleaned = sorted.filter { shouldKeepEntry(it, now) }
    if (changed || cleaned.size != entries.size) {
      saveEntries(prefs, cleaned)
    }
    val totalRemaining = cleaned.sumOf { it.remainingSeconds }
    val consumed = seconds - remainingToConsume
    return ConsumptionResult(totalRemaining, consumed)
  }

  fun getUsedSecondsToday(prefs: SharedPreferences, now: Long): Int {
    ensureToday(prefs, now)
    return prefs.getInt(PREF_KEY_USED, 0)
  }

  fun addUsedSeconds(prefs: SharedPreferences, now: Long, delta: Int): Int {
    val current = getUsedSecondsToday(prefs, now)
    val next = (current + delta).coerceAtLeast(0)
    prefs.edit().putInt(PREF_KEY_USED, next).apply()
    return next
  }

  fun addUsedSecondsForApp(
    prefs: SharedPreferences,
    now: Long,
    packageName: String?,
    delta: Int
  ) {
    if (delta <= 0 || packageName.isNullOrBlank()) {
      return
    }
    ensureToday(prefs, now)
    val current = loadUsedByApp(prefs)
    val nextValue = (current[packageName] ?: 0) + delta
    current[packageName] = nextValue
    saveUsedByApp(prefs, current)
  }

  fun getUsedByAppToday(prefs: SharedPreferences, now: Long): Map<String, Int> {
    ensureToday(prefs, now)
    return loadUsedByApp(prefs)
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
        originalSeconds = remaining,
        decayCount = 0
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
      obj.put("decayCount", entry.decayCount)
      array.put(obj)
    }
    prefs.edit().putString(PREF_KEY_ENTRIES, array.toString()).apply()
  }

  private fun ensureToday(prefs: SharedPreferences, now: Long): String {
    val today = todayKey(now)
    val lastDay = prefs.getString(PREF_KEY_LAST_DAY, "") ?: ""
    if (lastDay != today) {
      prefs.edit()
        .putInt(PREF_KEY_USED, 0)
        .putString(PREF_KEY_LAST_DAY, today)
        .remove(PREF_KEY_USED_BY_APP)
        .apply()
    }
    return today
  }

  private fun loadUsedByApp(prefs: SharedPreferences): MutableMap<String, Int> {
    val raw = prefs.getString(PREF_KEY_USED_BY_APP, null) ?: return mutableMapOf()
    val obj = try {
      JSONObject(raw)
    } catch (e: Exception) {
      return mutableMapOf()
    }
    val result = mutableMapOf<String, Int>()
    val iterator = obj.keys()
    while (iterator.hasNext()) {
      val key = iterator.next()
      val value = obj.optInt(key, 0)
      if (value > 0) {
        result[key] = value
      }
    }
    return result
  }

  private fun saveUsedByApp(prefs: SharedPreferences, data: Map<String, Int>) {
    val obj = JSONObject()
    data.forEach { (key, value) ->
      if (value > 0) {
        obj.put(key, value)
      }
    }
    prefs.edit().putString(PREF_KEY_USED_BY_APP, obj.toString()).apply()
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
    val explicitDecayCount = obj.optInt("decayCount", -1)
    val derivedDecayCount = if (lastDecay <= createdAt) {
      0
    } else {
      ((lastDecay - createdAt) / DAY_MS).toInt().coerceAtLeast(0)
    }
    val decayCount = if (explicitDecayCount >= 0) explicitDecayCount else derivedDecayCount
    return Entry(
      id = id,
      sportId = if (sportId.isBlank()) null else sportId,
      createdAt = createdAt,
      remainingSeconds = remaining,
      lastDecayAt = lastDecay,
      originalSeconds = original,
      decayCount = decayCount
    )
  }

  private fun applyDecay(entries: MutableList<Entry>, now: Long): Boolean {
    var changed = false
    val iterator = entries.iterator()
    while (iterator.hasNext()) {
      val entry = iterator.next()
      val elapsedDays = ((now - entry.createdAt) / DAY_MS).toInt().coerceAtLeast(0)
      val maxShift = 30
      val targetHalves = if (elapsedDays > maxShift) maxShift else elapsedDays
      val missingHalves = targetHalves - entry.decayCount
      if (missingHalves > 0) {
        var remaining = entry.remainingSeconds
        repeat(missingHalves) {
          remaining /= 2
        }
        entry.remainingSeconds = if (elapsedDays > maxShift) 0 else remaining
        entry.decayCount = targetHalves
        entry.lastDecayAt = entry.createdAt + entry.decayCount * DAY_MS
        changed = true
      } else if (elapsedDays > maxShift && entry.remainingSeconds > 0) {
        entry.remainingSeconds = 0
        entry.decayCount = targetHalves
        entry.lastDecayAt = entry.createdAt + entry.decayCount * DAY_MS
        changed = true
      }
      if (entry.remainingSeconds <= 0 && now - entry.createdAt >= DAY_MS) {
        iterator.remove()
        changed = true
      }
    }
    return changed
  }

  private fun shouldKeepEntry(entry: Entry, now: Long): Boolean {
    if (entry.remainingSeconds > 0) {
      return true
    }
    return entry.createdAt >= now - DAY_MS
  }

  private fun todayKey(now: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date(now))
  }
}
