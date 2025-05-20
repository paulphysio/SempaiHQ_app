// ./screens/NovelSummaryScreen.js
import React from 'react';
import { View, Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { styles } from '../styles/NovelPageStyles';

const NovelSummaryScreen = () => {
  const route = useRoute();
  const { id } = route.params;

  return (
    <View style={styles.page}>
      <Text style={styles.novelTitle}>Summary for Novel {id}</Text>
      <Text style={styles.novelIntro}>Novel summary goes here...</Text>
    </View>
  );
};

export default NovelSummaryScreen;