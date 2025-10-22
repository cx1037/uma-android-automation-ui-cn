package com.steve1316.uma_android_automation.bot

import com.steve1316.uma_android_automation.MainActivity
import com.steve1316.uma_android_automation.utils.SettingsHelper
import com.steve1316.uma_android_automation.utils.CustomImageUtils.RaceDetails
import com.steve1316.uma_android_automation.utils.SQLiteSettingsManager
import net.ricecode.similarity.JaroWinklerStrategy
import net.ricecode.similarity.StringSimilarityServiceImpl
import org.opencv.core.Point

class Racing (private val game: Game) {
    private val tag: String = "[${MainActivity.loggerTag}]Racing"

    private val enableFarmingFans = SettingsHelper.getBooleanSetting("racing", "enableFarmingFans")
    private val daysToRunExtraRaces: Int = SettingsHelper.getIntSetting("racing", "daysToRunExtraRaces")
    private val disableRaceRetries: Boolean = SettingsHelper.getBooleanSetting("racing", "disableRaceRetries")
    val enableForceRacing = SettingsHelper.getBooleanSetting("racing", "enableForceRacing")
    private val enableRacingPlan = SettingsHelper.getBooleanSetting("racing", "enableRacingPlan")
    private val lookAheadDays = SettingsHelper.getIntSetting("racing", "lookAheadDays")
    private var raceRetries = 3
    var raceRepeatWarningCheck = false
    var encounteredRacingPopup = false
    var skipRacing = false
    var firstTime = true

    private val enableStopOnMandatoryRace: Boolean = SettingsHelper.getBooleanSetting("racing", "enableStopOnMandatoryRaces")
    var detectedMandatoryRaceCheck = false

    companion object {
        private const val TABLE_RACES = "races"
        private const val RACES_COLUMN_NAME = "name"
        private const val RACES_COLUMN_GRADE = "grade"
        private const val RACES_COLUMN_FANS = "fans"
        private const val RACES_COLUMN_TURN_NUMBER = "turnNumber"
        private const val RACES_COLUMN_NAME_FORMATTED = "nameFormatted"
        private const val RACES_COLUMN_TERRAIN = "terrain"
        private const val RACES_COLUMN_DISTANCE_TYPE = "distanceType"
        private const val SIMILARITY_THRESHOLD = 0.7
    }

    data class RaceData(
        val name: String,
        val grade: String,
        val fans: Int,
        val nameFormatted: String,
        val terrain: String,
        val distanceType: String
    )

    data class ScoredRace(
        val raceData: RaceData,
        val score: Double,
        val fansScore: Double,
        val gradeScore: Double,
        val aptitudeBonus: Double
    )

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Handles the test to detect the currently displayed races on the Race List screen.
     */
    fun startRaceListDetectionTest() {
        game.printToLog("\n[TEST] Now beginning detection test on the Race List screen for the currently displayed races.", tag = tag)
        if (game.imageUtils.findImage("race_status").first == null) {
            game.printToLog("[TEST] Bot is not on the Race List screen. Ending the test.")
            return
        }

        // Detect the current date first.
        game.updateDate()

        // Check for all double star predictions.
        val doublePredictionLocations = game.imageUtils.findAll("race_extra_double_prediction")
        game.printToLog("[TEST] Found ${doublePredictionLocations.size} races with double predictions.", tag = tag)
        
        doublePredictionLocations.forEachIndexed { index, location ->
            val raceName = game.imageUtils.extractRaceName(location)
            game.printToLog("[TEST] Race #${index + 1} - Detected name: \"$raceName\".", tag = tag)
            
            // Query database for race details.
            val raceData = getRaceByTurnAndName(game.currentDate.turnNumber, raceName)
            
            if (raceData != null) {
                game.printToLog("[TEST] Race #${index + 1} - Match found:", tag = tag)
                game.printToLog("[TEST]   Name: ${raceData.name}", tag = tag)
                game.printToLog("[TEST]   Grade: ${raceData.grade}", tag = tag)
                game.printToLog("[TEST]   Fans: ${raceData.fans}", tag = tag)
                game.printToLog("[TEST]   Formatted: ${raceData.nameFormatted}", tag = tag)
            } else {
                game.printToLog("[TEST] Race #${index + 1} - No match found for turn ${game.currentDate.turnNumber}", tag = tag)
            }
        }
    }

    /**
     * Get race data by turn number and detected name using exact and/or fuzzy matching.
     * 
     * @param turnNumber The current turn number to match against.
     * @param detectedName The race name detected by OCR.
     * @return A [RaceData] object if a match is found, null otherwise.
     */
    fun getRaceByTurnAndName(turnNumber: Int, detectedName: String): RaceData? {
        val settingsManager = SQLiteSettingsManager(game.myContext)
        if (!settingsManager.initialize()) {
            game.printToLog("[ERROR] Database not available for race lookup.", tag = tag, isError = true)
            return null
        }

        return try {
            game.printToLog("[RACE] Looking up race for turn $turnNumber with detected name: \"$detectedName\".", tag = tag)
            
            // Do exact matching based on the info gathered.
            val exactMatch = findExactMatch(settingsManager, turnNumber, detectedName)
            if (exactMatch != null) {
                game.printToLog("[RACE] Found exact match: ${exactMatch.name}.", tag = tag)
                settingsManager.close()
                return exactMatch
            }
            
            // Otherwise, do fuzzy matching to find the most similar match using Jaro-Winkler.
            val fuzzyMatch = findFuzzyMatch(settingsManager, turnNumber, detectedName)
            if (fuzzyMatch != null) {
                game.printToLog("[RACE] Found fuzzy match: ${fuzzyMatch.name}.", tag = tag)
                settingsManager.close()
                return fuzzyMatch
            }
            
            game.printToLog("[RACE] No match found for turn $turnNumber with name \"$detectedName\".", tag = tag)
            settingsManager.close()
            null
        } catch (e: Exception) {
            game.printToLog("[ERROR] Error looking up race: ${e.message}.", tag = tag, isError = true)
            settingsManager.close()
            null
        }
    }

