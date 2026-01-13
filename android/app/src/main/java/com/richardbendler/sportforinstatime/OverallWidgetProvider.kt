package com.richardbendler.sportforinstatime

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.util.Locale

class OverallWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { appWidgetId ->
      updateAppWidget(context, appWidgetManager, appWidgetId)
    }
  }

  companion object {
    @JvmStatic
    fun updateAppWidget(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int
    ) {
      val localizedContext = getLocalizedContext(context, getAppLanguage(context))
      val usagePrefs = context.getSharedPreferences("insta_control", Context.MODE_PRIVATE)
      val now = System.currentTimeMillis()
      val breakdown = ScreenTimeStore.getBreakdown(usagePrefs, now)
      val remaining = breakdown.remainingSeconds
      val totalToday = breakdown.totalTodaySeconds
      val carryover = breakdown.carryoverSeconds

      val remainingLabel = localizedContext.getString(R.string.widget_overall_remaining_suffix)
      val totalLabel = localizedContext.getString(R.string.widget_overall_total_suffix)
      val carryoverLabel = localizedContext.getString(R.string.widget_overall_carryover_suffix)

      val views = RemoteViews(context.packageName, R.layout.widget_overall)
      views.setTextViewText(
        R.id.widget_overall_remaining,
        "${formatDuration(remaining)} $remainingLabel"
      )
      views.setTextViewText(
        R.id.widget_overall_total,
        "${formatDuration(totalToday)} $totalLabel"
      )
      views.setTextViewText(
        R.id.widget_overall_carryover,
        "${formatDuration(carryover)} $carryoverLabel"
      )

      val intent = Intent(context, MainActivity::class.java)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      val pendingIntent = PendingIntent.getActivity(context, 0, intent, flags)
      views.setOnClickPendingIntent(R.id.widget_overall_root, pendingIntent)

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
      val provider = ComponentName(context, OverallWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(provider)
      ids.forEach { id -> updateAppWidget(context, manager, id) }
    }
  }
}
