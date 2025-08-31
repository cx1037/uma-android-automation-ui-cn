import Checkbox from "../../components/CustomCheckbox"
import CustomButton from "../../components/CustomButton"
import CustomDropDownPicker from "../../components/CustomDropdownPicker"
// import data from "../../data/data.json"
import campaigns from "../../data/campaigns.json"
import React, { useContext, useEffect, useState } from "react"
import RNFS from "react-native-fs"
import { BotStateContext } from "../../context/BotStateContext"
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Divider } from "@rneui/themed"
import TitleDivider from "../../components/TitleDivider"
import { Picker } from "@react-native-picker/picker"
import { Snackbar } from "react-native-paper"
import { useNavigation } from "@react-navigation/native"
import ThemeToggle from "../../components/ThemeToggle"
import { useTheme } from "../../context/ThemeContext"

const Settings = () => {
    const [firstTime, setFirstTime] = useState<boolean>(true)
    const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false)

    const [campaign, setCampaign] = useState<string>("")

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
        farmingModePicker: {
            marginTop: 10,
            backgroundColor: campaign !== "" ? "azure" : "pink",
        },
        disabledPicker: {
            backgroundColor: "#808080",
            opacity: 0.7,
        },
        dropdown: {
            marginTop: 20,
        },
        modal: {
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(80,80,80,0.3)",
        },
        outsideModal: {
            position: "absolute",
            height: "100%",
            width: "100%",
        },
        componentContainer: {
            width: Dimensions.get("window").width * 0.7,
            height: Dimensions.get("window").height * 0.9,
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
                <CustomDropDownPicker containerStyle={styles.farmingModePicker} placeholder="Select Campaign" data={campaigns} value={bsc.settings.general.campaign} setValue={setCampaign} />
            </View>
        )
    }

    const renderTrainingSettings = () => {
        const navigation = useNavigation()
        return (
            <View>
                <TouchableOpacity onPress={() => navigation.navigate("TrainingSettings" as never)}>
                    <Text style={{ fontSize: 20, fontWeight: "bold" }}>Training</Text>
                    <Text style={{ color: "gray", marginTop: 4 }}>Customize the settings for Training</Text>
                </TouchableOpacity>
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

                    <TitleDivider title="Training Settings" />

                    {renderTrainingSettings()}
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
