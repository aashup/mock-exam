import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Image, Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card, Text, Button, ActivityIndicator, Divider,  } from 'react-native-paper';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { api } from '@/api/client';

export default function ScannerScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- 1. Pick from Gallery ---
  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // Lets the user crop the text area
      base64: true,        // CRITICAL: Required for AI OCR APIs
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      processImageWithAI(result.assets[0].base64, result.assets[0].uri);
    }
  };

  // --- 2. Take a Photo with Camera ---
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, // Lets the user crop the text area
      base64: true,        // CRITICAL: Required for AI OCR APIs
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      processImageWithAI(result.assets[0].base64);
    }
  };

  // --- 3. Send Base64 to AI OCR ---
  const processImageWithAI = async (base64String: string | null | undefined, uri: string | undefined) => {
    if (!base64String) return;
    setIsLoading(true);
    setExtractedText('');
    setInputText('');
    try {
      // TODO: Replace this block with your actual AI API Call (OpenAI/Gemini)
      // Example using a simulated delay:
      // await new Promise(resolve => setTimeout(resolve, 2000));
      // 2. Run local ML Kit OCR specifying the Devanagari script
      if (uri) {
        const ocrResult = await TextRecognition.recognize(uri, TextRecognitionScript.DEVANAGARI);
        setInputText(ocrResult.text);
        setExtractedText(ocrResult.text);
      }
      // setExtractedText(simulatedAiResponse);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to extract text from the image.');
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    // 1. Define an internal async function
    const analyzeTextData = async () => {
      try {
        const response = await api.post('analyze-text', {
          rawText: extractedText
        });
        const aiData = response.data;

        // Show the structured JSON on screen
        setInputText(inputText + "\n\n" + JSON.stringify(aiData, null, 2));

      } catch (error) {
        console.error("API Error during analysis:", error);
        Alert.alert("Error", "API Error");
      } finally {
        setIsLoading(false);
      }
    };

    // 2. Call the function immediately
    if (extractedText) {
      analyzeTextData();
    }
  }, [extractedText]);

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Controls Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.heading}>
            Scan Text
          </Text>
          <Text variant="bodySmall" style={styles.subtle}>
            Take a picture of the Devanagari text or upload from your gallery to extract it.
          </Text>

          <View style={styles.buttonRow}>
            <Button
              icon="camera"
              mode="contained"
              onPress={takePhoto}
              style={styles.actionButton}
              disabled={isLoading}
            >
              Camera
            </Button>
            <Button
              icon="image"
              mode="outlined"
              onPress={pickFromGallery}
              style={styles.actionButton}
              disabled={isLoading}
            >
              Gallery
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Image Preview */}
      {imageUri && (
        <Card style={styles.card}>
          <Card.Content style={styles.centerContent}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          </Card.Content>
        </Card>
      )}

      {/* Results Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.heading}>
            JSON Text
          </Text>
          <Divider style={styles.divider} />

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          )}
          <View>
            <TextInput
              multiline={true}
              numberOfLines={10}
              value={inputText}
              onChangeText={(text) => setInputText(text)}
              
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                padding: 10,
                marginBottom: 15,
                height: 200,             // Sets a explicit height
                textAlignVertical: 'top' // CRITICAL FOR ANDROID: Aligns text to the top
              }}
            />
          </View>
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              // onPress={takePhoto}
              style={styles.actionButton}
              disabled={isLoading}
            >
              Process Text
            </Button>
          </View>
        </Card.Content>
      </Card>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 14, marginBottom: 16 },
  heading: { fontWeight: '700', marginBottom: 8 },
  subtle: { opacity: 0.6, marginBottom: 16 },
  divider: { marginVertical: 12 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionButton: { flex: 1, borderRadius: 8 },
  centerContent: { alignItems: 'center' },
  previewImage: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
  loadingContainer: { alignItems: 'center', paddingVertical: 24 },
  resultText: { fontWeight: '500', lineHeight: 24 },
});