    /**
     * Queries the race database for an entry matching the specified turn number and formatted name.
     *
     * @param settingsManager The settings manager providing access to the race database.
     * @param turnNumber The turn number used to filter the race records.
     * @param detectedName The exact formatted race name to match against.
     * @return A [RaceData] object if an exact match is found, or null if no matching race exists.
     */
    private fun findExactMatch(settingsManager: SQLiteSettingsManager, turnNumber: Int, detectedName: String): RaceData? {
        val database = settingsManager.getDatabase()
        if (database == null) return null

        val cursor = database.query(
            TABLE_RACES,
            arrayOf(
                RACES_COLUMN_NAME,
                RACES_COLUMN_GRADE,
                RACES_COLUMN_FANS,
                RACES_COLUMN_NAME_FORMATTED,
                RACES_COLUMN_TERRAIN,
                RACES_COLUMN_DISTANCE_TYPE
            ),
            "$RACES_COLUMN_TURN_NUMBER = ? AND $RACES_COLUMN_NAME_FORMATTED = ?",
            arrayOf(turnNumber.toString(), detectedName),
            null, null, null
        )

        return if (cursor.moveToFirst()) {
            val race = RaceData(
                name = cursor.getString(0),
                grade = cursor.getString(1),
                fans = cursor.getInt(2),
                nameFormatted = cursor.getString(3),
                terrain = cursor.getString(4),
                distanceType = cursor.getString(5)
            )
            cursor.close()
            race
        } else {
            cursor.close()
            null
        }
    }

