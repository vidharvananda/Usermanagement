import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UsersScreen from './screens/UsersScreen';
import BooksScreen from './screens/BooksScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Users">
        <Stack.Screen name="Users" component={UsersScreen} />
        <Stack.Screen name="Books" component={BooksScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
