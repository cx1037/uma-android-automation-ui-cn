package com.steve1316.uma_android_automation

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.steve1316.automation_library.events.ExceptionEvent
import com.steve1316.automation_library.events.JSEvent
import com.steve1316.automation_library.events.StartEvent
import com.steve1316.automation_library.utils.MediaProjectionService
import com.steve1316.automation_library.utils.MessageLog
import com.steve1316.automation_library.utils.MyAccessibilityService
import com.steve1316.uma_android_automation.bot.Game
import com.steve1316.uma_android_automation.utils.CustomJSONParser
import org.greenrobot.eventbus.EventBus
import org.greenrobot.eventbus.Subscribe
import org.greenrobot.eventbus.SubscriberExceptionEvent
import androidx.core.net.toUri

/**
 * Takes care of setting up internal processes such as the Accessibility and MediaProjection services, receiving and sending messages over to the
 * Javascript frontend, and handle tests involving Discord and Twitter API integrations if needed.
 * <p>
 * Loaded into the React PackageList via MainApplication's instantiation of the StartPackage.
 */
class StartModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    private val tag = "[${MainActivity.loggerTag}]StartModule"
    
    companion object {
        private var reactContext: ReactApplicationContext? = null
        private var emitter: DeviceEventManagerModule.RCTDeviceEventEmitter? = null
    }
    
    private val context: Context = reactContext.applicationContext

    init {
        StartModule.reactContext = reactContext
        StartModule.reactContext?.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "StartModule"
    }

    override fun onNewIntent(intent: Intent) {
        // Empty implementation
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == 100 && resultCode == Activity.RESULT_OK) {
            // Start up the MediaProjection service after the user accepts the onscreen prompt.
            reactContext?.startService(
                MediaProjectionService.getStartIntent(reactContext!!, resultCode, data!!)
            )
            sendEvent("MediaProjectionService", "Running")
        }
    }

    ////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////
    // Interaction with the Start / Stop button.

    /**
     * This is called when the Start button is pressed back at the Javascript frontend and starts up the MediaProjection service along with the
     * BotService attached to it.
     */
    @ReactMethod
    fun start() {
        if (readyCheck()) {
            startProjection()
        }
    }

    /**
     * Register this module with EventBus in order to allow listening to certain events and then begin starting up the MediaProjection service.
     */
    private fun startProjection() {
        // This extra call to unregister is to account for the user stopping the service from the notification which bypasses the call to
        // unregister in stopProjection().
        EventBus.getDefault().unregister(this)
        EventBus.getDefault().register(this)
        Log.d(tag, "Event Bus registered for StartModule")
        val mediaProjectionManager = reactContext?.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        reactContext?.startActivityForResult(mediaProjectionManager.createScreenCaptureIntent(), 100, null)
    }

    /**
     * Unregister this module with EventBus and then stops the MediaProjection service.
     */
    private fun stopProjection() {
        EventBus.getDefault().unregister(this)
        Log.d(tag, "Event Bus unregistered for StartModule")
        reactContext?.startService(MediaProjectionService.getStopIntent(reactContext!!))
        sendEvent("MediaProjectionService", "Not Running")
    }

    /**
     * This is called when the Stop button is pressed and will begin stopping the MediaProjection service.
     */
    @ReactMethod
    fun stop() {
        stopProjection()
    }

    ////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////
    // Permissions

    /**
     * Checks the permissions for both overlay and accessibility for this app.
     *
     * @return True if both permissions were already granted and false otherwise.
     */
    private fun readyCheck(): Boolean {
        return checkForOverlayPermission() && checkForAccessibilityPermission()
    }

    /**
     * Checks for overlay permission and guides the user to enable it if it has not been granted yet.
     *
     * @return True if the overlay permission has already been granted.
     */
    private fun checkForOverlayPermission(): Boolean {
        if (!Settings.canDrawOverlays(this.reactApplicationContext.currentActivity)) {
            Log.d(tag, "Application is missing overlay permission.")

            val builder = AlertDialog.Builder(this.reactApplicationContext.currentActivity)
            builder.setTitle(R.string.overlay_disabled)
            builder.setMessage(R.string.overlay_disabled_message)

            builder.setPositiveButton(R.string.go_to_settings) { _, _ ->
                // Send the user to the Overlay Settings.
                val uri = "package:${reactContext?.packageName}"
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, uri.toUri())
                this.reactApplicationContext.currentActivity?.startActivity(intent)
            }

            builder.setNegativeButton(android.R.string.cancel, null)

            builder.show()
            return false
        }

        Log.d(tag, "Application has permission to draw overlay.")
        return true
    }

    /**
     * Checks for accessibility permission and guides the user to enable it if it has not been granted yet.
     *
     * @return True if the accessibility permission has already been granted.
     */
    private fun checkForAccessibilityPermission(): Boolean {
        val prefString = Settings.Secure.getString(myContext.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)

        if (prefString != null && prefString.isNotEmpty()) {
            // Check the string of enabled accessibility services to see if this application's accessibility service is there.
            val enabled = prefString.contains(myContext.packageName.toString() + "/" + MyAccessibilityService::class.java.name)

            if (enabled) {
                Log.d(logTag, "This application's Accessibility Service is currently turned on.")
                return true
            }
        }

        // Shows a dialog explaining how to enable Accessibility Service when restricted settings are detected.
        // The dialog provides options to navigate to App Info or Accessibility Settings to complete the setup.
        AlertDialog.Builder(myContext).apply {
            setTitle(R.string.accessibility_disabled)
            setMessage(
                """
            To enable Accessibility Service:
            
            1. Tap "Go to App Info".
            2. Tap the 3-dot menu in the top right. If not available, you can skip to step 4.
            3. Tap "Allow restricted settings".
            4. Return to Accessibility Settings and enable the service.
            """.trimIndent()
            )
            setPositiveButton("Go to App Info") { _, _ ->
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = "package:${myContext.packageName}".toUri()
                }
                startActivity(intent)
            }
            setNeutralButton("Accessibility Settings") { _, _ ->
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                startActivity(intent)
            }
            setNegativeButton(android.R.string.cancel, null)
        }.show()

        return false
    }

    ////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////
    // Event interaction

    /**
     * Listener function to start this module's entry point.
     *
     * @param event The StartEvent object to parse its message.
     */
    @Subscribe
    fun onStartEvent(event: StartEvent) {
        if (event.message == "Entry Point ON") {
            // Initialize settings.
            val parser = CustomJSONParser()
            parser.initializeSettings(context)

            val entryPoint = Game(context)

            try {
                entryPoint.start()
            } catch (e: Exception) {
                EventBus.getDefault().postSticky(ExceptionEvent(e))
            }
        }
    }

    /**
     * Sends the message back to the Javascript frontend along with its event name to be listened on.
     *
     * @param eventName The name of the event to be picked up on as defined in the developer's JS frontend.
     * @param message   The message string to pass on.
     */
    fun sendEvent(eventName: String, message: String) {
        val params = Arguments.createMap()
        params.putString("message", message)
        if (emitter == null) {
            // Register the event emitter to send messages to JS.
            emitter = reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        }

        emitter?.emit(eventName, params)
    }

    /**
     * Listener function to call the inner event sending function in order to send the message back to the Javascript frontend.
     *
     * @param event The JSEvent object to parse its event name and message.
     */
    @Subscribe
    fun onJSEvent(event: JSEvent) {
        sendEvent(event.eventName, event.message)
    }

    /**
     * Listener function to send Exception messages back to the Javascript frontend.
     *
     * @param event The SubscriberExceptionEvent object to parse its event name and message.
     */
    @Subscribe
    fun onSubscriberExceptionEvent(event: SubscriberExceptionEvent) {
        MessageLog.printToLog(event.throwable.toString(), MainActivity.loggerTag, isWarning = false, isError = true, skipPrintTime = false)
        for (line in event.throwable.stackTrace) {
            MessageLog.printToLog("\t${line}", MainActivity.loggerTag, isWarning = false, isError = true, skipPrintTime = true)
        }
        MessageLog.printToLog("", MainActivity.loggerTag, isWarning = false, isError = false, skipPrintTime = true)
    }
}