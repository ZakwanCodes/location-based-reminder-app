import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const RemindersScreen = () => {
  return (
    <View style={styles.container}>
      <Text>Reminders</Text>
    </View>
  );
};

export default RemindersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
