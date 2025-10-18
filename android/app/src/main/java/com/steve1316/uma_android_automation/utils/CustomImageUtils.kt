package com.steve1316.uma_android_automation.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.steve1316.automation_library.utils.BotService
import com.steve1316.automation_library.utils.ImageUtils
import com.steve1316.automation_library.utils.MessageLog
import com.steve1316.uma_android_automation.MainActivity
import com.steve1316.uma_android_automation.bot.Game
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.lang.Integer.max
import androidx.core.graphics.scale
import androidx.core.graphics.createBitmap
import com.steve1316.automation_library.data.SharedData
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.collections.component1
import kotlin.collections.component2
import kotlin.math.sqrt
import kotlin.text.replace


/**
 * Utility functions for image processing via CV like OpenCV.
 */
class CustomImageUtils(context: Context, private val game: Game) : ImageUtils(context) {
	private val tag: String = "[${MainActivity.loggerTag}]ImageUtils"

	////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////
	// SQLite Settings
	private val threshold: Int = SettingsHelper.getIntSetting("ocr", "ocrThreshold")
	override var debugMode: Boolean = SettingsHelper.getBooleanSetting("debug", "enableDebugMode")
	override var confidence: Double = SettingsHelper.getIntSetting("debug", "templateMatchConfidence").toDouble() / 100.0
	override var customScale: Double = SettingsHelper.getIntSetting("debug", "templateMatchCustomScale").toDouble() / 100.0

	////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////

	data class RaceDetails (
		val fans: Int,
		val hasDoublePredictions: Boolean
	)

	data class BarFillResult(
		val fillPercent: Double,
		val filledSegments: Int,
		val dominantColor: String
	)

	////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////

	init {
		initTesseract("eng.traineddata")
		SharedData.templateSubfolderPathName = "images/"
	}

	/**
	 * Find all occurrences of the specified image in the images folder using a provided source bitmap. Useful for parallel processing to avoid exceeding the maxImages buffer.
	 *
	 * @param templateName File name of the template image.
	 * @param sourceBitmap The source bitmap to search in.
	 * @param region Specify the region consisting of (x, y, width, height) of the source screenshot to template match. Defaults to (0, 0, 0, 0) which is equivalent to searching the full image.
	 * @return An ArrayList of Point objects containing all the occurrences of the specified image or null if not found.
	 */
	private fun findAllWithBitmap(templateName: String, sourceBitmap: Bitmap, region: IntArray = intArrayOf(0, 0, 0, 0)): ArrayList<Point> {
		var templateBitmap: Bitmap?
		context.assets?.open("images/$templateName.png").use { inputStream ->
			templateBitmap = BitmapFactory.decodeStream(inputStream)
		}

		if (templateBitmap != null) {
			val matchLocations = matchAll(sourceBitmap, templateBitmap, region = region)
			
			// Sort the match locations by ascending x and y coordinates.
			matchLocations.sortBy { it.x }
			matchLocations.sortBy { it.y }

			if (debugMode) {
				MessageLog.printToLog("[DEBUG] Found match locations for $templateName: $matchLocations.", tag)
			} else {
				Log.d(tag, "[DEBUG] Found match locations for $templateName: $matchLocations.")
			}

			return matchLocations
		}
		
		return arrayListOf()
	}

	////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////

	/**
	 * Perform OCR text detection using Tesseract along with some image manipulation via thresholding to make the cropped screenshot black and white using OpenCV.
	 *
	 * @param increment Increments the threshold by this value. Defaults to 0.0.
	 * @return The detected String in the cropped region.
	 */
	fun findText(increment: Double = 0.0): String {
		val (sourceBitmap, templateBitmap) = getBitmaps("shift")

		// Acquire the location of the energy text image.
		val (_, energyTemplateBitmap) = getBitmaps("energy")
		val (_, matchLocation) = match(sourceBitmap, energyTemplateBitmap!!, "energy")
		if (matchLocation == null) {
			MessageLog.printToLog("[WARNING] Could not proceed with OCR text detection due to not being able to find the energy template on the source image.", tag = tag)
			return "empty!"
		}

		// Use the match location acquired from finding the energy text image and acquire the (x, y) coordinates of the event title container right below the location of the energy text image.
		val newX: Int
		val newY: Int
		var croppedBitmap: Bitmap? = if (isTablet) {
			newX = max(0, matchLocation.x.toInt() - relWidth(250))
			newY = max(0, matchLocation.y.toInt() + relHeight(154))
			createSafeBitmap(sourceBitmap, newX, newY, relWidth(746), relHeight(85), "findText tablet crop")
		} else {
			newX = max(0, matchLocation.x.toInt() - relWidth(125))
			newY = max(0, matchLocation.y.toInt() + relHeight(116))
			createSafeBitmap(sourceBitmap, newX, newY, relWidth(645), relHeight(65), "findText phone crop")
		}
		if (croppedBitmap == null) {
			MessageLog.printToLog("[ERROR] Failed to create cropped bitmap for text detection", tag = tag, isError = true)
			return "empty!"
		}

		val tempImage = Mat()
		Utils.bitmapToMat(croppedBitmap, tempImage)
		if (debugMode) Imgcodecs.imwrite("$matchFilePath/debugEventTitleText.png", tempImage)

		// Now see if it is necessary to shift the cropped region over by 70 pixels or not to account for certain events.
		val (shiftMatch, _) = match(croppedBitmap, templateBitmap!!, "shift")
		croppedBitmap = if (shiftMatch) {
			Log.d(tag, "Shifting the region over by 70 pixels!")
			createSafeBitmap(sourceBitmap, relX(newX.toDouble(), 70), newY, 645 - 70, 65, "findText shifted crop") ?: croppedBitmap
		} else {
			Log.d(tag, "Do not need to shift.")
			croppedBitmap
		}

		// Make the cropped screenshot grayscale.
		val cvImage = Mat()
		Utils.bitmapToMat(croppedBitmap, cvImage)
		Imgproc.cvtColor(cvImage, cvImage, Imgproc.COLOR_BGR2GRAY)

		// Save the cropped image before converting it to black and white in order to troubleshoot issues related to differing device sizes and cropping.
		if (debugMode) Imgcodecs.imwrite("$matchFilePath/debugEventTitleText_afterCrop.png", cvImage)

		// Thresh the grayscale cropped image to make it black and white.
		val bwImage = Mat()
		Imgproc.threshold(cvImage, bwImage, threshold.toDouble() + increment, 255.0, Imgproc.THRESH_BINARY)
		if (debugMode) Imgcodecs.imwrite("$matchFilePath/debugEventTitleText_afterThreshold.png", bwImage)

		// Convert the Mat directly to Bitmap and then pass it to the text reader.
		val resultBitmap = createBitmap(bwImage.cols(), bwImage.rows())
		Utils.matToBitmap(bwImage, resultBitmap)
		tessBaseAPI.setImage(resultBitmap)

		var result = "empty!"
		try {
			// Finally, detect text on the cropped region.
			result = tessBaseAPI.utF8Text
			MessageLog.printToLog("[INFO] Detected text with Tesseract: $result", tag = tag)
		} catch (e: Exception) {
			MessageLog.printToLog("[ERROR] Cannot perform OCR: ${e.stackTraceToString()}", tag = tag, isError = true)
		}

		tessBaseAPI.clear()
		tempImage.release()
		cvImage.release()
		bwImage.release()

		return result
	}

