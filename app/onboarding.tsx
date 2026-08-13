import { useConsentStore } from '@/src/stores/useConsentStore';
import { clearInterestProfile } from '@/src/db/repositories/userEventRepository';
import { Button, Card, Checkbox, Icon, Switch, Text } from '@/src/ui';
import { onboardingEnter, useReducedMotionPreference } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import { notification, toggle, NotificationFeedbackType } from '@/src/utils/haptics';
import { router } from 'expo-router';
import React from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEP_COUNT = 4;

export default function OnboardingScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const reduced = useReducedMotionPreference();
    const [step, setStep] = React.useState(0);
    const [agreementsChecked, setAgreementsChecked] = React.useState(false);
    const aiEnabled = useConsentStore((state) => state.aiInterestAnalysisEnabled);
    const setAiEnabled = useConsentStore((state) => state.setAiInterestAnalysisEnabled);
    const acceptAgreements = useConsentStore((state) => state.acceptRequiredAgreements);
    const completeOnboarding = useConsentStore((state) => state.completeOnboarding);
    const entrance = useSharedValue(1);

    React.useEffect(() => {
        entrance.value = 0;
        entrance.value = reduced ? 1 : withSpring(1, onboardingEnter);
    }, [entrance, reduced, step]);

    React.useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step > 0) setStep((current) => current - 1);
            return true;
        });
        return () => subscription.remove();
    }, [step]);

    const contentStyle = useAnimatedStyle(() => ({
        opacity: entrance.value,
        transform: [{ translateY: reduced ? 0 : (1 - entrance.value) * 18 }],
    }));

    const next = () => {
        if (step === 1) {
            if (!agreementsChecked) return;
            acceptAgreements();
        }
        if (step < STEP_COUNT - 1) setStep((current) => current + 1);
    };

    const finish = async () => {
        if (!aiEnabled) {
            try {
                await clearInterestProfile();
            } catch (error) {
                console.warn('清理旧兴趣画像失败，将在存储管理中保留重试入口', error);
            }
        }
        completeOnboarding();
        notification(NotificationFeedbackType.Success);
        router.replace('/(tabs)');
    };

    const setAnalysis = (enabled: boolean) => {
        setAiEnabled(enabled);
        toggle();
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
            <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md, gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {step > 0 ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="返回上一步" hitSlop={12} onPress={() => setStep((current) => current - 1)}>
                            <Icon name="arrow-left" size={26} color={theme.colors.onBackground} />
                        </Pressable>
                    ) : <View style={{ width: 26 }} />}
                    <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>{step + 1} / {STEP_COUNT}</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: theme.colors.secondary }}>
                    <Animated.View
                        style={{
                            height: 4,
                            borderRadius: 2,
                            width: `${((step + 1) / STEP_COUNT) * 100}%`,
                            backgroundColor: theme.colors.primary,
                        }}
                    />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xl }}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View key={step} style={[{ flex: 1 }, contentStyle]}>
                    {step === 0 && <WelcomeStep />}
                    {step === 1 && <AgreementStep checked={agreementsChecked} onChange={setAgreementsChecked} />}
                    {step === 2 && <AiStep enabled={aiEnabled} onChange={setAnalysis} />}
                    {step === 3 && <CompleteStep />}
                </Animated.View>

                <View style={{ marginTop: theme.spacing.xl, paddingBottom: insets.bottom }}>
                    <Button
                        type="primary"
                        disabled={step === 1 && !agreementsChecked}
                        onPress={step === STEP_COUNT - 1 ? () => void finish() : next}
                        style={{ minHeight: 54, borderRadius: 18 }}
                    >
                        {step === 0 ? '开始设置' : step === STEP_COUNT - 1 ? '开始使用' : '继续'}
                    </Button>
                </View>
            </ScrollView>
        </View>
    );
}

