import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProgressTracker,
  errorMessage,
  throwIfAborted,
  type ImportContext,
  type ImportResult,
} from "../types.js";
import { parseFile } from "../xlsx-parse.js";

/**
 * Port of ventaplaymrm/src/hooks/import/useBulkProductosImport.ts plus the
 * service it wraps, ventaplaymrm/src/components/ecommerce-stock/services/
 * ImportarProductosExternoService.ts. Both live here because the hook is a thin
 * shell around the service.
 *
 * Upsert by SKU (INSERT, then catch 23505 / unique_sku_per_org and UPDATE),
 * auto-creates marca (`proveedores_stock`) and categoria
 * (`categorias_productos`), and rewrites `stock_por_ubicacion` delete-then-insert
 * from the dynamic `Stock {sucursal}` columns.
 */

/**
 * The web hook hardcodes `permitirPrecioMenorQueCosto: true` (AgendaPro
 * exports legitimately contain products priced under cost).
 *
 * `usarStockPorSucursal` is a checkbox in the web tab. Here it comes from
 * ctx.options and defaults ON, because this app's own product export always
 * emits `Stock {sucursal}` columns -- but a file lacking them would otherwise
 * hard-throw, so the UI can turn it off.
 */
const PERMITIR_PRECIO_MENOR_QUE_COSTO = true;

// SKUs that are pure 8-14 digit strings are EAN/UPC barcodes (Agenda Pro stores
// the barcode in the sku field). Mirror it into `barcode` for POS scanning.
const EAN_REGEX = /^\d{8,14}$/;

type UnidadMedida =
  | "unidad"
  | "kg"
  | "gramo"
  | "litro"
  | "ml"
  | "caja"
  | "par"
  | "docena"
  | "metro"
  | "cm";

interface ProductoExternoExcel {
  sku: string;
  categoria: string;
  marca: string;
  nombre: string;
  descripcion?: string;
  barcode?: string;
  unidadMedida?: UnidadMedida;
  costo: number;
  precioVentaExterna: number;
  precioVentaInterna: number;
  stock: number;
  stockPorSucursal?: Record<string, number>;
}

interface ImportarProductosExternoOptions {
  /**
   * Permite importar productos con precio de venta <= costo (incluido 0).
   * Lo usa el importador de Agenda Pro para insumos / productos de uso
   * profesional que no tienen precio de reventa. Default false (comportamiento
   * historico del modal de inventario: rechaza venta <= costo).
   */
  permitirPrecioMenorQueCosto?: boolean;
  /**
   * Cuando es true (default) valida las columnas "Stock {sucursal}" contra las
   * sucursales de la org y escribe stock_por_ubicacion. Cuando es false, ignora
   * las sucursales por completo y solo guarda un stock global
   * (cantidad_disponible), util cuando la sucursal aun no existe en VentaPlay.
   */
  usarStockPorSucursal?: boolean;
}

interface ErrorImportacionExterno {
  fila: number;
  sku: string;
  error: string;
  datosOriginales: ProductoExternoExcel;
}

interface ImportacionExternaResult {
  total: number;
  exitosos: number;
  actualizados: number;
  errores: ErrorImportacionExterno[];
  marcasCreadas: number;
  categoriasCreadas: number;
  stockAsignado: number;
}

const UNIDADES_MEDIDA_VALIDAS: readonly UnidadMedida[] = [
  "unidad",
  "kg",
  "gramo",
  "litro",
  "ml",
  "caja",
  "par",
  "docena",
  "metro",
  "cm",
];

function normalizarUnidadMedida(valor: unknown): UnidadMedida {
  const unidad = String(valor ?? "")
    .trim()
    .toLowerCase();

  if (!unidad) {
    return "unidad";
  }

  const alias: Record<string, UnidadMedida> = {
    unidad: "unidad",
    unidades: "unidad",
    uni: "unidad",
    unid: "unidad",
    kg: "kg",
    kilo: "kg",
    kilos: "kg",
    kilogramo: "kg",
    kilogramos: "kg",
    g: "gramo",
    gr: "gramo",
    gramo: "gramo",
    gramos: "gramo",
    l: "litro",
    lt: "litro",
    litro: "litro",
    litros: "litro",
    ml: "ml",
    mililitro: "ml",
    mililitros: "ml",
    caja: "caja",
    cajas: "caja",
    par: "par",
    pares: "par",
    docena: "docena",
    docenas: "docena",
    m: "metro",
    metro: "metro",
    metros: "metro",
    cm: "cm",
    centimetro: "cm",
    centimetros: "cm",
    centímetro: "cm",
    centímetros: "cm",
  };

  const unidadNormalizada = alias[unidad] ?? unidad;
  return UNIDADES_MEDIDA_VALIDAS.includes(unidadNormalizada as UnidadMedida)
    ? (unidadNormalizada as UnidadMedida)
    : "unidad";
}

