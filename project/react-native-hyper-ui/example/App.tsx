import React from 'react';
import { Button, Card, ThemeProvider } from 'react-native-hyper-ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider theme="hyperos" mode="system">
        <SafeAreaView style={{ flex: 1, padding: 24 }}>
          <Card><Button type="primary" onPress={() => {}}>开始阅读</Button></Card>
        </SafeAreaView>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
