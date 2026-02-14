package com.richardbendler.sportforinstatime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WidgetUpdateReceiver : BroadcastReceiver() {
  companion object {
    private val startupActions = setOf(
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED
    )
  }

  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (WidgetRefreshScheduler.isRefreshAction(action)) {
      WidgetRefreshScheduler.handleRefreshAlarm(context)
      return
    }
    if (!startupActions.contains(action)) {
      return
    }
    SportWidgetProvider.refreshAll(context)
    OverallWidgetProvider.refreshAll(context)
    WidgetRefreshScheduler.ensureScheduled(context)
  }
}
