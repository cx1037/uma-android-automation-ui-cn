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
    const [firstTime, setFirstTime] = useState<boolean>(true)
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

    // Auto-save settings when they change (skip first load).
    useEffect(() => {
        if (!firstTime && isReady && !isSavingRef.current) {
            console.log("[Bootstrap] Settings changed, auto-saving...")
            isSavingRef.current = true

            // Add a small delay to prevent rapid successive saves.
            setTimeout(() => {
                saveSettings().finally(() => {
                    isSavingRef.current = false
                })
            }, 100)
        } else if (isReady && firstTime) {
            console.log("[Bootstrap] First load complete, enabling auto-save")
            setFirstTime(false)
        }
    }, [bsc.settings, firstTime, isReady])

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
    useEffect(() => {
        if (isReady) {
            handleReady()
        }
    }, [isReady])

    // Determine whether the program is ready to start.
    const handleReady = () => {
        const scenario = bsc.settings.general.scenario
        bsc.setReadyStatus(scenario !== "")
    }

    return {
        isReady: isReady && isInitialized,
        firstTime,
        isLoading,
        isInitialized,
        saveSettingsNow,
    }
}
