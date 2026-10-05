import {
  Snowflake,
  Fan,
  ChefHat,
  Refrigerator,
  Microwave,
  Flame,
  Wind,
  WashingMachine,
  Droplet,
  Thermometer,
  Tv,
  BadgeCheck,
  MessageCircle,
  ShieldCheck,
  AlarmClock,
  MapPin,
  Search,
  User,
  ShoppingCart,
  X,
  Wrench,
  AirVent,
  Filter,
  CookingPot,
  Zap,
  Star,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LayoutGrid,
  Play,
  Film,
  Globe,
  Trash2,
  Plus,
  Package,
  Pencil,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

export type IconKey =
  | "snowflake"
  | "fan"
  | "chef-hat"
  | "refrigerator"
  | "microwave"
  | "flame"
  | "wind"
  | "washing-machine"
  | "dishwasher"
  | "droplet"
  | "thermometer"
  | "tv"
  | "badge-check"
  | "message-circle"
  | "shield-check"
  | "alarm-clock"
  | "map-pin"
  | "search"
  | "user"
  | "shopping-cart"
  | "x"
  | "wrench"
  | "air-vent"
  | "filter"
  | "cooking-pot"
  | "zap"
  | "star"
  | "chevron-right"
  | "chevron-left"
  | "chevron-down"
  | "layout-grid"
  | "play"
  | "film"
  | "globe"
  | "trash"
  | "plus"
  | "package"
  | "pencil"
  | "eye"
  | "eye-off"
  | "check-circle"
  | "x-circle"
  | "clock";

/**
 * A single, consistent icon set (lucide-react) resolved from the string
 * icon keys stored in data files — see PHASE_2_UI_UX_DESIGN.md §5. Written
 * as a switch (rather than indexing into a component map) so each icon is
 * a statically-declared JSX element, which keeps the component
 * compiler-friendly (no component reference is constructed at render time).
 */
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const props = { className, "aria-hidden": true as const };

  switch (name as IconKey) {
    case "snowflake":
      return <Snowflake {...props} />;
    case "fan":
      return <Fan {...props} />;
    case "chef-hat":
      return <ChefHat {...props} />;
    case "refrigerator":
      return <Refrigerator {...props} />;
    case "microwave":
      return <Microwave {...props} />;
    case "flame":
      return <Flame {...props} />;
    case "wind":
      return <Wind {...props} />;
    case "washing-machine":
    case "dishwasher":
      return <WashingMachine {...props} />;
    case "droplet":
      return <Droplet {...props} />;
    case "thermometer":
      return <Thermometer {...props} />;
    case "tv":
      return <Tv {...props} />;
    case "badge-check":
      return <BadgeCheck {...props} />;
    case "message-circle":
      return <MessageCircle {...props} />;
    case "alarm-clock":
      return <AlarmClock {...props} />;
    case "map-pin":
      return <MapPin {...props} />;
    case "search":
      return <Search {...props} />;
    case "user":
      return <User {...props} />;
    case "shopping-cart":
      return <ShoppingCart {...props} />;
    case "x":
      return <X {...props} />;
    case "wrench":
      return <Wrench {...props} />;
    case "air-vent":
      return <AirVent {...props} />;
    case "filter":
      return <Filter {...props} />;
    case "cooking-pot":
      return <CookingPot {...props} />;
    case "zap":
      return <Zap {...props} />;
    case "star":
      return <Star {...props} />;
    case "chevron-right":
      return <ChevronRight {...props} />;
    case "chevron-left":
      return <ChevronLeft {...props} />;
    case "chevron-down":
      return <ChevronDown {...props} />;
    case "layout-grid":
      return <LayoutGrid {...props} />;
    case "play":
      return <Play {...props} />;
    case "film":
      return <Film {...props} />;
    case "globe":
      return <Globe {...props} />;
    case "trash":
      return <Trash2 {...props} />;
    case "plus":
      return <Plus {...props} />;
    case "package":
      return <Package {...props} />;
    case "pencil":
      return <Pencil {...props} />;
    case "eye":
      return <Eye {...props} />;
    case "eye-off":
      return <EyeOff {...props} />;
    case "check-circle":
      return <CheckCircle2 {...props} />;
    case "x-circle":
      return <XCircle {...props} />;
    case "clock":
      return <Clock {...props} />;
    case "shield-check":
    default:
      return <ShieldCheck {...props} />;
  }
}
