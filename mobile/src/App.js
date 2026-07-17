import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppState } from 'react-native';
import WalletScreen from './screens/WalletScreen';
import DEXScreen from './screens/DEXScreen';
import StakingScreen from './screens/StakingScreen';
import BridgeScreen from './screens/BridgeScreen';
import GovernanceScreen from './screens/GovernanceScreen';
import ReceiveScreen from './screens/ReceiveScreen';
import SendScreen from './screens/SendScreen';
import HistoryScreen from './screens/HistoryScreen';
import AddressBookScreen from './screens/AddressBookScreen';
import SettingsScreen from './screens/SettingsScreen';
import WIFRScreen from './screens/WIFRScreen';
import QuestsScreen from './screens/QuestsScreen';
import StablecoinScreen from './screens/StablecoinScreen';
import TokensScreen from './screens/TokensScreen';
import IdentityScreen from './screens/IdentityScreen';
import LocksScreen from './screens/LocksScreen';
import TwoWayVaultScreen from './screens/TwoWayVaultScreen';
import SwapRouteScreen from './screens/SwapRouteScreen';
import StabilityPoolScreen from './screens/StabilityPoolScreen';
import ProtocolScreen from './screens/ProtocolScreen';
import AppLock from './components/AppLock';
import { COLORS } from './theme';
import { markBackground } from './services/secure';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.copper },
        tabBarActiveTintColor: COLORS.amber,
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarLabelStyle: { fontFamily: 'Inter-Regular', fontSize: 11 },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Wallet: 'wallet',
            DEX: 'swap-horizontal',
            Stake: 'bank',
            Bridge: 'bridge',
            Governance: 'vote',
          };
          return <MaterialCommunityIcons name={icons[route.name] || 'circle'} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="DEX" component={DEXScreen} />
      <Tab.Screen name="Stake" component={StakingScreen} />
      <Tab.Screen name="Bridge" component={BridgeScreen} />
      <Tab.Screen name="Governance" component={GovernanceScreen} />
      <Tab.Screen name="WIFR" component={WIFRScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  // Auto-lock: record background time so AppLock can gate on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') markBackground();
    });
    return () => sub.remove();
  }, []);

  return (
    <AppLock>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Receive" component={ReceiveScreen} />
          <Stack.Screen name="Send" component={SendScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="AddressBook" component={AddressBookScreen} />
          <Stack.Screen name="WIFR" component={WIFRScreen} />
          <Stack.Screen name="Quests" component={QuestsScreen} />
          <Stack.Screen name="Stablecoin" component={StablecoinScreen} />
          <Stack.Screen name="Tokens" component={TokensScreen} />
          <Stack.Screen name="Identity" component={IdentityScreen} />
          <Stack.Screen name="Locks" component={LocksScreen} />
          <Stack.Screen name="TwoWayVault" component={TwoWayVaultScreen} />
          <Stack.Screen name="SwapRoute" component={SwapRouteScreen} />
          <Stack.Screen name="StabilityPool" component={StabilityPoolScreen} />
          <Stack.Screen name="Protocol" component={ProtocolScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppLock>
  );
}
