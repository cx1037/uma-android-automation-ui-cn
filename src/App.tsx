import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Home as HomeIcon, Settings as SettingsIcon } from "lucide-react-native"
import { PortalHost } from "@rn-primitives/portal"
import { StatusBar } from "expo-status-bar"
import { SafeAreaView } from "react-native-safe-area-context"
import { BotStateProvider } from "./context/BotStateContext"
import { MessageLogProvider } from "./context/MessageLogContext"
import { ThemeProvider, useTheme } from "./context/ThemeContext"
import Home from "./pages/Home"
import Settings from "./pages/Settings"
import TrainingSettings from "./pages/TrainingSettings"
import TrainingEventSettings from "./pages/TrainingEventSettings"
import OCRSettings from "./pages/OCRSettings"
import { NAV_THEME } from "./lib/theme"

export const Tag = "UAA"

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function SettingsStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="SettingsMain" component={Settings} options={{ headerShown: false }} />
            <Stack.Screen name="TrainingSettings" component={TrainingSettings} options={{ headerShown: false }} />
            <Stack.Screen name="TrainingEventSettings" component={TrainingEventSettings} options={{ headerShown: false }} />
            <Stack.Screen name="OCRSettings" component={OCRSettings} options={{ headerShown: false }} />
        </Stack.Navigator>
    )
}

function AppContent() {
    const { theme, colors } = useTheme()

    return (
        <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
            <NavigationContainer theme={NAV_THEME[theme]}>
                <StatusBar style={theme === "light" ? "dark" : "light"} />
                <Tab.Navigator
                    screenOptions={({ route }) => ({
                        tabBarIcon: ({ size }: { size: number }) => {
                            if (route.name === "Home") {
                                return <HomeIcon size={size} color={colors.primary} />
                            } else if (route.name === "Settings") {
                                return <SettingsIcon size={size} color={colors.primary} />
                            }
                        },
                        headerShown: false,
                    })}
                >
                    <Tab.Screen name="Home" component={Home} />
                    <Tab.Screen name="Settings" component={SettingsStack} />
                </Tab.Navigator>
                <PortalHost />
            </NavigationContainer>
        </SafeAreaView>
    )
}

function App() {
    return (
        <ThemeProvider>
            <BotStateProvider>
                <MessageLogProvider>
                    <AppContent />
                </MessageLogProvider>
            </BotStateProvider>
        </ThemeProvider>
    )
}

export default App
