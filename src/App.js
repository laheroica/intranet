import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

ChartJS.register(LineElement, BarElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

// ─── Registrar Service Worker (PWA) ───────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => console.log("✅ Service Worker registrado"))
      .catch((err) => console.warn("SW error:", err));
  });
}

// ─── Tema: variables CSS ───────────────────────────────────────────────────────
const TEMAS = {
  oscuro: {
    fondo: "#0f0f1a",
    superficie: "#1a1a2e",
    superficie2: "#16213e",
    borde: "#2d2d4e",
    texto: "#e8e8f0",
    textoSuave: "#9090b0",
    acento: "#4f8ef7",
    acentoHover: "#3a7ae0",
    exito: "#2ecc71",
    peligro: "#e74c3c",
    warning: "#f39c12",
    tablaPar: "#1e1e32",
    tablaImpar: "#191928",
    tablaHeader: "#252540",
  },
  claro: {
    fondo: "#f4f6fa",
    superficie: "#ffffff",
    superficie2: "#f0f2f8",
    borde: "#dde2ee",
    texto: "#1a1a2e",
    textoSuave: "#6b7280",
    acento: "#2563eb",
    acentoHover: "#1d4ed8",
    exito: "#16a34a",
    peligro: "#dc2626",
    warning: "#d97706",
    tablaPar: "#f9fafb",
    tablaImpar: "#ffffff",
    tablaHeader: "#e5e7eb",
  }
};

// ─── Credenciales ─────────────────────────────────────────────────────────────
const USUARIOS = {
  admin: { password: "11998844", rol: "admin" },
  pame: { password: "Castresana2020", rol: "cargador" },
};

