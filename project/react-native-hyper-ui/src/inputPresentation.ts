export type InputPresentationState = {
    labelVisible: boolean;
    floating: boolean;
    placeholder?: string;
};

export function resolveInputPresentation({
    hasLabel,
    useLabelAsPlaceholder,
    hasText,
    focused,
    placeholder,
}: {
    hasLabel: boolean;
    useLabelAsPlaceholder: boolean;
    hasText: boolean;
    focused: boolean;
    placeholder?: string;
}): InputPresentationState {
    const labelVisible = hasLabel && !(useLabelAsPlaceholder && hasText);
    const floating = hasLabel
        && !useLabelAsPlaceholder
        && (hasText || focused);

    return {
        labelVisible,
        floating,
        placeholder: !hasLabel
            ? placeholder
            : (!useLabelAsPlaceholder && focused ? placeholder : undefined),
    };
}
