import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import AuthNavigator from './navigation/AuthNavigator';
import {
  setupNotificationHandler,
  requestNotificationPermissions,
  storeNotification,
} from './services/notificationService';
import { requestLocationPermissions } from './services/locationService';

setupNotificationHandler();

const App = () => {
  useEffect(() => {
    requestNotificationPermissions().catch(() => {});
    requestLocationPermissions().catch(() => {});

    // Store notifications received while app is foregrounded
    const receivedSub = Notifications.addNotificationReceivedListener(storeNotification);

    // Store notifications the user taps from background / killed state
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => storeNotification(response.notification),
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthNavigator />
    </GestureHandlerRootView>
  );
};

export default App;
