import { createContext, useState } from "react"

export interface MessageLogProviderProps {
    messageLog: string[]
    setMessageLog: (messageLog: string[]) => void
    asyncMessages: string[]
    setAsyncMessages: (asyncMessages: string[]) => void
    addMessageToAsyncMessages: (message: string) => void
}

export const MessageLogContext = createContext<MessageLogProviderProps>({} as MessageLogProviderProps)

// https://stackoverflow.com/a/60130448 and https://stackoverflow.com/a/60198351
export const MessageLogProvider = ({ children }: any): React.ReactElement => {
    const [messageLog, setMessageLog] = useState<string[]>([])
    const [asyncMessages, setAsyncMessages] = useState<string[]>([])

    const addMessageToAsyncMessages = (message: string) => {
        setAsyncMessages(prev => [...prev, message])
    }

    const providerValues: MessageLogProviderProps = {
        messageLog,
        setMessageLog,
        asyncMessages,
        setAsyncMessages,
        addMessageToAsyncMessages,
    }

    return <MessageLogContext.Provider value={providerValues}>{children}</MessageLogContext.Provider>
}
