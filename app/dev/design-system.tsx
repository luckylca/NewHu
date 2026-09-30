import { BottomSheet, Button, Card, Checkbox, Dialog, GlassMaterialProvider, GlassSurface, Icon, Input, ListRow, Menu, NavigationBar, NumberWheel, PageScaffold, PageScrollView, PreferenceGroup, ProgressIndicator, SearchBar, SegmentedControl, Slider, Snackbar, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { ThemeProvider, liquidGlassDarkTheme, liquidGlassLightTheme, useTheme } from '@/src/ui/theme';
import { GlassAppearanceProvider, GlassTabBar } from '@newhu/react-native-liquid-glass';
import type { GlassQuality } from '@newhu/react-native-liquid-glass';
import { MotionProvider } from '@/src/ui/motion';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

/**
 * UI Showcase — the single page where every Design System component is
 * exercised in every state (Normal / Pressed / Disabled / Selected / Unselected)
 * against the live theme. The visual target is miuix (HyperOS), not Material.
 */

function Section({ title, children, onLayout }: { title: string; children: ReactNode; onLayout?: (event: LayoutChangeEvent) => void }) {
    const theme = useTheme();
    return (
        <View onLayout={onLayout} style={{ marginBottom: 24 }}>
            <Text type="title4" weight="medium" color={theme.colors.onSurfaceVariantActions} style={{ marginBottom: 8, paddingHorizontal: 16 }}>
                {title}
            </Text>
            {children}
        </View>
    );
}

function Swatch({ name, value }: { name: string; value: string }) {
    const theme = useTheme();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: value, borderWidth: 1, borderColor: theme.colors.dividerLine }} />
            <View style={{ flex: 1 }}>
                <Text type="body2" weight="medium">{name}</Text>
                <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>{value}</Text>
            </View>
        </View>
    );
}

function PreviewOptionButton({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    const theme = useTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={{
                minHeight: 42,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: selected ? theme.colors.primary : theme.colors.outline,
                backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceContainer,
            }}
        >
            <Text type="body2" weight="medium" color={selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface}>
                {label}
            </Text>
        </Pressable>
    );
}

export default function DesignSystemShowcase() {
    const appTheme = useTheme();
    const [dark, setDark] = useState(appTheme.dark);
    const [quality, setQuality] = useState<GlassQuality>('balanced');
    const [reducedMotion, setReducedMotion] = useState(false);
    const previewTheme = dark ? liquidGlassDarkTheme : liquidGlassLightTheme;

    return (
        <ThemeProvider value={previewTheme}>
            <GlassAppearanceProvider
                tokens={{ ...previewTheme.glass, quality }}
                dark={dark}
                reducedMotion={reducedMotion}
            >
                <MotionProvider reduced={reducedMotion}>
                    <DesignSystemShowcaseContent
                        dark={dark}
                        quality={quality}
                        reducedMotion={reducedMotion}
                        onDarkChange={setDark}
                        onQualityChange={setQuality}
                        onReducedMotionChange={setReducedMotion}
                    />
                </MotionProvider>
            </GlassAppearanceProvider>
        </ThemeProvider>
    );
}

