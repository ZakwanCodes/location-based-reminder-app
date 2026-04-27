import React, { useEffect } from 'react';
import AuthNavigator from './navigation/AuthNavigator';
import { setupNotificationHandler, requestNotificationPermissions } from './services/notificationService';
import { requestLocationPermissions } from './services/locationService';

setupNotificationHandler();

const App = () => {
  useEffect(() => {
    requestNotificationPermissions();
    requestLocationPermissions();
  }, []);

  return <AuthNavigator />;
};

export default App;
