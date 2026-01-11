package com.richardbendler.sportforinstatime

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

class InstaBlockerActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLocaleFromPrefs()
    setContentView(R.layout.activity_insta_blocker)
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN

    val button = findViewById<Button>(R.id.blocker_button)
    button.setOnClickListener { goHome() }
    val openAppButton = findViewById<Button>(R.id.blocker_open_app)
    openAppButton.setOnClickListener { openApp() }
  }

  override fun onBackPressed() {
    goHome()
  }

  private fun goHome() {
    val intent = Intent(Intent.ACTION_MAIN)
    intent.addCategory(Intent.CATEGORY_HOME)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
    startActivity(intent)
  }

  private fun openApp() {
    val intent = Intent(this, MainActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
    startActivity(intent)
  }

  private fun applyLocaleFromPrefs() {
    val prefs = getSharedPreferences("insta_control", MODE_PRIVATE)
    val language = prefs.getString("app_language", null) ?: return
    val locale = Locale(language)
    Locale.setDefault(locale)
    val config = resources.configuration
    config.setLocale(locale)
    resources.updateConfiguration(config, resources.displayMetrics)
  }
}
