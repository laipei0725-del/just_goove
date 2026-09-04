import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, ZenKakuGothicNew_500Medium, ZenKakuGothicNew_700Bold } from '@expo-google-fonts/zen-kaku-gothic-new';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import HomeScreen from './src/screens/HomeScreen';
import PracticeScreen from './src/screens/PracticeScreen';
import { ProjectProvider } from './src/store/ProjectContext';

const Stack = createNativeStackNavigator();
const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#0D0D0D', card: '#0D0D0D', text: '#F4F4F2', border: '#262626', primary: '#C8FF35' },
};

export default function App() {
  const [fontsLoaded] = useFonts(Platform.OS === 'web' ? {} : {
    'ZenGothic-Medium': ZenKakuGothicNew_500Medium,
    'ZenGothic-Bold': ZenKakuGothicNew_700Bold,
    JetBrainsMono: JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#F4F4F2', fontSize: 24, fontWeight: '800' }}>JUST GROOVE</Text><ActivityIndicator color="#C8FF35" style={{ marginTop: 20 }} /></View>;
  }

  return (
    <SafeAreaProvider>
      <ProjectProvider>
        <NavigationContainer theme={theme}>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0D' } }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Practice" component={PracticeScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </ProjectProvider>
    </SafeAreaProvider>
  );
}