export async function importProductos(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("productos", ctx.onProgress);

  tracker.patch({ status: "parsing", message: "Leyendo archivo..." }, true);
  const { rows } = parseFile(filePath);

  if (rows.length === 0) {
    throw new Error("El archivo no contiene datos");
  }

  throwIfAborted(ctx.signal);

  const productos: ProductoExternoExcel[] = parsearExcelExterno(rows).map(
    (producto) => {
      if (!producto.barcode && EAN_REGEX.test(producto.sku.trim())) {
        return { ...producto, barcode: producto.sku.trim() };
      }
      return producto;
    },
  );

  // The web hook leaves totalBatches at 0: the service walks products one by
  // one, there is no batching.
  tracker.patch(
    {
      total: productos.length,
      totalBatches: 0,
      status: "importing",
      message: "Importando productos...",
    },
    true,
  );

  const servicio = new ImportarProductosExternoService(ctx, {
    permitirPrecioMenorQueCosto: PERMITIR_PRECIO_MENOR_QUE_COSTO,
    usarStockPorSucursal: ctx.options?.usarStockPorSucursal ?? true,
  });

  const importResult = await servicio.importar(productos, tracker);

  const creados = Math.max(
    importResult.exitosos - importResult.actualizados,
    0,
  );

  tracker.patch({
    processed: productos.length,
    successful: creados,
    updated: importResult.actualizados,
    skipped: 0,
  });

  return tracker.toResult();
}

/**
 * Servicio para importar productos desde archivos externos (ej: sistemas de
 * terceros). Crea automaticamente marcas (proveedores) y categorias si no
 * existen. Soporta stock por sucursal si la org tiene sucursales configuradas.
 */
class ImportarProductosExternoService {
  private supabase: SupabaseClient;
  private organizacionId: string;
  private signal: AbortSignal;
  private permitirPrecioMenorQueCosto: boolean;
  private usarStockPorSucursal: boolean;
  private marcasCache: Map<string, string> = new Map(); // nombre -> id
  private categoriasCache: Map<string, string> = new Map(); // nombre -> id
  private sucursalesCache: Map<string, string> = new Map(); // nombre -> id

  constructor(ctx: ImportContext, options: ImportarProductosExternoOptions = {}) {
    this.supabase = ctx.supabase;
    this.organizacionId = ctx.organizacionId;
    this.signal = ctx.signal;
    this.permitirPrecioMenorQueCosto =
      options.permitirPrecioMenorQueCosto ?? false;
    this.usarStockPorSucursal = options.usarStockPorSucursal ?? true;
  }

