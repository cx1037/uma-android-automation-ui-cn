package com.steve1316.uma_android_automation.utils

import android.content.Context
import org.json.JSONObject

/**
 * Utility class for printing SQLite settings in a consistent format.
 * Can be used by both HomeFragment and Game.kt to display current bot configuration.
 */
object SettingsPrinter {
	
	/**
	 * Print all current SQLite settings for debugging purposes.
	 * 
	 * @param context The application context
	 * @param printToLog Function to handle logging
	 */
	fun printCurrentSettings(context: Context, printToLog: ((String) -> Unit)? = null): String {
		
		// Main Settings
		val campaign: String = SettingsHelper.getStringSetting("general", "scenario")
		val enableFarmingFans = SettingsHelper.getBooleanSetting("racing", "enableFarmingFans")
		val daysToRunExtraRaces: Int = SettingsHelper.getIntSetting("racing", "daysToRunExtraRaces")
		val enableSkillPointCheck: Boolean = SettingsHelper.getBooleanSetting("general", "enableSkillPointCheck")
		val skillPointCheck: Int = SettingsHelper.getIntSetting("general", "skillPointCheck")
		val enablePopupCheck: Boolean = SettingsHelper.getBooleanSetting("general", "enablePopupCheck")
		val disableRaceRetries: Boolean = SettingsHelper.getBooleanSetting("racing", "disableRaceRetries")
		val enableStopOnMandatoryRace: Boolean = SettingsHelper.getBooleanSetting("racing", "enableStopOnMandatoryRaces")
		val enableForceRacing: Boolean = SettingsHelper.getBooleanSetting("racing", "enableForceRacing")
		val enablePrioritizeEnergyOptions: Boolean = SettingsHelper.getBooleanSetting("trainingEvent", "enablePrioritizeEnergyOptions")
		
		// Training Settings
		val trainingBlacklist: List<String> = SettingsHelper.getStringArraySetting("training", "trainingBlacklist")
		var statPrioritization: List<String> = SettingsHelper.getStringArraySetting("training", "statPrioritization")
		val maximumFailureChance: Int = SettingsHelper.getIntSetting("training", "maximumFailureChance")
		val disableTrainingOnMaxedStat: Boolean = SettingsHelper.getBooleanSetting("training", "disableTrainingOnMaxedStat")
		val focusOnSparkStatTarget: Boolean = SettingsHelper.getBooleanSetting("training", "focusOnSparkStatTarget")
		
		// Training Stat Targets
		val sprintSpeedTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingSprintStatTarget_speedStatTarget")
		val sprintStaminaTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingSprintStatTarget_staminaStatTarget")
		val sprintPowerTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingSprintStatTarget_powerStatTarget")
		val sprintGutsTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingSprintStatTarget_gutsStatTarget")
		val sprintWitTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingSprintStatTarget_witStatTarget")
		
		val mileSpeedTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMileStatTarget_speedStatTarget")
		val mileStaminaTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMileStatTarget_staminaStatTarget")
		val milePowerTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMileStatTarget_powerStatTarget")
		val mileGutsTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMileStatTarget_gutsStatTarget")
		val mileWitTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMileStatTarget_witStatTarget")
		
		val mediumSpeedTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMediumStatTarget_speedStatTarget")
		val mediumStaminaTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMediumStatTarget_staminaStatTarget")
		val mediumPowerTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMediumStatTarget_powerStatTarget")
		val mediumGutsTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMediumStatTarget_gutsStatTarget")
		val mediumWitTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingMediumStatTarget_witStatTarget")
		
		val longSpeedTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingLongStatTarget_speedStatTarget")
		val longStaminaTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingLongStatTarget_staminaStatTarget")
		val longPowerTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingLongStatTarget_powerStatTarget")
		val longGutsTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingLongStatTarget_gutsStatTarget")
		val longWitTarget = SettingsHelper.getIntSetting("trainingStatTarget", "trainingLongStatTarget_witStatTarget")
		
		// Training Event Settings
		val characterEventData = SettingsHelper.getStringSetting("trainingEvent", "characterEventData")
		val selectAllCharacters = SettingsHelper.getBooleanSetting("trainingEvent", "selectAllCharacters")
		val supportEventData = SettingsHelper.getStringSetting("trainingEvent", "supportEventData")
		val selectAllSupportCards = SettingsHelper.getBooleanSetting("trainingEvent", "selectAllSupportCards")
		
		// OCR Optimization Settings
		val threshold: Int = SettingsHelper.getIntSetting("ocr", "ocrThreshold")
		val enableAutomaticRetry: Boolean = SettingsHelper.getBooleanSetting("ocr", "enableAutomaticOCRRetry")
		val ocrConfidence: Int = SettingsHelper.getIntSetting("ocr", "ocrConfidence")
		
		// Debug Options
		val debugMode: Boolean = SettingsHelper.getBooleanSetting("debug", "enableDebugMode")
		val confidence: Int = SettingsHelper.getIntSetting("debug", "templateMatchConfidence")
		val customScale: Int = SettingsHelper.getIntSetting("debug", "templateMatchCustomScale")
		val debugModeStartTemplateMatchingTest: Boolean = SettingsHelper.getBooleanSetting("debug", "debugMode_startTemplateMatchingTest")
		val debugModeStartSingleTrainingFailureOCRTest: Boolean = SettingsHelper.getBooleanSetting("debug", "debugMode_startSingleTrainingFailureOCRTest")
		val debugModeStartComprehensiveTrainingFailureOCRTest: Boolean = SettingsHelper.getBooleanSetting("debug", "debugMode_startComprehensiveTrainingFailureOCRTest")
		val hideComparisonResults: Boolean = SettingsHelper.getBooleanSetting("debug", "enableHideOCRComparisonResults")


		////////////////////////////////////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////////////////////////////
		
		// Construct display strings.
		val campaignString: String = if (campaign != "") {
			"🎯 $campaign"
		} else {
			"⚠️ Please select one in the Select Campaign option"
		}
		
		// Parse character event data to get character names.
		val characterNames = try {
			if (characterEventData.isNotEmpty()) {
				val characterDataJson = JSONObject(characterEventData)
				characterDataJson.keys().asSequence().toList()
			} else {
				emptyList()
			}
		} catch (e: Exception) {
			emptyList()
		}
		
		val characterString: String = if (selectAllCharacters) {
			"👥 All Characters Selected"
		} else if (characterNames.isEmpty()) {
			"⚠️ Please select one in the Training Event Settings"
		} else {
			"👤 ${characterNames.joinToString(", ")}"
		}
		
		// Parse support event data to get support card names.
		val supportCardNames = try {
			if (supportEventData.isNotEmpty()) {
				val supportDataJson = JSONObject(supportEventData)
				supportDataJson.keys().asSequence().toList()
			} else {
				emptyList()
			}
		} catch (e: Exception) {
			emptyList()
		}
		
		val supportCardListString: String = if (selectAllSupportCards) {
			"🃏 All Support Cards Selected"
		} else if (supportCardNames.isEmpty()) {
			"⚠️ None Selected"
		} else {
			"🃏 ${supportCardNames.joinToString(", ")}"
		}
		
		val trainingBlacklistString: String = if (trainingBlacklist.isEmpty()) {
			"✅ No Trainings blacklisted"
		} else {
			val defaultTrainingOrder = listOf("Speed", "Stamina", "Power", "Guts", "Wit")
			val sortedBlacklist = trainingBlacklist.sortedBy { defaultTrainingOrder.indexOf(it) }
			"🚫 ${sortedBlacklist.joinToString(", ")}"
		}
		
		val statPrioritizationString: String = "📊 Stat Prioritization: ${statPrioritization.joinToString(", ")}"
		
		val focusOnSparkString: String = if (focusOnSparkStatTarget) {
			"✨ Focus on Sparks for Stat Targets: ✅"
		} else {
			"✨ Focus on Sparks for Stat Targets: ❌"
		}
		
		val sprintTargetsString = "Sprint: \n\t\tSpeed: $sprintSpeedTarget\t\tStamina: $sprintStaminaTarget\t\tPower: $sprintPowerTarget\n\t\tGuts: $sprintGutsTarget\t\t\tWit: $sprintWitTarget"
		val mileTargetsString = "Mile: \n\t\tSpeed: $mileSpeedTarget\t\tStamina: $mileStaminaTarget\t\tPower: $milePowerTarget\n\t\tGuts: $mileGutsTarget\t\t\tWit: $mileWitTarget"
		val mediumTargetsString = "Medium: \n\t\tSpeed: $mediumSpeedTarget\t\tStamina: $mediumStaminaTarget\t\tPower: $mediumPowerTarget\n\t\tGuts: $mediumGutsTarget\t\t\tWit: $mediumWitTarget"
		val longTargetsString = "Long: \n\t\tSpeed: $longSpeedTarget\t\tStamina: $longStaminaTarget\t\tPower: $longPowerTarget\n\t\tGuts: $longGutsTarget\t\t\tWit: $longWitTarget"

		////////////////////////////////////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////////////////////////////
		
		// Build the settings string.
		val settingsString = buildString {
			appendLine("Campaign Selected: $campaignString")
			appendLine()
			appendLine("---------- Training Event Options ----------")
			appendLine("Character Selected: $characterString")
			appendLine("Support(s) Selected: $supportCardListString")
			appendLine()
			appendLine("---------- Training Options ----------")
			appendLine("Training Blacklist: $trainingBlacklistString")
			appendLine(statPrioritizationString)
			appendLine("Maximum Failure Chance Allowed: $maximumFailureChance%")
			appendLine("Disable Training on Maxed Stat: ${if (disableTrainingOnMaxedStat) "✅" else "❌"}")
			appendLine(focusOnSparkString)
			appendLine()
			appendLine("---------- Training Stat Targets by Distance ----------")
			appendLine(sprintTargetsString)
			appendLine(mileTargetsString)
			appendLine(mediumTargetsString)
			appendLine(longTargetsString)
			appendLine()
			appendLine("---------- Tesseract OCR Optimization ----------")
			appendLine("OCR Threshold: $threshold")
			appendLine("Enable Automatic OCR retry: ${if (enableAutomaticRetry) "✅" else "❌"}")
			appendLine("Minimum OCR Confidence: $ocrConfidence")
			appendLine()
			appendLine("---------- Racing Options ----------")
			appendLine("Prioritize Farming Fans: ${if (enableFarmingFans) "✅" else "❌"}")
			appendLine("Modulo Days to Farm Fans: ${if (enableFarmingFans) "📅 $daysToRunExtraRaces days" else "❌"}")
			appendLine("Disable Race Retries: ${if (disableRaceRetries) "✅" else "❌"}")
			appendLine("Stop on Mandatory Race: ${if (enableStopOnMandatoryRace) "✅" else "❌"}")
			appendLine("Force Racing Every Day: ${if (enableForceRacing) "✅" else "❌"}")
			appendLine()
			appendLine("---------- Misc Options ----------")
			appendLine("Skill Point Check: ${if (enableSkillPointCheck) "✅ Stop on $skillPointCheck Skill Points or more" else "❌"}")
			appendLine("Popup Check: ${if (enablePopupCheck) "✅" else "❌"}")
			appendLine("Prioritize Energy Options: ${if (enablePrioritizeEnergyOptions) "✅" else "❌"}")
			appendLine()
			appendLine("---------- Debug Options ----------")
			appendLine("Debug Mode: ${if (debugMode) "✅" else "❌"}")
			appendLine("Minimum Template Match Confidence: $confidence")
			appendLine("Custom Scale: ${customScale.toDouble() / 100.0}")
			appendLine("Start Template Matching Test: ${if (debugModeStartTemplateMatchingTest) "✅" else "❌"}")
			appendLine("Start Single Training Failure OCR Test: ${if (debugModeStartSingleTrainingFailureOCRTest) "✅" else "❌"}")
			appendLine("Start Comprehensive Training Failure OCR Test: ${if (debugModeStartComprehensiveTrainingFailureOCRTest) "✅" else "❌"}")
			appendLine("Hide String Comparison Results: ${if (hideComparisonResults) "✅" else "❌"}")
		}

		////////////////////////////////////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////////////////////////////
		
		// Use the provided printToLog function if available. Otherwise return the string.
		if (printToLog != null) {
			printToLog("\n[SETTINGS] Current Bot Configuration:")
			printToLog("=====================================")
			settingsString.split("\n").forEach { line ->
				if (line.isNotEmpty()) {
					printToLog(line)
				}
			}
			printToLog("=====================================\n")
		}

		return settingsString
	}
	
	/**
	 * Get the formatted settings string for display in UI components.
	 * 
	 * @param context The application context
	 * @return Formatted string containing all current settings
	 */
	fun getSettingsString(context: Context): String {
		return printCurrentSettings(context)
	}
}