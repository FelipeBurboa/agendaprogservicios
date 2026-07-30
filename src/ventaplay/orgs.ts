import { supabase } from "./client.js";

export interface OrgSummary {
  id: string;
  nombre: string;
}

export async function listOrganizaciones(): Promise<OrgSummary[]> {
  const { data, error } = await supabase
    .from("organizaciones")
    .select("id, nombre")
    .order("nombre");

  if (error) {
    throw new Error(`No se pudieron cargar las organizaciones: ${error.message}`);
  }

  return (data ?? []) as OrgSummary[];
}
