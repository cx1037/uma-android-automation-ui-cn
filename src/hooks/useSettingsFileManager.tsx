import { useState } from "react"
import * as DocumentPicker from "expo-document-picker"
import * as Sharing from "expo-sharing"
import { useSettingsManager } from "./useSettingsManager"
import { BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogProviderProps } from "../context/MessageLogContext"

/**
 * Hook for managing settings file operations (import/export) with file picker and restart prompts.
 */
export const useSettingsFileManager = (bsc: BotStateProviderProps, mlc: MessageLogProviderProps) => {
    const [showImportDialog, setShowImportDialog] = useState(false)
    const [showResetDialog, setShowResetDialog] = useState(false)

    const { importSettings, exportSettings } = useSettingsManager(bsc, mlc)

    /**
     * Import settings from a JSON file using document picker.
     */
    const handleImportSettings = async () => {
        try {
            // Open document picker for JSON files.
            const result = await DocumentPicker.getDocumentAsync({
                type: "application/json",
                copyToCacheDirectory: true,
            })

            if (result.canceled) {
                return
            }

            if (!result.assets || result.assets.length === 0) {
                return
            }

            // Import the settings.
            const success = await importSettings(result.assets[0].uri)
            if (success) {
                setShowImportDialog(true)
            }
        } catch (error) {
            console.error("Error importing settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error importing settings: ${error}`])
        }
    }

    /**
     * Export current settings to a JSON file.
     */
    const handleExportSettings = async () => {
        try {
            // Export settings to a file.
            const fileUri = await exportSettings()
            if (fileUri) {
                if (await Sharing.isAvailableAsync()) {
                    // Share the exported file.
                    await Sharing.shareAsync(fileUri, {
                        mimeType: "application/json",
                        dialogTitle: "Export Settings",
                    })
                }
            }
        } catch (error) {
            console.error("Error exporting settings:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Error exporting settings: ${error}`])
        }
    }

    return {
        handleImportSettings,
        handleExportSettings,
        showImportDialog,
        setShowImportDialog,
        showResetDialog,
        setShowResetDialog,
    }
}
