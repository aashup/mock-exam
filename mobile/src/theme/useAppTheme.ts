import {useColorScheme} from 'react-native';
import {MD3DarkTheme, MD3LightTheme, type MD3Theme} from 'react-native-paper';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  type Theme as NavTheme,
} from '@react-navigation/native';
import {useSettingsStore} from '@/store/settingsStore';

interface AppTheme {
  dark: boolean;
  paperTheme: MD3Theme;
  navTheme: NavTheme;
}

/**
 * Resolves the active Paper + React Navigation themes from the user's saved
 * preference. `system` follows the OS light/dark setting via useColorScheme().
 */
export function useAppTheme(): AppTheme {
  const themeMode = useSettingsStore(s => s.themeMode);
  const systemScheme = useColorScheme();

  const dark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

  return {
    dark,
    paperTheme: dark ? MD3DarkTheme : MD3LightTheme,
    navTheme: dark ? NavDarkTheme : NavLightTheme,
  };
}
