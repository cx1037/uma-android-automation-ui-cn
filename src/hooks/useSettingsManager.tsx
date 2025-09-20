import { useState, useEffect, useContext } from "react"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import { startActivityAsync } from "expo-intent-launcher"
import { defaultSettings, Settings, BotStateContext } from "../context/BotStateContext"
import { useSQLiteSettings } from "./useSQLiteSettings"
import { startTiming } from "../lib/performanceLogger"
import { logWithTimestamp, logErrorWithTimestamp } from "../lib/logger"
import { MessageLogContext } from "../context/MessageLogContext"

/**
 * Manages settings persistence using SQLite database.
 */
export const useSettingsManager = () => {
    // Track whether settings are currently being saved.
    const [isSaving, setIsSaving] = useState(false)
    const [migrationCompleted, setMigrationCompleted] = useState(false)
    
    const bsc = useContext(BotStateContext)
    const mlc = useContext(MessageLogContext)
    // Auto-load settings when SQLite is initialized.
    useEffect(() => {
        if (isInitialized && !migrationCompleted) {
            logWithTimestamp("[SettingsManager] Auto-loading settings on initialization...")
            loadSettings()
            setMigrationCompleted(true)
        }
    }, [isInitialized, migrationCompleted])

    // Save settings to SQLite database.
    const saveSettings = async (newSettings?: Settings) => {
        const endTiming = startTiming("settings_manager_save_settings", "settings")
        
        setIsSaving(true)

        try {
            const localSettings: Settings = newSettings ? newSettings : bsc.settings
            await saveSQLiteSettings(localSettings)

            mlc.setAsyncMessages([])
    // Save settings immediately without debouncing (for background/exit saves).
    const saveSettingsImmediate = async (newSettings?: Settings) => {
        const endTiming = startTiming("settings_manager_save_settings_immediate", "settings")
        
        setIsSaving(true)

        try {
            const localSettings: Settings = newSettings ? newSettings : bsc.settings
            await saveSQLiteSettingsImmediate(localSettings)
            endTiming({ status: "success", hasNewSettings: !!newSettings, immediate: true })
        } catch (error) {
            logErrorWithTimestamp(`Error saving settings immediately: ${error}`)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error saving settings: \n${error}`])
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
        } finally {
            setIsSaving(false)
        }
    }

    // Load settings from SQLite database.
    const loadSettings = async () => {
        const endTiming = startTiming("settings_manager_load_settings", "settings")
        
        try {
            // Wait for SQLite to be initialized.
            if (!isInitialized) {
                logWithTimestamp("[SettingsManager] Waiting for SQLite initialization...")
                endTiming({ status: "skipped", reason: "sqlite_not_initialized" })
                return
            }

            // Load from SQLite database.
            let newSettings: Settings = JSON.parse(JSON.stringify(defaultSettings))
            try {
                newSettings = await loadSQLiteSettings()
                logWithTimestamp("[SettingsManager] Settings loaded from SQLite database.")
            } catch (sqliteError) {
                logWithTimestamp("[SettingsManager] Failed to load from SQLite, using defaults:")
                console.warn(sqliteError)
            }

            bsc.setSettings(newSettings)
            logWithTimestamp("[SettingsManager] Settings loaded and applied to context.")
            endTiming({ status: "success", usedDefaults: newSettings === defaultSettings })
        } catch (error) {
            logErrorWithTimestamp("[SettingsManager] Error loading settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error loading settings: \n${error}`])
            bsc.setSettings(JSON.parse(JSON.stringify(defaultSettings)))
            bsc.setReadyStatus(false)
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
        }
    }

    // Import settings from a JSON file.
    const loadFromJSONFile = async (fileUri: string): Promise<Settings> => {
        try {
            const data = await FileSystem.readAsStringAsync(fileUri)
            const parsed: Settings = JSON.parse(data)
            const fixedSettings: Settings = fixSettings(parsed)

            logWithTimestamp("Settings imported from JSON file successfully.")
            return fixedSettings
        } catch (error: any) {
            logErrorWithTimestamp(`Error reading settings from JSON file: ${error}`)
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
        const endTiming = startTiming("settings_manager_import_settings", "settings")
        
        try {
            setIsSaving(true)

            // Ensure database is initialized before saving.
            logWithTimestamp("Ensuring database is initialized before saving...")
            if (!isInitialized) {
                logWithTimestamp("Database not initialized, triggering initialization...")
                await loadSQLiteSettings()
            }

            // Save to SQLite database.
            const importedSettings = await loadFromJSONFile(fileUri)
            await saveSQLiteSettings(importedSettings)
            bsc.setSettings(importedSettings)

            logWithTimestamp("Settings imported successfully.")
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Settings imported successfully from JSON file.`])

            endTiming({ status: "success", fileUri })
            return true
        } catch (error) {
            logErrorWithTimestamp("Error importing settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error importing settings: \n${error}`])
            endTiming({ status: "error", fileUri, error: error instanceof Error ? error.message : String(error) })
            return false
        } finally {
            setIsSaving(false)
        }
    }

    // Export current settings to a JSON file.
    const exportSettings = async (): Promise<string | null> => {
        const endTiming = startTiming("settings_manager_export_settings", "settings")
        
        try {
            const jsonString = JSON.stringify(bsc.settings, null, 4)

            // Create a temporary file name with timestamp.
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
            const fileName = `UAA-settings-${timestamp}.json`
            const fileUri = FileSystem.documentDirectory + fileName

            // Write the settings to file.
            await FileSystem.writeAsStringAsync(fileUri, jsonString)

            logWithTimestamp(`Settings exported successfully to: ${fileUri}`)
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Settings exported successfully to: ${fileName}`])

            endTiming({ status: "success", fileName, fileSize: jsonString.length })
            return fileUri
        } catch (error) {
            logErrorWithTimestamp("Error exporting settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error exporting settings: \n${error}`])
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
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
            logErrorWithTimestamp(`Error opening app data directory: ${error}`)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Could not open app data directory. Error: \n${error}`])
            mlc.setMessageLog([...mlc.messageLog, `\n[INFO] Manual path: /storage/emulated/0/Android/data/${packageName}/files.`])
        }
    }

    // Reset settings to default values.
    const resetSettings = async (): Promise<boolean> => {
        const endTiming = startTiming("settings_manager_reset_settings", "settings")
        
        try {
            setIsSaving(true)

            // Ensure database is initialized before saving.
            logWithTimestamp("Ensuring database is initialized before resetting...")
            if (!isInitialized) {
                logWithTimestamp("Database not initialized, triggering initialization...")
                await loadSQLiteSettings()
            }

            // Create a deep copy of default settings to avoid reference issues.
            const defaultSettingsCopy = JSON.parse(JSON.stringify(defaultSettings))

            // Save default settings to SQLite database.
            await saveSQLiteSettings(defaultSettingsCopy)

            // Update the current settings in context.
            bsc.setSettings(defaultSettingsCopy)
            bsc.setReadyStatus(false)

            logWithTimestamp("Settings reset to defaults successfully.")
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] Settings have been reset to default values.`])

            endTiming({ status: "success" })
            return true
        } catch (error) {
            logErrorWithTimestamp("Error resetting settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error resetting settings: \n${error}`])
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            return false
        } finally {
            setIsSaving(false)
        }
    }

    return {
        saveSettings,
        saveSettingsImmediate,
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
