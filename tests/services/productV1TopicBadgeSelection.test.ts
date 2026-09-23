import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fuseProductV1TopicBadges,
  selectProductV1ContentBadges,
  selectProductV1NativeTopicBadges,
  selectProductV1TextAnchoredBadges,
} from '../../src/product-v1/topicBadgeSelection';
import type { SearchTopicGraphCompactV1 } from '../../src/product-v1/core/searchTopicGraphV1';

const graph: SearchTopicGraphCompactV1 = {
  version: 1,
  embeddingDimension: 2,
  dequantScale: 1 / 127,
  broadDomains: [
    { nodeId: 'robotics', canonicalName: 'Robotics', centroidRowIndex: 0 },
    { nodeId: 'embedded', canonicalName: 'Embedded', centroidRowIndex: 1 },
    { nodeId: 'quant', canonicalName: 'Quant', centroidRowIndex: 2 },
    { nodeId: 'technology', canonicalName: 'Technology', centroidRowIndex: 3 },
    { nodeId: 'programming', canonicalName: 'Programming', centroidRowIndex: 9 },
    { nodeId: 'ai', canonicalName: 'AI', centroidRowIndex: 10 },
    { nodeId: 'video', canonicalName: 'Video', centroidRowIndex: 11 },
    { nodeId: 'crypto', canonicalName: 'Crypto', centroidRowIndex: 12 },
    { nodeId: 'food', canonicalName: 'Food', centroidRowIndex: 13 },
    { nodeId: 'biology', canonicalName: 'Biology', centroidRowIndex: 14 },
    { nodeId: 'medicine', canonicalName: 'Medicine', centroidRowIndex: 15 },
    { nodeId: 'cybersecurity', canonicalName: 'Cybersecurity', centroidRowIndex: 16 },
    { nodeId: 'os', canonicalName: 'Operating Systems', centroidRowIndex: 17 },
    { nodeId: 'science', canonicalName: 'Science', centroidRowIndex: 28 },
    { nodeId: 'music', canonicalName: 'Music', centroidRowIndex: 31 },
    { nodeId: 'photography', canonicalName: 'Photography', centroidRowIndex: 35 },
  ],
  leafTopics: [
    { nodeId: 'arm', canonicalName: '机械臂', broadDomain: 'Robotics', crossLinkDomains: [], centroidRowIndex: 4 },
    { nodeId: 'arm-control', canonicalName: '机械臂控制', broadDomain: 'Robotics', crossLinkDomains: [], centroidRowIndex: 5 },
    { nodeId: 'ros2', canonicalName: 'ROS2', broadDomain: 'Robotics', crossLinkDomains: [], centroidRowIndex: 6 },
    { nodeId: 'slam', canonicalName: 'SLAM', broadDomain: 'Robotics', crossLinkDomains: [], centroidRowIndex: 30 },
    { nodeId: 'arm-chip', canonicalName: 'ARM', broadDomain: 'Embedded', crossLinkDomains: [], centroidRowIndex: 7 },
    { nodeId: 'technology-leaf', canonicalName: '科技', broadDomain: 'Technology', crossLinkDomains: [], centroidRowIndex: 8 },
    { nodeId: 'python', canonicalName: 'Python', broadDomain: 'Programming', crossLinkDomains: [], centroidRowIndex: 18 },
    { nodeId: 'ml', canonicalName: '机器学习', broadDomain: 'AI', crossLinkDomains: [], centroidRowIndex: 19 },
    { nodeId: 'short-video', canonicalName: '短视频创作', broadDomain: 'Video', crossLinkDomains: [], centroidRowIndex: 20 },
    { nodeId: 'cinematography', canonicalName: '电影摄影', broadDomain: 'Video', crossLinkDomains: [], centroidRowIndex: 36 },
    { nodeId: 'crypto-currency', canonicalName: '加密货币', broadDomain: 'Crypto', crossLinkDomains: [], centroidRowIndex: 21 },
    { nodeId: 'baking', canonicalName: '烘焙', broadDomain: 'Food', crossLinkDomains: [], centroidRowIndex: 22 },
    { nodeId: 'biology-leaf', canonicalName: '生物学', broadDomain: 'Biology', crossLinkDomains: [], centroidRowIndex: 23 },
    { nodeId: 'biology-parent', canonicalName: '生物', broadDomain: 'Biology', crossLinkDomains: [], centroidRowIndex: 24 },
    { nodeId: 'public-health', canonicalName: '公共卫生', broadDomain: 'Medicine', crossLinkDomains: [], centroidRowIndex: 25 },
    { nodeId: 'reverse', canonicalName: '逆向工程', broadDomain: 'Cybersecurity', crossLinkDomains: [], centroidRowIndex: 26 },
    { nodeId: 'windows', canonicalName: 'Windows', broadDomain: 'Operating Systems', crossLinkDomains: [], centroidRowIndex: 27 },
    { nodeId: 'science-leaf', canonicalName: '科学', broadDomain: 'Science', crossLinkDomains: [], centroidRowIndex: 29 },
    { nodeId: 'classic-music', canonicalName: '古典音乐', broadDomain: 'Music', crossLinkDomains: [], centroidRowIndex: 32 },
    { nodeId: 'portrait', canonicalName: '人像摄影', broadDomain: 'Photography', crossLinkDomains: [], centroidRowIndex: 34 },
    { nodeId: 'experiment-method', canonicalName: '实验方法', broadDomain: 'Science', crossLinkDomains: [], centroidRowIndex: 33 },
  ],
  queries: [],
};

