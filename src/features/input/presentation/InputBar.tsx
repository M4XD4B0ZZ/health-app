import React, { useState } from "react"
import { View, TextInput, Button } from "react-native"
import { parseInput } from "../application/parseInput"

export const InputBar: React.FC = () => {
  const [value, setValue] = useState("")

  const handleSubmit = () => {
    const result = parseInput(value)
    console.log("PARSED RESULT:", result)
  }

  return (
    <View>
      <TextInput
        placeholder="Was hast du gegessen?"
        value={value}
        onChangeText={setValue}
      />
      <Button title="Loggen" onPress={handleSubmit} />
    </View>
  )
}
