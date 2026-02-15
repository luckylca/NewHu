import React from 'react';
import { Dimensions, ScrollView, View } from 'react-native';
import { Card, Text,TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: WindowWidth } = Dimensions.get('window');



interface RenderItem {
    question: string;
    question_author: string;
    description: string;
}



const renderItem = (item:any) => {




    return (
        <Card            
            mode="contained"
            style={{ width: WindowWidth * 0.9, marginBottom: 20, padding: 10 }}
        >
            <Card.Title title={item.question} />
            <Card.Content>
                <Text>{item.description}</Text>
            </Card.Content>
        </Card>
    );
};


const HomeScreen = ({ navigation }: any) => {

    const insets = useSafeAreaInsets();

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center',marginTop: insets.top }}>
            <TextInput
                label="搜索"
                mode="flat"
                style={{ width: '90%', marginBottom: 20,borderRadius: 5 }}
                left={<TextInput.Icon icon="magnify" />}
            />




        </ScrollView>
    );
}
export default HomeScreen;