test('title anchors prefer the more specific topic and suppress parent duplication', () => {
  const result = selectProductV1TextAnchoredBadges('机械臂控制入门：轨迹规划与调试', graph);
  assert.deepEqual(result.map((row) => row.label), ['机械臂控制']);
});

test('bridged Chinese wording maps to a compact topic name', () => {
  const result = selectProductV1TextAnchoredBadges('机械臂的位置控制：从运动学到实机', graph);
  assert.equal(result[0]?.label, '机械臂控制');
});

test('ASCII topic matching requires identifier boundaries while allowing a more specific CJK topic', () => {
  const result = selectProductV1TextAnchoredBadges('SO-ARM100 机械臂仿真与实机控制', graph);
  assert.equal(result[0]?.label, '机械臂控制');
  assert.ok(!result.some((row) => row.label === 'ARM'));
});

test('explicit broad trunk near the title front outranks a late generic topic', () => {
  const result = selectProductV1TextAnchoredBadges('量化策略进阶：事件驱动与另类数据的黑科技', graph);
  assert.equal(result[0]?.label, '量化');
});

test('implementation language does not steal a more specific AI subject', () => {
  const result = selectProductV1TextAnchoredBadges('Python 机器学习实践指南', graph);
  assert.equal(result[0]?.label, '机器学习');
});

test('operating system token does not steal reverse engineering subject', () => {
  const result = selectProductV1TextAnchoredBadges('Windows 逆向工程入门', graph);
  assert.equal(result[0]?.label, '逆向工程');
});

test('aliases map user wording onto the frozen topic tree', () => {
  assert.equal(selectProductV1TextAnchoredBadges('AI 短视频内容生产全流程', graph)[0]?.label, '短视频创作');
  assert.equal(selectProductV1TextAnchoredBadges('虚拟货币到底是什么', graph)[0]?.label, '加密货币');
});

test('parent-child evidence is deduplicated across branches', () => {
  const result = selectProductV1TextAnchoredBadges('烘焙：物理、化学与生物学的完美结合', graph);
  assert.equal(result[0]?.label, '烘焙');
});

test('meta framing does not replace an explicit domain topic', () => {
  const result = selectProductV1TextAnchoredBadges('科普时间：公共卫生小史', graph);
  assert.equal(result[0]?.label, '公共卫生');
});

test('compound word does not leak an unrelated broad topic', () => {
  const result = selectProductV1TextAnchoredBadges('科学管理到底是什么？', graph);
  assert.ok(!result.some((row) => row.label === '科学'));
});

test('data science compound does not collapse to generic science', () => {
  const result = selectProductV1TextAnchoredBadges('Python 数据科学之路', graph);
  assert.equal(result[0]?.label, 'Python');
  assert.ok(!result.some((row) => row.label === '科学'));
});

test('separated movie and photography terms resolve to the cinematography leaf', () => {
  const result = selectProductV1TextAnchoredBadges('电影里的光线如何影响摄影风格？', graph);
  assert.equal(result[0]?.label, '电影摄影');
});

test('safe colloquial aliases recover topic-tree leaves from titles', () => {
  assert.equal(selectProductV1TextAnchoredBadges('听不懂古典乐怎么办？', graph)[0]?.label, '古典音乐');
  assert.equal(selectProductV1TextAnchoredBadges('研一如何写实验方案？', graph)[0]?.label, '实验方法');
});

test('short safe title alias maps 人像 to 人像摄影', () => {
  assert.equal(selectProductV1TextAnchoredBadges('高级的人像作品，不是为了取悦模特', graph)[0]?.label, '人像摄影');
});

test('title evidence stays authoritative over a contradictory excerpt', () => {
  const result = selectProductV1ContentBadges(
    'Python 机器学习实践指南',
    '公共卫生体系正在发生变化，公共卫生人才需求也在增加。',
    graph,
  );
  assert.equal(result[0]?.label, '机器学习');
});

test('excerpt evidence never manufactures a capsule without title support', () => {
  const result = selectProductV1ContentBadges(
    '这种控制方案到底怎么做？',
    '机械臂控制需要先完成 SLAM 标定，再根据机械臂控制目标规划运动。',
    graph,
  );
  assert.deepEqual(result, []);
});

