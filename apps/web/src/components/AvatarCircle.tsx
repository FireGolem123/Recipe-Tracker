interface AvatarCircleProps {
  name: string;
  sizePx: number;
  selected?: boolean;
  className?: string;
}

export function AvatarCircle({ name, sizePx, selected, className = "" }: AvatarCircleProps) {
  const initial = name.trim().charAt(0).toUpperCase();
  const fontSizePx = Math.round(sizePx * 0.34);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-placeholder font-body text-ink ${className}`}
      style={{
        width: sizePx,
        height: sizePx,
        fontSize: fontSizePx,
        boxShadow: selected ? "0 0 0 2.5px #B4552F" : undefined,
      }}
    >
      {initial}
    </div>
  );
}
