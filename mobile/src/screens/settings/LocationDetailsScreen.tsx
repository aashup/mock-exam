import React, { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import axios from 'axios';
import { Card, Text } from 'react-native-paper';
import { LocationRecord, locationRepo } from '@/db/repositories/locationRepo';

// Define an extended type to hold the resolved address string locally
type LocationWithAddress = LocationRecord & {
  address?: string;
};

export default function LocationDetailsScreen() {
  const [locations, setLocations] = useState<LocationWithAddress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper delay function to respect Nominatim's 1-request-per-second rule
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const locationsData = await locationRepo.getRecentLocations();

        const enhancedLocations: LocationWithAddress[] = [];

        // Fetch addresses sequentially to avoid getting banned (403) by Nominatim
        for (const loc of locationsData) {
          try {
            const response = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json`,
              {
                headers: {
                  // CRITICAL: Change this string to identify your unique application
                  'User-Agent': 'MyReactNativeApp/1.0 (contact@yourdomain.com)',
                }
              }
            );
            enhancedLocations.push({
              ...loc,
              address: response.data.display_name || 'Address not found',
            });
          } catch (apiError) {
            console.error('Error fetching address for location ID:', loc.id, apiError);
            enhancedLocations.push({ ...loc, address: 'Address unavailable' });
          }
          // Wait 1 second before querying the next item to honor the API terms of service
          await delay(1000);
        }

        setLocations(enhancedLocations);
      } catch (err) {
        console.error('Database load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Optimized renderItem handling static state values safely
  const renderItem = useCallback(({ item }: { item: LocationWithAddress }) => {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" style={styles.subtle}>
              {item.address || 'Resolving address...'}
            </Text>
            <Text variant="bodySmall">
              S: {item.location_source}, B: {item.battery_level}, A: {item.accuracy}, V: {item.speed}, D: {item.recorded_at}
            </Text>

          </View>
        </Card.Content>
      </Card>
    );
  }, []);

  return (
    <View style={styles.container}>
      {!loading ? (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
        />
      ) : (
        <Text>Resolving addresses from coordinates...</Text>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 14, marginBottom: 16 },
  heading: { fontWeight: '700', marginBottom: 8 },
  bigStat: { fontWeight: '800' },
  subtle: { opacity: 0.8 },
  statRow: { paddingVertical: 8, borderBottomWidth: 0.1, borderBottomColor: '#ccc' },
});