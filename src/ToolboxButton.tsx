interface ToolboxButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  title?: string;
}

export default function ToolboxButton({ label, onClick, active = false, title }: ToolboxButtonProps) {
  return (
    <button
      className={`view-toggle-btn ${active ? "active" : ""}`}
      onClick={onClick}
      title={title}
    >{label}</button>
  );
}
