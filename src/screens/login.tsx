import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Keyboard, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { loginUser } from '../services/authService';
import { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage('');
    const result = await loginUser(email, password);
    if (result.success) {
      navigation.navigate('Homepage');
    } else {
      setErrorMessage(result.error || 'Login failed');
    }
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.logoArea}>
            <View style={styles.iconRing}>
              <MaterialIcons name="notifications-active" size={34} color="#6366F1" />
            </View>
            <Text style={styles.appName}>Remindify</Text>
            <Text style={styles.tagline}>Never forget what matters</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="mail" size={18} color="#6366F1" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Email address"
                placeholderTextColor="#4B5563"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={18} color="#6366F1" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Password"
                placeholderTextColor="#4B5563"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                secureTextEntry={!isPasswordVisible}
              />
              <TouchableOpacity onPress={() => setIsPasswordVisible(v => !v)}>
                <MaterialIcons
                  name={isPasswordVisible ? 'visibility' : 'visibility-off'}
                  size={18}
                  color="#4B5563"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.signUpRow} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signUpText}>
                Don{"'"}t have an account?{'  '}
                <Text style={styles.signUpLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>

            {!!errorMessage && (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={14} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1117' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  iconRing: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: 36, fontWeight: '800', color: '#E6EDF3', letterSpacing: 0.5 },
  tagline: { fontSize: 13, color: '#8B949E', marginTop: 6, letterSpacing: 0.3 },
  card: {
    backgroundColor: '#161B22', borderRadius: 18,
    borderWidth: 1, borderColor: '#21262D', padding: 24,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#E6EDF3', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#8B949E', marginBottom: 24 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#21262D',
    borderRadius: 10, paddingHorizontal: 12, marginBottom: 14,
  },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, paddingVertical: 14, color: '#E6EDF3', fontSize: 14 },
  signUpRow: { alignItems: 'flex-end', marginBottom: 20 },
  signUpText: { fontSize: 13, color: '#8B949E' },
  signUpLink: { color: '#6366F1', fontWeight: '700' },
  loginButton: {
    backgroundColor: '#6366F1', borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.55 },
  loginButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 14,
  },
  errorText: { fontSize: 13, color: '#EF4444', flex: 1 },
});