const NEGOCIOS_CARGADOR = ["Felizcitas", "Athlon 107", "Athlon 24"];

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rolActual, setRolActual] = useState("");

  // ── Tema ──────────────────────────────────────────────────────────────────
  const [modoOscuro, setModoOscuro] = useState(() => {
    const saved = localStorage.getItem("modoOscuro");
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const t = modoOscuro ? TEMAS.oscuro : TEMAS.claro;

  useEffect(() => {
    localStorage.setItem("modoOscuro", modoOscuro);
    document.body.style.backgroundColor = t.fondo;
    document.body.style.color = t.texto;
  }, [modoOscuro]);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [negocio, setNegocio] = useState("");
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [registros, setRegistros] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [totalesMesActual, setTotalesMesActual] = useState({});
  const [mostrarAcumulados, setMostrarAcumulados] = useState(false);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroNegociosMulti, setFiltroNegociosMulti] = useState([]);
  const [filtroMediosMulti, setFiltroMediosMulti] = useState([]);
  const [acumulados, setAcumulados] = useState([]);
  const [acumuladosPorMedioMes, setAcumuladosPorMedioMes] = useState([]);
  const [detalleDiario, setDetalleDiario] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idEnEdicion, setIdEnEdicion] = useState(null);
  const [mostrarCargaDia, setMostrarCargaDia] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState("dashboard");
  const [ultimosDiasPorNegocio, setUltimosDiasPorNegocio] = useState({});
  const [registrosFiltrados, setRegistrosFiltrados] = useState([]);
  const [ultimaFechaGlobal, setUltimaFechaGlobal] = useState(null);
  const [negociosExpandido, setNegociosExpandido] = useState({});

  // ── Edición y Búsqueda por Mes/Año ─────────────────────────────────────────
  const [buscarMesAnioEdicion, setBuscarMesAnioEdicion] = useState(() => {
    const a = new Date();
    return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}`;
  });
  const [buscarNegocioEdicion, setBuscarNegocioEdicion] = useState("todos");

  // ── Evolución Anual ────────────────────────────────────────────────────────
  const [anioEvolucion, setAnioEvolucion] = useState(() => new Date().getFullYear());
  const [negocioEvolucion, setNegocioEvolucion] = useState("todos");

  // ── Gráfico Diario del Mes ──────────────────────────────────────────────────
  const [mesDiario, setMesDiario] = useState(() => {
    const a = new Date();
    return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}`;
  });
  const [negocioDiario, setNegocioDiario] = useState("todos");

  // ─── Negocios y medios ────────────────────────────────────────────────────
  const mediosPorNegocio = {
    Felizcitas: ["Efectivo", "TB Alvaro", "TB Deni", "TB Moni", "MP Alvaro", "MP Deni", "MP Moni", "BLP", "BNA"],
    Terrazas: ["Efectivo", "Débito", "Crédito", "Prepaga", "QR"],
    "El Popular": ["Efectivo", "Débito", "Crédito", "Prepaga", "QR"],
    "Athlon 107": ["Efectivo", "MP Alvaro"],
    "Athlon 24": ["Efectivo", "MP Deni"],
    Alquileres: ["Efectivo"],
    Juegos: ["Efectivo"],
    Xtras: ["Efectivo"],
  };

  const mediosTodos = Array.from(new Set(Object.values(mediosPorNegocio).flat()));
  const negocios = Object.keys(mediosPorNegocio);
  const negociosPermitidos = rolActual === "cargador" ? NEGOCIOS_CARGADOR : negocios;

  const colores = [
    "#4f8ef7", "#2ecc71", "#f39c12", "#e74c3c",
    "#9b59b6", "#1abc9c", "#e67e22", "#3498db",
    "#e91e63", "#00bcd4", "#8bc34a", "#ff5722"
  ];

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoggedIn) {
      cargarRegistros();
      const ahora = new Date();
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      setFiltroFechaDesde(inicio.toISOString().split("T")[0]);
      setFiltroNegociosMulti(Object.keys(mediosPorNegocio));
      setFiltroMediosMulti(mediosTodos);
      setNegociosExpandido(negocios.reduce((acc, n) => ({ ...acc, [n]: false }), {}));
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (ultimaFechaGlobal instanceof Date && !isNaN(ultimaFechaGlobal)) {
      setFiltroFechaHasta(ultimaFechaGlobal.toISOString().split("T")[0]);
    }
  }, [ultimaFechaGlobal]);

  useEffect(() => {
    if (filtroFechaDesde && filtroFechaHasta && filtroNegociosMulti.length > 0 && filtroMediosMulti.length > 0 && registros.length > 0) {
      calcularAcumulados();
      calcularDetalleDiarioFiltrado();
    }
  }, [filtroFechaDesde, filtroFechaHasta, filtroNegociosMulti, filtroMediosMulti, registros]);

  // ─── Carga de datos ───────────────────────────────────────────────────────
  const cargarRegistros = async () => {
    const snapshot = await getDocs(collection(db, "registros"));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const agrupado = {};
    data.forEach(r => {
      if (!agrupado[r.negocio]) agrupado[r.negocio] = [];
      agrupado[r.negocio].push(r.fecha);
    });

    const ultimos = {};
    Object.entries(agrupado).forEach(([neg, fechas]) => {
      const ordenadas = fechas.sort((a, b) => {
        const [da, ma, aa] = a.split("/").map(Number);
        const [db2, mb, ab] = b.split("/").map(Number);
        return new Date(`${ab}-${mb}-${db2}`) - new Date(`${aa}-${ma}-${da}`);
      });
      ultimos[neg] = ordenadas[ordenadas.length - 1];
    });
    setUltimosDiasPorNegocio(ultimos);

    const todasLasFechas = data
      .filter(r => r.fecha && r.fecha.includes("/"))
      .map(r => {
        const [dia, mes, anio] = r.fecha.split("/").map(Number);
        return new Date(`${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
      });

    if (todasLasFechas.length > 0) {
      setUltimaFechaGlobal(new Date(Math.max(...todasLasFechas)));
    }

    setRegistros(data);
    calcularTotalesMesActual(data);
    calcularAcumuladoPorMediosDelMes(data);
  };

  const calcularTotalesMesActual = (datos) => {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();
    const totales = {};
    datos.forEach(r => {
      const [dia, mes, anio] = r.fecha.split("/").map(Number);
      if (mes === mesActual && anio === anioActual) {
        if (!totales[r.negocio]) totales[r.negocio] = 0;
        totales[r.negocio] += parseInt(r.totalDia || 0);
      }
    });
    setTotalesMesActual(totales);
  };

  const calcularAcumuladoPorMediosDelMes = (datos) => {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();
    const totales = {};
    datos.forEach(r => {
      const [dia, mes, anio] = r.fecha.split("/").map(Number);
      if (mes === mesActual && anio === anioActual) {
        Object.entries(r).forEach(([k, v]) => {
          if (mediosTodos.includes(k)) {
            if (!totales[k]) totales[k] = 0;
            totales[k] += Number.isNaN(parseInt(v, 10)) ? 0 : parseInt(v, 10);
          }
        });
      }
    });
    const lista = Object.entries(totales).map(([medio, total]) => ({ medio, total }));
    setAcumuladosPorMedioMes(lista);
  };

  const calcularAcumulados = () => {
    const desde = filtroFechaDesde ? new Date(filtroFechaDesde) : null;
    const hasta = filtroFechaHasta ? new Date(filtroFechaHasta) : null;
    const lista = registros.filter(r => {
      const [dia, mes, anio] = r.fecha.split("/").map(Number);
      const fecha = new Date(`${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
      const dentroRango = (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
      const negocioOK = filtroNegociosMulti.length === 0 || filtroNegociosMulti.includes(r.negocio);
      const mediosOK = filtroMediosMulti.length === 0 || filtroMediosMulti.some(m => r[m]);
      return dentroRango && negocioOK && mediosOK;
    });
    setRegistrosFiltrados(lista);
    const resultado = {};
    lista.forEach(r => {
      Object.entries(r).forEach(([k, v]) => {
        if (mediosTodos.includes(k) && (!filtroMediosMulti.length || filtroMediosMulti.includes(k))) {
          if (!resultado[r.negocio]) resultado[r.negocio] = {};
          if (!resultado[r.negocio][k]) resultado[r.negocio][k] = 0;
          resultado[r.negocio][k] += parseInt(v || 0);
        }
      });
    });
    const arrayFinal = [];
    Object.entries(resultado).forEach(([neg, medios]) => {
      Object.entries(medios).forEach(([medio, total]) => {
        arrayFinal.push({ negocio: neg, medio, total });
      });
    });
    arrayFinal.sort((a, b) => b.total - a.total);
    setAcumulados(arrayFinal);
  };

  const calcularDetalleDiarioFiltrado = () => {
    const lista = registrosFiltrados;
    const agrupado = {};
    lista.forEach(r => {
      if (!agrupado[r.fecha]) agrupado[r.fecha] = {};
      Object.entries(r).forEach(([k, v]) => {
        if (mediosTodos.includes(k)) {
          if (!agrupado[r.fecha][k]) agrupado[r.fecha][k] = 0;
          agrupado[r.fecha][k] += parseInt(v || 0);
        }
      });
    });
    const result = Object.entries(agrupado).map(([fecha, valores]) => ({ fecha, ...valores }));
    result.sort((a, b) => {
      const [da, ma, aa] = a.fecha.split("/").map(Number);
      const [db2, mb, ab] = b.fecha.split("/").map(Number);
      return new Date(`${aa}-${ma}-${da}`) - new Date(`${ab}-${mb}-${db2}`);
    });
    setDetalleDiario(result);
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const eliminarRegistro = async (id) => {
    if (!window.confirm("¿Eliminar este registro de caja?")) return;
    try {
      await deleteDoc(doc(db, "registros", id));
      cargarRegistros();
      alert("✅ Registro eliminado correctamente");
    } catch (error) {
      alert("❌ Error al eliminar.");
    }
  };

  const editarRegistroPorId = (id) => {
    const registro = registros.find(r => r.id === id);
    if (!registro) { alert("No se encontró el registro."); return; }
    setNegocio(registro.negocio);
    const [dia, mes, anio] = registro.fecha.split("/");
    setFechaSeleccionada(`${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`);
    const nuevoForm = {};
    mediosTodos.forEach(m => { nuevoForm[m] = registro[m] || ""; });
    setFormData(nuevoForm);
    setModoEdicion(true);
    setIdEnEdicion(registro.id);
    setMostrarCargaDia(true);
    setSeccionActiva("carga");
    setTimeout(() => {
      document.getElementById("seccion-cargar-dia")?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  const registrosOrdenados = () => {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();
    return [...registros]
      .filter(r => {
        const [d, m, a] = r.fecha.split("/").map(Number);
        return m === mesActual && a === anioActual;
      })
      .sort((a, b) => {
        const [da, ma, aa] = a.fecha.split("/").map(Number);
        const [db2, mb, ab] = b.fecha.split("/").map(Number);
        return new Date(`${ab}-${mb}-${db2}`) - new Date(`${aa}-${ma}-${da}`);
      });
  };

  const calcularIndicadores = () => {
    if (acumulados.length === 0) return null;
    const totalGeneral = acumulados.reduce((acc, r) => acc + r.total, 0);
    const fechasUnicas = new Set(
      registros.filter(r => {
        const [dia, mes, anio] = r.fecha.split("/").map(Number);
        const fecha = new Date(`${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
        const desde = filtroFechaDesde ? new Date(filtroFechaDesde) : null;
        const hasta = filtroFechaHasta ? new Date(filtroFechaHasta) : null;
        return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
      }).map(r => r.fecha)
    );
    const cantidadDias = fechasUnicas.size;
    return { totalGeneral, promedio: cantidadDias > 0 ? totalGeneral / cantidadDias : 0, cantidadDias, cantidadRegistros: acumulados.length };
  };

  // ─── EXPORTACIÓN EXCEL ────────────────────────────────────────────────────
  const exportarTablaAExcel = () => {
    const datosParaExcel = [];
    Object.entries(
      registrosFiltrados.sort((a, b) => {
        const [da, ma, aa] = a.fecha.split("/").map(Number);
        const [db2, mb, ab] = b.fecha.split("/").map(Number);
        return new Date(`${ab}-${mb}-${db2}`) - new Date(`${aa}-${ma}-${da}`);
      }).reduce((acc, reg) => {
        if (!acc[reg.negocio]) acc[reg.negocio] = [];
        acc[reg.negocio].push(reg);
        return acc;
      }, {})
    ).forEach(([neg, regs]) => {
      datosParaExcel.push([neg]);
      datosParaExcel.push(["Fecha", "Negocio", ...mediosTodos, "Total del Día"]);
      regs.forEach(r => {
        datosParaExcel.push([r.fecha, r.negocio, ...mediosTodos.map(m => r[m] || 0), r.totalDia]);
      });
      const subtotales = mediosTodos.map(medio => regs.reduce((acc, r) => acc + parseInt(r[medio] || 0), 0));
      datosParaExcel.push(["", "Subtotal", ...subtotales, regs.reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0)]);
      datosParaExcel.push([]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(datosParaExcel);
    XLSX.utils.book_append_sheet(wb, ws, "Registros");
    const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([blob]), "registros_negocios.xlsx");
  };

  // ─── EXPORTACIÓN A PDF POR EMPRESA ────────────────────────────────────────
  const exportarPdfEmpresa = (negocioSel, mesAnioStr) => {
    let anio, mes;
    if (mesAnioStr && mesAnioStr.includes("-")) {
      [anio, mes] = mesAnioStr.split("-").map(Number);
    } else {
      const ahora = new Date();
      anio = ahora.getFullYear();
      mes = ahora.getMonth() + 1;
    }

    const nombreMes = NOMBRES_MESES[mes - 1] || "";
    const negocioNombre = negocioSel && negocioSel !== "todos" ? negocioSel : "Todas las Empresas";

    const registrosPeriodo = registros.filter(r => {
      const [d, m, a] = r.fecha.split("/").map(Number);
      const matchNeg = !negocioSel || negocioSel === "todos" || r.negocio === negocioSel;
      return m === mes && a === anio && matchNeg;
    });

    registrosPeriodo.sort((a, b) => {
      const [da] = a.fecha.split("/").map(Number);
      const [db2] = b.fecha.split("/").map(Number);
      return da - db2;
    });

    const mediosAmostrar = negocioSel && negocioSel !== "todos" && mediosPorNegocio[negocioSel]
      ? mediosPorNegocio[negocioSel]
      : mediosTodos;

    const subtotalesMedios = {};
    mediosAmostrar.forEach(m => subtotalesMedios[m] = 0);
    let totalGeneralMes = 0;

    registrosPeriodo.forEach(r => {
      mediosAmostrar.forEach(m => {
        const val = parseInt(r[m] || 0, 10);
        subtotalesMedios[m] += val;
      });
      totalGeneralMes += parseInt(r.totalDia || 0, 10);
    });

    const cantDias = new Set(registrosPeriodo.map(r => r.fecha)).size;
    const promedioDiario = cantDias > 0 ? Math.round(totalGeneralMes / cantDias) : 0;

    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reporte ${negocioNombre} - ${nombreMes} ${anio}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 25px; background: #fff; line-height: 1.4; }
          .no-print { margin-bottom: 20px; text-align: right; }
          .btn-print { padding: 12px 24px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; }
          .header { border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
          .kpis { display: flex; gap: 15px; margin-bottom: 25px; }
          .kpi-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
          .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; }
          .kpi-value { font-size: 20px; font-weight: 800; color: #2563eb; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #1e293b; color: #ffffff; padding: 9px 10px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .total-row { background: #e2e8f0 !important; font-weight: 800; font-size: 13px; }
          .text-right { text-align: right; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
        </div>
        <div class="header">
          <div>
            <h1 class="title">📊 Reporte de Ingresos de Caja</h1>
            <div class="subtitle"><strong>Empresa / Negocio:</strong> ${negocioNombre} | <strong>Período:</strong> ${nombreMes} ${anio}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            Emisión: ${new Date().toLocaleDateString("es-AR")} ${new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div class="kpis">
          <div class="kpi-card">
            <div class="kpi-title">Total Facturado</div>
            <div class="kpi-value">$${totalGeneralMes.toLocaleString("es-AR")}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Promedio Diario</div>
            <div class="kpi-value">$${promedioDiario.toLocaleString("es-AR")}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Días Registrados</div>
            <div class="kpi-value">${cantDias} días</div>
          </div>
        </div>

        <h3 style="font-size: 15px; margin: 20px 0 8px; color: #0f172a;">💳 Desglose por Medio de Pago</h3>
        <table>
          <thead>
            <tr>
              <th>Medio de Pago</th>
              <th class="text-right">Monto Recaudado</th>
              <th class="text-right">% Parte del Total</th>
            </tr>
          </thead>
          <tbody>
            ${mediosAmostrar.map(m => {
              const val = subtotalesMedios[m] || 0;
              const pct = totalGeneralMes > 0 ? ((val / totalGeneralMes) * 100).toFixed(1) : "0.0";
              return `<tr><td>${m}</td><td class="text-right">$${val.toLocaleString("es-AR")}</td><td class="text-right">${pct}%</td></tr>`;
            }).join("")}
          </tbody>
        </table>

        <h3 style="font-size: 15px; margin: 25px 0 8px; color: #0f172a;">📋 Listado Completo de Cargas Diarias</h3>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              ${negocioSel === "todos" ? '<th>Negocio</th>' : ''}
              ${mediosAmostrar.map(m => `<th class="text-right">${m}</th>`).join("")}
              <th class="text-right">Total Día</th>
            </tr>
          </thead>
          <tbody>
            ${registrosPeriodo.length === 0 ? `<tr><td colSpan="${mediosAmostrar.length + 2}" style="text-align:center; padding: 20px; color: #64748b;">No hay registros cargados para este período.</td></tr>` : ''}
            ${registrosPeriodo.map(r => `
              <tr>
                <td>${r.fecha}</td>
                ${negocioSel === "todos" ? `<td>${r.negocio}</td>` : ''}
                ${mediosAmostrar.map(m => `<td class="text-right">${r[m] ? '$' + parseInt(r[m]).toLocaleString("es-AR") : '-'}</td>`).join("")}
                <td class="text-right" style="font-weight: 700; color: #16a34a;">$${parseInt(r.totalDia || 0).toLocaleString("es-AR")}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td>TOTAL GENERAL</td>
              ${negocioSel === "todos" ? '<td>-</td>' : ''}
              ${mediosAmostrar.map(m => `<td class="text-right">$${subtotalesMedios[m].toLocaleString("es-AR")}</td>`).join("")}
              <td class="text-right" style="color: #2563eb;">$${totalGeneralMes.toLocaleString("es-AR")}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    win.document.close();
  };

  const formatoMoneda = (valor) => {
    if (!valor) return "$0";
    return "$" + parseInt(valor).toLocaleString("es-AR");
  };

  // ─── Estilos reutilizables ────────────────────────────────────────────────
  const S = {
    app: {
      minHeight: "100vh",
      backgroundColor: t.fondo,
      color: t.texto,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      paddingBottom: 150,
    },
    navBar: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: t.superficie,
      borderTop: `1px solid ${t.borde}`,
      display: "flex",
      justifyContent: "space-around",
      padding: "6px 0",
      zIndex: 1000,
      boxShadow: "0 -2px 10px rgba(0,0,0,0.2)"
    },
    navBtn: (activo) => ({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "6px 12px",
      borderRadius: 12,
      border: "none",
      background: activo ? t.acento + "22" : "transparent",
      color: activo ? t.acento : t.textoSuave,
      cursor: "pointer",
      fontSize: 11,
      fontWeight: activo ? 700 : 400,
      transition: "all 0.2s",
      minWidth: 55,
    }),
    card: {
      backgroundColor: t.superficie,
      border: `1px solid ${t.borde}`,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      boxShadow: modoOscuro ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)"
    },
    input: {
      width: "100%",
      padding: "14px 16px",
      fontSize: 16,
      borderRadius: 12,
      border: `1.5px solid ${t.borde}`,
      backgroundColor: t.superficie2,
      color: t.texto,
      marginBottom: 12,
      boxSizing: "border-box",
      outline: "none",
    },
    select: {
      width: "100%",
      padding: "14px 16px",
      fontSize: 16,
      borderRadius: 12,
      border: `1.5px solid ${t.borde}`,
      backgroundColor: t.superficie2,
      color: t.texto,
      marginBottom: 12,
      boxSizing: "border-box",
      WebkitAppearance: "none",
      appearance: "none",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='${encodeURIComponent(t.textoSuave)}' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 16px center",
    },
    btnPrimary: {
      width: "100%",
      padding: "14px 16px",
      fontSize: 15,
      fontWeight: 700,
      borderRadius: 14,
      border: "none",
      backgroundColor: t.acento,
      color: "#fff",
      cursor: "pointer",
      marginBottom: 10,
      letterSpacing: 0.5,
      transition: "all 0.2s",
    },
    btnSuccess: {
      width: "100%",
      padding: "14px 16px",
      fontSize: 15,
      fontWeight: 700,
      borderRadius: 14,
      border: "none",
      backgroundColor: t.exito,
      color: "#fff",
      cursor: "pointer",
      marginBottom: 10,
    },
    btnDanger: {
      padding: "8px 14px",
      fontSize: 13,
      borderRadius: 8,
      border: "none",
      backgroundColor: t.peligro + "22",
      color: t.peligro,
      cursor: "pointer",
      fontWeight: 600,
    },
    btnSecondary: {
      padding: "10px 16px",
      fontSize: 14,
      borderRadius: 10,
      border: `1.5px solid ${t.borde}`,
      backgroundColor: "transparent",
      color: t.texto,
      cursor: "pointer",
    },
    btnEdit: {
      padding: "8px 14px",
      fontSize: 13,
      borderRadius: 8,
      border: "none",
      backgroundColor: t.acento + "22",
      color: t.acento,
      cursor: "pointer",
      fontWeight: 600,
      marginRight: 6,
    },
    campoMonto: { marginBottom: 14 },
    label: {
      display: "block",
      fontSize: 13,
      fontWeight: 600,
      color: t.textoSuave,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    totalGrande: {
      fontSize: 28,
      fontWeight: 800,
      color: t.acento,
      letterSpacing: -1,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 800,
      marginBottom: 16,
      color: t.texto,
    },
    pageHeader: {
      padding: "20px 20px 12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    tabla: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 13,
      overflowX: "auto",
      display: "block",
    },
    th: {
      backgroundColor: t.tablaHeader,
      padding: "10px 12px",
      textAlign: "left",
      fontWeight: 700,
      fontSize: 12,
      color: t.textoSuave,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      border: `1px solid ${t.borde}`,
      whiteSpace: "nowrap",
    },
    td: (par) => ({
      padding: "10px 12px",
      border: `1px solid ${t.borde}`,
      backgroundColor: par ? t.tablaPar : t.tablaImpar,
      whiteSpace: "nowrap",
    }),
  };

  // ─── Login ────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ ...S.card, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📊</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Intranet Negocios</h2>
          <p style={{ color: t.textoSuave, marginBottom: 24, fontSize: 14 }}>Control de ingresos y caja</p>
          <input
            style={S.input}
            placeholder="Usuario"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            style={S.input}
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const usuario = USUARIOS[username.toLowerCase()];
                if (usuario && usuario.password === password) {
                  setIsLoggedIn(true); setRolActual(usuario.rol);
                } else { alert("Usuario o contraseña incorrectos"); }
              }
            }}
          />
          <button
            style={S.btnPrimary}
            onClick={() => {
              const usuario = USUARIOS[username.toLowerCase()];
              if (usuario && usuario.password === password) {
                setIsLoggedIn(true); setRolActual(usuario.rol);
              } else { alert("Usuario o contraseña incorrectos"); }
            }}
          >
            Entrar →
          </button>
        </div>
      </div>
    );
  }

  // Helper para obtener registros de un mes/año
  const obtenerRegistrosMesAnio = (mesAnioStr, negocioSel) => {
    if (!mesAnioStr || !mesAnioStr.includes("-")) return [];
    const [anio, mes] = mesAnioStr.split("-").map(Number);
    return registros.filter(r => {
      const [d, m, a] = r.fecha.split("/").map(Number);
      const matchNeg = !negocioSel || negocioSel === "todos" || r.negocio === negocioSel;
      return m === mes && a === anio && matchNeg;
    }).sort((a, b) => {
      const [da] = a.fecha.split("/").map(Number);
      const [db2] = b.fecha.split("/").map(Number);
      return db2 - da; // Más reciente primero
    });
  };

  // Helper para evolución anual por mes
  const calcularEvolucionAnual = (anio, negSel) => {
    const totalesMes = Array(12).fill(0);
    registros.forEach(r => {
      const [d, m, a] = r.fecha.split("/").map(Number);
      if (a === Number(anio)) {
        if (!negSel || negSel === "todos" || r.negocio === negSel) {
          totalesMes[m - 1] += parseInt(r.totalDia || 0);
        }
      }
    });
    return totalesMes;
  };

  // Helper para gráfico diario de un mes
  const calcularFacturacionDiariaDelMes = (mesAnioStr, negSel) => {
    if (!mesAnioStr || !mesAnioStr.includes("-")) return { labels: [], datasets: [] };
    const [anio, mes] = mesAnioStr.split("-").map(Number);
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const labels = Array.from({ length: diasEnMes }, (_, i) => `${i + 1}`);

    const negociosAMostrar = negSel && negSel !== "todos" ? [negSel] : negociosPermitidos;

    const datasets = negociosAMostrar.map((neg, idx) => {
      const datosDia = Array(diasEnMes).fill(0);
      registros.forEach(r => {
        const [d, m, a] = r.fecha.split("/").map(Number);
        if (m === mes && a === anio && r.negocio === neg) {
          datosDia[d - 1] += parseInt(r.totalDia || 0);
        }
      });
      return {
        label: neg,
        data: datosDia,
        borderColor: colores[idx % colores.length],
        backgroundColor: colores[idx % colores.length] + "33",
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
      };
    });

    return { labels, datasets };
  };

  // Helper para días de la semana
  const calcularPromedioPorDiaSemana = (mesAnioStr, negSel) => {
    const totalesSemana = Array(7).fill(0);
    const conteoSemana = Array(7).fill(0);

    const [anio, mes] = mesAnioStr ? mesAnioStr.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];

    registros.forEach(r => {
      const [d, m, a] = r.fecha.split("/").map(Number);
      if (m === mes && a === anio) {
        if (!negSel || negSel === "todos" || r.negocio === negSel) {
          const fechaObj = new Date(a, m - 1, d);
          const diaSemana = fechaObj.getDay(); // 0: Dom, 1: Lun...
          totalesSemana[diaSemana] += parseInt(r.totalDia || 0);
          conteoSemana[diaSemana] += 1;
        }
      }
    });

    return DIAS_SEMANA.map((nombreDia, idx) => ({
      dia: nombreDia,
      total: totalesSemana[idx],
      promedio: conteoSemana[idx] > 0 ? Math.round(totalesSemana[idx] / conteoSemana[idx]) : 0,
      dias: conteoSemana[idx]
    }));
  };

  // Helper para consolidado por Banco / Caja / Medio de Pago
  const calcularConsolidadoBancosCajas = (mesAnioStr) => {
    const [anio, mes] = mesAnioStr ? mesAnioStr.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
    const consolidado = {
      "Mercado Pago": 0,
      "Efectivo": 0,
      "Cuentas Bancarias / TB": 0,
      "Tarjetas / Otros": 0
    };

    registros.forEach(r => {
      const [d, m, a] = r.fecha.split("/").map(Number);
      if (m === mes && a === anio) {
        mediosTodos.forEach(medio => {
          const val = parseInt(r[medio] || 0, 10);
          if (val > 0) {
            if (medio.includes("MP") || medio.includes("Mercado")) {
              consolidado["Mercado Pago"] += val;
            } else if (medio.includes("Efectivo")) {
              consolidado["Efectivo"] += val;
            } else if (medio.includes("TB") || medio.includes("BNA") || medio.includes("BLP")) {
              consolidado["Cuentas Bancarias / TB"] += val;
            } else {
              consolidado["Tarjetas / Otros"] += val;
            }
          }
        });
      }
    });

    return consolidado;
  };

  // ─── App principal ────────────────────────────────────────────────────────
  return (
    <div style={S.app}>

      {/* ── Header ── */}
      <div style={{ ...S.pageHeader, backgroundColor: t.superficie, borderBottom: `1px solid ${t.borde}` }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📊 Intranet Negocios</h1>
          <p style={{ fontSize: 12, color: t.textoSuave, margin: 0 }}>
            {seccionActiva === "dashboard" && "Resumen General"}
            {seccionActiva === "carga" && "Carga de Datos"}
            {seccionActiva === "editar" && "Edición Histórica y PDF"}
            {seccionActiva === "evolucion" && "Evolución Anual"}
            {seccionActiva === "informes" && "Análisis Diario y Semanal"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setModoOscuro(!modoOscuro)}
            style={{ ...S.btnSecondary, padding: "8px 12px", fontSize: 16 }}
            title="Cambiar tema"
          >
            {modoOscuro ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => { setIsLoggedIn(false); setUsername(""); setPassword(""); }}
            style={{ ...S.btnSecondary, padding: "8px 12px", fontSize: 12 }}
          >
            Salir
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 120px" }}>

        {/* ══════════════════════════════════════════════
            SECCIÓN 1: DASHBOARD / INICIO
        ══════════════════════════════════════════════ */}
        {seccionActiva === "dashboard" && (
          <div>
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 13, color: t.textoSuave, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Mes Actual ({NOMBRES_MESES[new Date().getMonth()]} {new Date().getFullYear()})
              </h3>
              <div style={S.totalGrande}>
                {formatoMoneda(negociosPermitidos.reduce((acc, n) => acc + parseInt(totalesMesActual[n] || 0), 0))}
              </div>
              <p style={{ color: t.textoSuave, fontSize: 13, margin: "4px 0 16px" }}>Total general facturado</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {negociosPermitidos.map(neg => (
                  totalesMesActual[neg] ? (
                    <div key={neg} style={{ backgroundColor: t.superficie2, borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ fontSize: 12, color: t.textoSuave, margin: "0 0 2px" }}>{neg}</p>
                      <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: t.texto }}>{formatoMoneda(totalesMesActual[neg])}</p>
                    </div>
                  ) : null
                ))}
              </div>
            </div>

            {/* Medios de pago del mes */}
            {rolActual === "admin" && acumuladosPorMedioMes.length > 0 && (
              <div style={S.card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 13, color: t.textoSuave, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  💳 Recaudación por Medio de Pago (Mes Actual)
                </h3>
                {[...acumuladosPorMedioMes].sort((a, b) => b.total - a.total).map(({ medio, total }) => (
                  <div key={medio} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${t.borde}` }}>
                    <span style={{ fontSize: 14, color: t.texto }}>{medio}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.acento }}>{formatoMoneda(total)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Último registro por negocio */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 13, color: t.textoSuave, fontWeight: 700, textTransform: "uppercase" }}>
                📅 Estado de Carga por Negocio
              </h3>
              {negociosPermitidos.map((neg) => (
                <div key={neg} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.borde}` }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{neg}</span>
                  <span style={{ fontSize: 13, color: ultimosDiasPorNegocio[neg] ? t.exito : t.peligro, fontWeight: 700 }}>
                    {ultimosDiasPorNegocio[neg] ? `Última: ${ultimosDiasPorNegocio[neg]}` : "Sin datos"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECCIÓN 2: CARGA DE DATOS
        ══════════════════════════════════════════════ */}
        {seccionActiva === "carga" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <button style={{ ...S.btnPrimary, margin: 0 }} onClick={() => { setMostrarCargaDia(true); setTimeout(() => document.getElementById("seccion-cargar-dia")?.scrollIntoView({ behavior: "smooth" }), 100); }}>
                📅 Cargar día
              </button>
              <button style={{ ...S.btnPrimary, margin: 0, backgroundColor: t.warning }} onClick={() => { setMostrarAcumulados(true); setTimeout(() => document.getElementById("seccion-filtros")?.scrollIntoView({ behavior: "smooth" }), 100); }}>
                🔍 Filtros
              </button>
            </div>

            {/* Formulario de carga */}
            {mostrarCargaDia && (
              <div id="seccion-cargar-dia" style={S.card}>
                <h3 style={{ ...S.sectionTitle, marginBottom: 16 }}>
                  {modoEdicion ? "✏️ Editando Registro" : "📅 Registrar Ingresos del Día"}
                </h3>

                {modoEdicion && (
                  <div style={{ backgroundColor: t.warning + "22", border: `1px solid ${t.warning}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: t.texto }}>
                      <strong>Editando:</strong> {fechaSeleccionada} — {negocio}
                    </span>
                    <button
                      style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: t.peligro }}
                      onClick={() => { setModoEdicion(false); setIdEnEdicion(null); setFormData({}); setNegocio(""); setFechaSeleccionada(""); }}
                    >✕</button>
                  </div>
                )}

                <div style={S.campoMonto}>
                  <label style={S.label}>Fecha</label>
                  <input type="date" style={S.input} value={fechaSeleccionada} onChange={e => setFechaSeleccionada(e.target.value)} />
                </div>

                <div style={S.campoMonto}>
                  <label style={S.label}>Negocio</label>
                  <select style={S.select} value={negocio} onChange={e => setNegocio(e.target.value)}>
                    <option value="">Seleccionar negocio...</option>
                    {negociosPermitidos.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {negocio && mediosPorNegocio[negocio].map(medio => (
                  <div key={medio} style={S.campoMonto}>
                    <label style={S.label}>{medio}</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      style={S.input}
                      value={formData[medio]||""}
                      onChange={e => {
                        if (/^\d{0,10}$/.test(e.target.value.replace(/\./g,""))) {
                          setFormData({ ...formData, [medio]: e.target.value });
                          setErrors({ ...errors, [medio]: false });
                        } else {
                          setErrors({ ...errors, [medio]: true });
                        }
                      }}
                    />
                  </div>
                ))}

                {negocio && (
                  <div style={{ backgroundColor: t.superficie2, borderRadius: 12, padding: "14px 16px", marginBottom: 16, textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 13, color: t.textoSuave }}>Total del día</p>
                    <p style={{ ...S.totalGrande, margin: 0 }}>
                      {formatoMoneda(Object.entries(formData).reduce((sum, [, val]) => sum + parseInt(val || 0), 0))}
                    </p>
                  </div>
                )}

                {negocio && !modoEdicion && (
                  <button
                    style={{ ...S.btnSuccess, opacity: !fechaSeleccionada ? 0.5 : 1 }}
                    disabled={!fechaSeleccionada}
                    onClick={async () => {
                      if (!fechaSeleccionada) { alert("Seleccioná una fecha primero."); return; }
                      const [anio, mes, dia] = fechaSeleccionada.split("-");
                      const fechaFormateada = `${dia}/${mes}/${anio}`;
                      const totalDia = Object.entries(formData).reduce((sum, [, val]) => sum + parseInt(val || 0), 0);
                      await addDoc(collection(db, "registros"), { fecha: fechaFormateada, negocio, totalDia, ...formData });
                      setFormData({}); setNegocio(""); setFechaSeleccionada("");
                      cargarRegistros();
                      alert("✅ Registro guardado con éxito");
                    }}
                  >
                    ✅ Guardar Ingreso
                  </button>
                )}

                {negocio && modoEdicion && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      style={{ ...S.btnSuccess, flex: 1 }}
                      onClick={async () => {
                        if (!fechaSeleccionada || !negocio) { alert("Completá fecha y negocio."); return; }
                        const [anio, mes, dia] = fechaSeleccionada.split("-");
                        const fechaFormateada = `${dia}/${mes}/${anio}`;
                        const totalDia = Object.entries(formData).reduce((sum, [, val]) => sum + parseInt(val || 0), 0);
                        try {
                          await updateDoc(doc(db, "registros", idEnEdicion), { fecha: fechaFormateada, negocio, totalDia, ...formData });
                          alert("✅ Registro actualizado con éxito");
                          setFormData({}); setNegocio(""); setFechaSeleccionada(""); setModoEdicion(false); setIdEnEdicion(null);
                          cargarRegistros();
                        } catch (err) {
                          alert("❌ Error al actualizar.");
                        }
                      }}
                    >
                      💾 Actualizar
                    </button>
                    <button
                      style={{ ...S.btnSecondary, flex: 1 }}
                      onClick={() => { setModoEdicion(false); setIdEnEdicion(null); setFormData({}); setNegocio(""); setFechaSeleccionada(""); }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Registros del mes actual */}
            <div id="registros-individuales">
              <h3 style={{ ...S.sectionTitle }}>📋 Registros del Mes Actual</h3>
              {negociosPermitidos.map(negAg => {
                const regsNeg = registrosOrdenados().filter(r => r.negocio === negAg);
                if (regsNeg.length === 0) return null;
                return (
                  <div key={negAg} style={{ marginBottom: 12 }}>
                    <div
                      style={{ backgroundColor: t.superficie, border: `1px solid ${t.borde}`, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      onClick={() => setNegociosExpandido(prev => ({ ...prev, [negAg]: !prev[negAg] }))}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{negAg}</span>
                        <span style={{ marginLeft: 10, fontSize: 13, color: t.textoSuave }}>{regsNeg.length} cargas</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 700, color: t.acento, fontSize: 15 }}>
                          {formatoMoneda(regsNeg.reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0))}
                        </span>
                        <span style={{ color: t.textoSuave }}>{negociosExpandido[negAg] ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {negociosExpandido[negAg] && (
                      <div style={{ overflowX: "auto", marginTop: 4 }}>
                        <table style={S.tabla}>
                          <thead>
                            <tr>
                              <th style={S.th}>Fecha</th>
                              {mediosPorNegocio[negAg].map(m => <th key={m} style={S.th}>{m}</th>)}
                              <th style={S.th}>Total</th>
                              <th style={S.th}>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {regsNeg.map((r, i) => (
                              <tr key={r.id}>
                                <td style={S.td(i % 2 === 0)}>{r.fecha}</td>
                                {mediosPorNegocio[negAg].map(m => (
                                  <td key={m} style={{ ...S.td(i % 2 === 0), textAlign: "right" }}>
                                    {r[m] ? formatoMoneda(r[m]) : "-"}
                                  </td>
                                ))}
                                <td style={{ ...S.td(i % 2 === 0), textAlign: "right", fontWeight: 700, color: t.exito }}>
                                  {formatoMoneda(r.totalDia)}
                                </td>
                                <td style={{ ...S.td(i % 2 === 0), textAlign: "center" }}>
                                  <button style={S.btnEdit} onClick={() => editarRegistroPorId(r.id)}>✏️</button>
                                  <button style={S.btnDanger} onClick={() => eliminarRegistro(r.id)}>🗑</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECCIÓN 3: EDICIÓN HISTÓRICA Y EXPORTACIÓN PDF
        ══════════════════════════════════════════════ */}
        {seccionActiva === "editar" && (
          <div>
            <div style={S.card}>
              <h3 style={S.sectionTitle}>📅 Consulta y Edición Histórica de Meses Anteriores</h3>
              <p style={{ fontSize: 13, color: t.textoSuave, marginBottom: 16 }}>
                Seleccioná el Mes/Año y el Negocio para revisar todas las cargas diarias, modificar importes erróneos o generar el reporte en PDF.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={S.label}>Mes / Año</label>
                  <input
                    type="month"
                    style={S.input}
                    value={buscarMesAnioEdicion}
                    onChange={e => setBuscarMesAnioEdicion(e.target.value)}
                  />
                </div>
                <div>
                  <label style={S.label}>Empresa / Negocio</label>
                  <select
                    style={S.select}
                    value={buscarNegocioEdicion}
                    onChange={e => setBuscarNegocioEdicion(e.target.value)}
                  >
                    <option value="todos">Todos los negocios</option>
                    {negociosPermitidos.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                <button
                  style={{ ...S.btnPrimary, backgroundColor: "#dc2626", margin: 0 }}
                  onClick={() => exportarPdfEmpresa(buscarNegocioEdicion, buscarMesAnioEdicion)}
                >
                  📄 Exportar a PDF
                </button>
                <button
                  style={{ ...S.btnPrimary, backgroundColor: "#16a34a", margin: 0 }}
                  onClick={exportarTablaAExcel}
                >
                  📤 Exportar Excel
                </button>
              </div>
            </div>

            {/* Listado completo de cargas del mes seleccionado */}
            {(() => {
              const registrosDelMes = obtenerRegistrosMesAnio(buscarMesAnioEdicion, buscarNegocioEdicion);
              const totalMesConsolidado = registrosDelMes.reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0);

              return (
                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                      📋 Listado de Cargas ({registrosDelMes.length} registros)
                    </h3>
                    <span style={{ fontSize: 16, fontWeight: 800, color: t.acento }}>
                      Total: {formatoMoneda(totalMesConsolidado)}
                    </span>
                  </div>

                  {registrosDelMes.length === 0 ? (
                    <p style={{ textAlign: "center", color: t.textoSuave, padding: "20px 0" }}>
                      No hay datos registrados para el mes y negocio seleccionado.
                    </p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={S.tabla}>
                        <thead>
                          <tr>
                            <th style={S.th}>Fecha</th>
                            <th style={S.th}>Negocio</th>
                            {buscarNegocioEdicion !== "todos" && mediosPorNegocio[buscarNegocioEdicion]
                              ? mediosPorNegocio[buscarNegocioEdicion].map(m => <th key={m} style={S.th}>{m}</th>)
                              : mediosTodos.map(m => <th key={m} style={S.th}>{m}</th>)
                            }
                            <th style={S.th}>Total Día</th>
                            <th style={S.th}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrosDelMes.map((r, i) => (
                            <tr key={r.id}>
                              <td style={S.td(i % 2 === 0)}>{r.fecha}</td>
                              <td style={{ ...S.td(i % 2 === 0), fontWeight: 700 }}>{r.negocio}</td>
                              {(buscarNegocioEdicion !== "todos" && mediosPorNegocio[buscarNegocioEdicion]
                                ? mediosPorNegocio[buscarNegocioEdicion]
                                : mediosTodos
                              ).map(m => (
                                <td key={m} style={{ ...S.td(i % 2 === 0), textAlign: "right" }}>
                                  {r[m] ? formatoMoneda(r[m]) : "-"}
                                </td>
                              ))}
                              <td style={{ ...S.td(i % 2 === 0), textAlign: "right", fontWeight: 800, color: t.exito }}>
                                {formatoMoneda(r.totalDia)}
                              </td>
                              <td style={{ ...S.td(i % 2 === 0), textAlign: "center" }}>
                                <button style={S.btnEdit} onClick={() => editarRegistroPorId(r.id)}>✏️ Editar</button>
                                <button style={S.btnDanger} onClick={() => eliminarRegistro(r.id)}>🗑 Eliminar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECCIÓN 4: EVOLUCIÓN ANUAL POR NEGOCIO
        ══════════════════════════════════════════════ */}
        {seccionActiva === "evolucion" && (
          <div>
            <div style={S.card}>
              <h3 style={S.sectionTitle}>📈 Evolución Anual de Ingresos</h3>
              <p style={{ fontSize: 13, color: t.textoSuave, marginBottom: 16 }}>
                Evaluá la tendencia de facturación mes a mes durante todo el año para cada empresa o el consolidado global.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={S.label}>Año</label>
                  <select style={S.select} value={anioEvolucion} onChange={e => setAnioEvolucion(e.target.value)}>
                    {[2024, 2025, 2026, 2027].map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Negocio</label>
                  <select style={S.select} value={negocioEvolucion} onChange={e => setNegocioEvolucion(e.target.value)}>
                    <option value="todos">Todos los negocios</option>
                    {negociosPermitidos.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Métricas Anuales */}
              {(() => {
                const totales = calcularEvolucionAnual(anioEvolucion, negocioEvolucion);
                const sumaAnual = totales.reduce((a, b) => a + b, 0);
                const mesesConDatos = totales.filter(t => t > 0).length;
                const promedioMensual = mesesConDatos > 0 ? Math.round(sumaAnual / mesesConDatos) : 0;

                return (
                  <div style={{ backgroundColor: t.superficie2, borderRadius: 12, padding: 16, margin: "10px 0 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 11, color: t.textoSuave, margin: 0, textTransform: "uppercase" }}>Total Acumulado Año {anioEvolucion}</p>
                        <p style={{ fontSize: 20, fontWeight: 800, color: t.acento, margin: "4px 0 0" }}>{formatoMoneda(sumaAnual)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: t.textoSuave, margin: 0, textTransform: "uppercase" }}>Promedio Mensual</p>
                        <p style={{ fontSize: 20, fontWeight: 800, color: t.exito, margin: "4px 0 0" }}>{formatoMoneda(promedioMensual)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Gráfico de Barras Anual */}
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <Bar
                  data={{
                    labels: NOMBRES_MESES,
                    datasets: [
                      {
                        label: `Facturación ${negocioEvolucion === "todos" ? "Total" : negocioEvolucion} ($)`,
                        data: calcularEvolucionAnual(anioEvolucion, negocioEvolucion),
                        backgroundColor: t.acento,
                        borderRadius: 6,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: { callbacks: { label: ctx => `Facturado: ${formatoMoneda(ctx.raw)}` } }
                    },
                    scales: {
                      y: { ticks: { callback: v => "$" + v.toLocaleString("es-AR"), color: t.textoSuave }, grid: { color: t.borde } },
                      x: { ticks: { color: t.textoSuave }, grid: { color: t.borde } }
                    }
                  }}
                />
              </div>
            </div>

            {/* Tabla Numérica Anual Mes a Mes */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>
                📊 Detalle Mensual ({anioEvolucion})
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={S.tabla}>
                  <thead>
                    <tr>
                      <th style={S.th}>Mes</th>
                      <th style={{ ...S.th, textAlign: "right" }}>Facturación ($)</th>
                      <th style={{ ...S.th, textAlign: "right" }}>% del Total Anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totales = calcularEvolucionAnual(anioEvolucion, negocioEvolucion);
                      const sumaAnual = totales.reduce((a, b) => a + b, 0);

                      return NOMBRES_MESES.map((nombreMes, i) => {
                        const totalM = totales[i];
                        const pct = sumaAnual > 0 ? ((totalM / sumaAnual) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={nombreMes}>
                            <td style={{ ...S.td(i % 2 === 0), fontWeight: 700 }}>{nombreMes}</td>
                            <td style={{ ...S.td(i % 2 === 0), textAlign: "right", fontWeight: 700, color: totalM > 0 ? t.texto : t.textoSuave }}>
                              {formatoMoneda(totalM)}
                            </td>
                            <td style={{ ...S.td(i % 2 === 0), textAlign: "right", color: t.acento, fontWeight: 600 }}>
                              {pct}%
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECCIÓN 5: ANÁLISIS DIARIO, SEMANAL Y CONTROL DE BANCOS
        ══════════════════════════════════════════════ */}
        {seccionActiva === "informes" && (
          <div>
            {/* 1. Facturación Diaria del Mes (Días 1 al 31) */}
            <div style={S.card}>
              <h3 style={S.sectionTitle}>📅 Facturación Diaria a lo Largo del Mes</h3>
              <p style={{ fontSize: 13, color: t.textoSuave, marginBottom: 14 }}>
                Visualizá las ventas día a día (días 1 al 31) para detectar picos y días de menor movimiento.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={S.label}>Mes / Año</label>
                  <input type="month" style={S.input} value={mesDiario} onChange={e => setMesDiario(e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Negocio</label>
                  <select style={S.select} value={negocioDiario} onChange={e => setNegocioDiario(e.target.value)}>
                    <option value="todos">Todos los negocios</option>
                    {negociosPermitidos.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <Line
                  data={calcularFacturacionDiariaDelMes(mesDiario, negocioDiario)}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: "bottom", labels: { color: t.texto, font: { size: 11 } } },
                      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatoMoneda(ctx.raw)}` } }
                    },
                    scales: {
                      y: { ticks: { callback: v => "$" + v.toLocaleString("es-AR"), color: t.textoSuave }, grid: { color: t.borde } },
                      x: { title: { display: true, text: "Día del mes", color: t.textoSuave }, ticks: { color: t.textoSuave }, grid: { color: t.borde } }
                    }
                  }}
                />
              </div>
            </div>

            {/* 2. Promedio y Ventas por Día de la Semana */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>
                📊 Ventas Promedio por Día de la Semana
              </h3>
              <p style={{ fontSize: 13, color: t.textoSuave, marginBottom: 14 }}>
                Conocé qué día de la semana genera mayor facturación promedio para planificar compras y caja.
              </p>

              <div style={{ overflowX: "auto" }}>
                <table style={S.tabla}>
                  <thead>
                    <tr>
                      <th style={S.th}>Día</th>
                      <th style={{ ...S.th, textAlign: "right" }}>Recaudación Total</th>
                      <th style={{ ...S.th, textAlign: "right" }}>Promedio / Día</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcularPromedioPorDiaSemana(mesDiario, negocioDiario).map((row, i) => (
                      <tr key={row.dia}>
                        <td style={{ ...S.td(i % 2 === 0), fontWeight: 700 }}>{row.dia}</td>
                        <td style={{ ...S.td(i % 2 === 0), textAlign: "right" }}>{formatoMoneda(row.total)}</td>
                        <td style={{ ...S.td(i % 2 === 0), textAlign: "right", fontWeight: 800, color: t.acento }}>
                          {formatoMoneda(row.promedio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Consolidado por Caja / Banco / MercadoPago */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>
                🏦 Resumen Consolidado de Cuentas y Cajas
              </h3>
              <p style={{ fontSize: 13, color: t.textoSuave, marginBottom: 14 }}>
                Distribución del dinero ingresado en cuentas bancarias, MercadoPago y Efectivo para conciliación rápida.
              </p>
              {(() => {
                const cons = calcularConsolidadoBancosCajas(mesDiario);
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {Object.entries(cons).map(([cuenta, valor]) => (
                      <div key={cuenta} style={{ backgroundColor: t.superficie2, borderRadius: 12, padding: "12px 14px" }}>
                        <p style={{ fontSize: 12, color: t.textoSuave, margin: "0 0 2px" }}>{cuenta}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: t.exito }}>{formatoMoneda(valor)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div style={{ height: 80 }} />
      </div>

      {/* ── Barra de navegación inferior (mobile y desktop) ── */}
      <div style={S.navBar}>
        {[
          { id: "dashboard", icon: "🏠", label: "Inicio" },
          { id: "carga", icon: "📅", label: "Carga" },
          { id: "editar", icon: "✏️", label: "Editar/PDF" },
          { id: "evolucion", icon: "📈", label: "Anual" },
          { id: "informes", icon: "📊", label: "Análisis" },
        ].map(({ id, icon, label }) => (
          <button key={id} style={S.navBtn(seccionActiva === id)} onClick={() => setSeccionActiva(id)}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}

