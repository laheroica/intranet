import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore";

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
    if (isLoggedIn) cargarRegistros();
  }, [isLoggedIn]);

  const cargarRegistros = async () => {
    const snapshot = await getDocs(collection(db, "registros"));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            totales[k] += parseInt(v || 0);
          }
        });
      }
    });

    const lista = Object.entries(totales).map(([medio, total]) => ({
      medio,
      total,
    }));
    setAcumuladosPorMedioMes(lista);
  };

  const calcularAcumulados = () => {
    const desde = filtroFechaDesde ? new Date(filtroFechaDesde) : null;
    const hasta = filtroFechaHasta ? new Date(filtroFechaHasta) : null;

    const lista = registros.filter((r) => {
      const [dia, mes, anio] = r.fecha.split("/").map(Number);
      const fecha = new Date(`${anio}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`);
      const dentroRango = (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
      const negocioOK = filtroNegociosMulti.length === 0 || filtroNegociosMulti.includes(r.negocio);
      const mediosOK = filtroMediosMulti.length === 0 || filtroMediosMulti.some(m => r[m]);
      return dentroRango && negocioOK && mediosOK;
    });

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

  const formatoMoneda = (valor) => {
    if (!valor) return "$0";
    return "$" + parseInt(valor).toLocaleString("es-AR");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Intranet Negocios</h1>
      <p>¡Este archivo está funcionando y listo para tus funciones!</p>
    </div>
  );
}