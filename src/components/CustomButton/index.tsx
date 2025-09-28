import React from "react"
import { PressableProps, ViewStyle, ActivityIndicator } from "react-native"
import { Button } from "../ui/button"
import { Text } from "../ui/text"
import { useTheme } from "../../context/ThemeContext"

interface CustomButtonProps extends PressableProps {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    size?: "default" | "sm" | "lg" | "icon"
    style?: ViewStyle
    className?: string
    disabled?: boolean
    isLoading?: boolean
    fontSize?: number
    children: React.ReactNode
}

const CustomButton: React.FC<CustomButtonProps> = ({ variant = "default", size = "default", style, className = "", disabled = false, isLoading = false, fontSize, children, ...props }) => {
    const { colors, isDark } = useTheme()

    // Determine the background color based on variant and theme.
    const getBackgroundColor = () => {
        if (disabled) return { opacity: 0.5 }

        switch (variant) {
            case "destructive":
                return { backgroundColor: colors.destructive }
            case "outline":
                return { backgroundColor: isDark ? "black" : "white" }
            case "secondary":
                return { backgroundColor: colors.secondary }
            case "ghost":
                return { backgroundColor: "transparent" }
            case "link":
                return { backgroundColor: "transparent" }
            default:
                return {}
        }
    }

    // Determine the text color based on variant and theme.
    const getTextColor = () => {
        if (disabled) return "opacity-50"

        switch (variant) {
            case "destructive":
                return "text-secondary-foreground"
            case "outline":
                return isDark ? "text-secondary-foreground" : "text-primary-foreground"
            case "secondary":
                return "text-secondary-foreground"
            case "ghost":
                return isDark ? "text-secondary-foreground" : "text-primary-foreground"
            case "link":
                return isDark ? "text-secondary-foreground" : "text-primary-foreground"
            default:
                return "text-primary-foreground"
        }
    }

    // Apply custom styling for specific variants that need theme-aware colors.
    const getCustomStyle = () => {
        if (disabled) return {}

        switch (variant) {
            case "destructive":
                return { backgroundColor: colors.destructive }
            case "outline":
                return { borderColor: isDark ? "white" : "black" }
            case "secondary":
                return { backgroundColor: isDark ? colors.secondary : colors.primary }
            case "default":
                return { backgroundColor: isDark ? colors.primary : colors.secondary }
            default:
                return {}
        }
    }

    return (
        <Button variant={variant} size={size} style={[getBackgroundColor(), getCustomStyle(), style]} disabled={disabled} {...props}>
            {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
            <Text className={`${getTextColor()}`} style={fontSize ? { fontSize: fontSize } : undefined}>
                {children}
            </Text>
        </Button>
    )
}

export default CustomButton
