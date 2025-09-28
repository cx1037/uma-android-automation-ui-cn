import { useContext, useState, useMemo, useCallback } from "react"
import { MessageLogContext } from "../../context/MessageLogContext"
import { BotStateContext } from "../../context/BotStateContext"
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList } from "react-native"
import * as Clipboard from "expo-clipboard"
import { Copy, Plus, Minus, Type, X } from "lucide-react-native"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog"

const styles = StyleSheet.create({
    logInnerContainer: {
        flex: 1,
        width: "100%",
        backgroundColor: "#2f2f2f",
        borderStyle: "solid",
        borderRadius: 25,
        marginBottom: 10,
        elevation: 10,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: "#3a3a3a",
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
    },
    searchInput: {
        flex: 1,
        backgroundColor: "transparent",
        color: "white",
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#4a4a4a",
        borderRadius: 8,
        marginRight: 8,
    },
    clearButton: {
        padding: 4,
        marginRight: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: "#5a5a5a",
        marginLeft: 4,
    },
    logContainer: {
        flex: 1,
        paddingHorizontal: 15,
        paddingBottom: 10,
        marginTop: 10,
    },
    logText: {
        color: "white",
        fontFamily: "monospace",
    },
    logTextWarning: {
        color: "#ffa500",
        fontFamily: "monospace",
    },
    logTextError: {
        color: "#ff4444",
        fontFamily: "monospace",
    },
    logItem: {
        paddingVertical: 1,
        paddingHorizontal: 2,
    },
    popoverContentContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    popoverButtonContainer: {
        flexDirection: "row",
        gap: 8,
    },
    popoverButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 4,
        backgroundColor: "#5a5a5a",
        width: 28,
        height: 28,
    },
    fontSizeDisplay: {
        color: "white",
        fontSize: 12,
        fontWeight: "600",
    },
})

interface LogMessage {
    id: string
    text: string
    type: "normal" | "warning" | "error"
}

