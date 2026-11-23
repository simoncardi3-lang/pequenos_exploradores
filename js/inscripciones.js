// ============================================================================
// MÓDULO DE INSCRIPCIÓN FAMILIAR CON FORMULARIOS DINÁMICOS Y HABEAS DATA
// ============================================================================

import { supabase } from './supabase.js';
import { escapeHTML, formatCOP, formatDateES } from './utils.js';

let participantesDraft = [];

export function initInscripcionModule(state, onRegistrationSuccess) {
  const selectSalida = document.getElementById('select-salida-inscripcion');
  const form = document.getElementById('form-inscripcion');
  const btnAddPart = document.getElementById('btn-add-participante');

  if (selectSalida) {
    selectSalida.addEventListener('change', () => {
      state.selectedSalidaId = selectSalida.value;
      syncInscripcionView(state);
    });
  }

  if (btnAddPart) {
    btnAddPart.addEventListener('click', () => {
      const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
      const camposSalida = salida?.campos_personalizados || [];
      const extraObj = {};
      camposSalida.forEach(c => { extraObj[c.label] = ''; });

      participantesDraft.push({ nombre: '', edad: '', extra: extraObj });
      renderParticipantesRows(salida);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleInscripcionSubmit(state, onRegistrationSuccess);
    });
  }
}

export function resetInscripcionFlow(state, preselectedSalidaId = null) {
  if (preselectedSalidaId) {
    state.selectedSalidaId = preselectedSalidaId;
  }
  
  const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
  const camposSalida = salida?.campos_personalizados || [];
  const extraObj = {};
  camposSalida.forEach(c => { extraObj[c.label] = ''; });

  participantesDraft = [{ nombre: '', edad: '', extra: extraObj }];

  const form = document.getElementById('form-inscripcion');
  if (form) form.reset();
  
  const errBox = document.getElementById('inscripcion-error');
  if (errBox) errBox.classList.add('hidden');
  
  const formWrap = document.getElementById('inscripcion-form-wrapper');
  if (formWrap) formWrap.classList.remove('hidden');
  
  const pagoWrap = document.getElementById('inscripcion-pago-wrapper');
  if (pagoWrap) pagoWrap.classList.add('hidden');

  syncInscripcionView(state);
}

