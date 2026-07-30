export type AppMode = "exportar" | "importar";

interface Props {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
  disabled?: boolean;
}

const MODES: Array<{ value: AppMode; label: string; hint: string }> = [
  { value: "exportar", label: "Exportar", hint: "AgendaPro a Excel" },
  { value: "importar", label: "Importar", hint: "Excel a VentaPlay" },
];

export default function ModeSwitch({ mode, onChange, disabled }: Props) {
  return (
    <div className="w-full max-w-md mb-5">
      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
        {MODES.map((option) => {
          const active = option.value === mode;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              disabled={disabled}
              title={option.hint}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "bg-gradient-to-r from-brand-purple to-[#A033FF] text-white shadow-[0_0_18px_rgba(140,0,255,0.35)]"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