const MessageLog = () => {
    const mlc = useContext(MessageLogContext)
    const bsc = useContext(BotStateContext)
    const [searchQuery, setSearchQuery] = useState("")
    const [fontSize, setFontSize] = useState(8)
    const [showErrorDialog, setShowErrorDialog] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    const showError = useCallback((message: string) => {
        setErrorMessage(message)
        setShowErrorDialog(true)
    }, [])

    const formatSettings = useCallback(() => {
        const settings = bsc.settings

        // Campaign selection.
        const campaignString = settings.general.scenario !== "" ? `🎯 ${settings.general.scenario}` : "⚠️ Please select one in the Select Campaign option"

        // Character selection.
        const characterString = settings.trainingEvent.selectAllCharacters
            ? "👥 All Characters Selected"
            : Object.keys(settings.trainingEvent.characterEventData).length > 0
            ? `👤 ${Object.keys(settings.trainingEvent.characterEventData).length} Characters Selected`
            : "⚠️ Please select one in the Training Event Settings"

        // Support card selection.
        const supportCardListString = settings.trainingEvent.selectAllSupportCards
            ? "🃏 All Support Cards Selected"
            : Object.keys(settings.trainingEvent.supportEventData).length > 0
            ? `🃏 ${Object.keys(settings.trainingEvent.supportEventData).length} Support Cards Selected`
            : "⚠️ None Selected"

        // Training blacklist.
        const trainingBlacklistString = settings.training.trainingBlacklist.length === 0 ? "✅ No Trainings blacklisted" : `🚫 ${settings.training.trainingBlacklist.join(", ")}`

        // Stat prioritization.
        const statPrioritizationString =
            settings.training.statPrioritization.length === 0
                ? "📊 Using Default Stat Prioritization: Speed, Stamina, Power, Guts, Wit"
                : `📊 Stat Prioritization: ${settings.training.statPrioritization.join(", ")}`

        // Focus on spark stat target.
        const focusOnSparkString = settings.training.focusOnSparkStatTarget ? "✨ Focus on Sparks for Stat Targets: ✅" : "✨ Focus on Sparks for Stat Targets: ❌"

        // Training stat targets by distance.
        const sprintTargetsString = `Sprint: \n\t\tSpeed: ${settings.trainingStatTarget.trainingSprintStatTarget_speedStatTarget}\t\tStamina: ${settings.trainingStatTarget.trainingSprintStatTarget_staminaStatTarget}\t\tPower: ${settings.trainingStatTarget.trainingSprintStatTarget_powerStatTarget}\n\t\tGuts: ${settings.trainingStatTarget.trainingSprintStatTarget_gutsStatTarget}\t\t\tWit: ${settings.trainingStatTarget.trainingSprintStatTarget_witStatTarget}`

        const mileTargetsString = `Mile: \n\t\tSpeed: ${settings.trainingStatTarget.trainingMileStatTarget_speedStatTarget}\t\tStamina: ${settings.trainingStatTarget.trainingMileStatTarget_staminaStatTarget}\t\tPower: ${settings.trainingStatTarget.trainingMileStatTarget_powerStatTarget}\n\t\tGuts: ${settings.trainingStatTarget.trainingMileStatTarget_gutsStatTarget}\t\t\tWit: ${settings.trainingStatTarget.trainingMileStatTarget_witStatTarget}`

        const mediumTargetsString = `Medium: \n\t\tSpeed: ${settings.trainingStatTarget.trainingMediumStatTarget_speedStatTarget}\t\tStamina: ${settings.trainingStatTarget.trainingMediumStatTarget_staminaStatTarget}\t\tPower: ${settings.trainingStatTarget.trainingMediumStatTarget_powerStatTarget}\n\t\tGuts: ${settings.trainingStatTarget.trainingMediumStatTarget_gutsStatTarget}\t\t\tWit: ${settings.trainingStatTarget.trainingMediumStatTarget_witStatTarget}`

        const longTargetsString = `Long: \n\t\tSpeed: ${settings.trainingStatTarget.trainingLongStatTarget_speedStatTarget}\t\tStamina: ${settings.trainingStatTarget.trainingLongStatTarget_staminaStatTarget}\t\tPower: ${settings.trainingStatTarget.trainingLongStatTarget_powerStatTarget}\n\t\tGuts: ${settings.trainingStatTarget.trainingLongStatTarget_gutsStatTarget}\t\t\tWit: ${settings.trainingStatTarget.trainingLongStatTarget_witStatTarget}`

        return `****************************************
Welcome to ${bsc.appName} v${bsc.appVersion}
****************************************

Campaign Selected: ${campaignString}

---------- Training Event Options ----------
Character Selected: ${characterString}
Support(s) Selected: ${supportCardListString}

---------- Training Options ----------
Training Blacklist: ${trainingBlacklistString}
${statPrioritizationString}
Maximum Failure Chance Allowed: ${settings.training.maximumFailureChance}%
Disable Training on Maxed Stat: ${settings.training.disableTrainingOnMaxedStat ? "✅" : "❌"}
${focusOnSparkString}

---------- Training Stat Targets by Distance ----------
${sprintTargetsString}
${mileTargetsString}
${mediumTargetsString}
${longTargetsString}

---------- Tesseract OCR Optimization ----------
OCR Threshold: ${settings.ocr.ocrThreshold}
Enable Automatic OCR retry: ${settings.ocr.enableAutomaticOCRRetry ? "✅" : "❌"}
Minimum OCR Confidence: ${settings.ocr.ocrConfidence}

---------- Racing Options ----------
Prioritize Farming Fans: ${settings.racing.enableFarmingFans ? "✅" : "❌"}
Modulo Days to Farm Fans: ${settings.racing.enableFarmingFans ? `📅 ${settings.racing.daysToRunExtraRaces} days` : "❌"}
Disable Race Retries: ${settings.racing.disableRaceRetries ? "✅" : "❌"}
Stop on Mandatory Race: ${settings.racing.enableStopOnMandatoryRaces ? "✅" : "❌"}
Force Racing Every Day: ${settings.racing.enableForceRacing ? "✅" : "❌"}

---------- Misc Options ----------
Skill Point Check: ${settings.general.enableSkillPointCheck ? `✅ Stop on ${settings.general.skillPointCheck} Skill Points or more` : "❌"}
Popup Check: ${settings.general.enablePopupCheck ? "✅" : "❌"}
Prioritize Energy Options: ${settings.trainingEvent.enablePrioritizeEnergyOptions ? "✅" : "❌"}

---------- Debug Options ----------
Debug Mode: ${settings.debug.enableDebugMode ? "✅" : "❌"}
Minimum Template Match Confidence: ${settings.debug.templateMatchConfidence}
Custom Scale: ${settings.debug.templateMatchCustomScale / 100}
Start Template Matching Test: ${settings.debug.debugMode_startTemplateMatchingTest ? "✅" : "❌"}
Start Single Training OCR Test: ${settings.debug.debugMode_startSingleTrainingOCRTest ? "✅" : "❌"}
Start Comprehensive Training OCR Test: ${settings.debug.debugMode_startComprehensiveTrainingOCRTest ? "✅" : "❌"}
Hide String Comparison Results: ${settings.debug.enableHideOCRComparisonResults ? "✅" : "❌"}

****************************************`
    }, [bsc.settings, bsc.appName, bsc.appVersion])

    const introMessage = bsc.settings.misc.enableSettingsDisplay
        ? formatSettings()
        : `****************************************\nWelcome to ${bsc.appName} v${bsc.appVersion}\n****************************************`

    // Process log messages with color coding and virtualization.
    const processedMessages = useMemo((): LogMessage[] => {
        // Add intro message as the first item.
        const introLines = introMessage.split("\n").filter((line) => line.trim() !== "")
        const introMessages = introLines.map((line, index) => ({
            id: `intro-${index}`,
            text: line,
            type: "normal" as const,
        }))

        // Process actual log messages.
        const logMessages = mlc.messageLog.map((message, index) => {
            let type: "normal" | "warning" | "error" = "normal"

            if (message.includes("[ERROR]")) {
                type = "error"
            } else if (message.includes("[WARNING]")) {
                type = "warning"
            }

            return {
                id: `log-${index}-${message.substring(0, 20)}`,
                text: message,
                type,
            }
        })

        return [...introMessages, ...logMessages]
    }, [mlc.messageLog, introMessage])

    // Filter messages based on search query (excluding intro messages).
    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return processedMessages

        const query = searchQuery.toLowerCase()
        return processedMessages.filter((message) => {
            // Only search log messages, not intro messages.
            if (message.id.startsWith("intro-")) {
                return false
            }
            return message.text.toLowerCase().includes(query)
        })
    }, [processedMessages, searchQuery])

    // Get text style based on message type.
    const getTextStyle = useCallback(
        (type: "normal" | "warning" | "error") => {
            const baseStyle = {
                fontSize: fontSize,
                lineHeight: fontSize * 1.5,
            }

            switch (type) {
                case "warning":
                    return { ...styles.logTextWarning, ...baseStyle }
                case "error":
                    return { ...styles.logTextError, ...baseStyle }
                default:
                    return { ...styles.logText, ...baseStyle }
            }
        },
        [fontSize]
    )

    // Font size control functions.
    const increaseFontSize = useCallback(() => {
        setFontSize((prev) => Math.min(prev + 1, 24))
    }, [])

    const decreaseFontSize = useCallback(() => {
        setFontSize((prev) => Math.max(prev - 1, 8))
    }, [])

    // Clear search query.
    const clearSearch = useCallback(() => {
        setSearchQuery("")
    }, [])

    // Copy all messages to clipboard.
    const copyToClipboard = useCallback(async () => {
        try {
            const allText = introMessage + "\n" + mlc.messageLog.join("\n")
            await Clipboard.setStringAsync(allText)
        } catch (error) {
            showError("Failed to copy to clipboard")
        }
    }, [mlc.messageLog, introMessage, showError])

    // Copy individual message on long press.
    const handleLongPress = useCallback(
        async (message: string) => {
            try {
                await Clipboard.setStringAsync(message)
            } catch (error) {
                showError("Failed to copy message")
            }
        },
        [showError]
    )

    // Render individual log item.
    const renderLogItem = useCallback(
        ({ item }: { item: LogMessage }) => (
            <TouchableOpacity style={styles.logItem} onLongPress={() => handleLongPress(item.text)} delayLongPress={500}>
                <Text style={getTextStyle(item.type)}>{item.text}</Text>
            </TouchableOpacity>
        ),
        [handleLongPress, getTextStyle]
    )

    // Key extractor for FlatList.
    const keyExtractor = useCallback((item: LogMessage) => item.id, [])

    return (
        <View style={styles.logInnerContainer}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search messages..."
                        placeholderTextColor="#888"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
                            <X size={16} color="#888" />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.actionButton} onPress={copyToClipboard}>
                    <Copy size={16} color="white" />
                </TouchableOpacity>
                <Popover>
                    <PopoverTrigger asChild>
                        <TouchableOpacity style={styles.actionButton}>
                            <Type size={16} color="white" />
                        </TouchableOpacity>
                    </PopoverTrigger>
                    <PopoverContent className="bg-black w-auto p-2" align="end" side="bottom">
                        <View style={styles.popoverContentContainer}>
                            <Text style={styles.fontSizeDisplay}>Font Size: {fontSize}pt</Text>
                            <View style={styles.popoverButtonContainer}>
                                <TouchableOpacity style={styles.popoverButton} onPress={decreaseFontSize}>
                                    <Minus size={16} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.popoverButton} onPress={increaseFontSize}>
                                    <Plus size={16} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </PopoverContent>
                </Popover>
            </View>

            {/* Log Messages */}
            <View style={styles.logContainer}>
                <FlatList
                    data={filteredMessages}
                    renderItem={renderLogItem}
                    keyExtractor={keyExtractor}
                    showsVerticalScrollIndicator={true}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={50}
                    windowSize={10}
                    initialNumToRender={30}
                    getItemLayout={(data, index) => ({
                        length: fontSize * 1.5 + 2,
                        offset: (fontSize * 1.5 + 2) * index,
                        index,
                    })}
                />
            </View>

            {/* Error Dialog */}
            <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <AlertDialogContent onDismiss={() => setShowErrorDialog(false)}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Error</AlertDialogTitle>
                        <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onPress={() => setShowErrorDialog(false)}>
                            <Text>OK</Text>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </View>
    )
}

export default MessageLog