	/**
	 * Find the success percentage chance on the currently selected stat. Parameters are optional to allow for thread-safe operations.
	 *
	 * @param sourceBitmap Bitmap of the source image separately taken. Defaults to null.
	 * @param trainingSelectionLocation Point location of the template image separately taken. Defaults to null.
	 *
	 * @return Integer representing the percentage.
	 */
	fun findTrainingFailureChance(sourceBitmap: Bitmap? = null, trainingSelectionLocation: Point? = null): Int {
		// Crop the source screenshot to hold the success percentage only.
		val (trainingSelectionLocation, sourceBitmap) = if (sourceBitmap == null && trainingSelectionLocation == null) {
			findImage("training_failure_chance")
		} else {
			Pair(trainingSelectionLocation, sourceBitmap)
		}

		if (trainingSelectionLocation == null) {
			return -1
		}

		// Determine crop region based on device type.
		val (offsetX, offsetY, width, height) = if (isTablet) {
			listOf(-65, 23, relWidth(130), relHeight(50))
		} else {
			listOf(-45, 15, relWidth(100), relHeight(37))
		}

		// Perform OCR with 2x scaling and no thresholding.
		val detectedText = performOCROnRegion(
			sourceBitmap!!,
			relX(trainingSelectionLocation.x, offsetX),
			relY(trainingSelectionLocation.y, offsetY),
			width,
			height,
			useThreshold = false,
			useGrayscale = true,
			scaleUp = 2,
			ocrEngine = "mlkit",
			debugName = "TrainingFailureChance"
		)

		// Parse the result.
		val result = try {
			val cleanedResult = detectedText.replace("%", "").replace(Regex("[^0-9]"), "").trim()
			cleanedResult.toInt()
		} catch (_: NumberFormatException) {
			MessageLog.printToLog("[ERROR] Could not convert \"$detectedText\" to integer.", tag = tag, isError = true)
			-1
		}

		if (debugMode) {
			MessageLog.printToLog("[DEBUG] Failure chance detected to be at $result%.", tag = tag)
		} else {
			Log.d(tag, "Failure chance detected to be at $result%.")
		}

		return result
	}

	/**
	 * Determines the day number to see if today is eligible for doing an extra race.
	 *
	 * @return Number of the day.
	 */
	fun determineDayForExtraRace(): Int {
		val (energyTextLocation, sourceBitmap) = findImage("energy", tries = 1, region = regionTopHalf)

		if (energyTextLocation != null) {
			// Determine crop region based on campaign and device type.
			val (offsetX, offsetY, width, height) = if (game.campaign == "Ao Haru") {
				if (isTablet) {
					listOf(-(260 * 1.32).toInt(), -(140 * 1.32).toInt(), relWidth(135), relHeight(100))
				} else {
					listOf(-260, -140, relWidth(105), relHeight(75))
				}
			} else {
				if (isTablet) {
					listOf(-(246 * 1.32).toInt(), -(96 * 1.32).toInt(), relWidth(175), relHeight(116))
				} else {
					listOf(-246, -100, relWidth(140), relHeight(95))
				}
			}

			// Perform OCR with 2x scaling.
			val detectedText = performOCROnRegion(
				sourceBitmap,
				relX(energyTextLocation.x, offsetX),
				relY(energyTextLocation.y, offsetY),
				width,
				height,
				useThreshold = true,
				useGrayscale = true,
				scaleUp = 2,
				ocrEngine = "mlkit",
				debugName = "DayForExtraRace"
			)

			// Parse the result.
			val result = try {
				val cleanedResult = detectedText.replace(Regex("[^0-9]"), "")
				MessageLog.printToLog("[INFO] Detected day for extra racing: $detectedText", tag = tag)
				cleanedResult.toInt()
			} catch (_: NumberFormatException) {
				MessageLog.printToLog("[ERROR] Could not convert \"$detectedText\" to integer.", tag = tag, isError = true)
				-1
			}

			return result
		}

		return -1
	}

	/**
	 * Determine the amount of fans that the extra race will give only if it matches the double star prediction.
	 *
	 * @param extraRaceLocation Point object of the extra race's location.
	 * @param sourceBitmap Bitmap of the source screenshot.
	 * @param doubleStarPredictionBitmap Bitmap of the double star prediction template image.
	 * @param forceRacing Flag to allow the extra race to forcibly pass double star prediction check. Defaults to false.
	 * @return Number of fans to be gained from the extra race or -1 if not found as an object.
	 */
	fun determineExtraRaceFans(extraRaceLocation: Point, sourceBitmap: Bitmap, doubleStarPredictionBitmap: Bitmap, forceRacing: Boolean = false): RaceDetails {
		// Crop the source screenshot to show only the fan amount and the predictions.
		val croppedBitmap = if (isTablet) {
			createSafeBitmap(sourceBitmap, relX(extraRaceLocation.x, -(173 * 1.34).toInt()), relY(extraRaceLocation.y, -(106 * 1.34).toInt()), relWidth(220), relHeight(125), "determineExtraRaceFans prediction tablet")
		} else {
			createSafeBitmap(sourceBitmap, relX(extraRaceLocation.x, -173), relY(extraRaceLocation.y, -106), relWidth(163), relHeight(96), "determineExtraRaceFans prediction phone")
		}
		if (croppedBitmap == null) {
			MessageLog.printToLog("[ERROR] Failed to create cropped bitmap for extra race prediction detection.", tag = tag, isError = true)
			return RaceDetails(-1, false)
		}

		val cvImage = Mat()
		Utils.bitmapToMat(croppedBitmap, cvImage)
		if (debugMode) Imgcodecs.imwrite("$matchFilePath/debugExtraRacePrediction.png", cvImage)

		// Determine if the extra race has double star prediction.
		val (predictionCheck, _) = match(croppedBitmap, doubleStarPredictionBitmap, "race_extra_double_prediction")

		return if (forceRacing || predictionCheck) {
			if (debugMode && !forceRacing) MessageLog.printToLog("[DEBUG] This race has double predictions. Now checking how many fans this race gives.", tag = tag)
			else if (debugMode) MessageLog.printToLog("[DEBUG] Check for double predictions was skipped due to the force racing flag being enabled. Now checking how many fans this race gives.", tag = tag)

			// Crop the source screenshot to show only the fans.
			val croppedBitmap2 = if (isTablet) {
				createSafeBitmap(sourceBitmap, relX(extraRaceLocation.x, -(625 * 1.40).toInt()), relY(extraRaceLocation.y, -(75 * 1.34).toInt()), relWidth(320), relHeight(45), "determineExtraRaceFans fans tablet")
			} else {
				createSafeBitmap(sourceBitmap, relX(extraRaceLocation.x, -625), relY(extraRaceLocation.y, -75), relWidth(250), relHeight(35), "determineExtraRaceFans fans phone")
			}
			if (croppedBitmap2 == null) {
				MessageLog.printToLog("[ERROR] Failed to create cropped bitmap for extra race fans detection.", tag = tag, isError = true)
				return RaceDetails(-1, predictionCheck)
			}

			// Make the cropped screenshot grayscale.
			Utils.bitmapToMat(croppedBitmap2, cvImage)
			Imgproc.cvtColor(cvImage, cvImage, Imgproc.COLOR_BGR2GRAY)
			if (debugMode) Imgcodecs.imwrite("$matchFilePath/debugExtraRaceFans_afterCrop.png", cvImage)

			// Convert the Mat directly to Bitmap and then pass it to the text reader.
			var resultBitmap = createBitmap(cvImage.cols(), cvImage.rows())
			Utils.matToBitmap(cvImage, resultBitmap)

			// Thresh the grayscale cropped image to make it black and white.
			val bwImage = Mat()
			Imgproc.threshold(cvImage, bwImage, threshold.toDouble(), 255.0, Imgproc.THRESH_BINARY)
			if (debugMode) Imgcodecs.imwrite("$matchFilePath/debugExtraRaceFans_afterThreshold.png", bwImage)

			resultBitmap = createBitmap(bwImage.cols(), bwImage.rows())
			Utils.matToBitmap(bwImage, resultBitmap)
			tessDigitsBaseAPI.setImage(resultBitmap)

			var result = "empty!"
			try {
				// Finally, detect text on the cropped region.
				result = tessDigitsBaseAPI.utF8Text
			} catch (e: Exception) {
				MessageLog.printToLog("[ERROR] Cannot perform OCR with Tesseract: ${e.stackTraceToString()}", tag = tag, isError = true)
			}

			tessDigitsBaseAPI.clear()
			cvImage.release()
			bwImage.release()

			// Format the string to be converted to an integer.
			MessageLog.printToLog("[INFO] Detected number of fans from Tesseract before formatting: $result", tag = tag)
			result = result
				.replace(",", "")
				.replace(".", "")
				.replace("+", "")
				.replace("-", "")
				.replace(">", "")
				.replace("<", "")
				.replace("(", "")
				.replace("人", "")
				.replace("ォ", "")
				.replace("fans", "").trim()

			try {
				Log.d(tag, "Converting $result to integer for fans")
				val cleanedResult = result.replace(Regex("[^0-9]"), "")
				RaceDetails(cleanedResult.toInt(), predictionCheck)
			} catch (_: NumberFormatException) {
				RaceDetails(-1, predictionCheck)
			}
		} else {
			Log.d(tag, "This race has no double prediction.")
			return RaceDetails(-1, false)
		}
	}

