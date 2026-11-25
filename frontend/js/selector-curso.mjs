export class SeleccionCurso {
  opciones = [];
  id = null;
  abierto = true;

  compatible(id) {
    return this.opciones.find(opcion => opcion.id === id && opcion.compatible);
  }

  get actual() { return this.compatible(this.id); }

  get visibles() {
    return this.abierto || !this.actual ? this.opciones : [this.actual];
  }

  suspender() {
    // Durante una consulta el ID se conserva, pero deja de ser una elección válida.
    this.opciones = [];
  }

  cargar(opciones, idAnterior = this.id) {
    this.opciones = opciones;
    this.id = this.compatible(idAnterior)?.id ?? null;
    this.abierto = this.id === null;
    return idAnterior != null && this.id === null;
  }

  elegir(id) {
    if (!this.compatible(id)) return;
    this.id = id;
    this.abierto = false;
  }
}

function elemento(etiqueta, texto, clase) {
  const nodo = document.createElement(etiqueta);
  nodo.textContent = texto;
  if (clase) nodo.className = clase;
  return nodo;
}

function fichaProfesor(tarjeta, profesor, mejor) {
  tarjeta.append(
    elemento('h3', profesor.nombre),
    elemento('p', `${profesor.numeroEmpleado} · Calificación ${profesor.calificacionMateria.toFixed(1)}/10 · Carga actual ${profesor.cargaActual}/${profesor.maxHorasSemanales} h`, 'curso-datos')
  );
  if (profesor.compatible && profesor.calificacionMateria === mejor?.calificacionMateria) {
    tarjeta.append(elemento('p', 'Mejor calificación disponible', 'curso-estado'));
  }
  for (const motivo of [...profesor.bloqueos, ...profesor.advertencias]) {
    tarjeta.append(elemento('p', motivo, 'curso-aviso'));
  }
  if (profesor.razones.length) {
    const detalle = document.createElement('details');
    detalle.append(elemento('summary', 'Ver motivos de la recomendación'));
    const razones = document.createElement('ul');
    for (const razon of profesor.razones) razones.append(elemento('li', razon));
    detalle.append(razones);
    tarjeta.append(detalle);
  }
}

function fichaAula(tarjeta, aula) {
  const caracteristicas = aula.caracteristicas.map(valor => valor.replaceAll('_', ' ').toLocaleLowerCase('es')).join(', ')
    || 'Sin características registradas';
  tarjeta.append(elemento('h3', `${aula.clave} · ${aula.nombre}`),
    elemento('p', `${aula.capacidad} lugares · ${caracteristicas}`, 'curso-datos'));
}

export function crearSelectorCurso(lista, tipo, alElegir) {
  const estado = new SeleccionCurso();
  const esProfesor = tipo === 'profesor';
  const crearFicha = esProfesor ? fichaProfesor : fichaAula;
  let aviso = '';

  function dibujar(enfocar = false) {
    lista.replaceChildren();
    if (aviso) lista.append(elemento('p', aviso, 'curso-aviso'));
    if (!estado.opciones.length) {
      lista.append(elemento('p', esProfesor ? 'No hay profesores calificados para esta materia.'
        : 'No hay aulas compatibles y disponibles para este curso.'));
      return;
    }
    const mejor = estado.opciones.find(opcion => opcion.compatible);
    for (const opcion of estado.visibles) {
      const tarjeta = document.createElement('article');
      const actual = opcion.id === estado.id;
      if (actual) {
        tarjeta.className = 'curso-actual';
        tarjeta.append(elemento('p', 'Selección actual', 'curso-estado'));
      }
      crearFicha(tarjeta, opcion, mejor);
      if (opcion.compatible) {
        const accion = !estado.abierto ? `Cambiar ${tipo}` : actual ? 'Conservar selección' : `Seleccionar ${tipo}`;
        const boton = elemento('button', accion);
        boton.type = 'button';
        boton.setAttribute('aria-label', `${accion} · ${esProfesor ? opcion.nombre : opcion.clave}`);
        boton.setAttribute('aria-controls', lista.id);
        if (actual) boton.setAttribute('aria-expanded', String(estado.abierto));
        boton.addEventListener('click', () => {
          if (estado.abierto) {
            estado.elegir(opcion.id);
            aviso = '';
            alElegir();
          } else {
            estado.abierto = true;
          }
          dibujar(true);
        });
        tarjeta.append(boton);
      }
      lista.append(tarjeta);
    }
    if (enfocar) lista.querySelector('.curso-actual button')?.focus();
  }

  lista.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && estado.abierto && estado.actual) {
      evento.preventDefault();
      estado.abierto = false;
      dibujar(true);
    }
  });

  return {
    get actual() { return estado.actual; },
    suspender() {
      estado.suspender();
      lista.replaceChildren();
    },
    cargar(opciones, idAnterior) {
      const descartada = estado.cargar(opciones, idAnterior);
      aviso = descartada ? (esProfesor ? 'El profesor anterior ya no es compatible.'
        : 'El aula anterior ya no está disponible para esta selección.') : '';
      dibujar();
    }
  };
}
