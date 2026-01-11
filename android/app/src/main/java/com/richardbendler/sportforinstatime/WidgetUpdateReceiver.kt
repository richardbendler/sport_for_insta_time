package com.richardbendler.sportforinstatime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WidgetUpdateReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    SportWidgetProvider.refreshAll(context)
    OverallWidgetProvider.refreshAll(context)
  }
}
