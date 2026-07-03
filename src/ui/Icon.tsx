import {
  IconBug,
  IconSettings,
  IconX,
  IconCircleCheck,
  IconAlertCircle,
  IconLock,
  IconSquare,
  IconArrowUpRight,
  IconTypography,
  IconGridDots,
  IconPaperclip,
  IconSend,
  IconExternalLink,
  IconClipboard,
  IconArrowsMaximize,
  IconArrowsMinimize,
  type IconProps,
} from '@tabler/icons-react'
import type { FC } from 'react'

const MAP: Record<string, FC<IconProps>> = {
  bug: IconBug,
  settings: IconSettings,
  x: IconX,
  'circle-check': IconCircleCheck,
  'alert-circle': IconAlertCircle,
  lock: IconLock,
  square: IconSquare,
  'arrow-up-right': IconArrowUpRight,
  typography: IconTypography,
  'grid-dots': IconGridDots,
  paperclip: IconPaperclip,
  send: IconSend,
  'external-link': IconExternalLink,
  clipboard: IconClipboard,
  maximize: IconArrowsMaximize,
  minimize: IconArrowsMinimize,
}

export function Icon({ name, size = 16 }: { name: keyof typeof MAP | string; size?: number }) {
  const C = MAP[name] ?? IconSquare
  return <C size={size} stroke={2} />
}
