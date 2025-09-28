import React, { useState, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, LayoutChangeEvent, ViewStyle } from "react-native"
import DragList, { DragListRenderItemInfo } from "react-native-draglist"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"
import { Text as UIText } from "../ui/text"
import { useTheme } from "../../context/ThemeContext"
import { GripVertical } from "lucide-react-native"

interface PriorityItem {
    id: string
    label: string
    description?: string | null
}

interface DraggablePriorityListProps {
    items: PriorityItem[]
    selectedItems: string[]
    onSelectionChange: (selectedItems: string[]) => void
    onOrderChange: (orderedItems: string[]) => void
    className?: string
    style?: ViewStyle
}

const DraggablePriorityList: React.FC<DraggablePriorityListProps> = ({ items, selectedItems, onSelectionChange, onOrderChange, className = "", style }) => {
    const { colors, isDark } = useTheme()

    const [orderedItems, setOrderedItems] = useState<string[]>(items.map((item) => item.id))
    const dragOrderRef = useRef<string[]>([]) // Track drag order separately
    const dragListRef = useRef<any>(null)

    const [contentHeight, setContentHeight] = useState(0)
    const [containerHeight, setContainerHeight] = useState(0)

    const handleContainerLayout = (event: LayoutChangeEvent) => {
        setContainerHeight(event.nativeEvent.layout.height)
    }

    const handleContentSizeChange = (width: number, height: number) => {
        setContentHeight(height)
    }

    // Sync orderedItems with selectedItems when selection changes.
    useEffect(() => {
        if (selectedItems.length === 0) {
            setOrderedItems(items.map((item) => item.id))
            dragOrderRef.current = [] // Clear drag order
            return
        }

        // Always preserve existing order when possible.
        if (orderedItems.length > 0) {
            // Get items that are currently in the list and are still selected.
            const existingSelectedInOrder = orderedItems.filter((id) => selectedItems.includes(id))

            // Get newly selected items that weren't in the current list.
            const newlySelected = selectedItems.filter((id) => !orderedItems.includes(id))

            // Get deselected items that should remain visible.
            const deselectedItems = items.map((item) => item.id).filter((id) => !selectedItems.includes(id))

            // Combine: existing selected items in their current order + newly selected + deselected.
            const finalOrdered = [...existingSelectedInOrder, ...newlySelected, ...deselectedItems]
            setOrderedItems(finalOrdered)

            // Update drag order ref with the selected items in their new order.
            const selectedInNewOrder = finalOrdered.filter((id) => selectedItems.includes(id))
            dragOrderRef.current = selectedInNewOrder
        } else {
            // No existing order, create default order.
            const deselectedItems = items.map((item) => item.id).filter((id) => !selectedItems.includes(id))
            const finalOrdered = [...selectedItems, ...deselectedItems]
            setOrderedItems(finalOrdered)
            dragOrderRef.current = selectedItems
        }
    }, [selectedItems, items]) // Only depend on selection changes

    const handleReordered = async (fromIndex: number, toIndex: number) => {
        const copy = [...orderedItems]
        const [removed] = copy.splice(fromIndex, 1)
        copy.splice(toIndex, 0, removed)

        setOrderedItems(copy)

        // Update the drag order ref with only the selected items in their new order.
        const selectedInNewOrder = copy.filter((id) => selectedItems.includes(id))
        dragOrderRef.current = selectedInNewOrder

        onOrderChange(selectedInNewOrder)
    }

    const toggleItem = (itemId: string) => {
        const newSelection = selectedItems.includes(itemId) ? selectedItems.filter((id) => id !== itemId) : [...selectedItems, itemId]

        onSelectionChange(newSelection)
    }

    const scrollToTop = () => {
        if (dragListRef.current && dragListRef.current.scrollToIndex) {
            dragListRef.current.scrollToIndex({ index: 0, animated: true })
        }
    }

    const scrollToBottom = () => {
        if (dragListRef.current && dragListRef.current.scrollToIndex) {
            const lastIndex = orderedItems.length - 1
            dragListRef.current.scrollToIndex({ index: lastIndex, animated: true })
        }
    }

    const renderItem = (info: DragListRenderItemInfo<PriorityItem>) => {
        const { item, onDragStart, onDragEnd } = info
        const isSelected = selectedItems.includes(item.id)
        const priorityNumber = isSelected ? orderedItems.indexOf(item.id) + 1 : null

        return (
            <View key={item.id} style={{ marginVertical: 1 }} className={`mb-2 ${className}`}>
                <TouchableOpacity
                    style={{ justifyContent: "space-between", backgroundColor: colors.input }}
                    activeOpacity={0.7}
                    className="flex flex-row items-center gap-2 border border-border rounded-lg p-2"
                    onPressIn={isSelected ? onDragStart : undefined}
                    onPressOut={isSelected ? onDragEnd : undefined}
                >
                    <View style={{ flex: 1, flexDirection: "row", gap: 10 }}>
                        {/* Priority Number - smaller size */}
                        {isSelected && (
                            <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
                                <Text style={{ color: isDark ? "white" : "black" }}>{priorityNumber}</Text>
                            </View>
                        )}

                        {/* Checkbox - keep same size */}
                        <Checkbox id={`priority-${item.id}`} checked={isSelected} onCheckedChange={() => toggleItem(item.id)} />

                        {/* Content - tighter spacing */}
                        <View className="flex-1 gap-1">
                            <Label style={{ color: colors.foreground }} className="text-sm" onPress={() => toggleItem(item.id)}>
                                {item.label}
                            </Label>
                            {item.description && <UIText className="text-muted-foreground text-xs">{item.description}</UIText>}
                        </View>
                    </View>

                    {!isSelected && <View className="w-8" />}

                    {/* Drag Handle - smaller and more compact */}
                    {isSelected && (
                        <View className="p-1">
                            <GripVertical size={18} color={colors.primary} />
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <View style={style}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, paddingBottom: 10 }}>Drag items to reorder. Top to bottom = highest to lowest priority.</Text>

            {/* Always show the DragList, regardless of selection state */}
            <View>
                <DragList
                    ref={dragListRef}
                    data={orderedItems.map((id) => items.find((item) => item.id === id)!).filter(Boolean)}
                    keyExtractor={(item) => item.id}
                    onReordered={handleReordered}
                    renderItem={renderItem}
                    style={{ height: 200 }}
                    onLayout={handleContainerLayout}
                    onContentSizeChange={handleContentSizeChange}
                    showsVerticalScrollIndicator={false}
                />

                {/* Scroll helper buttons for very long lists */}
                {contentHeight > containerHeight && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                        <TouchableOpacity style={{ borderColor: colors.primary }} className="px-3 py-1 border rounded" onPress={scrollToTop}>
                            <Text style={{ color: colors.foreground }} className="text-xs">
                                ↑ Scroll Up
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ borderColor: colors.primary }} className="px-3 py-1 border rounded" onPress={scrollToBottom}>
                            <Text style={{ color: colors.foreground }} className="text-xs">
                                ↓ Scroll Down
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Show message below the list when no items are selected */}
            {selectedItems.length === 0 && <Text style={{ fontSize: 12, color: colors.mutedForeground, paddingTop: 10 }}>No stats selected. Select stats to set priority order.</Text>}
        </View>
    )
}

export default DraggablePriorityList
