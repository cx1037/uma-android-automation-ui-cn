import { useContext } from "react"
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../context/ThemeContext"
import { BotStateContext } from "../../context/BotStateContext"
import CustomCheckbox from "../../components/CustomCheckbox"
import { Input } from "../../components/ui/input"
import NavigationLink from "../../components/NavigationLink"
import { ArrowLeft } from "lucide-react-native"

const RacingSettings = () => {
    const { colors, theme } = useTheme()
    const navigation = useNavigation()
    const bsc = useContext(BotStateContext)

    const { settings, setSettings } = bsc
    const { enableFarmingFans, daysToRunExtraRaces, disableRaceRetries, enableStopOnMandatoryRaces, enableForceRacing } = settings.racing

    const updateRacingSetting = (key: keyof typeof settings.racing, value: any) => {
        setSettings({
            ...bsc.settings,
            racing: {
                ...bsc.settings.racing,
                [key]: value,
            },
        })
    }

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
        backButton: {
            padding: 8,
        },
        backText: {
            fontSize: 18,
            color: colors.primary,
            fontWeight: "600",
        },
        section: {
            marginBottom: 24,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: "600",
            color: colors.foreground,
            marginBottom: 12,
        },
        inputContainer: {
            marginBottom: 16,
        },
        inputLabel: {
            fontSize: 16,
            color: colors.foreground,
            marginBottom: 8,
        },
        input: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            color: colors.foreground,
            backgroundColor: colors.background,
        },
        inputDescription: {
            fontSize: 14,
            color: colors.foreground,
            opacity: 0.7,
            marginTop: 4,
        },
        warningContainer: {
            backgroundColor: theme === "dark" ? "#3B2A1A" : "#FFF3CD",
            borderLeftWidth: 4,
            borderLeftColor: "#FFA500",
            padding: 12,
            marginTop: 12,
            borderRadius: 8,
        },
        warningText: {
            fontSize: 14,
            color: theme === "dark" ? "#FFE4B5" : "#856404",
            lineHeight: 20,
        },
    })

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <ArrowLeft size={24} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Racing Settings</Text>
            </View>
            <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                <View className="m-1">
                    <View style={styles.section}>
                        <CustomCheckbox
                            id="enable-farming-fans"
                            checked={enableFarmingFans}
                            onCheckedChange={(checked) => updateRacingSetting("enableFarmingFans", checked)}
                            label="Enable Farming Fans"
                            description="When enabled, the bot will start running extra races to gain fans."
                            className="my-2"
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.inputLabel}>Days to Run Extra Races</Text>
                        <Input
                            style={styles.input}
                            value={daysToRunExtraRaces.toString()}
                            onChangeText={(text) => {
                                const value = parseInt(text) || 0
                                if (value >= 0) {
                                    updateRacingSetting("daysToRunExtraRaces", value)
                                }
                            }}
                            keyboardType="numeric"
                            placeholder="5"
                        />
                        <Text style={styles.inputDescription}>
                            Controls when extra races can be run using modulo arithmetic. For example, if set to 5, extra races will only be available on days 5, 10, 15, etc. (when current day % 5 =
                            0).
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <CustomCheckbox
                            id="disable-race-retries"
                            checked={disableRaceRetries}
                            onCheckedChange={(checked) => updateRacingSetting("disableRaceRetries", checked)}
                            label="Disable Race Retries"
                            description="When enabled, the bot will not retry mandatory races if they fail and will stop."
                            className="my-2"
                        />
                    </View>

                    <View style={styles.section}>
                        <CustomCheckbox
                            id="enable-stop-on-mandatory-races"
                            checked={enableStopOnMandatoryRaces}
                            onCheckedChange={(checked) => updateRacingSetting("enableStopOnMandatoryRaces", checked)}
                            label="Stop on Mandatory Races"
                            description="When enabled, the bot will automatically stop when it encounters a mandatory race, allowing you to manually handle them."
                            className="my-2"
                        />
                    </View>

                    <View style={styles.section}>
                        <CustomCheckbox
                            id="enable-force-racing"
                            checked={enableForceRacing}
                            onCheckedChange={(checked) => updateRacingSetting("enableForceRacing", checked)}
                            label="Force Racing"
                            description="When enabled, the bot will skip all training, rest, and mood recovery activities and focus exclusively on racing every day."
                            className="my-2"
                        />
                        {enableForceRacing && (
                            <View style={styles.warningContainer}>
                                <Text style={styles.warningText}>⚠️ Warning: Enabling this will override all other racing settings and they will be ignored.</Text>
                            </View>
                        )}
                    </View>

                    <NavigationLink
                        title="Go to Racing Plan Settings"
                        description="Configure prioritized races to target including enabling additional filters for race selection."
                        onPress={() => navigation.navigate("RacingPlanSettings" as never)}
                        style={{ ...styles.section, marginTop: 0 }}
                    />
                </View>
            </ScrollView>
        </View>
    )
}

export default RacingSettings
