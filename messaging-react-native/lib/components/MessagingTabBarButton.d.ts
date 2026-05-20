import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
export type MessagingTabBarButtonProps = BottomTabBarButtonProps & {
    /** Host navigates to the screen that hosts MessagingOverlay (e.g. map tab). */
    onNavigateToHost: () => void;
};
/** Messages tab: open host screen + messenger panel. */
export declare function MessagingTabBarButton({ onNavigateToHost, ...props }: MessagingTabBarButtonProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=MessagingTabBarButton.d.ts.map