export function syncInscripcionView(state) {
  const selectSalida = document.getElementById('select-salida-inscripcion');
  if (!selectSalida) return;

  const abiertas = state.salidas.filter((s) => {
    const c = state.cuposMap.get(s.id) || { reservados: 0 };
    return s.estado === 'abierta' && s.cupo_maximo - c.reservados > 0;
  });

  const btnSubmit = document.getElementById('btn-submit-inscripcion');

  if (abiertas.length === 0) {
    selectSalida.innerHTML = `<option value="">No hay salidas abiertas en este momento</option>`;
    const resumenBox = document.getElementById('inscripcion-salida-resumen');
    if (resumenBox) resumenBox.classList.add('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    return;
  }

  if (btnSubmit) btnSubmit.disabled = false;

  selectSalida.innerHTML = abiertas
    .map(
      (s) =>
        `<option value="${escapeHTML(s.id)}" ${s.id === state.selectedSalidaId ? 'selected' : ''}>
          ${escapeHTML(s.nombre)} — ${escapeHTML(formatDateES(s.fecha))}
        </option>`
    )
    .join('');

  if (!state.selectedSalidaId || !abiertas.some((s) => s.id === state.selectedSalidaId)) {
    state.selectedSalidaId = abiertas[0].id;
    selectSalida.value = state.selectedSalidaId;
  }

  const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
  if (!salida) return;

  const cupoInfo = state.cuposMap.get(salida.id) || { reservados: 0 };
  const disponibles = Math.max(salida.cupo_maximo - cupoInfo.reservados, 0);

  const resumenBox = document.getElementById('inscripcion-salida-resumen');
  if (resumenBox) {
    resumenBox.classList.remove('hidden');
    resumenBox.innerHTML = `
      <strong>${escapeHTML(salida.nombre)}</strong><br/>
      Fecha: ${escapeHTML(formatDateES(salida.fecha))} · Hora: ${escapeHTML(salida.hora)}<br/>
      Punto de encuentro: ${escapeHTML(salida.punto_encuentro)} · Cupos disponibles: <strong>${disponibles}</strong>
    `;
  }

  const bloqueAcudiente = document.getElementById('bloque-acudiente');
  const inpAcudiente = document.getElementById('inp-acudiente-nombre');
  const inpWhatsapp = document.getElementById('inp-whatsapp');
  const correoWrap = document.getElementById('campo-correo-wrap');
  const inpCorreo = document.getElementById('inp-correo');

  if (salida.requiere_acudiente === false) {
    if (bloqueAcudiente) bloqueAcudiente.classList.add('hidden');
    if (inpAcudiente) { inpAcudiente.required = false; inpAcudiente.value = ''; }
    if (inpWhatsapp) { inpWhatsapp.required = false; inpWhatsapp.value = ''; }
    if (correoWrap) correoWrap.classList.add('hidden');
    if (inpCorreo) { inpCorreo.required = false; inpCorreo.value = ''; }
  } else {
    if (bloqueAcudiente) bloqueAcudiente.classList.remove('hidden');
    if (inpAcudiente) inpAcudiente.required = true;
    
    // El WhatsApp ya no es obligatorio
    if (inpWhatsapp) inpWhatsapp.required = false;

    if (salida.solicitar_correo) {
      if (correoWrap) correoWrap.classList.remove('hidden');
      if (inpCorreo) inpCorreo.required = true;
    } else {
      if (correoWrap) correoWrap.classList.add('hidden');
      if (inpCorreo) { inpCorreo.required = false; inpCorreo.value = ''; }
    }
  }

  ensureHabeasDataBox();

  const camposSalida = salida.campos_personalizados || [];
  participantesDraft.forEach(p => {
    if (!p.extra) p.extra = {};
    camposSalida.forEach(c => {
      if (p.extra[c.label] === undefined) p.extra[c.label] = '';
    });
  });

  renderParticipantesRows(salida);

  const esSinCosto = salida.es_gratuita || Number(salida.precio_familia) === 0;
  const valorDisplay = document.getElementById('total-valor-display');
  const totalNota = document.getElementById('total-nota');

  if (valorDisplay) {
    valorDisplay.textContent = esSinCosto ? '$0 COP (Sin costo)' : `${formatCOP(salida.precio_familia)} COP`;
  }
  if (totalNota) {
    totalNota.textContent = esSinCosto
      ? 'Actividad sin costo económico · Inscripción inmediata'
      : 'Tarifa única familiar (independiente de la cantidad de niños o jóvenes inscritos)';
  }
}

function ensureHabeasDataBox() {
  const form = document.getElementById('form-inscripcion');
  if (!form) return;
  if (document.getElementById('habeas-data-container')) return;

  const btnSubmit = document.getElementById('btn-submit-inscripcion');
  const div = document.createElement('div');
  div.id = 'habeas-data-container';
  div.className = 'consent-box';
  div.innerHTML = `
    <label class="checkbox-label" style="display: flex; align-items: flex-start; gap: 10px; background: #f9fafb; padding: 14px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 10px; cursor: pointer;">
      <input type="checkbox" id="chk-habeas-data" required style="margin-top: 4px; width: 18px; height: 18px; cursor: pointer;" />
      <span style="font-size: 0.85rem; color: #4b5563; line-height: 1.4;">Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales y los de los menores a mi cargo para los fines logísticos, de seguridad y de comunicación de las salidas de la comunidad homeschool, en cumplimiento de la Ley 1581 de 2012 (Habeas Data). *</span>
    </label>
  `;

  if (btnSubmit) {
    form.insertBefore(div, btnSubmit);
  } else {
    form.appendChild(div);
  }
}

function renderParticipantesRows(salida) {
  const container = document.getElementById('lista-participantes-form');
  if (!container) return;

  const camposVisibles = (salida?.campos_personalizados || []).filter((c) => c.visible !== false);
  const incluirEdad = salida.incluir_edad !== false;

  container.innerHTML = participantesDraft
    .map((p, idx) => {
      const edadHtml = incluirEdad ? `
        <div>
          <label class="form-label">Edad (años) *</label>
          <input type="number" class="form-control part-edad" data-idx="${idx}" value="${escapeHTML(p.edad)}" min="0" max="18" placeholder="Ej. 8" required />
        </div>
      ` : '';

      const extraHtml = camposVisibles
        .map((campo) => {
          const val = escapeHTML(p.extra?.[campo.label] || '');
          return `
            <div class="form-group" style="margin-top:8px;">
              <label class="form-label">${escapeHTML(campo.label)} ${campo.required ? '*' : '(opcional)'}</label>
              <input
                type="text"
                class="form-control part-extra-inp"
                data-idx="${idx}"
                data-label="${escapeHTML(campo.label)}"
                value="${val}"
                ${campo.required ? 'required' : ''}
                placeholder="Ingresa ${escapeHTML(campo.label.toLowerCase())}"
              />
            </div>
          `;
        })
        .join('');

      return `
        <div class="dynamic-row-card" style="display:block;">
          <div class="form-grid-2" style="margin-bottom:8px;">
            <div>
              <label class="form-label">Nombre completo del participante #${idx + 1} *</label>
              <input type="text" class="form-control part-nombre" data-idx="${idx}" value="${escapeHTML(p.nombre)}" placeholder="Nombre y apellido" required />
            </div>
            ${edadHtml}
          </div>
          ${extraHtml}
          <div style="margin-top:10px; text-align:right;">
            ${
              participantesDraft.length > 1
                ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-del-part" data-idx="${idx}">Quitar participante</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.part-nombre').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      participantesDraft[Number(e.target.dataset.idx)].nombre = e.target.value;
    });
  });

  container.querySelectorAll('.part-edad').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      participantesDraft[Number(e.target.dataset.idx)].edad = e.target.value;
    });
  });

  container.querySelectorAll('.part-extra-inp').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const pIdx = Number(e.target.dataset.idx);
      const label = e.target.dataset.label;
      participantesDraft[pIdx].extra[label] = e.target.value;
    });
  });

  container.querySelectorAll('.btn-del-part').forEach((btn) => {
    btn.addEventListener('click', () => {
      participantesDraft.splice(Number(btn.dataset.idx), 1);
      renderParticipantesRows(salida);
    });
  });
}

async function handleInscripcionSubmit(state, onRegistrationSuccess) {
  const errorBox = document.getElementById('inscripcion-error');
  const btnSubmit = document.getElementById('btn-submit-inscripcion');
  if (errorBox) errorBox.classList.add('hidden');

  const chkHabeas = document.getElementById('chk-habeas-data');
  if (chkHabeas && !chkHabeas.checked) {
    showFormError('Debes autorizar el tratamiento de datos personales (Habeas Data) para continuar.');
    return;
  }

  const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
  if (!salida) {
    showFormError('Selecciona una salida válida.');
    return;
  }

  const requiereAcudiente = salida.requiere_acudiente !== false;
  const acudienteNombre = requiereAcudiente ? document.getElementById('inp-acudiente-nombre')?.value.trim() : '';
  const whatsappInput = requiereAcudiente ? document.getElementById('inp-whatsapp')?.value.trim() : '';
  const whatsappFinal = whatsappInput ? whatsappInput : 'No proporcionado';
  const correo = requiereAcudiente && salida.solicitar_correo ? document.getElementById('inp-correo')?.value.trim() : '';

  if (requiereAcudiente && !acudienteNombre) {
    showFormError('Por favor ingresa el nombre completo del adulto responsable.');
    return;
  }

  if (requiereAcudiente && salida.solicitar_correo && !correo) {
    showFormError('Por favor ingresa el correo electrónico obligatorio.');
    return;
  }

  const incluirEdad = salida.incluir_edad !== false;
  const participantesValidos = participantesDraft.map((p) => ({
    nombre: p.nombre.trim(),
    edad: incluirEdad ? Number(p.edad) : 0,
    extra: p.extra || {}
  }));

  if (
    participantesValidos.length === 0 ||
    participantesValidos.some((p) => !p.nombre || (incluirEdad && (Number.isNaN(p.edad) || p.edad < 0)))
  ) {
    showFormError('Completa el nombre y la edad de todos los participantes.');
    return;
  }

  const camposSalida = salida.campos_personalizados || [];
  for (let i = 0; i < participantesValidos.length; i++) {
    const p = participantesValidos[i];
    for (const c of camposSalida) {
      if (c.visible !== false && c.required && !p.extra[c.label]?.trim()) {
        showFormError(`El campo "${c.label}" es obligatorio para el participante #${i + 1} (${p.nombre || 'Sin nombre'}).`);
        return;
      }
    }
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'REGISTRANDO INSCRIPCIÓN...';
  }

  try {
    const esSinCosto = salida.es_gratuita || Number(salida.precio_familia) === 0;

    const { data, error } = await supabase.rpc('registrar_inscripcion_familiar', {
      p_salida_id: salida.id,
      p_acudiente_nombre: acudienteNombre || 'Sin acudiente',
      p_whatsapp: whatsappFinal,
      p_correo: correo || '',
      p_participantes: participantesValidos,
      p_acompanantes: [],
      p_campos_extra: {},
      p_autorizacion_datos: true
    });

    if (error) throw error;

    if (esSinCosto && data?.codigo) {
      await supabase
        .from('inscripciones')
        .update({
          estado: 'confirmada',
          valor_verificado: 0,
          fecha_verificacion: new Date().toISOString()
        })
        .eq('codigo', data.codigo);
      
      data.estado = 'confirmada';
    }

    renderPaymentStep(state, salida, data);
    await onRegistrationSuccess();
  } catch (err) {
    showFormError(err.message || 'Ocurrió un error al registrar la inscripción.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'CONTINUAR CON LA INSCRIPCIÓN';
    }
  }
}

