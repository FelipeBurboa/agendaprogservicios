import type { ImporterEntity } from "../../types.ts";
import { useEnterAnimation } from "../../hooks/useEnterAnimation.ts";

export type ImporterTarget = ImporterEntity | "atenciones";

interface Props {
  orgNombre: string;
  onSelect: (target: ImporterTarget) => void;
  onChangeOrg: () => void;
  onLogout: () => void;
}

interface EntityCard {
  target: ImporterTarget;
  label: string;
  description: string;
}

/**
 * Listed in migration order, not alphabetically: each step depends on the
 * lookups the previous ones created (citas needs profesionales + servicios,
 * atenciones needs citas, and so on).
 */
const ENTITIES: EntityCard[] = [
  {
    target: "sucursales",
    label: "Sucursales",
    description: "Locales y direcciones",
  },
  {
    target: "servicios",
    label: "Servicios",
    description: "Catalogo, precios y tags",
  },
  {
    target: "productos",
    label: "Productos",
    description: "Inventario y stock por sucursal",
  },
  {
    target: "profesionales",
    label: "Profesionales",
    description: "Equipo por sucursal",
  },
  {
    target: "comisiones",
    label: "Comisiones",
    description: "Servicios y productos por profesional",
  },
  {
    target: "clientes",
    label: "Clientes",
    description: "Contactos, RUT y segmentos",
  },
  {
    target: "citas",
    label: "Citas",
    description: "Reservas historicas por sucursal",
  },
  {
    target: "bloqueos",
    label: "Bloqueos",
    description: "Horarios no disponibles",
  },
  {
    target: "atenciones",
    label: "Generar atenciones",
    description: "Desde citas completadas",
  },
];

export default function EntityMenu({
  orgNombre,
  onSelect,
  onChangeOrg,
  onLogout,
}: Props) {
  const containerRef = useEnterAnimation<HTMLDivElement>("menu");

  return (
    <div
      ref={containerRef}
      data-anim
      className="w-full max-w-md flex flex-col gap-5 pt-6"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-white/40">Organizacion</p>
          <p className="text-sm text-white/85 truncate">{orgNombre}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onChangeOrg}
            className="text-xs text-brand-purple hover:text-white transition-colors cursor-pointer"
          >
            Cambiar
          </button>
          <span className="text-white/20">|</span>
          <button
            onClick={onLogout}
            className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-white/90">
          Que quieres importar
        </h2>
        <p className="text-sm text-white/55">
          Sigue el orden sugerido: cada paso usa los datos del anterior.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ENTITIES.map((entity, index) => (
          <button
            key={entity.target}
            data-stagger
            onClick={() => onSelect(entity.target)}
            className="group flex flex-col gap-1 text-left rounded-xl border border-border bg-surface px-4 py-3.5 hover:border-brand-purple hover:bg-brand-purple/10 transition-colors duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-purple/20 text-[10px] font-bold text-brand-purple">
                {index + 1}
              </span>
              <span className="text-sm font-semibold text-white/85 group-hover:text-white">
                {entity.label}
              </span>
            </div>
            <span className="text-xs text-white/45 leading-snug">
              {entity.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
