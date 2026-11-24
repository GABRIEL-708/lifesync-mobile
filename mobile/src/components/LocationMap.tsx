import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { GeoFix } from '../machines/PermissionStateMachine';

/**
 * Mapa nativo (Apple Maps en iOS / Google Maps en Android) que muestra la
 * ubicación REAL del dispositivo con un marcador y el círculo de precisión.
 */
export default function LocationMap({ fix }: { fix: GeoFix }) {
  const region = {
    latitude: fix.lat,
    longitude: fix.lng,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
        showsUserLocation
        showsCompass
        showsScale
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{ latitude: fix.lat, longitude: fix.lng }}
          title="Ubicación del paciente"
          description={`${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}`}
          pinColor="#e11d48"
        />
        {fix.accuracy != null && (
          <Circle
            center={{ latitude: fix.lat, longitude: fix.lng }}
            radius={fix.accuracy}
            strokeColor="rgba(79, 70, 229, 0.6)"
            fillColor="rgba(79, 70, 229, 0.15)"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
});
