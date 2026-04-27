import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import {
    searchPlaces,
    type LocationSearchResult,
    type ReminderLocation,
} from '../services/locationService';

type LocationSearchModalProps = {
    visible: boolean;
    onConfirm: (loc: ReminderLocation) => void;
    onClose: () => void;
};

/**
 * Modal UI for searching places and returning a confirmed location for reminders.
 */
function LocationSearchModal({ visible, onConfirm, onClose }: LocationSearchModalProps) {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<LocationSearchResult[]>([]);
    const [selected, setSelected] = useState<LocationSearchResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!visible) {
            setQuery('');
            setResults([]);
            setSelected(null);
            setError('');
        }
    }, [visible]);

    /** Searches remote places by query and updates selection candidates. */
    const handleSearch = async () => {
        if (!query.trim()) return;
        Keyboard.dismiss();
        setSearching(true);
        setError('');
        setResults([]);
        setSelected(null);
        try {
            const found = await searchPlaces(query.trim());
            if (!found.length) {
                setError('No results found. Try a more specific search.');
                return;
            }
            setResults(found);
        } catch {
            setError('Search failed. Check your connection and try again.');
        } finally {
            setSearching(false);
        }
    };

    /** Converts the selected result into reminder location payload and confirms selection. */
    const handleConfirm = () => {
        if (!selected) return;
        const shortAddress = selected.displayName.split(',').slice(0, 3).join(',').trim();
        onConfirm({
            latitude: selected.latitude,
            longitude: selected.longitude,
            radius: 200,
            address: shortAddress,
        });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Search a Place</Text>

                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Walmart Toronto"
                            placeholderTextColor="#4B5563"
                            value={query}
                            onChangeText={(t) => {
                                setQuery(t);
                                setError('');
                                setResults([]);
                                setSelected(null);
                            }}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                            autoFocus
                        />
                        <TouchableOpacity
                            onPress={handleSearch}
                            style={[styles.searchBtn, searching && { opacity: 0.6 }]}
                            disabled={searching}
                        >
                            {searching ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.searchBtnText}>Go</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {!!error && <Text style={styles.error}>{error}</Text>}

                    {results.length > 0 && (
                        <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled">
                            {results.map((r, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[styles.resultItem, selected === r && styles.resultItemSelected]}
                                    onPress={() => setSelected(r)}
                                >
                                    <Text
                                        style={[styles.resultText, selected === r && styles.resultTextSelected]}
                                        numberOfLines={2}
                                    >
                                        {r.displayName}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {selected && (
                        <MapView
                            style={styles.map}
                            region={{
                                latitude: selected.latitude,
                                longitude: selected.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                        >
                            <Marker coordinate={{ latitude: selected.latitude, longitude: selected.longitude }} />
                        </MapView>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleConfirm}
                            style={[styles.confirmBtn, !selected && { opacity: 0.4 }]}
                            disabled={!selected}
                        >
                            <Text style={styles.confirmText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default LocationSearchModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#161B22',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#21262D',
        padding: 20,
        width: 320,
    },
    title: { fontSize: 17, fontWeight: '700', color: '#E6EDF3', marginBottom: 14 },
    inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#21262D',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        backgroundColor: '#0D1117',
        color: '#E6EDF3',
    },
    searchBtn: {
        backgroundColor: '#6366F1',
        borderRadius: 10,
        paddingHorizontal: 14,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 44,
    },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    error: { fontSize: 12, color: '#EF4444', marginBottom: 8 },
    resultsList: { maxHeight: 160, marginBottom: 8 },
    resultItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#21262D',
    },
    resultItemSelected: { backgroundColor: 'rgba(99,102,241,0.12)' },
    resultText: { fontSize: 13, color: '#8B949E' },
    resultTextSelected: { color: '#818CF8', fontWeight: '600' },
    map: { height: 160, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
    cancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
    cancelText: { color: '#8B949E', fontWeight: '600' },
    confirmBtn: {
        backgroundColor: '#6366F1',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 20,
        minWidth: 80,
        alignItems: 'center',
    },
    confirmText: { color: '#fff', fontWeight: '700' },
});
