import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function SplashScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    const t = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }, 900);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image source={require('../assets/logo.png')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0c', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 128, height: 128, borderRadius: 24 },
});