test('repeating one excerpt topic alone does not manufacture a capsule', () => {
  const result = selectProductV1ContentBadges(
    '这个行业未来会怎么样？',
    '公共卫生体系正在调整，公共卫生人才培养也需要同步变化。',
    graph,
  );
  assert.deepEqual(result, []);
});

test('excerpt-only short incidental entities stay hidden', () => {
  const result = selectProductV1ContentBadges(
    'NAS 存储方案实测',
    '手机天天提示容量不足，电脑也塞满了文件，全家的照片又散落在手机和电脑里。',
    graph,
  );
  assert.deepEqual(result, []);
});

test('excerpt-only generic trunk evidence stays hidden', () => {
  const result = selectProductV1ContentBadges(
    '一些随想',
    '科技正在快速发展，科技产品也越来越多。',
    graph,
  );
  assert.deepEqual(result, []);
});

test('uncertain text gets no guessed capsule', () => {
  const result = selectProductV1TextAnchoredBadges('关于一个复杂问题的几点随想', graph);
  assert.deepEqual(result, []);
});

test('native Zhihu topics recover a semantic capsule even when the title is not a tree string', () => {
  const result = selectProductV1NativeTopicBadges(
    [
      { id: '1', name: '家庭教育' },
      { id: '2', name: '亲子关系' },
      { id: '3', name: '打压式教育' },
    ],
    '孩子越来越不愿意和父母交流，该怎么办？',
    '很多家庭都遇到类似问题。',
    graph,
  );
  assert.equal(result[0]?.label, '家庭教育');
});

test('native topic text support prefers the topic actually named by the question', () => {
  const result = selectProductV1NativeTopicBadges(
    [
      { id: '1', name: '恐惧症' },
      { id: '2', name: '密集恐惧症' },
      { id: '3', name: '目光恐惧症' },
    ],
    '有没有表现巨物恐惧症的图片？',
    '',
    graph,
  );
  assert.deepEqual(result.map((row) => row.label), ['恐惧症']);
});

test('an unrelated singleton native topic is rejected instead of blindly trusted', () => {
  const result = selectProductV1NativeTopicBadges(
    [{ id: '1', name: '综艺' }],
    '死刑执行前可以谎称肚子痛来拖延时间吗？',
    '讨论死刑执行程序与法律问题。',
    graph,
  );
  assert.deepEqual(result, []);
});

test('a singleton native topic recognized by the frozen tree can recover an implicit title', () => {
  const native = selectProductV1NativeTopicBadges(
    [{ id: '1', name: '机械臂控制' }],
    '这种位置闭环为什么总是震荡？',
    '讨论关节位置闭环、末端轨迹和控制器参数。',
    graph,
  );
  assert.equal(native[0]?.label, '机械臂控制');
  const fused = fuseProductV1TopicBadges([], native, 2);
  assert.equal(fused[0]?.label, '机械臂控制');
});

test('isolated school brand does not beat a coherent teacher topic family', () => {
  const result = selectProductV1NativeTopicBadges(
    [
      { id: '1', name: '学习' },
      { id: '2', name: '学而思' },
      { id: '3', name: '教师' },
      { id: '4', name: '教师资格证' },
      { id: '5', name: '补习班' },
    ],
    '为什么学而思在大胆使用无教师资格的老师？',
    '',
    graph,
  );
  assert.ok(result.some((row) => row.label === '教师' || row.label === '教师资格证'));
  assert.ok(!result.some((row) => row.label === '学而思' || row.label === '学习'));
});

test('meta image words and isolated descriptors do not become domain capsules', () => {
  const result = selectProductV1NativeTopicBadges(
    [
      { id: '1', name: '心理' },
      { id: '2', name: '图片' },
      { id: '3', name: '照片' },
      { id: '4', name: '诡异' },
    ],
    '大家看过哪些诡异的图片？',
    '',
    graph,
  );
  assert.deepEqual(result, []);
});

test('unrelated country and client topics are not promoted just because they occur in the title', () => {
  const result = selectProductV1NativeTopicBadges(
    [
      { id: '1', name: '调查类问题' },
      { id: '2', name: '印度' },
      { id: '3', name: '客户' },
    ],
    '接待印度客户是一种什么体验？',
    '',
    graph,
  );
  assert.deepEqual(result, []);
});

test('related police native topics form a valid semantic consensus', () => {
  const result = selectProductV1NativeTopicBadges(
    [
      { id: '1', name: '警察' },
      { id: '2', name: '公安' },
      { id: '3', name: '警察监控' },
    ],
    '园区保安盘问来出警的警察正常吗？',
    '',
    graph,
  );
  assert.equal(result[0]?.label, '警察');
  assert.ok(!result.some((row) => row.label === '公安'));
});
