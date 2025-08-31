import React from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { useThemeClasses } from "../../hooks/useThemeClasses"

interface NavigationLinkProps {
    title: string
    description: string
    onPress: () => void
    className?: string
}

const NavigationLink: React.FC<NavigationLinkProps> = ({ title, description, onPress, className = "" }) => {
    const themeClasses = useThemeClasses()

    return (
        <View className={`mt-5 p-4 rounded-lg border ${themeClasses.bgCard} ${themeClasses.border} ${className}`}>
            <TouchableOpacity onPress={onPress}>
                <Text className={`text-lg font-semibold ${themeClasses.text}`}>{title}</Text>
                <Text className={`mt-2 ${themeClasses.textSecondary}`}>{description}</Text>
            </TouchableOpacity>
        </View>
    )
}

export default NavigationLink
