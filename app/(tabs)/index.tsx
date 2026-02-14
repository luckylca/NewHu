import React from 'react';
import { Dimensions, View } from 'react-native';
import { Text } from 'react-native-paper';

const { width: WindowWidth } = Dimensions.get('window');

const HomeScreen = ({ navigation }: any) => {
    return (
        <View style={{ marginTop: WindowWidth * 0.1, flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333', margin: 16 }}>欢迎！</Text>
        </View>
    );
}
export default HomeScreen;