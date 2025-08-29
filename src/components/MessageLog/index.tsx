import Constants from "expo-constants"
import * as Application from "expo-application"
import { useContext } from "react"
import { MessageLogContext } from "../../context/MessageLogContext"
import { ScrollView, StyleSheet, Text, View } from "react-native"

const styles = StyleSheet.create({
    logInnerContainer: {
        height: "90%",
        width: "100%",
        backgroundColor: "#2f2f2f",
        borderStyle: "solid",
        borderRadius: 25,
        marginBottom: 10,
        elevation: 10,
    },
    logText: {
        color: "white",
        margin: 20,
        fontSize: 8,
    },
})

const MessageLog = () => {
    const mlc = useContext(MessageLogContext)

    const appName = Application.applicationName || Constants.expoConfig?.name || "Uma Android Automation"
    const appVersion = Constants.expoConfig?.version || "1.0.0"
    
    const introMessage = `****************************************\nWelcome to ${appName} v${appVersion}\n****************************************\nInstructions\n----------------\nNote: The START button is disabled until the following steps are followed through.\n
    1. TODO\n****************************************\n`

    return (
        <View style={styles.logInnerContainer}>
            <ScrollView>
                <Text style={styles.logText}>{introMessage + mlc.messageLog.join("\r")}</Text>
            </ScrollView>
        </View>
    )
}

export default MessageLog
