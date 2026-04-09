import React, { useState } from 'react';
import LoginScreen from './pages/login';
import RegisterScreen from './pages/register';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  if (currentScreen === 'register') {
    return <RegisterScreen onNavigateToLogin={() => setCurrentScreen('login')} />;
  }

  return <LoginScreen onNavigateToRegister={() => setCurrentScreen('register')} />;
};

export default App;

