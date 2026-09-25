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
  loadProductV1Settings,
  updateProductV1Settings,
  useProductV1HealthStore,
  warmProductV1Runtime,
} from '@/src/product-v1';
import type { ProductV1Settings, ProductV1Trace } from '@/src/product-v1/types';
import { Button, Card, Dialog, Divider, Icon, ListRow, SegmentedControl, Slider, Switch, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { notify } from '@/src/stores/useNotificationStore';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { resolveRecommendationBackend, scopedRecommendationState } from '@/src/semantic-v2/recommendationBackend';
import { resetSemanticV2Runtime } from '@/src/semantic-v2/badgeSelector';
import {
  checkSemanticV2RuntimeAssetUpdates,
  ensureSemanticV2RuntimeAssets,
  getSemanticV2RuntimeAssetStatus,
  installSemanticV2RuntimeAssetUpdate,
  type SemanticV2AssetDownloadProgress,
  type SemanticV2RuntimeAssetUpdate,
} from '@/src/semantic-v2/runtimeAssets';

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
export default function ProductV1Screen() {
  const theme = useTheme();
  const health = useProductV1HealthStore();
  const [settings, setSettings] = React.useState<ProductV1Settings | null>(null);
  const [ratio, setRatio] = React.useState<RatioControllerStateV2 | null>(null);
  const [profile, setProfile] = React.useState<ProfileState | null>(null);
  const [trace, setTrace] = React.useState<ProductV1Trace | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [semanticAssets, setSemanticAssets] = React.useState(() => getSemanticV2RuntimeAssetStatus());
  const [assetProgress, setAssetProgress] = React.useState<SemanticV2AssetDownloadProgress | null>(null);
  const [assetDownloading, setAssetDownloading] = React.useState(false);
  const [checkingAssetUpdates, setCheckingAssetUpdates] = React.useState(false);
  const [pendingAssetUpdate, setPendingAssetUpdate] = React.useState<SemanticV2RuntimeAssetUpdate | null>(null);
  const [assetUpdateDialogVisible, setAssetUpdateDialogVisible] = React.useState(false);
  const checkingAssetUpdatesRef = React.useRef(false);

  const reload = React.useCallback(async () => {
    const nextSettings = await loadProductV1Settings();
    const backend = resolveRecommendationBackend(nextSettings.recommendationBackend, nextSettings.native512GeometryMode);
    const [nextRatio, nextProfile, nextTrace] = await Promise.all([
      loadProductState<RatioControllerStateV2>(scopedRecommendationState(backend.stateScope, 'ratio')),
      loadProductState<ProfileState>(scopedRecommendationState(backend.stateScope, 'profile')),
      getLatestProductTrace(),
    ]);
    setSettings(nextSettings);
    setRatio(nextRatio ?? createRatioControllerV2([], 'AUTO'));
    setProfile(nextProfile);
    setTrace(nextTrace);
    setSemanticAssets(getSemanticV2RuntimeAssetStatus());
  }, []);

  const checkForAssetUpdates = React.useCallback(async (notifyWhenCurrent: boolean) => {
    if (checkingAssetUpdatesRef.current) return;
    checkingAssetUpdatesRef.current = true;
    setCheckingAssetUpdates(true);
    try {
      const update = await checkSemanticV2RuntimeAssetUpdates();
      setSemanticAssets(getSemanticV2RuntimeAssetStatus());
      if (update.changedAssets.length > 0) {
        setPendingAssetUpdate(update);
        setAssetUpdateDialogVisible(true);
      } else if (notifyWhenCurrent) {
        notify(`模型与 Seed 已是最新版本（Gitee v${update.latestVersion}）`);
      }
    } catch (error) {
      console.warn('[SemanticV2] failed to check runtime asset updates', error);
      if (notifyWhenCurrent) {
        notify(error instanceof Error ? `检查更新失败：${error.message}` : '检查更新失败，请稍后重试');
      }
    } finally {
      checkingAssetUpdatesRef.current = false;
      setCheckingAssetUpdates(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
    void warmProductV1Runtime().catch(() => undefined);
    void checkForAssetUpdates(false);
  }, [checkForAssetUpdates, reload]);

  const patchSettings = async (patch: Partial<ProductV1Settings>) => {
    const next = await updateProductV1Settings(patch);
    setSettings(next);
  };

  const downloadSemanticAssets = async () => {
    if (assetDownloading) return;
    setAssetDownloading(true);
    setAssetProgress(null);
    try {
      const status = await ensureSemanticV2RuntimeAssets(setAssetProgress);
      setSemanticAssets(status);
      resetSemanticV2Runtime();
      await warmProductV1Runtime().catch(() => undefined);
    } finally {
      setAssetDownloading(false);
      setAssetProgress(null);
      setSemanticAssets(getSemanticV2RuntimeAssetStatus());
    }
  };

  const downloadAssetUpdate = async () => {
    if (!pendingAssetUpdate || assetDownloading) return;
    setAssetUpdateDialogVisible(false);
    setAssetDownloading(true);
    setAssetProgress(null);
    try {
      const status = await installSemanticV2RuntimeAssetUpdate(pendingAssetUpdate, setAssetProgress);
      setSemanticAssets(status);
      setPendingAssetUpdate(null);
      resetSemanticV2Runtime();
      await warmProductV1Runtime().catch((error) => {
        console.warn('[SemanticV2] runtime warm-up after update failed', error);
      });
      notify(`模型与 Seed 更新完成（Gitee v${status.version}）`);
    } catch (error) {
      console.error('[SemanticV2] runtime asset update failed', error);
      notify(error instanceof Error ? `模型与 Seed 更新失败：${error.message}` : '模型与 Seed 更新失败，请稍后重试');
    } finally {
      setAssetDownloading(false);
      setAssetProgress(null);
      setSemanticAssets(getSemanticV2RuntimeAssetStatus());
    }
  };

  const formatAssetBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const persistRatio = async (next: RatioControllerStateV2) => {
    if (!settings) return;
    const backend = resolveRecommendationBackend(settings.recommendationBackend, settings.native512GeometryMode);
    setRatio({ ...next, entries: next.entries.map((entry) => ({ ...entry })) });
    await saveProductState(scopedRecommendationState(backend.stateScope, 'ratio'), 2, next);
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

  const selectedBackend = settings
    ? resolveRecommendationBackend(settings.recommendationBackend, settings.native512GeometryMode)
    : resolveRecommendationBackend('native512', 'relevanceMax');
  const statusText = health.encoderReady
    ? `${selectedBackend.label} · 编码器正常 · ${health.embeddingDimension}D · ${health.seedCount} 种子\n活跃${health.activeCount}/备用${health.reserveCount}`
    : health.lastError ? `降级运行 · ${health.lastError}` : `${selectedBackend.label} · 等待首次推荐流初始化`;
  const traceRatioSummary = trace
    ? Object.entries(trace.ratioTarget)
        .filter(([, target]) => target > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([interest, target]) => `${label(interest)} ${Math.round(target * 100)}%→${Math.round((trace.ratioAchieved[interest] ?? 0) * 100)}%`)
        .join(' · ')
    : '';
  const traceSearchSummary = trace
    ? `Search请求 ${trace.searchRequestCount} · 前20展示 ${trace.searchDisplayedCount ?? 0} (${Math.round((trace.searchDisplayedShare ?? 0) * 100)}%)`
    : '';

  if (!settings || !ratio) return <View style={{ flex: 1, backgroundColor: theme.colors.background }}><TopAppBar title="512D 推荐" back={() => router.back()} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TopAppBar title="Native512 推荐" back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.lg }}>
        <Card feedback="none">
          <ListRow title="本地推荐运行时" summary={statusText} summaryNumberOfLines={2} trailing={<Switch value={settings.enabled} interactive={false} />} onPress={() => void patchSettings({ enabled: !settings.enabled })} />
          <Divider style={{ marginLeft: theme.spacing.lg }} />
          <ListRow
            title="512D 语义推荐资源"
            summary={assetDownloading && assetProgress
              ? `正在下载 ${assetProgress.percent}% · ${assetProgress.currentFile || '校验资源'}`
              : semanticAssets.installed
                ? `Gitee v${semanticAssets.version} · 已安装 ${formatAssetBytes(semanticAssets.installedBytes)} · ${semanticAssets.totalFiles}/${semanticAssets.totalFiles} 文件`
                : `未安装 · 点击下载 ${formatAssetBytes(semanticAssets.totalBytes)} · Gitee v${semanticAssets.version}`}
            summaryNumberOfLines={2}
            icon={<Icon name={semanticAssets.installed ? "cloud-check-outline" : "cloud-download-outline"} size={24} color={theme.colors.primary} />}
            disabled={assetDownloading}
            onPress={() => void downloadSemanticAssets()}
          />
          <Divider style={{ marginLeft: theme.spacing.lg }} />
          <ListRow
            title="检查模型与 Seed 更新"
            summary={checkingAssetUpdates
              ? '正在检查 Gitee 上的模型与 Seed 文件…'
              : '自动检查更新，也可以随时手动检查'}
            summaryNumberOfLines={2}
            icon={<Icon name="cloud-download-outline" size={24} color={theme.colors.primary} />}
            disabled={checkingAssetUpdates || assetDownloading}
            onPress={() => void checkForAssetUpdates(true)}
          />
          <Divider style={{ marginLeft: theme.spacing.lg }} />
          <View style={{ padding: theme.spacing.lg }}>
            <Text type="footnote1" weight="bold" color={theme.colors.primary} style={{ marginBottom: theme.spacing.sm }}>推荐语义后端</Text>
            <Text type="body2" weight="medium">Native512 · RelevanceMax</Text>
            <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.sm }}>
              推荐系统已整体升级到原生 512D。文章、用户画像、Seed、Topic Graph 与 Search Routing 统一使用同一 512D 语义空间。
            </Text>
          </View>
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
            summary={trace
              ? `${trace.status} · 系统推荐输入 ${trace.recommendationCount} · ${new Date(trace.startedAt).toLocaleString()}\n${traceSearchSummary}${traceRatioSummary ? `\n${traceRatioSummary}` : ''}`
              : '暂无 cycle'}
            summaryNumberOfLines={3}
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

      <Dialog
        visible={assetUpdateDialogVisible}
        onClose={() => {
          if (!assetDownloading) setAssetUpdateDialogVisible(false);
        }}
        closeOnClickModal={!assetDownloading}
        title="发现模型与 Seed 更新"
        summary={pendingAssetUpdate ? `Gitee v${pendingAssetUpdate.currentVersion} → v${pendingAssetUpdate.latestVersion}` : undefined}
      >
        {pendingAssetUpdate ? (
          <>
            <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>
              更新文件：{pendingAssetUpdate.changedAssets.map((asset) => asset.label).join('、')}
              {'\n'}下载大小：{formatAssetBytes(pendingAssetUpdate.changedAssets.reduce((sum, asset) => sum + asset.size, 0))}
              {'\n'}下载后会校验 SHA-256，校验通过再替换本地运行资源。
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
              <Button type="default" disabled={assetDownloading} onPress={() => setAssetUpdateDialogVisible(false)}>稍后</Button>
              <Button type="primary" disabled={assetDownloading} onPress={() => void downloadAssetUpdate()}>
                {assetDownloading && assetProgress ? `下载中 ${assetProgress.percent}%` : '下载并更新'}
              </Button>
            </View>
          </>
        ) : null}
      </Dialog>
    </View>
  );
}
