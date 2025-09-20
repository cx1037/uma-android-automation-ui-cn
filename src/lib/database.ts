import * as SQLite from "expo-sqlite"
import { startTiming } from "./performanceLogger"
import { logWithTimestamp, logErrorWithTimestamp } from "./logger"

export interface DatabaseSettings {
    id: number
    category: string
    key: string
    value: string
    created_at: string
    updated_at: string
}

/**
 * Database utility class for managing settings persistence with SQLite.
 * Stores settings as key-value pairs organized by category for efficient querying.
 */
export class DatabaseManager {
    private db: SQLite.SQLiteDatabase | null = null
    private isInitializing = false
    private initializationPromise: Promise<void> | null = null

    /**
     * Initialize the database and create tables if they don't exist.
     */
    async initialize(): Promise<void> {
        const endTiming = startTiming("database_initialize", "database")

        // If already initializing, wait for the existing initialization to complete.
        if (this.isInitializing && this.initializationPromise) {
            logWithTimestamp("Database initialization already in progress, waiting...")
            endTiming({ status: "already_initializing" })
            return this.initializationPromise
        }

        // If already initialized, return immediately.
        if (this.db) {
            logWithTimestamp("Database already initialized, skipping...")
            endTiming({ status: "already_initialized" })
            return
        }

        this.isInitializing = true
        this.initializationPromise = this._performInitialization()

        try {
            await this.initializationPromise
            endTiming({ status: "success" })
        } finally {
            this.isInitializing = false
            this.initializationPromise = null
        }
    }