	/**
	 * Determine the number of skill points.
	 *
	 * @return Number of skill points or -1 if not found.
	 */
	fun determineSkillPoints(): Int {
		val (skillPointLocation, sourceBitmap) = findImage("skill_points", tries = 1)

		return if (skillPointLocation != null) {
			// Determine crop region based on device type.
			val (offsetX, offsetY, width, height) = if (isTablet) {
				listOf(-75, 45, relWidth(150), relHeight(70))
			} else {
				listOf(-70, 28, relWidth(135), relHeight(70))
			}

			// Perform OCR with thresholding.
			val detectedText = performOCROnRegion(
				sourceBitmap,
				relX(skillPointLocation.x, offsetX),
				relY(skillPointLocation.y, offsetY),
				width,
				height,
				useThreshold = true,
				useGrayscale = true,
				scaleUp = 1,
				ocrEngine = "mlkit",
				debugName = "SkillPoints"
			)

			// Parse the result.
			MessageLog.printToLog("[INFO] Detected number of skill points before formatting: $detectedText", tag = tag)
			try {
				Log.d(tag, "Converting $detectedText to integer for skill points")
				val cleanedResult = detectedText.replace(Regex("[^0-9]"), "")
				cleanedResult.toInt()
			} catch (_: NumberFormatException) {
				-1
			}
		} else {
			MessageLog.printToLog("[ERROR] Could not start the process of detecting skill points.", tag = tag, isError = true)
			-1
		}
	}

	/**
	 * Analyze the relationship bars on the Training screen for the currently selected training. Parameter is optional to allow for thread-safe operations.
	 *
	 * @param sourceBitmap Bitmap of the source image separately taken. Defaults to null.
	 *
	 * @return A list of the results for each relationship bar.
	 */
	fun analyzeRelationshipBars(sourceBitmap: Bitmap? = null): ArrayList<BarFillResult> {
		val customRegion = intArrayOf(displayWidth - (displayWidth / 3), 0, (displayWidth / 3), displayHeight - (displayHeight / 3))

		// Take a single screenshot first to avoid buffer overflow.
		val sourceBitmap = sourceBitmap ?: getSourceBitmap()

		var allStatBlocks = mutableListOf<Point>()

		val latch = CountDownLatch(6)

		// Create arrays to store results from each thread.
		val speedBlocks = arrayListOf<Point>()
		val staminaBlocks = arrayListOf<Point>()
		val powerBlocks = arrayListOf<Point>()
		val gutsBlocks = arrayListOf<Point>()
		val witBlocks = arrayListOf<Point>()
		val friendshipBlocks = arrayListOf<Point>()

		// Start parallel threads for each findAll call, passing the same source bitmap.
		Thread {
			speedBlocks.addAll(findAllWithBitmap("stat_speed_block", sourceBitmap, region = customRegion))
			latch.countDown()
		}.start()

		Thread {
			staminaBlocks.addAll(findAllWithBitmap("stat_stamina_block", sourceBitmap, region = customRegion))
			latch.countDown()
		}.start()

		Thread {
			powerBlocks.addAll(findAllWithBitmap("stat_power_block", sourceBitmap, region = customRegion))
			latch.countDown()
		}.start()

		Thread {
			gutsBlocks.addAll(findAllWithBitmap("stat_guts_block", sourceBitmap, region = customRegion))
			latch.countDown()
		}.start()

		Thread {
			witBlocks.addAll(findAllWithBitmap("stat_wit_block", sourceBitmap, region = customRegion))
			latch.countDown()
		}.start()

		Thread {
			friendshipBlocks.addAll(findAllWithBitmap("stat_friendship_block", sourceBitmap, region = customRegion))
			latch.countDown()
		}.start()

		// Wait for all threads to complete.
		try {
			latch.await(10, TimeUnit.SECONDS)
		} catch (_: InterruptedException) {
			MessageLog.printToLog("[ERROR] Parallel findAll operations timed out.", tag = tag, isError = true)
		}

		// Combine all results.
		allStatBlocks.addAll(speedBlocks)
		allStatBlocks.addAll(staminaBlocks)
		allStatBlocks.addAll(powerBlocks)
		allStatBlocks.addAll(gutsBlocks)
		allStatBlocks.addAll(witBlocks)
		allStatBlocks.addAll(friendshipBlocks)

		// Filter out duplicates based on exact coordinate matches.
		allStatBlocks = allStatBlocks.distinctBy { "${it.x},${it.y}" }.toMutableList()

		// Sort the combined stat blocks by ascending y-coordinate.
		allStatBlocks.sortBy { it.y }

		// Define HSV color ranges.
		val blueLower = Scalar(10.0, 150.0, 150.0)
		val blueUpper = Scalar(25.0, 255.0, 255.0)
		val greenLower = Scalar(40.0, 150.0, 150.0)
		val greenUpper = Scalar(80.0, 255.0, 255.0)
		val orangeLower = Scalar(100.0, 150.0, 150.0)
		val orangeUpper = Scalar(130.0, 255.0, 255.0)

		val (_, maxedTemplateBitmap) = getBitmaps("stat_maxed")
		val results = arrayListOf<BarFillResult>()

		for ((index, statBlock) in allStatBlocks.withIndex()) {
			if (debugMode) MessageLog.printToLog("[DEBUG] Processing stat block #${index + 1} at position: (${statBlock.x}, ${statBlock.y})", tag = tag)

			val croppedBitmap = createSafeBitmap(sourceBitmap, relX(statBlock.x, -9), relY(statBlock.y, 107), 111, 13, "analyzeRelationshipBars stat block ${index + 1}")
			if (croppedBitmap == null) {
				MessageLog.printToLog("[ERROR] Failed to create cropped bitmap for stat block #${index + 1}.", tag = tag, isError = true)
				continue
			}

			val (isMaxed, _) = match(croppedBitmap, maxedTemplateBitmap!!, "stat_maxed")
			if (isMaxed) {
				// Skip if the relationship bar is already maxed.
				if (debugMode) MessageLog.printToLog("[DEBUG] Relationship bar #${index + 1} is full.", tag = tag)
				results.add(BarFillResult(100.0, 5, "orange"))
				continue
			}

			val barMat = Mat()
			Utils.bitmapToMat(croppedBitmap, barMat)

			// Convert to RGB and then to HSV for better color detection.
			val rgbMat = Mat()
			Imgproc.cvtColor(barMat, rgbMat, Imgproc.COLOR_BGR2RGB)
			if (debugMode) Imgcodecs.imwrite("$matchFilePath/debug_relationshipBar${index + 1}AfterRGB.png", rgbMat)
			val hsvMat = Mat()
			Imgproc.cvtColor(rgbMat, hsvMat, Imgproc.COLOR_RGB2HSV)

			val blueMask = Mat()
			val greenMask = Mat()
			val orangeMask = Mat()

			// Count the pixels for each color.
			Core.inRange(hsvMat, blueLower, blueUpper, blueMask)
			Core.inRange(hsvMat, greenLower, greenUpper, greenMask)
			Core.inRange(hsvMat, orangeLower, orangeUpper, orangeMask)
			val bluePixels = Core.countNonZero(blueMask)
			val greenPixels = Core.countNonZero(greenMask)
			val orangePixels = Core.countNonZero(orangeMask)

			// Sum the colored pixels.
			val totalColoredPixels = bluePixels + greenPixels + orangePixels
			val totalPixels = barMat.rows() * barMat.cols()

			// Estimate the fill percentage based on the total colored pixels.
			val fillPercent = if (totalPixels > 0) {
				(totalColoredPixels.toDouble() / totalPixels.toDouble()) * 100.0
			} else 0.0

			// Estimate the filled segments (each segment is about 20% of the whole bar).
			val filledSegments = (fillPercent / 20).coerceAtMost(5.0).toInt()

			val dominantColor = when {
				orangePixels > greenPixels && orangePixels > bluePixels -> "orange"
				greenPixels > bluePixels -> "green"
				bluePixels > 0 -> "blue"
				else -> "none"
			}

			blueMask.release()
			greenMask.release()
			orangeMask.release()
			hsvMat.release()
			barMat.release()

			if (debugMode) MessageLog.printToLog("[DEBUG] Relationship bar #${index + 1} is ${decimalFormat.format(fillPercent)}% filled with $filledSegments filled segments and the dominant color is $dominantColor", tag = tag)
			results.add(BarFillResult(fillPercent, filledSegments, dominantColor))
		}

		return results
	}

