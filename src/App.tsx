import { BotStateProvider } from "./context/BotStateContext"
import { MessageLogProvider } from "./context/MessageLogContext"
import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import Ionicons from "react-native-vector-icons/Ionicons"
import { PortalHost } from "@rn-primitives/portal"
import Home from "./pages/Home"
import Settings from "./pages/Settings"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import TrainingSettings from "./pages/Settings/TrainingSettings"

export const Tag = "UAA"

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function SettingsStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="SettingsMain" component={Settings} options={{ headerShown: false }} />
            <Stack.Screen name="TrainingSettings" component={TrainingSettings} options={{ title: "Training Settings" }} />
        </Stack.Navigator>
    )
}

function App() {
    return (
        <BotStateProvider>
            <MessageLogProvider>
                <NavigationContainer>
                    <Tab.Navigator
                        screenOptions={({ route }) => ({
                            tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
                                let iconName = ""
                                if (route.name === "Home") {
                                    iconName = focused ? "home" : "home-outline"
                                } else if (route.name === "Settings") {
                                    iconName = focused ? "settings" : "settings-outline"
                                }

                                return <Ionicons name={iconName} size={size} color={color} />
                            },
                            tabBarActiveTintColor: "tomato",
                            tabBarInactiveTintColor: "gray",
                            headerShown: false
                        })}
                    >
                        <Tab.Screen name="Home" component={Home} />
                        <Tab.Screen name="Settings" component={SettingsStack} />
                    </Tab.Navigator>
                    <PortalHost />
                </NavigationContainer>
            </MessageLogProvider>
        </BotStateProvider>
    )
}

export default App
