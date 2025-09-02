import { useContext, useMemo } from "react"
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../context/ThemeContext"
import { BotStateContext } from "../../context/BotStateContext"
import CustomCheckbox from "../../components/CustomCheckbox"
import CustomTitle from "../../components/CustomTitle"
import MultiSelector from "../../components/MultiSelector"
import { ArrowLeft } from "lucide-react-native"

// Import the data files
import charactersData from "../../data/characters.json"
import supportsData from "../../data/supports.json"

const TrainingEventSettings = () => {
    const { colors } = useTheme()
    const navigation = useNavigation()
    const bsc = useContext(BotStateContext)

    // Get training event settings from global state
    const { settings, setSettings } = bsc
    const { enablePrioritizeEnergyOptions } = settings.trainingEvent

    // Extract character and support names from the data
    const characterNames = useMemo(() => Object.keys(charactersData), [])
    const supportNames = useMemo(() => Object.keys(supportsData), [])

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
                        <CustomCheckbox
                            id="prioritize-energy-options"
                            checked={enablePrioritizeEnergyOptions}
                            onCheckedChange={(checked) => updateTrainingEventSetting("enablePrioritizeEnergyOptions", checked)}
                            label="Prioritize Energy Options"
                            description="When enabled, the bot will prioritize training event choices that provide energy recovery or avoid energy consumption, helping to maintain optimal energy levels for training sessions."
                            className="my-2"
                        />
                    </View>

                    <MultiSelector
                        title="Character Selection"
                        description="Choose which characters you have in your current scenario. You can select all characters at once, or pick specific ones individually. When selecting individually, all rarity variants (R/SR/SSR) of the same character are grouped together."
                        options={characterNames}
                        selectedOptions={settings.training.characterList}
                        onSelectionChange={(selectedOptions) => {
                            setSettings({
                                ...bsc.settings,
                                training: {
                                    ...bsc.settings.training,
                                    characterList: selectedOptions,
                                },
                            })
                        }}
                        selectAllLabel="Select All Characters"
                        selectAllDescription="Select all available characters for training events"
                        selectIndividualLabel="Select Characters"
                    />

                    <MultiSelector
                        title="Support Card Selection"
                        description="Choose which support cards you have in your current scenario. Same selection behavior applies as above."
                        options={supportNames}
                        selectedOptions={settings.training.supportList}
                        onSelectionChange={(selectedOptions) => {
                            setSettings({
                                ...bsc.settings,
                                training: {
                                    ...bsc.settings.training,
                                    supportList: selectedOptions,
                                },
                            })
                        }}
                        selectAllLabel="Select All Support Cards"
                        selectAllDescription="Select all available support cards for training events"
                        selectIndividualLabel="Select Support Cards"
                    />
                </View>
            </ScrollView>
        </View>
    )
}

export default TrainingEventSettings