  /**
   * Importa productos desde un array de datos del Excel. The web version takes
   * an `onProgress(pct)` callback; here the tracker is patched directly at the
   * same point in the loop.
   */
  async importar(
    productos: ProductoExternoExcel[],
    tracker: ProgressTracker,
  ): Promise<ImportacionExternaResult> {
    const result: ImportacionExternaResult = {
      total: productos.length,
      exitosos: 0,
      actualizados: 0,
      errores: [],
      marcasCreadas: 0,
      categoriasCreadas: 0,
      stockAsignado: 0,
    };

    // Cargar marcas y categorias existentes en cache
    await this.cargarCaches();

    // Solo carga/valida sucursales cuando se importa stock por sucursal.
    // En modo global se ignoran por completo (no se requiere que existan).
    if (this.usarStockPorSucursal) {
      // Cargar sucursales de la org
      const { data: sucursalesData } = await this.supabase
        .from("sucursales")
        .select("id, nombre")
        .eq("organizacion_id", this.organizacionId)
        .order("nombre");

      if (sucursalesData) {
        sucursalesData.forEach((s: any) =>
          this.sucursalesCache.set(s.nombre, s.id),
        );
      }

      const orgTieneSucursales = this.sucursalesCache.size > 0;

      // Validar nombres de sucursales del Excel vs existentes
      const primerProductoConStock = productos.find(
        (p) => p.stockPorSucursal && Object.keys(p.stockPorSucursal).length > 0,
      );
      if (primerProductoConStock?.stockPorSucursal) {
        const nombresExcel = Object.keys(primerProductoConStock.stockPorSucursal);
        const nombresNoEncontrados = nombresExcel.filter(
          (n) => !this.sucursalesCache.has(n),
        );
        if (nombresNoEncontrados.length > 0) {
          throw new Error(
            `Las siguientes sucursales del Excel no existen en el sistema: ${nombresNoEncontrados.join(", ")}. ` +
              `Sucursales disponibles: ${Array.from(this.sucursalesCache.keys()).join(", ")}`,
          );
        }
      } else if (orgTieneSucursales) {
        // Org tiene sucursales pero el Excel no tiene columnas "Stock Sucursal *"
        throw new Error(
          'Esta organización tiene sucursales configuradas. El archivo debe incluir columnas "Stock {nombre}" ' +
            `para cada sucursal: ${Array.from(this.sucursalesCache.keys()).join(", ")}`,
        );
      }
    }

    // Procesar cada producto
    for (let i = 0; i < productos.length; i++) {
      // The web abort() is cosmetic because the service runs as one call; the
      // per-product boundary is where cancel can actually take effect here.
      throwIfAborted(this.signal);

      const producto = productos[i];
      const fila = i + 2; // +2 porque Excel empieza en 1 y hay encabezado

      try {
        // 1. Obtener o crear marca (proveedor)
        const proveedorId = await this.obtenerOCrearMarca(producto.marca);
        if (proveedorId && !this.marcasCache.has(producto.marca)) {
          result.marcasCreadas++;
        }

        // 2. Obtener o crear categoria
        const categoriaId = await this.obtenerOCrearCategoria(
          producto.categoria,
        );
        if (categoriaId && !this.categoriasCache.has(producto.categoria)) {
          result.categoriasCreadas++;
        }

        // 3. Crear o actualizar producto
        const { id: productoId, actualizado } =
          await this.crearOActualizarProducto(
            producto,
            proveedorId,
            categoriaId,
          );

        if (actualizado) {
          result.actualizados++;
        }

        // 4. Crear stock por sucursal si aplica (solo en modo por sucursal)
        if (
          this.usarStockPorSucursal &&
          productoId &&
          producto.stockPorSucursal &&
          Object.keys(producto.stockPorSucursal).length > 0
        ) {
          // Eliminar stock anterior de este producto para re-insertar
          await this.supabase
            .from("stock_por_ubicacion")
            .delete()
            .eq("producto_id", productoId)
            .eq("organizacion_id", this.organizacionId);

          const stockRecords = Object.entries(producto.stockPorSucursal).map(
            ([nombreSuc, cantidad]) => ({
              producto_id: productoId,
              organizacion_id: this.organizacionId,
              ubicacion_nombre: nombreSuc,
              sucursal_id: this.sucursalesCache.get(nombreSuc) || null,
              cantidad,
            }),
          );
          const { error: stockError } = await this.supabase
            .from("stock_por_ubicacion")
            .insert(stockRecords);
          if (stockError) {
            console.error(
              "Error creando stock por sucursal:",
              stockError.message,
              { productoId },
            );
          } else {
            result.stockAsignado++;
          }
        }

        result.exitosos++;
      } catch (error) {
        result.errores.push({
          fila,
          sku: producto.sku || "SIN SKU",
          error: errorMessage(error),
          datosOriginales: producto,
        });
        tracker.addError({
          row: fila,
          error: errorMessage(error),
          data: producto.sku || "SIN SKU",
        });
      }

      // Reportar progreso
      tracker.patch({
        processed: i + 1,
        successful: Math.max(result.exitosos - result.actualizados, 0),
        updated: result.actualizados,
        skipped: 0,
      });
    }

    return result;
  }

  /**
   * Carga marcas y categorias existentes en cache para evitar consultas
   * repetidas.
   */
  private async cargarCaches(): Promise<void> {
    // Cargar proveedores (marcas)
    const { data: proveedores } = await this.supabase
      .from("proveedores_stock")
      .select("id, nombre")
      .eq("organizacion_id", this.organizacionId)
      .eq("activo", true);

    if (proveedores) {
      proveedores.forEach((p: any) => {
        this.marcasCache.set(p.nombre.toUpperCase(), p.id);
      });
    }

    // Cargar categorias
    const { data: categorias } = await this.supabase
      .from("categorias_productos")
      .select("id, nombre")
      .eq("organizacion_id", this.organizacionId)
      .eq("activa", true);

    if (categorias) {
      categorias.forEach((c: any) => {
        this.categoriasCache.set(c.nombre.toUpperCase(), c.id);
      });
    }
  }

