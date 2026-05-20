import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
export type MapTabBarButtonProps = BottomTabBarButtonProps & {
    onNavigateToHost?: () => void;
};
/** Map (or host) tab: dismiss messenger when returning. */
export declare function MapTabBarButton({ onNavigateToHost, ...props }: MapTabBarButtonProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=MapTabBarButton.d.ts.map