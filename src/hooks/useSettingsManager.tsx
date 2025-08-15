import { useState } from "react"
import RNFS from "react-native-fs"
import { defaultSettings, Settings, BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogProviderProps } from "../context/MessageLogContext"
import { Tag } from "../App"

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
            const path = RNFS.ExternalDirectoryPath + "/settings.json"
            const toSave = JSON.stringify(localSettings, null, 4)

            // Delete existing file first to avoid corruption.
            try {
                await RNFS.unlink(path)
                console.log("settings.json file successfully deleted.")
            } catch {
                console.log("settings.json file does not exist so no need to delete it before saving current settings.")
            }

            await RNFS.writeFile(path, toSave)
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
        const path = RNFS.ExternalDirectoryPath + "/settings.json"
        let newSettings: Settings = defaultSettings

        try {
            const data = await RNFS.readFile(path)
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
                        `\nNote that ${Tag} sometimes corrupts the settings.json when saving. Automatic fix was not successful.`,
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
            const data = await RNFS.readFile(path)
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

    return {
        saveSettings,
        loadSettings,
        isSaving
    }
}
