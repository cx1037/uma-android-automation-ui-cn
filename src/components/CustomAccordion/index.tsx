import React from "react"
import { Text, StyleSheet, ViewStyle } from "react-native"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"
import { useTheme } from "../../context/ThemeContext"

interface AccordionSection {
    value: string
    title: string
    children: React.ReactNode
}

interface CustomAccordionProps {
    sections: AccordionSection[]
    type?: "single" | "multiple"
    defaultValue?: string[]
    className?: string
    style?: ViewStyle
}

const CustomAccordion: React.FC<CustomAccordionProps> = ({ sections, type = "single", defaultValue = [], className, style }) => {
    const { colors } = useTheme()

    const styles = StyleSheet.create({
        sectionTitle: {
            fontSize: 16,
            fontWeight: "600",
            color: colors.foreground,
            marginBottom: 0,
        },
    })

    return (
        <Accordion type={type} defaultValue={defaultValue} className={className} style={style}>
            {sections.map((section) => (
                <AccordionItem key={section.value} value={section.value}>
                    <AccordionTrigger>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                    </AccordionTrigger>
                    <AccordionContent>{section.children}</AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}

export default CustomAccordion
