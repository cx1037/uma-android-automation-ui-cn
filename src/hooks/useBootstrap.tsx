import { useContext, useEffect, useState, useRef } from "react"
import { DeviceEventEmitter, AppState } from "react-native"
import { BotStateContext, BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogContext, MessageLogProviderProps } from "../context/MessageLogContext"
import { useSettingsManager } from "./useSettingsManager"
import { logWithTimestamp } from "../lib/logger"

/**
 * Manages app initialization, settings persistence, and message handling.
 * Coordinates startup sequence and maintains app state synchronization.
 */
export const useBootstrap = () => {
    const [isReady, setIsReady] = useState<boolean>(false)
    const isSavingRef = useRef<boolean>(false)

    const bsc = useContext(BotStateContext) as BotStateProviderProps
    const mlc = useContext(MessageLogContext) as MessageLogProviderProps

    // Hook for managing settings persistence.
    const { saveSettings, saveSettingsImmediate, isLoading, isInitialized } = useSettings()

    useEffect(() => {
        // Listen for messages from the Android automation service.
        DeviceEventEmitter.addListener("MessageLog", (data: any) => {
            addMessageToAsyncMessages(data["message"])
        })
    }, [])

    // Wait for SQLite database initialization to complete before marking app as ready.
    // This ensures the data layer is fully set up before allowing settings operations.
    useEffect(() => {
        if (isInitialized) {
            logWithTimestamp("[Bootstrap] SQLite initialized, app ready...")
            setIsReady(true)
            logWithTimestamp("[Bootstrap] App initialization complete")
        }
    }, [isInitialized])

    // Process async messages and add them to the message log.
    useEffect(() => {
        if (mlc.asyncMessages.length > 0) {
            const newLog = [...mlc.messageLog, ...mlc.asyncMessages]
            mlc.setMessageLog(newLog)
        }
    }, [mlc.asyncMessages])

    // Save settings when app goes to background or is about to close.
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === "background" || nextAppState === "inactive") {
                logWithTimestamp(`[Bootstrap] App state changed to ${nextAppState}, saving settings...`)
                if (!isSavingRef.current) {
                    isSavingRef.current = true
                    saveSettings().finally(() => {
                        isSavingRef.current = false
                    })
                }
            }
        }

        const subscription = AppState.addEventListener("change", handleAppStateChange)
        return () => subscription?.remove()
    }, [saveSettings])
    // Update ready status whenever settings change or app becomes ready.
    useEffect(() => {
        if (isReady) {
            const scenario = bsc.settings.general.scenario
            bsc.setReadyStatus(scenario !== "")
        }
    }, [isReady, bsc.settings.general.scenario])

    // Manual save function for Start button and other triggers.
    const saveSettingsNow = async () => {
        if (!isSavingRef.current) {
            logWithTimestamp("[Bootstrap] Manual save triggered...")
            isSavingRef.current = true
            try {
                await saveSettings()
                logWithTimestamp("[Bootstrap] Manual save completed successfully")
            } finally {
                isSavingRef.current = false
            }
        }
    }

    return {
        isReady: isReady && isInitialized,
        isLoading,
        isInitialized,
        saveSettingsNow,
    }
}
