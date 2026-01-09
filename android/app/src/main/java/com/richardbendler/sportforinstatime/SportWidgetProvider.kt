package com.richardbendler.sportforinstatime

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

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
      val sportId = prefs.getString("widget_${appWidgetId}_sport_id", null)
      val sportName = prefs.getString("widget_${appWidgetId}_sport_name", "Sport")
      val title = if (sportId != null) prefs.getString("${sportId}_title", sportName) else sportName
      val icon = if (sportId != null) prefs.getString("${sportId}_icon", "⭐") else "⭐"
      val value = if (sportId != null) prefs.getString("${sportId}_value", "0") else "0"
      val screenTime = if (sportId != null) prefs.getString("${sportId}_screen", "00:00") else "00:00"
      val screenLabel = if (sportId != null) prefs.getString("${sportId}_screen_label", "Screen Time") else "Screen Time"

      val views = RemoteViews(context.packageName, R.layout.widget_sport)
      views.setTextViewText(R.id.widget_title, "$icon $title")
      views.setTextViewText(R.id.widget_value, value)
      views.setTextViewText(R.id.widget_screen_time, "$screenLabel: $screenTime")

      val intent = Intent(context, MainActivity::class.java)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      val pendingIntent = PendingIntent.getActivity(context, 0, intent, flags)
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val provider = ComponentName(context, SportWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(provider)
      ids.forEach { id -> updateAppWidget(context, manager, id) }
    }
  }
}
