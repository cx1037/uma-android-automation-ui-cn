import { useState, useEffect, useCallback } from "react"
import { databaseManager } from "../lib/database"
import { Settings, defaultSettings } from "../context/BotStateContext"
import { MessageLogProviderProps } from "../context/MessageLogContext"

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
        if (isInitialized) {
            console.log("[SQLite] Database already initialized, skipping...")
            return
        }

        try {
            console.log("[SQLite] Starting database initialization...")
            setIsLoading(true)
            await databaseManager.initialize()
            setIsInitialized(true)
            console.log("[SQLite] Database initialized successfully.")
        } catch (error) {
            console.error("[SQLite] Failed to initialize database:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to initialize database: ${error}`])
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [isInitialized, mlc])

    /**
     * Load all settings from SQLite database.
     */
    const loadSettings = useCallback(async (): Promise<Settings> => {
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
            console.error("Failed to load settings from database:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to load settings from database: ${error}`])
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
            console.log(`[SQLite] performSave called, isSaving: ${isSaving}`)

            if (isSaving) {
                console.log("[SQLite] Save already in progress, skipping...")
                return
            }

            try {
                setIsSaving(true)

                if (!isInitialized) {
                    console.log("[SQLite] Database not initialized, initializing now...")
                    await initializeDatabase()
                }

                // Double-check database is initialized.
                if (!databaseManager.isInitialized()) {
                    throw new Error("Database failed to initialize properly")
                }

                console.log("[SQLite] Starting to save settings to SQLite database...")

                // Save each category of settings.
                for (const [category, categorySettings] of Object.entries(settings)) {
                    console.log(`[SQLite] Saving category: ${category}`)
                    for (const [key, value] of Object.entries(categorySettings)) {
                        await databaseManager.saveSetting(category, key, value)
                    }
                }

                console.log("[SQLite] Settings saved to SQLite database.")
            } catch (error) {
                console.error("[SQLite] Failed to save settings to database:", error)
                mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to save settings to database: ${error}`])
                throw error
            } finally {
                console.log("[SQLite] Setting isSaving to false...")
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
            if (!isInitialized) {
                await initializeDatabase()
            }

            try {
                for (const [key, value] of Object.entries(categorySettings)) {
                    await databaseManager.saveSetting(category, key, value)
                }

                console.log(`[SQLite] Category ${category} settings saved to SQLite database`)
            } catch (error) {
                console.error(`[SQLite] Failed to save ${category} settings to database:`, error)
                mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to save ${category} settings to database: ${error}`])
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
            if (!isInitialized) {
                await initializeDatabase()
            }

            try {
                const categorySettings = await databaseManager.loadCategorySettings(category)
                return categorySettings
            } catch (error) {
                console.error(`Failed to load ${category} settings from database:`, error)
                mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to load ${category} settings from database: ${error}`])
                return JSON.parse(JSON.stringify(defaultSettings[category]))
            }
        },
        [isInitialized, initializeDatabase, mlc]
    )

    /**
     * Clear all settings from database.
     */
    const clearAllSettings = useCallback(async (): Promise<void> => {
        if (!isInitialized) {
            await initializeDatabase()
        }

        try {
            await databaseManager.clearAllSettings()
            console.log("All settings cleared from SQLite database")
            mlc.setMessageLog([...mlc.messageLog, `\n[SUCCESS] All settings cleared from SQLite database`])
        } catch (error) {
            console.error("Failed to clear settings from database:", error)
            mlc.setMessageLog([...mlc.messageLog, `\n[ERROR] Failed to clear settings from database: ${error}`])
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
