import { useContext, useEffect, useState, useRef } from "react"
import { DeviceEventEmitter, AppState } from "react-native"
import { BotStateContext, BotStateProviderProps } from "../context/BotStateContext"
import { MessageLogContext, MessageLogProviderProps } from "../context/MessageLogContext"
import { useSettings } from "../context/SettingsContext"
import { logWithTimestamp, logErrorWithTimestamp } from "../lib/logger"
import { useSQLiteSettings } from "./useSQLiteSettings"
import { databaseManager, DatabaseRace } from "../lib/database"
import racesData from "../data/races.json"

/**
 * Manages app initialization, settings persistence, and message handling.
 * Coordinates startup sequence and maintains app state synchronization.
 */
export const useBootstrap = () => {
    const [isReady, setIsReady] = useState<boolean>(false)
    const isSavingRef = useRef<boolean>(false)

    const bsc = useContext(BotStateContext) as BotStateProviderProps
    const mlc = useContext(MessageLogContext) as MessageLogProviderProps

    // Hook for managing settings persistence.
    const { saveSettingsImmediate } = useSettings()
    const { isSQLiteInitialized } = useSQLiteSettings()

    useEffect(() => {
        // Listen for messages from the Android automation service.
        const messageLogSubscription = DeviceEventEmitter.addListener("MessageLog", (data: any) => {
            mlc.addMessageToLog(data.id, data.message)
        })

        return () => messageLogSubscription.remove()
    }, [])

    // Wait for SQLite database initialization to complete before marking app as ready.
    // This ensures the data layer is fully set up before allowing settings operations.
    useEffect(() => {
        if (isSQLiteInitialized) {
            logWithTimestamp("[Bootstrap] SQLite initialized, populating races data...")
            populateRacesData().then(() => {
                logWithTimestamp("[Bootstrap] Races data populated, app ready...")
                setIsReady(true)
                logWithTimestamp("[Bootstrap] App initialization complete")
            }).catch((error) => {
                logErrorWithTimestamp("[Bootstrap] Failed to populate races data:", error)
                // Still mark as ready even if races population fails
                setIsReady(true)
            })
        }
    }, [isSQLiteInitialized])

    /**
     * Populate the races table with data from races.json.
     */
    const populateRacesData = async (): Promise<void> => {
        try {
            logWithTimestamp("[Bootstrap] Starting races data population...")
            
            // Convert races.json data to database format
            const races: Array<Omit<DatabaseRace, "id">> = Object.entries(racesData).map(([key, race]) => ({
                key,
                name: race.name,
                date: race.date,
                raceTrack: race.raceTrack,
                course: race.course,
                direction: race.direction,
                grade: race.grade,
                terrain: race.terrain,
                distanceType: race.distanceType,
                distanceMeters: race.distanceMeters,
                fans: race.fans,
                turnNumber: race.turnNumber,
                nameFormatted: race.nameFormatted
            }))

            logWithTimestamp(`[Bootstrap] Converted ${races.length} races from JSON to database format`)

            // Clear existing races and populate with new data
            await databaseManager.clearRaces()
            await databaseManager.saveRacesBatch(races)
            
            logWithTimestamp(`[Bootstrap] Successfully populated ${races.length} races into database`)
        } catch (error) {
            logErrorWithTimestamp("[Bootstrap] Error populating races data:", error)
            throw error
        }
    }

    // Save settings when app goes to background or is about to close.
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === "background" || nextAppState === "inactive") {
                logWithTimestamp(`[Bootstrap] App state changed to ${nextAppState}, saving settings...`)
                if (!isSavingRef.current) {
                    isSavingRef.current = true
                    // Do an immediate save to bypass debouncing.
                    saveSettingsImmediate().finally(() => {
                        isSavingRef.current = false
                    })
                }
            }
        }

        const subscription = AppState.addEventListener("change", handleAppStateChange)
        return () => subscription?.remove()
    }, [saveSettingsImmediate])

    // Update ready status whenever settings change or app becomes ready.
    useEffect(() => {
        if (isReady) {
            const scenario = bsc.settings.general.scenario
            bsc.setReadyStatus(scenario !== "")
        }
    }, [isReady, bsc.settings.general.scenario])
}
