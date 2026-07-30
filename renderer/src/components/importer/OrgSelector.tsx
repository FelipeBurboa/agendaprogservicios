import { useEffect, useMemo, useState } from "react";
import type { OrgSummary } from "../../types.ts";
import { useEnterAnimation } from "../../hooks/useEnterAnimation.ts";

interface Props {
  onSelect: (org: OrgSummary) => void;
}

const MAX_VISIBLE = 25;

export default function OrgSelector({ onSelect }: Props) {
  const containerRef = useEnterAnimation<HTMLDivElement>("orgs");
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    window.electronAPI
      .importerListOrgs()
      .then((list) => {
        if (!cancelled) setOrgs(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The full list runs to dozens of orgs, which is noise when the point of the
  // screen is to find one. Nothing renders until there's something to match.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return orgs.filter((org) => org.nombre.toLowerCase().includes(needle));
  }, [orgs, query]);

  const visible = matches.slice(0, MAX_VISIBLE);
  const searching = query.trim().length > 0;

  return (
    <div
      ref={containerRef}
      data-anim
      className="w-full max-w-md flex flex-col items-center gap-5 pt-8"
    >
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white/90">
          Elegir organizacion
        </h2>
        <p className="text-sm text-white/55">
          Todos los datos se importaran en la organizacion que selecciones.
        </p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        disabled={loading || Boolean(error)}
        placeholder={
          loading ? "Cargando..." : `Buscar entre ${orgs.length} organizaciones`
        }
        className="w-full px-4 py-2.5 rounded-lg bg-surface-light border border-border text-white placeholder-white/40 outline-none focus:border-brand-purple transition-colors disabled:opacity-50"
      />

      {error && (
        <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && !searching && (
        <p className="text-sm text-white/35 py-6 text-center">
          Escribe el nombre para buscar.
        </p>
      )}

      {searching && matches.length === 0 && (
        <p className="text-sm text-white/40 py-6 text-center">
          Ninguna organizacion coincide con "{query.trim()}".
        </p>
      )}

      {matches.length > MAX_VISIBLE && (
        <p className="w-full text-xs text-white/35">
          Mostrando {MAX_VISIBLE} de {matches.length}. Afina la busqueda.
        </p>
      )}

      <div className="w-full flex flex-col gap-2">
        {visible.map((org) => (
          <button
            key={org.id}
            onClick={() => onSelect(org)}
            className="w-full text-left px-4 py-3 rounded-xl border border-border bg-surface hover:border-brand-purple hover:bg-brand-purple/10 transition-colors duration-200 cursor-pointer"
          >
            <span className="text-sm text-white/85">{org.nombre}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
