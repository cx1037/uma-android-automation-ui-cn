package com.steve1316.uma_android_automation.bot

import com.steve1316.uma_android_automation.MainActivity
import com.steve1316.uma_android_automation.utils.SettingsHelper
import com.steve1316.automation_library.utils.MessageLog.Companion.printToLog
import com.steve1316.uma_android_automation.utils.CustomImageUtils.RaceDetails
import org.opencv.core.Point

class Racing (private val game: Game) {
    private val tag: String = "[${MainActivity.loggerTag}]Racing"

    private val enableFarmingFans = SettingsHelper.getBooleanSetting("racing", "enableFarmingFans")
    private val daysToRunExtraRaces: Int = SettingsHelper.getIntSetting("racing", "daysToRunExtraRaces")
    private val disableRaceRetries: Boolean = SettingsHelper.getBooleanSetting("racing", "disableRaceRetries")
    val enableForceRacing = SettingsHelper.getBooleanSetting("racing", "enableForceRacing")
    private var raceRetries = 3
    var raceRepeatWarningCheck = false
    var encounteredRacingPopup = false
    var skipRacing = false

    private val enableStopOnMandatoryRace: Boolean = SettingsHelper.getBooleanSetting("racing", "enableStopOnMandatoryRaces")
    var detectedMandatoryRaceCheck = false

    ////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////

