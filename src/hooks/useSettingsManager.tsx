import { useState, useEffect } from "react"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import { startActivityAsync } from "expo-intent-launcher"
import { defaultSettings, Settings, BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogProviderProps } from "../context/MessageLogContext"
import { useSQLiteSettings } from "./useSQLiteSettings"

/**
 * Manages settings persistence using SQLite database.
 */
export const useSettingsManager = (bsc: BotStateProviderProps, mlc: MessageLogProviderProps) => {
    // Track whether settings are currently being saved.
    const [isSaving, setIsSaving] = useState(false)
    const [migrationCompleted, setMigrationCompleted] = useState(false)

    const { isInitialized, isLoading, isSaving: sqliteIsSaving, loadSettings: loadSQLiteSettings, saveSettings: saveSQLiteSettings } = useSQLiteSettings(mlc)

    // Save settings to SQLite database.
    const saveSettings = async (newSettings?: Settings) => {
        setIsSaving(true)

        try {
            const localSettings: Settings = newSettings ? newSettings : bsc.settings
            await saveSQLiteSettings(localSettings)

            mlc.setAsyncMessages([])
        } catch (error) {
            console.error(`Error saving settings: ${error}`)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error saving settings: \n${error}`])
        } finally {
            setIsSaving(false)
        }
    }

    // Load settings from SQLite database.
    const loadSettings = async () => {
        try {
            // Wait for SQLite to be initialized.
            if (!isInitialized) {
                console.log("[SettingsManager] Waiting for SQLite initialization...")
                return
            }

            // Load from SQLite database.
            let newSettings: Settings = defaultSettings
            try {
                newSettings = await loadSQLiteSettings()
                console.log("[SettingsManager] Settings loaded from SQLite database.")
            } catch (sqliteError) {
                console.warn("[SettingsManager] Failed to load from SQLite, using defaults:", sqliteError)
                newSettings = defaultSettings
            }

            bsc.setSettings(newSettings)
            console.log("[SettingsManager] Settings loaded and applied to context.")
        } catch (error) {
            console.error("[SettingsManager] Error loading settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error loading settings: \n${error}`])
            bsc.setSettings(defaultSettings)
        }
    }

    // Import settings from a JSON file.
    const loadFromJSONFile = async (fileUri: string): Promise<Settings> => {
        try {
            const data = await FileSystem.readAsStringAsync(fileUri)
            const parsed: Settings = JSON.parse(data)
            const fixedSettings: Settings = fixSettings(parsed)

            console.log("Settings imported from JSON file successfully.")
            return fixedSettings
        } catch (error: any) {
            console.error(`Error reading settings from JSON file: ${error}`)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error reading settings from JSON file: \n${error}`])
            throw error
        }
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

    // Import settings from a JSON file and save to SQLite.
    const importSettings = async (fileUri: string): Promise<boolean> => {
        try {
            setIsSaving(true)

            // Ensure database is initialized before saving.
            console.log("Ensuring database is initialized before saving...")
            if (!isInitialized) {
                console.log("Database not initialized, triggering initialization...")
                await loadSQLiteSettings()
            }

            // Save to SQLite database.
            const importedSettings = await loadFromJSONFile(fileUri)
            await saveSQLiteSettings(importedSettings)
            bsc.setSettings(importedSettings)

            console.log("Settings imported successfully.")
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Settings imported successfully from JSON file.`])

            return true
        } catch (error) {
            console.error("Error importing settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error importing settings: \n${error}`])
            return false
        } finally {
            setIsSaving(false)
        }
    }

    // Export current settings to a JSON file.
    const exportSettings = async (): Promise<string | null> => {
        try {
            const jsonString = JSON.stringify(bsc.settings, null, 4)

            // Create a temporary file name with timestamp.
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
            const fileName = `UAA-settings-${timestamp}.json`
            const fileUri = FileSystem.documentDirectory + fileName

            // Write the settings to file.
            await FileSystem.writeAsStringAsync(fileUri, jsonString)

            console.log("Settings exported successfully to:", fileUri)
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Settings exported successfully to: ${fileName}`])

            return fileUri
        } catch (error) {
            console.error("Error exporting settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error exporting settings: \n${error}`])
            return null
        }
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

                mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Opened Android data directory for package via SAF: ${packageName}.`])
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

                mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Opened app data directory via VIEW Intent: /storage/emulated/0/Android/data/${packageName}/files.`])
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
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Could not open app data directory. Error: \n${error}`])
            mlc.setMessageLog([...mlc.messageLog, `\n[INFO] Manual path: /storage/emulated/0/Android/data/${packageName}/files.`])
        }
    }

    // Reset settings to default values.
    const resetSettings = async (): Promise<boolean> => {
        try {
            setIsSaving(true)

            // Ensure database is initialized before saving.
            console.log("Ensuring database is initialized before resetting...")
            if (!isInitialized) {
                console.log("Database not initialized, triggering initialization...")
                await loadSQLiteSettings()
            }

            console.log("Resetting settings to default values...")
            // Save default settings to SQLite database.
            await saveSQLiteSettings(defaultSettings)

            // Update the current settings in context.
            bsc.setSettings(defaultSettings)

            console.log("Settings reset to defaults successfully.")
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Settings have been reset to default values.`])

            return true
        } catch (error) {
            console.error("Error resetting settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error resetting settings: \n${error}`])
            return false
        } finally {
            setIsSaving(false)
        }
    }

    // Auto-load settings when SQLite is initialized.
    useEffect(() => {
        if (isInitialized && !migrationCompleted) {
            loadSettings()
            setMigrationCompleted(true)
        }
    }, [isInitialized, migrationCompleted, loadSettings])

    return {
        saveSettings,
        loadSettings,
        importSettings,
        exportSettings,
        resetSettings,
        openDataDirectory,
        isSaving: isSaving || sqliteIsSaving,
        isLoading,
        isInitialized,
    }
}
