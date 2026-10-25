import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import BodymojiView from './src/components/BodymojiView';
import Customizer from './src/components/Customizer';
import { defaultConfig, randomConfig, countOptions } from './src/core/catalog';

const OPTION_COUNT = countOptions();

export default function App() {
  const [config, setConfig] = useState(() => defaultConfig('male'));

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Bodymoji</Text>
            <Text style={styles.subtitle}>{OPTION_COUNT} body options · drag to spin</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.btn} onPress={() => setConfig(defaultConfig(config.gender))}>
              <Text style={styles.btnText}>Reset</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => setConfig(randomConfig(config.gender))}>
              <Text style={[styles.btnText, { color: '#fff' }]}>Shuffle</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stage}>
          <View style={styles.glow} />
          <BodymojiView config={config} />
        </View>

        <View style={styles.editor}>
          <Customizer config={config} onChange={setConfig} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0f1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 4 },
  title: { color: '#f2f4ff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#8d93ad', fontSize: 12, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#1f2336' },
  btnPrimary: { backgroundColor: '#7c8cff' },
  btnText: { color: '#e6e9f5', fontWeight: '700', fontSize: 13 },
  stage: { flex: 1.15, ...(Platform.OS === 'web' ? { cursor: 'grab' } : null) },
  glow: {
    position: 'absolute', alignSelf: 'center', top: '8%', width: '85%', aspectRatio: 1, borderRadius: 9999,
    backgroundColor: '#2a3160', opacity: 0.55,
  },
  editor: { flex: 1 },
});
