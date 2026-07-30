import { useEffect, useState } from "react";
import type {
  ImporterEntity,
  ImporterProgressPayload,
  OrgSummary,
} from "../../types.ts";
import EntityMenu, { type ImporterTarget } from "./EntityMenu.tsx";
import GenerarAtencionesView from "./GenerarAtencionesView.tsx";
import ImporterRunView from "./ImporterRunView.tsx";
import OrgSelector from "./OrgSelector.tsx";
import VentaPlayLogin from "./VentaPlayLogin.tsx";

type ImporterView = "login" | "orgs" | "menu" | "run" | "atenciones";

const ENTITY_LABELS: Record<ImporterTarget, string> = {
  sucursales: "Sucursales",
  servicios: "Servicios",
  productos: "Productos",
  profesionales: "Profesionales",
  comisiones: "Comisiones",
  clientes: "Clientes",
  citas: "Citas",
  bloqueos: "Bloqueos",
  atenciones: "Atenciones",
};

export default function ImporterShell() {
  const [view, setView] = useState<ImporterView>("login");
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [entity, setEntity] = useState<ImporterEntity>("sucursales");
  const [progress, setProgress] = useState<ImporterProgressPayload | null>(null);

  // Session survives switching between Exportar and Importar, so re-check on
  // mount instead of assuming a fresh login is needed.
  useEffect(() => {
    let cancelled = false;

    window.electronAPI
      .importerSessionStatus()
      .then((status) => {
        if (!cancelled && status.loggedIn) setView("orgs");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.electronAPI.removeImporterProgressListeners();
    window.electronAPI.onImporterProgress((payload) => setProgress(payload));

    return () => {
      window.electronAPI.removeImporterProgressListeners();
    };
  }, []);

  const handleSelectTarget = (target: ImporterTarget) => {
    setProgress(null);
    if (target === "atenciones") {
      setView("atenciones");
      return;
    }
    setEntity(target);
    setView("run");
  };

  const handleLogout = () => {
    void window.electronAPI.importerLogout();
    setOrg(null);
    setView("login");
  };

  if (view === "login") {
    return <VentaPlayLogin onSuccess={() => setView("orgs")} />;
  }

  // Every view below needs an organization, so an unset org falls back to the
  // picker rather than rendering a broken screen.
  if (view === "orgs" || !org) {
    return (
      <OrgSelector
        onSelect={(selected) => {
          setOrg(selected);
          setView("menu");
        }}
      />
    );
  }

  if (view === "menu") {
    return (
      <EntityMenu
        orgNombre={org.nombre}
        onSelect={handleSelectTarget}
        onChangeOrg={() => setView("orgs")}
        onLogout={handleLogout}
      />
    );
  }

  if (view === "atenciones") {
    return (
      <GenerarAtencionesView
        organizacionId={org.id}
        orgNombre={org.nombre}
        progress={progress}
        onBack={() => setView("menu")}
      />
    );
  }

  return (
    <ImporterRunView
      entity={entity}
      label={ENTITY_LABELS[entity]}
      organizacionId={org.id}
      orgNombre={org.nombre}
      progress={progress}
      onBack={() => setView("menu")}
    />
  );
}