    /**
     * Attempts to find the best fuzzy match for a race entry based on the given formatted name.
     *
     * This function queries all races for the specified turn number, then compares each race’s
     * `nameFormatted` value to the provided [detectedName] using Jaro–Winkler string similarity.
     * The race with the highest similarity score above the defined [SIMILARITY_THRESHOLD] is returned.
     *
     * @param settingsManager The settings manager providing access to the race database.
     * @param turnNumber The turn number used to filter the race records.
     * @param detectedName The name to compare against existing formatted race names.
     * @return A [RaceData] object representing the best fuzzy match, or null if no similar race is found.
     */
    private fun findFuzzyMatch(settingsManager: SQLiteSettingsManager, turnNumber: Int, detectedName: String): RaceData? {
        val database = settingsManager.getDatabase()
        if (database == null) return null

        val cursor = database.query(
            TABLE_RACES,
            arrayOf(
                RACES_COLUMN_NAME,
                RACES_COLUMN_GRADE,
                RACES_COLUMN_FANS,
                RACES_COLUMN_NAME_FORMATTED,
                RACES_COLUMN_TERRAIN,
                RACES_COLUMN_DISTANCE_TYPE
            ),
            "$RACES_COLUMN_TURN_NUMBER = ?",
            arrayOf(turnNumber.toString()),
            null, null, null
        )

        if (!cursor.moveToFirst()) {
            cursor.close()
            return null
        }

        val similarityService = StringSimilarityServiceImpl(JaroWinklerStrategy())
        var bestMatch: RaceData? = null
        var bestScore = 0.0

        do {
            val nameFormatted = cursor.getString(3)
            val similarity = similarityService.score(detectedName, nameFormatted)
            
            if (similarity > bestScore && similarity >= SIMILARITY_THRESHOLD) {
                bestScore = similarity
                bestMatch = RaceData(
                    name = cursor.getString(0),
                    grade = cursor.getString(1),
                    fans = cursor.getInt(2),
                    nameFormatted = nameFormatted,
                    terrain = cursor.getString(4),
                    distanceType = cursor.getString(5)
                )
                game.printToLog("[RACE] Fuzzy match candidate: \"$nameFormatted\" with similarity ${game.decimalFormat.format(similarity)}.", tag = tag)
            }
        } while (cursor.moveToNext())

        cursor.close()
        
        if (bestMatch != null) {
            game.printToLog("[RACE] Best fuzzy match: \"${bestMatch.nameFormatted}\" with similarity ${game.decimalFormat.format(bestScore)}.", tag = tag)
        }
        
        return bestMatch
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////
    // Smart Racing Plan Functionality

    /**
     * Maps the distance/terrain type string to the corresponding aptitude field.
     * 
     * @param aptitudeType Either the distance type from race data ("Sprint", "Mile", "Medium", "Long") or the terrain ("Turf", "Dirt").
     * @return The corresponding aptitude value from the character's aptitudes.
     */
    private fun mapToAptitude(aptitudeType: String): String {
        return when (aptitudeType) {
            "Sprint" -> game.aptitudes.distance.sprint
            "Mile" -> game.aptitudes.distance.mile
            "Medium" -> game.aptitudes.distance.medium
            "Long" -> game.aptitudes.distance.long
            "Turf" -> game.aptitudes.track.turf
            "Dirt" -> game.aptitudes.track.dirt
            else -> "X"
        }
    }

    /**
     * Calculates a bonus value based on the race’s aptitude ratings for terrain and distance.
     *
     * This function checks whether both the terrain and distance aptitudes of the given race
     * are rated as "A" or "S". If both conditions are met, a bonus of 100.0 is returned;
     * otherwise, the result is 0.0.
     *
     * @param race The [RaceData] instance whose aptitudes are evaluated.
     * @return The bonus value based on whether the conditions are met.
     */
    private fun getAptitudeMatchBonus(race: RaceData): Double {
        val terrainAptitude = mapToAptitude(race.terrain)
        val distanceAptitude = mapToAptitude(race.distanceType)
        
        val terrainMatch = terrainAptitude == "A" || terrainAptitude == "S"
        val distanceMatch = distanceAptitude == "A" || distanceAptitude == "S"
        
        return if (terrainMatch && distanceMatch) 100.0 else 0.0
    }

    /**
     * Calculates a composite race score based on fan count, race grade, and aptitude performance.
     *
     * The score is derived from three weighted factors:
     * - **Fans:** Normalized to a 0–100 scale.
     * - **Grade:** Weighted to a map of values based on grade.
     * - **Aptitude:** Adds a bonus if both terrain and distance aptitudes are A or S.
     *
     * The final score is the average of these three components.
     *
     * @param race The [RaceData] instance to evaluate.
     * @return A [ScoredRace] object containing the final score and individual factor breakdowns.
     */
    fun calculateRaceScore(race: RaceData): ScoredRace {
        // Normalize fans to 0-100 scale (assuming max fans is 30000).
        val fansScore = (race.fans.toDouble() / 30000.0) * 100.0
        
        // Grade scoring: G1 = 75, G2 = 50, G3 = 25.
        val gradeScore = when (race.grade) {
            "G1" -> 75.0
            "G2" -> 50.0
            "G3" -> 25.0
            else -> 0.0
        }
        
        // Aptitude bonus: 100 if both terrain and distance match A/S, else 0.
        val aptitudeBonus = getAptitudeMatchBonus(race)
        
        // Calculate final score with equal weights.
        val finalScore = (fansScore + gradeScore + aptitudeBonus) / 3.0
        
        // Log detailed scoring breakdown for debugging.
        val terrainAptitude = mapToAptitude(race.terrain)
        val distanceAptitude = mapToAptitude(race.distanceType)
        game.printToLog(
            """
            [RACE] Scoring ${race.name}:
            Fans     = ${race.fans} (${game.decimalFormat.format(fansScore)})
            Grade    = ${race.grade} (${game.decimalFormat.format(gradeScore)})
            Terrain  = ${race.terrain} ($terrainAptitude)
            Distance = ${race.distanceType} ($distanceAptitude)
            Aptitude = ${game.decimalFormat.format(aptitudeBonus)}
            Final    = ${game.decimalFormat.format(finalScore)}
            """.trimIndent(),
            tag = tag
        )
        
        return ScoredRace(
            raceData = race,
            score = finalScore,
            fansScore = fansScore,
            gradeScore = gradeScore,
            aptitudeBonus = aptitudeBonus
        )
    }

    /**
     * Retrieves all races scheduled within a specified look-ahead window from the database.
     *
     * This function queries races whose turn numbers fall between [currentTurn] and
     * [currentTurn] + [lookAheadDays], inclusive. It returns the corresponding [RaceData]
     * entries sorted in ascending order by turn number.
     *
     * @param currentTurn The current turn number used as the starting point.
     * @param lookAheadDays The number of days (turns) to look ahead for upcoming races.
     * @return A list of [RaceData] objects representing all races within the look-ahead window.
     */
    fun getLookAheadRaces(currentTurn: Int, lookAheadDays: Int): List<RaceData> {
        val settingsManager = SQLiteSettingsManager(game.myContext)
        if (!settingsManager.initialize()) {
            game.printToLog("[ERROR] Database not available for look-ahead race lookup.", tag = tag, isError = true)
            return emptyList()
        }

        return try {
            val database = settingsManager.getDatabase()
            if (database == null) {
                game.printToLog("[ERROR] Database is null for look-ahead race lookup.", tag = tag, isError = true)
                return emptyList()
            }

            val endTurn = currentTurn + lookAheadDays
            val cursor = database.query(
                TABLE_RACES,
                arrayOf(
                    RACES_COLUMN_NAME,
                    RACES_COLUMN_GRADE,
                    RACES_COLUMN_FANS,
                    RACES_COLUMN_NAME_FORMATTED,
                    RACES_COLUMN_TERRAIN,
                    RACES_COLUMN_DISTANCE_TYPE
                ),
                "$RACES_COLUMN_TURN_NUMBER >= ? AND $RACES_COLUMN_TURN_NUMBER <= ?",
                arrayOf(currentTurn.toString(), endTurn.toString()),
                null, null, "$RACES_COLUMN_TURN_NUMBER ASC"
            )

            val races = mutableListOf<RaceData>()
            if (cursor.moveToFirst()) {
                do {
                    val race = RaceData(
                        name = cursor.getString(0),
                        grade = cursor.getString(1),
                        fans = cursor.getInt(2),
                        nameFormatted = cursor.getString(3),
                        terrain = cursor.getString(4),
                        distanceType = cursor.getString(5)
                    )
                    races.add(race)
                } while (cursor.moveToNext())
            }
            cursor.close()
            settingsManager.close()
            
            game.printToLog("[RACE] Found ${races.size} races in look-ahead window (turns $currentTurn to $endTurn).", tag = tag)
            races
        } catch (e: Exception) {
            game.printToLog("[ERROR] Error getting look-ahead races: ${e.message}", tag = tag, isError = true)
            settingsManager.close()
            emptyList()
        }
    }

    /**
     * Filters the given list of races according to the user’s Racing Plan settings.
     *
     * The filtering criteria are loaded from the Racing Plan configuration and include:
     * - **Minimum fans threshold:** Races must have at least this number of fans.
     * - **Preferred terrain:** Only races matching the specified terrain (or "Any") are included.
     * - **Preferred grades:** Races must match one of the preferred grade values.
     *
     * @param races The list of [RaceData] entries to filter.
     * @return A list of [RaceData] objects that satisfy all Racing Plan filter criteria.
     */
    fun filterRacesBySettings(races: List<RaceData>): List<RaceData> {
        val minFansThreshold = SettingsHelper.getIntSetting("racing", "minFansThreshold")
        val preferredTerrain = SettingsHelper.getStringSetting("racing", "preferredTerrain")
        
        // Parse preferred grades from JSON array string.
        val preferredGradesString = SettingsHelper.getStringSetting("racing", "preferredGrades")
        game.printToLog("[RACE] Raw preferred grades string: \"$preferredGradesString\".", tag = tag)
        val preferredGrades = try {
            // Parse as JSON array.
            val jsonArray = org.json.JSONArray(preferredGradesString)
            val parsed = (0 until jsonArray.length()).map { jsonArray.getString(it) }
            game.printToLog("[RACE] Parsed as JSON array: $parsed.", tag = tag)
            parsed
        } catch (e: Exception) {
            game.printToLog("[RACE] Error parsing preferred grades: ${e.message}, using fallback.", tag = tag)
            val parsed = preferredGradesString.split(",").map { it.trim() }
            game.printToLog("[RACE] Fallback parsing result: $parsed", tag = tag)
            parsed
        }

        game.printToLog("[RACE] Filter criteria: Min fans: $minFansThreshold, terrain: $preferredTerrain, grades: $preferredGrades", tag = tag)
        
        val filteredRaces = races.filter { race ->
            val meetsFansThreshold = race.fans >= minFansThreshold
            val meetsTerrainPreference = preferredTerrain == "Any" || race.terrain == preferredTerrain
            val meetsGradePreference = preferredGrades.isEmpty() || preferredGrades.contains(race.grade)
            
            val passes = meetsFansThreshold && meetsTerrainPreference && meetsGradePreference

            // If the race did not pass any of the filters, print the reason why.
            if (!passes) {
                val reasons = mutableListOf<String>()
                if (!meetsFansThreshold) reasons.add("fans ${race.fans} < $minFansThreshold")
                if (!meetsTerrainPreference) reasons.add("terrain ${race.terrain} != $preferredTerrain")
                if (!meetsGradePreference) reasons.add("grade ${race.grade} not in $preferredGrades")
                game.printToLog("[RACE] ✗ Filtered out ${race.name}: ${reasons.joinToString(", ")}", tag = tag)
            } else {
                game.printToLog("[RACE] ✓ Passed filter: ${race.name} (fans: ${race.fans}, terrain: ${race.terrain}, grade: ${race.grade})", tag = tag)
            }
            
            passes
        }
        
        return filteredRaces
    }

    /**
     * Determines the optimal race to participate in within the upcoming window by scoring all candidates.
     *
     * Each race in [filteredUpcomingRaces] is evaluated using [calculateRaceScore], which considers
     * fans, grade, and aptitude performance. The race with the highest overall score is returned.
     *
     * @param filteredUpcomingRaces The list of [RaceData] entries that passed prior filters.
     * @return The [ScoredRace] with the highest score, or null if the list is empty.
     */
    fun findBestRaceInWindow(filteredUpcomingRaces: List<RaceData>): ScoredRace? {
        game.printToLog("[RACE] Finding best race in window from ${filteredUpcomingRaces.size} races after filters...", tag = tag)
        
        if (filteredUpcomingRaces.isEmpty()) {
            game.printToLog("[RACE] No races provided after filters, cannot find best race.", tag = tag)
            return null
        }

        // For each upcoming race, calculate their score.
        val scoredRaces = filteredUpcomingRaces.map { calculateRaceScore(it) }
        val sortedScoredRaces = scoredRaces.sortedByDescending { it.score }
        game.printToLog("[RACE] Scored all races (sorted by score descending):", tag = tag)
        sortedScoredRaces.forEach { scoredRace ->
            game.printToLog("[RACE]   ${scoredRace.raceData.name}: score=${game.decimalFormat.format(scoredRace.score)}, " +
                    "fans=${scoredRace.raceData.fans}(${game.decimalFormat.format(scoredRace.fansScore)}), " +
                    "grade=${scoredRace.raceData.grade}(${game.decimalFormat.format(scoredRace.gradeScore)}), " +
                    "aptitude=${game.decimalFormat.format(scoredRace.aptitudeBonus)}",
                tag = tag
            )
        }
        
        val bestRace = sortedScoredRaces.maxByOrNull { it.score }
        
        if (bestRace != null) {
            game.printToLog("[RACE] Best race in window: ${bestRace.raceData.name} (score: ${game.decimalFormat.format(bestRace.score)})", tag = tag)
            game.printToLog("[RACE]   Fans: ${bestRace.raceData.fans} (${game.decimalFormat.format(bestRace.fansScore)}), Grade: ${bestRace.raceData.grade} (${game.decimalFormat.format(bestRace.gradeScore)}), Aptitude: ${game.decimalFormat.format(bestRace.aptitudeBonus)}", tag = tag)
        } else {
            game.printToLog("[RACE] Failed to determine best race from scored races.", tag = tag)
        }
        
        return bestRace
    }

    /**
     * Determines whether the bot should race immediately or wait for a better opportunity using
     * Opportunity Cost analysis.
     *
     * The decision is based on comparing the best currently available races with upcoming races
     * within the specified look-ahead window. Each race is scored using [calculateRaceScore],
     * taking into account fans, grade, and aptitude. The function applies a time decay factor to
     * upcoming races and evaluates whether the expected improvement from waiting exceeds a
     * predefined threshold.
     *
     * Decision logic:
     * 1. If no current races are available, the bot cannot race.
     * 2. Scores current races and identifies the best option.
     * 3. Looks ahead [lookAheadDays] turns to find and filter upcoming races, then scores them.
     * 4. Applies time decay and calculates the potential improvement from waiting.
     * 5. Compares improvement against thresholds to decide whether to race now or wait.
     *
     * @param currentRaces List of currently available [RaceData] races.
     * @param lookAheadDays Number of turns/days to consider for upcoming races.
     * @return True if the bot should race now, false if it is better to wait for a future race.
     */
    fun shouldRaceNow(currentRaces: List<RaceData>, lookAheadDays: Int): Boolean {
        game.printToLog("[RACE] Evaluating whether to race now using Opportunity Cost logic...", tag = tag)
        if (currentRaces.isEmpty()) {
            game.printToLog("[RACE] No current races available, cannot race now.", tag = tag)
            return false
        }
        
        // Score current races.
        game.printToLog("[RACE] Scoring ${currentRaces.size} current races (sorted by score descending):", tag = tag)
        val currentScoredRaces = currentRaces.map { calculateRaceScore(it) }
        val sortedScoredRaces = currentScoredRaces.sortedByDescending { it.score }
        sortedScoredRaces.forEach { scoredRace ->
            game.printToLog("[RACE]   Current race: ${scoredRace.raceData.name} (score: ${game.decimalFormat.format(scoredRace.score)})", tag = tag)
        }
        val bestCurrentRace = sortedScoredRaces.maxByOrNull { it.score }
        
        if (bestCurrentRace == null) {
            game.printToLog("[RACE] Failed to score current races, cannot race now.", tag = tag)
            return false
        }
        
        game.printToLog("[RACE] Best current race: ${bestCurrentRace.raceData.name} (score: ${game.decimalFormat.format(bestCurrentRace.score)})", tag = tag)
        
        // Get and score upcoming races.
        game.printToLog("[RACE] Looking ahead $lookAheadDays days for upcoming races...", tag = tag)
        val upcomingRaces = getLookAheadRaces(game.currentDate.turnNumber + 1, lookAheadDays)
        game.printToLog("[RACE] Found ${upcomingRaces.size} upcoming races in database.", tag = tag)
        
        val filteredUpcomingRaces = filterRacesBySettings(upcomingRaces)
        game.printToLog("[RACE] After filtering: ${filteredUpcomingRaces.size} upcoming races remain.", tag = tag)
        
        val bestUpcomingRace = findBestRaceInWindow(filteredUpcomingRaces)
        
        if (bestUpcomingRace == null) {
            game.printToLog("[RACE] No suitable upcoming races found, racing now with best current option.", tag = tag)
            return true
        }
        
        game.printToLog("[RACE] Best upcoming race: ${bestUpcomingRace.raceData.name} (score: ${game.decimalFormat.format(bestUpcomingRace.score)}).", tag = tag)
        
        // Opportunity Cost Logic.
        val minimumQualityThreshold = 50.0  // Don't race anything scoring below 50.
        val timeDecayFactor = 0.90  // Future races worth 90% of their score.
        val improvementThreshold = 15.0  // Only wait if improvement > 15 points.

        // Apply time decay to upcoming race score.
        val discountedUpcomingScore = bestUpcomingRace.score * timeDecayFactor
        
        // Calculate opportunity cost: How much better is waiting?
        val improvementFromWaiting = discountedUpcomingScore - bestCurrentRace.score
        
        // Decision criteria.
        val isGoodEnough = bestCurrentRace.score >= minimumQualityThreshold
        val notWorthWaiting = improvementFromWaiting < improvementThreshold
        val shouldRace = isGoodEnough && notWorthWaiting
        
        game.printToLog("[RACE] Opportunity Cost Analysis:", tag = tag)
        game.printToLog("[RACE]   Current score: ${game.decimalFormat.format(bestCurrentRace.score)}", tag = tag)
        game.printToLog("[RACE]   Upcoming score (raw): ${game.decimalFormat.format(bestUpcomingRace.score)}", tag = tag)
        game.printToLog("[RACE]   Upcoming score (discounted by ${game.decimalFormat.format((1 - timeDecayFactor) * 100)}%): ${game.decimalFormat.format(discountedUpcomingScore)}", tag = tag)
        game.printToLog("[RACE]   Improvement from waiting: ${game.decimalFormat.format(improvementFromWaiting)}", tag = tag)
        game.printToLog("[RACE]   Quality check (≥${minimumQualityThreshold}): ${if (isGoodEnough) "PASS" else "FAIL"}", tag = tag)
        game.printToLog("[RACE]   Worth waiting check (<${improvementThreshold}): ${if (notWorthWaiting) "PASS" else "FAIL"}", tag = tag)
        game.printToLog("[RACE]   Decision: ${if (shouldRace) "RACE NOW" else "WAIT FOR BETTER OPPORTUNITY"}", tag = tag)

        // Print the reasoning for the decision.
        if (shouldRace) {
            game.printToLog("[RACE] Reasoning: Current race is good enough (${game.decimalFormat.format(bestCurrentRace.score)} ≥ ${minimumQualityThreshold}) and waiting only gives ${game.decimalFormat.format(improvementFromWaiting)} more points (less than ${improvementThreshold}).", tag = tag)
        } else {
            val reason = if (!isGoodEnough) {
                "Current race quality too low (${game.decimalFormat.format(bestCurrentRace.score)} < ${minimumQualityThreshold})."
            } else {
                "Worth waiting for better opportunity (+${game.decimalFormat.format(improvementFromWaiting)} points > ${improvementThreshold})."
            }
            game.printToLog("[RACE] Reasoning: $reason", tag = tag)
        }
        
        return shouldRace
    }

    /**
     * Handles extra races using Smart Racing logic for Senior Year (Year 3).
     *
     * This function performs the following steps:
     * 1. Updates the current date and aptitudes for accurate scoring.
     * 2. Detects all double-star race predictions on screen.
     * 3. Extracts race names from the screen and matches them with the in-game database.
     * 4. Filters matched races based on user Racing Plan settings.
     * 5. Evaluates whether the bot should race now using Opportunity Cost logic.
     * 6. Finds the best race from the filtered list.
     * 7. Locates the best race on screen and selects it.
     *
     * @return True if a race was successfully selected and ready to run; false if the process was canceled.
     */
    private fun handleSmartRacing(): Boolean {
        game.printToLog("[RACE] Using Smart Racing Plan logic for the Senior Year...", tag = tag)

        // 1. Updates the current date and aptitudes for accurate scoring.
        game.updateDate()
        game.updateAptitudes()

        // 2. Detects all double-star race predictions on screen.
        val doublePredictionLocations = game.imageUtils.findAll("race_extra_double_prediction")
        game.printToLog("[RACE] Found ${doublePredictionLocations.size} double-star prediction locations.", tag = tag)
        if (doublePredictionLocations.isEmpty()) {
            game.printToLog("[RACE] No double-star predictions found. Canceling racing process.", tag = tag)
            return false
        }

        // 3. Extracts race names from the screen and matches them with the in-game database.
        game.printToLog("[RACE] Extracting race names and matching with database...", tag = tag)
        val currentRaces = doublePredictionLocations.mapNotNull { location ->
            val raceName = game.imageUtils.extractRaceName(location)
            val raceData = getRaceByTurnAndName(game.currentDate.turnNumber, raceName)
            if (raceData != null) {
                game.printToLog("[RACE] ✓ Matched in database: ${raceData.name} (Grade: ${raceData.grade}, Fans: ${raceData.fans}, Terrain: ${raceData.terrain}).", tag = tag)
                raceData
            } else {
                game.printToLog("[RACE] ✗ No match found in database for \"$raceName\".", tag = tag)
                null
            }
        }

        if (currentRaces.isEmpty()) {
            game.printToLog("[RACE] No races matched in database. Canceling racing process.", tag = tag)
            return false
        }
        game.printToLog("[RACE] Successfully matched ${currentRaces.size} races in database.", tag = tag)

        // 4. Filters matched races based on user Racing Plan settings.
        val filteredRaces = filterRacesBySettings(currentRaces)
        game.printToLog("[RACE] After filtering: ${filteredRaces.size} races remain.", tag = tag)
        if (filteredRaces.isEmpty()) {
            game.printToLog("[RACE] No races match current settings. Canceling racing process.", tag = tag)
            return false
        }

        // 5. Evaluates whether the bot should race now using Opportunity Cost logic.
        if (!shouldRaceNow(filteredRaces, lookAheadDays)) {
            game.printToLog("[RACE] Smart racing suggests waiting for better opportunities. Canceling racing process.", tag = tag)
            return false
        }

        // 6. Finds the best race from the filtered list.
        val bestRace = findBestRaceInWindow(filteredRaces) ?: run {
            game.printToLog("[RACE] No suitable race found. Canceling racing process.", tag = tag)
            return false
        }

        // 7. Locates the best race on screen and selects it.
        game.printToLog("[RACE] Looking for target race \"${bestRace.raceData.name}\" on screen...", tag = tag)
        val targetRaceLocation = doublePredictionLocations.find { location ->
            val raceName = game.imageUtils.extractRaceName(location)
            val raceData = getRaceByTurnAndName(game.currentDate.turnNumber, raceName)
            val matches = raceData?.name == bestRace.raceData.name
            if (matches) game.printToLog("[RACE] ✓ Found target race at location (${location.x}, ${location.y}).", tag = tag)
            matches
        } ?: run {
            game.printToLog("[RACE] Could not find target race \"${bestRace.raceData.name}\" on screen. Canceling racing process.", tag = tag)
            return false
        }

        game.printToLog("[RACE] Selecting smart racing choice: ${bestRace.raceData.name} (score: ${game.decimalFormat.format(bestRace.score)}).", tag = tag)
        game.tap(targetRaceLocation.x, targetRaceLocation.y, "race_extra_double_prediction", ignoreWaiting = true)

        return true
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Checks if the day number is odd to be eligible to run an extra race, excluding Summer where extra racing is not allowed.
     *
     * @return True if the day number is odd. Otherwise false.
     */
    fun checkExtraRaceAvailability(): Boolean {
        val dayNumber = game.imageUtils.determineDayForExtraRace()
        game.printToLog("\n[INFO] Current remaining number of days before the next mandatory race: $dayNumber.", tag = tag)

        // If the setting to force racing extra races is enabled, always return true.
        if (enableForceRacing) return true

        // Check if smart racing is enabled - if so, use smartRacingCheckInterval instead of daysToRunExtraRaces.
        // Additionally, it makes sure that it always run at the beginning for the first time in order to score upcoming races.
        val enableRacingPlan = SettingsHelper.getBooleanSetting("racing", "enableRacingPlan")
        if (firstTime || (enableRacingPlan && enableFarmingFans)) {
            val smartRacingCheckInterval = SettingsHelper.getIntSetting("racing", "smartRacingCheckInterval")
            firstTime = false
            return dayNumber % smartRacingCheckInterval == 0 && !raceRepeatWarningCheck &&
                    game.imageUtils.findImage("race_select_extra_locked_uma_finals", tries = 1, region = game.imageUtils.regionBottomHalf).first == null &&
                    game.imageUtils.findImage("race_select_extra_locked", tries = 1, region = game.imageUtils.regionBottomHalf).first == null &&
                    game.imageUtils.findImage("recover_energy_summer", tries = 1, region = game.imageUtils.regionBottomHalf).first == null
        }

        return enableFarmingFans && dayNumber % daysToRunExtraRaces == 0 && !raceRepeatWarningCheck &&
                game.imageUtils.findImage("race_select_extra_locked_uma_finals", tries = 1, region = game.imageUtils.regionBottomHalf).first == null &&
                game.imageUtils.findImage("race_select_extra_locked", tries = 1, region = game.imageUtils.regionBottomHalf).first == null &&
                game.imageUtils.findImage("recover_energy_summer", tries = 1, region = game.imageUtils.regionBottomHalf).first == null
    }

    /**
     * Handles extra races using the standard or traditional racing logic.
     *
     * This function performs the following steps:
     * 1. Detects double-star races on screen.
     * 2. If only one race has double predictions, selects it immediately.
     * 3. Otherwise, iterates through each extra race to determine fan gain and double prediction status.
     * 4. Evaluates which race to select based on maximum fans and double prediction priority (if force racing is enabled).
     * 5. Selects the determined race on screen.
     *
     * @return True if a race was successfully selected; false if the process was canceled.
     */
    private fun handleStandardRacing(): Boolean {
        game.printToLog("[RACE] Using traditional racing logic for extra races...", tag = tag)

        val doublePredictionLocations = game.imageUtils.findAll("race_extra_double_prediction")
        val maxCount = doublePredictionLocations.size
        if (maxCount == 0) {
            game.printToLog("[WARNING] No extra races found on screen. Canceling racing process.", tag = tag)
            return false
        }

        // If only one double-prediction race, select it immediately.
        if (doublePredictionLocations.size == 1) {
            game.printToLog("[RACE] Only one race with double predictions. Selecting it.", tag = tag)
            game.tap(doublePredictionLocations[0].x, doublePredictionLocations[0].y, "race_extra_double_prediction", ignoreWaiting = true)
            return true
        }

        // Multiple races: detect fan numbers and double predictions.
        val (sourceBitmap, templateBitmap) = game.imageUtils.getBitmaps("race_extra_double_prediction")
        val listOfRaces = ArrayList<RaceDetails>()
        val extraRaceLocations = ArrayList<Point>()

        for (count in 0 until maxCount) {
            val selectedExtraRace = game.imageUtils.findImage("race_extra_selection", region = game.imageUtils.regionBottomHalf).first ?: break
            extraRaceLocations.add(selectedExtraRace)

            val raceDetails = game.imageUtils.determineExtraRaceFans(selectedExtraRace, sourceBitmap, templateBitmap!!, forceRacing = enableForceRacing)
            listOfRaces.add(raceDetails)

            if (count + 1 < maxCount) {
                val nextX = if (game.imageUtils.isTablet) {
                    game.imageUtils.relX(selectedExtraRace.x, (-100 * 1.36).toInt())
                } else {
                    game.imageUtils.relX(selectedExtraRace.x, -100)
                }

                val nextY = if (game.imageUtils.isTablet) {
                    game.imageUtils.relY(selectedExtraRace.y, (150 * 1.50).toInt())
                } else {
                    game.imageUtils.relY(selectedExtraRace.y, 150)
                }

                game.tap(nextX.toDouble(), nextY.toDouble(), "race_extra_selection", ignoreWaiting = true)
            }

            game.wait(0.5)
        }

        // Determine max fans and select the appropriate race.
        val maxFans = listOfRaces.maxOfOrNull { it.fans } ?: -1
        if (maxFans == -1) return false
        game.printToLog("[RACE] Number of fans detected for each extra race are: ${listOfRaces.joinToString(", ") { it.fans.toString() }}", tag = tag)

        // Get the index of the maximum fans or the one with the double predictions if available when force racing is enabled.
        val index = if (!enableForceRacing) {
            listOfRaces.indexOfFirst { it.fans == maxFans }
        } else {
            listOfRaces.indexOfFirst { it.hasDoublePredictions }.takeIf { it != -1 } ?: listOfRaces.indexOfFirst { it.fans == maxFans }
        }

        game.printToLog("[RACE] Selecting extra race at option #${index + 1}.", tag = tag)
        val target = extraRaceLocations[index]
        game.tap(target.x - game.imageUtils.relWidth((100 * 1.36).toInt()), target.y - game.imageUtils.relHeight(70), "race_extra_selection", ignoreWaiting = true)

        return true
    }

    /**
     * The entry point for handling mandatory or extra races.
     *
     * @return True if the mandatory/extra race was completed successfully. Otherwise false.
     */
    fun handleRaceEvents(): Boolean {
        game.printToLog("\n[RACE] Starting Racing process...", tag = tag)
        if (encounteredRacingPopup) {
            // Dismiss the insufficient fans popup here and head to the Race Selection screen.
            game.findAndTapImage("race_confirm", tries = 1, region = game.imageUtils.regionBottomHalf)
            encounteredRacingPopup = false
            game.wait(1.0)
        }

        // If there are no races available, cancel the racing process.
        if (game.imageUtils.findImage("race_none_available", tries = 1, region = game.imageUtils.regionMiddle, suppressError = true).first != null) {
            game.printToLog("[RACE] There are no races to compete in. Canceling the racing process and doing something else.", tag = tag)
            return false
        }

        skipRacing = false

        // First, check if there is a mandatory or a extra race available. If so, head into the Race Selection screen.
        // Note: If there is a mandatory race, the bot would be on the Home screen.
        // Otherwise, it would have found itself at the Race Selection screen already (by way of the insufficient fans popup).
        if (game.findAndTapImage("race_select_mandatory", tries = 1, region = game.imageUtils.regionBottomHalf)) {
            game.printToLog("\n[RACE] Starting process for handling a mandatory race.", tag = tag)

            if (enableStopOnMandatoryRace) {
                detectedMandatoryRaceCheck = true
                return false
            } else if (enableForceRacing) {
                game.findAndTapImage("ok", tries = 1, region = game.imageUtils.regionMiddle)
                game.wait(1.0)
            }

            // There is a mandatory race. Now confirm the selection and the resultant popup and then wait for the game to load.
            game.wait(2.0)
            game.printToLog("[RACE] Confirming the mandatory race selection.", tag = tag)
            game.findAndTapImage("race_confirm", tries = 3, region = game.imageUtils.regionBottomHalf)
            game.wait(1.0)
            game.printToLog("[RACE] Confirming any popup from the mandatory race selection.", tag = tag)
            game.findAndTapImage("race_confirm", tries = 3, region = game.imageUtils.regionBottomHalf)
            game.wait(2.0)

            game.waitForLoading()

            // Skip the race if possible, otherwise run it manually.
            val resultCheck: Boolean = if (game.imageUtils.findImage("race_skip_locked", tries = 5, region = game.imageUtils.regionBottomHalf).first == null) {
                skipRace()
            } else {
                manualRace()
            }

            finishRace(resultCheck)

            game.printToLog("[RACE] Racing process for Mandatory Race is completed.", tag = tag)
            return true
        } else if (game.currentDate.phase != "Pre-Debut" && game.findAndTapImage("race_select_extra", tries = 1, region = game.imageUtils.regionBottomHalf)) {
            game.printToLog("\n[RACE] Starting process for handling a extra race.", tag = tag)

            // If there is a popup warning about repeating races 3+ times, stop the process and do something else other than racing.
            if (game.imageUtils.findImage("race_repeat_warning").first != null) {
                if (!enableForceRacing) {
                    raceRepeatWarningCheck = true
                    game.printToLog("\n[RACE] Closing popup warning of doing more than 3+ races and setting flag to prevent racing for now. Canceling the racing process and doing something else.", tag = tag)
                    game.findAndTapImage("cancel", region = game.imageUtils.regionBottomHalf)
                    return false
                } else {
                    game.findAndTapImage("ok", tries = 1, region = game.imageUtils.regionMiddle)
                    game.wait(1.0)
                }
            }

            // There is a extra race.
            // Swipe up the list to get to the top and then select the first option.
            val statusLocation = game.imageUtils.findImage("race_status").first
            if (statusLocation == null) {
                game.printToLog("[ERROR] Unable to determine existence of list of extra races. Canceling the racing process and doing something else.", tag = tag, isError = true)
                return false
            }
            game.gestureUtils.swipe(statusLocation.x.toFloat(), statusLocation.y.toFloat() + 300, statusLocation.x.toFloat(), statusLocation.y.toFloat() + 888)
            game.wait(1.0)

            // Determine the best extra race using smart racing or traditional logic.
            val maxCount = game.imageUtils.findAll("race_selection_fans", region = game.imageUtils.regionBottomHalf).size
            if (maxCount == 0) {
                game.printToLog("[WARNING] Was unable to find any extra races to select. Canceling the racing process and doing something else.", tag = tag, isError = true)
                return false
            } else {
                game.printToLog("[RACE] There are $maxCount extra race options currently on screen.", tag = tag)
            }

            val success = if (enableFarmingFans && !enableForceRacing && enableRacingPlan && game.currentDate.year == 3) {
                handleSmartRacing()
            } else {
                // Use the standard racing logic.
                // If needed, print the reason(s) to why the smart racing logic was not started.
                if (enableRacingPlan) {
                    game.printToLog("[RACE] Smart racing conditions not met due to current settings, using traditional racing logic...", tag = tag)
                    game.printToLog("[RACE] Reason: One or more conditions failed:", tag = tag)
                    if (!enableFarmingFans) game.printToLog("[RACE]   - enableFarmingFans is false", tag = tag)
                    if (enableForceRacing) game.printToLog("[RACE]   - enableForceRacing is true", tag = tag)
                    if (game.currentDate.year != 3) game.printToLog("[RACE]   - It is not Senior Year yet", tag = tag)
                }

                handleStandardRacing()
            }

            if (!success) return false

            // Confirm the selection and the resultant popup and then wait for the game to load.
            game.findAndTapImage("race_confirm", tries = 30, region = game.imageUtils.regionBottomHalf)
            game.findAndTapImage("race_confirm", tries = 10, region = game.imageUtils.regionBottomHalf)
            game.wait(2.0)

            // Skip the race if possible, otherwise run it manually.
            val resultCheck: Boolean = if (game.imageUtils.findImage("race_skip_locked", tries = 5, region = game.imageUtils.regionBottomHalf).first == null) {
                skipRace()
            } else {
                manualRace()
            }

            finishRace(resultCheck, isExtra = true)

            game.printToLog("[RACE] Racing process for Extra Race is completed.", tag = tag)
            return true
        }

        return false
    }

    /**
     * The entry point for handling standalone races if the user started the bot on the Racing screen.
     */
    fun handleStandaloneRace() {
        game.printToLog("\n[RACE] Starting Standalone Racing process...", tag = tag)

        // Skip the race if possible, otherwise run it manually.
        val resultCheck: Boolean = if (game.imageUtils.findImage("race_skip_locked", tries = 5, region = game.imageUtils.regionBottomHalf).first == null) {
            skipRace()
        } else {
            manualRace()
        }

        finishRace(resultCheck)

        game.printToLog("[RACE] Racing process for Standalone Race is completed.", tag = tag)
    }

    /**
     * Skips the current race to get to the results screen.
     *
     * @return True if the bot completed the race with retry attempts remaining. Otherwise false.
     */
    private fun skipRace(): Boolean {
        while (raceRetries >= 0) {
            game.printToLog("[RACE] Skipping race...", tag = tag)

            // Press the skip button and then wait for your result of the race to show.
            if (game.findAndTapImage("race_skip", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Race was able to be skipped.", tag = tag)
            }
            game.wait(2.0)

            // Now tap on the screen to get past the Race Result screen.
            game.tap(350.0, 450.0, "ok", taps = 3)

            // Check if the race needed to be retried.
            if (game.imageUtils.findImage("race_retry", tries = 5, region = game.imageUtils.regionBottomHalf, suppressError = true).first != null) {
                if (disableRaceRetries) {
                    game.printToLog("\n[END] Stopping the bot due to failing a mandatory race.", tag = tag)
                    game.notificationMessage = "Stopping the bot due to failing a mandatory race."
                    throw IllegalStateException()
                }
                game.findAndTapImage("race_retry", tries = 1, region = game.imageUtils.regionBottomHalf, suppressError = true)
                game.printToLog("[RACE] The skipped race failed and needs to be run again. Attempting to retry...", tag = tag)
                game.wait(3.0)
                raceRetries--
            } else {
                return true
            }
        }

        return false
    }

    /**
     * Manually runs the current race to get to the results screen.
     *
     * @return True if the bot completed the race with retry attempts remaining. Otherwise false.
     */
    private fun manualRace(): Boolean {
        while (raceRetries >= 0) {
            game.printToLog("[RACE] Skipping manual race...", tag = tag)

            // Press the manual button.
            if (game.findAndTapImage("race_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Started the manual race.", tag = tag)
            }
            game.wait(2.0)

            // Confirm the Race Playback popup if it appears.
            if (game.findAndTapImage("ok", tries = 1, region = game.imageUtils.regionMiddle, suppressError = true)) {
                game.printToLog("[RACE] Confirmed the Race Playback popup.", tag = tag)
                game.wait(5.0)
            }

            game.waitForLoading()

            // Now press the confirm button to get past the list of participants.
            if (game.findAndTapImage("race_confirm", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Dismissed the list of participants.", tag = tag)
            }
            game.waitForLoading()
            game.wait(1.0)
            game.waitForLoading()
            game.wait(1.0)

            // Skip the part where it reveals the name of the race.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Skipped the name reveal of the race.", tag = tag)
            }
            // Skip the walkthrough of the starting gate.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Skipped the walkthrough of the starting gate.", tag = tag)
            }
            game.wait(3.0)
            // Skip the start of the race.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Skipped the start of the race.", tag = tag)
            }
            // Skip the lead up to the finish line.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Skipped the lead up to the finish line.", tag = tag)
            }
            game.wait(2.0)
            // Skip the result screen.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                game.printToLog("[RACE] Skipped the results screen.", tag = tag)
            }
            game.wait(2.0)

            game.waitForLoading()
            game.wait(1.0)

            // Check if the race needed to be retried.
            if (game.imageUtils.findImage("race_retry", tries = 5, region = game.imageUtils.regionBottomHalf, suppressError = true).first != null) {
                if (disableRaceRetries) {
                    game.printToLog("\n[END] Stopping the bot due to failing a mandatory race.", tag = tag)
                    game.notificationMessage = "Stopping the bot due to failing a mandatory race."
                    throw IllegalStateException()
                }
                game.findAndTapImage("race_retry", tries = 1, region = game.imageUtils.regionBottomHalf, suppressError = true)
                game.printToLog("[RACE] Manual race failed and needs to be run again. Attempting to retry...", tag = tag)
                game.wait(5.0)
                raceRetries--
            } else {
                // Check if a Trophy was acquired.
                if (game.findAndTapImage("race_accept_trophy", tries = 5, region = game.imageUtils.regionBottomHalf)) {
                    game.printToLog("[RACE] Closing popup to claim trophy...", tag = tag)
                }

                return true
            }
        }