function DesignSystemShowcaseContent({
    dark,
    quality,
    reducedMotion,
    onDarkChange,
    onQualityChange,
    onReducedMotionChange,
}: {
    dark: boolean;
    quality: GlassQuality;
    reducedMotion: boolean;
    onDarkChange: (dark: boolean) => void;
    onQualityChange: (quality: GlassQuality) => void;
    onReducedMotionChange: (reduced: boolean) => void;
}) {
    const theme = useTheme();

    // component states
    const [switchOn, setSwitchOn] = useState(true);
    const [checkboxOn, setCheckboxOn] = useState(true);
    const [seg, setSeg] = useState(1);
    const [sliderValue, setSliderValue] = useState(40);
    const [wheelValue, setWheelValue] = useState(25);
    const [progress, setProgress] = useState(64);
    const [progressAnimating, setProgressAnimating] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [snackVisible, setSnackVisible] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [navIndex, setNavIndex] = useState(0);
    // Menu anchoring
    const menuRef = useRef<View>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
    const [glassShifted, setGlassShifted] = useState(false);
    const [glassRenderMode, setGlassRenderMode] = useState<'local' | 'backdrop'>('backdrop');

    const openMenuFrom = (ref: React.RefObject<View | null>) => {
        ref.current?.measureInWindow((x, y, width, height) => {
            setMenuAnchor({ x, y, width, height });
            setMenuVisible(true);
        });
    };
    const openMenu = () => openMenuFrom(menuRef);

    return (
        <PageScaffold topBar={<TopAppBar title="UI Showcase" back={() => router.back()} />}>
            <PageScrollView contentContainerStyle={{ paddingBottom: 48 }}>
                <Section title="Liquid Glass Preview Settings">
                    <View style={{ paddingHorizontal: 16, gap: 10 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            <PreviewOptionButton label="Light" selected={!dark} onPress={() => onDarkChange(false)} />
                            <PreviewOptionButton label="Dark" selected={dark} onPress={() => onDarkChange(true)} />
                            <PreviewOptionButton
                                label={reducedMotion ? 'Reduce Motion On' : 'Reduce Motion Off'}
                                selected={reducedMotion}
                                onPress={() => onReducedMotionChange(!reducedMotion)}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {(['balanced', 'high', 'fallback'] as const).map((mode) => (
                                <PreviewOptionButton
                                    key={mode}
                                    label={mode}
                                    selected={quality === mode}
                                    onPress={() => onQualityChange(mode)}
                                />
                            ))}
                        </View>
                        <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>
                            {dark ? 'Dark' : 'Light'} · {quality} · Reduce Motion {reducedMotion ? 'On' : 'Off'}
                        </Text>
                    </View>
                </Section>

                <Section title="Liquid Glass · local / live backdrop renderer">
                    <GlassMaterialProvider
                        tokens={{ ...theme.glass, quality }}
                        dark={dark}
                        reducedMotion={reducedMotion}
                        style={{ marginHorizontal: 16, height: 232, borderRadius: 24, overflow: 'hidden' }}
                    >
                    <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.colors.surfaceContainerHighest }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'stretch' }}>
                            {['#E95858', '#E99538', '#E0C33C', '#3DAB80', '#319BB7', '#526DD1', '#9162C9', '#D45F9C'].map((color, index) => (
                                <View key={index} style={{ width: 76, padding: 6, gap: 8, justifyContent: 'space-between', backgroundColor: color }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text type="headline2" weight="bold" color="#FFFFFF">{index + 1}</Text>
                                        <Text type="footnote2" color="#FFFFFF">GLASS</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', height: 32, alignItems: 'stretch' }}>
                                        {Array.from({ length: 12 }, (_, cell) => (
                                            <View key={cell} style={{ flex: 1, backgroundColor: cell % 2 ? '#FFFFFF' : '#102030' }} />
                                        ))}
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                                        {Array.from({ length: 9 }, (_, cell) => (
                                            <View key={cell} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: cell % 2 ? '#FFFFFF' : '#102030' }} />
                                        ))}
                                        <Text type="footnote2" color="#FFFFFF">R{index + 1}</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        <GlassSurface
                            variant="floating"
                            positioning="floating"
                            sampling={glassRenderMode}
                            interactive
                            style={{ position: 'absolute', left: glassShifted ? 132 : 18, top: 18, width: 196, height: 126, borderRadius: 24 }}
                            placeholderChildren={<View style={{ width: 196, height: 126 }} />}
                        >
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Liquid Glass material preview"
                                style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}
                            >
                                <Text type="headline1" weight="medium" color={theme.colors.onGlass}>Liquid Glass</Text>
                                <Text type="footnote1" color={theme.colors.onGlassSecondary}>Skia shader · 局部光学 · 边缘高光</Text>
                            </Pressable>
                        </GlassSurface>
                    </View>
                    </GlassMaterialProvider>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 }}>
                        <Button onPress={() => setGlassShifted((shifted) => !shifted)}>移动玻璃</Button>
                        <Button onPress={() => setGlassRenderMode((mode) => mode === 'local' ? 'backdrop' : 'local')}>
                            {glassRenderMode === 'local' ? '切到 Backdrop' : '切到 Local'}
                        </Button>
                    </View>
                </Section>

                <Section title="Liquid Glass SearchBar · SegmentedControl">
                    <View style={{ paddingHorizontal: 16, gap: 12 }}>
                        <SearchBar
                            label="搜索知乎内容"
                            onPress={() => {}}
                            inputProps={{ editable: false, showSoftInputOnFocus: false }}
                        />
                        <SegmentedControl
                            tabs={['普通模式', '滑动模式', '瀑布流']}
                            selected={seg}
                            onSelect={setSeg}
                        />
                    </View>
                </Section>

                <Section title="Apple-style Liquid Glass TabBar · selection / preview lens">
                    <View style={{ height: 180, marginHorizontal: 16, borderRadius: 24, overflow: 'visible', backgroundColor: theme.colors.surfaceContainerHighest }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'stretch' }}>
                            {['#D44D4D', '#E3A433', '#3A9D79', '#426CCB', '#995FBA'].map((color, index) => (
                                <View key={index} style={{ width: 88, backgroundColor: color }} />
                            ))}
                        </ScrollView>
                        <GlassTabBar
                            items={[{ label: '首页' }, { label: '我的' }]}
                            selected={navIndex}
                            bottomInset={0}
                            shellBackgroundColor={theme.colors.surfaceContainerHigh}
                            onSelect={setNavIndex}
                            renderIcon={(_, index, selected) => (
                                <Icon
                                    name={index === 0 ? 'home' : 'account'}
                                    size={24}
                                    color={selected ? theme.colors.primary : theme.colors.onSurfaceContainer}
                                />
                            )}
                        />
                    </View>
                </Section>

                {/* Colors */}
                <Section title="Colors">
                    <View style={{ paddingHorizontal: 16 }}>
                        <Swatch name="primary" value={theme.colors.primary} />
                        <Swatch name="onPrimary" value={theme.colors.onPrimary} />
                        <Swatch name="onGlass" value={theme.colors.onGlass} />
                        <Swatch name="onGlassSecondary" value={theme.colors.onGlassSecondary} />
                        <Swatch name="secondaryVariant" value={theme.colors.secondaryVariant} />
                        <Swatch name="background" value={theme.colors.background} />
                        <Swatch name="surface" value={theme.colors.surface} />
                        <Swatch name="surfaceContainer" value={theme.colors.surfaceContainer} />
                        <Swatch name="surfaceContainerHigh" value={theme.colors.surfaceContainerHigh} />
                        <Swatch name="dividerLine" value={theme.colors.dividerLine} />
                        <Swatch name="onSurfaceVariantSummary" value={theme.colors.onSurfaceVariantSummary} />
                        <Swatch name="error" value={theme.colors.error} />
                    </View>
                </Section>

                {/* Typography */}
                <Section title="Typography">
                    <View style={{ paddingHorizontal: 16, gap: 6 }}>
                        <Text type="title1">title1 · 32</Text>
                        <Text type="title2">title2 · 24</Text>
                        <Text type="title3" weight="medium">title3 · 20 · medium</Text>
                        <Text type="title4" weight="medium">title4 · 18 · medium</Text>
                        <Text type="headline1" weight="medium">headline1 · 17 · medium</Text>
                        <Text type="body1">body1 · 16</Text>
                        <Text type="body2">body2 · 14</Text>
                        <Text type="footnote1">footnote1 · 13</Text>
                        <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>footnote2 · 11 · summary</Text>
                        <Text type="subtitle">subtitle · 14 · bold</Text>
                    </View>
                </Section>

                {/* Button */}
                <Section title="Button">
                    <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        <Button type="primary" onPress={() => {}}>主要按钮</Button>
                        <Button onPress={() => {}}>默认按钮</Button>
                        <Button type="primary" disabled onPress={() => {}}>禁用</Button>
                        <Button disabled onPress={() => {}}>禁用</Button>
                    </View>
                </Section>

                {/* Card */}
                <Section title="Card · HyperOS solid / Liquid Glass local material">
                    <View style={{ paddingHorizontal: 16, gap: 12 }}>
                        <Card feedback="sink" onPress={() => {}}>
                            <View style={{ padding: 16 }}>
                                <Text type="headline1" weight="medium" color={theme.colors.onSurfaceContainer}>sink 卡片</Text>
                                <Text type="body2" color={theme.colors.onSurfaceContainerVariant}>按下缩放 0.94 · folmeSpring(0.8, 600)</Text>
                            </View>
                        </Card>
                        <Card feedback="tilt" onPress={() => {}}>
                            <View style={{ padding: 16 }}>
                                <Text type="headline1" weight="medium" color={theme.colors.onSurfaceContainer}>tilt 卡片</Text>
                                <Text type="body2" color={theme.colors.onSurfaceContainerVariant}>按点支点倾斜约 13° · folmeSpring(0.6, 400)</Text>
                            </View>
                        </Card>
                        <Card feedback="none">
                            <View style={{ padding: 16 }}>
                                <Text type="body2" color={theme.colors.onSurfaceContainerVariant}>none —— 纯容器，无反馈</Text>
                            </View>
                        </Card>
                    </View>
                </Section>

                {/* Switch */}
                <Section title="Switch">
                    <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                        <Switch value={switchOn} onValueChange={setSwitchOn} />
                        <Switch value={!switchOn} onValueChange={() => {}} />
                        <Switch value disabled />
                        <Switch value={false} disabled />
                    </View>
                </Section>

                {/* Checkbox */}
                <Section title="Checkbox">
                    <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                        <Checkbox value={checkboxOn} onValueChange={setCheckboxOn} accessibilityLabel="启用复选框" />
                        <Checkbox value={false} onValueChange={() => {}} accessibilityLabel="未选中复选框" />
                        <Checkbox value disabled accessibilityLabel="禁用复选框" />
                    </View>
                </Section>

                {/* Slider / Progress */}
                <Section title="Slider">
                    <View style={{ paddingHorizontal: 16, gap: 12 }}>
                        <Slider
                            value={sliderValue}
                            minimumValue={0}
                            maximumValue={100}
                            step={5}
                            showKeyPoints
                            onValueChange={setSliderValue}
                            accessibilityLabel="展示用滑块"
                        />
                        <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>当前值：{sliderValue}</Text>
                    </View>
                </Section>

                <Section title="ProgressIndicator">
                    <View style={{ paddingHorizontal: 16, gap: 16 }}>
                        <ProgressIndicator progress={progress / 100} />
                        <ProgressIndicator indeterminate={progressAnimating} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>确定进度 {progress}%</Text>
                            <Button onPress={() => setProgress((value) => value >= 100 ? 0 : value + 10)}>推进</Button>
                            <Button onPress={() => setProgressAnimating((value) => !value)}>{progressAnimating ? '停止动画' : '启动动画'}</Button>
                        </View>
                    </View>
                </Section>

                {/* NumberWheel */}
                <Section title="NumberWheel">
                    <View style={{ paddingHorizontal: 16, alignItems: 'center' }}>
                        <NumberWheel value={wheelValue} min={0} max={100} step={5} onChange={setWheelValue} />
                        <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>当前值：{wheelValue}</Text>
                    </View>
                </Section>

                {/* SearchBar */}
                <Section title="SearchBar">
                    <SearchBar
                        value={searchValue}
                        onChangeText={setSearchValue}
                        expanded={searchExpanded}
                        onExpandedChange={setSearchExpanded}
                        onSearch={() => {}}
                        label="搜索"
                        cancelText="取消"
                    />
                </Section>

                {/* SegmentedControl */}
                <Section title="SegmentedControl">
                    <View style={{ paddingHorizontal: 16 }}>
                        <SegmentedControl tabs={['推荐', '关注', '热榜']} selected={seg} onSelect={setSeg} />
                    </View>
                </Section>

                {/* ListRow */}
                <Section title="ListRow · PreferenceGroup">
                    <PreferenceGroup title="偏好项" style={{ marginHorizontal: 16, marginTop: 0 }}>
                        <ListRow title="开启某项" summary="带 Switch 的行" trailing={<Switch value={switchOn} interactive={false} />} onPress={() => setSwitchOn(!switchOn)} />
                        <ListRow title="普通行" summary="summary 说明文字" onPress={() => {}} />
                        <ListRow title="禁用行" summary="disabled 状态" disabled />
                    </PreferenceGroup>
                </Section>

                {/* Input */}
                <Section title="Input">
                    <View style={{ paddingHorizontal: 16, gap: 12 }}>
                        <Input value={inputValue} onChangeText={setInputValue} label="浮动标签" />
                        <Input value="" onChangeText={() => {}} useLabelAsPlaceholder label="占位标签" />
                        <Input value="" onChangeText={() => {}} placeholder="无 label 的占位符" />
                        <Input value="已禁用" onChangeText={() => {}} label="禁用" disabled />
                    </View>
                </Section>

                {/* Dialog / BottomSheet / Menu / Snackbar triggers */}
                <Section title="Overlays">
                    <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        <Button type="primary" onPress={() => setDialogOpen(true)}>Dialog</Button>
                        <Button onPress={() => setSheetOpen(true)}>BottomSheet</Button>
                        <View ref={menuRef}>
                            <Button onPress={openMenu}>Menu</Button>
                        </View>
                        <Button onPress={() => setSnackVisible(true)}>Snackbar</Button>
                    </View>
                </Section>

                {/* NavigationBar */}
                <Section title="NavigationBar">
                    <View style={{ backgroundColor: theme.colors.surfaceContainer, borderRadius: theme.radius.component, marginHorizontal: 16, overflow: 'hidden' }}>
                        <NavigationBar
                            items={[{ label: '首页' }, { label: '消息' }, { label: '我的' }]}
                            selected={navIndex}
                            onSelect={setNavIndex}
                            renderIcon={(item, _index, selected) => (
                                <Text size={20} color={selected ? theme.colors.onSurfaceContainer : theme.colors.onSurfaceContainerVariant}>
                                    {item.label === '首页' ? '⌂' : item.label === '消息' ? '✉' : '👤'}
                                </Text>
                            )}
                        />
                    </View>
                </Section>
            </PageScrollView>

            <Dialog
                visible={dialogOpen}
                onClose={() => setDialogOpen(false)}
                title="检查更新"
                summary="summary 说明文字"
            >
                <View style={{ gap: 12, alignItems: 'stretch' }}>
                    <Text type="body2" color={theme.colors.onSurfaceSecondary}>对话框内容区。大屏居中缩放进场，小屏置底上滑进场。</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onPress={() => setDialogOpen(false)}>取消</Button>
                        <Button type="primary" onPress={() => setDialogOpen(false)}>确定</Button>
                    </View>
                </View>
            </Dialog>

            <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="底部弹层">
                <View style={{ gap: 8, paddingBottom: 24 }}>
                    <ListRow title="分享" onPress={() => setSheetOpen(false)} />
                    <ListRow title="收藏" onPress={() => setSheetOpen(false)} />
                    <ListRow title="举报" onPress={() => setSheetOpen(false)} />
                </View>
            </BottomSheet>

            <Menu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                items={[{ label: '复制链接', onPress: () => {} }, '刷新', { label: '删除', disabled: true }, { label: '已选中项', summary: 'summary', onPress: () => {} }]}
                selectedIndex={3}
            />

            <Snackbar
                visible={snackVisible}
                message="Snackbar 消息，最多两行。"
                actionLabel="操作"
                withDismissAction
                onAction={() => setSnackVisible(false)}
                onDismiss={() => setSnackVisible(false)}
            />
        </PageScaffold>
    );
}
