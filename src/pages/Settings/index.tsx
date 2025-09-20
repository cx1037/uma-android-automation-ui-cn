import scenarios from "../../data/scenarios.json"
import { useContext, useEffect, useState } from "react"
import { BotStateContext } from "../../context/BotStateContext"
import { MessageLogContext } from "../../context/MessageLogContext"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Snackbar } from "react-native-paper"
import { useNavigation } from "@react-navigation/native"
import ThemeToggle from "../../components/ThemeToggle"
import { useTheme } from "../../context/ThemeContext"
import CustomSelect from "../../components/CustomSelect"
import NavigationLink from "../../components/NavigationLink"
import CustomCheckbox from "../../components/CustomCheckbox"
import CustomSlider from "../../components/CustomSlider"
import CustomTitle from "../../components/CustomTitle"
import { Button } from "../../components/ui/button"
import { Separator } from "../../components/ui/separator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog"
import { useSettingsManager } from "../../hooks/useSettingsManager"
import { useSettingsFileManager } from "../../hooks/useSettingsFileManager"

const Settings = () => {
    const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false)
    
    // Local state for sliders to improve performance
    const [localSkillPointCheck, setLocalSkillPointCheck] = useState<number>(0)
    const [localTemplateMatchConfidence, setLocalTemplateMatchConfidence] = useState<number>(0)
    const [localTemplateMatchCustomScale, setLocalTemplateMatchCustomScale] = useState<number>(0)

    const bsc = useContext(BotStateContext)
    const mlc = useContext(MessageLogContext)
    const { colors, isDark } = useTheme()
    const navigation = useNavigation()

    const { openDataDirectory, resetSettings } = useSettingsManager(bsc, mlc)
    const { handleImportSettings, handleExportSettings, showImportDialog, setShowImportDialog, showResetDialog, setShowResetDialog } = useSettingsFileManager(bsc, mlc)
    // Initialize local slider state with current settings
    useEffect(() => {
        setLocalSkillPointCheck(bsc.settings.general.skillPointCheck)
        setLocalTemplateMatchConfidence(bsc.settings.debug.templateMatchConfidence)
        setLocalTemplateMatchCustomScale(bsc.settings.debug.templateMatchCustomScale)
    }, [bsc.settings.general.skillPointCheck, bsc.settings.debug.templateMatchConfidence, bsc.settings.debug.templateMatchCustomScale])

    const styles = StyleSheet.create({
        root: {
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            margin: 10,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
        },
        title: {
            fontSize: 24,
            fontWeight: "bold",
            color: colors.foreground,
        },
        errorContainer: {
            backgroundColor: "#FFF3CD",
            borderLeftWidth: 4,
            borderLeftColor: "#FFA500",
            padding: 12,
            marginTop: 12,
            borderRadius: 8,
        },
        errorText: {
            fontSize: 14,
            color: "#856404",
            lineHeight: 20,
        },
    })

    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    // Callbacks

    useEffect(() => {
        // Manually set this flag to false as the snackbar autohiding does not set this to false automatically.
        setSnackbarOpen(true)
        setTimeout(() => setSnackbarOpen(false), 2500)
    }, [bsc.readyStatus])

    const handleResetSettings = async () => {
        const success = await resetSettings()
        if (success) {
            setSnackbarOpen(true)
            setTimeout(() => setSnackbarOpen(false), 2500)
        }
    }

    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    // Rendering

    const renderCampaignPicker = () => {
        return (
            <View>
                <CustomSelect
                    placeholder="Select a Scenario"
                    width="100%"
                    groupLabel="Scenarios"
                    options={scenarios}
                    value={bsc.settings.general.scenario}
                    onValueChange={(value) => {
                        const newScenario = value || ""
                        bsc.setSettings({ ...bsc.settings, general: { ...bsc.settings.general, scenario: newScenario } })
                        bsc.setReadyStatus(newScenario !== "")
                    }}
                />
                {!bsc.settings.general.scenario && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>⚠️ A scenario must be selected before starting the bot.</Text>
                    </View>
                )}
            </View>
        )
    }

    const renderTrainingLink = () => {
        return (
            <NavigationLink
                title="Go to Training Settings"
                description="Configure which stats to train, set priorities, and customize training behavior"
                onPress={() => navigation.navigate("TrainingSettings" as never)}
            />
        )
    }

    const renderTrainingEventLink = () => {
        return (
            <NavigationLink
                title="Go to Training Event Settings"
                description="Configure training event preferences, energy management, and event selection behavior"
                onPress={() => navigation.navigate("TrainingEventSettings" as never)}
            />
        )
    }

    const renderOCRLink = () => {
        return (
            <NavigationLink
                title="Go to OCR Settings"
                description="Configure OCR text detection parameters, threshold settings, and retry behavior"
                onPress={() => navigation.navigate("OCRSettings" as never)}
            />
        )
    }

    const renderRacingLink = () => {
        return (
            <NavigationLink
                title="Go to Racing Settings"
                description="Configure racing behavior, fan farming, retry settings, and mandatory race handling"
                onPress={() => navigation.navigate("RacingSettings" as never)}
            />
        )
    }

    const renderMiscSettings = () => {
        return (
            <View style={{ marginTop: 16 }}>
                <Separator style={{ marginVertical: 16 }} />

                <CustomTitle title="Misc Settings" description="General settings for the bot that don't fit into the other categories." />

                <CustomCheckbox
                    checked={bsc.settings.general.enableSkillPointCheck}
                    onCheckedChange={(checked) => {
                        bsc.setSettings({
                            ...bsc.settings,
                            general: { ...bsc.settings.general, enableSkillPointCheck: checked },
                        })
                    }}
                    label="Enable Skill Point Check"
                    description="Enables check for a certain skill point threshold. If reached, the bot will stop so you can spend the skill points."
                />

                {bsc.settings.general.enableSkillPointCheck && (
                    <View style={{ marginTop: 8, marginLeft: 20 }}>
                        <CustomSlider
                            value={localSkillPointCheck}
                            onValueChange={(value) => {
                                setLocalSkillPointCheck(value)
                            }}
                            onSlidingComplete={(value) => {
                                bsc.setSettings({
                                    ...bsc.settings,
                                    general: { ...bsc.settings.general, skillPointCheck: value },
                                })
                            }}
                            min={100}
                            max={2000}
                            step={10}
                            label="Skill Point Threshold"
                            labelUnit=""
                            showValue={true}
                            showLabels={true}
                        />
                    </View>
                )}

                <CustomCheckbox
                    checked={bsc.settings.general.enablePopupCheck}
                    onCheckedChange={(checked) => {
                        bsc.setSettings({
                            ...bsc.settings,
                            general: { ...bsc.settings.general, enablePopupCheck: checked },
                        })
                    }}
                    label="Enable Popup Check"
                    description="Enables check for warning popups like lack of fans or lack of trophies gained. Stops the bot if detected for the user to deal with them manually."
                    className="mt-4"
                />

                <CustomCheckbox
                    checked={bsc.settings.misc.enableSettingsDisplay}
                    onCheckedChange={(checked) => {
                        bsc.setSettings({
                            ...bsc.settings,
                            misc: { ...bsc.settings.misc, enableSettingsDisplay: checked },
                        })
                    }}
                    label="Enable Settings Display in Message Log"
                    description="Shows current bot configuration settings at the top of the message log."
                    className="mt-4"
                />

                <Separator style={{ marginVertical: 16 }} />

                <CustomTitle title="Settings Management" description="Import and export settings from JSON file or access the app's data directory." />

                <View style={{ flexDirection: "row", gap: 12 }}>
                    <Button onPress={handleImportSettings} variant="default" style={{ flex: 1, backgroundColor: isDark ? colors.muted : colors.input }}>
                        <Text style={{ color: colors.foreground }}>📥 Import Settings</Text>
                    </Button>

                    <Button onPress={handleExportSettings} variant="default" style={{ flex: 1, backgroundColor: isDark ? colors.muted : colors.input }}>
                        <Text style={{ color: colors.foreground }}>📤 Export Settings</Text>
                    </Button>
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                    <Button onPress={openDataDirectory} variant="default" style={{ flex: 1, backgroundColor: isDark ? colors.muted : colors.input }}>
                        <Text style={{ color: colors.foreground }}>📁 Open Data Directory</Text>
                    </Button>

                    <Button onPress={() => setShowResetDialog(true)} variant="default" style={{ flex: 1, backgroundColor: "#dc2626" }}>
                        <Text style={{ color: "white" }}>🔄 Reset Settings</Text>
                    </Button>
                </View>

                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                        ⚠️ <Text style={{ fontWeight: "bold" }}>File Explorer Note:</Text> To manually access files, you need a file explorer app that can access the /Android/data folder (like CX File
                        Explorer). Standard file managers will not work.
                    </Text>
                </View>
            </View>
        )
    }

    const renderDebugSettings = () => {
        return (
            <View style={{ marginTop: 16 }}>
                <Separator style={{ marginVertical: 16 }} />
                <CustomTitle title="Debug Settings" description="Debug mode, template matching settings, and diagnostic tests for bot troubleshooting." />

                <CustomCheckbox
                    checked={bsc.settings.debug.enableDebugMode}
                    onCheckedChange={(checked) => {
                        bsc.setSettings({
                            ...bsc.settings,
                            debug: { ...bsc.settings.debug, enableDebugMode: checked },
                        })
                    }}
                    label="Enable Debug Mode"
                    description="Allows debugging messages in the log and test images to be created in the /temp/ folder."
                />

                {bsc.settings.debug.enableDebugMode && (
                    <View style={[styles.errorContainer, { marginTop: 8 }]}>
                        <Text style={styles.errorText}>⚠️ Significantly extends the average runtime of the bot due to increased IO operations.</Text>
                    </View>
                )}

                <CustomSlider
                    value={localTemplateMatchConfidence}
                    onValueChange={(value) => {
                        setLocalTemplateMatchConfidence(value)
                    }}
                    onSlidingComplete={(value) => {
                        bsc.setSettings({
                            ...bsc.settings,
                            debug: { ...bsc.settings.debug, templateMatchConfidence: value },
                        })
                    }}
                    min={50}
                    max={100}
                    step={1}
                    label="Adjust Confidence for Template Matching"
                    labelUnit=""
                    showValue={true}
                    showLabels={true}
                    description="Sets the minimum confidence level for template matching with 1080p as the baseline. Consider lowering this to something like 70% at lower resolutions."
                />

                <CustomSlider
                    value={localTemplateMatchCustomScale}
                    onValueChange={(value) => {
                        setLocalTemplateMatchCustomScale(value)
                    }}
                    onSlidingComplete={(value) => {
                        bsc.setSettings({
                            ...bsc.settings,
                            debug: { ...bsc.settings.debug, templateMatchCustomScale: value },
                        })
                    }}
                    min={50}
                    max={300}
                    step={1}
                    label="Set the Custom Image Scale for Template Matching"
                    labelUnit=""
                    showValue={true}
                    showLabels={true}
                    description="Manually set the scale to do template matching. The Basic Template Matching Test can help find your recommended scale."
                />

                <Separator style={{ marginVertical: 16 }} />

                <CustomTitle title="Debug Tests" description="Run diagnostic tests to verify template matching and OCR functionality. Only one test can be enabled at a time." />

                {/* Warning message for debug tests */}
                <View style={[styles.errorContainer, { marginBottom: 16 }]}>
                    <Text style={styles.errorText}>
                        {"⚠️ Only one debug test can be enabled at a time. Enabling a test will automatically disable the others.\n\nIn addition, it is recommended to enable Debug Mode when testing."}
                    </Text>
                </View>

                <CustomCheckbox
                    checked={bsc.settings.debug.debugMode_startTemplateMatchingTest}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            // Disable other tests when enabling this one.
                            bsc.setSettings({
                                ...bsc.settings,
                                debug: {
                                    ...bsc.settings.debug,
                                    debugMode_startTemplateMatchingTest: true,
                                    debugMode_startSingleTrainingFailureOCRTest: false,
                                    debugMode_startComprehensiveTrainingFailureOCRTest: false,
                                },
                            })
                        } else {
                            bsc.setSettings({
                                ...bsc.settings,
                                debug: { ...bsc.settings.debug, debugMode_startTemplateMatchingTest: false },
                            })
                        }
                    }}
                    label="Start Basic Template Matching Test"
                    description="Disables normal bot operations and starts the template match test. Only on the Home screen and will check if it can find certain essential buttons on the screen. It will also output what scale it had the most success with."
                    style={{ marginTop: 10 }}
                />

                <CustomCheckbox
                    checked={bsc.settings.debug.debugMode_startSingleTrainingFailureOCRTest}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            // Disable other tests when enabling this one.
                            bsc.setSettings({
                                ...bsc.settings,
                                debug: {
                                    ...bsc.settings.debug,
                                    debugMode_startTemplateMatchingTest: false,
                                    debugMode_startSingleTrainingFailureOCRTest: true,
                                    debugMode_startComprehensiveTrainingFailureOCRTest: false,
                                },
                            })
                        } else {
                            bsc.setSettings({
                                ...bsc.settings,
                                debug: { ...bsc.settings.debug, debugMode_startSingleTrainingFailureOCRTest: false },
                            })
                        }
                    }}
                    label="Start Training Failure OCR Test"
                    description="Disables normal bot operations and starts the training failure OCR test. Only on the Training screen and only tests on the training currently on display for their failure chances."
                    style={{ marginTop: 10 }}
                />

                <CustomCheckbox
                    checked={bsc.settings.debug.debugMode_startComprehensiveTrainingFailureOCRTest}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            // Disable other tests when enabling this one.
                            bsc.setSettings({
                                ...bsc.settings,
                                debug: {
                                    ...bsc.settings.debug,
                                    debugMode_startTemplateMatchingTest: false,
                                    debugMode_startSingleTrainingFailureOCRTest: false,
                                    debugMode_startComprehensiveTrainingFailureOCRTest: true,
                                },
                            })
                        } else {
                            bsc.setSettings({
                                ...bsc.settings,
                                debug: { ...bsc.settings.debug, debugMode_startComprehensiveTrainingFailureOCRTest: false },
                            })
                        }
                    }}
                    label="Start Comprehensive Training OCR Test"
                    description="Disables normal bot operations and starts the comprehensive training OCR test. Only on the Training screen and tests all 5 trainings for their stat gain weights and failure chances."
                    style={{ marginTop: 10 }}
                />
            </View>
        )
    }

    //////////////////////////////////////////////////
    //////////////////////////////////////////////////

    return (
        <View style={styles.root}>
            <ScrollView nestedScrollEnabled={true} contentContainerStyle={{ flexGrow: 1 }}>
                <View className="m-1">
                    <View style={styles.header}>
                        <Text style={styles.title}>Settings</Text>
                        <ThemeToggle />
                    </View>

                    {renderCampaignPicker()}
                    {renderTrainingLink()}
                    {renderTrainingEventLink()}
                    {renderOCRLink()}
                    {renderRacingLink()}
                    {renderMiscSettings()}
                    {renderDebugSettings()}
                </View>
            </ScrollView>

            <Snackbar
                visible={snackbarOpen}
                onDismiss={() => setSnackbarOpen(false)}
                action={{
                    label: "Close",
                    onPress: () => {
                        setSnackbarOpen(false)
                    },
                }}
                style={{ backgroundColor: bsc.readyStatus ? "green" : "red", borderRadius: 10 }}
            >
                {bsc.readyStatus ? "Bot is ready!" : "Bot is not ready!"}
            </Snackbar>

            {/* Restart Dialog */}
            <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            <Text>Settings Imported</Text>
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <Text>Settings have been imported successfully.</Text>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction>
                            <Text>OK</Text>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reset Settings Dialog */}
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            <Text>Reset Settings to Default</Text>
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <Text>Are you sure you want to reset all settings to their default values? This action cannot be undone and will overwrite your current configuration.</Text>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onPress={() => setShowResetDialog(false)}>
                            <Text style={{ color: "white" }}>Cancel</Text>
                        </AlertDialogCancel>
                        <AlertDialogAction onPress={handleResetSettings} style={{ backgroundColor: "#dc2626" }}>
                            <Text style={{ color: "white" }}>Reset</Text>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </View>
    )
}

export default Settings
