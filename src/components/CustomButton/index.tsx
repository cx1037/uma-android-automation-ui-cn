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
    const { colors } = useTheme()

    // Determine the background color based on variant and theme.
    const getBackgroundColor = () => {
        if (disabled) return "opacity-50"

        switch (variant) {
            case "destructive":
                return "bg-destructive"
            case "outline":
                return "border-border bg-background"
            case "secondary":
                return "bg-secondary"
            case "ghost":
                return "transparent"
            case "link":
                return "transparent"
            default:
                return "bg-primary"
        }
    }

    // Determine the text color based on variant and theme.
    const getTextColor = () => {
        if (disabled) return "opacity-50"

        switch (variant) {
            case "destructive":
                return "text-white"
            case "outline":
                return "text-foreground"
            case "secondary":
                return "text-secondary-foreground"
            case "ghost":
                return "text-foreground"
            case "link":
                return "text-primary"
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
                return {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                }
            case "secondary":
                return { backgroundColor: colors.secondary }
            case "default":
                return { backgroundColor: colors.primary }
            default:
                return {}
        }
    }

    return (
        <Button variant={variant} size={size} className={`${getBackgroundColor()} ${className}`} style={[getCustomStyle(), style]} disabled={disabled} {...props}>
            {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
            <Text className={`${getTextColor()}`} style={fontSize ? { fontSize: fontSize } : undefined}>
                {children}
            </Text>
        </Button>
    )
}

export default CustomButton