    private async _performInitialization(): Promise<void> {
        try {
            logWithTimestamp("Starting database initialization...")
            this.db = await SQLite.openDatabaseAsync("settings.db", {
                useNewConnection: true,
            })
            logWithTimestamp("Database opened successfully")

            if (!this.db) {
                throw new Error("Database object is null after opening")
            }

            // Create settings table.
            logWithTimestamp("Creating settings table...")
            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(category, key)
                )
            `)
            logWithTimestamp("Settings table created successfully")

            // Create index for faster queries.
            logWithTimestamp("Creating index...")
            await this.db.execAsync(`
                CREATE INDEX IF NOT EXISTS idx_settings_category_key 
                ON settings(category, key)
            `)
            logWithTimestamp("Index created successfully")

            logWithTimestamp("Database initialized successfully")
        } catch (error) {
            logErrorWithTimestamp("Failed to initialize database:", error)
            this.db = null // Reset database on error
            throw error
        }
    }

    /**
     * Save settings to database by category and key with retry logic.
     */
    async saveSetting(category: string, key: string, value: any): Promise<void> {
        const endTiming = startTiming("database_save_setting", "database")

        if (!this.db) {
            logErrorWithTimestamp("Database is null when trying to save setting")
            endTiming({ status: "error", error: "database_not_initialized" })
            throw new Error("Database not initialized")
        }

        const maxRetries = 3
        let retryCount = 0

        while (retryCount < maxRetries) {
            try {
                const valueString = typeof value === "string" ? value : JSON.stringify(value)
                logWithTimestamp(`[DB] Saving setting: ${category}.${key} = ${valueString.substring(0, 100)}... (attempt ${retryCount + 1})`)

                // Use the simpler runAsync method to avoid potential prepareAsync issues.
                await this.db.runAsync(
                    `INSERT OR REPLACE INTO settings (category, key, value, updated_at) 
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                    [category, key, valueString]
                )
                logWithTimestamp(`[DB] Successfully saved setting: ${category}.${key}`)
                return // Success, exit retry loop
            } catch (error) {
                retryCount++
                logErrorWithTimestamp(`[DB] Failed to save settings batch (attempt ${retryCount}):`, error)
                
                if (retryCount >= maxRetries) {
                    throw error
                }
                
                // Wait before retry (exponential backoff).
                const waitTime = Math.pow(2, retryCount) * 100 // 200ms, 400ms, 800ms
                logWithTimestamp(`[DB] Retrying batch save in ${waitTime}ms...`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
            }
        }
    }

    /**
     * Load a specific setting from database.
     */
    async loadSetting(category: string, key: string): Promise<any> {
        if (!this.db) {
            throw new Error("Database not initialized")
        }

        try {
            const result = await this.db.getFirstAsync<DatabaseSettings>("SELECT * FROM settings WHERE category = ? AND key = ?", [category, key])

            if (!result) {
                return null
            }

            // Try to parse as JSON, fallback to string.
            try {
                return JSON.parse(result.value)
            } catch {
                return result.value
            }
        } catch (error) {
            logErrorWithTimestamp(`Failed to load setting ${category}.${key}:`, error)
            throw error
        }
    }

    /**
     * Load all settings for a category.
     */
    async loadCategorySettings(category: string): Promise<Record<string, any>> {
        const endTiming = startTiming("database_load_category_settings", "database")

        if (!this.db) {
            endTiming({ status: "error", error: "database_not_initialized" })
            throw new Error("Database not initialized")
        }

        try {
            const results = await this.db.getAllAsync<DatabaseSettings>("SELECT * FROM settings WHERE category = ?", [category])

            const settings: Record<string, any> = {}
            for (const result of results) {
                try {
                    settings[result.key] = JSON.parse(result.value)
                } catch {
                    settings[result.key] = result.value
                }
            }

            endTiming({ status: "success", category, settingsCount: Object.keys(settings).length })
            return settings
        } catch (error) {
            logErrorWithTimestamp(`Failed to load category settings ${category}:`, error)
            endTiming({ status: "error", category, error: error instanceof Error ? error.message : String(error) })
            throw error
        }
    }

    /**
     * Load all settings from database.
     */
    async loadAllSettings(): Promise<Record<string, Record<string, any>>> {
        const endTiming = startTiming("database_load_all_settings", "database")

        if (!this.db) {
            endTiming({ status: "error", error: "database_not_initialized" })
            throw new Error("Database not initialized")
        }

        try {
            const results = await this.db.getAllAsync<DatabaseSettings>("SELECT * FROM settings ORDER BY category, key")

            const settings: Record<string, Record<string, any>> = {}
            for (const result of results) {
                if (!settings[result.category]) {
                    settings[result.category] = {}
                }

                try {
                    settings[result.category][result.key] = JSON.parse(result.value)
                } catch {
                    settings[result.category][result.key] = result.value
                }
            }

            endTiming({ status: "success", totalSettings: results.length, categoriesCount: Object.keys(settings).length })
            return settings
        } catch (error) {
            logErrorWithTimestamp("Failed to load all settings:", error)
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            throw error
        }
    }

    /**
     * Delete a specific setting.
     */
    async deleteSetting(category: string, key: string): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized")
        }

        try {
            await this.db.runAsync("DELETE FROM settings WHERE category = ? AND key = ?", [category, key])
        } catch (error) {
            logErrorWithTimestamp(`Failed to delete setting ${category}.${key}:`, error)
            throw error
        }
    }

    /**
     * Delete all settings for a category.
     */
    async deleteCategorySettings(category: string): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized")
        }

        try {
            await this.db.runAsync("DELETE FROM settings WHERE category = ?", [category])
        } catch (error) {
            logErrorWithTimestamp(`Failed to delete category settings ${category}:`, error)
            throw error
        }
    }

    /**
     * Clear all settings from database.
     */
    async clearAllSettings(): Promise<void> {
        const endTiming = startTiming("database_clear_all_settings", "database")

        if (!this.db) {
            endTiming({ status: "error", error: "database_not_initialized" })
            throw new Error("Database not initialized")
        }

        try {
            await this.db.runAsync("DELETE FROM settings")
            endTiming({ status: "success" })
        } catch (error) {
            logErrorWithTimestamp("Failed to clear all settings:", error)
            endTiming({ status: "error", error: error instanceof Error ? error.message : String(error) })
            throw error
        }
    }

    /**
     * Check if the database is properly initialized.
     */
    isInitialized(): boolean {
        return this.db !== null
    }

    /**
     * Close the database connection.
     */
    async close(): Promise<void> {
        if (this.db) {
            logWithTimestamp("[DB] Closing database connection...")
            try {
                await this.db.closeAsync()
                logWithTimestamp("[DB] Database connection closed successfully")
            } catch (error) {
                logErrorWithTimestamp("[DB] Error closing database connection:", error)
            } finally {
                this.db = null
                this.isInitializing = false
                this.initializationPromise = null
            }
        }
    }
}

// Singleton instance.
export const databaseManager = new DatabaseManager()
