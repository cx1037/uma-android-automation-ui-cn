import { BotStateProvider } from "./context/BotStateContext"
import { MessageLogProvider } from "./context/MessageLogContext"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import Home from "./pages/Home"

export const Tag = "UAA"

const Stack = createNativeStackNavigator()

function App() {
    return (
        <BotStateProvider>
            <MessageLogProvider>
                <NavigationContainer>
                    <Stack.Navigator
                        screenOptions={{
                            headerShown: false, // Hide the default header.
                        }}
                    >
                        <Stack.Screen name="Home" component={Home} />
                    </Stack.Navigator>
                </NavigationContainer>
            </MessageLogProvider>
        </BotStateProvider>
    )
}

export default App
