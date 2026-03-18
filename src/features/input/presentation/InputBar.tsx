import React, { useState } from "react"
import { View, TextInput, Button, Text, ActivityIndicator } from "react-native"
import { logResolvedNutritionInput } from "../application/logResolvedNutritionInput"

export const InputBar: React.FC = () => {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [unresolvedItems, setUnresolvedItems] = useState<string[]>([])
  const [recognizedItems, setRecognizedItems] = useState<{name: string; quantity: number | null; unit: string | null}[]>([])

  const handleSubmit = async () => {
  if (!value.trim()) return
  setLoading(true)
  setSuccessMessage("")
  setErrorMessage("")
  setUnresolvedCount(0)
  setUnresolvedItems([])

  try {
  const result = await logResolvedNutritionInput(value)
      const persistedCount = result.persistedEntries.length
      const unresolved = result.dispatch.unresolvedRequests.length

      if (persistedCount > 0) {
    if (unresolved > 0) {
      setSuccessMessage(`${persistedCount} Eintrag${persistedCount > 1 ? "e" : ""} gespeichert, ${unresolved} nicht erkannt`)
    } else {
      setSuccessMessage(`${persistedCount} Eintrag${persistedCount > 1 ? "e" : ""} gespeichert`)
    }
    setValue("")
      } else {
    setErrorMessage("Eintrag konnte nicht verarbeitet werden")
      }

      // Set unresolved items for rendering
      setUnresolvedItems(result.dispatch.unresolvedRequests.map(req => req.rawName))
      // Set recognized items from parsed input
      setRecognizedItems(result.dispatch.parsed.items)

      // Dish detection hint
      if (result.interpretation.type === "dish") {
      const dishName = result.interpretation.summary === "dish_detected" ? value.trim() : "Gericht erkannt"
      setSuccessMessage(`Gericht erkannt: ${dishName}`)
      }
    } catch (e) {
      setErrorMessage("Eintrag konnte nicht verarbeitet werden")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (text: string) => {
    setValue(text)
    if (successMessage || errorMessage) {
      setSuccessMessage("")
      setErrorMessage("")
      setUnresolvedCount(0)
    }
  }

  const handleEditRecognizedItem = (item: {name: string; quantity: number | null; unit: string | null}) => {
    let text = ""
    if (item.quantity !== null) {
      text += item.quantity.toString()
      if (item.unit) {
        text += item.unit + " "
      } else {
        text += " "
      }
    }
    text += item.name
    setValue(text)
  }

  return (
    <View>
      <TextInput
        placeholder="Was hast du gegessen?"
        value={value}
        onChangeText={handleChange}
        editable={!loading}
      />
      <Button title={loading ? "Lädt..." : "Loggen"} onPress={handleSubmit} disabled={loading} />

      {loading && <ActivityIndicator size="small" style={{ marginTop: 8 }} />}

      {!!successMessage && !loading && (
        <Text style={{ color: "green", marginTop: 8 }}>{successMessage}</Text>
      )}

      {!!errorMessage && !loading && (
        <Text style={{ color: "red", marginTop: 8 }}>{errorMessage}</Text>
      )}

      {/* Recognized items list with quantity and unit */}
      {recognizedItems.length > 0 && !loading && (
        <>
          <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Erkannt:</Text>
          {recognizedItems.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 12, flex: 1 }}>
                {item.name} {item.quantity !== null ? `— ${item.quantity}` : ''} {item.unit ?? ''}
              </Text>
              <Button
                title="Bearbeiten"
                onPress={() => handleEditRecognizedItem(item)}
                disabled={loading}
              />
            </View>
          ))}
        </>
      )}

      {/* Unresolved items list and correction button */}
      {unresolvedItems.length > 0 && !loading && (
        <>
          <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Nicht erkannt:</Text>
          {unresolvedItems.map((item, index) => (
            <Text key={index} style={{ color: 'red', fontSize: 12 }}>
              {item} — nicht erkannt
            </Text>
          ))}
          <Button
            title="In Eingabe übernehmen"
            onPress={() => setValue(unresolvedItems.join(' '))}
            disabled={loading}
          />
        </>
      )}
    </View>
  )
}