function BrandMark({ icon = 'newspaper-variant-outline' }: { icon?: 'newspaper-variant-outline' | 'shield-check-outline' | 'brain' | 'check-bold' }) {
    const theme = useTheme();
    return (
        <View style={{ width: 104, height: 104, borderRadius: 34, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={50} color={theme.colors.onPrimary} />
        </View>
    );
}

function WelcomeStep() {
    const theme = useTheme();
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl }}>
            <BrandMark />
            <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
                <Text type="title1" weight="bold" align="center">欢迎使用 NewHU</Text>
                <Text type="body1" align="center" color={theme.colors.onSurfaceSecondary} style={{ lineHeight: 25 }}>
                    更专注的内容浏览、离线阅读与本地数据管理。
                </Text>
            </View>
        </View>
    );
}

function AgreementStep({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    const theme = useTheme();
    return (
        <View style={{ gap: theme.spacing.xl }}>
            <BrandMark icon="shield-check-outline" />
            <View style={{ gap: theme.spacing.sm }}>
                <Text type="title1" weight="bold">隐私与协议</Text>
                <Text type="body1" color={theme.colors.onSurfaceSecondary} style={{ lineHeight: 25 }}>请先了解应用会在设备上保存哪些数据，再决定是否继续。</Text>
            </View>
            <Card feedback="none" contentStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
                <LegalLink title="隐私政策" summary="本地数据、联网请求与控制权" type="privacy" />
                <View style={{ height: 1, backgroundColor: theme.colors.dividerLine }} />
                <LegalLink title="用户协议" summary="服务规则、账号与离线内容" type="terms" />
            </Card>
            <Pressable onPress={() => onChange(!checked)} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
                <Checkbox value={checked} onValueChange={onChange} accessibilityLabel="我已阅读并同意隐私政策和用户协议" />
                <Text type="body1" style={{ flex: 1, lineHeight: 24 }}>我已阅读并同意《隐私政策》和《用户协议》</Text>
            </Pressable>
        </View>
    );
}

function LegalLink({ title, summary, type }: { title: string; summary: string; type: 'privacy' | 'terms' }) {
    const theme = useTheme();
    return (
        <Pressable onPress={() => router.push({ pathname: '/legal', params: { type } })} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
                <Text type="headline1" weight="medium">{title}</Text>
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>{summary}</Text>
            </View>
            <Icon name="chevron-right" color={theme.colors.onSurfaceVariantActions} />
        </Pressable>
    );
}

function AiStep({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
    const theme = useTheme();
    const facts = [
        ['cellphone-lock', '只在设备本地完成'],
        ['toggle-switch-outline', '可随时关闭'],
        ['delete-outline', '可以删除兴趣画像'],
        ['book-open-page-variant-outline', '不开启也不影响基础阅读'],
    ] as const;
    return (
        <View style={{ gap: theme.spacing.xl }}>
            <BrandMark icon="brain" />
            <View style={{ gap: theme.spacing.sm }}>
                <Text type="title1" weight="bold">本地 AI 兴趣分析</Text>
                <Text type="body1" color={theme.colors.onSurfaceSecondary} style={{ lineHeight: 25 }}>这是可选功能，默认关闭。开启后，当前版本只在本机记录你打开过哪些文章或回答。</Text>
            </View>
            <Card feedback="none" contentStyle={{ overflow: 'hidden' }}>
                <Pressable onPress={() => onChange(!enabled)} style={{ padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text type="headline1" weight="bold">允许本地分析</Text>
                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>不上传兴趣画像</Text>
                    </View>
                    <Switch value={enabled} interactive={false} />
                </Pressable>
            </Card>
            <View style={{ gap: theme.spacing.md }}>
                {facts.map(([icon, label]) => (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <Icon name={icon} size={22} color={theme.colors.primary} />
                        <Text type="body1">{label}</Text>
                    </View>
                ))}
            </View>
            <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ lineHeight: 20 }}>当前不会使用停留时间、搜索词、评论内容、点赞或收藏。</Text>
        </View>
    );
}

function CompleteStep() {
    const theme = useTheme();
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl }}>
            <BrandMark icon="check-bold" />
            <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
                <Text type="title1" weight="bold" align="center">设置完成</Text>
                <Text type="body1" align="center" color={theme.colors.onSurfaceSecondary} style={{ lineHeight: 25 }}>
                    以后可以在“设置 → 隐私与个性化”修改本地 AI 选项或清除兴趣画像。
                </Text>
            </View>
        </View>
    );
}
