import type { ComponentProps } from 'react';
import {
  Award, BookMarked, BookOpen, Briefcase, Building2, ChartColumn, Cloud, Code2, Compass, Database,
  Eye, FileText, FlaskConical, FolderOpen, Hammer, Lightbulb, Link2, Lock, MapPin, Medal, MessageSquare,
  Mic, Monitor, Package, PenLine, Rocket, Scale, Search, Shield, Star, Target, Trophy, User, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons by name, for the places where the name is data: a resume highlight
 * row in site_content can say `"icon": "lock"` and get the same glyph the
 * code uses. Components with a fixed set of icons import from lucide-react
 * directly; this registry is the boundary for strings.
 *
 * Emoji used to fill this role. They render differently on every OS, cannot
 * take the current colour, and sit on the baseline like text (ADR-044).
 */
export const ICONS = {
  award: Award,
  'book-marked': BookMarked,
  'book-open': BookOpen,
  briefcase: Briefcase,
  building: Building2,
  chart: ChartColumn,
  cloud: Cloud,
  code: Code2,
  compass: Compass,
  database: Database,
  eye: Eye,
  file: FileText,
  flask: FlaskConical,
  folder: FolderOpen,
  hammer: Hammer,
  lightbulb: Lightbulb,
  link: Link2,
  lock: Lock,
  'map-pin': MapPin,
  medal: Medal,
  message: MessageSquare,
  mic: Mic,
  monitor: Monitor,
  package: Package,
  pen: PenLine,
  rocket: Rocket,
  scale: Scale,
  search: Search,
  shield: Shield,
  star: Star,
  target: Target,
  trophy: Trophy,
  user: User,
  wrench: Wrench,
  zap: Zap,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function isIconName(x: unknown): x is IconName {
  return typeof x === 'string' && x in ICONS;
}

export interface IconProps extends Omit<ComponentProps<LucideIcon>, 'name'> {
  name: IconName;
}

/** Decorative by default: `aria-hidden` unless a label is given. */
export default function Icon({ name, size = 16, strokeWidth = 2, ...rest }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden={rest['aria-label'] ? undefined : true} {...rest} />;
}
