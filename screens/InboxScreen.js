import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

/*
 * The old Inbox (private messages received) now lives in Chat, which has the
 * full conversations, replies and photos. Links to /notifications land there.
 */
export default function InboxScreen() {
  const navigation = useNavigation();
  useEffect(() => { navigation.replace('Chat'); }, [navigation]);
  return null;
}
