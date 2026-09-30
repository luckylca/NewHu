/** Platform-independent family and appearance selection shared by the registry. */
export function resolveThemeVariant<Name extends string, Theme>(
    registry: Readonly<Record<Name, { light: Theme; dark: Theme }>>,
    name: Name,
    dark: boolean,
): Theme {
    return registry[name][dark ? 'dark' : 'light'];
}
