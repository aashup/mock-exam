import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Text, TextInput, HelperText} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {authApi} from '@/api/auth';
import {useAuthStore} from '@/store/authStore';
import {RestoreService} from '@/services/RestoreService';
import {getDeviceId} from '@/utils/device';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const setSession = useAuthStore(s => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const onLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      const {user, token} = await authApi.login(trimmedEmail, password, deviceId);
      await setSession(user, token);

      // Fresh device? Pull the full account dataset from the server.
      await RestoreService.restoreIfFreshDevice(pct => setRestoring(pct));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
      setRestoring(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Exam Practice
      </Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Sign in to continue
      </Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {error && <HelperText type="error">{error}</HelperText>}
      {restoring != null && (
        <HelperText type="info">Restoring your data… {restoring}%</HelperText>
      )}

      <Button
        mode="contained"
        onPress={onLogin}
        loading={loading}
        style={styles.button}
        labelStyle={styles.buttonLabel}>
        Log In
      </Button>
      <Button onPress={() => navigation.navigate('Register')}>Create an account</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 24, justifyContent: 'center'},
  title: {textAlign: 'center', fontWeight: '700'},
  sub: {textAlign: 'center', opacity: 0.7, marginBottom: 24},
  input: {marginBottom: 12},
  button: {marginTop: 8, borderRadius: 10},
  buttonLabel: {letterSpacing: 0, paddingHorizontal: 8},
});
