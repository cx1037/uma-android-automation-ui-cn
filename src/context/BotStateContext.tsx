import { createContext, useState } from "react"

export interface Settings {
    // Game settings.
    game: {

    }

    // Configuration settings.
    configuration: {

    }

    // Android settings.
    android: {

    }
}

// Set the default settings.
export const defaultSettings: Settings = {
    game: {

    },
    configuration: {

    },
    android: {

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
