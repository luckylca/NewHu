import assert from 'node:assert/strict';
import test from 'node:test';
import { liquidGlassPresentation, hyperosPresentation, colorosPresentation } from '../../project/react-native-hyper-ui/src/theme/presentation';
import { resolveThemeVariant } from '../../project/react-native-hyper-ui/src/theme/registryCore';
import { liquidGlassForegroundColors } from '../../project/react-native-hyper-ui/src/theme/glassColors';
import { applyBackdropPresentation, hyperosWallpaperTokens, liquidGlassWallpaperTokens, resolveBackdropSource } from '../../project/react-native-hyper-ui/src/theme/wallpaper';
import type { AppTheme, ThemeName } from '../../project/react-native-hyper-ui/src/theme/types';

const families: ThemeName[] = ['hyperos', 'coloros', 'liquidGlass'];

test('theme resolver selects each family and light/dark definition from one registry', () => {
    const registry = Object.fromEntries(families.map((name) => [name, {
        light: { name, dark: false },
        dark: { name, dark: true },
    }])) as Record<ThemeName, { light: { name: ThemeName; dark: boolean }; dark: { name: ThemeName; dark: boolean } }>;

    for (const name of families) {
        for (const dark of [false, true]) {
            assert.deepEqual(resolveThemeVariant(registry, name, dark), { name, dark });
        }
    }
});

test('presentation tokens describe the three theme families without enabling Glass in ColorOS', () => {
    assert.equal(hyperosPresentation.topBar.mode, 'inFlow');
    assert.equal(hyperosPresentation.topBar.material, 'solid');
    assert.equal(hyperosPresentation.content.groupMaterial, 'solid');
    assert.equal(hyperosPresentation.content.cardMaterial, 'solid');
    assert.equal(colorosPresentation.topBar.mode, 'inFlow');
    assert.equal(colorosPresentation.content.groupMaterial, 'solid');
    assert.equal(colorosPresentation.content.cardMaterial, 'solid');
    assert.equal(colorosPresentation.bottomNavigation.style, 'navigationBar');
    assert.equal(liquidGlassPresentation.topBar.mode, 'floating');
    assert.equal(liquidGlassPresentation.topBar.contentUnderlay, true);
    assert.equal(liquidGlassPresentation.search.defaultMode, 'floating');
    assert.equal(liquidGlassPresentation.content.groupMaterial, 'glass');
    assert.equal(liquidGlassPresentation.content.cardMaterial, 'glass');
    assert.equal(liquidGlassPresentation.bottomNavigation.style, 'glassTabBar');
    assert.equal(liquidGlassPresentation.controls.switchThumb, 'solid');
});

test('Glass foreground semantics keep light Glass dark and dark Glass light', () => {
    assert.equal(liquidGlassForegroundColors.light.onGlass, '#162235');
    assert.equal(liquidGlassForegroundColors.light.onGlassSecondary, 'rgba(22,34,53,0.72)');
    assert.notEqual(liquidGlassForegroundColors.light.onGlass, '#FFFFFF');
    assert.equal(liquidGlassForegroundColors.dark.onGlass, '#EDF3FB');
    assert.equal(liquidGlassForegroundColors.dark.onGlassSecondary, 'rgba(237,243,251,0.76)');
    assert.notEqual(liquidGlassForegroundColors.dark.onGlass, '#000000');
});

test('backdrop derivation changes only the selected family palette and preserves presentation and renderer capability', () => {
    const presentation = hyperosPresentation;
    const glass = { enabled: false } as AppTheme['glass'];
    const base = {
        name: 'hyperos',
        dark: false,
        colors: { background: '#fff', surface: '#fff', surfaceContainer: '#fff' },
        presentation,
        wallpaper: hyperosWallpaperTokens,
        glass,
    } as unknown as AppTheme;

    const derived = applyBackdropPresentation(base, true);
    assert.equal(derived.name, base.name);
    assert.equal(derived.presentation, presentation);
    assert.equal(derived.glass, glass);
    assert.equal(derived.colors.background, 'transparent');
    assert.equal(derived.colors.surfaceContainer, hyperosWallpaperTokens.colors.light.surfaceContainer);
    assert.equal(base.colors.background, '#fff');
    assert.equal(applyBackdropPresentation(base, false), base);
    assert.equal(hyperosWallpaperTokens.defaultBackdrop, 'none');
    assert.equal(liquidGlassWallpaperTokens.defaultBackdrop, 'ambient');
    assert.equal(resolveBackdropSource(base, false), 'themeColor');
    assert.equal(resolveBackdropSource({ ...base, wallpaper: liquidGlassWallpaperTokens }, false), 'ambient');
    assert.equal(resolveBackdropSource({ ...base, wallpaper: liquidGlassWallpaperTokens }, true), 'userWallpaper');
});

test('Liquid Glass ambient and user wallpaper both select the translucent backdrop palette in light and dark', () => {
    for (const dark of [false, true]) {
        const base = {
            name: 'liquidGlass',
            dark,
            colors: { background: '#base', surface: '#surface', surfaceContainer: '#card' },
            presentation: liquidGlassPresentation,
            wallpaper: liquidGlassWallpaperTokens,
            glass: { enabled: true },
        } as unknown as AppTheme;
        const defaultSource = resolveBackdropSource(base, false);
        assert.equal(defaultSource, 'ambient');
        const ambient = applyBackdropPresentation(base, defaultSource === 'ambient');
        const palette = dark ? liquidGlassWallpaperTokens.colors.dark : liquidGlassWallpaperTokens.colors.light;
        assert.equal(ambient.colors.background, palette.background);
        assert.equal(ambient.colors.surfaceContainer, palette.surfaceContainer);

        const wallpaperSource = resolveBackdropSource(base, true);
        assert.equal(wallpaperSource, 'userWallpaper');
        assert.equal(applyBackdropPresentation(base, wallpaperSource === 'userWallpaper').colors.surfaceContainer, palette.surfaceContainer);
    }
});
