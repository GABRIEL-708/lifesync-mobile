import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GeoFix } from '../machines/PermissionStateMachine';

/**
 * Versión web del mapa (react-native-maps no soporta web):
 * incrusta OpenStreetMap con un marcador en la ubicación real del navegador.
 */
export default function LocationMap({ fix }: { fix: GeoFix }) {
  const d = 0.004;
  const bbox = `${fix.lng - d},${fix.lat - d},${fix.lng + d},${fix.lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${fix.lat},${fix.lng}`;

  return (
    <View style={styles.container}>
      {createElement('iframe', {
        src,
        title: 'Mapa de ubicación',
        style: { border: 0, width: '100%', height: '100%' },
      })}
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
