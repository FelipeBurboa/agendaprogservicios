interface Props {
  message: string;
  onRetry: () => void;
}

export default function ErrorView({ message, onRetry }: Props) {
  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6 pt-20">
      {/* Error icon */}
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-white/90">
        Error en la extracción
      </h2>

      {/* Error message */}
      <div className="w-full bg-surface rounded-lg p-4">
        <p className="text-sm text-red-400/90 break-words">{message}</p>
      </div>

      {/* Retry button */}
      <button
        onClick={onRetry}
        className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 cursor-pointer"
      >
        Reintentar
      </button>
    </div>
  );
}