  /**
   * Obtiene el ID de una marca existente o la crea si no existe.
   */
  private async obtenerOCrearMarca(nombreMarca: string): Promise<string | null> {
    if (!nombreMarca || nombreMarca.trim() === "") return null;

    const nombreNormalizado = nombreMarca.trim().toUpperCase();

    // Verificar cache
    if (this.marcasCache.has(nombreNormalizado)) {
      return this.marcasCache.get(nombreNormalizado)!;
    }

    // Crear nueva marca
    const { data, error } = await this.supabase
      .from("proveedores_stock")
      .insert({
        organizacion_id: this.organizacionId,
        nombre: nombreMarca.trim(),
        activo: true,
      })
      .select("id")
      .single();

    if (error) {
      // Si ya existe (race condition), obtenerla
      if (error.code === "23505") {
        const { data: existente } = await this.supabase
          .from("proveedores_stock")
          .select("id")
          .eq("organizacion_id", this.organizacionId)
          .eq("nombre", nombreMarca.trim())
          .single();

        if (existente) {
          this.marcasCache.set(nombreNormalizado, existente.id);
          return existente.id;
        }
      }
      throw new Error(`Error al crear marca "${nombreMarca}": ${error.message}`);
    }

    // Agregar al cache
    this.marcasCache.set(nombreNormalizado, data.id);
    return data.id;
  }

  /**
   * Obtiene el ID de una categoria existente o la crea si no existe.
   */
  private async obtenerOCrearCategoria(
    nombreCategoria: string,
  ): Promise<string | null> {
    if (!nombreCategoria || nombreCategoria.trim() === "") return null;

    const nombreNormalizado = nombreCategoria.trim().toUpperCase();

    // Verificar cache
    if (this.categoriasCache.has(nombreNormalizado)) {
      return this.categoriasCache.get(nombreNormalizado)!;
    }

    // Crear nueva categoria
    const { data, error } = await this.supabase
      .from("categorias_productos")
      .insert({
        organizacion_id: this.organizacionId,
        nombre: nombreCategoria.trim(),
        activa: true,
      })
      .select("id")
      .single();

    if (error) {
      // Si ya existe (race condition), obtenerla
      if (error.code === "23505") {
        const { data: existente } = await this.supabase
          .from("categorias_productos")
          .select("id")
          .eq("organizacion_id", this.organizacionId)
          .eq("nombre", nombreCategoria.trim())
          .single();

        if (existente) {
          this.categoriasCache.set(nombreNormalizado, existente.id);
          return existente.id;
        }
      }
      throw new Error(
        `Error al crear categoría "${nombreCategoria}": ${error.message}`,
      );
    }

    // Agregar al cache
    this.categoriasCache.set(nombreNormalizado, data.id);
    return data.id;
  }

