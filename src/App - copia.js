import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
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
  const [ultimosDiasPorNegocio, setUltimosDiasPorNegocio] = useState({});
const [modoEdicion, setModoEdicion] = useState(false);
const [idEnEdicion, setIdEnEdicion] = useState(null);


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
  setRegistros(data);
  calcularTotalesMesActual(data);
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

  const formatoMoneda = (valor) => {
    if (!valor) return "$0";
    return "$" + parseInt(valor).toLocaleString("es-AR");
  };
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
const calcularDetalleDiario = () => {
  const agrupado = {};

  registros.forEach((r) => {
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

  lista.sort((a, b) => {
    const [da, ma, aa] = a.fecha.split("/").map(Number);
    const [db, mb, ab] = b.fecha.split("/").map(Number);
    return new Date(`${ab}-${mb}-${db}`) - new Date(`${aa}-${ma}-${da}`);
  });

  setDetalleDiario(lista);
};
const eliminarRegistro = async (fecha) => {
  const snapshot = await getDocs(collection(db, "registros"));
  const docs = snapshot.docs.filter(doc => doc.data().fecha === fecha);

  if (docs.length === 0) {
    alert("No se encontró el registro para eliminar.");
    return;
  }

  const confirm = window.confirm(`¿Eliminar el registro del ${fecha}?`);
  if (!confirm) return;

  for (let docu of docs) {
    await deleteDoc(doc(db, "registros", docu.id));
  }

  alert("Registro eliminado.");
  cargarRegistros();
};

const editarRegistro = (fecha) => {
  const registro = registros.find(r => r.fecha === fecha);
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


return (
  <div style={{ padding: 40 }}>
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
        <h2>Intranet Negocios</h2>
        <p>¡Bienvenido, Álvaro!</p>

        <div style={{ marginTop: 30 }}>
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
      <strong>🟨 Editando:</strong> {fechaSeleccionada && new Date(fechaSeleccionada).toLocaleDateString("es-AR")} - {negocio}
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


          <div style={{ fontSize: "0.9rem", color: "gray" }}>
            <strong>Últimos días cargados:</strong>
            <ul>
              {Object.entries(ultimosDiasPorNegocio).map(([neg, fecha]) => (
                <li key={neg}>{neg}: {fecha}</li>
              ))}
            </ul>
          </div>

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
  <button onClick={async () => {
    const totalDia = Object.entries(formData).reduce(
      (sum, [, val]) => sum + parseInt(val || 0),
      0
    );
    const fecha = fechaSeleccionada ? new Date(fechaSeleccionada) : new Date();
    const fechaFormateada = fecha.toLocaleDateString("es-AR");

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
  }}>Guardar</button>
) : (
  <>
    <button onClick={async () => {
      const totalDia = Object.entries(formData).reduce(
        (sum, [, val]) => sum + parseInt(val || 0),
        0
      );
      const fecha = new Date(fechaSeleccionada);
      const fechaFormateada = fecha.toLocaleDateString("es-AR");

      const actualizado = {
        fecha: fechaFormateada,
        negocio,
        totalDia,
        ...formData
      };

      await deleteDoc(doc(db, "registros", idEnEdicion));
      await addDoc(collection(db, "registros"), actualizado);

      setFormData({});
      setNegocio("");
      setFechaSeleccionada("");
      setModoEdicion(false);
      setIdEnEdicion(null);
      cargarRegistros();
    }}>Actualizar</button>

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
    calcularDetalleDiario();
  }}>
    {mostrarDetalleGrafico ? "Ocultar gráfico diario" : "Detalle gráfico"}
  </button>

  {mostrarDetalleGrafico && (
    <>
      <h3 style={{ marginTop: 20 }}>Detalle por día</h3>
      <table border="1" cellPadding="5" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Fecha</th>
            {mediosTodos.map(m => <th key={m}>{m}</th>)}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {detalleDiario.map((row, i) => (
            <tr key={i}>
              <td>{row.fecha}</td>
              {mediosTodos.map(m => (
                <td key={m}>{row[m] ? formatoMoneda(row[m]) : "-"}</td>
              ))}
              <td>
                <button onClick={() => editarRegistro(row.fecha)}>Editar</button>
                <button onClick={() => eliminarRegistro(row.fecha)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Gráfico de evolución */}
      <h3 style={{ marginTop: 30 }}>Evolución diaria</h3>
      <div style={{ maxWidth: "100%", overflowX: "auto" }}>
        <Line
          data={{
            labels: detalleDiario.map(r => r.fecha),
            datasets: mediosTodos.map((medio, i) => ({
              label: medio,
              data: detalleDiario.map(r => r[medio] || 0),
              fill: false,
              tension: 0.2,
              borderWidth: 2
            }))
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
  </div>
  
);


}
