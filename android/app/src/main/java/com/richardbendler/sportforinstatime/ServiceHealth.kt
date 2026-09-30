package com.richardbendler.sportforinstatime

// Keys in the "insta_control" prefs that InstaBlockerService uses to report
// whether it is actually running. The app compares them with the
// accessibility setting to detect a service that is enabled but dead.
object ServiceHealth {
  const val KEY_CONNECTED_AT = "service_connected_at"
  const val KEY_DESTROYED_AT = "service_destroyed_at"
  const val KEY_HEARTBEAT_AT = "service_heartbeat_at"
  const val KEY_LAST_ERROR = "service_last_error"
  const val KEY_LAST_ERROR_AT = "service_last_error_at"
  const val KEY_OVERLAY_ATTACHED = "service_overlay_attached"
  const val KEY_OVERLAY_VISIBLE = "service_overlay_visible"
  const val KEY_FOREGROUND_PACKAGE = "service_foreground_package"
}
