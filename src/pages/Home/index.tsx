import Constants from "expo-constants"
import MessageLog from "../../components/MessageLog"
import { useContext, useEffect, useState } from "react"
import { BotStateContext } from "../../context/BotStateContext"
import { DeviceEventEmitter, StyleSheet, View, NativeModules, Alert, ActivityIndicator } from "react-native"
import { MessageLogContext } from "../../context/MessageLogContext"
import { useTheme } from "../../context/ThemeContext"
import { Button } from "@/src/components/ui/button"
import { Text } from "@/src/components/ui/text"

const styles = StyleSheet.create({
    root: {
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    contentContainer: {
        flex: 1,
        width: "100%",
        flexDirection: "column",
    },
    buttonContainer: {
        alignItems: "center",
        marginBottom: 10,
    },
    button: {
        width: 100,
    },
})

const Home = () => {
    const { StartModule } = NativeModules

    const { isDark } = useTheme()
    const [isRunning, setIsRunning] = useState<boolean>(false)

    const bsc = useContext(BotStateContext)
    const mlc = useContext(MessageLogContext)

    useEffect(() => {
        DeviceEventEmitter.addListener("MediaProjectionService", (data) => {
            setIsRunning(data["message"] === "Running")
        })

        DeviceEventEmitter.addListener("BotService", (data) => {
            if (data["message"] === "Running") {
                mlc.setAsyncMessages([])
                mlc.setMessageLog([])
            }
        })

        getVersion()
    }, [])

    // Grab the program version.
    const getVersion = () => {
        const version = Constants.expoConfig?.version || "1.0.0"
        console.log("Android app version is ", version)
        bsc.setAppVersion(version)
    }

    const handleButtonPress = () => {
        if (isRunning) {
            StartModule.stop()
        } else if (bsc.readyStatus) {
            StartModule.start()
        } else {
            Alert.alert("Not Ready", "A scenario must be selected before starting the bot. Please go to Settings to select a scenario.", [{ text: "OK" }], { cancelable: true })
        }
    }

    return (
        <View style={styles.root}>
            <View style={styles.buttonContainer}>
                <Button variant={isRunning ? "destructive" : isDark ? "default" : "secondary"} onPress={handleButtonPress} style={styles.button}>
                    {isRunning && <ActivityIndicator size="small" color="#ffffff" />}
                    <Text>{isRunning ? "Stop" : bsc.readyStatus ? "Start" : "Not Ready"}</Text>
                </Button>
            </View>

            <View style={styles.contentContainer}>
                <MessageLog />
            </View>
        </View>
    )
}

export default Home
