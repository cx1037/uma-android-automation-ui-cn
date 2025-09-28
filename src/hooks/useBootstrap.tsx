import { useContext, useEffect, useState, useRef } from "react"
import { DeviceEventEmitter, AppState } from "react-native"
import { BotStateContext, BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogContext, MessageLogProviderProps } from "../context/MessageLogContext"
import { useSettings } from "../context/SettingsContext"
import { logWithTimestamp } from "../lib/logger"
import { useSQLiteSettings } from "./useSQLiteSettings"

/**
 * Manages app initialization, settings persistence, and message handling.
 * Coordinates startup sequence and maintains app state synchronization.
 */
export const useBootstrap = () => {
    const [isReady, setIsReady] = useState<boolean>(false)
    const isSavingRef = useRef<boolean>(false)

    const bsc = useContext(BotStateContext) as BotStateProviderProps
    const mlc = useContext(MessageLogContext) as MessageLogProviderProps
    const { addMessageToAsyncMessages } = mlc

    // Hook for managing settings persistence.
    const { saveSettingsImmediate } = useSettings()
    const { isSQLiteInitialized } = useSQLiteSettings()

    useEffect(() => {
        // Listen for messages from the Android automation service.
        DeviceEventEmitter.addListener("MessageLog", (data: any) => {
            addMessageToAsyncMessages(data["message"])
        })
    }, [])

    // Wait for SQLite database initialization to complete before marking app as ready.
    // This ensures the data layer is fully set up before allowing settings operations.
    useEffect(() => {
        if (isSQLiteInitialized) {
            logWithTimestamp("[Bootstrap] SQLite initialized, app ready...")
            setIsReady(true)
            logWithTimestamp("[Bootstrap] App initialization complete")
        }
    }, [isSQLiteInitialized])

    // Process async messages and add them to the message log.
    // IMPORTANT: This is how the message log gets updated with the messages from the async messages array.
    useEffect(() => {
        if (mlc.asyncMessages.length > 0) {
            const newLog = [...mlc.messageLog, ...mlc.asyncMessages]
            mlc.setMessageLog(newLog)

            // If the last async message was to save the Message Log to the log file, clear the async messages array to avoid rare log duplication.
            const lastMessage = mlc.asyncMessages[mlc.asyncMessages.length - 1]
            if (lastMessage.includes("Now saving Message Log to file")) {
                mlc.setAsyncMessages([])
            }
        }
    }, [mlc.asyncMessages])

    // Save settings when app goes to background or is about to close.
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === "background" || nextAppState === "inactive") {
                logWithTimestamp(`[Bootstrap] App state changed to ${nextAppState}, saving settings...`)
                if (!isSavingRef.current) {
                    isSavingRef.current = true
                    // Do an immediate save to bypass debouncing.
                    saveSettingsImmediate().finally(() => {
                        isSavingRef.current = false
                    })
                }
            }
        }

        const subscription = AppState.addEventListener("change", handleAppStateChange)
        return () => subscription?.remove()
    }, [saveSettingsImmediate])

    // Update ready status whenever settings change or app becomes ready.
    useEffect(() => {
        if (isReady) {
            const scenario = bsc.settings.general.scenario
            bsc.setReadyStatus(scenario !== "")
        }
    }, [isReady, bsc.settings.general.scenario])
}
