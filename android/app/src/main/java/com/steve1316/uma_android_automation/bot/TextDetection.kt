package com.steve1316.uma_android_automation.bot

import android.content.SharedPreferences
import android.util.Log
import androidx.preference.PreferenceManager
import com.steve1316.uma_android_automation.MainActivity
import com.steve1316.uma_android_automation.data.CharacterData
import com.steve1316.uma_android_automation.data.SupportData
import com.steve1316.uma_android_automation.utils.ImageUtils
import net.ricecode.similarity.JaroWinklerStrategy
import net.ricecode.similarity.StringSimilarityServiceImpl

class TextDetection(private val game: Game, private val imageUtils: ImageUtils) {
	private val tag: String = "[${MainActivity.loggerTag}]TextDetection"
	
	private var sharedPreferences: SharedPreferences = PreferenceManager.getDefaultSharedPreferences(game.myContext)
	
	private var result = ""
	private var confidence = 0.0
	private var category = ""
	private var eventTitle = ""
	private var supportCardTitle = ""
	private var eventOptionRewards: ArrayList<String> = arrayListOf()
	
	private var character = sharedPreferences.getString("character", "")!!
	private val supportCards: List<String> = sharedPreferences.getString("supportList", "")!!.split("|")
	private val hideComparisonResults: Boolean = sharedPreferences.getBoolean("hideComparisonResults", false)
	private val selectAllCharacters: Boolean = sharedPreferences.getBoolean("selectAllCharacters", true)
	private val selectAllSupportCards: Boolean = sharedPreferences.getBoolean("selectAllSupportCards", true)
	private var minimumConfidence = sharedPreferences.getInt("ocrConfidence", 80).toDouble() / 100.0
	private val threshold = sharedPreferences.getInt("threshold", 230).toDouble()
	private val enableAutomaticRetry = sharedPreferences.getBoolean("enableAutomaticRetry", false)

	/**
	 * Fix incorrect characters determined by OCR by replacing them with their Japanese equivalents.
	 */
	private fun fixIncorrectCharacters() {
		game.printToLog("\n[TEXT-DETECTION] Now attempting to fix incorrect characters in: $result", tag = tag)
		
		if (result.last() == '/') {
			result = result.replace("/", "！")
		}
		
		result = result.replace("(", "（").replace(")", "）")
		game.printToLog("[TEXT-DETECTION] Finished attempting to fix incorrect characters: $result", tag = tag)
	}
	
