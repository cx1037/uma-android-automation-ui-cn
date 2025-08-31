import React from "react"
import { TouchableOpacity } from "react-native"
import { Moon, Sun } from "lucide-react-native"
import { useTheme } from "../../context/ThemeContext"

export const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme, colors } = useTheme()

    return <TouchableOpacity onPress={toggleTheme}>{theme === "light" ? <Moon size={24} color={colors.secondaryForeground} /> : <Sun size={24} color={colors.secondaryForeground} />}</TouchableOpacity>
}

export default ThemeToggle
