/*
 * graphite components.
 *
 * Import from here, not from the individual files:
 *   import { Button, Chip, Tabs } from '@/lib/graphite/components';
 *
 * These exist so class and token can never be mismatched. In v1 every button
 * meant pairing `className="g-btn-solid"` with `style={BTN_SOLID}` by hand, and
 * four different mistakes were possible - wrong class, missing class, crossed
 * pair, or an inline background that killed hover. There is nothing to pair now.
 *
 * Prefer these over hand-rolled markup. Reach for raw classes and tokens only
 * for something genuinely outside this set, and read references/components.md
 * first if you do.
 */

export { Button, buttonIconSize } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';

export { Chip, ChipAction, ChipAdd, ChipGroup } from './Chip';
export type { ChipActionProps, ChipAddProps, ChipProps } from './Chip';

export { Card, CardLink, CardRow } from './Card';
export type { CardLinkProps, CardProps, CardTone } from './Card';

export { IconCircle } from './IconCircle';
export type { IconCircleProps, IconCircleTone } from './IconCircle';

export { Option } from './Option';
export type { OptionProps } from './Option';

export { Tabs } from './Tabs';
export type { TabItem, TabsProps } from './Tabs';

export type { LayoutStyle } from './style';
