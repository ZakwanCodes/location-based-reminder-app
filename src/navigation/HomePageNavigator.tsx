import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import RemindersScreen from '../pages/reminders';
import MapScreen from '../pages/map';
import NotificationsScreen from '../pages/notifications';
import ProfileScreen from '../pages/profile';

export type HomeTabParamList = {
  Reminders: undefined;
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
        tabBarActiveTintColor: '#456FE8',
        tabBarInactiveTintColor: '#9d9d9d',
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
