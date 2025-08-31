import React, { useState, useRef, useEffect } from "react"
import { View, Text, StyleSheet, Animated, LayoutChangeEvent } from "react-native"
import Slider from "@react-native-community/slider"
import { useTheme } from "../../context/ThemeContext"

interface CustomSliderProps {
    value: number
    onValueChange: (value: number) => void
    min: number
    max: number
    step: number
    label?: string
    labelUnit?: string
    showValue?: boolean
    showLabels?: boolean
}

const CustomSlider: React.FC<CustomSliderProps> = ({ value, onValueChange, min, max, step, label, labelUnit = "", showValue = true, showLabels = true }) => {
    const { colors } = useTheme()
    const [isDragging, setIsDragging] = useState(false)
    const [sliderWidth, setSliderWidth] = useState(0)
    const [tooltipPosition, setTooltipPosition] = useState(0)
    const thumbScale = useRef(new Animated.Value(1)).current
    const tooltipOpacity = useRef(new Animated.Value(0)).current

    const styles = StyleSheet.create({
        container: {
            marginVertical: 16,
        },
        label: {
            fontSize: 16,
            fontWeight: "600",
            color: colors.foreground,
            marginBottom: 12,
        },
        sliderContainer: {
            marginHorizontal: 20,
            position: "relative",
        },
        valueContainer: {
            alignItems: "center",
            marginTop: 8,
            flexDirection: "row",
            justifyContent: "space-between",
            marginHorizontal: 20,
        },
        valueText: {
            fontSize: 18,
            fontWeight: "600",
            color: colors.foreground,
        },
        labelText: {
            fontSize: 12,
            color: colors.primary,
        },
        customThumb: {
            position: "absolute",
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.primary,
            zIndex: 1,
            top: 10, // Position it in the middle of the slider height
        },
        tooltip: {
            position: "absolute",
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 6,
            top: -45,
            transform: [{ translateX: -20 }],
            zIndex: 50,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
        },
        tooltipText: {
            color: colors.background,
            fontSize: 12,
            fontWeight: "600",
            textAlign: "center",
        },
    })

    const calculateTooltipPosition = (currentValue: number) => {
        if (sliderWidth === 0) return 0
        const percentage = (currentValue - min) / (max - min)
        return percentage * sliderWidth
    }

    // Initialize tooltip position when component mounts or value changes
    useEffect(() => {
        if (sliderWidth > 0) {
            const position = calculateTooltipPosition(value)
            setTooltipPosition(position)
        }
    }, [sliderWidth, value, min, max])

    const handleSlidingStart = (sliderValue: number) => {
        setIsDragging(true)
        Animated.parallel([
            Animated.timing(thumbScale, {
                toValue: 1.3,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(tooltipOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start()

        const position = calculateTooltipPosition(sliderValue)
        setTooltipPosition(position)
    }

    const handleSlidingComplete = () => {
        setIsDragging(false)
        Animated.parallel([
            Animated.timing(thumbScale, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(tooltipOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start()
    }

    const handleValueChange = (sliderValue: number) => {
        onValueChange(sliderValue)
        if (isDragging) {
            const position = calculateTooltipPosition(sliderValue)
            setTooltipPosition(position)
        }
    }

    const handleLayout = (event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout
        setSliderWidth(width)
    }

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View style={styles.sliderContainer} onLayout={handleLayout}>
                {/* Custom tooltip */}
                <Animated.View
                    style={[
                        styles.tooltip,
                        {
                            opacity: tooltipOpacity,
                            left: tooltipPosition,
                        },
                    ]}
                    pointerEvents="none"
                >
                    <Text style={styles.tooltipText}>{value}%</Text>
                </Animated.View>

                {/* Custom thumb overlay for scaling effect */}
                <Animated.View
                    style={[
                        styles.customThumb,
                        {
                            transform: [{ scale: thumbScale }],
                            left: tooltipPosition - 10, // Center the thumb overlay
                        },
                    ]}
                    pointerEvents="none"
                />

                {/* Slider with hidden default thumb */}
                <Slider
                    style={{ width: "100%", height: 40 }}
                    value={value}
                    onValueChange={handleValueChange}
                    onSlidingStart={handleSlidingStart}
                    onSlidingComplete={handleSlidingComplete}
                    minimumValue={min}
                    maximumValue={max}
                    step={step}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor="transparent" // Hide the default thumb
                />
            </View>

            {showValue && (
                <View style={styles.valueContainer}>
                    <Text style={styles.labelText}>{showLabels ? min + labelUnit : ""}</Text>
                    <Text style={styles.valueText}>
                        {value}
                        {labelUnit}
                    </Text>
                    <Text style={styles.labelText}>{showLabels ? max + labelUnit : ""}</Text>
                </View>
            )}

            {/* {showLabels && (
                <View style={styles.labelsContainer}>
                    <Text style={styles.labelText}>{min}%</Text>
                    <Text style={styles.labelText}>{max}%</Text>
                </View>
            )} */}
        </View>
    )
}

export default CustomSlider
