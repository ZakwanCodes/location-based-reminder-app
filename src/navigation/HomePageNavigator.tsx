import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import RemindersScreen from '../screens/reminders';
import MapScreen from '../screens/map';
import NotificationsScreen from '../screens/notifications';
import ProfileScreen from '../screens/profile';

export type HomeTabParamList = {
  Reminders: { expandPast?: boolean } | undefined;
  Map: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HomeTabParamList>();

const HomePageNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<keyof HomeTabParamList, keyof typeof MaterialIcons.glyphMap> = {
            Reminders: 'notifications-active',
            Map: 'map',
            Notifications: 'notifications',
            Profile: 'person',
          };
          return <MaterialIcons name={icons[route.name as keyof HomeTabParamList]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#4B5563',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarStyle: {
          backgroundColor: '#0D1117',
          borderTopColor: '#21262D',
          borderTopWidth: 1,
          paddingTop: 6,
        },
      })}
    >
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default HomePageNavigator;
