import { getLatestProductTrace, loadProductState, saveProductState } from '@/src/db/repositories/productV1Repository';
import {
  createRatioControllerV2,
  resetRatioToAutoV2,
  setExplicitRatioV2,
  type RatioControllerStateV2,
} from '@/src/product-v1/core/explicitInterestRatioV2';
import { topNamedInterests } from '@/src/product-v1/core/profile';
import type { ProfileState } from '@/src/product-v1/core/types';
import {
  getProductV1ModelStatus,
  getProductV1RuntimeAssetStatus,
  importProductV1Model,
  loadProductV1Settings,
  resetProductV1Runtime,
  updateProductV1Settings,
  useProductV1HealthStore,
  warmProductV1Runtime,
  type ProductV1AssetDownloadProgress,
} from '@/src/product-v1';
import type { ProductV1Settings, ProductV1Trace } from '@/src/product-v1/types';
import { Button, Card, Dialog, Divider, Icon, ListRow, SegmentedControl, Slider, Switch, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { notify } from '@/src/stores/useNotificationStore';

const INTEREST_LABELS: Record<string, string> = {
  AI: '人工智能', Anime: '动漫', Architecture: '建筑', Biology: '生物', Books: '阅读', Business: '商业',
  Career: '职业发展', Cars: '汽车', Cloud: '云计算', 'Consumer Electronics': '消费电子', Crypto: '加密货币',
  Cybersecurity: '网络安全', Databases: '数据库', Design: '设计', 'Digital Life': '数字生活', Economics: '经济学',
  Education: '教育', Embedded: '嵌入式', Entrepreneurship: '创业', Fashion: '时尚', Film: '影视', Finance: '金融',
  Fitness: '健身', Food: '美食', Games: '游戏', Hardware: '硬件', History: '历史', Home: '家居', Investing: '投资',
  Law: '法律', Lifestyle: '生活方式', Mathematics: '数学', Medicine: '医学', Mobile: '移动科技', Music: '音乐',
  'Open Source': '开源', 'Operating Systems': '操作系统', Parenting: '育儿', Photography: '摄影', Physics: '物理',
  Politics: '政治', Programming: '编程', Psychology: '心理学', Quant: '量化', Relationships: '情感关系',
  Robotics: '机器人', Science: '科学', Sports: '体育', Technology: '科技', Travel: '旅行', Video: '视频',
};

const INTEREST_OPTIONS = Object.keys(INTEREST_LABELS);

const label = (interest: string) => INTEREST_LABELS[interest] ?? interest;
const PRESS_FEEDBACK_DELAY_MS = 140;

function waitForPressFeedback() {
  return new Promise<void>((resolve) => setTimeout(resolve, PRESS_FEEDBACK_DELAY_MS));
}

export default function ProductV1Screen() {
  const theme = useTheme();
  const health = useProductV1HealthStore();
  const [settings, setSettings] = React.useState<ProductV1Settings | null>(null);
  const [ratio, setRatio] = React.useState<RatioControllerStateV2 | null>(null);
  const [profile, setProfile] = React.useState<ProfileState | null>(null);
  const [trace, setTrace] = React.useState<ProductV1Trace | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [modelStatus, setModelStatus] = React.useState(() => getProductV1ModelStatus());
  const [modelImporting, setModelImporting] = React.useState(false);
  const [assetStatus, setAssetStatus] = React.useState(() => getProductV1RuntimeAssetStatus());
  const [assetProgress, setAssetProgress] = React.useState<ProductV1AssetDownloadProgress | null>(null);
  const [assetDownloading, setAssetDownloading] = React.useState(false);
  const modelImportPending = React.useRef(false);
  const assetDownloadPending = React.useRef(false);

  const reload = React.useCallback(async () => {
    const [nextSettings, nextRatio, nextProfile, nextTrace] = await Promise.all([
      loadProductV1Settings(),
      loadProductState<RatioControllerStateV2>('ratio'),
      loadProductState<ProfileState>('profile'),
      getLatestProductTrace(),
    ]);
    setSettings(nextSettings);
    setRatio(nextRatio ?? createRatioControllerV2([], 'AUTO'));
    setProfile(nextProfile);
    setTrace(nextTrace);
  }, []);

  React.useEffect(() => {
    void reload();
    const current = getProductV1RuntimeAssetStatus();
    setAssetStatus(current);
    setAssetDownloading(!current.installed);
    void warmProductV1Runtime(setAssetProgress)
      .then(() => {
        setAssetStatus(getProductV1RuntimeAssetStatus());
        setModelStatus(getProductV1ModelStatus());
      })
      .catch(() => undefined)
      .finally(() => setAssetDownloading(false));
  }, [reload]);

  const patchSettings = async (patch: Partial<ProductV1Settings>) => {
    setSettings(await updateProductV1Settings(patch));
  };

  const importModel = async () => {
    if (modelImportPending.current) return;
    modelImportPending.current = true;
    setModelImporting(true);
    try {
      await waitForPressFeedback();
      await importProductV1Model();
      setModelStatus(getProductV1ModelStatus());
      setAssetStatus(getProductV1RuntimeAssetStatus());
      resetProductV1Runtime();
      setAssetDownloading(true);
      await warmProductV1Runtime(setAssetProgress);
      setAssetStatus(getProductV1RuntimeAssetStatus());
      notify({ message: '推荐模型已安装', duration: 3000 });
    } catch (error) {
      notify({ message: error instanceof Error ? error.message : '模型导入失败', duration: 4500 });
    } finally {
      modelImportPending.current = false;
      setModelImporting(false);
      setAssetDownloading(false);
    }
  };

  const downloadAssets = async () => {
    if (assetDownloadPending.current) return;
    assetDownloadPending.current = true;
    if (assetStatus.installed) {
      notify({ message: '在线推荐资源已安装', duration: 2200 });
      assetDownloadPending.current = false;
      return;
    }
    setAssetDownloading(true);
    setAssetProgress(null);
    try {
      await waitForPressFeedback();
      resetProductV1Runtime();
      await warmProductV1Runtime(setAssetProgress);
      setAssetStatus(getProductV1RuntimeAssetStatus());
      setModelStatus(getProductV1ModelStatus());
      notify({ message: '在线推荐资源已安装', duration: 3000 });
    } catch (error) {
      notify({ message: error instanceof Error ? error.message : '在线推荐资源下载失败', duration: 4500 });
    } finally {
      assetDownloadPending.current = false;
      setAssetDownloading(false);
    }
  };

  const persistRatio = async (next: RatioControllerStateV2) => {
    setRatio({ ...next, entries: next.entries.map((entry) => ({ ...entry })) });
    await saveProductState('ratio', 2, next);
  };

  const setRatioMode = async (mode: 'AUTO' | 'EXPLICIT') => {
    if (!ratio) return;
    const next = structuredClone(ratio);
    if (mode === 'AUTO') {
      resetRatioToAutoV2(next, Object.fromEntries(profile ? topNamedInterests(profile, 9) : []));
    } else {
      next.mode = 'EXPLICIT';
      next.ratioEpoch += 1;
    }
    await persistRatio(next);
  };

  const setInterest = async (interestId: string, value: number) => {
    if (!ratio) return;
    const next = structuredClone(ratio);
    setExplicitRatioV2(next, interestId, value);
    await persistRatio(next);
  };

  const statusText = health.encoderReady
    ? `编码器正常 · 128D · ${health.seedCount} 种子\n活跃${health.activeCount}/备用${health.reserveCount}`
    : health.lastError ? `降级运行 · ${health.lastError}` : '等待首次推荐流初始化';
  const progressLabel = assetProgress?.phase === 'model'
    ? '推荐模型'
    : assetProgress?.phase === 'seed_bank'
      ? '种子库'
      : assetProgress?.phase === 'seed_embeddings' ? '种子向量' : '资源校验';
  const onlineAssetSummary = assetDownloading
    ? `正在下载 ${assetProgress?.percent ?? 0}% · ${progressLabel}`
    : assetStatus.installed
      ? `已安装 · ${(assetStatus.totalBytes / 1024 / 1024).toFixed(1)} MB · 2706 种子`
      : `未完整安装 · 点击在线下载 ${(assetStatus.totalBytes / 1024 / 1024).toFixed(1)} MB`;

  if (!settings || !ratio) return <View style={{ flex: 1, backgroundColor: theme.colors.background }}><TopAppBar title="Product V1 推荐" back={() => router.back()} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TopAppBar title="Product V1 推荐" back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.lg }}>
        <Card feedback="none">
          <ListRow title="本地推荐运行时" summary={statusText} summaryNumberOfLines={2} trailing={<Switch value={settings.enabled} interactive={false} />} onPress={() => void patchSettings({ enabled: !settings.enabled })} />
          <Divider style={{ marginLeft: theme.spacing.lg }} />
          <ListRow
            title="在线推荐资源"
            summary={onlineAssetSummary}
            icon={<Icon name={assetStatus.installed ? 'cloud-check-outline' : 'cloud-download-outline'} size={24} color={theme.colors.primary} />}
            disabled={assetDownloading}
            onPress={() => void downloadAssets()}
          />
          <Divider style={{ marginLeft: theme.spacing.lg }} />
          <ListRow
            title="手动导入模型"
            summary={modelImporting
              ? '正在导入并校验'
              : modelStatus.installed
                ? `已安装 · ${(modelStatus.size / 1024 / 1024).toFixed(1)} MB`
                : '从本机选择 Tiny Encoder .onnx'}
            icon={<Icon name={modelStatus.installed ? 'check-circle-outline' : 'download-outline'} size={24} color={theme.colors.primary} />}
            disabled={modelImporting}
            onPress={() => void importModel()}
          />
          <Divider style={{ marginLeft: theme.spacing.lg }} />
          <View style={{ padding: theme.spacing.lg }}>
            <Text type="footnote1" weight="bold" color={theme.colors.primary} style={{ marginBottom: theme.spacing.sm }}>运行模式</Text>
            <SegmentedControl tabs={['实时排序', '影子评估']} selected={settings.mode === 'live' ? 0 : 1} onSelect={(index) => void patchSettings({ mode: index === 0 ? 'live' : 'shadow' })} />
          </View>
        </Card>

        <Card feedback="none">
          <ListRow title="高质量模式" summary="500 赞 / 250 收藏 / 50 评论，或收藏数高于赞数" summaryNumberOfLines={2} trailing={<Switch value={settings.highQualityEnabled} interactive={false} />} onPress={() => void patchSettings({ highQualityEnabled: !settings.highQualityEnabled })} />
          <Divider style={{ marginLeft: theme.spacing.lg }} />
          <ListRow title="兴趣破圈" summary="探索画像之外的内容（默认关闭）" trailing={<Switch value={settings.bubbleBreakEnabled} interactive={false} />} onPress={() => void patchSettings({ bubbleBreakEnabled: !settings.bubbleBreakEnabled })} />
        </Card>

        <Card feedback="none" contentStyle={{ paddingBottom: theme.spacing.md }}>
          <View style={{ padding: theme.spacing.lg }}>
            <Text type="footnote1" weight="bold" color={theme.colors.primary} style={{ marginBottom: theme.spacing.sm }}>兴趣比例</Text>
            <SegmentedControl tabs={['AUTO', '显式比例']} selected={ratio.mode === 'AUTO' ? 0 : 1} onSelect={(index) => void setRatioMode(index === 0 ? 'AUTO' : 'EXPLICIT')} />
          </View>
          {ratio.entries.map((entry) => (
            <View key={entry.interestId} style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                <Text type="body2" weight="medium">{label(entry.interestId)}</Text>
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>{Math.round(entry.userTarget * 100)}%</Text>
              </View>
              <Slider
                value={entry.userTarget}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                disabled={ratio.mode === 'AUTO'}
                accessibilityLabel={`${label(entry.interestId)}比例`}
                onSlidingComplete={(value) => void setInterest(entry.interestId, value)}
              />
            </View>
          ))}
          {ratio.mode === 'EXPLICIT' ? (
            <Button onPress={() => setPickerVisible(true)} style={{ alignSelf: 'flex-start', marginHorizontal: theme.spacing.lg }}>
              <Icon name="plus" size={20} color={theme.colors.onSecondaryVariant} /><Text type="button" style={{ marginLeft: 6 }}>选择兴趣</Text>
            </Button>
          ) : null}
        </Card>

        <Card feedback="none">
          <ListRow
            title="最近运行"
            summary={trace ? `${trace.status} · 推荐 ${trace.recommendationCount} · 搜索 ${trace.searchRequestCount} · ${new Date(trace.startedAt).toLocaleString()}` : '暂无 cycle'}
            icon={<Icon name="chart-timeline-variant" size={24} color={theme.colors.primary} />}
          />
          {trace?.error ? <Text type="footnote1" color={theme.colors.error} style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>{trace.error}</Text> : null}
        </Card>
      </ScrollView>

      <Dialog visible={pickerVisible} onClose={() => setPickerVisible(false)} title="选择兴趣">
        <ScrollView style={{ maxHeight: 360 }}>
          {INTEREST_OPTIONS.map((interest) => {
            const selected = ratio.entries.some((entry) => entry.interestId === interest);
            return (
              <ListRow
                key={interest}
                title={label(interest)}
                trailing={<Icon name={selected ? 'check-circle' : 'plus-circle-outline'} size={22} color={selected ? theme.colors.primary : theme.colors.onSurfaceVariantActions} />}
                disabled={selected}
                onPress={() => void setInterest(interest, 0.1)}
              />
            );
          })}
        </ScrollView>
        <View style={{ alignItems: 'flex-end', marginTop: theme.spacing.md }}><Button type="primary" onPress={() => setPickerVisible(false)}>完成</Button></View>
      </Dialog>
    </View>
  );
}
