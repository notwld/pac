import 'react-native-gesture-handler';
import React, { useMemo } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import AnimeInfoScreen from './screens/AnimeInfoScreen';
import EpisodesScreen from './screens/EpisodesScreen';
import PlayerScreen from './screens/PlayerScreen';
import AnimeListScreen from './screens/AnimeListScreen';
import { MAL_CLIENT_ID as ENV_MAL_CLIENT_ID } from '@env';
import { configureMalClient } from './api/mal';

const Stack = createNativeStackNavigator();

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  const navTheme: Theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#0b0b0c',
      card: '#0f0f10',
      text: '#f1f5f9',
      border: '#1f2937',
      primary: '#a3e635',
      notification: '#22d3ee',
    },
  };

  const malClientId = ENV_MAL_CLIENT_ID ?? '';
  if (malClientId) {
    try {
      configureMalClient(String(malClientId));
    } catch {}
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={navTheme}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f10" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#0f0f10' },
            headerTitleStyle: { color: '#f1f5f9' },
            headerTintColor: '#a3e635',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'PAC' }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search Anime' }} />
          <Stack.Screen name="List" component={AnimeListScreen} options={{ title: 'All' }} />
          <Stack.Screen name="Info" component={AnimeInfoScreen} options={{ title: 'Details' }} />
          <Stack.Screen name="Episodes" component={EpisodesScreen} options={{ title: 'Episodes' }} />
          <Stack.Screen name="Player" component={PlayerScreen} options={{ title: 'Player' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}