  /**
   * Crea un producto o actualiza si ya existe (por SKU).
   * Retorna el ID del producto creado/existente.
   */
  private async crearOActualizarProducto(
    producto: ProductoExternoExcel,
    proveedorId: string | null,
    categoriaId: string | null,
  ): Promise<{ id: string; actualizado: boolean }> {
    // Validar campos requeridos
    if (!producto.sku || producto.sku.trim() === "") {
      throw new Error("SKU es requerido");
    }
    if (!producto.nombre || producto.nombre.trim() === "") {
      throw new Error("Nombre es requerido");
    }
    if (producto.costo === undefined || producto.costo === null) {
      throw new Error("Precio costo es requerido");
    }
    if (
      producto.precioVentaExterna === undefined ||
      producto.precioVentaExterna === null
    ) {
      throw new Error("Precio venta es requerido");
    }
    if (
      !this.permitirPrecioMenorQueCosto &&
      producto.precioVentaExterna <= producto.costo
    ) {
      throw new Error(
        `El precio de venta ($${producto.precioVentaExterna}) debe ser mayor al costo ($${producto.costo})`,
      );
    }

    const sku = producto.sku.trim().toUpperCase();
    const barcode = producto.barcode?.trim() || null;

    const datosProducto = {
      organizacion_id: this.organizacionId,
      sku,
      nombre: producto.nombre.trim(),
      descripcion: producto.descripcion?.trim() || null,
      barcode,
      precio_costo: Math.round(producto.costo),
      precio_venta: Math.round(producto.precioVentaExterna),
      precio_venta_interna:
        producto.precioVentaInterna > 0
          ? Math.round(producto.precioVentaInterna)
          : null,
      cantidad_disponible: producto.stock || 0,
      cantidad_minima: 5,
      proveedor_id: proveedorId,
      categoria_id: categoriaId,
      activo: true,
      destacado: false,
      unidad_medida: producto.unidadMedida || "unidad",
    };

    const { data, error } = await this.supabase
      .from("productos_stock")
      .insert(datosProducto)
      .select("id")
      .single();

    if (error) {
      if (error.message.includes("unique_sku_per_org") || error.code === "23505") {
        // Producto ya existe: buscar por SKU y actualizar
        const { data: existente } = await this.supabase
          .from("productos_stock")
          .select("id")
          .eq("organizacion_id", this.organizacionId)
          .eq("sku", sku)
          .single();

        if (!existente) {
          throw new Error(
            `SKU duplicado pero no se pudo encontrar el producto existente: ${sku}`,
          );
        }

        // Actualizar datos del producto existente. Solo sobrescribe barcode si
        // viene en el archivo (no borra uno existente).
        await this.supabase
          .from("productos_stock")
          .update({
            nombre: producto.nombre.trim(),
            descripcion: datosProducto.descripcion,
            precio_costo: datosProducto.precio_costo,
            precio_venta: datosProducto.precio_venta,
            precio_venta_interna: datosProducto.precio_venta_interna,
            cantidad_disponible: datosProducto.cantidad_disponible,
            proveedor_id: proveedorId,
            categoria_id: categoriaId,
            unidad_medida: datosProducto.unidad_medida,
            ...(barcode ? { barcode } : {}),
          })
          .eq("id", existente.id);

        return { id: existente.id, actualizado: true };
      }
      throw new Error(error.message);
    }

    return { id: data.id, actualizado: false };
  }
}

/**
 * Parsea las filas del Excel al formato esperado por el servicio.
 * Detecta columnas "Stock Sucursal {nombre}" dinamicamente.
 */
function parsearExcelExterno(filas: any[]): ProductoExternoExcel[] {
  if (filas.length === 0) return [];

  // Detectar columnas "Stock Sucursal *" del primer registro
  const primeraFila = filas[0];
  const todasLasColumnas = Object.keys(primeraFila);
  const columnasStockSucursal = todasLasColumnas.filter(
    (col) => /^stock\s/i.test(col) && !col.toLowerCase().startsWith("stock mínimo"),
  );

  return filas.map((row) => {
    // Parsear stock por sucursal
    const stockPorSucursal: Record<string, number> = {};
    for (const col of columnasStockSucursal) {
      const nombreSucursal = col.replace(/^stock\s+/i, "").trim();
      stockPorSucursal[nombreSucursal] = parseInt(row[col] || 0) || 0;
    }

    // Stock total: suma de sucursales si hay, o columna generica "Stock"
    const stockTotal =
      columnasStockSucursal.length > 0
        ? Object.values(stockPorSucursal).reduce((sum, v) => sum + v, 0)
        : parseInt(row["Stock"] || row["stock"] || 0) || 0;

    const barcodeRaw =
      row["Código de Barras"] ??
      row["Codigo de Barras"] ??
      row["Barcode"] ??
      row["barcode"];

    return {
      sku: row["SKU"] || row["sku"] || "",
      categoria: row["Categoría"] || row["Categoria"] || row["categoria"] || "",
      marca: row["Marca"] || row["marca"] || "",
      nombre: row["Nombre"] || row["nombre"] || "",
      descripcion:
        row["Descripción"] ||
        row["Descripcion"] ||
        row["descripción"] ||
        row["descripcion"] ||
        "",
      barcode:
        barcodeRaw != null && String(barcodeRaw).trim() !== ""
          ? String(barcodeRaw).trim()
          : undefined,
      unidadMedida: normalizarUnidadMedida(
        row["Unidad"] ||
          row["Unidad de Medida"] ||
          row["unidad_medida"] ||
          row["Formato"] ||
          row["formato"],
      ),
      costo: parseFloat(row["Costo"] || row["costo"] || 0) || 0,
      precioVentaExterna:
        parseFloat(row["Precio venta externa"] || row["precio_venta_externa"] || 0) ||
        0,
      precioVentaInterna:
        parseFloat(row["Precio venta interna"] || row["precio_venta_interna"] || 0) ||
        0,
      stock: stockTotal,
      stockPorSucursal:
        columnasStockSucursal.length > 0 ? stockPorSucursal : undefined,
    };
  });
}
