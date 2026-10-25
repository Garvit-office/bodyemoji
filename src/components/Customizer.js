import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  BODY_TYPES, GENDERS, SKIN_TONES, CLOTH_COLORS, SOCKS, categoriesFor, outfitsFor, defaultConfig,
} from '../core/catalog';

const tap = () => { Haptics.selectionAsync().catch(() => {}); };

function Chip({ label, hint, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.75 }]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      {!!hint && <Text style={[styles.chipHint, active && styles.chipHintActive]} numberOfLines={1}>{hint}</Text>}
    </Pressable>
  );
}

function Swatches({ title, colors, value, onPick }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.swatchRow}>
        {colors.map((c) => (
          <Pressable key={c.id} onPress={() => onPick(c.hex)} accessibilityLabel={c.label}
            style={[styles.swatchRing, value === c.hex && styles.swatchRingActive]}>
            <View style={[styles.swatch, { backgroundColor: c.hex }]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Tabbed editor for every body / outfit option. */
export default function Customizer({ config, onChange }) {
  const g = config.gender;
  const tabs = useMemo(() => [
    { key: 'bodyType', label: 'Body type', icon: '◍' },
    ...categoriesFor(g).map((c) => ({ key: c.key, label: c.label, icon: c.icon })),
    { key: 'outfit', label: 'Outfit', icon: '👕' },
    { key: 'colors', label: 'Colours', icon: '🎨' },
  ], [g]);
  const [tab, setTab] = useState('bodyType');
  const active = tabs.find((t) => t.key === tab) ? tab : 'bodyType';

  const set = (patch) => { tap(); onChange({ ...config, ...patch }); };

  const setGender = (gender) => {
    if (gender === g) return;
    tap();
    // keep shared choices (pose, height…) but reset gender-specific ones
    const next = defaultConfig(gender);
    for (const k of ['pose', 'posture', 'height', 'legShape', 'legLength', 'skin', 'shoes', 'socks']) next[k] = config[k];
    onChange(next);
  };

  let body;
  if (active === 'bodyType') {
    body = (
      <View style={styles.grid}>
        {BODY_TYPES[g].map((b) => (
          <Chip key={b.id} label={b.label} hint={b.hint} active={config.bodyType === b.id}
            onPress={() => {
              // picking a body type resets the detail overrides back to "Match body"
              const patch = { bodyType: b.id };
              for (const cat of categoriesFor(g)) if (cat.options[0].id === 'auto') patch[cat.key] = 'auto';
              set(patch);
            }} />
        ))}
      </View>
    );
  } else if (active === 'outfit') {
    body = (
      <View>
        <View style={styles.grid}>
          {outfitsFor(g).map((o) => (
            <Chip key={o.id} label={o.label} hint={o.hint} active={config.outfit === o.id} onPress={() => set({ outfit: o.id })} />
          ))}
        </View>
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Feet</Text>
        <View style={styles.grid}>
          {SOCKS.map((o) => (
            <Chip key={o.id} label={o.label} active={config.socks === o.id} onPress={() => set({ socks: o.id })} />
          ))}
        </View>
      </View>
    );
  } else if (active === 'colors') {
    body = (
      <View>
        <Swatches title="Skin tone" colors={SKIN_TONES} value={config.skin} onPick={(hex) => set({ skin: hex })} />
        <Swatches title="Top" colors={CLOTH_COLORS} value={config.top} onPick={(hex) => set({ top: hex })} />
        <Swatches title="Bottoms" colors={CLOTH_COLORS} value={config.bottom} onPick={(hex) => set({ bottom: hex })} />
        <Swatches title="Socks" colors={CLOTH_COLORS} value={config.shoes} onPick={(hex) => set({ shoes: hex })} />
      </View>
    );
  } else {
    const cat = categoriesFor(g).find((c) => c.key === active);
    body = (
      <View style={styles.grid}>
        {cat.options.map((o) => (
          <Chip key={o.id} label={o.label} hint={o.hint} active={config[cat.key] === o.id} onPress={() => set({ [cat.key]: o.id })} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.segment}>
        {GENDERS.map((x) => (
          <Pressable key={x.id} onPress={() => setGender(x.id)} style={[styles.segBtn, g === x.id && styles.segBtnActive]}>
            <Text style={[styles.segText, g === x.id && styles.segTextActive]}>{x.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => { tap(); setTab(t.key); }} style={[styles.tab, active === t.key && styles.tabActive]}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabText, active === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>{body}</ScrollView>
    </View>
  );
}

const C = {
  panel: '#151827', card: '#1f2336', cardActive: '#e8ecff', text: '#e6e9f5', dim: '#8d93ad', accent: '#7c8cff',
};

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: C.panel, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 14 },
  segment: { flexDirection: 'row', alignSelf: 'center', backgroundColor: C.card, borderRadius: 999, padding: 4, marginBottom: 10 },
  segBtn: { paddingVertical: 7, paddingHorizontal: 26, borderRadius: 999 },
  segBtnActive: { backgroundColor: C.accent },
  segText: { color: C.dim, fontWeight: '700', fontSize: 13 },
  segTextActive: { color: '#fff' },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { alignItems: 'center', paddingHorizontal: 12, gap: 8, paddingBottom: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'transparent' },
  tabActive: { backgroundColor: C.card },
  tabIcon: { fontSize: 13, color: C.text },
  tabText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: C.text },
  body: { padding: 14, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: '30%', flexGrow: 1, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.card },
  chipActive: { backgroundColor: C.cardActive },
  chipLabel: { color: C.text, fontWeight: '700', fontSize: 14 },
  chipLabelActive: { color: '#151827' },
  chipHint: { color: C.dim, fontSize: 11, marginTop: 2 },
  chipHintActive: { color: '#4b5270' },
  sectionTitle: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchRing: { padding: 3, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  swatchRingActive: { borderColor: C.accent },
  swatch: { width: 30, height: 30, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
});