	/**
	 * Determines the preferred race distance based on aptitude levels (S, A, B) for each distance type on the Full Stats popup.
	 *
	 * This function analyzes the aptitude display for four race distances: Sprint, Mile, Medium, and Long.
	 * It uses template matching to detect S, A, and B aptitude levels and returns the distance with the
	 * highest aptitude found. The priority order is S > A > B, with S aptitude being returned immediately
	 * since it's the best possible outcome.
	 *
	 * @return The preferred distance (Sprint, Mile, Medium, or Long) or Medium as default if no aptitude is detected.
	 */
	fun determinePreferredDistance(): String {
		val (distanceLocation, sourceBitmap) = findImage("stat_distance", tries = 1, region = regionMiddle)
		if (distanceLocation == null) {
			MessageLog.printToLog("[ERROR] Could not determine the preferred distance. Setting to Medium by default.", tag = tag, isError = true)
			return "Medium"
		}

		val (_, statAptitudeSTemplate) = getBitmaps("stat_aptitude_S")
		val (_, statAptitudeATemplate) = getBitmaps("stat_aptitude_A")
		val (_, statAptitudeBTemplate) = getBitmaps("stat_aptitude_B")

		val distances = listOf("Sprint", "Mile", "Medium", "Long")
		var bestAptitudeDistance = ""
		var bestAptitudeLevel = -1 // -1 = none, 0 = B, 1 = A, 2 = S

		for (i in 0 until 4) {
			val distance = distances[i]
			val croppedBitmap = createSafeBitmap(sourceBitmap, relX(distanceLocation.x, 108 + (i * 190)), relY(distanceLocation.y, -25), 176, 52, "determinePreferredDistance distance $distance")
			if (croppedBitmap == null) {
				MessageLog.printToLog("[ERROR] Failed to create cropped bitmap for distance $distance.", tag = tag, isError = true)
				continue
			}

			when {
				match(croppedBitmap, statAptitudeSTemplate!!, "stat_aptitude_S").first -> {
					// S aptitude found - this is the best possible, return immediately.
					return distance
				}
				bestAptitudeLevel < 1 && match(croppedBitmap, statAptitudeATemplate!!, "stat_aptitude_A").first -> {
					// A aptitude found (pick the leftmost aptitude) - better than B, but keep looking for S.
					bestAptitudeDistance = distance
					bestAptitudeLevel = 1
				}
				bestAptitudeLevel < 0 && match(croppedBitmap, statAptitudeBTemplate!!, "stat_aptitude_B").first -> {
					// B aptitude found - only use if no A aptitude found yet.
					bestAptitudeDistance = distance
					bestAptitudeLevel = 0
				}
			}
		}

		return bestAptitudeDistance.ifEmpty {
			MessageLog.printToLog("[WARNING] Could not determine the preferred distance with at least B aptitude. Setting to Medium by default.", tag = tag, isError = true)
			"Medium"
		}
	}

	/**
	 * Reads the 5 stat values on the Main screen.
	 *
	 * @return The mapping of all 5 stats names to their respective integer values.
	 */
	fun determineStatValues(statValueMapping: MutableMap<String, Int>): MutableMap<String, Int> {
		val (skillPointsLocation, sourceBitmap) = findImage("skill_points")

		if (skillPointsLocation != null) {
			// Process all stats at once using the mapping.
			statValueMapping.keys.forEachIndexed { index, statName ->
				// Each stat is evenly spaced at 170 pixel intervals starting at offset -862.
				val offsetX = -862 + (index * 170)

				// Perform OCR with no thresholding (stats are on solid background).
				val result = performOCROnRegion(
					sourceBitmap,
					relX(skillPointsLocation.x, offsetX),
					relY(skillPointsLocation.y, 25),
					relWidth(98),
					relHeight(42),
					useThreshold = false,
					useGrayscale = true,
					scaleUp = 1,
					ocrEngine = "tesseract_digits",
					debugName = "${statName}StatValue"
				)

				// Parse the result.
				MessageLog.printToLog("[INFO] Detected number of stats for $statName from Tesseract before formatting: $result", tag = tag)
				if (result.lowercase().contains("max") || result.lowercase().contains("ax")) {
					MessageLog.printToLog("[INFO] $statName seems to be maxed out. Setting it to 1200.", tag = tag)
					statValueMapping[statName] = 1200
				} else {
					try {
						Log.d(tag, "Converting $result to integer for $statName stat value")
						val cleanedResult = result.replace(Regex("[^0-9]"), "")
						statValueMapping[statName] = cleanedResult.toInt()
					} catch (_: NumberFormatException) {
						statValueMapping[statName] = -1
					}
				}
			}
		} else {
			MessageLog.printToLog("[ERROR] Could not start the process of detecting stat values.", tag = tag, isError = true)
		}

		return statValueMapping
	}

