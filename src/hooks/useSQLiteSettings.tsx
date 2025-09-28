import { useState, useEffect, useCallback, useRef, useContext } from "react"
import { databaseManager } from "../lib/database"
import { Settings, defaultSettings } from "../context/BotStateContext"
import { startTiming } from "../lib/performanceLogger"
import { logWithTimestamp, logErrorWithTimestamp } from "../lib/logger"
import { MessageLogContext } from "../context/MessageLogContext"

/**
 * Hook for managing settings persistence with SQLite.
 * Provides CRUD operations and automatic migration from JSON files.
 */
export const useSQLiteSettings = () => {
    const mlc = useContext(MessageLogContext)
    const { addMessageToAsyncMessages } = mlc

    const [isSQLiteInitialized, setIsSQLiteInitialized] = useState(false)
    const [_, setIsSQLiteLoading] = useState(false)
    const [isSQLiteSaving, setIsSQLiteSaving] = useState(false)
    const [lastSavedSettings, setLastSavedSettings] = useState<Settings | null>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Initialize database on mount.
    useEffect(() => {
        initializeSQLiteDatabase()
    }, [])

    // Cleanup debounce timeout on component unmount to avoid potential errors from timeouts firing after the component is no longer mounted.
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [])

    /**
     * Compare two settings objects and return only the changed settings.
     */
    const getChangedSettings = (currentSettings: Settings, lastSaved: Settings | null): Partial<Settings> => {
        if (!lastSaved) {
            // If no previous settings, return all current settings.
            logWithTimestamp("[SQLite] No last saved settings, will save all current settings")
            return currentSettings
        }

        const changedSettings: Partial<Settings> = {}

        // Iterate through each settings category to identify changes by comparing current settings with the last saved settings.
        // This creates a diff object containing only the modified settings to optimize database updates and avoid unnecessary writes.
        for (const [category, categorySettings] of Object.entries(currentSettings)) {
            if (!lastSaved[category as keyof Settings]) {
                // This is a new category so include all settings.
                logWithTimestamp(`[SQLite] New category detected: ${category}`)
                changedSettings[category as keyof Settings] = categorySettings
                continue
            }

            const lastCategorySettings = lastSaved[category as keyof Settings]
            const changedCategorySettings: any = {}

            // Compare each setting within the category.
            for (const [key, value] of Object.entries(categorySettings)) {
                if (JSON.stringify(value) !== JSON.stringify((lastCategorySettings as any)[key])) {
                    logWithTimestamp(`[SQLite] Setting changed: ${category}.${key} from ${JSON.stringify((lastCategorySettings as any)[key])} to ${JSON.stringify(value)}`)
                    changedCategorySettings[key] = value
                }
            }

            // Only include the category if there are changes.
            if (Object.keys(changedCategorySettings).length > 0) {
                changedSettings[category as keyof Settings] = changedCategorySettings
            }
        }

        return changedSettings
    }

    /**
     * Initialize the database and migrate from JSON if needed.
     */
    const initializeSQLiteDatabase = useCallback(async () => {
        const endTiming = startTiming("sqlite_initialize_database", "settings")

        if (isSQLiteInitialized) {
            logWithTimestamp("[SQLite] Database already initialized, skipping...")
            endTiming({ status: "already_initialized" })
            return
        }

        try {
            logWithTimestamp("[SQLite] Starting database initialization...")
            setIsSQLiteLoading(true)
            await databaseManager.initialize()
            setIsSQLiteInitialized(true)
            logWithTimestamp("[SQLite] Database initialized successfully.")
            endTiming({ status: "success" })
        } catch (error) {
            logErrorWithTimestamp("[SQLite] Failed to initialize database:", error)
            addMessageToAsyncMessages(`\n[ERROR] Failed to initialize database: ${error}`)
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            throw error
        } finally {
            setIsSQLiteLoading(false)
        }
    }, [isSQLiteInitialized])

    /**
     * Load all settings from SQLite database.
     */
    const loadSQLiteSettings = useCallback(async (): Promise<Settings> => {
        const endTiming = startTiming("sqlite_load_settings", "settings")

        if (!isSQLiteInitialized) {
            await initializeSQLiteDatabase()
        }

        try {
            setIsSQLiteLoading(true)
            const dbSettings = await databaseManager.loadAllSettings()

            // Check if database is empty (no settings loaded).
            const hasSettings = Object.keys(dbSettings).length > 0

            // Apply loaded settings from database.
            const mergedSettings: Settings = JSON.parse(JSON.stringify(defaultSettings))
            Object.keys(dbSettings).forEach((category) => {
                if (mergedSettings[category as keyof Settings]) {
                    Object.assign(mergedSettings[category as keyof Settings], dbSettings[category])
                }
            })

            // If database is empty, save default settings to it.
            if (!hasSettings) {
                logWithTimestamp("[SQLite] Database is empty, initializing with default settings...")
                try {
                    // Prepare batch save data for all default settings including marking their categories.
                    const batchSettings: Array<{ category: string; key: string; value: any }> = []
                    for (const [category, categorySettings] of Object.entries(defaultSettings)) {
                        for (const [key, value] of Object.entries(categorySettings)) {
                            batchSettings.push({ category, key, value })
                        }
                    }

                    // Save all default settings in a single batch transaction.
                    if (batchSettings.length > 0) {
                        logWithTimestamp(`[SQLite] Saving ${batchSettings.length} default settings to database...`)
                        await databaseManager.saveSettingsBatch(batchSettings)
                        logWithTimestamp("[SQLite] Default settings saved to database successfully.")
                    }
                } catch (saveError) {
                    logErrorWithTimestamp("[SQLite] Failed to save default settings to database:", saveError)
                    addMessageToAsyncMessages(`\n[WARNING] Failed to save default settings to database: ${saveError}`)
                }
            }

            logWithTimestamp("Settings loaded from SQLite database.")
            setLastSavedSettings(JSON.parse(JSON.stringify(mergedSettings)))
            logWithTimestamp(`[SQLite] Updated lastSavedSettings with ${Object.keys(mergedSettings).length} categories`)
            endTiming({ status: "success", categoriesCount: Object.keys(dbSettings).length, initializedDefaults: !hasSettings })
            return mergedSettings
        } catch (error) {
            logErrorWithTimestamp("Failed to load settings from database:", error)
            addMessageToAsyncMessages(`\n[ERROR] Failed to load settings from database: ${error}`)
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            return JSON.parse(JSON.stringify(defaultSettings))
        } finally {
            setIsSQLiteLoading(false)
        }
    }, [isSQLiteInitialized])

    /**
     * Save settings to SQLite database with change detection and batch optimization.
     */
    const performSave = useCallback(
        async (settings: Settings): Promise<void> => {
            const endTiming = startTiming("sqlite_perform_save", "settings")

            logWithTimestamp(`[SQLite] performSave called, isSQLiteSaving: ${isSQLiteSaving}`)

            if (isSQLiteSaving) {
                logWithTimestamp("[SQLite] Save already in progress, skipping...")
                endTiming({ status: "skipped", reason: "already_saving" })
                return
            }

            try {
                setIsSQLiteSaving(true)

                if (!isSQLiteInitialized) {
                    logWithTimestamp("[SQLite] Database not initialized, initializing now...")
                    await initializeSQLiteDatabase()
                }

                // Double-check database is initialized.
                if (!databaseManager.isInitialized()) {
                    throw new Error("Database failed to initialize properly")
                }

                logWithTimestamp("[SQLite] Starting to save settings to SQLite database...")

                // Get only the changed settings.
                const changedSettings = getChangedSettings(settings, lastSavedSettings)

                logWithTimestamp(`[SQLite] Changed settings check: ${Object.keys(changedSettings).length} categories changed`)
                logWithTimestamp(`[SQLite] Last saved settings: ${lastSavedSettings ? "exists" : "null"}`)

                if (Object.keys(changedSettings).length === 0) {
                    logWithTimestamp("[SQLite] No settings changed, skipping save.")
                    endTiming({ status: "skipped", reason: "no_changes" })
                    return
                }

                logWithTimestamp(`[SQLite] Found ${Object.keys(changedSettings).length} changed categories, saving only changed settings...`)

                // Prepare the batch save data for all changed settings including marking their categories.
                const batchSettings: Array<{ category: string; key: string; value: any }> = []
                for (const [category, categorySettings] of Object.entries(changedSettings)) {
                    for (const [key, value] of Object.entries(categorySettings)) {
                        batchSettings.push({ category, key, value })
                    }
                }

                // Save all changed settings in a single batch transaction.
                if (batchSettings.length > 0) {
                    logWithTimestamp(`[SQLite] Saving ${batchSettings.length} settings in batch...`)
                    await databaseManager.saveSettingsBatch(batchSettings)
                }

                const totalSettingsSaved = batchSettings.length

                // Update the last saved settings to the current settings.
                setLastSavedSettings(JSON.parse(JSON.stringify(settings)))
                logWithTimestamp(`[SQLite] Updated lastSavedSettings after successful save with ${Object.keys(settings).length} categories`)

                logWithTimestamp("[SQLite] Changed settings saved to SQLite database.")
                endTiming({ status: "success", changedCategories: Object.keys(changedSettings).length, totalSettingsSaved })
            } catch (error) {
                logErrorWithTimestamp("[SQLite] Failed to save settings to database:", error)
                addMessageToAsyncMessages(`\n[ERROR] Failed to save settings to database: ${error}`)
                endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
                throw error
            } finally {
                logWithTimestamp("[SQLite] Setting isSQLiteSaving to false...")
                setIsSQLiteSaving(false)
            }
        },
        [isSQLiteSaving, lastSavedSettings]
    )

    /**
     * Debounced save function that prevents rapid successive saves and handles concurrency. Batches multiple rapid save requests into a single operation.
     * Skips new requests if a save is already in progress to prevent race conditions.
     */
    const debouncedSave = useCallback(
        async (settings: Settings): Promise<void> => {
            const endTiming = startTiming("sqlite_simple_save", "settings")

            logWithTimestamp(`[SQLite] Simple save requested, isSQLiteSaving: ${isSQLiteSaving}`)

            // Clear any existing timeout to reset the debounce timer.
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }

            // If already saving, skip this request.
            if (isSQLiteSaving) {
                logWithTimestamp("[SQLite] Save already in progress, skipping this save request...")
                endTiming({ status: "skipped", reason: "already_saving" })
                return
            }

            // Debounce the save operation.
            saveTimeoutRef.current = setTimeout(async () => {
                logWithTimestamp("[SQLite] Proceeding with debounced save operation...")
                await performSave(settings)
                endTiming({ status: "success", debounced: true })
            }, 100)
        },
        [isSQLiteSaving, performSave]
    )

    /**
     * Save settings to SQLite database.
     */
    const saveSQLiteSettings = useCallback(
        async (settings: Settings): Promise<void> => {
            await debouncedSave(settings)
        },
        [debouncedSave]
    )

    /**
     * Save settings immediately without debouncing (for background/exit saves).
     */
    const saveSQLiteSettingsImmediate = useCallback(
        async (settings: Settings): Promise<void> => {
            await performSave(settings)
        },
        [performSave]
    )

    return {
        isSQLiteInitialized,
        isSQLiteSaving,
        loadSQLiteSettings,
        saveSQLiteSettings,
        saveSQLiteSettingsImmediate,
        initializeSQLiteDatabase,
    }
}
