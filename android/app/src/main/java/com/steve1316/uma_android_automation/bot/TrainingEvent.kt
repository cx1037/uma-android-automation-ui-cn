package com.steve1316.uma_android_automation.bot

import com.steve1316.automation_library.utils.MessageLog.Companion.printToLog
import com.steve1316.uma_android_automation.MainActivity
import com.steve1316.uma_android_automation.utils.SettingsHelper
import org.opencv.core.Point

class TrainingEvent(private val game: Game) {
    private val tag: String = "[${MainActivity.loggerTag}]TrainingEvent"

    private val trainingEventRecognizer: TrainingEventRecognizer = TrainingEventRecognizer(game, game.imageUtils)

    val enablePrioritizeEnergyOptions: Boolean = SettingsHelper.getBooleanSetting("trainingEvent", "enablePrioritizeEnergyOptions")

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////
    // Functions to handle Training Events with the help of the TrainingEventRecognizer class.

    /**
     * Start text detection to determine what Training Event it is and the event rewards for each option.
     * It will then select the best option according to the user's preferences. By default, it will choose the first option.
     */
    fun handleTrainingEvent() {
        printToLog("\n[TRAINING_EVENT] Starting Training Event process...", tag = tag)

        val (eventRewards, confidence) = trainingEventRecognizer.start()

        val regex = Regex("[a-zA-Z]+")
        var optionSelected = 0

        // Double check if the bot is at the Main screen or not.
        if (game.checkMainScreen()) {
            return
        }

        if (eventRewards.isNotEmpty() && eventRewards[0] != "") {
            // Initialize the List.
            val selectionWeight = List(eventRewards.size) { 0 }.toMutableList()

            // Sum up the stat gains with additional weight applied to stats that are prioritized.
            eventRewards.forEach { reward ->
                val formattedReward: List<String> = reward.split("\n")

                formattedReward.forEach { line ->
                    val formattedLine: String = regex
                        .replace(line, "")
                        .replace("(", "")
                        .replace(")", "")
                        .trim()
                        .lowercase()

                    printToLog("[TRAINING_EVENT] Original line is \"$line\".", tag = tag)
                    printToLog("[TRAINING_EVENT] Formatted line is \"$formattedLine\".", tag = tag)

                    var priorityStatCheck = false
                    if (line.lowercase().contains("energy")) {
                        val finalEnergyValue = try {
                            val energyValue = if (formattedLine.contains("/")) {
                                val splits = formattedLine.split("/")
                                var sum = 0
                                for (split in splits) {
                                    sum += try {
                                        split.trim().toInt()
                                    } catch (_: NumberFormatException) {
                                        printToLog("[WARNING] Could not convert $formattedLine to a number for energy with a forward slash.", tag = tag)
                                        20
                                    }
                                }
                                sum
                            } else {
                                formattedLine.toInt()
                            }

                            if (enablePrioritizeEnergyOptions) {
                                energyValue * 100
                            } else {
                                energyValue * 3
                            }
                        } catch (_: NumberFormatException) {
                            printToLog("[WARNING] Could not convert $formattedLine to a number for energy.", tag = tag)
                            20
                        }
                        printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of $finalEnergyValue for energy.", tag = tag)
                        selectionWeight[optionSelected] += finalEnergyValue
                    } else if (line.lowercase().contains("mood")) {
                        val moodWeight = if (formattedLine.contains("-")) -50 else 50
                        printToLog("[TRAINING-EVENT Adding weight for option#${optionSelected + 1} of $moodWeight for ${if (moodWeight > 0) "positive" else "negative"} mood gain.", tag = tag)
                        selectionWeight[optionSelected] += moodWeight
                    } else if (line.lowercase().contains("bond")) {
                        printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of 20 for bond.", tag = tag)
                        selectionWeight[optionSelected] += 20
                    } else if (line.lowercase().contains("event chain ended")) {
                        printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of -50 for event chain ending.", tag = tag)
                        selectionWeight[optionSelected] += -50
                    } else if (line.lowercase().contains("(random)")) {
                        printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of -10 for random reward.", tag = tag)
                        selectionWeight[optionSelected] += -10
                    } else if (line.lowercase().contains("randomly")) {
                        printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of 50 for random options.", tag = tag)
                        selectionWeight[optionSelected] += 50
                    } else if (line.lowercase().contains("hint")) {
                        printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of 25 for skill hint(s).", tag = tag)
                        selectionWeight[optionSelected] += 25
                    } else if (line.lowercase().contains("skill")) {
                        val finalSkillPoints = if (formattedLine.contains("/")) {
                            val splits = formattedLine.split("/")
                            var sum = 0
                            for (split in splits) {
                                sum += try {
                                    split.trim().toInt()
                                } catch (_: NumberFormatException) {
                                    printToLog("[WARNING] Could not convert $formattedLine to a number for skill points with a forward slash.", tag = tag)
                                    10
                                }
                            }
                            sum
                        } else {
                            formattedLine.toInt()
                        }
                        printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of $finalSkillPoints for skill points.", tag = tag)
                        selectionWeight[optionSelected] += finalSkillPoints
                    } else {
                        // Apply inflated weights to the prioritized stats based on their order.
                        game.training.statPrioritization.forEachIndexed { index, stat ->
                            if (line.contains(stat)) {
                                // Calculate weight bonus based on position (higher priority = higher bonus).
                                val priorityBonus = when (index) {
                                    0 -> 50
                                    1 -> 40
                                    2 -> 30
                                    3 -> 20
                                    else -> 10
                                }

                                val finalStatValue = try {
                                    priorityStatCheck = true
                                    if (formattedLine.contains("/")) {
                                        val splits = formattedLine.split("/")
                                        var sum = 0
                                        for (split in splits) {
                                            sum += try {
                                                split.trim().toInt()
                                            } catch (_: NumberFormatException) {
                                                printToLog("[WARNING] Could not convert $formattedLine to a number for a priority stat with a forward slash.", tag = tag)
                                                10
                                            }
                                        }
                                        sum + priorityBonus
                                    } else {
                                        formattedLine.toInt() + priorityBonus
                                    }
                                } catch (_: NumberFormatException) {
                                    printToLog("[WARNING] Could not convert $formattedLine to a number for a priority stat.", tag = tag)
                                    priorityStatCheck = false
                                    10
                                }
                                printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of $finalStatValue for prioritized stat.", tag = tag)
                                selectionWeight[optionSelected] += finalStatValue
                            }
                        }

                        // Apply normal weights to the rest of the stats.
                        if (!priorityStatCheck) {
                            val finalStatValue = try {
                                if (formattedLine.contains("/")) {
                                    val splits = formattedLine.split("/")
                                    var sum = 0
                                    for (split in splits) {
                                        sum += try {
                                            split.trim().toInt()
                                        } catch (_: NumberFormatException) {
                                            printToLog("[WARNING] Could not convert $formattedLine to a number for non-prioritized stat with a forward slash.", tag = tag)
                                            10
                                        }
                                    }
                                    sum
                                } else {
                                    formattedLine.toInt()
                                }
                            } catch (_: NumberFormatException) {
                                printToLog("[WARNING] Could not convert $formattedLine to a number for non-prioritized stat.", tag = tag)
                                10
                            }
                            printToLog("[TRAINING_EVENT] Adding weight for option #${optionSelected + 1} of $finalStatValue for non-prioritized stat.", tag = tag)
                            selectionWeight[optionSelected] += finalStatValue
                        }
                    }

                    printToLog("[TRAINING_EVENT] Final weight for option #${optionSelected + 1} is: ${selectionWeight[optionSelected]}.", tag = tag)
                }

                optionSelected++
            }

            // Select the best option that aligns with the stat prioritization made in the Training options.
            var max: Int? = selectionWeight.maxOrNull()
            if (max == null) {
                max = 0
                optionSelected = 0
            } else {
                optionSelected = selectionWeight.indexOf(max)
            }

            // Print the selection weights.
            printToLog("[TRAINING_EVENT] Selection weights for each option:", tag = tag)
            selectionWeight.forEachIndexed { index, weight ->
                printToLog("Option ${index + 1}: $weight", tag = tag)
            }

            // Format the string to display each option's rewards.
            var eventRewardsString = ""
            var optionNumber = 1
            eventRewards.forEach { reward ->
                eventRewardsString += "Option $optionNumber: \"$reward\"\n"
                optionNumber += 1
            }

            val minimumConfidence = SettingsHelper.getIntSetting("debug", "templateMatchConfidence").toDouble() / 100.0
            val resultString = if (confidence >= minimumConfidence) {
                "[TRAINING_EVENT] For this Training Event consisting of:\n$eventRewardsString\nThe bot will select Option ${optionSelected + 1}: \"${eventRewards[optionSelected]}\" with a " +
                        "selection weight of $max."
            } else {
                "[TRAINING_EVENT] Since the confidence was less than the set minimum, first option will be selected."
            }

            printToLog(resultString, tag = tag)
        } else {
            printToLog("[TRAINING_EVENT] First option will be selected since OCR failed to detect anything.", tag = tag)
            optionSelected = 0
        }

        val trainingOptionLocations: ArrayList<Point> = game.imageUtils.findAll("training_event_active")
        val selectedLocation: Point? = if (trainingOptionLocations.isNotEmpty()) {
            // Account for the situation where it could go out of bounds if the detected event options is incorrect and gives too many results.
            try {
                trainingOptionLocations[optionSelected]
            } catch (_: IndexOutOfBoundsException) {
                // Default to the first option.
                trainingOptionLocations[0]
            }
        } else {
            game.imageUtils.findImage("training_event_active", tries = 5, region = game.imageUtils.regionMiddle).first
        }

        if (selectedLocation != null) {
            game.tap(selectedLocation.x + game.imageUtils.relWidth(100), selectedLocation.y, "training_event_active")
        }

        printToLog("[TRAINING_EVENT] Process to handle detected Training Event completed.", tag = tag)
    }
}