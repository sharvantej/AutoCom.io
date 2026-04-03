interface PlaceholderProps {
  title: string;
}

export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="flex-1 flex items-center justify-center page-pop">
      <span
        className="text-[14px]"
        style={{ color: "rgba(249,250,251,0.3)", fontFamily: "'JetBrains Mono', monospace" }}
      >
        {title}
      </span>
    </div>
  );
}
