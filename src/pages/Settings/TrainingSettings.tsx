import React from "react"
import { View, Text, StyleSheet } from "react-native"

const TrainingSettings = () => {
    return (
        <View style={styles.root}>
            <Text style={styles.title}>Training Settings</Text>
            <Text style={styles.subtitle}>Here you can customize the settings for Training.</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: "gray",
        textAlign: "center",
    },
})

export default TrainingSettings
