import { useContext, useEffect, useState } from "react"
import { DeviceEventEmitter } from "react-native"
import { BotStateContext, BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogContext, MessageLogProviderProps } from "../context/MessageLogContext"
import { useSettingsManager } from "./useSettingsManager"

/**
 * Manages app initialization, settings persistence, and message handling.
 * Coordinates startup sequence and maintains app state synchronization.
 */
export const useBootstrap = () => {
    const [firstTime, setFirstTime] = useState<boolean>(true)
    const [isReady, setIsReady] = useState<boolean>(false)
    
    const bsc = useContext(BotStateContext) as BotStateProviderProps
    const mlc = useContext(MessageLogContext) as MessageLogProviderProps
    
    // Hook for managing settings persistence.
    const { loadSettings, saveSettings } = useSettingsManager(bsc, mlc)

    // Initialize app on mount: load settings, set up message listener.
    useEffect(() => {
        const initializeApp = async () => {
            await loadSettings()
            setFirstTime(false)
            setIsReady(true)
        }

        initializeApp()

        // Listen for messages from the Android automation service.
        const messageListener = (data: any) => {
            const newLog = [...mlc.asyncMessages, `\n${data["message"]}`]
            mlc.setAsyncMessages(newLog)
        }

        DeviceEventEmitter.addListener("MessageLog", messageListener)

        // Cleanup listeners on unmount.
        return () => {
            DeviceEventEmitter.removeAllListeners("MessageLog")
        }
    }, [])

    // Auto-save settings when they change (skip first load).
    useEffect(() => {
        if (!firstTime) {
            saveSettings()
        }
    }, [bsc.settings])

    // Process async messages and add them to the message log.
    useEffect(() => {
        if (mlc.asyncMessages.length > 0) {
            const newLog = [...mlc.messageLog, ...mlc.asyncMessages]
            mlc.setMessageLog(newLog)
        }
    }, [mlc.asyncMessages])

    // Finalize app ready state after initialization.
    useEffect(() => {
        if (isReady) {
            handleReady()
        }
    }, [isReady])

    // Determine whether the program is ready to start.
    const handleReady = () => {
        // TODO: Implement ready state logic.
        let ready = true
        bsc.setReadyStatus(ready)
    }

    return {
        isReady,
        firstTime
    }
}
