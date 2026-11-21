// Иконки SÖRE — библиотека Lucide (ISC), один набор на весь сайт.
// Цвет — currentColor, линия 1.75px. Иконки декоративные (скрыты от скринридеров): смысл несёт текст рядом.
// У каждой иконки своё движение при наведении на кнопку или ссылку (классы icon--* в src/app/motion.css).
import {
  ArrowLeft,
  GripVertical,
  Camera,
  Check,
  Download,
  FileSpreadsheet,
  ChevronLeft,
  MessageCircle,
  Minus,
  Moon,
  Package,
  Plus,
  QrCode,
  Search,
  Send,
  Share2,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";

type IconProps = { className?: string; size?: number };

/** Движение иконки при наведении (см. motion.css). */
type IconMotion = "nudge" | "back" | "bounce" | "spin" | "fly" | "pop" | "shake" | "swing";

function iconFrom(Icon: LucideIcon, motion: IconMotion) {
  function SoreIcon({ className, size = 20 }: IconProps) {
    const base = `icon icon--${motion}`;
    return (
      <Icon
        className={className ? `${base} ${className}` : base}
        size={size}
        strokeWidth={1.75}
        aria-hidden="true"
        focusable="false"
      />
    );
  }
  return SoreIcon;
}

export const BackIcon = iconFrom(ChevronLeft, "back");
export const ArrowBackIcon = iconFrom(ArrowLeft, "back");
export const PlusIcon = iconFrom(Plus, "spin");
export const MinusIcon = iconFrom(Minus, "nudge");
export const CartIcon = iconFrom(ShoppingCart, "bounce");
export const CameraIcon = iconFrom(Camera, "pop");
export const AiIcon = iconFrom(Sparkles, "pop");
export const ShareIcon = iconFrom(Share2, "nudge");
export const TelegramIcon = iconFrom(Send, "fly");
export const WhatsAppIcon = iconFrom(MessageCircle, "swing");
export const CheckIcon = iconFrom(Check, "pop");
export const TrashIcon = iconFrom(Trash2, "swing");
export const SearchIcon = iconFrom(Search, "nudge");
export const QrIcon = iconFrom(QrCode, "pop");
export const ShopIcon = iconFrom(Store, "bounce");
export const BoxIcon = iconFrom(Package, "bounce");
export const SunIcon = iconFrom(Sun, "spin");
export const MoonIcon = iconFrom(Moon, "swing");
export const FileIcon = iconFrom(FileSpreadsheet, "bounce");
export const DownloadIcon = iconFrom(Download, "bounce");
export const UploadIcon = iconFrom(Upload, "nudge");

export const GripIcon = iconFrom(GripVertical, "nudge");