	/**
	 * Performs OCR on the date region from either the Race List screen or the Main screen to extract the current date string.
	 *
	 * @return The detected date string from the game screen, or empty string if detection fails.
	 */
	fun determineDayString(): String {
		var result = ""
		val (raceStatusLocation, sourceBitmap) = findImage("race_status", tries = 1)
		if (raceStatusLocation != null) {
			// Perform OCR with thresholding (date text is on solid white background).
			game.printToLog("[INFO] Detecting date from the Race List screen.", tag = tag)
			result = performOCROnRegion(
				sourceBitmap,
				relX(raceStatusLocation.x, -170),
				relY(raceStatusLocation.y, 105),
				relWidth(640),
				relHeight(70),
				useThreshold = true,
				useGrayscale = true,
				scaleUp = 1,
				ocrEngine = "mlkit",
				debugName = "dateString"
			)
		} else {
			val (energyLocation, _) = findImage("energy")
			if (energyLocation != null) {
				// Perform OCR with no thresholding (date text is on moving background).
				game.printToLog("[INFO] Detecting date from the Main screen.", tag = tag)
				result = performOCROnRegion(
					sourceBitmap,
					relX(energyLocation.x, -268),
					relY(energyLocation.y, -180),
					relWidth(308),
					relHeight(35),
					useThreshold = false,
					useGrayscale = true,
					scaleUp = 1,
					ocrEngine = "mlkit",
					debugName = "dateString"
				)
			}
		}

		if (result != "") {
			MessageLog.printToLog("[INFO] Detected date: $result", tag = tag)
			
			if (debugMode) {
				MessageLog.printToLog("[DEBUG] Date string detected to be at \"$result\".", tag = tag)
			} else {
				Log.d(tag, "Date string detected to be at \"$result\".")
			}

			return result
		} else {
			MessageLog.printToLog("[ERROR] Could not start the process of detecting the date string.", tag = tag, isError = true)
		}

		return ""
	}