        return false
    }

    /**
     * Finishes up and confirms the results of the race and its success.
     *
     * @param resultCheck Flag to see if the race was completed successfully. Throws an IllegalStateException if it did not.
     * @param isExtra Flag to determine the following actions to finish up this mandatory or extra race.
     */
    fun finishRace(resultCheck: Boolean, isExtra: Boolean = false) {
        game.printToLog("\n[RACE] Now performing cleanup and finishing the race.", tag = tag)
        if (!resultCheck) {
            game.notificationMessage = "Bot has run out of retry attempts for racing. Stopping the bot now..."
            throw IllegalStateException()
        }

        // Bot will be at the screen where it shows the final positions of all participants.
        // Press the confirm button and wait to see the triangle of fans.
        game.printToLog("[RACE] Now attempting to confirm the final positions of all participants and number of gained fans", tag = tag)
        if (game.findAndTapImage("next", tries = 30, region = game.imageUtils.regionBottomHalf)) {
            game.wait(0.5)

            // Now tap on the screen to get to the next screen.
            game.tap(350.0, 750.0, "ok", taps = 3)

            // Now press the end button to finish the race.
            game.findAndTapImage("race_end", tries = 30, region = game.imageUtils.regionBottomHalf)

            if (!isExtra) {
                game.printToLog("[RACE] Seeing if a Training Goal popup will appear.", tag = tag)
                // Wait until the popup showing the completion of a Training Goal appears and confirm it.
                // There will be dialog before it so the delay should be longer.
                game.wait(5.0)
                if (game.findAndTapImage("next", tries = 10, region = game.imageUtils.regionBottomHalf)) {
                    game.wait(2.0)

                    // Now confirm the completion of a Training Goal popup.
                    game.printToLog("[RACE] There was a Training Goal popup. Confirming it now.", tag = tag)
                    game.findAndTapImage("next", tries = 10, region = game.imageUtils.regionBottomHalf)
                }
            } else if (game.findAndTapImage("next", tries = 10, region = game.imageUtils.regionBottomHalf)) {
                // Same as above but without the longer delay.
                game.wait(2.0)
                game.findAndTapImage("race_end", tries = 10, region = game.imageUtils.regionBottomHalf)
            }
        } else {
            game.printToLog("[ERROR] Cannot start the cleanup process for finishing the race. Moving on...", tag = tag, isError = true)
        }
    }
}