import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, HelperText, Text, TextInput} from 'react-native-paper';
import {authApi} from '@/api/auth';
import {useAuthStore} from '@/store/authStore';
import {getDeviceId} from '@/utils/device';

export default function RegisterScreen() {
  const setSession = useAuthStore(s => s.setSession);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRegister = async () => {
    const trimmedMobile = mobile.trim();
    if (!trimmedMobile) {
      setError('Mobile number is required.');
      return;
    }
    if (!/^[0-9+\-\s()]{7,20}$/.test(trimmedMobile)) {
      setError('Please enter a valid mobile number.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      const {user, token} = await authApi.register({
        name: name.trim(),
        email: email.trim(),
        mobile: trimmedMobile,
        password,
        deviceId,
      });
      await setSession(user, token);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Create Account
      </Text>
      <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        label="Mobile Number"
        value={mobile}
        onChangeText={setMobile}
        keyboardType="phone-pad"
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
      <Button mode="contained" onPress={onRegister} loading={loading} style={styles.button}>
        Sign Up
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 24, justifyContent: 'center'},
  title: {textAlign: 'center', fontWeight: '700', marginBottom: 16},
  input: {marginBottom: 12},
  button: {marginTop: 8, borderRadius: 10},
});