	/**
	 * Determines the stat gain values from training. Parameters are optional to allow for thread-safe operations.
	 *
	 * This function uses template matching to find individual digits and the "+" symbol in the
	 * stat gain area of the training screen. It processes templates for digits 0-9 and the "+"
	 * symbol, then constructs the final integer value by analyzing the spatial arrangement
	 * of detected matches.
	 *
	 * @param trainingName Name of the currently selected training to determine which stats to read.
	 * @param sourceBitmap Bitmap of the source image separately taken. Defaults to null.
	 * @param skillPointsLocation Point location of the template image separately taken. Defaults to null.
	 *
	 * @return Array of 5 detected stat gain values as integers, or -1 for failed detections.
	 */
	fun determineStatGainFromTraining(trainingName: String, sourceBitmap: Bitmap? = null, skillPointsLocation: Point? = null): IntArray {
		val templates = listOf("+", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9")
		val statNames = listOf("Speed", "Stamina", "Power", "Guts", "Wit")
		// Define a mapping of training types to their stat indices
		val trainingToStatIndices = mapOf(
			"Speed" to listOf(0, 2),
			"Stamina" to listOf(1, 3),
			"Power" to listOf(1, 2),
			"Guts" to listOf(0, 2, 3),
			"Wit" to listOf(0, 4)
		)

		val (skillPointsLocation, sourceBitmap) = if (sourceBitmap == null && skillPointsLocation == null) {
			findImage("skill_points")
		} else {
			Pair(skillPointsLocation, sourceBitmap)
		}

		val threadSafeResults = IntArray(5)

		if (skillPointsLocation != null) {
			// Pre-load all template bitmaps to avoid thread contention
			val templateBitmaps = mutableMapOf<String, Bitmap?>()
			for (templateName in templates) {
				context.assets?.open("images/$templateName.png").use { inputStream ->
					templateBitmaps[templateName] = BitmapFactory.decodeStream(inputStream)
				}
			}

			// Process all stats in parallel using threads.
			val statLatch = CountDownLatch(5)
			for (i in 0 until 5) {
				Thread {
					try {
						// Stop the Thread early if the selected Training would not offer stats for the stat to be checked.
						// Speed gives Speed and Power
						// Stamina gives Stamina and Guts
						// Power gives Stamina and Power
						// Guts gives Speed, Power and Guts
						// Wits gives Speed and Wits
						val validIndices = trainingToStatIndices[trainingName] ?: return@Thread
						if (i !in validIndices) return@Thread

						val statName = statNames[i]
						val xOffset = i * 180 // All stats are evenly spaced at 180 pixel intervals.

						val croppedBitmap = createSafeBitmap(sourceBitmap!!, relX(skillPointsLocation.x, -934 + xOffset), relY(skillPointsLocation.y, -103), relWidth(150), relHeight(82), "determineStatGainFromTraining $statName")
						if (croppedBitmap == null) {
							Log.e(tag, "[ERROR] Failed to create cropped bitmap for $statName stat gain detection from $trainingName training.")
							threadSafeResults[i] = 0
							statLatch.countDown()
							return@Thread
						}

						// Convert to Mat and then turn it to grayscale.
						val sourceMat = Mat()
						Utils.bitmapToMat(croppedBitmap, sourceMat)
						val sourceGray = Mat()
						Imgproc.cvtColor(sourceMat, sourceGray, Imgproc.COLOR_BGR2GRAY)

						val workingMat = Mat()
						sourceGray.copyTo(workingMat)

						var matchResults = mutableMapOf<String, MutableList<Point>>()
						templates.forEach { template ->
							matchResults[template] = mutableListOf()
						}

						for (templateName in templates) {
							val templateBitmap = templateBitmaps[templateName]
							if (templateBitmap != null) {
								matchResults = processStatGainTemplateWithTransparency(templateName, templateBitmap, workingMat, matchResults)
							} else {
								Log.e(tag, "[ERROR] Could not load template \"$templateName\" to process stat gains for $trainingName training.")
							}
						}

						// Analyze results and construct the final integer value for this region.
						val finalValue = constructIntegerFromMatches(matchResults)
						threadSafeResults[i] = finalValue
						Log.d(tag, "[INFO] $statName region final constructed value from $trainingName training: $finalValue.")

						// Draw final visualization with all matches for this region.
						if (debugMode) {
							val resultMat = Mat()
							Utils.bitmapToMat(croppedBitmap, resultMat)
							templates.forEachIndexed { index, templateName ->
								matchResults[templateName]?.forEach { point ->
									val templateBitmap = templateBitmaps[templateName]
									if (templateBitmap != null) {
										val templateWidth = templateBitmap.width
										val templateHeight = templateBitmap.height

										// Calculate the bounding box coordinates.
										val x1 = (point.x - templateWidth/2).toInt()
										val y1 = (point.y - templateHeight/2).toInt()
										val x2 = (point.x + templateWidth/2).toInt()
										val y2 = (point.y + templateHeight/2).toInt()

										// Draw the bounding box.
										Imgproc.rectangle(resultMat, Point(x1.toDouble(), y1.toDouble()), Point(x2.toDouble(), y2.toDouble()), Scalar(0.0, 0.0, 0.0), 2)

										// Add text label.
										Imgproc.putText(resultMat, templateName, Point(point.x, point.y), Imgproc.FONT_HERSHEY_SIMPLEX, 0.5, Scalar(0.0, 0.0, 0.0), 1)
									}
								}
							}

							Imgcodecs.imwrite("$matchFilePath/debug_${trainingName}TrainingStatGain_${statNames[i]}.png", resultMat)
						}

						sourceMat.release()
						sourceGray.release()
						workingMat.release()
					} catch (e: Exception) {
						Log.e(tag, "[ERROR] Error processing stat ${statNames[i]} for $trainingName training: ${e.stackTraceToString()}")
						threadSafeResults[i] = 0
					} finally {
						statLatch.countDown()
					}
				}.start()
			}

			// Wait for all threads to complete.
			try {
				statLatch.await(30, TimeUnit.SECONDS)
			} catch (_: InterruptedException) {
				MessageLog.printToLog("[ERROR] Stat processing timed out for $trainingName training.", tag = tag, isError = true)
			}

			// Apply artificial boost to main stat gains if they appear lower than side-effect stats.
			val boostedResults = applyStatGainBoost(trainingName, threadSafeResults, statNames, trainingToStatIndices)
			return boostedResults
		} else {
			MessageLog.printToLog("[ERROR] Could not find the skill points location to start determining stat gains for $trainingName training.", tag = tag, isError = true)
		}

		return threadSafeResults
	}

	/**
	 * Applies artificial boost to main stat gains when they appear lower than side-effect stats due to OCR failure.
	 * 
	 * @param trainingName Name of the training type (Speed, Stamina, Power, Guts, Wit).
	 * @param statGains Array of 5 stat gains.
	 * @param statNames List of stat names in order.
	 * @param trainingToStatIndices Mapping of training types to their affected stat indices.
	 * @return Array of stat gains with potential artificial boost applied to main stat.
	 */
	private fun applyStatGainBoost(trainingName: String, statGains: IntArray, statNames: List<String>, trainingToStatIndices: Map<String, List<Int>>): IntArray {
		val boostedResults = statGains.clone()
		
		// Define the main stat index for each training type.
		val mainStatIndex = when (trainingName) {
			"Speed" -> 0
			"Stamina" -> 1
			"Power" -> 2
			"Guts" -> 3
			"Wit" -> 4
			else -> return boostedResults
		}
		
		// Get the stat indices affected by this training type and filter out the main stat to get side-effects.
		val affectedIndices = trainingToStatIndices[trainingName] ?: return boostedResults
		val sideEffectIndices = affectedIndices.filter { it != mainStatIndex }
		
		val mainStatGain = boostedResults[mainStatIndex]
		val mainStatName = statNames[mainStatIndex]
		
		// Check if any side-effect stat has a higher gain than the main stat.
		val maxSideEffectGain = sideEffectIndices.maxOfOrNull { boostedResults[it] } ?: 0
		
		if (mainStatGain > 0 && maxSideEffectGain > mainStatGain) {
			// Set main stat to be 10 points higher than the highest side-effect stat.
			val originalGain = boostedResults[mainStatIndex]
			boostedResults[mainStatIndex] = maxSideEffectGain + 10
			Log.d(tag,
				"[DEBUG] Artificially increased $mainStatName stat gain from $originalGain to ${boostedResults[mainStatIndex]} due to possible OCR failure. " +
				"Side-effect stats had higher gains: ${sideEffectIndices.joinToString(", ") { "${statNames[it]} = ${boostedResults[it]}" }}"
			)
		} else if (mainStatGain == 0) {
			// Set main stat to be 10 points higher than the highest side-effect stat when main stat is 0.
			boostedResults[mainStatIndex] = maxSideEffectGain + 10
			Log.d(tag, "[DEBUG] Artificially increased $mainStatName stat gain to ${boostedResults[mainStatIndex]} due to possible OCR failure of 0 gains for the main stat. " +
				"Based on highest side-effect: ${sideEffectIndices.joinToString(", ") { "${statNames[it]} = ${boostedResults[it]}" }}"
			)
		}

		// If the side-effect stat gains were zeroes, boost them to half of the main stat gain.
		val boostedMainStatGain = boostedResults[mainStatIndex]
		sideEffectIndices.forEach { idx ->
			if (boostedResults[idx] == 0 && boostedMainStatGain > 0) {
				boostedResults[idx] = boostedMainStatGain / 2
				Log.d(tag, "[DEBUG] Artificially increased ${statNames[idx]} side-effect stat gain to ${boostedResults[idx]} because it was 0 due to possible OCR failure. " +
						"Based on half of boosted $mainStatName = $boostedMainStatGain."
				)
			}
		}
		
		return boostedResults
	}

	/**
	 * Processes a single template with transparency to find all valid matches in the working matrix through a multi-stage algorithm.
	 *
	 * The algorithm uses two validation criteria:
	 * - Pixel match ratio: Ensures sufficient pixel-level similarity.
	 * - Correlation coefficient: Validates statistical correlation between template and matched region.
	 *
	 * @param templateName Name of the template being processed (used for logging and debugging).
	 * @param templateBitmap Bitmap of the template image (must have 4-channel RGBA format with transparency).
	 * @param workingMat Working matrix to search in (grayscale source image).
	 * @param matchResults Map to store match results, organized by template name.
	 *
	 * @return The modified matchResults mapping containing all valid matches found for this template
	 */
	private fun processStatGainTemplateWithTransparency(templateName: String, templateBitmap: Bitmap, workingMat: Mat, matchResults: MutableMap<String, MutableList<Point>>): MutableMap<String, MutableList<Point>> {
		// These values have been tested for the best results against the dynamic background.
		val matchConfidence = 0.9
		val minPixelMatchRatio = 0.1
		val minPixelCorrelation = 0.85

		// Convert template to Mat and then to grayscale.
		val templateMat = Mat()
		val templateGray = Mat()
		Utils.bitmapToMat(templateBitmap, templateMat)
		Imgproc.cvtColor(templateMat, templateGray, Imgproc.COLOR_BGR2GRAY)

		// Check if template has an alpha channel (transparency).
		if (templateMat.channels() != 4) {
			Log.e(tag, "[ERROR] Template \"$templateName\" is not transparent and is a requirement.")
			templateMat.release()
			templateGray.release()
			return matchResults
		}

		// Extract alpha channel for the alpha mask.
		val alphaChannels = ArrayList<Mat>()
		Core.split(templateMat, alphaChannels)
		val alphaMask = alphaChannels[3] // Alpha channel is the 4th channel.

		// Create binary mask for non-transparent pixels.
		val validPixels = Mat()
		Core.compare(alphaMask, Scalar(0.0), validPixels, Core.CMP_GT)

		// Check transparency ratio.
		val nonZeroPixels = Core.countNonZero(alphaMask)
		val totalPixels = alphaMask.rows() * alphaMask.cols()
		val transparencyRatio = nonZeroPixels.toDouble() / totalPixels
		if (transparencyRatio < 0.1) {
			Log.w(tag, "[DEBUG] Template \"$templateName\" appears to be mostly transparent!")
			alphaChannels.forEach { it.release() }
			validPixels.release()
			alphaMask.release()
			templateMat.release()
			templateGray.release()
			return matchResults
		}

		////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////

		var continueSearching = true
		var searchMat = Mat()
		var xOffset = 0
		workingMat.copyTo(searchMat)

		while (continueSearching) {
			var failedPixelMatchRatio = false
			var failedPixelCorrelation = false

			// Template match with the alpha mask.
			val result = Mat()
			Imgproc.matchTemplate(searchMat, templateGray, result, Imgproc.TM_CCORR_NORMED, alphaMask)
			val mmr = Core.minMaxLoc(result)
			val matchVal = mmr.maxVal
			val matchLocation = mmr.maxLoc

			if (matchVal >= matchConfidence) {
				val x = matchLocation.x.toInt()
				val y = matchLocation.y.toInt()
				val h = templateGray.rows()
				val w = templateGray.cols()

				// Validate that the match location is within bounds.
				if (x >= 0 && y >= 0 && x + w <= searchMat.cols() && y + h <= searchMat.rows()) {
					// Extract the matched region from the source image.
					val matchedRegion = Mat(searchMat, Rect(x, y, w, h))

					// Create masked versions of the template and matched region using only non-transparent pixels.
					val templateValid = Mat()
					val regionValid = Mat()
					templateGray.copyTo(templateValid, validPixels)
					matchedRegion.copyTo(regionValid, validPixels)

					// For the first test, compare pixel-by-pixel equality between the matched region and template to calculate match ratio.
					val templateComparison = Mat()
					Core.compare(matchedRegion, templateGray, templateComparison, Core.CMP_EQ)
					val matchingPixels = Core.countNonZero(templateComparison)
					val pixelMatchRatio = matchingPixels.toDouble() / (w * h)
					if (pixelMatchRatio < minPixelMatchRatio) {
						failedPixelMatchRatio = true
					}

					// Extract pixel values into double arrays for correlation calculation.
					val templateValidMat = Mat()
					val regionValidMat = Mat()
					templateValid.convertTo(templateValidMat, CvType.CV_64F)
					regionValid.convertTo(regionValidMat, CvType.CV_64F)
					val templateArray = DoubleArray(templateValid.total().toInt())
					val regionArray = DoubleArray(regionValid.total().toInt())
					templateValidMat.get(0, 0, templateArray)
					regionValidMat.get(0, 0, regionArray)

					// For the second test, validate the match quality by performing correlation calculation.
					val pixelCorrelation = calculateCorrelation(templateArray, regionArray)
					if (pixelCorrelation < minPixelCorrelation) {
						failedPixelCorrelation = true
					}

					// If both tests passed, then the match is valid.
					if (!failedPixelMatchRatio && !failedPixelCorrelation) {
						val centerX = (x + xOffset) + (w / 2)
						val centerY = y + (h / 2)

						// Check for overlap with existing matches within 10 pixels on both axes.
						val hasOverlap = matchResults.values.flatten().any { existingPoint ->
							val existingX = existingPoint.x
							val existingY = existingPoint.y

							// Check if the new match overlaps with existing match within 10 pixels.
							val xOverlap = kotlin.math.abs(centerX - existingX) < 10
							val yOverlap = kotlin.math.abs(centerY - existingY) < 10

							xOverlap && yOverlap
						}

						if (!hasOverlap) {
							Log.d(tag, "[DEBUG] Found valid match for template \"$templateName\" at ($centerX, $centerY).")
							matchResults[templateName]?.add(Point(centerX.toDouble(), centerY.toDouble()))
						}
					}

					// Draw a box to prevent re-detection in the next loop iteration.
					Imgproc.rectangle(searchMat, Point(x.toDouble(), y.toDouble()), Point((x + w).toDouble(), (y + h).toDouble()), Scalar(0.0, 0.0, 0.0), 10)

					templateComparison.release()
					matchedRegion.release()
					templateValid.release()
					regionValid.release()
					templateValidMat.release()
					regionValidMat.release()

					// Crop the Mat horizontally to exclude the supposed matched area.
					val cropX = x + w
					val remainingWidth = searchMat.cols() - cropX
					when {
						remainingWidth < templateGray.cols() -> {
							continueSearching = false
						}
						else -> {
							val newSearchMat = Mat(searchMat, Rect(cropX, 0, remainingWidth, searchMat.rows()))
							searchMat.release()
							searchMat = newSearchMat
							xOffset += cropX
						}
					}
				} else {
					// Stop searching when the source has been traversed.
					continueSearching = false
				}
			} else {
				// No match found above threshold, stop searching for this template.
				continueSearching = false
			}

			result.release()

			// Safety check to prevent infinite loops.
			if ((matchResults[templateName]?.size ?: 0) > 10) {
				continueSearching = false
			}
			if (!BotService.isRunning) {
				throw InterruptedException()
			}
		}

		////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////

		searchMat.release()
		alphaChannels.forEach { it.release() }
		validPixels.release()
		alphaMask.release()
		templateMat.release()
		templateGray.release()

		return matchResults
	}

	/**
	 * Constructs the final integer value from matched template locations of numbers by analyzing spatial arrangement.
	 *
	 * The function is designed for OCR-like scenarios where individual character templates
	 * are matched separately and need to be reconstructed into a complete number.
	 *
	 * If matchResults contains: {"+" -> [(10, 20)], "1" -> [(15, 20)], "2" -> [(20, 20)]}, it returns: 12 (from string "+12").
	 *
	 * @param matchResults Map of template names (e.g., "0", "1", "2", "+") to their match locations.
	 *
	 * @return The constructed integer value or -1 if it failed.
	 */
	private fun constructIntegerFromMatches(matchResults: Map<String, MutableList<Point>>): Int {
		// Collect all matches with their template names.
		val allMatches = mutableListOf<Pair<String, Point>>()
		matchResults.forEach { (templateName, points) ->
			points.forEach { point ->
				allMatches.add(Pair(templateName, point))
			}
		}

		if (allMatches.isEmpty()) {
			Log.d(tag, "[WARNING] No matches found to construct integer value.")
			return 0
		}

		// Sort matches by x-coordinate (left to right).
		allMatches.sortBy { it.second.x }
		Log.d(tag, "[DEBUG] Sorted matches: ${allMatches.map { "${it.first}@(${it.second.x}, ${it.second.y})" }}")

		// Construct the string representation and then validate the format: start with + and contain only digits after.
		val constructedString = allMatches.joinToString("") { it.first }
		Log.d(tag, "[DEBUG] Constructed string: \"$constructedString\".")

		// Extract the numeric part and convert to integer.
		return try {
            if (constructedString === "+") {
                Log.w(tag, "[WARNING] Constructed string was just the plus sign. Setting the result to 0.")
                return 0
            }

			val numericPart = if (constructedString.startsWith("+") && constructedString.substring(1).isNotEmpty()) {
				constructedString.substring(1)
			} else {
				constructedString
			}

			val result = numericPart.toInt()
			Log.d(tag, "[DEBUG] Successfully constructed integer value: $result from \"$constructedString\".")
			result
		} catch (e: NumberFormatException) {
			Log.e(tag, "[ERROR] Could not convert \"$constructedString\" to integer: ${e.stackTraceToString()}")
			0
		}
	}

	/**
	 * Calculates the Pearson correlation coefficient between two arrays of pixel values.
	 *
	 * The Pearson correlation coefficient measures the linear correlation between two variables,
	 * ranging from -1 (perfect negative correlation) to +1 (perfect positive correlation).
	 * A value of 0 indicates no linear correlation.
	 *
	 * @param array1 First array of pixel values from the template image.
	 * @param array2 Second array of pixel values from the matched region.
	 * @return Correlation coefficient between -1.0 and +1.0, or 0.0 if arrays are invalid
	 */
	private fun calculateCorrelation(array1: DoubleArray, array2: DoubleArray): Double {
		if (array1.size != array2.size || array1.isEmpty()) {
			return 0.0
		}

		val n = array1.size
		val sum1 = array1.sum()
		val sum2 = array2.sum()
		val sum1Sq = array1.sumOf { it * it }
		val sum2Sq = array2.sumOf { it * it }
		val pSum = array1.zip(array2).sumOf { it.first * it.second }

		// Calculate the numerator: n*Σ(xy) - Σx*Σy
		val num = pSum - (sum1 * sum2 / n)
		// Calculate the denominator: sqrt((n*Σx² - (Σx)²) * (n*Σy² - (Σy)²))
		val den = sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n))

