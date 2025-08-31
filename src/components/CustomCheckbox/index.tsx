import React from "react"
import { View } from "react-native"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"
import { Text } from "../ui/text"
import { useTheme } from "../../context/ThemeContext"

interface CustomCheckboxProps {
    id?: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    label: string
    description?: string | null
    className?: string
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ id = undefined, checked, onCheckedChange, label, description, className = "" }) => {
    const { colors } = useTheme()

    return (
        <View className={`flex flex-row items-start gap-3 ${className}`}>
            <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
            <View className="flex-1 gap-2">
                <Label style={{ color: colors.foreground }} className="text-foreground" onPress={() => onCheckedChange(!checked)}>
                    {label}
                </Label>
                {description && <Text style={{ color: colors.mutedForeground }} className="text-muted-foreground text-sm">{description}</Text>}
            </View>
        </View>
    )
}

export default CustomCheckbox
