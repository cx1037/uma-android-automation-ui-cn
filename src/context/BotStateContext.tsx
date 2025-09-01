import { createContext, useState } from "react"

export interface Settings {
    // General settings
    general: {
        scenario: string
        enableSkillPointCheck: boolean
        skillPointCheck: number
        enablePopupCheck: boolean
    }

    // Racing settings
    racing: {
        enableFarmingFans: boolean
        daysToRunExtraRaces: number
        disableRaceRetries: boolean
        enableStopOnMandatoryRaces: boolean
        enableForceRacing: boolean
    }

    // Training Event settings
    trainingEvent: {
        enablePrioritizeEnergyOptions: boolean
    }

    // Training settings
    training: {
        trainingBlacklist: string[]
        statPrioritization: string[]
        maximumFailureChance: number
        disableTrainingOnMaxedStat: boolean
        focusOnSparkStatTarget: boolean
        characterList: string[]
        selectAllCharacters: boolean
        supportList: string[]
        selectAllSupportCards: boolean
    }

    // Training Stat Target settings
    trainingStatTarget: {
        // Sprint
        trainingSprintStatTarget_speedStatTarget: number
        trainingSprintStatTarget_staminaStatTarget: number
        trainingSprintStatTarget_powerStatTarget: number
        trainingSprintStatTarget_gutsStatTarget: number
        trainingSprintStatTarget_witStatTarget: number

        // Mile
        trainingMileStatTarget_speedStatTarget: number
        trainingMileStatTarget_staminaStatTarget: number
        trainingMileStatTarget_powerStatTarget: number
        trainingMileStatTarget_gutsStatTarget: number
        trainingMileStatTarget_witStatTarget: number

        // Medium
        trainingMediumStatTarget_speedStatTarget: number
        trainingMediumStatTarget_staminaStatTarget: number
        trainingMediumStatTarget_powerStatTarget: number
        trainingMediumStatTarget_gutsStatTarget: number
        trainingMediumStatTarget_witStatTarget: number

        // Long
        trainingLongStatTarget_speedStatTarget: number
        trainingLongStatTarget_staminaStatTarget: number
        trainingLongStatTarget_powerStatTarget: number
        trainingLongStatTarget_gutsStatTarget: number
        trainingLongStatTarget_witStatTarget: number
    }

    // OCR settings
    ocr: {
        ocrThreshold: number
        enableAutomaticOCRRetry: boolean
        ocrConfidence: number
    }

    // Debug settings
    debug: {
        enableDebugMode: boolean
        templateMatchConfidence: number
        templateMatchCustomScale: number
        debugMode_startTemplateMatchingTest: boolean
        debugMode_startSingleTrainingFailureOCRTest: boolean
        debugMode_startComprehensiveTrainingFailureOCRTest: boolean
        enableHideOCRComparisonResults: boolean
    }
}

// Set the default settings.
export const defaultSettings: Settings = {
    general: {
        scenario: "",
        enableSkillPointCheck: false,
        skillPointCheck: 750,
        enablePopupCheck: false,
    },
    racing: {
        enableFarmingFans: false,
        daysToRunExtraRaces: 5,
        disableRaceRetries: false,
        enableStopOnMandatoryRaces: false,
        enableForceRacing: false,
    },
    trainingEvent: {
        enablePrioritizeEnergyOptions: false,
    },
    training: {
        trainingBlacklist: [],
        statPrioritization: ["Speed", "Stamina", "Power", "Wit", "Guts"],
        maximumFailureChance: 20,
        disableTrainingOnMaxedStat: true,
        focusOnSparkStatTarget: false,
        characterList: [],
        selectAllCharacters: true,
        supportList: [],
        selectAllSupportCards: true,
    },
    trainingStatTarget: {
        trainingSprintStatTarget_speedStatTarget: 900,
        trainingSprintStatTarget_staminaStatTarget: 300,
        trainingSprintStatTarget_powerStatTarget: 600,
        trainingSprintStatTarget_gutsStatTarget: 300,
        trainingSprintStatTarget_witStatTarget: 300,
        trainingMileStatTarget_speedStatTarget: 900,
        trainingMileStatTarget_staminaStatTarget: 300,
        trainingMileStatTarget_powerStatTarget: 600,
        trainingMileStatTarget_gutsStatTarget: 300,
        trainingMileStatTarget_witStatTarget: 300,
        trainingMediumStatTarget_speedStatTarget: 800,
        trainingMediumStatTarget_staminaStatTarget: 450,
        trainingMediumStatTarget_powerStatTarget: 550,
        trainingMediumStatTarget_gutsStatTarget: 300,
        trainingMediumStatTarget_witStatTarget: 300,
        trainingLongStatTarget_speedStatTarget: 700,
        trainingLongStatTarget_staminaStatTarget: 600,
        trainingLongStatTarget_powerStatTarget: 450,
        trainingLongStatTarget_gutsStatTarget: 300,
        trainingLongStatTarget_witStatTarget: 300,
    },
    ocr: {
        ocrThreshold: 230,
        enableAutomaticOCRRetry: true,
        ocrConfidence: 0.8,
    },
    debug: {
        enableDebugMode: false,
        templateMatchConfidence: 0.8,
        templateMatchCustomScale: 1.0,
        debugMode_startTemplateMatchingTest: false,
        debugMode_startSingleTrainingFailureOCRTest: false,
        debugMode_startComprehensiveTrainingFailureOCRTest: false,
        enableHideOCRComparisonResults: true,
    },
}

export interface BotStateProviderProps {
    readyStatus: boolean
    setReadyStatus: (readyStatus: boolean) => void
    isBotRunning: boolean
    setIsBotRunning: (isBotRunning: boolean) => void
    startBot: boolean
    setStartBot: (startBot: boolean) => void
    stopBot: boolean
    setStopBot: (stopBot: boolean) => void
    refreshAlert: boolean
    setRefreshAlert: (refreshAlert: boolean) => void
    settings: Settings
    setSettings: (settings: Settings) => void
    appVersion: string
    setAppVersion: (appVersion: string) => void
}

export const BotStateContext = createContext<BotStateProviderProps>({} as BotStateProviderProps)

// https://stackoverflow.com/a/60130448 and https://stackoverflow.com/a/60198351
export const BotStateProvider = ({ children }: any): React.ReactElement => {
    const [readyStatus, setReadyStatus] = useState<boolean>(false)
    const [isBotRunning, setIsBotRunning] = useState<boolean>(false)
    const [startBot, setStartBot] = useState<boolean>(false)
    const [stopBot, setStopBot] = useState<boolean>(false)
    const [refreshAlert, setRefreshAlert] = useState<boolean>(false)
    const [appVersion, setAppVersion] = useState<string>("")

    const [settings, setSettings] = useState<Settings>(defaultSettings)

    const providerValues: BotStateProviderProps = {
        readyStatus,
        setReadyStatus,
        isBotRunning,
        setIsBotRunning,
        startBot,
        setStartBot,
        stopBot,
        setStopBot,
        refreshAlert,
        setRefreshAlert,
        settings,
        setSettings,
        appVersion,
        setAppVersion,
    }

    return <BotStateContext.Provider value={providerValues}>{children}</BotStateContext.Provider>
}
