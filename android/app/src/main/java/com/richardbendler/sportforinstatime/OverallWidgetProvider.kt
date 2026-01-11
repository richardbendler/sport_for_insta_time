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
      val allowance = usagePrefs.getInt("allowance_seconds", 0)
      val used = usagePrefs.getInt("used_seconds", 0)
      val remaining = (allowance - used).coerceAtLeast(0)

      val title = localizedContext.getString(R.string.widget_overall_title)
      val usedLabel = localizedContext.getString(R.string.widget_used_label)
      val remainingLabel = localizedContext.getString(R.string.widget_remaining_label)

      val views = RemoteViews(context.packageName, R.layout.widget_overall)
      views.setTextViewText(R.id.widget_overall_title, title)
      views.setTextViewText(
        R.id.widget_overall_used,
        "$usedLabel: ${formatDuration(used)}"
      )
      views.setTextViewText(
        R.id.widget_overall_remaining,
        "$remainingLabel: ${formatDuration(remaining)}"
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
