import { useState } from "react"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import { startActivityAsync } from "expo-intent-launcher"
import { defaultSettings, Settings, BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogProviderProps } from "../context/MessageLogContext"

/**
 * Manages settings persistence to/from local storage.
 * Handles file corruption recovery and settings validation.
 */
export const useSettingsManager = (bsc: BotStateProviderProps, mlc: MessageLogProviderProps) => {
    // Track whether settings are currently being saved.
    const [isSaving, setIsSaving] = useState(false)

    // Save settings to local storage with corruption prevention.
    const saveSettings = async (newSettings?: Settings) => {
        setIsSaving(true)

        try {
            const localSettings: Settings = newSettings ? newSettings : bsc.settings
            const path = FileSystem.documentDirectory + "settings.json"
            const toSave = JSON.stringify(localSettings, null, 4)

            // Delete existing file first to avoid corruption.
            try {
                await FileSystem.deleteAsync(path)
                console.log("settings.json file successfully deleted.")
            } catch {
                console.log("settings.json file does not exist so no need to delete it before saving current settings.")
            }

            await FileSystem.writeAsStringAsync(path, toSave)
            console.log("Settings saved to ", path)

            mlc.setAsyncMessages([])
            mlc.setMessageLog([`\n[SUCCESS] Settings saved to ${path}`])
        } catch (error) {
            console.error(`Error writing settings: ${error}`)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error writing settings: \n${error}`])
        } finally {
            setIsSaving(false)
        }
    }

    // Load settings from local storage with automatic corruption recovery.
    const loadSettings = async () => {
        const path = FileSystem.documentDirectory + "settings.json"
        let newSettings: Settings = defaultSettings

        try {
            const data = await FileSystem.readAsStringAsync(path)
            console.log(`Loaded settings from settings.json file.`)

            const parsed: Settings = JSON.parse(data)
            const fixedSettings: Settings = fixSettings(parsed)
            newSettings = fixedSettings
        } catch (error: any) {
            if (error.name === "SyntaxError") {
                // Handle corruption by attempting to fix.
                const fixedSettings = await attemptCorruptionFix(path)
                if (fixedSettings) {
                    newSettings = fixedSettings
                    console.log("Automatic corruption fix was successful!")
                } else {
                    console.error(`Error reading settings: ${error.name}`)
                    mlc.setMessageLog([
                        ...mlc.messageLog,
                        `\n[ERROR] Error reading settings: \n${error}`,
                        `\nNote that the app sometimes corrupts the settings.json when saving. Automatic fix was not successful.`,
                    ])
                }
            } else if (!error.message.includes("No such file or directory")) {
                console.error(`Error reading settings: ${error.name}`)
                mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error reading settings: \n${error}`])
            }
        }

        console.log("Read: " + JSON.stringify(newSettings, null, 4))
        bsc.setSettings(newSettings)
    }

    // Ensure all required settings fields exist by filling missing ones with defaults.
    const fixSettings = (decoded: Settings): Settings => {
        let newSettings: Settings = decoded
        Object.keys(defaultSettings).forEach((key) => {
            if (decoded[key as keyof Settings] === undefined) {
                newSettings = {
                    ...newSettings,
                    [key as keyof Settings]: defaultSettings[key as keyof Settings],
                }
            }
        })
        return newSettings
    }

    // Attempt to recover corrupted settings by progressively truncating the file.
    const attemptCorruptionFix = async (path: string): Promise<Settings | null> => {
        try {
            const data = await FileSystem.readAsStringAsync(path)
            let fixedData = data

            while (fixedData.length > 0) {
                try {
                    const parsed: Settings = JSON.parse(fixedData)
                    return fixSettings(parsed)
                } catch {
                    fixedData = fixedData.substring(0, fixedData.length - 1)
                }
            }
        } catch {
            // Ignore errors during corruption fix attempt.
        }

        return null
    }

    // Open the app's data directory using Storage Access Framework.
    const openDataDirectory = async () => {
        // Get the app's package name from the document directory path.
        const packageName = "com.steve1316.uma_android_automation"

        try {
            // Try Storage Access Framework first (recommended for Android 11+).
            try {
                await startActivityAsync("android.intent.action.OPEN_DOCUMENT_TREE", {
                    data: `content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fdata%2F${packageName}/files`,
                    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                })

                mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Opened Android data directory for package: ${packageName}`])
                return
            } catch (safError) {
                console.warn("SAF approach failed, trying fallback:", safError)
            }

            // Fallback: Try to open the data folder with the android.intent.action.VIEW Intent.
            try {
                await startActivityAsync("android.intent.action.VIEW", {
                    data: `/storage/emulated/0/Android/data/${packageName}/files`,
                    type: "resource/folder",
                })

                mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Opened app data directory: /storage/emulated/0/Android/data/${packageName}/files`])
                return
            } catch (folderError) {
                console.warn("Folder approach failed, trying file sharing:", folderError)
            }

            // Final fallback: Share the settings file directly.
            const settingsPath = FileSystem.documentDirectory + "settings.json"
            const fileInfo = await FileSystem.getInfoAsync(settingsPath)

            if (fileInfo.exists) {
                const isAvailable = await Sharing.isAvailableAsync()
                if (isAvailable) {
                    await Sharing.shareAsync(settingsPath, {
                        mimeType: "application/json",
                        dialogTitle: "Share Settings File",
                    })
                    mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Shared settings file as fallback: ${settingsPath}`])
                } else {
                    throw new Error("Sharing not available")
                }
            } else {
                throw new Error("Settings file not found")
            }
        } catch (error) {
            console.error(`Error opening app data directory: ${error}`)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Could not open app data directory. Error: ${error}`])
            mlc.setMessageLog([...mlc.messageLog, `\n[INFO] Manual path: /storage/emulated/0/Android/data/${packageName}/files`])
        }
    }

    return {
        saveSettings,
        loadSettings,
        openDataDirectory,
        isSaving,
    }
}
