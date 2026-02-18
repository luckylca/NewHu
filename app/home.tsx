import React from 'react';
import { Dimensions, ScrollView, View } from 'react-native';
import { Card, Text,TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {PeopleInfo, SimpleAnswer, SimpleArticle, FeedType, Answer, Article, FeedItemInfo} from '@/src/types/zhihu';

const { width: WindowWidth } = Dimensions.get('window');



interface RenderItem {
    question: string;
    question_author: string;
    description: string;
}



const renderItem = (item:any,type:string) => {

    const title = type === 'answer' ? (item as SimpleAnswer).question.title : (item as SimpleArticle).title;
    const excerpt = type === 'answer' ? (item as SimpleAnswer).excerpt : (item as SimpleArticle).excerpt;
    const voteup_count = type === 'answer' ? (item as SimpleAnswer).voteup_count : (item as SimpleArticle).voteup_count;
    const favorite_count = type === 'answer' ? (item as SimpleAnswer).favorite_count : (item as SimpleArticle).favorite_count;
    const comment_count = type === 'answer' ? (item as SimpleAnswer).comment_count : (item as SimpleArticle).comment_count;

    return (
        <Card            
            mode="contained"
            style={{ width: WindowWidth * 0.9, marginBottom: 20, padding: 10 }}
        >
            <Card.Title title={title} />
            <Card.Content>
                <Text>{excerpt}</Text>
                <Text>点赞数: {voteup_count}, 收藏数: {favorite_count}, 评论数: {comment_count}</Text>
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