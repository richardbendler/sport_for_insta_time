package com.richardbendler.sportforinstatime

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.util.Locale

class SportWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { appWidgetId ->
      updateAppWidget(context, appWidgetManager, appWidgetId)
    }
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    val prefs = context.getSharedPreferences("widget_data", Context.MODE_PRIVATE)
    val editor = prefs.edit()
    appWidgetIds.forEach { id ->
      editor.remove("widget_${id}_sport_id")
      editor.remove("widget_${id}_sport_name")
    }
    editor.apply()
  }

  companion object {
    @JvmStatic
    fun updateAppWidget(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int
    ) {
      val prefs = context.getSharedPreferences("widget_data", Context.MODE_PRIVATE)
      var sportId = prefs.getString("widget_${appWidgetId}_sport_id", null)
      var sportName = prefs.getString("widget_${appWidgetId}_sport_name", "Sport")
      if (sportId == null) {
        val lastSportId = prefs.getString("last_widget_sport_id", null)
        val lastSportName = prefs.getString("last_widget_sport_name", "Sport")
        val lastAt = prefs.getLong("last_widget_request_time", 0L)
        val now = System.currentTimeMillis()
        if (lastSportId != null && now - lastAt < 120000L) {
          prefs.edit()
            .putString("widget_${appWidgetId}_sport_id", lastSportId)
            .putString("widget_${appWidgetId}_sport_name", lastSportName)
            .remove("last_widget_sport_id")
            .remove("last_widget_sport_name")
            .remove("last_widget_request_time")
            .apply()
          sportId = lastSportId
          sportName = lastSportName
        }
      }
      val localizedContext =
        getLocalizedContext(context, getAppLanguage(context))
      val fallbackTitle = localizedContext.getString(R.string.widget_sport_title)
      val title = if (sportId != null) {
        prefs.getString("${sportId}_title", sportName) ?: sportName
      } else {
        fallbackTitle
      }

      val (value, screenTime) = if (sportId != null) {
        val v = prefs.getString("${sportId}_value", "0") ?: "0"
        val s = prefs.getString("${sportId}_screen", "00:00") ?: "00:00"
        Pair(v, s)
      } else {
        Pair("0", "00:00")
      }

      val views = RemoteViews(context.packageName, R.layout.widget_sport)
      views.setTextViewText(R.id.widget_title, title)
      views.setTextViewText(R.id.widget_value, value)
      views.setTextViewText(R.id.widget_screen_time, screenTime)

      val intent = Intent(context, MainActivity::class.java)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      val pendingIntent = PendingIntent.getActivity(context, 0, intent, flags)
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun formatDuration(totalSeconds: Int): String {
      val minutes = (totalSeconds / 60).toString().padStart(2, '0')
      val seconds = (totalSeconds % 60).toString().padStart(2, '0')
      return "$minutes:$seconds"
    }

    private fun getAppLanguage(context: Context): String? {
      val usagePrefs = context.getSharedPreferences("insta_control", Context.MODE_PRIVATE)
      return usagePrefs.getString("app_language", null)
    }

    private fun getLocalizedContext(context: Context, language: String?): Context {
      if (language.isNullOrBlank()) {
        return context
      }
      val locale = Locale(language)
      val config = context.resources.configuration
      config.setLocale(locale)
      return context.createConfigurationContext(config)
    }

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val provider = ComponentName(context, SportWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(provider)
      ids.forEach { id -> updateAppWidget(context, manager, id) }
    }
  }
}
