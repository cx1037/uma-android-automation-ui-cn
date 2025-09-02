import scenarios from "../../data/scenarios.json"
import { useContext, useEffect, useState } from "react"
import { BotStateContext } from "../../context/BotStateContext"
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
import { Separator } from "../../components/ui/separator"

const Settings = () => {
    const [firstTime, setFirstTime] = useState<boolean>(true)
    const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false)

    const bsc = useContext(BotStateContext)
    const { colors } = useTheme()
    const navigation = useNavigation()

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

    // Load some specific states from context to local.
    useEffect(() => {
        setFirstTime(false)
    }, [])

    useEffect(() => {
        // Manually set this flag to false as the snackbar autohiding does not set this to false automatically.
        setSnackbarOpen(true)
        setTimeout(() => setSnackbarOpen(false), 1500)
    }, [bsc.readyStatus])

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
                    onValueChange={(value) => {
                        bsc.setReadyStatus(true)
                        bsc.setSettings({ ...bsc.settings, general: { ...bsc.settings.general, scenario: value || "" } })
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
                            value={bsc.settings.general.skillPointCheck}
                            onValueChange={(value) => {
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
                    value={bsc.settings.debug.templateMatchConfidence}
                    onValueChange={(value) => {
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
                    value={bsc.settings.debug.templateMatchCustomScale}
                    onValueChange={(value) => {
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
                            // Disable other tests when enabling this one
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
                            // Disable other tests when enabling this one
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
                            // Disable other tests when enabling this one
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
        </View>
    )
}

export default Settings
