package com.richardbendler.sportforinstatime

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle

class SportWidgetConfigActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val appWidgetId = intent.getIntExtra(
      AppWidgetManager.EXTRA_APPWIDGET_ID,
      AppWidgetManager.INVALID_APPWIDGET_ID
    )
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      setResult(Activity.RESULT_CANCELED)
      finish()
      return
    }

    val prefs = getSharedPreferences("widget_data", Context.MODE_PRIVATE)
    val pendingSportId = prefs.getString("pending_sport_id", null)
    val pendingSportName = prefs.getString("pending_sport_name", "Sport")
    if (pendingSportId == null) {
      val result = Intent()
      result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      setResult(Activity.RESULT_OK, result)
      SportWidgetProvider.refreshAll(this)
      finish()
      return
    }

    prefs.edit()
      .putString("widget_${appWidgetId}_sport_id", pendingSportId)
      .putString("widget_${appWidgetId}_sport_name", pendingSportName)
      .remove("pending_sport_id")
      .remove("pending_sport_name")
      .remove("pending_request_time")
      .apply()

    SportWidgetProvider.updateAppWidget(
      this,
      AppWidgetManager.getInstance(this),
      appWidgetId
    )
    SportWidgetProvider.refreshAll(this)

    val result = Intent()
    result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
    setResult(Activity.RESULT_OK, result)
    finish()
  }
}