	/**
	 * Attempt to find the most similar string from data compared to the string returned by OCR.
	 */
	private fun findMostSimilarString() {
		if (!hideComparisonResults) {
			game.printToLog("\n[TEXT-DETECTION] Now starting process to find most similar string to: $result\n", tag = tag)
		} else {
			game.printToLog("\n[TEXT-DETECTION] Now starting process to find most similar string to: $result", tag = tag)
		}
		
		// Remove any detected whitespaces.
		result = result.replace(" ", "")
		
		// Use the Jaro Winkler algorithm to compare similarities the OCR detected string and the rest of the strings inside the data classes.
		val service = StringSimilarityServiceImpl(JaroWinklerStrategy())
		
		// Attempt to find the most similar string inside the data classes starting with the Character-specific events.
		if (selectAllCharacters) {
			CharacterData.characters.keys.forEach { characterKey ->
				CharacterData.characters[characterKey]?.forEach { (eventName, eventOptions) ->
					val score = service.score(result, eventName)
					if (!hideComparisonResults) {
						game.printToLog("[CHARA] $characterKey \"${result}\" vs. \"${eventName}\" confidence: $score", tag = tag)
					}
					
					if (score >= confidence) {
						confidence = score
						eventTitle = eventName
						eventOptionRewards = eventOptions
						category = "character"
						character = characterKey
					}
				}
			}
		} else {
			CharacterData.characters[character]?.forEach { (eventName, eventOptions) ->
				val score = service.score(result, eventName)
				if (!hideComparisonResults) {
					game.printToLog("[CHARA] $character \"${result}\" vs. \"${eventName}\" confidence: $score", tag = tag)
				}
				
				if (score >= confidence) {
					confidence = score
					eventTitle = eventName
					eventOptionRewards = eventOptions
					category = "character"
				}
			}
		}
		
		// Now move on to the Character-shared events.
		CharacterData.characters["Shared"]?.forEach { (eventName, eventOptions) ->
			val score = service.score(result, eventName)
			if (!hideComparisonResults) {
				game.printToLog("[CHARA-SHARED] \"${result}\" vs. \"${eventName}\" confidence: $score", tag = tag)
			}
			
			if (score >= confidence) {
				confidence = score
				eventTitle = eventName
				eventOptionRewards = eventOptions
				category = "character-shared"
			}
		}
		
		// Finally, do the same with the user-selected Support Cards.
		if (!selectAllSupportCards) {
			supportCards.forEach { supportCardName ->
				SupportData.supports[supportCardName]?.forEach { (eventName, eventOptions) ->
					val score = service.score(result, eventName)
					if (!hideComparisonResults) {
						game.printToLog("[SUPPORT] $supportCardName \"${result}\" vs. \"${eventName}\" confidence: $score", tag = tag)
					}
					
					if (score >= confidence) {
						confidence = score
						eventTitle = eventName
						supportCardTitle = supportCardName
						eventOptionRewards = eventOptions
						category = "support"
					}
				}
			}
		} else {
			SupportData.supports.forEach { (supportName, support) ->
				support.forEach { (eventName, eventOptions) ->
					val score = service.score(result, eventName)
					if (!hideComparisonResults) {
						game.printToLog("[SUPPORT] $supportName \"${result}\" vs. \"${eventName}\" confidence: $score", tag = tag)
					}
					
					if (score >= confidence) {
						confidence = score
						eventTitle = eventName
						supportCardTitle = supportName
						eventOptionRewards = eventOptions
						category = "support"
					}
				}
			}
		}
		
		if (!hideComparisonResults) {
			game.printToLog("\n[TEXT-DETECTION] Finished process to find similar string.", tag = tag)
		} else {
			game.printToLog("[TEXT-DETECTION] Finished process to find similar string.", tag = tag)
		}
		game.printToLog("[TEXT-DETECTION] Event data fetched for \"${eventTitle}\".")
	}

	/**
	 * Parses a date string from the game and converts it to a structured Game.Date object.
	 * 
	 * This function handles two types of date formats: Pre-Debut and regular date strings.
	 * 
	 * For Pre-Debut dates, the function calculates the current turn based on remaining turns
	 * and determines the month within the Pre-Debut phase (which spans 12 turns).
	 * 
	 * For regular dates, the function parses the year (Junior/Classic/Senior), phase (Early/Late),
	 * and month (Jan-Dec) components. If exact matches aren't found in the predefined mappings,
	 * it uses Jaro Winkler similarity scoring to find the best match.
	 * 
	 * @param dateString The date string to parse (e.g., "Classic Year Early Jan" or "Pre-Debut")
	 *
	 * @return A Game.Date object containing the parsed year, phase, month, and calculated turn number.
	 */
	fun determineDateFromString(dateString: String): Game.Date {
		if (dateString == "") {
			game.printToLog("[ERROR] Received date string from OCR was empty. Defaulting to \"Senior Year Early Jan\" at turn number 49.", tag = tag)
			return Game.Date(3, "Early", 1, 49)
		} else if (dateString.lowercase().contains("debut")) {
			// Special handling for the Pre-Debut phase.
			val turnsRemaining = imageUtils.determineDayForExtraRace()

			// Pre-Debut ends on Early July (turn 13), so we calculate backwards.
			// This includes the Race day.
			val totalTurnsInPreDebut = 12
			val currentTurnInPreDebut = totalTurnsInPreDebut - turnsRemaining + 1

			val month = ((currentTurnInPreDebut - 1) / 2) + 1
			return Game.Date(1, "Pre-Debut", month, currentTurnInPreDebut)
		}

		// Example input is "Classic Year Early Jan".
		val years = mapOf(
			"Junior Year" to 1,
			"Classic Year" to 2,
			"Senior Year" to 3
		)
		val months = mapOf(
			"Jan" to 1,
			"Feb" to 2,
			"Mar" to 3,
			"Apr" to 4,
			"May" to 5,
			"Jun" to 6,
			"Jul" to 7,
			"Aug" to 8,
			"Sep" to 9,
			"Oct" to 10,
			"Nov" to 11,
			"Dec" to 12
		)

		// Split the input string by whitespace.
		val parts = dateString.trim().split(" ")
		if (parts.size < 3) {
			game.printToLog("[TEXT-DETECTION] Invalid date string format: $dateString", tag = tag)
			return Game.Date(3, "Early", 1, 49)
		}
 
		// Extract the parts with safe indexing using default values.
		val yearPart = parts.getOrNull(0)?.let { first -> 
			parts.getOrNull(1)?.let { second -> "$first $second" }
		} ?: "Senior Year"
		val phase = parts.getOrNull(2) ?: "Early"
		val monthPart = parts.getOrNull(3) ?: "Jan"

		// Find the best match for year using Jaro Winkler if not found in mapping.
		var year = years[yearPart]
		if (year == null) {
			val service = StringSimilarityServiceImpl(JaroWinklerStrategy())
			var bestYearScore = 0.0
			var bestYear = 3

			years.keys.forEach { yearKey ->
				val score = service.score(yearPart, yearKey)
				if (score > bestYearScore) {
					bestYearScore = score
					bestYear = years[yearKey]!!
				}
			}
			year = bestYear
			game.printToLog("[TEXT-DETECTION] Year not found in mapping, using best match: $yearPart -> $year", tag = tag)
		}

		// Find the best match for month using Jaro Winkler if not found in mapping.
		var month = months[monthPart]
		if (month == null) {
			val service = StringSimilarityServiceImpl(JaroWinklerStrategy())
			var bestMonthScore = 0.0
			var bestMonth = 1

			months.keys.forEach { monthKey ->
				val score = service.score(monthPart, monthKey)
				if (score > bestMonthScore) {
					bestMonthScore = score
					bestMonth = months[monthKey]!!
				}
			}
			month = bestMonth
			game.printToLog("[TEXT-DETECTION] Month not found in mapping, using best match: $monthPart -> $month", tag = tag)
		}

		// Calculate the turn number.
		// Each year has 24 turns (12 months x 2 phases each).
		// Each month has 2 turns (Early and Late).
		val turnNumber = ((year - 1) * 24) + ((month - 1) * 2) + (if (phase == "Early") 1 else 2)

		return Game.Date(year, phase, month, turnNumber)
	}
	
