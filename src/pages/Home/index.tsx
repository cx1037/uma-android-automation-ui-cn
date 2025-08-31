import Constants from "expo-constants"
import MessageLog from "../../components/MessageLog"
import { useContext, useEffect, useState } from "react"
import { BotStateContext } from "../../context/BotStateContext"
import { DeviceEventEmitter, StyleSheet, View, NativeModules, Platform } from "react-native"
import { MessageLogContext } from "../../context/MessageLogContext"

import { Button } from "@/src/components/ui/button"
import { Text } from "@/src/components/ui/text"
import { Icon } from "@/src/components/ui/icon"
import { Loader2 } from "lucide-react-native"
import ExampleThemedComponent from "../../components/ExampleThemedComponent"

const styles = StyleSheet.create({
    root: {
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 10,
    },
})

const Home = () => {
    const { StartModule } = NativeModules

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

    return (
        <View style={styles.root}>
            {/* {isRunning ? (
                <Button variant="destructive" onPress={() => StartModule.stop()} style={{ width: 200, borderRadius: 20 }}>
                    <Text>Stop</Text>
                </Button>
            ) : (
                <Button disabled={!bsc.readyStatus} onPress={() => StartModule.start()} style={{ width: 200, borderRadius: 20 }}>
                    <Text>{bsc.readyStatus ? "Start" : "Not Ready"}</Text>
                </Button>
            )} */}

            <Button>
                <Text>Button</Text>
            </Button>

            <Button variant="secondary">
                <Text>Secondary</Text>
            </Button>

            <Button variant="destructive">
                <Text>Destructive</Text>
            </Button>

            <Button disabled>
                <View className="pointer-events-none animate-spin">
                    <Icon as={Loader2} className="text-primary-foreground" />
                </View>
                <Text>Please wait</Text>
            </Button>

            {/* <MessageLog /> */}

            <ExampleThemedComponent />
        </View>
    )
}

export default Home
