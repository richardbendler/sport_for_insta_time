package com.richardbendler.sportforinstatime

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WidgetPinReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val appWidgetId = intent.getIntExtra(
      AppWidgetManager.EXTRA_APPWIDGET_ID,
      AppWidgetManager.INVALID_APPWIDGET_ID
    )
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      return
    }

    val sportId = intent.getStringExtra("sport_id")
    val sportName = intent.getStringExtra("sport_name")
    val prefs = context.getSharedPreferences("widget_data", Context.MODE_PRIVATE)
    val fallbackSportId = prefs.getString("pending_sport_id", null)
    val fallbackSportName = prefs.getString("pending_sport_name", "Sport")
    val finalSportId = sportId ?: fallbackSportId
    val finalSportName = sportName ?: fallbackSportName
    if (finalSportId == null) {
      return
    }

    prefs.edit()
      .putString("widget_${appWidgetId}_sport_id", finalSportId)
      .putString("widget_${appWidgetId}_sport_name", finalSportName)
      .remove("pending_sport_id")
      .remove("pending_sport_name")
      .remove("pending_request_time")
      .apply()

    SportWidgetProvider.updateAppWidget(
      context,
      AppWidgetManager.getInstance(context),
      appWidgetId
    )
    SportWidgetProvider.refreshAll(context)
  }
}