	fun start(): Pair<ArrayList<String>, Double> {
		if (minimumConfidence > 1.0) {
			minimumConfidence = 0.8
		}
		
		// Reset to default values.
		result = ""
		confidence = 0.0
		category = ""
		eventTitle = ""
		supportCardTitle = ""
		eventOptionRewards.clear()
		
		var increment = 0.0
		
		val startTime: Long = System.currentTimeMillis()
		while (true) {
			// Perform Tesseract OCR detection.
			if ((255.0 - threshold - increment) > 0.0) {
				result = imageUtils.findText(increment)
			} else {
				break
			}
			
			if (result.isNotEmpty() && result != "empty!") {
				// Make some minor improvements by replacing certain incorrect characters with their Japanese equivalents.
				fixIncorrectCharacters()
				
				// Now attempt to find the most similar string compared to the one from OCR.
				findMostSimilarString()
				
				when (category) {
					"character" -> {
						if (!hideComparisonResults) {
							game.printToLog("\n[RESULT] Character $character Event Name = $eventTitle with confidence = $confidence", tag = tag)
						}
					}
					"character-shared" -> {
						if (!hideComparisonResults) {
							game.printToLog("\n[RESULT] Character Shared Event Name = $eventTitle with confidence = $confidence", tag = tag)
						}
					}
					"support" -> {
						if (!hideComparisonResults) {
							game.printToLog("\n[RESULT] Support $supportCardTitle Event Name = $eventTitle with confidence = $confidence", tag = tag)
						}
					}
				}
				
				if (enableAutomaticRetry && !hideComparisonResults) {
					game.printToLog("\n[RESULT] Threshold incremented by $increment", tag = tag)
				}
				
				if (confidence < minimumConfidence && enableAutomaticRetry) {
					increment += 5.0
				} else {
					break
				}
			} else {
				increment += 5.0
			}
		}
		
		val endTime: Long = System.currentTimeMillis()
		Log.d(tag, "Total Runtime for detecting Text: ${endTime - startTime}ms")
		
		return Pair(eventOptionRewards, confidence)
	}
}