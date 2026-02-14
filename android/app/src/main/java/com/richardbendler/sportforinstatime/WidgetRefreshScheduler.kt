package com.richardbendler.sportforinstatime

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build

object WidgetRefreshScheduler {
  private const val REFRESH_INTERVAL_MS = 30_000L
  private const val ACTION_REFRESH_WIDGETS =
    "com.richardbendler.sportforinstatime.action.REFRESH_WIDGETS"
  private const val REQUEST_CODE_REFRESH = 7011

  fun handleRefreshAlarm(context: Context) {
    SportWidgetProvider.refreshAll(context)
    OverallWidgetProvider.refreshAll(context)
    ensureScheduled(context)
  }

  fun ensureScheduled(context: Context) {
    if (!hasAnyWidgets(context)) {
      cancel(context)
      return
    }
    scheduleNext(context)
  }

  fun cancel(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(buildPendingIntent(context))
  }

  private fun scheduleNext(context: Context) {
    val triggerAt = System.currentTimeMillis() + REFRESH_INTERVAL_MS
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = buildPendingIntent(context)
    alarmManager.cancel(pendingIntent)
    val canScheduleExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      alarmManager.canScheduleExactAlarms()
    } else {
      true
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      if (canScheduleExact) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pendingIntent
        )
      } else {
        alarmManager.setAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pendingIntent
        )
      }
    } else {
      if (canScheduleExact) {
        alarmManager.setExact(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pendingIntent
        )
      } else {
        alarmManager.set(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pendingIntent
        )
      }
    }
  }

  private fun hasAnyWidgets(context: Context): Boolean {
    val manager = AppWidgetManager.getInstance(context)
    val sportIds = manager.getAppWidgetIds(ComponentName(context, SportWidgetProvider::class.java))
    if (sportIds.isNotEmpty()) {
      return true
    }
    val overallIds = manager.getAppWidgetIds(ComponentName(context, OverallWidgetProvider::class.java))
    return overallIds.isNotEmpty()
  }

  private fun buildPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, WidgetUpdateReceiver::class.java).setAction(ACTION_REFRESH_WIDGETS)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getBroadcast(context, REQUEST_CODE_REFRESH, intent, flags)
  }

  fun isRefreshAction(action: String?): Boolean {
    return ACTION_REFRESH_WIDGETS == action
  }
}
