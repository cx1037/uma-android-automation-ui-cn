package com.steve1316.uma_android_automation

import android.content.res.Configuration
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.github.javiersantos.appupdater.AppUpdater
import com.github.javiersantos.appupdater.enums.UpdateFrom
import org.opencv.android.OpenCVLoader
import java.util.Locale


class MainActivity : ReactActivity() {
	companion object {
		const val loggerTag: String = "UAA"
	}

	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		
		// Set application locale to combat cases where user's language uses commas instead of decimal points for floating numbers.
		val config: Configuration? = this.getResources().configuration
		val locale = Locale("en")
		Locale.setDefault(locale)
		this.getResources().updateConfiguration(config, this.getResources().displayMetrics)

		// Set up the app updater to check for the latest update from GitHub.
		AppUpdater(this)
			.setUpdateFrom(UpdateFrom.XML)
			.setUpdateXML("https://raw.githubusercontent.com/steve1316/uma-android-automation/main/android/app/update.xml")
			.start();

		// Load OpenCV native library. This will throw a "E/OpenCV/StaticHelper: OpenCV error: Cannot load info library for OpenCV". It is safe to
		// ignore this error. OpenCV functionality is not impacted by this error.
		OpenCVLoader.initDebug()
	}

	/**
	 * Returns the name of the main component registered from JavaScript. This is used to schedule
	 * rendering of the component.
	 *
	 * Note: This needs to match with the name declared in app.json!
	 */
	override fun getMainComponentName(): String = "Uma Android Automation"

	/**
	 * Returns the instance of the [com.facebook.react.ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
	 * which allows you to enable New Architecture with a single boolean flags [com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled]
	 */
	override fun createReactActivityDelegate(): ReactActivityDelegate = DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}