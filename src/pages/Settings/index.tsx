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