		// Return the correlation coefficient, handling division by zero.
		return if (den == 0.0) 0.0 else num / den
	}

	////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////
	// Helper functions for OCR operations.

	/**
	 * Performs OCR using Tesseract on the provided bitmap.
	 *
	 * @param bitmap The bitmap to perform OCR on.
	 * @return The detected text string or empty string if OCR fails.
	 */
	private fun performTesseractOCR(bitmap: Bitmap): String {
		tessBaseAPI.setImage(bitmap)
		return try {
			val result = tessBaseAPI.utF8Text
			tessBaseAPI.clear()
			result
		} catch (e: Exception) {
			MessageLog.printToLog("[ERROR] Cannot perform OCR with Tesseract: ${e.stackTraceToString()}", tag = tag, isError = true)
			tessBaseAPI.clear()
			""
		}
	}

	/**
	 * Performs OCR using Tesseract with digits-only training data on the provided bitmap.
	 *
	 * @param bitmap The bitmap to perform OCR on.
	 * @return The detected text string or empty string if OCR fails.
	 */
	private fun performTesseractDigitsOCR(bitmap: Bitmap): String {
		tessDigitsBaseAPI.setImage(bitmap)
		return try {
			val result = tessDigitsBaseAPI.utF8Text
			tessDigitsBaseAPI.clear()
			result
		} catch (e: Exception) {
			MessageLog.printToLog("[ERROR] Cannot perform OCR with Tesseract Digits: ${e.stackTraceToString()}", tag = tag, isError = true)
			tessDigitsBaseAPI.clear()
			""
		}
	}

	/**
	 * Performs OCR using Google ML Kit on the provided bitmap with fallback to Tesseract.
	 *
	 * @param bitmap The bitmap to perform OCR on.
	 * @param fallbackToTesseract Whether to fallback to Tesseract if ML Kit fails. Defaults to true.
	 * @return The detected text string or empty string if OCR fails.
	 */
	private fun performMLKitOCR(bitmap: Bitmap, fallbackToTesseract: Boolean = true): String {
		val inputImage: InputImage = InputImage.fromBitmap(bitmap, 0)
		val latch = CountDownLatch(1)
		var result = ""
		var mlkitFailed = false

		googleTextRecognizer.process(inputImage)
			.addOnSuccessListener { text ->
				if (text.textBlocks.isNotEmpty()) {
					for (block in text.textBlocks) {
						result = block.text
					}
				}
				latch.countDown()
			}
			.addOnFailureListener {
				MessageLog.printToLog("[ERROR] Failed to do text detection via Google's ML Kit.", tag = tag, isError = true)
				mlkitFailed = true
				latch.countDown()
			}

		// Wait for the async operation to complete.
		try {
			latch.await(5, TimeUnit.SECONDS)
		} catch (_: InterruptedException) {
			MessageLog.printToLog("[ERROR] Google ML Kit operation timed out.", tag = tag, isError = true)
		}

		// Fallback to Tesseract if ML Kit failed or didn't find result.
		if (fallbackToTesseract && (mlkitFailed || result.isEmpty())) {
			MessageLog.printToLog("[INFO] Falling back to Tesseract OCR.", tag = tag)
			return performTesseractDigitsOCR(bitmap)
		}

		return result
	}

	/**
	 * Performs OCR on a cropped region of a source bitmap with optional preprocessing.
	 * 
	 * @param sourceBitmap The source image to crop from.
	 * @param x The x-coordinate of the crop region.
	 * @param y The y-coordinate of the crop region.
	 * @param width The width of the crop region.
	 * @param height The height of the crop region.
	 * @param useThreshold Whether to apply binary thresholding. Defaults to true.
	 * @param useGrayscale Whether to convert to grayscale first. Defaults to true.
	 * @param scaleUp Factor to scale up the cropped image before OCR. Defaults to 1 (no scaling).
	 * @param ocrEngine The OCR engine to use ("tesseract", "mlkit", or "tesseract_digits"). Defaults to "tesseract".
	 * @param debugName Optional name for debug image saving.
	 * 
	 * @return The detected text string or empty string if OCR fails.
	 */
	fun performOCROnRegion(
		sourceBitmap: Bitmap,
		x: Int,
		y: Int,
		width: Int,
		height: Int,
		useThreshold: Boolean = true,
		useGrayscale: Boolean = true,
		scaleUp: Int = 1,
		ocrEngine: String = "tesseract",
		debugName: String = ""
	): String {
		val croppedBitmap = createSafeBitmap(sourceBitmap, x, y, width, height, debugName) 
			?: return ""
		
		val cvImage = Mat()
		Utils.bitmapToMat(croppedBitmap, cvImage)
		
		// Apply grayscale if needed.
		if (useGrayscale) {
			Imgproc.cvtColor(cvImage, cvImage, Imgproc.COLOR_BGR2GRAY)
			if (debugMode && debugName.isNotEmpty()) {
				Imgcodecs.imwrite("$matchFilePath/debug_${debugName}_afterGrayscale.png", cvImage)
			}
		}
		
		// Apply thresholding if needed.
		val processedImage = if (useThreshold) {
			val bwImage = Mat()
			Imgproc.threshold(cvImage, bwImage, threshold.toDouble(), 255.0, Imgproc.THRESH_BINARY)
			if (debugMode && debugName.isNotEmpty()) {
				Imgcodecs.imwrite("$matchFilePath/debug_${debugName}_afterThreshold.png", bwImage)
			}
			cvImage.release()
			bwImage
		} else {
			cvImage
		}
		
		// Scale up if needed.
		val finalBitmap = if (scaleUp > 1) {
			val resultBitmap = createBitmap(processedImage.cols(), processedImage.rows())
			Utils.matToBitmap(processedImage, resultBitmap)
			resultBitmap.scale(resultBitmap.width * scaleUp, resultBitmap.height * scaleUp)
		} else {
			val resultBitmap = createBitmap(processedImage.cols(), processedImage.rows())
			Utils.matToBitmap(processedImage, resultBitmap)
			resultBitmap
		}
		
		// Perform OCR based on selected engine.
		val result = when (ocrEngine) {
			"mlkit" -> performMLKitOCR(finalBitmap)
			"tesseract_digits" -> performTesseractDigitsOCR(finalBitmap)
			else -> performTesseractOCR(finalBitmap)
		}
		
		processedImage.release()
		return result
	}

	/**
	 * Performs OCR on a custom region using a reference point.
	 * 
	 * @param referencePoint The point to base the crop region on.
	 * @param offsetX Offset from reference point x-coordinate.
	 * @param offsetY Offset from reference point y-coordinate.
	 * @param width Width of the crop region.
	 * @param height Height of the crop region.
	 * @param useThreshold Whether to apply binary thresholding. Defaults to true.
	 * @param useGrayscale Whether to convert to grayscale first. Defaults to true.
	 * @param scaleUp Factor to scale up the cropped image before OCR. Defaults to 1.
	 * @param ocrEngine The OCR engine to use. Defaults to "tesseract".
	 * @param debugName Optional name for debug image saving.
	 * 
	 * @return The detected text string or empty string if OCR fails.
	 */
	fun performOCRFromReference(
		referencePoint: Point,
		offsetX: Int,
		offsetY: Int,
		width: Int,
		height: Int,
		useThreshold: Boolean = true,
		useGrayscale: Boolean = true,
		scaleUp: Int = 1,
		ocrEngine: String = "tesseract",
		debugName: String = ""
	): String {
		val sourceBitmap = getSourceBitmap()
		val finalX = relX(referencePoint.x, offsetX)
		val finalY = relY(referencePoint.y, offsetY)
		
		return performOCROnRegion(
			sourceBitmap,
			finalX,
			finalY,
			width,
			height,
			useThreshold,
			useGrayscale,
			scaleUp,
			ocrEngine,
			debugName
		)
	}
}