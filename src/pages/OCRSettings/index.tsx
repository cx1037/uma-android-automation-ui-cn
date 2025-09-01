import React, { useContext } from "react"
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../../context/ThemeContext"
import { BotStateContext } from "../../context/BotStateContext"
import CustomSlider from "../../components/CustomSlider"
import CustomCheckbox from "../../components/CustomCheckbox"
import { ArrowLeft } from "lucide-react-native"

const OCRSettings = () => {
    const { colors } = useTheme()
    const navigation = useNavigation()
    const bsc = useContext(BotStateContext)

    // Get OCR settings from global state
    const { settings, setSettings } = bsc
    const { ocrThreshold, enableAutomaticOCRRetry, ocrConfidence } = settings.ocr

    // Helper function to update OCR settings
    const updateOCRSetting = (key: keyof typeof settings.ocr, value: any) => {
        setSettings({
            ...bsc.settings,
            ocr: {
                ...bsc.settings.ocr,
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
    })

    return (
        <View style={styles.root}>
            <ScrollView nestedScrollEnabled={true} contentContainerStyle={{ flexGrow: 1 }}>
                <View className="m-1">
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <ArrowLeft size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.title}>OCR Settings</Text>
                    </View>

                    <View style={styles.section}>
                        <CustomSlider
                            value={ocrThreshold}
                            onValueChange={(value) => updateOCRSetting("ocrThreshold", value)}
                            min={100}
                            max={255}
                            step={5}
                            label="OCR Threshold"
                            labelUnit=""
                            showValue={true}
                            showLabels={true}
                            description="Adjust the threshold for OCR text detection. Higher values make text detection more strict, lower values make it more lenient."
                        />
                    </View>

                    <View style={styles.section}>
                        <CustomCheckbox
                            id="enable-automatic-ocr-retry"
                            checked={enableAutomaticOCRRetry}
                            onCheckedChange={(checked) => updateOCRSetting("enableAutomaticOCRRetry", checked)}
                            label="Enable Automatic OCR Retry"
                            description="When enabled, the bot will automatically retry OCR detection if the initial attempt fails or has low confidence."
                            className="my-2"
                        />
                    </View>

                    <View style={styles.section}>
                        <CustomSlider
                            value={ocrConfidence}
                            onValueChange={(value) => updateOCRSetting("ocrConfidence", value)}
                            min={50}
                            max={100}
                            step={1}
                            label="OCR Confidence"
                            labelUnit="%"
                            showValue={true}
                            showLabels={true}
                            description="Set the minimum confidence level required for OCR text detection. Higher values ensure more accurate text recognition but may miss some text."
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    )
}

export default OCRSettings
