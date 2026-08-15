import { BottomSheet, Button, Card, Dialog, Input, ListRow, Menu, NavigationBar, SearchBar, SegmentedControl, Snackbar, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

/**
 * UI Showcase — the single page where every Design System component is
 * exercised in every state (Normal / Pressed / Disabled / Selected / Unselected)
 * against the live theme. The visual target is miuix (HyperOS), not Material.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
    const theme = useTheme();
    return (
        <View style={{ marginBottom: 24 }}>
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

export default function DesignSystemShowcase() {
    const theme = useTheme();

    // component states
    const [switchOn, setSwitchOn] = useState(true);
    const [seg, setSeg] = useState(1);
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

    const openMenu = () => {
        menuRef.current?.measureInWindow((x, y, width, height) => {
            setMenuAnchor({ x, y, width, height });
            setMenuVisible(true);
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <TopAppBar title="UI Showcase" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ paddingBottom: 48, backgroundColor: theme.colors.surface }}>
                {/* Colors */}
                <Section title="Colors">
                    <View style={{ paddingHorizontal: 16 }}>
                        <Swatch name="primary" value={theme.colors.primary} />
                        <Swatch name="onPrimary" value={theme.colors.onPrimary} />
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
                <Section title="Card">
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
                <Section title="ListRow">
                    <View style={{ backgroundColor: theme.colors.surfaceContainer, borderRadius: theme.radius.component, marginHorizontal: 16, overflow: 'hidden' }}>
                        <ListRow title="开启某项" summary="带 Switch 的行" trailing={<Switch value={switchOn} interactive={false} />} onPress={() => setSwitchOn(!switchOn)} />
                        <ListRow title="普通行" summary="summary 说明文字" onPress={() => {}} />
                        <ListRow title="禁用行" summary="disabled 状态" disabled />
                    </View>
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
            </ScrollView>

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
        </View>
    );
}