function renderPaymentStep(state, salida, registro) {
  const formWrap = document.getElementById('inscripcion-form-wrapper');
  const pagoWrap = document.getElementById('inscripcion-pago-wrapper');
  if (formWrap) formWrap.classList.add('hidden');
  if (pagoWrap) pagoWrap.classList.remove('hidden');

  const esSinCosto = salida.es_gratuita || Number(registro.total_pagar) === 0;
  
  const titleEl = document.querySelector('#inscripcion-pago-wrapper .panel-title');
  const subtitleEl = document.getElementById('res-subtitulo');
  const nequiBox = document.getElementById('nequi-payment-box');
  const brebBox = document.getElementById('breb-payment-box');
  const selectorPagos = document.getElementById('selector-medios-pago');
  const btnNequi = document.getElementById('elegir-nequi');
  const btnBreb = document.getElementById('elegir-breb');
  const btnCopiarBreb = document.getElementById('btn-copiar-breb');
  const llaveBreb = String(state.config?.llave_breb || '').trim();
  const llaveVisible = document.getElementById('breb-llave-visible');
  if (llaveVisible) llaveVisible.textContent = llaveBreb;
  if (btnBreb) btnBreb.classList.toggle('hidden', !llaveBreb);
  const waActionBox = document.querySelector('.wa-action-box');
  const codigoRow = document.getElementById('res-codigo')?.closest('.receipt-row, div');

  if (esSinCosto) {
    if (titleEl) titleEl.textContent = '¡Felicitaciones, estás inscrito!';
    if (subtitleEl) subtitleEl.textContent = `Tu cupo para "${salida.nombre}" ha quedado registrado exitosamente. Te esperamos.`;
    
    if (nequiBox) nequiBox.classList.add('hidden');
    if (brebBox) brebBox.classList.add('hidden');
    if (selectorPagos) selectorPagos.classList.add('hidden');
    if (waActionBox) waActionBox.classList.add('hidden');
    if (codigoRow) codigoRow.style.display = 'none';

    const receiptCard = document.getElementById('inscripcion-pago-wrapper');
    if (receiptCard) {
      receiptCard.style.animation = 'fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    }
  } else {
    if (titleEl) titleEl.textContent = '¡Preinscripción Registrada!';
    if (subtitleEl) subtitleEl.textContent = 'Guarda tu código único. Tu cupo quedará confirmado cuando el administrador verifique el pago.';
    if (nequiBox) nequiBox.classList.remove('hidden');
    if (brebBox) brebBox.classList.add('hidden');
    if (selectorPagos) selectorPagos.classList.toggle('hidden', !llaveBreb);
    if (waActionBox) waActionBox.classList.remove('hidden');
    if (codigoRow) codigoRow.style.display = '';

    const qrImg = document.getElementById('nequi-qr-img');
    const qrPlaceholder = document.getElementById('nequi-qr-placeholder');
    if (state.config?.qr_nequi_url) {
      if (qrImg) { qrImg.src = state.config.qr_nequi_url; qrImg.classList.remove('hidden'); }
      if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
    } else {
      if (qrImg) qrImg.classList.add('hidden');
      if (qrPlaceholder) qrPlaceholder.classList.remove('hidden');
    }

    const adminPhone = (state.config?.whatsapp_admin || '').replace(/\D/g, '');
    const incluirEdad = salida.incluir_edad !== false;
    const nombresParticipantes = (registro.participantes || [])
      .map((p) => (incluirEdad ? `${p.nombre} (${p.edad} años)` : p.nombre))
      .join('; ');

    let medioPago = 'Nequi';
    const mensajeLines = [
      `Hola *${state.config?.nombre_comunidad || 'Pequeños Exploradores'}*, envío confirmación de inscripción:`,
      `• *Código:* ${registro.codigo}`,
      `• *Actividad:* ${salida.nombre}`,
      `• *Participantes (${registro.participantes.length}):* ${nombresParticipantes}`,
      `• *Valor total:* ${formatCOP(registro.total_pagar)} COP`,
      `Medio de pago seleccionado: Nequi. Adjunto el comprobante para su verificación.`
    ].join('\n');

    const btnWa = document.getElementById('btn-whatsapp-confirmar');
    const actualizarWhatsapp = () => {
      const texto = mensajeLines
        .map(linea => linea.startsWith('Medio de pago seleccionado:')
          ? `Medio de pago seleccionado: ${medioPago}. Adjunto el comprobante para su verificación.`
          : linea)
        .join('\\n');
      const waUrl = adminPhone
        ? `https://wa.me/${adminPhone}?text=${encodeURIComponent(texto)}`
        : `https://wa.me/?text=${encodeURIComponent(texto)}`;
      if (btnWa) btnWa.href = waUrl;
    };

    const seleccionarMedio = (medio) => {
      if (medio === 'Bre-B' && !llaveBreb) return;
      medioPago = medio;
      nequiBox?.classList.toggle('hidden', medio !== 'Nequi');
      brebBox?.classList.toggle('hidden', medio !== 'Bre-B');
      btnNequi?.classList.toggle('btn-primary', medio === 'Nequi');
      btnNequi?.classList.toggle('btn-outline', medio !== 'Nequi');
      btnBreb?.classList.toggle('btn-primary', medio === 'Bre-B');
      btnBreb?.classList.toggle('btn-outline', medio !== 'Bre-B');
      btnNequi?.setAttribute('aria-pressed', String(medio === 'Nequi'));
      btnBreb?.setAttribute('aria-pressed', String(medio === 'Bre-B'));
      actualizarWhatsapp();
    };

    if (btnNequi) btnNequi.onclick = () => seleccionarMedio('Nequi');
    if (btnBreb) btnBreb.onclick = () => seleccionarMedio('Bre-B');
    if (btnCopiarBreb) {
      btnCopiarBreb.onclick = async () => {
        try {
          await navigator.clipboard.writeText(llaveBreb);
          btnCopiarBreb.textContent = '¡Llave copiada!';
        } catch {
          window.prompt('Copia la llave Bre-B:', llaveBreb);
        }
      };
    }
    if (btnWa) {
      btnWa.textContent = 'ENVIAR COMPROBANTE POR WHATSAPP';
      btnWa.onclick = async () => {
        if (supabase) {
          await supabase.rpc('reportar_pago_familia', { p_codigo: registro.codigo });
        }
      };
    }
    seleccionarMedio('Nequi');
  }

  const incluirEdad = salida.incluir_edad !== false;
  const nombresParticipantes = (registro.participantes || [])
    .map((p) => {
      const extrasStr = Object.entries(p.extra || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      return incluirEdad ? `${p.nombre} (${p.edad} años${extrasStr ? ' - ' + extrasStr : ''})` : `${p.nombre}${extrasStr ? ' - ' + extrasStr : ''}`;
    })
    .join('; ');

  const resCodigo = document.getElementById('res-codigo');
  const resActividad = document.getElementById('res-actividad');
  if (resCodigo) resCodigo.textContent = registro.codigo;
  if (resActividad) resActividad.textContent = salida.nombre;

  const acudienteRowReceipt = document.getElementById('res-acudiente-row-receipt');
  if (salida.requiere_acudiente === false) {
    if (acudienteRowReceipt) acudienteRowReceipt.classList.add('hidden');
  } else {
    if (acudienteRowReceipt) acudienteRowReceipt.classList.remove('hidden');
    const resAcudiente = document.getElementById('res-acudiente');
    if (resAcudiente) {
      resAcudiente.textContent =
        registro.acudiente_nombre !== 'Sin acudiente' ? registro.acudiente_nombre : `Registrado con éxito`;
    }
  }

  const resParticipantes = document.getElementById('res-participantes');
  if (resParticipantes) resParticipantes.textContent = nombresParticipantes;

  const resTotal = document.getElementById('res-total');
  if (resTotal) {
    resTotal.textContent = esSinCosto ? '$0 COP (Sin costo)' : `${formatCOP(registro.total_pagar)} COP`;
  }
}

function showFormError(msg) {
  const errorBox = document.getElementById('inscripcion-error');
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}