    /**
     * Checks if the day number is odd to be eligible to run an extra race, excluding Summer where extra racing is not allowed.
     *
     * @return True if the day number is odd. Otherwise false.
     */
    fun checkExtraRaceAvailability(): Boolean {
        val dayNumber = game.imageUtils.determineDayForExtraRace()
        printToLog("\n[INFO] Current remaining number of days before the next mandatory race: $dayNumber.", tag = tag)

        // If the setting to force racing extra races is enabled, always return true.
        if (enableForceRacing) return true

        return enableFarmingFans && dayNumber % daysToRunExtraRaces == 0 && !raceRepeatWarningCheck &&
                game.imageUtils.findImage("race_select_extra_locked_uma_finals", tries = 1, region = game.imageUtils.regionBottomHalf).first == null &&
                game.imageUtils.findImage("race_select_extra_locked", tries = 1, region = game.imageUtils.regionBottomHalf).first == null &&
                game.imageUtils.findImage("recover_energy_summer", tries = 1, region = game.imageUtils.regionBottomHalf).first == null
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////
    // Functions to handle Race Events.

    /**
     * The entry point for handling mandatory or extra races.
     *
     * @return True if the mandatory/extra race was completed successfully. Otherwise false.
     */
    fun handleRaceEvents(): Boolean {
        printToLog("\n[RACE] Starting Racing process...", tag = tag)
        if (encounteredRacingPopup) {
            // Dismiss the insufficient fans popup here and head to the Race Selection screen.
            game.findAndTapImage("race_confirm", tries = 1, region = game.imageUtils.regionBottomHalf)
            encounteredRacingPopup = false
            game.wait(1.0)
        }

        // If there are no races available, cancel the racing process.
        if (game.imageUtils.findImage("race_none_available", tries = 1, region = game.imageUtils.regionMiddle, suppressError = true).first != null) {
            printToLog("[RACE] There are no races to compete in. Canceling the racing process and doing something else.", tag = tag)
            return false
        }

        skipRacing = false

        // First, check if there is a mandatory or a extra race available. If so, head into the Race Selection screen.
        // Note: If there is a mandatory race, the bot would be on the Home screen.
        // Otherwise, it would have found itself at the Race Selection screen already (by way of the insufficient fans popup).
        if (game.findAndTapImage("race_select_mandatory", tries = 1, region = game.imageUtils.regionBottomHalf)) {
            printToLog("\n[RACE] Starting process for handling a mandatory race.", tag = tag)

            if (enableStopOnMandatoryRace) {
                detectedMandatoryRaceCheck = true
                return false
            } else if (enableForceRacing) {
                game.findAndTapImage("ok", tries = 1, region = game.imageUtils.regionMiddle)
                game.wait(1.0)
            }

            // There is a mandatory race. Now confirm the selection and the resultant popup and then wait for the game to load.
            game.wait(2.0)
            printToLog("[RACE] Confirming the mandatory race selection.", tag = tag)
            game.findAndTapImage("race_confirm", tries = 3, region = game.imageUtils.regionBottomHalf)
            game.wait(1.0)
            printToLog("[RACE] Confirming any popup from the mandatory race selection.", tag = tag)
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

            printToLog("[RACE] Racing process for Mandatory Race is completed.", tag = tag)
            return true
        } else if (game.currentDate.phase != "Pre-Debut" && game.findAndTapImage("race_select_extra", tries = 1, region = game.imageUtils.regionBottomHalf)) {
            printToLog("\n[RACE] Starting process for handling a extra race.", tag = tag)

            // If there is a popup warning about repeating races 3+ times, stop the process and do something else other than racing.
            if (game.imageUtils.findImage("race_repeat_warning").first != null) {
                if (!enableForceRacing) {
                    raceRepeatWarningCheck = true
                    printToLog("\n[RACE] Closing popup warning of doing more than 3+ races and setting flag to prevent racing for now. Canceling the racing process and doing something else.", tag = tag)
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
                printToLog("[ERROR] Unable to determine existence of list of extra races. Canceling the racing process and doing something else.", tag = tag, isError = true)
                return false
            }
            game.gestureUtils.swipe(statusLocation.x.toFloat(), statusLocation.y.toFloat() + 300, statusLocation.x.toFloat(), statusLocation.y.toFloat() + 888)
            game.wait(1.0)

            // Now determine the best extra race with the following parameters: highest fans and double star prediction.
            // First find the fans of only the extra races on the screen that match the double star prediction. Read only 3 extra races.
            var count = 0
            val maxCount = game.imageUtils.findAll("race_selection_fans", region = game.imageUtils.regionBottomHalf).size
            if (maxCount == 0) {
                printToLog("[WARNING] Was unable to find any extra races to select. Canceling the racing process and doing something else.", tag = tag, isError = true)
                return false
            } else {
                printToLog("[RACE] There are $maxCount extra race options currently on screen.", tag = tag)
            }
            val listOfFans = mutableListOf<Int>()
            val extraRaceLocation = mutableListOf<Point>()
            val doublePredictionLocations = game.imageUtils.findAll("race_extra_double_prediction")
            if (doublePredictionLocations.size == 1) {
                printToLog("[RACE] There is only one race with double predictions so selecting that one.", tag = tag)
                game.tap(
                    doublePredictionLocations[0].x,
                    doublePredictionLocations[0].y,
                    "race_extra_double_prediction",
                    ignoreWaiting = true
                )
            } else {
                val (sourceBitmap, templateBitmap) = game.imageUtils.getBitmaps("race_extra_double_prediction")
                val listOfRaces: ArrayList<RaceDetails> = arrayListOf()
                while (count < maxCount) {
                    // Save the location of the selected extra race.
                    val selectedExtraRace = game.imageUtils.findImage("race_extra_selection", region = game.imageUtils.regionBottomHalf).first
                    if (selectedExtraRace == null) {
                        printToLog("[ERROR] Unable to find the location of the selected extra race. Canceling the racing process and doing something else.", tag = tag, isError = true)
                        break
                    }
                    extraRaceLocation.add(selectedExtraRace)

                    // Determine its fan gain and save it.
                    val raceDetails: RaceDetails = game.imageUtils.determineExtraRaceFans(extraRaceLocation[count], sourceBitmap, templateBitmap!!, forceRacing = enableForceRacing)
                    listOfRaces.add(raceDetails)
                    if (count == 0 && raceDetails.fans == -1) {
                        // If the fans were unable to be fetched or the race does not have double predictions for the first attempt, skip racing altogether.
                        listOfFans.add(raceDetails.fans)
                        break
                    }
                    listOfFans.add(raceDetails.fans)

                    // Select the next extra race.
                    if (count + 1 < maxCount) {
                        if (game.imageUtils.isTablet) {
                            game.tap(
                                game.imageUtils.relX(extraRaceLocation[count].x, (-100 * 1.36).toInt()).toDouble(),
                                game.imageUtils.relY(extraRaceLocation[count].y, (150 * 1.50).toInt()).toDouble(),
                                "race_extra_selection",
                                ignoreWaiting = true
                            )
                        } else {
                            game.tap(
                                game.imageUtils.relX(extraRaceLocation[count].x, -100).toDouble(),
                                game.imageUtils.relY(extraRaceLocation[count].y, 150).toDouble(),
                                "race_extra_selection",
                                ignoreWaiting = true
                            )
                        }
                    }

                    game.wait(0.5)

                    count++
                }

                val fansList = listOfRaces.joinToString(", ") { it.fans.toString() }
                printToLog("[RACE] Number of fans detected for each extra race are: $fansList", tag = tag)

                // Next determine the maximum fans and select the extra race.
                val maxFans: Int? = listOfFans.maxOrNull()
                if (maxFans != null) {
                    if (maxFans == -1) {
                        printToLog("[WARNING] Max fans was returned as -1. Canceling the racing process and doing something else.", tag = tag)
                        return false
                    }

                    // Get the index of the maximum fans or the one with the double predictions if available when force racing is enabled.
                    val index = if (!enableForceRacing) {
                        listOfFans.indexOf(maxFans)
                    } else {
                        // When force racing is enabled, prioritize races with double predictions.
                        val doublePredictionIndex = listOfRaces.indexOfFirst { it.hasDoublePredictions }
                        if (doublePredictionIndex != -1) {
                            printToLog("[RACE] Force racing enabled - selecting race with double predictions.", tag = tag)
                            doublePredictionIndex
                        } else {
                            // Fall back to the race with maximum fans if no double predictions found
                            printToLog("[RACE] Force racing enabled but no double predictions found - falling back to race with maximum fans.", tag = tag)
                            listOfFans.indexOf(maxFans)
                        }
                    }

                    printToLog("[RACE] Selecting the extra race at option #${index + 1}.", tag = tag)

                    // Select the extra race that matches the double star prediction and the most fan gain.
                    game.tap(
                        extraRaceLocation[index].x - game.imageUtils.relWidth((100 * 1.36).toInt()),
                        extraRaceLocation[index].y - game.imageUtils.relHeight(70),
                        "race_extra_selection",
                        ignoreWaiting = true
                    )
                } else if (extraRaceLocation.isNotEmpty()) {
                    // If no maximum is determined, select the very first extra race.
                    printToLog("[RACE] Selecting the first extra race on the list by default.", tag = tag)
                    game.tap(
                        extraRaceLocation[0].x - game.imageUtils.relWidth((100 * 1.36).toInt()),
                        extraRaceLocation[0].y - game.imageUtils.relHeight(70),
                        "race_extra_selection",
                        ignoreWaiting = true
                    )
                } else {
                    printToLog("[WARNING] No extra races detected and thus no fan maximums were calculated. Canceling the racing process and doing something else.", tag = tag)
                    return false
                }
            }

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

            printToLog("[RACE] Racing process for Extra Race is completed.", tag = tag)
            return true
        }

        return false
    }

    /**
     * The entry point for handling standalone races if the user started the bot on the Racing screen.
     */
    fun handleStandaloneRace() {
        printToLog("\n[RACE] Starting Standalone Racing process...", tag = tag)

        // Skip the race if possible, otherwise run it manually.
        val resultCheck: Boolean = if (game.imageUtils.findImage("race_skip_locked", tries = 5, region = game.imageUtils.regionBottomHalf).first == null) {
            skipRace()
        } else {
            manualRace()
        }

        finishRace(resultCheck)

        printToLog("[RACE] Racing process for Standalone Race is completed.", tag = tag)
    }

    /**
     * Skips the current race to get to the results screen.
     *
     * @return True if the bot completed the race with retry attempts remaining. Otherwise false.
     */
    private fun skipRace(): Boolean {
        while (raceRetries >= 0) {
            printToLog("[RACE] Skipping race...", tag = tag)

            // Press the skip button and then wait for your result of the race to show.
            if (game.findAndTapImage("race_skip", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Race was able to be skipped.", tag = tag)
            }
            game.wait(2.0)

            // Now tap on the screen to get past the Race Result screen.
            game.tap(350.0, 450.0, "ok", taps = 3)

            // Check if the race needed to be retried.
            if (game.imageUtils.findImage("race_retry", tries = 5, region = game.imageUtils.regionBottomHalf, suppressError = true).first != null) {
                if (disableRaceRetries) {
                    printToLog("\n[END] Stopping the bot due to failing a mandatory race.", tag = tag)
                    game.notificationMessage = "Stopping the bot due to failing a mandatory race."
                    throw IllegalStateException()
                }
                game.findAndTapImage("race_retry", tries = 1, region = game.imageUtils.regionBottomHalf, suppressError = true)
                printToLog("[RACE] The skipped race failed and needs to be run again. Attempting to retry...", tag = tag)
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
            printToLog("[RACE] Skipping manual race...", tag = tag)

            // Press the manual button.
            if (game.findAndTapImage("race_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Started the manual race.", tag = tag)
            }
            game.wait(2.0)

            // Confirm the Race Playback popup if it appears.
            if (game.findAndTapImage("ok", tries = 1, region = game.imageUtils.regionMiddle, suppressError = true)) {
                printToLog("[RACE] Confirmed the Race Playback popup.", tag = tag)
                game.wait(5.0)
            }

            game.waitForLoading()

            // Now press the confirm button to get past the list of participants.
            if (game.findAndTapImage("race_confirm", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Dismissed the list of participants.", tag = tag)
            }
            game.waitForLoading()
            game.wait(1.0)
            game.waitForLoading()
            game.wait(1.0)

            // Skip the part where it reveals the name of the race.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Skipped the name reveal of the race.", tag = tag)
            }
            // Skip the walkthrough of the starting gate.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Skipped the walkthrough of the starting gate.", tag = tag)
            }
            game.wait(3.0)
            // Skip the start of the race.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Skipped the start of the race.", tag = tag)
            }
            // Skip the lead up to the finish line.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Skipped the lead up to the finish line.", tag = tag)
            }
            game.wait(2.0)
            // Skip the result screen.
            if (game.findAndTapImage("race_skip_manual", tries = 30, region = game.imageUtils.regionBottomHalf)) {
                printToLog("[RACE] Skipped the results screen.", tag = tag)
            }
            game.wait(2.0)

            game.waitForLoading()
            game.wait(1.0)

            // Check if the race needed to be retried.
            if (game.imageUtils.findImage("race_retry", tries = 5, region = game.imageUtils.regionBottomHalf, suppressError = true).first != null) {
                if (disableRaceRetries) {
                    printToLog("\n[END] Stopping the bot due to failing a mandatory race.", tag = tag)
                    game.notificationMessage = "Stopping the bot due to failing a mandatory race."
                    throw IllegalStateException()
                }
                game.findAndTapImage("race_retry", tries = 1, region = game.imageUtils.regionBottomHalf, suppressError = true)
                printToLog("[RACE] Manual race failed and needs to be run again. Attempting to retry...", tag = tag)
                game.wait(5.0)
                raceRetries--
            } else {
                // Check if a Trophy was acquired.
                if (game.findAndTapImage("race_accept_trophy", tries = 5, region = game.imageUtils.regionBottomHalf)) {
                    printToLog("[RACE] Closing popup to claim trophy...", tag = tag)
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
        printToLog("\n[RACE] Now performing cleanup and finishing the race.", tag = tag)
        if (!resultCheck) {
            game.notificationMessage = "Bot has run out of retry attempts for racing. Stopping the bot now..."
            throw IllegalStateException()
        }

        // Bot will be at the screen where it shows the final positions of all participants.
        // Press the confirm button and wait to see the triangle of fans.
        printToLog("[RACE] Now attempting to confirm the final positions of all participants and number of gained fans", tag = tag)
        if (game.findAndTapImage("next", tries = 30, region = game.imageUtils.regionBottomHalf)) {
            game.wait(0.5)

            // Now tap on the screen to get to the next screen.
            game.tap(350.0, 750.0, "ok", taps = 3)

            // Now press the end button to finish the race.
            game.findAndTapImage("race_end", tries = 30, region = game.imageUtils.regionBottomHalf)

            if (!isExtra) {
                printToLog("[RACE] Seeing if a Training Goal popup will appear.", tag = tag)
                // Wait until the popup showing the completion of a Training Goal appears and confirm it.
                // There will be dialog before it so the delay should be longer.
                game.wait(5.0)
                if (game.findAndTapImage("next", tries = 10, region = game.imageUtils.regionBottomHalf)) {
                    game.wait(2.0)

                    // Now confirm the completion of a Training Goal popup.
                    printToLog("[RACE] There was a Training Goal popup. Confirming it now.", tag = tag)
                    game.findAndTapImage("next", tries = 10, region = game.imageUtils.regionBottomHalf)
                }
            } else if (game.findAndTapImage("next", tries = 10, region = game.imageUtils.regionBottomHalf)) {
                // Same as above but without the longer delay.
                game.wait(2.0)
                game.findAndTapImage("race_end", tries = 10, region = game.imageUtils.regionBottomHalf)
            }
        } else {
            printToLog("[ERROR] Cannot start the cleanup process for finishing the race. Moving on...", tag = tag, isError = true)
        }
    }
}