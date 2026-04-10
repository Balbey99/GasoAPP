import React, { useState, useEffect } from 'react';
import { Fuel, MapPin, Loader2, Search, Globe } from 'lucide-react';
import { calcularDistancia, formatearPrecio } from './utils/calculos';
import dataPreciosMX from './data/mexico/precios_puebla.json';
import dataCoordsMX from './data/mexico/coordenadas_puebla.json';
import flagES from './assets/es-flag.png';
import flagMX from './assets/mx-flag.png';

function App() {
  const [todasLasGasolineras, setTodasLasGasolineras] = useState([]);
  const [filtradas, setFiltradas] = useState([]);
  const [ubicacion, setUbicacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [radio, setRadio] = useState(5);
  
  const [pais, setPais] = useState('ES'); 
  const [tipoCombustible, setTipoCombustible] = useState('Precio Gasolina 95 E5');

  // 1. Efecto para obtener ubicación real o usar respaldo por país
  // 1. Efecto para obtener ubicación real o usar respaldo por país
useEffect(() => {
  if (pais === 'ES') {
    // Para España, forzamos Madrid directamente sin pedir permiso de GPS
    setUbicacion({ lat: 40.4167, lng: -3.7033 });
    console.log("Ubicación forzada a Madrid (ES)");
    setCargando(false); // Asegúrate de quitar el estado de carga
  } else {
    // Para México (o cualquier otro), intentamos obtener la ubicación real
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUbicacion({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          console.log("Ubicación real obtenida (MX):", pos.coords.latitude, pos.coords.longitude);
        },
        (error) => {
          console.warn("Error de GPS en MX, usando respaldo Puebla.");
          setUbicacion({ lat: 19.0413, lng: -98.2062 }); // Respaldo Puebla
        }
      );
    } else {
      // Si el navegador no soporta GPS
      setUbicacion({ lat: 19.0413, lng: -98.2062 });
    }
  }
}, [pais]);

  // 2. Carga de datos
  useEffect(() => {
    const obtenerdatos = async () => {
      setCargando(true);
      if (pais === 'ES') {
        try {
          const response = await fetch('https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/');
          const data = await response.json();
          setTodasLasGasolineras(data.ListaEESSPrecio);
        } catch (error) {
          console.error('Error API España:', error);
        }
      } else {
        if (dataPreciosMX && dataPreciosMX.Value) {
          const listaMX = dataPreciosMX.Value.map(gas => {
            const geo = dataCoordsMX.find(c => 
              c.Direccion && gas.Direccion && 
              c.Direccion.trim() === gas.Direccion.trim()
            );
            return {
              ...gas,
              isMX: true,
              latEstacion: geo?.Latitud ? Number(geo.Latitud) : 19.0413,
              lngEstacion: geo?.Longitud ? Number(geo.Longitud) : -98.2062
            };
          });
          setTodasLasGasolineras(listaMX);
        }
      }
      setCargando(false);
    };
    obtenerdatos();
  }, [pais]);

  // 3. Procesamiento y filtrado
  useEffect(() => {
    if (ubicacion && todasLasGasolineras.length > 0) {
      const resultado = todasLasGasolineras
        .filter(gas => {
          if (gas.isMX) {
            if (tipoCombustible.includes('95')) return gas.SubProducto.includes('Regular');
            if (tipoCombustible.includes('98')) return gas.SubProducto.includes('Premium');
            if (tipoCombustible.includes('Gasoleo A')) return gas.SubProducto.includes('Diésel');
            return true;
          }
          return true; 
        })
        .map(gas => {
          let latFinal, lngFinal, precioFinal;

          if (gas.isMX) {
            latFinal = gas.latEstacion;
            lngFinal = gas.lngEstacion;
            precioFinal = gas.PrecioVigente;
          } else {
            latFinal = parseFloat(gas.Latitud.replace(',', '.'));
            lngFinal = parseFloat(gas['Longitud (WGS84)'].replace(',', '.'));
            precioFinal = formatearPrecio(gas[tipoCombustible]);
          }

          const d = calcularDistancia(ubicacion.lat, ubicacion.lng, latFinal, lngFinal);

          return {
            nombre: gas.isMX ? gas.Nombre : gas.Rótulo,
            direccion: gas.isMX ? gas.Direccion : gas.Dirección,
            distanciaKM: d, 
            precioReal: precioFinal,
            moneda: gas.isMX ? '$' : '€',

            // Guardamos las coordenadas para el botón de mapas
            lat: latFinal,
            lng: lngFinal
          };
        })
        .filter(gas => gas.precioReal > 0 && gas.distanciaKM <= radio)
        .sort((a, b) => a.precioReal - b.precioReal);

      setFiltradas(resultado);
    }
  }, [ubicacion, todasLasGasolineras, radio, tipoCombustible, pais]);

  return (
    <div className='min-h-screen bg-slate-50 p-4 md:p-8'>
      <header className='max-w-4xl mx-auto mb-8 text-center'>
        <h1 className='text-3xl font-extrabold text-slate-900 flex justify-center items-center gap-3'>
          <Fuel className='text-blue-600' /> GasoApp Pro
        </h1>
        
        <div className="flex justify-center gap-4 mt-6">
          <button 
            onClick={() => { setPais('ES'); setTipoCombustible('Precio Gasolina 95 E5'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition ${pais === 'ES' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}
          >
            <img src={flagES} alt="ES" className="w-5 h-5 rounded-full" /> España
          </button>
          <button 
            onClick={() => { setPais('MX'); setTipoCombustible('Precio Gasolina 95 E5'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition ${pais === 'MX' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600'}`}
          >
            <img src={flagMX} alt="MX" className="w-5 h-5 rounded-full" /> México
          </button>
        </div>
      </header>

      <main className='max-w-4xl mx-auto'>
        <section className='bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6'>
          <div className='flex flex-col md:flex-row gap-6 items-center'>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Tipo de combustible:</label>
              <select 
                value={tipoCombustible}
                onChange={(e) => setTipoCombustible(e.target.value)}
                className='w-full md:w-auto border border-slate-300 rounded-lg p-2'>
                <option value="Precio Gasolina 95 E5">{pais === 'MX' ? 'Magna (Regular)' : 'Gasolina 95 E5'}</option>
                <option value="Precio Gasolina 98 E5">{pais === 'MX' ? 'Premium' : 'Gasolina 98 E5'}</option>
                <option value="Precio Gasoleo A">{pais === 'MX' ? 'Diésel' : 'Gasóleo A (Diesel)'}</option>
              </select>
            </div>
            <div className='w-full'>
              <label className='block text-sm font-medium text-slate-700 mb-1'>
                Radio de búsqueda: <span className='text-blue-600 font-bold'>{radio} km</span>
              </label>
              <input type='range' min="1" max="50" value={radio} onChange={(e) => setRadio(e.target.value)} className='w-full accent-blue-600' />
            </div>
          </div>
        </section>

        <section className='grid gap-4'>
  {cargando ? (
    <div className='flex justify-center p-20'>
      <Loader2 className='animate-spin text-blue-600' size={48} />
    </div>
  ) : (
    filtradas.map((gas, index) => (
      <div key={index} className='bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition'>
        <div className='flex justify-between items-start'>
          <div className="flex-1">
            <h3 className='text-lg font-bold text-slate-900 leading-tight'>{gas.nombre}</h3>
            <p className='text-sm text-slate-500 flex items-center gap-1 mt-1'>
              <MapPin size={14} /> {gas.direccion}
            </p>
            <p className="text-2xl font-black text-blue-700 mt-3">
              {gas.precioReal.toFixed(2)} <span className="text-sm font-normal">{gas.moneda}/L</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className='bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold'>
              {gas.distanciaKM.toFixed(2)} km
            </span>
            
  {/* BOTÓN DE RUTA: DESDE MI UBICACIÓN HASTA LA DIRECCIÓN */}
<button 
  onClick={() => {
    // 1. Definimos el destino combinando nombre y dirección
    const destino = encodeURIComponent(`${gas.nombre} ${gas.direccion}, ${pais === 'MX' ? 'Mexico' : 'España'}`);
    
    // 2. Usamos la acción 'dir' (directions) 
    // origin=My+Location le dice a Google que use el GPS actual del usuario
    const urlRuta = `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`;
    
    window.open(urlRuta, '_blank');
  }}
  className="mt-2 flex items-center gap-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
>
  <MapPin size={16} />
  Cómo llegar
</button>
          </div>
        </div> 
      </div>
    ))
  )}
</section>
      </main>
    </div>
  );
}

export default App;