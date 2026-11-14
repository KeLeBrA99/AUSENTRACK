/**
 * AUSENTRACK - Modo demostracion
 *
 * El backend avisa (GET /api/demo/) si esta corriendo como demostracion
 * publica con datos ficticios. En ese caso la pantalla de inicio muestra los
 * usuarios de prueba, aparece un aviso arriba y no se usa el logo de la
 * empresa real. En una instalacion normal responde { demo: false } y nada cambia.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/axios';

const SIN_DEMO = { demo: false, usuarios: [], clave: '' };
let consulta = null;   // una sola peticion para toda la aplicacion

function consultarDemo() {
    if (!consulta) {
        consulta = axios.get(`${API_BASE_URL}/demo/`)
            .then(res => ({ ...SIN_DEMO, ...res.data }))
            .catch(() => SIN_DEMO);
    }
    return consulta;
}

export function useDemo() {
    const [info, setInfo] = useState(SIN_DEMO);
    useEffect(() => {
        let vigente = true;
        consultarDemo().then(datos => { if (vigente) setInfo(datos); });
        return () => { vigente = false; };
    }, []);
    return info;
}
