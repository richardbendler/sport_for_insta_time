package com.richardbendler.sportforinstatime

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
import com.richardbendler.sportforinstatime.InstaControlPackage
import com.reactnativecommunity.asyncstorage.AsyncStoragePackage
import com.wenkesj.voice.VoicePackage

class MainApplication : Application(), ReactApplication {
  private val newArchEnabled = false

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(InstaControlPackage())
              if (none { it::class.java.name == AsyncStoragePackage::class.java.name }) {
                add(AsyncStoragePackage())
              }
              if (none { it::class.java.name == VoicePackage::class.java.name }) {
                add(VoicePackage())
              }
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = newArchEnabled
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    try {
      SoLoader.init(this, OpenSourceMergedSoMapping)
    } catch (e: Exception) {
      // Fallback for unexpected SoLoader init issues.
      SoLoader.init(this, false)
    }
    if (newArchEnabled) {
      DefaultNewArchitectureEntryPoint.load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
