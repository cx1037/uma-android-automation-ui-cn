import { useState, useEffect, useCallback } from "react"
import { databaseManager } from "../lib/database"
import { Settings, defaultSettings } from "../context/BotStateContext"
import { startTiming, setMessageLogCallback } from "../lib/performanceLogger"
import { logWithTimestamp, logErrorWithTimestamp } from "../lib/logger"

/**
 * Hook for managing settings persistence with SQLite.
 * Provides CRUD operations and automatic migration from JSON files.
 */
export const useSQLiteSettings = (mlc: MessageLogProviderProps) => {
    const [isInitialized, setIsInitialized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    /**
     * Initialize the database and migrate from JSON if needed.
     */
    const initializeDatabase = useCallback(async () => {
        const endTiming = startTiming("sqlite_initialize_database", "settings")

        if (isInitialized) {
            logWithTimestamp("[SQLite] Database already initialized, skipping...")
            endTiming({ status: "already_initialized" })
            return
        }

        try {
            logWithTimestamp("[SQLite] Starting database initialization...")
            setIsLoading(true)
            await databaseManager.initialize()
            setIsInitialized(true)
            logWithTimestamp("[SQLite] Database initialized successfully.")
            endTiming({ status: "success" })
        } catch (error) {
            logErrorWithTimestamp("[SQLite] Failed to initialize database:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to initialize database: ${error}`])
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [isInitialized, mlc])

    /**
     * Load all settings from SQLite database.
     */
    const loadSettings = useCallback(async (): Promise<Settings> => {
        const endTiming = startTiming("sqlite_load_settings", "settings")

        if (!isInitialized) {
            await initializeDatabase()
        }

        try {
            setIsLoading(true)
            const dbSettings = await databaseManager.loadAllSettings()

            // Apply loaded settings from database.
            const mergedSettings: Settings = JSON.parse(JSON.stringify(defaultSettings))
            Object.keys(dbSettings).forEach((category) => {
                if (mergedSettings[category as keyof Settings]) {
                    Object.assign(mergedSettings[category as keyof Settings], dbSettings[category])
                }
            })

            console.log("Settings loaded from SQLite database.")
            return mergedSettings
        } catch (error) {
            logErrorWithTimestamp("Failed to load settings from database:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to load settings from database: ${error}`])
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            return JSON.parse(JSON.stringify(defaultSettings))
        } finally {
            setIsLoading(false)
        }
    }, [isInitialized, initializeDatabase, mlc])

    /**
     * Simple save function without debouncing to ensure settings are always saved.
     */
    const simpleSave = useCallback(
        async (settings: Settings): Promise<void> => {
            console.log(`[SQLite] Simple save requested, isSaving: ${isSaving}`)

            // If already saving, wait for it to complete.
            if (isSaving) {
                console.log("[SQLite] Save already in progress, waiting for completion...")
                // Wait a bit and try again.
                await new Promise((resolve) => setTimeout(resolve, 100))
                if (isSaving) {
                    console.log("[SQLite] Still saving, skipping this save request...")
                    return
                }
            }

            console.log("[SQLite] Proceeding with save operation...")
            await performSave(settings)
        },
        [isSaving]
    )

    /**
     * Perform the actual save operation.
     */
    const performSave = useCallback(
        async (settings: Settings): Promise<void> => {
            const endTiming = startTiming("sqlite_perform_save", "settings")

            logWithTimestamp(`[SQLite] performSave called, isSaving: ${isSaving}`)

            if (isSaving) {
                logWithTimestamp("[SQLite] Save already in progress, skipping...")
                endTiming({ status: "skipped", reason: "already_saving" })
                return
            }

            try {
                setIsSaving(true)

                if (!isInitialized) {
                    logWithTimestamp("[SQLite] Database not initialized, initializing now...")
                    await initializeDatabase()
                }

                // Double-check database is initialized.
                if (!databaseManager.isInitialized()) {
                    throw new Error("Database failed to initialize properly")
                }

                logWithTimestamp("[SQLite] Starting to save settings to SQLite database...")

                // Save each category of settings.
                for (const [category, categorySettings] of Object.entries(settings)) {
                    console.log(`[SQLite] Saving category: ${category}`)
                    for (const [key, value] of Object.entries(categorySettings)) {
                        await databaseManager.saveSetting(category, key, value)
                    }
                }

                console.log("[SQLite] Settings saved to SQLite database.")
            } catch (error) {
                logErrorWithTimestamp("[SQLite] Failed to save settings to database:", error)
                mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to save settings to database: ${error}`])
                endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
                throw error
            } finally {
                logWithTimestamp("[SQLite] Setting isSaving to false...")
                setIsSaving(false)
            }
        },
        [isInitialized, initializeDatabase, mlc, isSaving]
    )

    /**
     * Save settings to SQLite database.
     */
    const saveSettings = useCallback(
        async (settings: Settings): Promise<void> => {
            await simpleSave(settings)
        },
        [simpleSave]
    )

    /**
     * Save a specific category of settings.
     */
    const saveCategorySettings = useCallback(
        async (category: keyof Settings, categorySettings: any): Promise<void> => {
            const endTiming = startTiming("sqlite_save_category_settings", "settings")

            if (!isInitialized) {
                await initializeDatabase()
            }

            try {
                let settingsCount = 0
                for (const [key, value] of Object.entries(categorySettings)) {
                    await databaseManager.saveSetting(category, key, value)
                    settingsCount++
                }

                logWithTimestamp(`[SQLite] Category ${category} settings saved to SQLite database`)
                endTiming({ status: "success", category, settingsCount })
            } catch (error) {
                logErrorWithTimestamp(`[SQLite] Failed to save ${category} settings to database:`, error)
                mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to save ${category} settings to database: ${error}`])
                endTiming({ status: "error", category, error: error instanceof Error ? error.message : String(error) })
                throw error
            }
        },
        [isInitialized, initializeDatabase, mlc]
    )

    /**
     * Load a specific category of settings.
     */
    const loadCategorySettings = useCallback(
        async (category: keyof Settings): Promise<any> => {
            const endTiming = startTiming("sqlite_load_category_settings", "settings")

            if (!isInitialized) {
                await initializeDatabase()
            }

            try {
                const categorySettings = await databaseManager.loadCategorySettings(category)
                endTiming({ status: "success", category, settingsCount: Object.keys(categorySettings).length })
                return categorySettings
            } catch (error) {
                logErrorWithTimestamp(`Failed to load ${category} settings from database:`, error)
                mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to load ${category} settings from database: ${error}`])
                endTiming({ status: "error", category, error: error instanceof Error ? error.message : String(error) })
                return JSON.parse(JSON.stringify(defaultSettings[category]))
            }
        },
        [isInitialized, initializeDatabase, mlc]
    )

    /**
     * Clear all settings from database.
     */
    const clearAllSettings = useCallback(async (): Promise<void> => {
        const endTiming = startTiming("sqlite_clear_all_settings", "settings")

        if (!isInitialized) {
            await initializeDatabase()
        }

        try {
            await databaseManager.clearAllSettings()
            logWithTimestamp("All settings cleared from SQLite database")
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] All settings cleared from SQLite database`])
            endTiming({ status: "success" })
        } catch (error) {
            logErrorWithTimestamp("Failed to clear settings from database:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to clear settings from database: ${error}`])
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            throw error
        }
    }, [isInitialized, initializeDatabase, mlc])

    // Initialize database on mount.
    useEffect(() => {
        initializeDatabase()
    }, [initializeDatabase])

    return {
        isInitialized,
        isLoading,
        isSaving,
        loadSettings,
        saveSettings,
        saveCategorySettings,
        loadCategorySettings,
        clearAllSettings,
        initializeDatabase,
    }
}
