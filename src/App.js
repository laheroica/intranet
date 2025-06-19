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


ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip
);



export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [negocio, setNegocio] = useState("");
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [registros, setRegistros] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [totalesMesActual, setTotalesMesActual] = useState({});
  const [mostrarAcumulados, setMostrarAcumulados] = useState(false);
  const [mostrarMediosMes, setMostrarMediosMes] = useState(false);
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

const calcularAcumulados = () => {
  const desde = filtroFechaDesde ? new Date(filtroFechaDesde) : null;
  const hasta = filtroFechaHasta ? new Date(filtroFechaHasta) : null;


  const lista = registros.filter((r) => {
    const [dia, mes, anio] = r.fecha.split("/").map(Number);
    const fecha = new Date(`${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
    const dentroRango = (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
    const negocioOK = filtroNegociosMulti.length === 0 || filtroNegociosMulti.includes(r.negocio);
    const mediosOK = filtroMediosMulti.length === 0 || filtroMediosMulti.some(m => r[m]);
    return dentroRango && negocioOK && mediosOK;
  });

  setRegistrosFiltrados(lista); // 🔥 ESTA LÍNEA NUEVA

  const resultado = {};
  lista.forEach((r) => {
    const nombreNegocio = r.negocio;
    Object.entries(r).forEach(([k, v]) => {
      if (mediosTodos.includes(k) && (!filtroMediosMulti.length || filtroMediosMulti.includes(k))) {
        if (!resultado[nombreNegocio]) resultado[nombreNegocio] = {};
        if (!resultado[nombreNegocio][k]) resultado[nombreNegocio][k] = 0;
        resultado[nombreNegocio][k] += parseInt(v || 0);
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



  const mediosPorNegocio = {
    Felizcitas: ["Efectivo", "TB Alvaro", "TB Deni", "TB Moni", "MP Alvaro", "MP Deni", "MP Moni", "BLP", "BNA"],
    Terrazas: ["Efectivo", "Débito", "Crédito", "QR"],
    "Athlon 107": ["Efectivo", "MP Alvaro"],
    "Athlon 24": ["Efectivo", "MP Deni"],
    Alquileres: ["Efectivo"],
    Xtras: ["Efectivo"],
  };

  const mediosTodos = Array.from(new Set(Object.values(mediosPorNegocio).flat()));
useEffect(() => {
  if (isLoggedIn) {
    cargarRegistros();

    const ahora = new Date();
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    if (inicio instanceof Date && !isNaN(inicio)) {
      setFiltroFechaDesde(inicio.toISOString().split("T")[0]);
    } else {
      console.warn("Fecha inválida (inicio del mes)");
      setFiltroFechaDesde("");
    }

    setFiltroNegociosMulti(Object.keys(mediosPorNegocio));
    setFiltroMediosMulti(mediosTodos);
    setMostrarDetalleGrafico(true);
  }
}, [isLoggedIn]);

useEffect(() => {
  if (ultimaFechaGlobal instanceof Date && !isNaN(ultimaFechaGlobal)) {
    setFiltroFechaHasta(ultimaFechaGlobal.toISOString().split("T")[0]);
  } else {
    console.warn("Fecha inválida (última fecha global):", ultimaFechaGlobal);
    setFiltroFechaHasta("");
  }
}, [ultimaFechaGlobal]);

useEffect(() => {
  if (
    filtroFechaDesde &&
    filtroFechaHasta &&
    filtroNegociosMulti.length > 0 &&
    filtroMediosMulti.length > 0 &&
    registros.length > 0
  ) {
    calcularAcumulados();
    calcularDetalleDiarioFiltrado();
  }
}, [
  filtroFechaDesde,
  filtroFechaHasta,
  filtroNegociosMulti,
  filtroMediosMulti,
  registros
]);




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
      const [db, mb, ab] = b.split("/").map(Number);
      return new Date(`${ab}-${mb}-${db}`) - new Date(`${aa}-${ma}-${da}`);
    });
    ultimos[neg] = ordenadas[ordenadas.length - 1];
  });

  setUltimosDiasPorNegocio(ultimos);
  // Calcular la última fecha cargada entre todos los registros
const todasLasFechas = data
  .filter(r => r.fecha && r.fecha.includes("/"))
  .map(r => {
    const [dia, mes, anio] = r.fecha.split("/").map(Number);
    return new Date(`${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  });

if (todasLasFechas.length > 0) {
  const ultimaFechaCargada = new Date(Math.max(...todasLasFechas));
  setUltimaFechaGlobal(ultimaFechaCargada);
} else {
  setUltimaFechaGlobal(null); // o lo podés dejar sin setear
}


const ultimaFechaCargada = new Date(Math.max(...todasLasFechas));
setUltimaFechaGlobal(ultimaFechaCargada);

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

    const lista = Object.entries(totales).map(([medio, total]) => ({
      medio,
      total,
    }));
    console.log("TOTAL POR MEDIO", lista);
console.log("TOTAL POR NEGOCIO", totalesMesActual);

    setAcumuladosPorMedioMes(lista);
  };

  const formatoMoneda = (valor) => {
    if (!valor) return "$0";
    return "$" + parseInt(valor).toLocaleString("es-AR");
  };
  const calcularIndicadores = () => {
  if (acumulados.length === 0) return null;

  const totalGeneral = acumulados.reduce((acc, r) => acc + r.total, 0);

  const fechasUnicas = new Set(registros
    .filter((r) => {
      const [dia, mes, anio] = r.fecha.split("/").map(Number);
      const fecha = new Date(`${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
      const desde = filtroFechaDesde ? new Date(filtroFechaDesde) : null;
      const hasta = filtroFechaHasta ? new Date(filtroFechaHasta) : null;
      return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
    })
    .map(r => r.fecha)
  );

  const cantidadDias = fechasUnicas.size;
  const promedio = cantidadDias > 0 ? totalGeneral / cantidadDias : 0;

  return {
    totalGeneral,
    promedio,
    cantidadDias,
    cantidadRegistros: acumulados.length
  };
};

const calcularDetalleDiarioFiltrado = () => {
  const desde = filtroFechaDesde ? new Date(filtroFechaDesde) : null;
  const hasta = filtroFechaHasta ? new Date(filtroFechaHasta) : null;

const listaFiltrada = registrosFiltrados;



  const agrupado = {};
  listaFiltrada.forEach((r) => {
    const fecha = r.fecha;
    if (!agrupado[fecha]) agrupado[fecha] = {};

    Object.entries(r).forEach(([k, v]) => {
      if (mediosTodos.includes(k)) {
        if (!agrupado[fecha][k]) agrupado[fecha][k] = 0;
        agrupado[fecha][k] += parseInt(v || 0);
      }
    });
  });

  const lista = Object.entries(agrupado).map(([fecha, valores]) => ({
    fecha,
    ...valores
  }));

  // Orden de más antigua a más nueva
  lista.sort((a, b) => {
    const [da, ma, aa] = a.fecha.split("/").map(Number);
    const [db, mb, ab] = b.fecha.split("/").map(Number);
    return new Date(`${aa}-${ma}-${da}`) - new Date(`${ab}-${mb}-${db}`);
  });

  setDetalleDiario(lista);
};

const eliminarRegistro = async (id) => {
  const confirm = window.confirm("¿Eliminar este registro?");
  if (!confirm) return;

  try {
    await deleteDoc(doc(db, "registros", id));
    alert("Registro eliminado.");
    cargarRegistros(); // 🔁 Esto vuelve a cargar la lista
  } catch (error) {
    console.error("Error eliminando el documento:", error);
    alert("❌ Hubo un error al eliminar.");
  }
};
const registrosOrdenados = () => {
  return [...registros].sort((a, b) => {
    const [da, ma, aa] = a.fecha.split("/").map(Number);
    const [db, mb, ab] = b.fecha.split("/").map(Number);
    return new Date(`${ab}-${mb}-${db}`) - new Date(`${aa}-${ma}-${da}`); // orden descendente: más nuevo primero
  });
};


const editarRegistro = (fecha, negocio) => {
  const registro = registros.find(r => r.fecha === fecha && r.negocio === negocio);
  if (!registro) {
    alert("No se encontró el registro.");
    return;
  }

  setNegocio(registro.negocio);
  setFechaSeleccionada(() => {
    const [dia, mes, anio] = registro.fecha.split("/");
    return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  });

  const nuevoForm = {};
  Object.entries(registro).forEach(([k, v]) => {
    if (mediosTodos.includes(k)) nuevoForm[k] = v;
  });

  setFormData(nuevoForm);
  setModoEdicion(true);
  setIdEnEdicion(registro.id);
};
const colores = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0",
  "#9966FF", "#FF9F40", "#A0522D", "#008000",
  "#DC143C", "#00CED1", "#B8860B", "#2E8B57"
];
console.log("✏️ Editando registro con ID:", idEnEdicion);
const editarRegistroPorId = async (id) => {
  const registro = registros.find(r => r.id === id);
  if (!registro) {
    alert("No se encontró el registro.");
    return;
  }

  setNegocio(registro.negocio);

  const [dia, mes, anio] = registro.fecha.split("/");
  const fechaISO = `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  setFechaSeleccionada(fechaISO);

  const nuevoForm = {};
  mediosTodos.forEach(m => {
    nuevoForm[m] = registro[m] || "";
  });

  setFormData(nuevoForm);
  setModoEdicion(true);
  setIdEnEdicion(registro.id);

  // 🔥 Solución robusta: mostrar el formulario y esperar renderizado
  setMostrarCargaDia(true);

  // Esperar un tick para asegurar que el render se complete
  setTimeout(() => {
    const seccion = document.getElementById("seccion-cargar-dia");
    if (seccion) {
      seccion.scrollIntoView({ behavior: "smooth" });
    } else {
      console.warn("No se encontró el div con id 'seccion-cargar-dia'");
    }
  }, 300); // tiempo aumentado para asegurar que se renderice
};



const exportarTablaAExcel = () => {
  const datosParaExcel = [];

  Object.entries(
    registrosFiltrados.sort((a, b) => {
  const [da, ma, aa] = a.fecha.split("/").map(Number);
  const [db, mb, ab] = b.fecha.split("/").map(Number);
  return new Date(`${ab}-${mb}-${db}`) - new Date(`${aa}-${ma}-${da}`);
}).reduce((acc, reg) => {
      if (!acc[reg.negocio]) acc[reg.negocio] = [];
      acc[reg.negocio].push(reg);
      return acc;
    }, {})
  ).forEach(([negocio, registrosNegocio]) => {
    datosParaExcel.push([`${negocio}`]);
    datosParaExcel.push([
      "Fecha",
      "Negocio",
      ...mediosTodos,
      "Total del Día"
    ]);

    registrosNegocio.forEach((r) => {
      const fila = [
        r.fecha,
        r.negocio,
        ...mediosTodos.map(m => r[m] || 0),
        r.totalDia
      ];
      datosParaExcel.push(fila);
    });

    // Subtotal por medios
    const subtotales = mediosTodos.map((medio) =>
      registrosNegocio.reduce((acc, r) => acc + parseInt(r[medio] || 0), 0)
    );
    const totalGeneral = registrosNegocio.reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0);
    datosParaExcel.push(["", "Subtotal", ...subtotales, totalGeneral]);
    datosParaExcel.push([]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(datosParaExcel);
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([blob]), "registros_negocios.xlsx");
};
// Agrupar registros por negocio
const registrosPorNegocio = {};
registros.forEach((r) => {
  if (!registrosPorNegocio[r.negocio]) registrosPorNegocio[r.negocio] = [];
  registrosPorNegocio[r.negocio].push(r);
});
Object.keys(registrosPorNegocio).forEach((neg) => {
  registrosPorNegocio[neg].sort((a, b) => {
    const [da, ma, aa] = a.fecha.split("/").map(Number);
    const [db, mb, ab] = b.fecha.split("/").map(Number);
    return new Date(`${ab}-${mb}-${db}`) - new Date(`${aa}-${ma}-${da}`);
  });
});
const estiloBoton = (bgColor, textColor) => ({
  padding: "10px 20px",
  borderRadius: "12px",
  border: "none",
  background: bgColor,
  color: textColor,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
  transition: "all 0.2s ease-in-out"
});


const generarEvolucionDiariaAcumulada = () => {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth(); // 0-indexed

  const negocios = ["Felizcitas", "Terrazas", "Athlon 107", "Athlon 24", "Xtras", "Alquileres"];
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();

  const fechas = Array.from({ length: diasDelMes }, (_, i) => {
    const dia = String(i + 1).padStart(2, "0");
    const mesStr = String(mes + 1).padStart(2, "0");
    return `${dia}/${mesStr}/${anio}`;
  });

  const acumuladoPorNegocio = {};
  negocios.forEach(n => {
    acumuladoPorNegocio[n] = Array(diasDelMes).fill(0);
  });

  registros.forEach(r => {
    const [d, m, y] = r.fecha.split("/").map(Number);
    if (m === mes + 1 && y === anio && negocios.includes(r.negocio)) {
      const diaIndex = d - 1;
      const total = Object.entries(r)
        .filter(([k]) => mediosTodos.includes(k))
        .reduce((sum, [, v]) => sum + parseInt(v || 0), 0);

      acumuladoPorNegocio[r.negocio][diaIndex] += total;
    }
  });

  negocios.forEach(n => {
    for (let i = 1; i < diasDelMes; i++) {
      acumuladoPorNegocio[n][i] += acumuladoPorNegocio[n][i - 1];
    }
  });

  return {
    labels: fechas,
    datasets: negocios.map((n, i) => ({
      label: n,
      data: acumuladoPorNegocio[n],
      borderColor: colores[i % colores.length],
      backgroundColor: colores[i % colores.length],
      fill: false,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 4
    }))
  };
};
const generarFacturacionDiariaPorNegocio = () => {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth(); // 0-indexed

  const diasDelMes = new Date(anio, mes + 1, 0).getDate();

  const fechas = Array.from({ length: diasDelMes }, (_, i) => {
    const dia = String(i + 1).padStart(2, "0");
    const mesStr = String(mes + 1).padStart(2, "0");
    return `${dia}/${mesStr}/${anio}`;
  });

  const facturacionPorNegocio = {};
  negocios.forEach(n => {
    facturacionPorNegocio[n] = Array(diasDelMes).fill(0);
  });

  registros.forEach(r => {
    const [d, m, y] = r.fecha.split("/").map(Number);
    if (m === mes + 1 && y === anio && negocios.includes(r.negocio)) {
      const diaIndex = d - 1;
      const total = Object.entries(r)
        .filter(([k]) => mediosTodos.includes(k))
        .reduce((sum, [, v]) => sum + parseInt(v || 0), 0);

      facturacionPorNegocio[r.negocio][diaIndex] += total;
    }
  });

  return {
    labels: fechas,
    datasets: negocios.map((n, i) => ({
      label: n,
      data: facturacionPorNegocio[n],
      borderColor: colores[i % colores.length],
      backgroundColor: colores[i % colores.length],
      fill: false,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 4
    }))
  };
};

const negocios = ["Felizcitas", "Terrazas", "Athlon 107", "Athlon 24", "Xtras", "Alquileres"];
const [negociosExpandido, setNegociosExpandido] = useState(() =>
  negocios.reduce((acc, n) => ({ ...acc, [n]: false }), {})
);
const toggleNegocio = (nombre) => {
  setNegociosExpandido(prev => ({
    ...prev,
    [nombre]: !prev[nombre]
  }));
};

return (
<div style={{ padding: 40, fontFamily: "Arial, sans-serif", backgroundColor: "#f9f9f9" }}>
    {!isLoggedIn ? (
      <div>
        <h2>Iniciar sesión</h2>
        <input placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} /><br />
        <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><br />
        <button onClick={() => {
          if (username === "admin" && password === "11998844") {
            setIsLoggedIn(true);
          } else {
            alert("Usuario o contraseña incorrectos");
          }
        }}>Entrar</button>
      </div>
     ) : (
  <>
    {seccionActiva === "dashboard" && (
      <div style={{ textAlign: "center" }}>
        <h2>📊 Dashboard Principal</h2>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "20px", marginTop: 30 }}>
  <button
    onClick={() => setSeccionActiva("carga")}
    style={{
      padding: "15px 25px",
      borderRadius: "12px",
      background: "#007BFF",
      color: "white",
      fontWeight: "bold",
      border: "none",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      cursor: "pointer",
      transition: "all 0.2s",
    }}
    onMouseOver={(e) => e.target.style.background = "#0056b3"}
    onMouseOut={(e) => e.target.style.background = "#007BFF"}
  >
    📥 Carga de Datos
  </button>

  <button
    onClick={() => setSeccionActiva("ventas")}
    style={{
      padding: "15px 25px",
      borderRadius: "12px",
      background: "#28A745",
      color: "white",
      fontWeight: "bold",
      border: "none",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      cursor: "pointer",
      transition: "all 0.2s",
    }}
    onMouseOver={(e) => e.target.style.background = "#1e7e34"}
    onMouseOut={(e) => e.target.style.background = "#28A745"}
  >
    💰 Ventas / Costos
  </button>

  <button
    onClick={() => setSeccionActiva("informes")}
    style={{
      padding: "15px 25px",
      borderRadius: "12px",
      background: "#17A2B8",
      color: "white",
      fontWeight: "bold",
      border: "none",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      cursor: "pointer",
      transition: "all 0.2s",
    }}
    onMouseOver={(e) => e.target.style.background = "#117a8b"}
    onMouseOut={(e) => e.target.style.background = "#17A2B8"}
  >
    📈 Informes
  </button>
</div>

      </div>
    )}

    {seccionActiva === "carga" && (
      <>
       <div style={{ backgroundColor: "#fff", padding: 25, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: 30 }}>
  <h2 style={{ fontFamily: "Arial, sans-serif", marginBottom: 5 }}>Intranet Negocios</h2>
  <p style={{ fontFamily: "Arial, sans-serif" }}>Bienvenido al sistema de control de ingresos.</p>
</div>
       <div style={{
  display: "flex",
  gap: "15px",
  margin: "25px 0",
  flexWrap: "wrap"
}}>
  <button
    onClick={() => {
      setMostrarCargaDia(true);
  setTimeout(() => {
    const seccion = document.getElementById("seccion-cargar-dia");
    if (seccion) seccion.scrollIntoView({ behavior: "smooth" });
  }, 100);

    }}
    style={estiloBoton("#007BFF", "white")}
  >
    📥 Cargar día
  </button>

  <button
    onClick={() => {
      setMostrarAcumulados(true);
      setTimeout(() => {
        const seccion = document.getElementById("seccion-filtros");
        if (seccion) seccion.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }}
    style={estiloBoton("#28A745", "white")}
  >
    🔍 Filtrar info
  </button>

  <button
    onClick={() => {
      const seccion = document.getElementById("registros-individuales");
      if (seccion) seccion.scrollIntoView({ behavior: "smooth" });
    }}
    style={estiloBoton("#FFC107", "#333")}
  >
    📄 Ver registros
  </button>

  <button
    onClick={() => {
      const seccion = document.getElementById("grafico-diario");
      if (seccion) seccion.scrollIntoView({ behavior: "smooth" });
    }}
    style={estiloBoton("#6F42C1", "white")}
  >
    📊 Ver gráfico diario
  </button>

  <button
    onClick={exportarTablaAExcel}
    style={estiloBoton("#17A2B8", "white")}
  >
    📤 Exportar Excel
  </button>
</div>


<div style={{ background: "#ffffff", padding: "15px", borderRadius: "8px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
  <h3>📆 Acumulado del mes actual</h3>
  <ul style={{ listStyleType: "none", padding: 0 }}>
    {[
      "Felizcitas",
      "Terrazas",
      "Athlon 107",
      "Athlon 24",
      "Xtras",
      "Alquileres"
    ].map((neg) => (
      <li key={neg} style={{ marginBottom: 5 }}>
        <strong>{neg}:</strong> {formatoMoneda(totalesMesActual[neg] || 0)}
      </li>
    ))}
    <li style={{ borderTop: "1px solid #ccc", marginTop: 10, paddingTop: 5 }}>
      <strong>🔢 Total general:</strong>{" "}
      {formatoMoneda(
        Object.values(totalesMesActual).reduce((acc, v) => acc + parseInt(v || 0), 0)
      )}
    </li>
    <li style={{ marginTop: 5 }}>
  <strong>📅 Acumulado del año:</strong>{" "}
  {formatoMoneda(
    registros
      .filter(r => {
        const [d, m, y] = r.fecha.split("/").map(Number);
        const fecha = new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
        const inicioAnio = new Date(new Date().getFullYear(), 0, 1);
        return fecha >= inicioAnio;
      })
      .reduce((acc, r) => acc + parseInt(r.totalDia || 0), 0)
  )}
</li>

  </ul>
</div>
{acumuladosPorMedioMes.length > 0 && (
<div style={{ background: "#ffffff", padding: "15px", borderRadius: "8px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
    <h3>💳 Medios de pago del mes actual</h3>
<table
  border="1"
  cellPadding="5"
  style={{
    width: "100%",
    maxWidth: "50%",
    minWidth: "300px",
    borderCollapse: "collapse",
    fontFamily: "Arial, sans-serif"
  }}
>
      <thead>
  <tr style={{ background: "#ddd" }}>
    <th style={{ textAlign: "right", border: "1px solid #888" }}>Medio</th>
    <th style={{ textAlign: "right", border: "1px solid #888" }}>Total</th>
  </tr>
</thead>

      <tbody>
        {[...acumuladosPorMedioMes]
          .sort((a, b) => b.total - a.total)
          .map(({ medio, total }) => (
            <tr key={medio}>
              <td>{medio}</td>
              <td style={{ textAlign: "right" }}>{formatoMoneda(total)}</td>
            </tr>
          ))}
        <tr style={{ background: "#eee", fontWeight: "bold" }}>
          <td>Total general</td>
        <td style={{ textAlign: "right" }}>
  {formatoMoneda(
    acumuladosPorMedioMes.reduce((acc, m) => acc + parseInt(m.total || 0), 0)
  )}
</td>


        </tr>
      </tbody>
    </table>
  </div>
)}
<div style={{ maxWidth: "100%", marginTop: 20 }}>
  <h3>📈 Evolución acumulada diaria por negocio (mes actual)</h3>
  <Line
    data={generarEvolucionDiariaAcumulada()}
    options={{
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: $${parseInt(context.raw).toLocaleString("es-AR")}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => "$" + value.toLocaleString("es-AR")
          }
        },
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 15
          }
        }
      }
    }}
  />
</div>
<div style={{ maxWidth: "100%", marginTop: 40 }}>
  <h3>📉 Facturación diaria por negocio (mes actual)</h3>
  <Line
    data={generarFacturacionDiariaPorNegocio()}
    options={{
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: $${parseInt(context.raw).toLocaleString("es-AR")}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => "$" + value.toLocaleString("es-AR")
          }
        },
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 15
          }
        }
      }
    }}
  />
</div>

<div style={{ maxWidth: "100%", marginTop: 20 }}>
  <Line
    data={{
      labels: [
        "Felizcitas",
        "Terrazas",
        "Athlon 107",
        "Athlon 24",
        "Xtras",
        "Alquileres"
      ],
      datasets: [
        {
          label: "Facturación mensual",
          data: [
            totalesMesActual["Felizcitas"] || 0,
            totalesMesActual["Terrazas"] || 0,
            totalesMesActual["Athlon 107"] || 0,
            totalesMesActual["Athlon 24"] || 0,
            totalesMesActual["Xtras"] || 0,
            totalesMesActual["Alquileres"] || 0
          ],
          borderColor: "#36A2EB",
          backgroundColor: "#36A2EB",
          fill: false,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 5
        }
      ]
    }}
    options={{
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: "top"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => "$" + value.toLocaleString("es-AR")
          }
        }
      }
    }}
  />
</div>


        
  <div style={{ marginTop: 40 }}>
 <div style={{ display: "flex", gap: "10px", marginTop: 30, marginBottom: 30 }}>
 

  


</div>


{mostrarAcumulados && (
  <div id="seccion-filtros">
    <h3 style={{ marginTop: 20 }}>Totales por negocio y medio (según filtros)</h3>

      <label>Fecha desde:</label><br />
      <input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} /><br />

      <label>Fecha hasta:</label><br />
      <input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} /><br /><br />

      <div style={{ marginTop: 10, marginBottom: 10 }}>
  <button
  onClick={() => {
    try {
      const ahora = new Date();
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

      if (inicio instanceof Date && !isNaN(inicio)) {
        setFiltroFechaDesde(inicio.toISOString().split("T")[0]);
      } else {
        console.warn("⚠️ Fecha de inicio inválida:", inicio);
        setFiltroFechaDesde("");
      }

      if (fin instanceof Date && !isNaN(fin)) {
        setFiltroFechaHasta(fin.toISOString().split("T")[0]);
      } else {
        console.warn("⚠️ Fecha de fin inválida:", fin);
        setFiltroFechaHasta("");
      }

      calcularAcumulados();
      calcularDetalleDiarioFiltrado();

    } catch (error) {
      console.error("🛑 Error al formatear fechas:", error);
    }
  }}
  style={estiloBoton("#007BFF", "white")}
>
  📊 Ver acumulados del mes
</button>



  <button
    style={{ marginLeft: 10 }}
    onClick={() => {
      const hoy = new Date().toISOString().split("T")[0];
      setFiltroFechaDesde(hoy);
      setFiltroFechaHasta(hoy);
      calcularAcumulados();
    }}
  >
    📆 Ver hoy
  </button>

  <button
    style={{ marginLeft: 10 }}
    onClick={() => {
      setFiltroFechaDesde("");
      setFiltroFechaHasta("");
      setFiltroNegociosMulti([]);
      setFiltroMediosMulti([]);
      setAcumulados([]);
    }}
  >
    🧹 Limpiar filtros
  </button>
</div>


      <label>Negocios:</label><br />
      {Object.keys(mediosPorNegocio).map((n) => (
        <label key={n} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={filtroNegociosMulti.includes(n)}
            onChange={(e) => {
              if (e.target.checked) {
                setFiltroNegociosMulti([...filtroNegociosMulti, n]);
              } else {
                setFiltroNegociosMulti(filtroNegociosMulti.filter((x) => x !== n));
              }
            }}
          />{" "}
          {n}
        </label>
      ))}

      <label>Medios de pago:</label><br />
      {mediosTodos.map((m) => (
        <label key={m} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={filtroMediosMulti.includes(m)}
            onChange={(e) => {
              if (e.target.checked) {
                setFiltroMediosMulti([...filtroMediosMulti, m]);
              } else {
                setFiltroMediosMulti(filtroMediosMulti.filter((x) => x !== m));
              }
            }}
          />{" "}
          {m}
        </label>
      ))}

      <br />
      <button onClick={calcularAcumulados}>Aplicar filtros</button>

{calcularIndicadores() && (
  <div style={{
    background: "#f4f4f4",
    padding: "10px",
    marginTop: "20px",
    borderRadius: "8px"
  }}>
    <strong>📊 Indicadores:</strong>
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      <li><strong>Total general:</strong> {formatoMoneda(calcularIndicadores().totalGeneral)}</li>
      <li><strong>Promedio diario:</strong> {formatoMoneda(calcularIndicadores().promedio.toFixed(0))}</li>
      <li><strong>Días únicos con registros:</strong> {calcularIndicadores().cantidadDias}</li>
      <li><strong>Registros mostrados:</strong> {calcularIndicadores().cantidadRegistros}</li>
    </ul>
  </div>
)}
      {acumulados.length > 0 && (
        

<table
  border="1"
  cellPadding="5"
  style={{
    marginTop: 20,
    width: "100%",
    maxWidth: "50%",
    minWidth: "300px",
    borderCollapse: "collapse",
    fontFamily: "Arial, sans-serif"
  }}
>
         
<thead>
  <tr style={{ background: "#f0f0f0", fontWeight: "bold" }}>
    <th style={{ border: "1px solid #888" }}>Negocio</th>
    <th style={{ border: "1px solid #888" }}>Medio</th>
    <th style={{ border: "1px solid #888" }}>Total</th>
  </tr>
</thead>

          <tbody>
            {acumulados.map((r, i) => (
              <tr key={i}>
                <td>{r.negocio}</td>
                <td>{r.medio}</td>
                <td style={{ textAlign: "right" }}>{formatoMoneda(r.total)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2}><strong>TOTAL GENERAL</strong></td>
              <td style={{ textAlign: "right" }}><strong>{formatoMoneda(acumulados.reduce((acc, r) => acc + r.total, 0))}</strong></td>
            </tr>
          </tbody>
        </table>
      )}
  </div>
)}
</div>

{mostrarCargaDia && (
  <>
<div id="seccion-cargar-dia" style={{ marginTop: 30 }}>
      <h3>Cargar día</h3>

      {modoEdicion && (
        <div style={{
          marginBottom: 10,
          padding: 8,
          background: "#fff8dc",
          border: "1px solid #aaa",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>
            <strong>🟨 Editando:</strong>{" "}
            {fechaSeleccionada && new Date(fechaSeleccionada).toLocaleDateString("es-AR")} - {negocio}
          </span>
          <button
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.2rem",
              cursor: "pointer",
              color: "#a00"
            }}
            onClick={() => {
              setModoEdicion(false);
              setIdEnEdicion(null);
              setFormData({});
              setNegocio("");
              setFechaSeleccionada("");
            }}
          >
            ✖️
          </button>
        </div>
      )}

      <label>Fecha:</label><br />
      <input
        type="date"
        value={fechaSeleccionada}
        onChange={(e) => setFechaSeleccionada(e.target.value)}
      /><br /><br />

      <label>Negocio:</label><br />
      <select value={negocio} onChange={(e) => setNegocio(e.target.value)}>
        <option value="">Seleccionar</option>
        {Object.keys(mediosPorNegocio).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select><br /><br />

      {negocio && mediosPorNegocio[negocio].map((medio) => (
        <div key={medio}>
          <label>{medio}</label><br />
          <input
            type="text"
            inputMode="numeric"
            placeholder={`Monto para ${medio}`}
            value={formData[medio] || ""}
            onChange={(e) => {
              const regex = /^\d{0,10}$/;
              const value = e.target.value;
              if (regex.test(value)) {
                setFormData({ ...formData, [medio]: value });
                setErrors({ ...errors, [medio]: false });
              } else {
                setErrors({ ...errors, [medio]: true });
              }
            }}
          /><br />
          {errors[medio] && (
            <p style={{ color: "red" }}>
              Solo números, hasta 10 dígitos, sin puntos ni comas
            </p>
          )}
        </div>
      ))}

      {negocio && (
        <div style={{ marginTop: 10 }}>
          <strong>Total del día: </strong>
          {formatoMoneda(
            Object.entries(formData).reduce((sum, [, val]) => sum + parseInt(val || 0), 0)
          )}
        </div>
      )}

      {negocio && (
        <div style={{ marginTop: 10 }}>
          {!modoEdicion ? (
            <button
              disabled={!fechaSeleccionada}
              onClick={async () => {
                if (!fechaSeleccionada) {
                  alert("Debe seleccionar una fecha antes de guardar.");
                  return;
                }

const [anio, mes, dia] = fechaSeleccionada.split("-");
const fechaFormateada = `${dia}/${mes}/${anio}`;

                

                const totalDia = Object.entries(formData).reduce(
                    (sum, [, val]) => sum + parseInt(val || 0, 10),

                  0
                );

                const nuevoRegistro = {
                  fecha: fechaFormateada,
                  negocio,
                  totalDia,
                  ...formData
                };

await addDoc(collection(db, "registros"), nuevoRegistro);
                setFormData({});
                setNegocio("");
                setFechaSeleccionada("");
                cargarRegistros();
              }}
            >
              Guardar
            </button>
          ) : (
            <>
              <button onClick={async () => {
  if (!fechaSeleccionada || !negocio) {
    alert("Debe seleccionar fecha y negocio.");
    return;
  }

  const [anio, mes, dia] = fechaSeleccionada.split("-");
  const fechaFormateada = `${dia}/${mes}/${anio}`;

  // ✅ Revisión precisa: ¿existe OTRO registro con misma fecha y negocio?
  if (!modoEdicion) {
  const duplicado = registros.find(r =>
    r.fecha === fechaFormateada &&
    r.negocio === negocio
  );

  if (duplicado) {
    alert(`Ya existe un registro para ${negocio} el ${fechaFormateada}`);
    return;
  }
}


  const totalDia = Object.entries(formData).reduce(
    (sum, [, val]) => sum + parseInt(val || 0),
    0
  );

  const actualizado = {
    fecha: fechaFormateada,
    negocio,
    totalDia,
    ...formData
  };

  try {
    await updateDoc(doc(db, "registros", idEnEdicion), actualizado);
    alert("Registro actualizado correctamente ✅");

    setFormData({});
    setNegocio("");
    setFechaSeleccionada("");
    setModoEdicion(false);
    setIdEnEdicion(null);
    cargarRegistros();
  } catch (error) {
    console.error("❌ Error al actualizar:", error);
    alert("Ocurrió un error al actualizar el registro.");
  }
}}>
  Actualizar
</button>





              <button style={{ marginLeft: 10 }} onClick={() => {
                setModoEdicion(false);
                setIdEnEdicion(null);
                setFormData({});
                setNegocio("");
                setFechaSeleccionada("");
              }}>
                Cancelar edición
              </button>
            </>
          )}
        </div>
      )}
    </div>
  </>
)}



         {/* Detalle gráfico: tabla + gráfico */}
  <div style={{ marginTop: 40 }}>
  <button onClick={() => {
  setMostrarDetalleGrafico(!mostrarDetalleGrafico);
  calcularDetalleDiarioFiltrado();
}}>
    {mostrarDetalleGrafico ? "Ocultar gráfico diario" : "Detalle gráfico"}
  </button>
<h3 id="registros-individuales" style={{ marginTop: 30 }}>📄 Registros individuales</h3>

{negocios.map((negocioAgrupado) => {
  const registrosNegocio = registrosOrdenados().filter(r => r.negocio === negocioAgrupado);
  if (registrosNegocio.length === 0) return null;
  const expandido = negociosExpandido[negocioAgrupado];

  return (
    <div key={negocioAgrupado} style={{ marginBottom: 10 }}>
      <div
        style={{
          background: "#f0f0f0",
          padding: 10,
          cursor: "pointer",
          fontWeight: "bold",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: "1px solid #ccc",
          borderRadius: 5
        }}
        onClick={() =>
          setNegociosExpandido(prev => ({
            ...prev,
            [negocioAgrupado]: !prev[negocioAgrupado]
          }))
        }
      >
        <span>{negocioAgrupado}</span>
        <span>{negociosExpandido[negocioAgrupado] ? "⬆️" : "⬇️"}</span>
      </div>

      {negociosExpandido[negocioAgrupado] && (
        <table
          border="0"
          cellPadding="8"
          style={{
            width: "100%",
            marginBottom: 20,
            borderCollapse: "collapse",
            fontFamily: "Arial, sans-serif",
            marginTop: 5
          }}
        >
          <thead>
            <tr style={{ background: "#f0f0f0", fontWeight: "bold" }}>
              <td style={{ border: "1px solid #888", textAlign: "left" }}>Fecha</td>
              {mediosTodos.map(m => (
                <td key={m} style={{ border: "1px solid #888", textAlign: "right" }}>{m}</td>
              ))}
              <td style={{ border: "1px solid #888", textAlign: "right" }}>Total</td>
              <td style={{ border: "1px solid #888", textAlign: "center" }}>Acciones</td>
            </tr>
          </thead>

          <tbody>
            {registrosNegocio.map((r, i) => (
              <tr
                key={r.id || `${r.fecha}-${i}`}
                style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8f8f8" }}
              >
                <td style={{ border: "1px solid #888", textAlign: "left" }}>{r.fecha}</td>

                {mediosTodos.map(m => {
                  const noAplica = !mediosPorNegocio[r.negocio].includes(m);
                  return (
                    <td
                      key={m}
                      style={{
                        textAlign: "right",
                        border: "1px solid #888",
                        background: noAplica ? "#ddd" : "",
                        color: noAplica ? "#999" : ""
                      }}
                    >
                      {r[m] ? formatoMoneda(r[m]) : (noAplica ? "–" : "-")}
                    </td>
                  );
                })}

                <td style={{ border: "1px solid #888", textAlign: "right" }}>
                  <strong>{formatoMoneda(r.totalDia)}</strong>
                </td>
                <td style={{ border: "1px solid #888", textAlign: "center" }}>
                  <button onClick={() => editarRegistroPorId(r.id)}>Editar</button>

                  <button onClick={() => eliminarRegistro(r.id)}>Eliminar</button>
                </td>
              </tr>
            ))}

            <tr>
              <td colSpan={mediosTodos.length + 1} style={{
                textAlign: "right",
                fontWeight: "bold",
                background: "#f9f9f9",
                borderTop: "1px solid #888"
              }}>
                TOTAL {negocioAgrupado}
              </td>
              <td style={{
                fontWeight: "bold",
                background: "#2ecc71",
                color: "white",
                textAlign: "right"
              }}>
                {formatoMoneda(
                  registrosNegocio.reduce((acc, reg) => acc + parseInt(reg.totalDia || 0), 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
})}

{mostrarDetalleGrafico && (
  <>
<h3 id="grafico-diario" style={{ marginTop: 20 }}>Evolución diaria</h3>

<div style={{ marginBottom: 10 }}>
  <label><strong>📊 Ver gráfico de:</strong></label><br />
  <select
    value={filtroGraficoNegocio}
    onChange={(e) => setFiltroGraficoNegocio(e.target.value)}
  >
    <option value="todos">Todos los negocios</option>
    {Object.keys(mediosPorNegocio).map((n) => (
      <option key={n} value={n}>{n}</option>
    ))}
  </select>
</div>

<div style={{ maxWidth: "100%", overflowX: "auto" }}>
  <Line

        data={{
          labels: detalleDiario.map(r => r.fecha),
          datasets: mediosTodos.map((medio, i) => {
  const datosFiltrados = filtroGraficoNegocio === "todos"
    ? detalleDiario
    : detalleDiario.filter(r =>
        registros.some(reg => reg.fecha === r.fecha && reg.negocio === filtroGraficoNegocio && reg[medio])
      );

  return {
    label: medio,
    data: datosFiltrados.map(r => r[medio] || 0),
    borderColor: colores[i % colores.length],
    backgroundColor: colores[i % colores.length],
    fill: false,
    tension: 0.2,
    borderWidth: 2
  };
})

        }}
        options={{
          responsive: true,
          plugins: {
            legend: { position: "top" }
          },
          scales: {
            y: {
              ticks: {
                callback: value => "$" + value.toLocaleString("es-AR")
              }
            }
          }
        }}
      />
    </div>
  </>
)}


  </div>
        <button style={{ marginTop: 30 }} onClick={() => setSeccionActiva("dashboard")}>⬅️ Volver al Dashboard</button>
      </>
    )}

    {seccionActiva === "ventas" && (
      <div>
        <h3>💰 Sección de Ventas y Costos</h3>
        <p>Próximamente...</p>
        <button onClick={() => setSeccionActiva("dashboard")}>⬅️ Volver al Dashboard</button>
      </div>
    )}

    {seccionActiva === "informes" && (
      <div>
        <h3>📈 Sección de Informes</h3>
        <p>Próximamente...</p>
        <button onClick={() => setSeccionActiva("dashboard")}>⬅️ Volver al Dashboard</button>
      </div>
    )}
  </>
)}

    
  </div>
  
);


}
