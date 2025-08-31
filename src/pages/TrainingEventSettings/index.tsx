import { useContext } from "react"
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../context/ThemeContext"
import { BotStateContext } from "../../context/BotStateContext"
import CustomCheckbox from "../../components/CustomCheckbox"
import { ArrowLeft } from "lucide-react-native"

const TrainingEventSettings = () => {
    const { colors } = useTheme()
    const navigation = useNavigation()
    const bsc = useContext(BotStateContext)

    // Get training event settings from global state
    const { settings, setSettings } = bsc
    const { enablePrioritizeEnergyOptions } = settings.trainingEvent

    // Helper function to update training event settings
    const updateTrainingEventSetting = (key: keyof typeof settings.trainingEvent, value: any) => {
        setSettings({
            ...bsc.settings,
            trainingEvent: {
                ...bsc.settings.trainingEvent,
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
        section: {
            marginBottom: 24,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: "600",
            color: colors.foreground,
            marginBottom: 12,
        },
        description: {
            fontSize: 14,
            color: colors.foreground,
            opacity: 0.7,
            marginBottom: 16,
            lineHeight: 20,
        },
    })

    return (
        <View style={styles.root}>
            <ScrollView nestedScrollEnabled={true} contentContainerStyle={{ flexGrow: 1 }}>
                <View className="m-1">
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <ArrowLeft size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Training Event Settings</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Energy Management</Text>
                        <Text style={styles.description}>
                            Configure how the bot handles energy-related choices during training events. These settings affect the bot's decision-making when presented with energy recovery or
                            consumption options.
                        </Text>

                        <CustomCheckbox
                            id="prioritize-energy-options"
                            checked={enablePrioritizeEnergyOptions}
                            onCheckedChange={(checked) => updateTrainingEventSetting("enablePrioritizeEnergyOptions", checked)}
                            label="Prioritize Energy Options"
                            description="When enabled, the bot will prioritize training event choices that provide energy recovery or avoid energy consumption, helping to maintain optimal energy levels for training sessions."
                            className="my-2"
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    )
}

export default TrainingEventSettings
