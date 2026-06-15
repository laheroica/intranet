import React from "react";
import { useState, useEffect } from "react";
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
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip
} from "chart.js";
import { Line } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

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
  const [mostrarDetalleGrafico, setMostrarDetalleGrafico] = useState(false);
  const [detalleDiario, setDetalleDiario] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idEnEdicion, setIdEnEdicion] = useState(null);
  const [mostrarCargaDia, setMostrarCargaDia] = useState(false);
  const [filtroGraficoNegocio, setFiltroGraficoNegocio] = useState("todos");
  const [seccionActiva, setSeccionActiva] = useState("dashboard");
  const [ultimosDiasPorNegocio, setUltimosDiasPorNegocio] = useState({});
  const [registrosFiltrados, setRegistrosFiltrados] = useState([]);
  const [ultimaFechaGlobal, setUltimaFechaGlobal] = useState(null);
  const [negociosExpandido, setNegociosExpandido] = useState({});
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [registrosFiltradosInforme, setRegistrosFiltradosInforme] = useState([]);

  // ── NUEVO: búsqueda para editar meses anteriores ──────────────────────────
  const [buscarFechaEdicion, setBuscarFechaEdicion] = useState("");
  const [buscarNegocioEdicion, setBuscarNegocioEdicion] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [mostrarBuscador, setMostrarBuscador] = useState(false);

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
      setMostrarDetalleGrafico(true);
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

  // ─── NUEVA función: buscar registros para editar ──────────────────────────
  const buscarParaEditar = () => {
    let resultados = [...registros];
    if (buscarFechaEdicion) {
      // acepta formato YYYY-MM o DD/MM/YYYY parcial
      if (buscarFechaEdicion.includes("-")) {
        // formato YYYY-MM (mes completo)
        const [anio, mes] = buscarFechaEdicion.split("-").map(Number);
        resultados = resultados.filter(r => {
          const [d, m, a] = r.fecha.split("/").map(Number);
          return m === mes && a === anio;
        });
      } else {
        // texto libre
        resultados = resultados.filter(r => r.fecha.includes(buscarFechaEdicion));
      }
    }
    if (buscarNegocioEdicion) {
      resultados = resultados.filter(r =>
        r.negocio.toLowerCase().includes(buscarNegocioEdicion.toLowerCase())
      );
    }
    // Ordenar más reciente primero
    resultados.sort((a, b) => {
      const [da, ma, aa] = a.fecha.split("/").map(Number);
      const [db2, mb, ab] = b.fecha.split("/").map(Number);
      return new Date(`${ab}-${mb}-${db2}`) - new Date(`${aa}-${ma}-${da}`);
    });
    setResultadosBusqueda(resultados.slice(0, 50)); // máx 50 resultados
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const eliminarRegistro = async (id) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    try {
      await deleteDoc(doc(db, "registros", id));
      cargarRegistros();
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

  const filtrarInformesPorMes = () => {
    if (!mesSelecionado) return;
    const [anio, mes] = mesSelecionado.split("-");
    setRegistrosFiltradosInforme(
      registros.filter(r => {
        const [d, m, a] = r.fecha.split("/").map(Number);
        return parseInt(m) === parseInt(mes) && parseInt(a) === parseInt(anio);
      })
    );
  };

  const generarEvolucionDiariaAcumulada = () => {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth();
    const diasDelMes = new Date(anio, mes + 1, 0).getDate();
    const fechas = Array.from({ length: diasDelMes }, (_, i) => {
      return `${String(i + 1).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${anio}`;
    });
    const acumuladoPorNegocio = {};
    negocios.forEach(n => { acumuladoPorNegocio[n] = Array(diasDelMes).fill(0); });
    registros.forEach(r => {
      const [d, m, y] = r.fecha.split("/").map(Number);
      if (m === mes + 1 && y === anio && negocios.includes(r.negocio)) {
        const total = Object.entries(r).filter(([k]) => mediosTodos.includes(k)).reduce((sum, [, v]) => sum + parseInt(v || 0), 0);
        acumuladoPorNegocio[r.negocio][d - 1] += total;
      }
    });
    negocios.forEach(n => { for (let i = 1; i < diasDelMes; i++) acumuladoPorNegocio[n][i] += acumuladoPorNegocio[n][i - 1]; });
    return { labels: fechas, datasets: negocios.map((n, i) => ({ label: n, data: acumuladoPorNegocio[n], borderColor: colores[i % colores.length], backgroundColor: colores[i % colores.length], fill: false, tension: 0.3, borderWidth: 2, pointRadius: 3 })) };
  };

  const generarFacturacionDiariaPorNegocio = () => {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth();
    const diasDelMes = new Date(anio, mes + 1, 0).getDate();
    const fechas = Array.from({ length: diasDelMes }, (_, i) => `${String(i + 1).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${anio}`);
    const facturacion = {};
    negocios.forEach(n => { facturacion[n] = Array(diasDelMes).fill(0); });
    registros.forEach(r => {
      const [d, m, y] = r.fecha.split("/").map(Number);
      if (m === mes + 1 && y === anio && negocios.includes(r.negocio)) {
        const total = Object.entries(r).filter(([k]) => mediosTodos.includes(k)).reduce((sum, [, v]) => sum + parseInt(v || 0), 0);
        facturacion[r.negocio][d - 1] += total;
      }
    });
    return { labels: fechas, datasets: negocios.map((n, i) => ({ label: n, data: facturacion[n], borderColor: colores[i % colores.length], backgroundColor: colores[i % colores.length], fill: false, tension: 0.3, borderWidth: 2, pointRadius: 3 })) };
  };

  const formatoMoneda = (valor) => {
    if (!valor) return "$0";
    return "$" + parseInt(valor).toLocaleString("es-AR");
  };

  // ─── Estilos reutilizables ────────────────────────────────────────────────
  const S = {
    // Contenedor principal
    app: {
      minHeight: "100vh",
      backgroundColor: t.fondo,
      color: t.texto,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      paddingBottom: 80,
    },
    // Barra de navegación inferior (mobile-first)
    navBar: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: t.superficie,
      borderTop: `1px solid ${t.borde}`,
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0",
      zIndex: 1000,
      boxShadow: "0 -2px 10px rgba(0,0,0,0.2)"
    },
    navBtn: (activo) => ({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "6px 16px",
      borderRadius: 12,
      border: "none",
      background: activo ? t.acento + "22" : "transparent",
      color: activo ? t.acento : t.textoSuave,
      cursor: "pointer",
      fontSize: 11,
      fontWeight: activo ? 700 : 400,
      transition: "all 0.2s",
      minWidth: 60,
    }),
    // Tarjeta
    card: {
      backgroundColor: t.superficie,
      border: `1px solid ${t.borde}`,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      boxShadow: modoOscuro ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)"
    },
    // Input táctil grande
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
      WebkitAppearance: "none",
    },
    inputFocus: {
      border: `1.5px solid ${t.acento}`,
    },
    // Select táctil
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
    // Botón primario grande táctil
    btnPrimary: {
      width: "100%",
      padding: "16px",
      fontSize: 16,
      fontWeight: 700,
      borderRadius: 14,
      border: "none",
      backgroundColor: t.acento,
      color: "#fff",
      cursor: "pointer",
      marginBottom: 10,
      letterSpacing: 0.5,
      transition: "all 0.2s",
      WebkitTapHighlightColor: "transparent",
    },
    btnSuccess: {
      width: "100%",
      padding: "16px",
      fontSize: 16,
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
    // Campo de monto con label
    campoMonto: {
      marginBottom: 14,
    },
    label: {
      display: "block",
      fontSize: 13,
      fontWeight: 600,
      color: t.textoSuave,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    // Total grande
    totalGrande: {
      fontSize: 28,
      fontWeight: 800,
      color: t.acento,
      letterSpacing: -1,
    },
    // Chip de negocio
    chip: (color) => ({
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      backgroundColor: color + "22",
      color: color,
      marginRight: 6,
      marginBottom: 4,
    }),
    // Título de sección
    sectionTitle: {
      fontSize: 22,
      fontWeight: 800,
      marginBottom: 16,
      color: t.texto,
    },
    // Header con padding
    pageHeader: {
      padding: "24px 20px 12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    // Tabla responsive
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
          <p style={{ color: t.textoSuave, marginBottom: 24, fontSize: 14 }}>Control de ingresos</p>
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
                const usuario = USUARIOS[username];
                if (usuario && usuario.password === password) {
                  setIsLoggedIn(true); setRolActual(usuario.rol);
                } else { alert("Usuario o contraseña incorrectos"); }
              }
            }}
          />
          <button
            style={S.btnPrimary}
            onClick={() => {
              const usuario = USUARIOS[username];
              if (usuario && usuario.password === password) {
                setIsLoggedIn(true); setRolActual(usuario.rol);
              } else { alert("Usuario o contraseña incorrectos"); }
            }}
          >
            Entrar →
          </button>
          <p style={{ fontSize: 11, color: t.textoSuave, marginTop: 8 }}>
            {window.matchMedia("(display-mode: standalone)").matches ? "✅ Modo app activo" : "💡 Instalá esta página como app desde el menú del navegador"}
          </p>
        </div>
      </div>
    );
  }

  // ─── App principal ────────────────────────────────────────────────────────
  return (
    <div style={S.app}>

      {/* ── Header ── */}
      <div style={{ ...S.pageHeader, backgroundColor: t.superficie, borderBottom: `1px solid ${t.borde}` }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📊 Intranet</h1>
          <p style={{ fontSize: 12, color: t.textoSuave, margin: 0 }}>
            {seccionActiva === "dashboard" && "Resumen"}
            {seccionActiva === "carga" && "Carga de datos"}
            {seccionActiva === "informes" && "Informes"}
            {seccionActiva === "editar" && "Editar registros"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Toggle modo oscuro */}
          <button
            onClick={() => setModoOscuro(!modoOscuro)}
            style={{ ...S.btnSecondary, padding: "8px 12px", fontSize: 18 }}
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

      <div style={{ padding: "16px 16px 0" }}>

        {/* ══════════════════════════════════════════════
            SECCIÓN: DASHBOARD
        ══════════════════════════════════════════════ */}
        {seccionActiva === "dashboard" && (
          <div>
            {/* Resumen mes actual */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: t.textoSuave, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Mes actual
              </h3>
              <div style={S.totalGrande}>
                {formatoMoneda(negociosPermitidos.reduce((acc, n) => acc + parseInt(totalesMesActual[n] || 0), 0))}
              </div>
              <p style={{ color: t.textoSuave, fontSize: 13, margin: "4px 0 16px" }}>Total general</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {negociosPermitidos.map(neg => (
                  totalesMesActual[neg] ? (
                    <div key={neg} style={{ backgroundColor: t.superficie2, borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ fontSize: 12, color: t.textoSuave, margin: "0 0 2px" }}>{neg}</p>
                      <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: t.texto }}>{formatoMoneda(totalesMesActual[neg])}</p>
                    </div>
                  ) : null
                ))}
              </div>
            </div>

            {/* Acumulado año — solo admin */}
            {rolActual === "admin" && (
            <div style={S.card}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: t.textoSuave, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Acumulado del año
              </h3>
              <div style={S.totalGrande}>
                {formatoMoneda(
                  registros.filter(r => {
                    const [d, m, y] = r.fecha.split("/").map(Number);
                    return new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`) >= new Date(new Date().getFullYear(), 0, 1);
                  }).reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0)
                )}
              </div>
            </div>
            )}

            {/* Medios de pago del mes — solo admin */}
            {rolActual === "admin" && acumuladosPorMedioMes.length > 0 && (
              <div style={S.card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: t.textoSuave, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  💳 Medios de pago del mes
                </h3>
                {[...acumuladosPorMedioMes].sort((a, b) => b.total - a.total).map(({ medio, total }) => (
                  <div key={medio} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${t.borde}` }}>
                    <span style={{ fontSize: 14, color: t.texto }}>{medio}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.acento }}>{formatoMoneda(total)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Gráfico evolución — solo admin */}
            {rolActual === "admin" && <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: t.textoSuave, fontWeight: 600, textTransform: "uppercase" }}>
                📈 Evolución del mes
              </h3>
              <div style={{ overflowX: "auto" }}>
                <Line
                  data={generarEvolucionDiariaAcumulada()}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: "bottom", labels: { color: t.texto, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatoMoneda(ctx.raw)}` } } },
                    scales: {
                      y: { ticks: { callback: v => "$" + v.toLocaleString("es-AR"), color: t.textoSuave }, grid: { color: t.borde } },
                      x: { ticks: { autoSkip: true, maxTicksLimit: 10, color: t.textoSuave }, grid: { color: t.borde } }
                    }
                  }}
                />
              </div>
            </div>
            }

            {/* Último registro por negocio */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: t.textoSuave, fontWeight: 600, textTransform: "uppercase" }}>
                📅 Último registro por negocio
              </h3>
              {negociosPermitidos.map((neg, i) => (
                <div key={neg} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.borde}` }}>
                  <span style={{ fontSize: 14 }}>{neg}</span>
                  <span style={{ fontSize: 13, color: ultimosDiasPorNegocio[neg] ? t.exito : t.peligro, fontWeight: 600 }}>
                    {ultimosDiasPorNegocio[neg] || "Sin datos"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECCIÓN: CARGA
        ══════════════════════════════════════════════ */}
        {seccionActiva === "carga" && (
          <div>
            {/* Botones rápidos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <button style={{ ...S.btnPrimary, margin: 0 }} onClick={() => { setMostrarCargaDia(true); setTimeout(() => document.getElementById("seccion-cargar-dia")?.scrollIntoView({ behavior: "smooth" }), 100); }}>
                📅 Cargar día
              </button>
              <button style={{ ...S.btnPrimary, margin: 0, backgroundColor: t.warning }} onClick={() => { setMostrarAcumulados(true); setTimeout(() => document.getElementById("seccion-filtros")?.scrollIntoView({ behavior: "smooth" }), 100); }}>
                🔍 Filtrar
              </button>
              <button style={{ ...S.btnPrimary, margin: 0, backgroundColor: t.superficie2, color: t.texto, border: `1px solid ${t.borde}` }} onClick={() => document.getElementById("registros-individuales")?.scrollIntoView({ behavior: "smooth" })}>
                📋 Registros
              </button>
              <button style={{ ...S.btnPrimary, margin: 0, backgroundColor: "#1a7a4a" }} onClick={exportarTablaAExcel}>
                📤 Excel
              </button>
            </div>

            {/* Formulario de carga */}
            {mostrarCargaDia && (
              <div id="seccion-cargar-dia" style={S.card}>
                <h3 style={{ ...S.sectionTitle, marginBottom: 16 }}>
                  {modoEdicion ? "✏️ Editando registro" : "📅 Cargar día"}
                </h3>

                {modoEdicion && (
                  <div style={{ backgroundColor: t.warning + "22", border: `1px solid ${t.warning}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: t.texto }}>
                      <strong>Editando:</strong> {fechaSeleccionada && new Date(fechaSeleccionada + "T12:00:00").toLocaleDateString("es-AR")} — {negocio}
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
                    {errors[medio] && <p style={{ color: t.peligro, fontSize: 12, margin: "-8px 0 8px" }}>Solo números</p>}
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
                      const duplicado = registros.find(r => r.fecha === fechaFormateada && r.negocio === negocio);
                      const totalDia = Object.entries(formData).reduce((sum, [, val]) => sum + parseInt(val || 0), 0);
                      await addDoc(collection(db, "registros"), { fecha: fechaFormateada, negocio, totalDia, ...formData });
                      setFormData({}); setNegocio(""); setFechaSeleccionada("");
                      cargarRegistros();
                      alert("✅ Registro guardado");
                    }}
                  >
                    ✅ Guardar
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
                          alert("✅ Registro actualizado");
                          setFormData({}); setNegocio(""); setFechaSeleccionada(""); setModoEdicion(false); setIdEnEdicion(null);
                          cargarRegistros();
                          // Si vino del buscador, actualizar resultados
                          if (resultadosBusqueda.length > 0) buscarParaEditar();
                        } catch (err) {
                          alert("❌ Error al actualizar."); console.error(err);
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
              <h3 style={{ ...S.sectionTitle }}>📋 Mes actual</h3>
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
                        <span style={{ marginLeft: 10, fontSize: 13, color: t.textoSuave }}>{regsNeg.length} registros</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 700, color: t.acento, fontSize: 15 }}>
                          {formatoMoneda(regsNeg.reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0))}
                        </span>
                        <span style={{ color: t.textoSuave }}>{negociosExpandido[negAg] ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {negociosExpandido[negAg] && (
                      <div style={{ overflowX: "auto", marginTop: 2 }}>
                        <table style={S.tabla}>
                          <thead>
                            <tr>
                              <th style={S.th}>Fecha</th>
                              {mediosPorNegocio[negAg].map(m => <th key={m} style={S.th}>{m}</th>)}
                              <th style={S.th}>Total</th>
                              <th style={S.th}>Acc.</th>
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

            {/* Filtros avanzados */}
            {mostrarAcumulados && (
              <div id="seccion-filtros" style={S.card}>
                <h3 style={S.sectionTitle}>🔍 Filtros avanzados</h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Desde</label>
                    <input type="date" style={{ ...S.input, marginBottom: 0 }} value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>Hasta</label>
                    <input type="date" style={{ ...S.input, marginBottom: 0 }} value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <button style={S.btnPrimary} onClick={() => {
                    const ahora = new Date();
                    setFiltroFechaDesde(new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split("T")[0]);
                    setFiltroFechaHasta(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().split("T")[0]);
                    calcularAcumulados(); calcularDetalleDiarioFiltrado();
                  }}>Este mes</button>
                  <button style={S.btnPrimary} onClick={() => {
                    const hoy = new Date().toISOString().split("T")[0];
                    setFiltroFechaDesde(hoy); setFiltroFechaHasta(hoy);
                    calcularAcumulados();
                  }}>Hoy</button>
                  <button style={S.btnSecondary} onClick={() => {
                    setFiltroFechaDesde(""); setFiltroFechaHasta(""); setFiltroNegociosMulti([]); setFiltroMediosMulti([]); setAcumulados([]);
                  }}>Limpiar</button>
                </div>

                <label style={S.label}>Negocios</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {Object.keys(mediosPorNegocio).map(n => (
                    <label key={n} style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: filtroNegociosMulti.includes(n) ? t.acento + "22" : t.superficie2, padding: "8px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${filtroNegociosMulti.includes(n) ? t.acento : t.borde}` }}>
                      <input type="checkbox" checked={filtroNegociosMulti.includes(n)} onChange={e => setFiltroNegociosMulti(e.target.checked ? [...filtroNegociosMulti, n] : filtroNegociosMulti.filter(x => x !== n))} style={{ width: 16, height: 16 }} />
                      <span style={{ fontSize: 13, color: filtroNegociosMulti.includes(n) ? t.acento : t.texto }}>{n}</span>
                    </label>
                  ))}
                </div>

                <button style={S.btnPrimary} onClick={() => { calcularAcumulados(); calcularDetalleDiarioFiltrado(); }}>
                  Aplicar filtros
                </button>

                {calcularIndicadores() && (
                  <div style={{ backgroundColor: t.superficie2, borderRadius: 12, padding: 16, marginTop: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Total", valor: formatoMoneda(calcularIndicadores().totalGeneral) },
                        { label: "Promedio/día", valor: formatoMoneda(calcularIndicadores().promedio.toFixed(0)) },
                        { label: "Días con datos", valor: calcularIndicadores().cantidadDias },
                        { label: "Registros", valor: calcularIndicadores().cantidadRegistros }
                      ].map(({ label, valor }) => (
                        <div key={label}>
                          <p style={{ fontSize: 11, color: t.textoSuave, margin: "0 0 2px", textTransform: "uppercase" }}>{label}</p>
                          <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: t.texto }}>{valor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {acumulados.length > 0 && (
                  <div style={{ overflowX: "auto", marginTop: 16 }}>
                    <table style={S.tabla}>
                      <thead><tr><th style={S.th}>Negocio</th><th style={S.th}>Medio</th><th style={{ ...S.th, textAlign: "right" }}>Total</th></tr></thead>
                      <tbody>
                        {acumulados.map((r, i) => (
                          <tr key={i}><td style={S.td(i % 2 === 0)}>{r.negocio}</td><td style={S.td(i % 2 === 0)}>{r.medio}</td><td style={{ ...S.td(i % 2 === 0), textAlign: "right", fontWeight: 600 }}>{formatoMoneda(r.total)}</td></tr>
                        ))}
                        <tr><td colSpan={2} style={{ ...S.td(false), fontWeight: 700 }}>TOTAL</td><td style={{ ...S.td(false), textAlign: "right", fontWeight: 800, color: t.acento }}>{formatoMoneda(acumulados.reduce((acc, r) => acc + r.total, 0))}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECCIÓN: EDITAR MESES ANTERIORES (solo admin)
        ══════════════════════════════════════════════ */}
        {seccionActiva === "editar" && (
          <div>
            {rolActual !== "admin" ? (
              <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 8 }}>🔒</p>
                <p style={{ color: t.textoSuave }}>Solo los administradores pueden editar registros de meses anteriores.</p>
              </div>
            ) : (
              <div>
                <div style={S.card}>
                  <h3 style={S.sectionTitle}>🔍 Buscar registro para editar</h3>
                  <p style={{ fontSize: 13, color: t.textoSuave, marginBottom: 16 }}>
                    Buscá por mes (ej: 2025-03) y/o nombre del negocio
                  </p>
                  <div>
                    <label style={S.label}>Mes</label>
                    <input
                      type="month"
                      style={S.input}
                      value={buscarFechaEdicion}
                      onChange={e => setBuscarFechaEdicion(e.target.value)}
                      placeholder="2025-01"
                    />
                  </div>
                  <div>
                    <label style={S.label}>Negocio (opcional)</label>
                    <select style={S.select} value={buscarNegocioEdicion} onChange={e => setBuscarNegocioEdicion(e.target.value)}>
                      <option value="">Todos los negocios</option>
                      {negocios.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button style={S.btnPrimary} onClick={buscarParaEditar}>
                    🔍 Buscar registros
                  </button>
                </div>

                {resultadosBusqueda.length > 0 && (
                  <div style={S.card}>
                    <h3 style={{ ...S.sectionTitle, fontSize: 16 }}>
                      {resultadosBusqueda.length} resultado{resultadosBusqueda.length !== 1 ? "s" : ""}
                    </h3>
                    {resultadosBusqueda.map((r, i) => (
                      <div key={r.id} style={{ backgroundColor: t.superficie2, borderRadius: 12, padding: "12px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px" }}>{r.negocio}</p>
                          <p style={{ fontSize: 13, color: t.textoSuave, margin: 0 }}>{r.fecha} — {formatoMoneda(r.totalDia)}</p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            style={S.btnEdit}
                            onClick={() => {
                              editarRegistroPorId(r.id);
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button style={S.btnDanger} onClick={() => eliminarRegistro(r.id)}>
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {resultadosBusqueda.length === 0 && buscarFechaEdicion && (
                  <div style={{ ...S.card, textAlign: "center", color: t.textoSuave }}>
                    <p>No se encontraron registros para los filtros seleccionados.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECCIÓN: INFORMES
        ══════════════════════════════════════════════ */}
        {seccionActiva === "informes" && (
          <div>
            <div style={S.card}>
              <h3 style={S.sectionTitle}>📊 Informes mensuales</h3>
              <label style={S.label}>Mes</label>
              <input type="month" style={S.input} value={mesSelecionado} onChange={e => setMesSelecionado(e.target.value)} />
              <button style={S.btnPrimary} onClick={filtrarInformesPorMes}>Ver informe</button>
            </div>

            {registrosFiltradosInforme.length > 0 && (
              <div>
                <div style={S.card}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, color: t.textoSuave, fontWeight: 600, textTransform: "uppercase" }}>💰 Acumulado del mes</h3>
                  {Object.entries(
                    registrosFiltradosInforme.reduce((acc, r) => {
                      if (!acc[r.negocio]) acc[r.negocio] = 0;
                      acc[r.negocio] += parseInt(r.totalDia || 0);
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).map(([neg, total]) => (
                    <div key={neg} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${t.borde}` }}>
                      <span style={{ fontSize: 15 }}>{neg}</span>
                      <span style={{ fontWeight: 700, color: t.acento }}>{formatoMoneda(total)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontWeight: 800, fontSize: 16 }}>
                    <span>TOTAL</span>
                    <span style={{ color: t.exito }}>{formatoMoneda(registrosFiltradosInforme.reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0))}</span>
                  </div>
                </div>

                <div style={S.card}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, color: t.textoSuave, fontWeight: 600, textTransform: "uppercase" }}>📈 Evolución acumulada</h3>
                  <Line
                    data={(() => {
                      const ahora = new Date(mesSelecionado + "-01");
                      const anio = ahora.getFullYear();
                      const mes = ahora.getMonth();
                      const dias = new Date(anio, mes + 1, 0).getDate();
                      const labels = Array.from({ length: dias }, (_, i) => `${String(i + 1).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${anio}`);
                      const datos = {};
                      negocios.forEach(n => datos[n] = Array(dias).fill(0));
                      registrosFiltradosInforme.forEach(r => {
                        const [d] = r.fecha.split("/").map(Number);
                        if (datos[r.negocio]) {
                          datos[r.negocio][d - 1] += mediosTodos.reduce((sum, m) => sum + parseInt(r[m] || 0), 0);
                        }
                      });
                      negocios.forEach(n => { for (let i = 1; i < dias; i++) datos[n][i] += datos[n][i - 1]; });
                      return { labels, datasets: negocios.map((n, i) => ({ label: n, data: datos[n], borderColor: colores[i % colores.length], backgroundColor: colores[i % colores.length], fill: false, tension: 0.3, borderWidth: 2, pointRadius: 3 })) };
                    })()}
                    options={{ responsive: true, plugins: { legend: { position: "bottom", labels: { color: t.texto, font: { size: 11 } } } }, scales: { y: { ticks: { callback: v => "$" + v.toLocaleString("es-AR"), color: t.textoSuave }, grid: { color: t.borde } }, x: { ticks: { autoSkip: true, maxTicksLimit: 10, color: t.textoSuave }, grid: { color: t.borde } } } }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Barra de navegación inferior (mobile) ── */}
      <div style={S.navBar}>
        {[
          { id: "dashboard", icon: "🏠", label: "Inicio" },
          { id: "carga", icon: "📅", label: "Carga" },
          { id: "editar", icon: "✏️", label: "Editar" },
          { id: "informes", icon: "📊", label: "Informes" },
        ].map(({ id, icon, label }) => (
          <button key={id} style={S.navBtn(seccionActiva === id)} onClick={() => setSeccionActiva(id)}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}
