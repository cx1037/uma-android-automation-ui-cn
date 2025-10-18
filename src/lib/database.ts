import * as SQLite from "expo-sqlite"
import { startTiming } from "./performanceLogger"
import { logWithTimestamp, logErrorWithTimestamp } from "./logger"

// The schema for the database.
export interface DatabaseSettings {
    id: number
    category: string
    key: string
    value: string
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
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(category, key)
                )
            `)
            logWithTimestamp("Settings table created successfully.")

            // Create index for faster queries.
            logWithTimestamp("Creating index...")
            await this.db.execAsync(`
                CREATE INDEX IF NOT EXISTS idx_settings_category_key 
                ON settings(category, key)
            `)
            logWithTimestamp("Index created successfully.")

            logWithTimestamp("Database initialized successfully.")
        } catch (error) {
            logErrorWithTimestamp("Failed to initialize database:", error)
            this.db = null // Reset database on error.
            throw error
        }
    }

    /**
     * Save settings to database by category and key.
     */
    async saveSetting(category: string, key: string, value: any, suppressLogging: boolean = false): Promise<void> {
        const endTiming = startTiming("database_save_setting", "database")

        if (!this.db) {
            logErrorWithTimestamp("Database is null when trying to save setting.")
            endTiming({ status: "error", error: "database_not_initialized" })
            throw new Error("Database not initialized")
        }

        try {
            const valueString = typeof value === "string" ? value : JSON.stringify(value)
            if (!suppressLogging) {
                logWithTimestamp(`[DB] Saving setting: ${category}.${key} = ${valueString.substring(0, 100)}...`)
            }
            await this.db.runAsync(
                `INSERT OR REPLACE INTO settings (category, key, value, updated_at) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [category, key, valueString]
            )
            if (!suppressLogging) {
                logWithTimestamp(`[DB] Successfully saved setting: ${category}.${key}`)
            }
            endTiming({ status: "success", category, key })
        } catch (error) {
            logErrorWithTimestamp(`[DB] Failed to save setting ${category}.${key}:`, error)
            endTiming({ status: "error", category, key, error: error instanceof Error ? error.message : String(error) })
            throw error
        }
    }

    /**
     * Save multiple settings in a single transaction for better performance.
     */
    async saveSettingsBatch(settings: Array<{ category: string; key: string; value: any }>): Promise<void> {
        const endTiming = startTiming("database_save_settings_batch", "database")

        if (!this.db) {
            logErrorWithTimestamp("Database is null when trying to save settings batch.")
            endTiming({ status: "error", error: "database_not_initialized" })
            throw new Error("Database not initialized")
        }

        if (settings.length === 0) {
            endTiming({ status: "skipped", reason: "no_settings" })
            return
        }

        try {
            logWithTimestamp(`[DB] Saving ${settings.length} settings in batch.`)

            await this.db.runAsync("BEGIN TRANSACTION")
            const stmt = await this.db.prepareAsync(
                `INSERT OR REPLACE INTO settings (category, key, value, updated_at) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
            )

            // Execute all settings in batch.
            for (const setting of settings) {
                const valueString = typeof setting.value === "string" ? setting.value : JSON.stringify(setting.value)
                await stmt.executeAsync([setting.category, setting.key, valueString])
            }

            // Finalize statement and commit transaction.
            await stmt.finalizeAsync()
            await this.db.runAsync("COMMIT")

            logWithTimestamp(`[DB] Successfully saved ${settings.length} settings in batch.`)
            endTiming({ status: "success", settingsCount: settings.length })
        } catch (error) {
            logErrorWithTimestamp(`[DB] Failed to save settings batch:`, error)

            // Rollback transaction on error.
            try {
                await this.db.runAsync("ROLLBACK")
            } catch (rollbackError) {
                logErrorWithTimestamp("[DB] Failed to rollback transaction:", rollbackError)
            }

            endTiming({ status: "error", settingsCount: settings.length, error: error instanceof Error ? error.message : String(error) })
            throw error
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

            // Try to parse as JSON and fallback to string.
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
     * Check if the database is properly initialized.
     */
    isInitialized(): boolean {
        return this.db !== null
    }
}

// Available as a singleton instance.
export const databaseManager = new DatabaseManager()
