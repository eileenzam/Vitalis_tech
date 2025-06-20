// ****************************************************************************************************
// Variables Globales
// ****************************************************************************************************
let pacientes = JSON.parse(localStorage.getItem('pacientes')) || [];
let nextPatientId = parseInt(localStorage.getItem('nextPatientId')) || 1;
let citas = JSON.parse(localStorage.getItem('citas')) || [];
let nextCitaNumber = parseInt(localStorage.getItem('nextCitaNumber')) || 1;
let examenes = JSON.parse(localStorage.getItem('examenes')) || [];
let nextExamenNumber = parseInt(localStorage.getItem('nextExamenNumber')) || 1;
let diagnosticosTratamientos = JSON.parse(localStorage.getItem('diagnosticosTratamientos')) || [];
let nextDtId = parseInt(localStorage.getItem('nextDtId')) || 1;

let calendar; // Variable global para la instancia de FullCalendar

// Roles de usuario
const ROLES = {
    ADMIN: 'admin',
    PATIENT: 'patient', // Un paciente logueado
    GUEST: 'guest' // Un usuario no logueado en este caso el invitado
};

let currentUserRole = ROLES.GUEST; // Rol inicial por defecto
let currentLoggedInPatientId = null; // Para guardar el ID del paciente logueado

// ****************************************************************************************************
// Custom Modal Logic (Reemplazo para alert/confirm)
// ****************************************************************************************************
const customModal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalAcceptBtn = document.getElementById('modalAcceptBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

function showAlertModal(message, title = "Información") {
    if (!customModal || !modalTitle || !modalMessage || !modalAcceptBtn || !modalCancelBtn) {
        console.error("Custom modal elements not found. Falling back to native alert.");
        alert(`${title}: ${message}`);
        return;
    }
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalCancelBtn.classList.add('hidden'); 
    customModal.style.display = 'flex'; // Mostrar el modal

    modalAcceptBtn.onclick = () => {
        customModal.style.display = 'none';
    };
}

function showConfirmModal(message, onConfirm, onCancel = () => {}, title = "¿Confirmar?") {
    if (!customModal || !modalTitle || !modalMessage || !modalAcceptBtn || !modalCancelBtn) {
        console.error("Custom modal elements not found. Falling back to native confirm.");
        if (confirm(`${title}: ${message}`)) {
            onConfirm();
        } else {
            onCancel();
        }
        return;
    }
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalCancelBtn.classList.remove('hidden'); 
    customModal.style.display = 'flex'; // Mostrar el modal
    
    // Configurar listeners para aceptar y cancelar
    modalAcceptBtn.onclick = () => {
        customModal.style.display = 'none';
        onConfirm();
    };
    modalCancelBtn.onclick = () => {
        customModal.style.display = 'none';
        onCancel();
    };
}

// ****************************************************************************************************
// Funciones de Autenticación y Control de Acceso
// ****************************************************************************************************

// Función para limpiar los formularios de inicio de sesión y registro
function clearLoginRegisterForms() {
    const loginForm = document.getElementById('loginFormElement');
    const registerForm = document.getElementById('registerFormElement');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
}

// Función para abrir el modal de inicio de sesión/registro
function openLoginModal() {
    const loginModal = document.getElementById('loginRegisterModal');
    if (loginModal) {
        loginModal.style.display = 'flex'; 
    }
    showLogin(); // Asegura que la pestaña de login sea la primera en mostrarse
    clearLoginRegisterForms(); // Limpiar formularios al abrir el modal
}

// Función para cerrar el modal de inicio de sesión/registro
function closeLoginModal() {
    const loginModal = document.getElementById('loginRegisterModal');
    if (loginModal) {
        loginModal.style.display = 'none';
    }
    clearLoginRegisterForms(); // Limpiar formularios al cerrar el modal
}

// Función para mostrar el formulario de inicio de sesión
function showLogin() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
}

// Función para mostrar el formulario de registro
function showRegister() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}

// Manejar el inicio de sesión
const loginFormElement = document.getElementById('loginFormElement');
if (loginFormElement) {
    loginFormElement.addEventListener('submit', function(event) {
        event.preventDefault();
        const phoneNumber = document.getElementById('loginPhoneNumber').value;
        const password = document.getElementById('loginPassword').value;

        // Credenciales del administrador
        const ADMIN_PHONE = '12345678';
        const ADMIN_PASSWORD = 'Admin';

        if (phoneNumber === ADMIN_PHONE && password === ADMIN_PASSWORD) {
            currentUserRole = ROLES.ADMIN;
            showAlertModal('Inicio de sesión como Administrador exitoso.', 'Éxito');
            currentLoggedInPatientId = null; // No hay un paciente específico logueado como admin
            closeLoginModal();
            updateUIForRole();
            window.location.hash = '#registro-paciente-section'; // Redirigir a inicio del admin
        } else {
            // Intentar iniciar sesión como paciente
            const patient = pacientes.find(p => p.telefono === phoneNumber && p.password === password);
            if (patient) {
                currentUserRole = ROLES.PATIENT;
                currentLoggedInPatientId = patient.id; // Guarda el ID del paciente logueado
                showAlertModal(`Inicio de sesión como Paciente ${patient.nombre} exitoso.`, 'Éxito');
                closeLoginModal();
                updateUIForRole();
                // Cargar historial del paciente logueado automáticamente
                const searchPatientIdInput = document.getElementById('searchPatientId');
                if (searchPatientIdInput) {
                    searchPatientIdInput.value = patient.id;
                }
                loadPatientHistory();
                displayPatientPendingAppointments(); // Mostrar citas pendientes del paciente
                window.location.hash = '#historial-clinico-section'; // Redirigir al historial del paciente
            } else {
                showAlertModal('Número de teléfono o contraseña incorrectos.', 'Error de Autenticación');
                currentUserRole = ROLES.GUEST; // Si falla, sigue siendo invitado
                currentLoggedInPatientId = null;
                updateUIForRole(); // Asegurarse de que la UI se restablezca a invitado si falla
            }
        }
    });
}

// Manejar el registro de nuevos pacientes (que son usuarios generales)
const registerFormElement = document.getElementById('registerFormElement');
if (registerFormElement) {
    registerFormElement.addEventListener('submit', function(event) {
        event.preventDefault();
        const fullName = document.getElementById('registerFullName').value;
        const phoneNumber = document.getElementById('registerPhoneNumber').value;
        const password = document.getElementById('registerPassword').value;
        const email = document.getElementById('registerEmail').value; 
        if (pacientes.some(p => p.telefono === phoneNumber)) {
            showAlertModal('Este número de teléfono ya está registrado como paciente. Intente iniciar sesión o use otro número.', 'Registro Fallido');
            return;
        }

        const newPatientId = nextPatientId++;
        const newPatient = {
            id: newPatientId,
            codigousuario: `PAT-${String(newPatientId).padStart(4, '0')}`,
            nombre: fullName.split(' ')[0] || '',
            apellidos: fullName.split(' ').slice(1).join(' ') || '',
            fecha_nacimiento: '',
            direccion: '',
            telefono: phoneNumber,
            password: password, // Asumiendo que esta contraseña es para el login del paciente
            genero: '',
            identificacion: '',
            extra_email: email, 
            profesion: '',
            contacto_emergencia: '',
            enfermedades_cronicas: '',
            alergias: '',
            medicacion_actual: '',
            problemas_mentales: '',
            operaciones_previas: '',
            religion: '',
            antecedentes_familiares: '',
            peso: '',
            tabaquismo: false,
            alcoholismo: false,
            actividad_fisica: false,
            dieta: false,
        };

        pacientes.push(newPatient);
        localStorage.setItem('pacientes', JSON.stringify(pacientes));
        localStorage.setItem('nextPatientId', nextPatientId);

        showAlertModal('Registro exitoso. Ahora puede iniciar sesión con su número de teléfono y contraseña.', 'Registro Exitoso');
        this.reset();
        showLogin();
    });
}

// Función para cerrar sesión
function handleLogout() {
    showConfirmModal('¿Estás seguro de que quieres cerrar sesión?', () => {
        currentUserRole = ROLES.GUEST;
        currentLoggedInPatientId = null;
        showAlertModal('Sesión cerrada.', 'Sesión Cerrada');
        updateUIForRole();
        window.location.hash = '#home'; // Redirigir a la sección de inicio
        clearLoginRegisterForms(); // Limpiar formularios al cerrar sesión
    });
}

// Función para actualizar la interfaz de usuario según el rol
function updateUIForRole() {
    // --- Referencias a elementos de la interfaz ---
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const agendarCitaBtn = document.getElementById('agendar-cita-btn'); // Botón "Agendar cita" en Hero

    // Secciones de navegación
    const navHome = document.getElementById('nav-home');
    const navRegistroPaciente = document.getElementById('nav-registro-paciente');
    const navGestionCitas = document.getElementById('nav-gestion-citas');
    const navResultadosExamenes = document.getElementById('nav-resultados-examenes');
    const navHistorialClinico = document.getElementById('nav-historial-clinico');
    const navEstadisticas = document.getElementById('nav-estadisticas');

    // Secciones principales
    const sectionHome = document.getElementById('home');
    const sectionAcercaDeNosotros = document.getElementById('acerca-de-nosotros-section');
    const sectionRegistroPaciente = document.getElementById('registro-paciente-section');
    const sectionGestionCitas = document.getElementById('gestion-citas-section');
    const sectionResultadosExamenes = document.getElementById('resultados-examenes-section');
    const sectionHistorialClinico = document.getElementById('historial-clinico-section');
    const sectionEstadisticas = document.getElementById('estadisticas-section');
    const sectionFeatures = document.querySelector('.features');
    const sectionSummaryCards = document.querySelector('.summary-cards');
    const sectionSlider = document.querySelector('.slider');
    const sectionQuePuedesHacer = document.querySelector('.que-puedes-hacer');
    const sectionTestimonios = document.querySelector('.testimonios-section');
    const patientAppointmentsSection = document.getElementById('patient-appointments-section'); // Nueva sección de citas del paciente

    // Elementos CRUD y específicos del historial//
    const patientTableContainer = document.querySelector('.patient-table-container'); // Contenedor de la tabla de pacientes con buscador
    const patientFormFields = document.querySelectorAll('#formulario-paciente .editable-field');
    const savePatientButton = document.getElementById('savePatientButton');
    const addCitaButton = document.getElementById('addCitaButton');
    const saveExamenButton = document.getElementById('saveExamenButton');
    const examenFormFields = document.querySelectorAll('#form-resultados-examenes .editable-field');
    const dtForm = document.getElementById('form-diagnostico-tratamiento'); 
    const addDtButton = document.getElementById('addDtButton'); 
    const downloadHistorySection = document.querySelector('.download-history-section'); // Sección de descarga de historial

    // --- 1. Ocultar todos los elementos y secciones por defecto ---
    // Ocultar todos los enlaces de navegación
    [navHome, navRegistroPaciente, navGestionCitas, navResultadosExamenes, navHistorialClinico, navEstadisticas]
        .forEach(el => el && el.classList.add('hidden'));

    // Ocultar todas las secciones principales
    [sectionHome, sectionAcercaDeNosotros, sectionRegistroPaciente, sectionGestionCitas, sectionResultadosExamenes, 
     sectionHistorialClinico, sectionEstadisticas, sectionFeatures, sectionSummaryCards, 
     sectionSlider, sectionQuePuedesHacer, sectionTestimonios, patientAppointmentsSection] 
        .forEach(el => el && el.classList.add('hidden'));

    // Ocultar elementos CRUD y de interacción por defecto
    if (patientTableContainer) patientTableContainer.classList.add('hidden'); 
    patientFormFields.forEach(field => field.classList.add('readonly-field')); 
    if (savePatientButton) savePatientButton.classList.add('hidden');
    if (addCitaButton) addCitaButton.classList.add('hidden');
    if (saveExamenButton) saveExamenButton.classList.add('hidden');
    examenFormFields.forEach(field => field.classList.add('readonly-field')); 
    if (dtForm) dtForm.classList.add('hidden');
    if (addDtButton) addDtButton.classList.add('hidden');

    // Seleccionar dinámicamente los botones de acción después de mostrar las tablas
    document.querySelectorAll('.btn-delete-dt').forEach(btn => btn.classList.add('hidden'));
    document.querySelectorAll('#tabla-citas .btn-delete-cita').forEach(btn => btn.classList.add('hidden'));
    document.querySelectorAll('#tabla-pacientes .btn-edit-patient, #tabla-pacientes .btn-delete-patient').forEach(btn => btn.classList.add('hidden'));
    
    if (downloadHistorySection) downloadHistorySection.classList.add('hidden'); 

    // Botones de autenticación
    if (loginButton) loginButton.classList.remove('hidden'); 
    if (logoutButton) logoutButton.classList.add('hidden'); 
    if (agendarCitaBtn) agendarCitaBtn.classList.add('hidden'); 

    // --- Lógica de visibilidad por rol ---
    if (currentUserRole === ROLES.ADMIN) {
        // ADMIN: Home (sin agendar cita), CRUD modules, Historial (con CRUD), Footer
        
        // Navegación
        if (navHome) navHome.classList.remove('hidden');
        if (navRegistroPaciente) navRegistroPaciente.classList.remove('hidden');
        if (navGestionCitas) navGestionCitas.classList.remove('hidden');
        if (navResultadosExamenes) navResultadosExamenes.classList.remove('hidden');
        if (navHistorialClinico) navHistorialClinico.classList.remove('hidden'); 

        // Secciones
        if (sectionHome) sectionHome.classList.remove('hidden');
        if (agendarCitaBtn) agendarCitaBtn.classList.add('hidden'); 

        if (sectionRegistroPaciente) sectionRegistroPaciente.classList.remove('hidden');
        if (patientTableContainer) patientTableContainer.classList.remove('hidden'); 
        patientFormFields.forEach(field => field.classList.remove('readonly-field')); 
        if (savePatientButton) savePatientButton.classList.remove('hidden');
        document.querySelectorAll('#tabla-pacientes .btn-edit-patient, #tabla-pacientes .btn-delete-patient').forEach(btn => btn.classList.remove('hidden'));

        if (sectionGestionCitas) {
            sectionGestionCitas.classList.remove('hidden');
            const calendarEl = document.getElementById('calendar');
            if (calendarEl) {
                const calendarContainer = calendarEl.closest('.calendar-and-form-container');
                if (calendarContainer) calendarContainer.style.display = 'flex'; 
                if (calendar) {
                    calendar.render(); 
                    calendar.updateSize(); 
                }
            }
        }
        if (addCitaButton) addCitaButton.classList.remove('hidden');
        document.querySelectorAll('#tabla-citas .btn-delete-cita').forEach(btn => btn.classList.remove('hidden'));

        if (sectionResultadosExamenes) sectionResultadosExamenes.classList.remove('hidden');
        if (saveExamenButton) saveExamenButton.classList.remove('hidden');
        examenFormFields.forEach(field => field.classList.remove('readonly-field'));

        if (sectionHistorialClinico) sectionHistorialClinico.classList.remove('hidden');
        if (dtForm) dtForm.classList.remove('hidden');
        if (addDtButton) addDtButton.classList.remove('hidden');
        document.querySelectorAll('.btn-delete-dt').forEach(btn => btn.classList.remove('hidden'));
        if (downloadHistorySection) downloadHistorySection.classList.remove('hidden');

        // Ocultar secciones públicas que el admin NO debe ver
        if (sectionFeatures) sectionFeatures.classList.add('hidden');
        if (sectionEstadisticas) sectionEstadisticas.classList.add('hidden');
        if (navEstadisticas) navEstadisticas.classList.add('hidden'); 
        if (sectionSummaryCards) sectionSummaryCards.classList.add('hidden');
        if (sectionSlider) sectionSlider.classList.add('hidden');
        if (sectionQuePuedesHacer) sectionQuePuedesHacer.classList.add('hidden');
        if (sectionTestimonios) sectionTestimonios.classList.add('hidden');
        if (patientAppointmentsSection) patientAppointmentsSection.classList.add('hidden'); 

        if (loginButton) loginButton.classList.add('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');

    } else if (currentUserRole === ROLES.PATIENT) {
        // PACIENTE (logueado): Home (con agendar cita), secciones públicas, Historial (vista + descarga de su propio), Citas pendientes, Footer
        
        // Navegación
        if (navHome) navHome.classList.remove('hidden');
        if (navEstadisticas) navEstadisticas.classList.remove('hidden'); 
        if (navHistorialClinico) navHistorialClinico.classList.remove('hidden'); 

        // Secciones
        if (sectionHome) sectionHome.classList.remove('hidden');
        if (agendarCitaBtn) agendarCitaBtn.classList.remove('hidden'); 

        if (sectionFeatures) sectionFeatures.classList.remove('hidden');
        if (sectionEstadisticas) sectionEstadisticas.classList.remove('hidden');
        if (sectionSummaryCards) sectionSummaryCards.classList.remove('hidden');
        if (sectionSlider) sectionSlider.classList.remove('hidden');
        if (sectionQuePuedesHacer) sectionQuePuedesHacer.classList.remove('hidden');
        if (sectionTestimonios) sectionTestimonios.classList.remove('hidden');

        if (sectionHistorialClinico) sectionHistorialClinico.classList.remove('hidden');
        if (downloadHistorySection) downloadHistorySection.classList.remove('hidden'); 
        if (patientAppointmentsSection) patientAppointmentsSection.classList.remove('hidden'); 

        // Ocultar elementos CRUD del historial para pacientes
        if (dtForm) dtForm.classList.add('hidden');
        if (addDtButton) addDtButton.classList.add('hidden');
        document.querySelectorAll('.btn-delete-dt').forEach(btn => btn.classList.add('hidden'));

        if (loginButton) loginButton.classList.add('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');

        // Ocultar módulos administrativos
        if (sectionRegistroPaciente) sectionRegistroPaciente.classList.add('hidden');
        if (navRegistroPaciente) navRegistroPaciente.classList.add('hidden');
        if (sectionGestionCitas) sectionGestionCitas.classList.add('hidden');
        if (navGestionCitas) navGestionCitas.classList.add('hidden');
        if (sectionResultadosExamenes) sectionResultadosExamenes.classList.add('hidden');
        if (navResultadosExamenes) navResultadosExamenes.classList.add('hidden');

        // Ocultar calendario para el rol de paciente
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) {
            const calendarContainer = calendarEl.closest('.calendar-and-form-container');
                 if (calendarContainer) calendarContainer.style.display = 'none';
        }

    } else { // ROLES.GUEST 
        // INVITADO: Home (con agendar cita), secciones públicas (sin historial clínico), Footer
        
        // Navegación
        if (navHome) navHome.classList.remove('hidden');
        if (navEstadisticas) navEstadisticas.classList.remove('hidden'); 
        
        // Secciones
        if (sectionHome) sectionHome.classList.remove('hidden');
        if (agendarCitaBtn) agendarCitaBtn.classList.remove('hidden'); 

        if (sectionFeatures) sectionFeatures.classList.remove('hidden');
        if (sectionEstadisticas) sectionEstadisticas.classList.remove('hidden');
        if (sectionSummaryCards) sectionSummaryCards.classList.remove('hidden');
        if (sectionSlider) sectionSlider.classList.remove('hidden');
        if (sectionQuePuedesHacer) sectionQuePuedesHacer.classList.remove('hidden');
        if (sectionTestimonios) sectionTestimonios.classList.remove('hidden');

        // Historial Clínico (oculto para invitados)
        if (navHistorialClinico) navHistorialClinico.classList.add('hidden');
        if (sectionHistorialClinico) sectionHistorialClinico.classList.add('hidden');
        if (downloadHistorySection) downloadHistorySection.classList.add('hidden');
        if (patientAppointmentsSection) patientAppointmentsSection.classList.add('hidden'); 

        if (loginButton) loginButton.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.add('hidden');

        // Ocultar módulos administrativos
        if (sectionRegistroPaciente) sectionRegistroPaciente.classList.add('hidden');
        if (navRegistroPaciente) navRegistroPaciente.classList.add('hidden');
        if (sectionGestionCitas) sectionGestionCitas.classList.add('hidden');
        if (navGestionCitas) navGestionCitas.classList.add('hidden');
        if (sectionResultadosExamenes) sectionResultadosExamenes.classList.add('hidden');
        if (navResultadosExamenes) navResultadosExamenes.classList.add('hidden');

        // Ocultar calendario para el rol de invitado
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) {
            const calendarContainer = calendarEl.closest('.calendar-and-form-container');
            if (calendarContainer) calendarContainer.style.display = 'none';
        }
    }
}

// ****************************************************************************************************
// Módulo de Registro de Pacientes (CRUD)
// ****************************************************************************************************

// Función para generar un nuevo ID de paciente y actualizar el campo
function updatePatientIdField() {
    const patientIdInput = document.getElementById('id');
    if (patientIdInput) {
        patientIdInput.value = nextPatientId;
    }
}

// Clase Patient
class Patient {
    constructor(id, codigousuario, nombre, apellidos, fecha_nacimiento, genero, telefono, password, direccion, profesion, enfermedades_cronicas, alergias, medicacion_actual, problemas_mentales, operaciones_previas, antecedentes_familiares, tabaquismo, alcoholismo, actividad_fisica, dieta, identificacion = '', contacto_emergencia = '', religion = '', extra_email = '') {
        this.id = id;
        this.codigousuario = codigousuario;
        this.nombre = nombre;
        this.apellidos = apellidos;
        this.fecha_nacimiento = fecha_nacimiento;
        this.genero = genero;
        this.telefono = telefono;
        this.password = password; 
        this.direccion = direccion;
        this.profesion = profesion;
        this.enfermedades_cronicas = enfermedades_cronicas;
        this.alergias = alergias;
        this.medicacion_actual = medicacion_actual;
        this.problemas_mentales = problemas_mentales;
        this.operaciones_previas = operaciones_previas;
        this.antecedentes_familiares = antecedentes_familiares;
        this.tabaquismo = tabaquismo;
        this.alcoholismo = alcoholismo;
        this.actividad_fisica = actividad_fisica;
        this.dieta = dieta;
        this.identificacion = identificacion; 
        this.contacto_emergencia = contacto_emergencia; 
        this.religion = religion; 
        this.extra_email = extra_email; 
    }
}

// Función para guardar/actualizar un paciente
const formularioPaciente = document.getElementById('formulario-paciente');
if(formularioPaciente) { 
    formularioPaciente.addEventListener('submit', function(event) {
        event.preventDefault();

        const patientId = parseInt(document.getElementById('id').value);
        const codigousuario = document.getElementById('codigousuario').value;
        const nombre = document.getElementById('nombre').value;
        const apellidos = document.getElementById('apellidos').value;
        const fecha_nacimiento = document.getElementById('fecha_nacimiento').value;
        const direccion = document.getElementById('direccion').value;
        const telefono = document.getElementById('telefono').value;
        const password = document.getElementById('password').value;
        const genero = document.getElementById('genero').value;
        const identificacion = document.getElementById('identificacion').value;
        const profesion = document.getElementById('profesion').value;
        const contacto_emergencia = document.getElementById('contacto_emergencia').value;
        const enfermedades_cronicas = document.getElementById('enfermedades_cronicas').value;
        const alergias = document.getElementById('alergias').value;
        const medicacion_actual = document.getElementById('medicacion_actual').value;
        const problemas_mentales = document.getElementById('problemas_mentales').value;
        const operaciones_previas = document.getElementById('operaciones_previas').value;
        const religion = document.getElementById('religion').value;
        const antecedentes_familiares = document.getElementById('antecedentes_familiares').value;
        const peso = parseFloat(document.getElementById('peso').value);

        const tabaquismo = document.querySelector('#formulario-paciente input[name="tabaquismo"]').checked;
        const alcoholismo = document.querySelector('#formulario-paciente input[name="alcoholismo"]').checked;
        const actividad_fisica = document.querySelector('#formulario-paciente input[name="actividad_fisica"]').checked;
        const dieta = document.querySelector('#formulario-paciente input[name="dieta"]').checked;

        let pacienteData = new Patient(
            patientId, codigousuario, nombre, apellidos, fecha_nacimiento, genero, telefono, password,
            direccion, profesion, enfermedades_cronicas, alergias, medicacion_actual, problemas_mentales,
            operaciones_previas, antecedentes_familiares, tabaquismo, alcoholismo, actividad_fisica, dieta,
            identificacion, contacto_emergencia, religion
        );

        const patientIndex = pacientes.findIndex(p => p.id === patientId);

        if (patientIndex > -1) {
            // Actualizar paciente existente
            pacientes[patientIndex] = pacienteData;
            showAlertModal('Paciente actualizado correctamente.', 'Actualización Exitosa');
        } else {
            // Nuevo paciente
            if (pacientes.some(p => p.codigousuario.toLowerCase() === codigousuario.toLowerCase())) {
                showAlertModal('El código de usuario ya existe. Por favor, elija otro.', 'Error de Registro');
                return;
            }
            if (pacientes.some(p => p.telefono === telefono)) {
                showAlertModal('El número de teléfono ya está registrado. Por favor, elija otro o inicie sesión.', 'Error de Registro');
                return;
            }
            pacientes.push(pacienteData);
            nextPatientId++;
            showAlertModal('Paciente guardado correctamente.', 'Registro Exitoso');
        }

        localStorage.setItem('pacientes', JSON.stringify(pacientes));
        localStorage.setItem('nextPatientId', nextPatientId);
        this.reset();
        updatePatientIdField();
        mostrarPacientes();
    });
}

// Función para mostrar la tabla de pacientes
function mostrarPacientes(filteredPatients = pacientes) { // Acepta una lista filtrada
    const pacientesLista = document.getElementById('pacientes-lista');
    if (!pacientesLista) return;

    pacientesLista.innerHTML = '';

    if (filteredPatients.length === 0) {
        pacientesLista.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay pacientes registrados que coincidan con la búsqueda.</td></tr>';
    }

    filteredPatients.forEach(patient => {
        const row = pacientesLista.insertRow();
        row.innerHTML = `
            <td data-label="ID Paciente">${patient.id}</td>
            <td data-label="Código Usuario">${patient.codigousuario}</td>
            <td data-label="Nombres">${patient.nombre}</td>
            <td data-label="Apellidos">${patient.apellidos}</td>
            <td data-label="Fecha Nac.">${patient.fecha_nacimiento}</td>
            <td data-label="Dirección">${patient.direccion}</td>
            <td data-label="Teléfono">${patient.telefono}</td>
            <td data-label="Género">${patient.genero}</td>
            <td data-label="Acción">
                <button class="btn-secondary btn-edit-patient" onclick="editPatient(${patient.id})">Editar</button>
                <button class="btn-danger btn-delete-patient" onclick="deletePatient(${patient.id})">Eliminar</button>
            </td>
        `;
    });
    updateUIForRole(); // Aplicar visibilidad de botones después de cargar la tabla
}

// Función para buscar pacientes
function searchPatients() {
    const searchTerm = document.getElementById('patientSearchInput').value.toLowerCase();
    const filteredPatients = pacientes.filter(patient => {
        return (
            String(patient.id).toLowerCase().includes(searchTerm) ||
            patient.codigousuario.toLowerCase().includes(searchTerm) ||
            patient.nombre.toLowerCase().includes(searchTerm) ||
            patient.apellidos.toLowerCase().includes(searchTerm) ||
            patient.fecha_nacimiento.toLowerCase().includes(searchTerm) ||
            patient.telefono.toLowerCase().includes(searchTerm)
        );
    });
    mostrarPacientes(filteredPatients); // Mostrar solo los pacientes filtrados
}

// Función para editar un paciente
function editPatient(id) {
    const patient = pacientes.find(p => p.id === id);
    if (patient) {
        document.getElementById('id').value = patient.id;
        document.getElementById('codigousuario').value = patient.codigousuario;
        document.getElementById('nombre').value = patient.nombre;
        document.getElementById('apellidos').value = patient.apellidos;
        document.getElementById('fecha_nacimiento').value = patient.fecha_nacimiento;
        document.getElementById('direccion').value = patient.direccion;
        document.getElementById('telefono').value = patient.telefono;
        document.getElementById('password').value = patient.password; 
        document.getElementById('genero').value = patient.genero;
        document.getElementById('identificacion').value = patient.identificacion; 
        document.getElementById('profesion').value = patient.profesion;
        document.getElementById('contacto_emergencia').value = patient.contacto_emergencia; 
        document.getElementById('enfermedades_cronicas').value = patient.enfermedades_cronicas;
        document.getElementById('alergias').value = patient.alergias;
        document.getElementById('medicacion_actual').value = patient.medicacion_actual;
        document.getElementById('problemas_mentales').value = patient.problemas_mentales;
        document.getElementById('operaciones_previas').value = patient.operaciones_previas;
        document.getElementById('religion').value = patient.religion; 
        document.getElementById('antecedentes_familiares').value = patient.antecedentes_familiares;
        document.getElementById('peso').value = patient.peso;

        document.querySelector('#formulario-paciente input[name="tabaquismo"]').checked = patient.tabaquismo;
        document.querySelector('#formulario-paciente input[name="alcoholismo"]').checked = patient.alcoholismo;
        document.querySelector('#formulario-paciente input[name="actividad_fisica"]').checked = patient.actividad_fisica;
        document.querySelector('#formulario-paciente input[name="dieta"]').checked = patient.dieta;

        const idPacienteCita = document.getElementById('idPaciente');
        if(idPacienteCita) idPacienteCita.value = patient.id;
    }
}

// Función para eliminar un paciente (USANDO EL MODAL PERSONALIZADO)
function deletePatient(id) {
    showConfirmModal('¿Estás seguro de que quieres eliminar este paciente? Se eliminarán también sus citas, exámenes y diagnósticos/tratamientos asociados.', () => {
        // Lógica de eliminación
        pacientes = pacientes.filter(p => p.id !== id);
        localStorage.setItem('pacientes', JSON.stringify(pacientes));

        citas = citas.filter(cita => cita.idPaciente !== id);
        localStorage.setItem('citas', JSON.stringify(citas));

        examenes = examenes.filter(examen => examen.pacienteId !== id);
        localStorage.setItem('examenes', JSON.stringify(examenes));

        diagnosticosTratamientos = diagnosticosTratamientos.filter(dt => dt.patientId !== id);
        localStorage.setItem('diagnosticosTratamientos', JSON.stringify(diagnosticosTratamientos));

        showAlertModal('Paciente y datos asociados eliminados correctamente.', 'Eliminación Exitosa');
        mostrarPacientes(); // Re-renderizar tabla de pacientes
        mostrarCitas(); // Re-renderizar tabla de citas
        if (calendar) {
            calendar.refetchEvents(); // Actualizar eventos en el calendario
        }

        const currentSearchPatientIdElement = document.getElementById('searchPatientId');
        if (currentSearchPatientIdElement && parseInt(currentSearchPatientIdElement.value) === id) {
            currentSearchPatientIdElement.value = '';
            loadPatientHistory(); // Limpiar y recargar historial si era el paciente eliminado
        }
        displayPatientPendingAppointments(); // Actualizar citas pendientes del paciente
    }, () => {
        console.log("Eliminación de paciente cancelada.");
        showAlertModal("Eliminación de paciente cancelada.", "Cancelado");
    });
}

// ****************************************************************************************************
// Módulo de Gestión de Citas
// ****************************************************************************************************

// Mapeo de especialidades a doctores
const doctoresPorEspecialidad = {
    "Cardiólogo": ["Dr. Juan Pérez", "Dra. Ana Gómez", "Dr. Valentín Fuster", "Dr. Josep Brugada", "Dr. Christiaan Barnard"],
    "Endocrinólogo": ["Dr. Luis Martínez", "Dra. Sofía Heredia", "Dr. César Lozano Peña"],
    "Oncólogo": ["Dr. Carlos Ramírez", "Dra. Laura Benítez", "Dr. Javier Cortés Castán"],
    "Gastroenterólogo": ["Dr. Pedro Sánchez", "Dra. Marta Díaz", "Dr. Vipulroy Rathod", "Dr. Henry Cohen"],
    "Pediatra": ["Dr. Jorge Castro", "Dra. Elena Ruiz", "Dra. Lucía Galán Bertrand", "Dr. Fernando Cabañas González"],
    "Cirujano Maxilofacial": ["Dr. Javier Solís", "Dra. Patricia Mora", "Dr. Julio Acero Sanz"],
    "Psiquiatra": ["Dr. Ricardo Blanco", "Dra. Verónica Salas", "Dr. Sigmund Freud"],
    "Nutricionista": ["Lic. Andrea Vega", "Lic. Francisco Soto", "Dr. Carlos Ríos", "Dra. Gabriela Uriarte", "Dr. Aitor Sánchez", "Dra. Blanca García Orea"],
    "Neurocirujano": ["Dr. Miguel Ángel", "Dr. Piño Manuel Martínez Curdielo", "Dr. Bartolomé Oliver", "Dr. Keith Black"],
    "Dermatólogo": ["Dra. Isabel Fuentes", "Dr. Esteban Bravo", "Dr. Gerardo Martín"],
    "Gineco Obstetra": ["Dra. Fernanda Rojas", "Dr. Roberto Durán", "Dra. María Guadalupe Hernandez Juárez", "Dr. Arturo López Monsalvo", "Dra. Verónica Aguilar Hidalgo"],
    "Traumatólogo": ["Dr. Fernando Torres", "Dra. Carmen Vargas", "Dr. Ramón Cugat", "Dr. Fernando Álvarez", "Dr. Emilio Calvo Crespo", "Dr. Manuel Monteagudo de la Rosa", "Dr. Pedro Guillén"],
    "Anestesista": ["Dra. Silvia Quesada", "Dr. David Montero", "Dr. Humberto Sainz Cabrera", "Dr. Pío Manuel Martínez Curbelo", "Dr. William TG Morton", "Dr. Luis Cabrera Guarderas", "Dr. Waldemar Badía Catalá", "Dr. Felipe Olivari Sáez"],
    "Médico General": ["Dr. Marco Tulio", "Dra. Alba Mora", "Dra. Sara Gabriela", "Dra. Eileen Tercero", "Dr. Mario Fargas", "Dr. David Torrez", "Dr. Edward Jenner", "Dr. Elizabeth Blackwell", "Dr. Galeno", "Dr. Hipócrates"]
};

const especialidadCitaSelect = document.getElementById('especialidadCita');
const doctorCitaSelect = document.getElementById('doctorCita');

// Listener para actualizar doctores al cambiar la especialidad
if(especialidadCitaSelect && doctorCitaSelect) {
    especialidadCitaSelect.addEventListener('change', () => {
        const selectedEspecialidad = especialidadCitaSelect.value;
        doctorCitaSelect.innerHTML = '<option value="">Seleccione un doctor</option>';
        if (selectedEspecialidad && doctoresPorEspecialidad[selectedEspecialidad]) {
            doctoresPorEspecialidad[selectedEspecialidad].forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor;
                option.textContent = doctor;
                doctorCitaSelect.appendChild(option);
            });
        }
    });
}

class Cita {
    constructor(idInterno, idPaciente, numeroCita, fechaRegistro, motivo, especialidad, doctor, estado, observaciones) {
        this.idInterno = idInterno;
        this.idPaciente = idPaciente;
        this.numeroCita = numeroCita;
        this.fechaRegistro = fechaRegistro;
        this.motivo = motivo;
        this.especialidad = especialidad;
        this.doctor = doctor;
        this.estado = estado;
        this.observaciones = observaciones;
    }
}

// Función para generar un nuevo número de cita
function updateCitaNumberField() {
    const numeroCitaInput = document.getElementById('numeroCita');
    if (numeroCitaInput) {
        numeroCitaInput.value = nextCitaNumber;
    }
}

// Función para guardar citas
const formularioCita = document.getElementById('formulario-cita');
if(formularioCita) {
    formularioCita.addEventListener('submit', function(event) {
        event.preventDefault();
        const idPaciente = parseInt(document.getElementById('idPaciente').value); // ID paciente manual
        const numeroCita = parseInt(document.getElementById('numeroCita').value);
        const fechaRegistro = document.getElementById('fechaRegistro').value;
        const motivo = document.getElementById('motivo').value;
        const especialidad = document.getElementById('especialidadCita').value;
        const doctor = document.getElementById('doctorCita').value;
        const estado = document.getElementById('estado').value;
        const observaciones = document.getElementById('observaciones').value;

        if (!idPaciente || !fechaRegistro || !motivo || !especialidad || !doctor || !estado) {
            showAlertModal("Por favor, complete todos los campos obligatorios de la cita.", "Campos Faltantes");
            return;
        }

        const pacienteExiste = pacientes.some(p => p.id === idPaciente);
        if (!pacienteExiste) {
            showAlertModal("El ID de paciente no existe. Por favor, registre al paciente primero.", "Paciente No Encontrado");
            return;
        }

        const citaData = {
            idInterno: `cita-${Date.now()}`, // Usar un ID interno único basado en el tiempo
            idPaciente: idPaciente,
            numeroCita: numeroCita,
            fechaRegistro: fechaRegistro,
            motivo: motivo,
            especialidad: especialidad,
            doctor: doctor,
            estado: estado,
            observaciones: observaciones
        };

        const citaIndex = citas.findIndex(c => c.numeroCita === numeroCita);

        if (citaIndex > -1) {
            citas[citaIndex] = citaData;
            showAlertModal('Cita actualizada correctamente.', 'Actualización Exitosa');
        } else {
            citas.push(citaData);
            nextCitaNumber++;
            showAlertModal('Cita guardada correctamente.', 'Cita Agregada');
        }

        localStorage.setItem('citas', JSON.stringify(citas));
        localStorage.setItem('nextCitaNumber', nextCitaNumber);

        this.reset();
        updateCitaNumberField();
        mostrarCitas();
        if (calendar) {
            calendar.refetchEvents(); // Actualizar eventos en el calendario
        }
        displayPatientPendingAppointments(); // Actualizar citas pendientes del paciente
    });
}

// Función para mostrar citas en la tabla (ADMIN)
function mostrarCitas() {
    const citasLista = document.getElementById('citas-lista');
    if (!citasLista) return;

    citasLista.innerHTML = '';

    if (citas.length === 0) {
        citasLista.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay citas registradas.</td></tr>';
    }

    citas.forEach(cita => {
          const row = citasLista.insertRow();
        row.innerHTML = `
            <td data-label="ID Paciente">${cita.idPaciente}</td>
            <td data-label="N° Cita">${cita.numeroCita}</td>
            <td data-label="Fecha">${cita.fechaRegistro}</td>
            <td data-label="Motivo">${cita.motivo}</td>
            <td data-label="Especialidad">${cita.especialidad}</td>
            <td data-label="Doctor">${cita.doctor}</td>
            <td data-label="Estado">${cita.estado}</td>
            <td data-label="Observaciones">${cita.observaciones}</td>
            <td data-label="Acción">
                <button class="btn-danger btn-delete-cita" onclick="deleteCita(${cita.numeroCita})">Eliminar</button>
            </td>
        `;
    });
    updateUIForRole(); 
}

// Función para mostrar citas pendientes para el PACIENTE
function displayPatientPendingAppointments() {
    const misCitasLista = document.getElementById('mis-citas-lista');
    if (!misCitasLista || currentUserRole !== ROLES.PATIENT || currentLoggedInPatientId === null) {
        if (misCitasLista) misCitasLista.innerHTML = '<tr><td colspan="8" style="text-align: center;">Inicie sesión para ver sus citas.</td></tr>';
        return;
    }

    misCitasLista.innerHTML = '';

    // Filtrar citas pendientes para el paciente logueado
    const patientPendingCitas = citas.filter(cita => 
        cita.idPaciente === currentLoggedInPatientId
    );

    if (patientPendingCitas.length === 0) {
        misCitasLista.innerHTML = '<tr><td colspan="8" style="text-align: center;">No tienes citas registradas.</td></tr>';
    } else {
        patientPendingCitas.forEach(cita => {
            const row = misCitasLista.insertRow();
            row.innerHTML = `
                <td data-label="ID Paciente">${cita.idPaciente}</td>
                <td data-label="N° Cita">${cita.numeroCita}</td>
                <td data-label="Fecha">${cita.fechaRegistro}</td>
                <td data-label="Motivo">${cita.motivo}</td>
                <td data-label="Especialidad">${cita.especialidad}</td>
                <td data-label="Doctor">${cita.doctor}</td>
                <td data-label="Estado">${cita.estado}</td>
                <td data-label="Observaciones">${cita.observaciones}</td>
            `;
            misCitasLista.appendChild(row); 
        });
    }
}

// Función para eliminar citas 
function deleteCita(numeroCita) {
    showConfirmModal('¿Estás seguro de que quieres eliminar esta cita?', () => {
        citas = citas.filter(cita => cita.numeroCita !== numeroCita);
        localStorage.setItem('citas', JSON.stringify(citas));
        showAlertModal('Cita eliminada correctamente.', 'Eliminación Exitosa');
        mostrarCitas();
        if (calendar) {
            calendar.refetchEvents();
        }
        displayPatientPendingAppointments(); 
    }, () => {
        console.log("Eliminación de cita cancelada.");
        showAlertModal("Eliminación de cita cancelada.", "Cancelado");
    });
}

// ****************************************************************************************************
// Módulo de Resultados de Exámenes
// ****************************************************************************************************

class Examen {
    constructor(id, pacienteId, num_examen, fecha_realizacion, descripcion, estado_examen_general, detalle, resultado, indicadorId) {
        this.id = id;
        this.pacienteId = pacienteId;
        this.num_examen = num_examen;
        this.fecha_realizacion = fecha_realizacion;
        this.descripcion = descripcion;
        this.estado_examen_general = estado_examen_general;
        this.detalle = detalle;
        this.resultado = resultado;
        this.indicadorId = indicadorId;
    }
}

function updateExamenNumberField() {
    const numExamenInput = document.getElementById('numExamen');
    if (numExamenInput) {
        numExamenInput.value = nextExamenNumber;
    }
}

const formResultadosExamenes = document.getElementById('form-resultados-examenes');
if(formResultadosExamenes) {
    formResultadosExamenes.addEventListener('submit', function(event) {
        event.preventDefault();

        const pacienteId = parseInt(document.getElementById('examenPacienteId').value);
        const num_examen = document.getElementById('numExamen').value;
        const fecha_realizacion = document.getElementById('fechaRealizacion').value;
        const descripcion = document.getElementById('descripcionExamen').value;
        const estado_examen_general = document.getElementById('estadoExamen').value;

        const tipo_examen = document.getElementById('tipoExamen').value;
        const valor = document.getElementById('valor').value;
        const unidad = document.getElementById('unidad').value;
        const rango_normal = document.getElementById('rangoNormal').value;
        const observaciones_detalle = document.getElementById('observacionesDetalle').value;

        const valor_final = document.getElementById('valorFinal').value;
        const interpretacion = document.getElementById('interpretacion').value;
        const fecha_resultado = document.getElementById('fechaResultado').value;
        const estado_resultado_final = document.getElementById('estadoResultado').value;
        const indicadorId = document.getElementById('indicadorId').value;

        if (!pacienteId || !num_examen || !fecha_realizacion || !tipo_examen) {
            showAlertModal('Por favor, complete al menos los campos obligatorios del examen (ID Paciente, Número de Examen, Fecha de Realización, Tipo de Examen).', 'Campos Faltantes');
            return;
        }

        const pacienteExiste = pacientes.some(p => p.id === pacienteId);
        if (!pacienteExiste) {
            showAlertModal("El ID de paciente no existe. Por favor, registre al paciente primero.", "Paciente No Encontrado");
            return;
        }

        const examenData = new Examen(
            num_examen, 
            pacienteId,
            num_examen,
            fecha_realizacion,
            descripcion,
            estado_examen_general,
            { tipo_examen, valor, unidad, rango_normal, observaciones: observaciones_detalle },
            { valor_final, interpretacion, fecha_resultado, estado: estado_resultado_final },
            indicadorId
        );

        const examenIndex = examenes.findIndex(e => e.id === examenData.id);

        if (examenIndex > -1) {
            examenes[examenIndex] = examenData;
            showAlertModal('Examen actualizado correctamente.', 'Actualización Exitosa');
        } else {
            examenes.push(examenData);
            nextExamenNumber++;
            showAlertModal('Examen guardado correctamente.', 'Examen Guardado');
        }

        localStorage.setItem('examenes', JSON.stringify(examenes));
        localStorage.setItem('nextExamenNumber', nextExamenNumber);
        this.reset();
        updateExamenNumberField();
    });
}

// ****************************************************************************************************
// Historial Clínico (Integración y Visualización)
// ****************************************************************************************************

class DiagnosticoTratamiento {
    constructor(id, patientId, fecha, diagnostico, tratamiento) {
        this.id = id;
        this.patientId = patientId;
        this.fecha = fecha;
        this.diagnostico = diagnostico;
        this.tratamiento = tratamiento;
    }
}

// Función para cargar y mostrar diagnósticos y tratamientos para un paciente específico
function loadDiagnosticosTratamientos(patientId) {
    const diagnosticosTratamientosList = document.getElementById('diagnosticos-tratamientos-list');
    if (!diagnosticosTratamientosList) return;

    diagnosticosTratamientosList.innerHTML = '';

    const patientDts = diagnosticosTratamientos.filter(dt => dt.patientId === patientId);

    if (patientDts.length > 0) {
        patientDts.forEach(dt => {
            const dtItemDiv = document.createElement('div');
            dtItemDiv.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-200'; 
            dtItemDiv.innerHTML = `
                <p class="mb-1"><strong>Fecha:</strong> ${dt.fecha}</p>
                <p class="mb-1"><strong>Diagnóstico:</strong> ${dt.diagnostico}</p>
                <p class="mb-3"><strong>Tratamiento:</strong> ${dt.tratamiento}</p>
                <button class="btn-danger btn-delete-dt" onclick="deleteDiagnosticoTratamiento(${dt.id})">Eliminar</button>
            `;
            diagnosticosTratamientosList.appendChild(dtItemDiv);
        });
    } else {
        diagnosticosTratamientosList.innerHTML = '<p class="placeholder-text">No hay diagnósticos o tratamientos registrados.</p>';
    }
    updateUIForRole(); 
}

// Función para cargar el historial de un paciente específico
function loadPatientHistory() {
    const searchInput = document.getElementById('searchPatientId').value;
    let patient = null;

    console.log("DEBUG: loadPatientHistory() called with searchInput:", searchInput);

    // Obtener referencias a los contenedores principales
    const patientSummaryTextContent = document.getElementById('patient-summary-text-content');
    const antecedentesContent = document.getElementById('antecedentes-content');
    const citasHistoryContent = document.getElementById('citas-history-content');
    const examenesHistoryContent = document.getElementById('examenes-history-content');
    const diagnosticosTratamientosList = document.getElementById('diagnosticos-tratamientos-list');
    const dtPatientIdInput = document.getElementById('dtPatientId');

    // Limpiar contenido previo de las secciones dinámicas
    if (patientSummaryTextContent) patientSummaryTextContent.innerHTML = '<p class="placeholder-text">Seleccione un paciente para ver su resumen.</p>';
    if (antecedentesContent) antecedentesContent.innerHTML = '<p class="placeholder-text">No hay antecedentes registrados para este paciente.</p>';
    if (citasHistoryContent) citasHistoryContent.innerHTML = '<p class="placeholder-text">No hay citas registradas para este paciente.</p>';
    if (examenesHistoryContent) examenesHistoryContent.innerHTML = '<p class="placeholder-text">No hay resultados de exámenes para este paciente.</p>';
    if (diagnosticosTratamientosList) diagnosticosTratamientosList.innerHTML = '<p class="placeholder-text">No hay diagnósticos o tratamientos registrados.</p>';
    if (dtPatientIdInput) dtPatientIdInput.value = '';

    if (searchInput.trim() === '') {
        if (patientSummaryTextContent) patientSummaryTextContent.innerHTML = '<p class="placeholder-text">Ingrese un ID o Código de usuario para buscar.</p>';
        return;
    }

    if (!isNaN(parseInt(searchInput))) {
        const patientId = parseInt(searchInput);
        patient = pacientes.find(p => p.id === patientId);
    } else {
        patient = pacientes.find(p => p.codigousuario && p.codigousuario.toLowerCase() === searchInput.toLowerCase());
    }

    if (!patient) {
        if (patientSummaryTextContent) patientSummaryTextContent.innerHTML = '<p class="placeholder-text">Paciente no encontrado o ID/Código de usuario no válido.</p>';
        return;
    }

    console.log("DEBUG: Patient found:", patient);
    
    if (patientSummaryTextContent) {
        patientSummaryTextContent.innerHTML = `
            <p><strong>ID:</strong> ${patient.id}</p>
            <p><strong>Código Usuario:</strong> ${patient.codigousuario}</p>
            <p><strong>Nombre:</strong> ${patient.nombre} ${patient.apellidos}</p>
            <p><strong>Fecha de Nacimiento:</strong> ${patient.fecha_nacimiento}</p>
            <p><strong>Género:</strong> ${patient.genero}</p>
            <p><strong>Teléfono:</strong> ${patient.telefono}</p>
            <p><strong>Dirección:</strong> ${patient.direccion}</p>
            <p><strong>Profesión:</strong> ${patient.profesion || 'N/A'}</p>
        `;
    }

    // --- Mostrar Antecedentes Médicos ---
    if (antecedentesContent) {
        antecedentesContent.innerHTML = `
            <p><strong>Enfermedades Crónicas:</strong> ${patient.enfermedades_cronicas || 'Ninguna'}</p>
            <p><strong>Alergias:</strong> ${patient.alergias || 'Ninguna'}</p>
            <p><strong>Medicación Actual:</strong> ${patient.medicacion_actual || 'Ninguna'}</p>
            <p><strong>Problemas Mentales:</strong> ${patient.problemas_mentales || 'Ninguno'}</p>
            <p><strong>Operaciones Previas:</strong> ${patient.operaciones_previas || 'Ninguna'}</p>
            <p><strong>Antecedentes Familiares:</strong> ${patient.antecedentes_familiares || 'Ninguno'}</p>
            <p><strong>Hábitos:</strong> ${patient.tabaquismo ? 'Tabaquismo, ' : ''}${patient.alcoholismo ? 'Alcoholismo, ' : ''}${patient.actividad_fisica ? 'Actividad Física, ' : ''}${patient.dieta ? 'Dieta Saludable' : ''}</p>
        `;
    }

    // --- Mostrar Citas ---
    const patientCitas = citas.filter(cita => cita.idPaciente === patient.id);
    if (citasHistoryContent) {
        citasHistoryContent.innerHTML = '';
        if (patientCitas.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'list-disc list-inside space-y-2';
            patientCitas.forEach(cita => {
                const li = document.createElement('li');
                li.className = 'bg-white p-3 rounded-md shadow-sm border border-gray-200';
                li.innerHTML = `
                    <strong>N° Cita:</strong> ${cita.numeroCita}, 
                    <strong>Fecha:</strong> ${cita.fechaRegistro}, 
                    <strong>Motivo:</strong> ${cita.motivo}, 
                    <strong>Especialidad:</strong> ${cita.especialidad}, 
                    <strong>Doctor:</strong> ${cita.doctor}, 
                    <strong>Estado:</strong> ${cita.estado}
                `;
                ul.appendChild(li);
            });
            citasHistoryContent.appendChild(ul);
        } else {
            citasHistoryContent.innerHTML = '<p class="placeholder-text">No hay citas registradas para este paciente.</p>';
        }
    }

    // --- Mostrar Exámenes ---
    const patientExamenes = examenes.filter(examen => examen.pacienteId === patient.id); 
    if (examenesHistoryContent) {
        examenesHistoryContent.innerHTML = '';
        if (patientExamenes.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'list-disc list-inside space-y-2';
            patientExamenes.forEach(examen => {
                const li = document.createElement('li');
                li.className = 'bg-white p-3 rounded-md shadow-sm border border-gray-200';
                li.innerHTML = `
                    <strong>N° Examen:</strong> ${examen.num_examen}, 
                    <strong>Fecha Realización:</strong> ${examen.fecha_realizacion}, 
                    <strong>Tipo:</strong> ${examen.detalle.tipo_examen || 'N/A'}, 
                    <strong>Valor:</strong> ${examen.detalle.valor || 'N/A'} ${examen.detalle.unidad || ''}, 
                    <strong>Resultado:</strong> ${examen.resultado.interpretacion || 'N/A'} (${examen.resultado.estado || 'N/A'})
                `;
                ul.appendChild(li);
            });
            examenesHistoryContent.appendChild(ul);
        } else {
            examenesHistoryContent.innerHTML = '<p class="placeholder-text">No hay resultados de exámenes para este paciente.</p>';
        }
    }

    if (dtPatientIdInput) dtPatientIdInput.value = patient.id;
    loadDiagnosticosTratamientos(patient.id);

    // Ajustar visibilidad de elementos dentro del historial clínico según el rol
    const dtForm = document.getElementById('form-diagnostico-tratamiento');
    const addDtButton = document.getElementById('addDtButton');
    
    const dtDeleteButtons = document.querySelectorAll('#diagnosticos-tratamientos-list .btn-delete-dt'); 
    const downloadHistorySection = document.querySelector('.download-history-section');

    if (currentUserRole === ROLES.ADMIN) {
        if (dtForm) dtForm.classList.remove('hidden');
        if (addDtButton) addDtButton.classList.remove('hidden');
        dtDeleteButtons.forEach(btn => btn.classList.remove('hidden')); // Mostrar para admin
        if (downloadHistorySection) downloadHistorySection.classList.remove('hidden');
    } else if (currentUserRole === ROLES.PATIENT && patient.id === currentLoggedInPatientId) {
        if (dtForm) dtForm.classList.add('hidden'); 
        if (addDtButton) addDtButton.classList.add('hidden');
        dtDeleteButtons.forEach(btn => btn.classList.add('hidden')); 
        if (downloadHistorySection) downloadHistorySection.classList.remove('hidden'); // Paciente logueado puede descargar
    } else { // GUEST o paciente logueado viendo otro historial
        if (dtForm) dtForm.classList.add('hidden');
        if (addDtButton) addDtButton.classList.add('hidden');
        dtDeleteButtons.forEach(btn => btn.classList.add('hidden'));
        if (downloadHistorySection) downloadHistorySection.classList.add('hidden'); 
    }
}

// Listener para el formulario de Diagnósticos y Tratamientos
const formDiagnosticoTratamiento = document.getElementById('form-diagnostico-tratamiento');
if(formDiagnosticoTratamiento) {
    formDiagnosticoTratamiento.addEventListener('submit', function(event) {
        event.preventDefault();
        const patientId = parseInt(document.getElementById('dtPatientId').value);
        const fecha = document.getElementById('dtFecha').value;
        const diagnostico = document.getElementById('dtDiagnostico').value;
        const tratamiento = document.getElementById('dtTratamiento').value;

        if (isNaN(patientId) || !fecha || !diagnostico || !tratamiento) {
            showAlertModal("Por favor, seleccione un paciente y complete todos los campos de diagnóstico/tratamiento.", "Campos Faltantes");
            return;
        }

        const newDt = new DiagnosticoTratamiento(nextDtId++, patientId, fecha, diagnostico, tratamiento);

        diagnosticosTratamientos.push(newDt);
        localStorage.setItem('diagnosticosTratamientos', JSON.stringify(diagnosticosTratamientos));
        localStorage.setItem('nextDtId', nextDtId);

        showAlertModal('Diagnóstico/Tratamiento guardado correctamente.', "Registro Exitoso");
        this.reset();
        loadDiagnosticosTratamientos(patientId); 
    });
}

// Función para eliminar un diagnóstico/tratamiento 
function deleteDiagnosticoTratamiento(dtId) {
    showConfirmModal('¿Estás seguro de que quieres eliminar este diagnóstico/tratamiento?', () => {
        diagnosticosTratamientos = diagnosticosTratamientos.filter(dt => dt.id !== dtId);
        localStorage.setItem('diagnosticosTratamientos', JSON.stringify(diagnosticosTratamientos));
        const currentSearchPatientId = document.getElementById('searchPatientId').value;
        if (currentSearchPatientId) {
            loadPatientHistory(); // Recargar historial para reflejar el cambio
        }
        showAlertModal('Diagnóstico/Tratamiento eliminado correctamente.', 'Eliminación Exitosa');
    }, () => {
        console.log("Eliminación de diagnóstico/tratamiento cancelada.");
        showAlertModal("Eliminación de diagnóstico/tratamiento cancelada.", "Cancelado");
    });
}

// Funcionalidad de descarga del historial clínico
function openDownloadModal() {
    const patientId = document.getElementById('searchPatientId').value;
    if (!patientId || (isNaN(parseInt(patientId)) && patientId.trim() === '')) {
        showAlertModal("Por favor, busque un historial de paciente primero antes de intentar descargar.", "Error de Operación");
        return;
    }
    const downloadModal = document.getElementById('downloadHistoryModal');
    if (downloadModal) {
        downloadModal.style.display = 'flex';
    }
}

function closeDownloadModal() {
    const downloadModal = document.getElementById('downloadHistoryModal');
    if (downloadModal) {
        downloadModal.style.display = 'none';
    }
}

function downloadPatientHistory() {
    openDownloadModal();
}

function captureAndDownloadHistory(format) {
    const patientHistoryDisplay = document.getElementById('patient-history-display');
    const searchPatientIdElement = document.getElementById('searchPatientId');
    const patientId = searchPatientIdElement ? searchPatientIdElement.value : '';

    if (!patientHistoryDisplay || !patientId || (isNaN(parseInt(patientId)) && patientId.trim() === '')) {
        showAlertModal("Error: No se encontró el historial del paciente para descargar.", "Error de Descarga");
        return;
    }

    closeDownloadModal();

    // Ocultar elementos que no deben aparecer en la captura
    const elementsToHide = patientHistoryDisplay.querySelectorAll('.btn-delete-dt, .btn-secondary, .download-history-section button, .download-icon, form button[type="submit"]');
    elementsToHide.forEach(el => el.style.display = 'none');

    // Temporalmente ajustar el scroll para asegurar que todo el contenido es visible para html2canvas
    const originalScrollY = window.scrollY;
    const originalBodyOverflow = document.body.style.overflow;
    
    const clientRect = patientHistoryDisplay.getBoundingClientRect();
    const totalHeight = clientRect.height;
    
    window.scrollTo(0, clientRect.top + window.scrollY);
    document.body.style.overflow = 'hidden';

    html2canvas(patientHistoryDisplay, {
        scale: 2,
        useCORS: true,
        logging: true,
        windowHeight: totalHeight,
        backgroundColor: window.getComputedStyle(patientHistoryDisplay).backgroundColor || '#F9FAFB' 
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `historial_clinico_paciente_${patientId}.${format}`;
        link.href = canvas.toDataURL(`image/${format}`, 1.0);
        link.click();

        elementsToHide.forEach(el => el.style.display = '');
        document.body.style.overflow = originalBodyOverflow;
        window.scrollTo(0, originalScrollY);

        showAlertModal(`Historial descargado como ${format.toUpperCase()}.`, "Descarga Exitosa");

    }).catch(error => {
        console.error("Error al generar la imagen del historial:", error);
        showAlertModal("Hubo un error al descargar la imagen del historial clínico verifique para más detalles.", "Error de Descarga");
        
        elementsToHide.forEach(el => el.style.display = '');
        document.body.style.overflow = originalBodyOverflow;
        window.scrollTo(0, originalScrollY);
    });
}

// ****************************************************************************************************
// Slider de Imágenes
// ****************************************************************************************************
let currentSlide = 0;
const slidesContainer = document.getElementById('slides-container');
const slides = slidesContainer ? document.querySelectorAll('.slide') : [];

function moveSlide(direction) {
    if (!slidesContainer || slides.length === 0) return;

    currentSlide += direction;
    if (currentSlide < 0) {
        currentSlide = slides.length - 1;
    } else if (currentSlide >= slides.length) {
        currentSlide = 0;
    }
    slidesContainer.style.transform = `translateX(-${currentSlide * 100}vw)`;
}

if (slidesContainer && slides.length > 0) { 
    setInterval(() => {
        moveSlide(1);
    }, 5000);
}

// ****************************************************************************************************
// Gráficas (Dashboard Estadísticas)
// ****************************************************************************************************

const dataEspecialidades = {
    labels: ['Cardiólogo', 'Endocrinólogo', 'Oncólogo', 'Gastroenterólogo', 'Pediatra', 'Dermatólogo', 'Psiquiatra'],
    datasets: [{
        label: 'Número de Consultas',
        data: [15, 10, 8, 12, 20, 7, 11],
        backgroundColor: [
            'rgba(0, 119, 182, 0.6)', // #0077B6
            'rgba(72, 201, 176, 0.6)', // #48C9B0
            'rgba(39, 174, 96, 0.6)',  // #27AE60
            'rgba(231, 76, 60, 0.6)',  // #E74C3C
            'rgba(241, 196, 15, 0.6)', // #F1C40F
            'rgba(44, 62, 80, 0.6)',   // #2C3E50
            'rgba(214, 239, 255, 0.6)' // #D6EFFF
        ],
        borderColor: [
            '#0077B6',
            '#48C9B0',
            '#27AE60',
            '#E74C3C',
            '#F1C40F',
            '#2C3E50',
            '#D6EFFF'
        ],
        borderWidth: 1
    }]
};

const dataGenero = {
    labels: ['Femenino', 'Masculino'],
    datasets: [{
        label: 'Número de Pacientes',
        data: [70, 50], 
        backgroundColor: [
            'rgba(72, 201, 176, 0.6)', // #48C9B0 (para Femenino)
            'rgba(0, 119, 182, 0.6)'  // #0077B6 (para Masculino)
        ],
        borderColor: [
            '#48C9B0',
            '#0077B6'
        ],
        borderWidth: 1
    }]
};

const dataTratamientos = {
    labels: ['Completado', 'En Curso', 'Abandonado'],
    datasets: [{
        data: [40, 25, 10],
        backgroundColor: [
            'rgba(39, 174, 96, 0.6)',  // #27AE60
            'rgba(241, 196, 15, 0.6)', // #F1C40F
            'rgba(231, 76, 60, 0.6)'   // #E74C3C
        ],
        borderColor: [
            '#27AE60',
            '#F1C40F',
            '#E74C3C'
        ],
        borderWidth: 1
    }]
};

function renderCharts() {
    Chart.getChart('radarChart')?.destroy();
    Chart.getChart('barChart')?.destroy();
    Chart.getChart('pieChart')?.destroy();

    // Gráfico de Radar - Especialidades Médicas
    const radarCtx = document.getElementById('radarChart')?.getContext('2d');
    if (radarCtx) {
        new Chart(radarCtx, {
            type: 'radar',
            data: dataEspecialidades,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { display: false },
                        suggestedMin: 0,
                        suggestedMax: 25,
                        pointLabels: { font: { size: 10 } },
                        ticks: { display: false }
                    }
                },
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 12 } } },
                    title: { display: true, text: 'Consultas por Especialidad', font: { size: 14 } }
                }
            }
        });
    }

    // Gráfico de Barras - Pacientes por Género
    const barCtx = document.getElementById('barChart')?.getContext('2d');
    if (barCtx) {
        new Chart(barCtx, {
            type: 'bar',
            data: dataGenero,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { font: { size: 10 } } },
                    y: { beginAtZero: true, suggestedMax: 80, ticks: { font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Pacientes por Género', font: { size: 14 } }
                }
            }
        });
    }

    // Gráfico de Pastel - Seguimiento de Tratamientos
    const pieCtx = document.getElementById('pieChart')?.getContext('2d');
    if (pieCtx) {
        new Chart(pieCtx, {
            type: 'pie',
            data: dataTratamientos,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 } } },
                    title: { display: true, text: 'Seguimiento de Tratamientos', font: { size: 14 } }
                }
            }
        });
    }
}

// ****************************************************************************************************
// Inicialización al cargar la página (ÚNICO DOMContentLoaded)
// ****************************************************************************************************
document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOM completamente cargado. Inicializando...");

    // Asegurarse de que los modales estén ocultos al inicio 
    const loginModal = document.getElementById('loginRegisterModal');
    if (loginModal) loginModal.style.display = 'none';
    const downloadModal = document.getElementById('downloadHistoryModal');
    if (downloadModal) downloadModal.style.display = 'none';

    // Inicializar la interfaz de usuario según el rol (invitado por defecto)
    updateUIForRole();

    updatePatientIdField();
    mostrarPacientes();

    // Pre-rellenar ID del paciente en formulario de exámenes (Gestión de Citas ahora es manual)
    if (pacientes.length > 0) {
        const lastPatient = pacientes[pacientes.length - 1];
        const examenPacienteId = document.getElementById('examenPacienteId');
        if (examenPacienteId) examenPacienteId.value = lastPatient.id;
    } else {
        const examenPacienteId = document.getElementById('examenPacienteId');
        if (examenPacienteId) {
            examenPacienteId.value = '';
            examenPacienteId.readOnly = false;
            examenPacienteId.classList.remove('readonly-field');
        }
    }

    updateCitaNumberField();
    updateExamenNumberField();
    
    // =================================================================
    // LISTENER MODIFICADO PARA EL BOTÓN "AGENDAR CITA"
    // =================================================================
    const agendarCitaBtn = document.getElementById('agendar-cita-btn');
    if (agendarCitaBtn) {
        agendarCitaBtn.addEventListener('click', function(event) {
            event.preventDefault(); 
            
            if (currentUserRole === ROLES.GUEST) {
                // Para invitados, mostrar la sección "Acerca de Nosotros"
                const acercaSection = document.getElementById('acerca-de-nosotros-section');
                if (acercaSection) {
                    acercaSection.classList.remove('hidden');
                    acercaSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else if (currentUserRole === ROLES.PATIENT) {
                // Para pacientes, llevarlos a su lista de citas
                const patientAppointmentsSection = document.getElementById('patient-appointments-section');
                if (patientAppointmentsSection) {
                    patientAppointmentsSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    }

    // ******************************************************************
    // INICIALIZACIÓN DE FULLCALENDAR
    // ******************************************************************
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true,
            eventLimit: true,
            events: function(fetchInfo, successCallback, failureCallback) {
                try {
                    const formattedEvents = citas.map(cita => {
                        const paciente = pacientes.find(p => p.id === cita.idPaciente);
                        const pacienteNombre = paciente ? `${paciente.nombre} ${paciente.apellidos}` : 'Desconocido';
                        return {
                            id: cita.idInterno,
                            title: `${cita.motivo} (${cita.doctor}) - P: ${pacienteNombre}`,
                            start: cita.fechaRegistro,
                            extendedProps: {
                                idPaciente: cita.idPaciente,
                                especialidad: cita.especialidad,
                                estado: cita.estado,
                                numeroCita: cita.numeroCita,
                                observaciones: cita.observaciones
                            },
                            color: cita.estado === 'Confirmada' ? '#27AE60' : (cita.estado === 'Pendiente' ? '#F39C12' : (cita.estado === 'Realizada' ? '#0077B6' : '#E74C3C'))
                        };
                    });
                    successCallback(formattedEvents);
                } catch (error) {
                    console.error("Error al formatear eventos para el calendario:", error);
                    failureCallback(error);
                }
            },
            eventDidMount: function(info) {

            },
            eventClick: function(info) {
                showAlertModal(
                    'Cita: ' + info.event.title + 
                    '\nFecha: ' + info.event.start.toLocaleDateString() +
                    '\nEstado: ' + (info.event.extendedProps.estado || 'N/A') +
                    '\nObservaciones: ' + (info.event.extendedProps.observaciones || 'N/A'),
                    "Detalles de la Cita"
                );
            },
            dateClick: function(info) {
                const fechaInput = document.getElementById('fechaRegistro');
                if (fechaInput) {
                    fechaInput.value = info.dateStr;
                    showAlertModal('Fecha seleccionada en el formulario de citas: ' + info.dateStr, "Fecha Seleccionada");
                } else {
                    showAlertModal('Fecha seleccionada: ' + info.dateStr, "Fecha Seleccionada");
                }
            },
            eventDrop: function(info) {
                const eventId = info.event.id;
                const newDate = info.event.start.toISOString().slice(0,10); 
                
                const citaIndex = citas.findIndex(c => c.idInterno === eventId);
                if (citaIndex !== -1) {
                    citas[citaIndex].fechaRegistro = newDate;
                    localStorage.setItem('citas', JSON.stringify(citas));
                    mostrarCitas(); 
                    showAlertModal('Fecha de la cita actualizada: ' + newDate, "Cita Actualizada");
                } else {
                    console.error('Error: No se encontró la cita para actualizar.');
                    showAlertModal('Error: No se encontró la cita para actualizar.', 'Error de Actualización');
                }
            }
        });
        calendar.render();
        console.log('FullCalendar inicializado y citas cargadas.');
    } else {
        console.error('No se encontró el elemento con ID "calendar". Asegúrate de que existe en tu HTML.');
    }

    if (especialidadCitaSelect && especialidadCitaSelect.value) {
        especialidadCitaSelect.dispatchEvent(new Event('change'));
    }

    // Asegurarse de que el input de ID de paciente en el historial clínico tenga el valor del paciente logueado
    if (currentUserRole === ROLES.PATIENT && currentLoggedInPatientId !== null) {
        const searchPatientIdInput = document.getElementById('searchPatientId');
        if (searchPatientIdInput) {
            searchPatientIdInput.value = currentLoggedInPatientId;
            loadPatientHistory(); // Cargar automáticamente el historial del paciente logueado
            displayPatientPendingAppointments(); // Cargar citas pendientes del paciente logueado
        }
    }

    // Renderizar las gráficas al cargar la página, ya que son visibles para Guest y Patient
    renderCharts();

    // Listener para el campo de búsqueda de pacientes
    const patientSearchInput = document.getElementById('patientSearchInput');
    if (patientSearchInput) {
        patientSearchInput.addEventListener('input', searchPatients);
    }

    // Listener para cerrar los modales al hacer click fuera de ellos
    window.addEventListener('click', function(event) {
        const loginRegisterModal = document.getElementById('loginRegisterModal');
        const downloadHistoryModal = document.getElementById('downloadHistoryModal');
        const customAlertConfirmModal = document.getElementById('customModal');

        if (loginRegisterModal && event.target === loginRegisterModal) {
            closeLoginModal();
        }
        if (downloadHistoryModal && event.target === downloadHistoryModal) {
            closeDownloadModal();
        }
        if (customAlertConfirmModal && event.target === customAlertConfirmModal) {
            customAlertConfirmModal.style.display = 'none'; 
        }
    });

    // Cargar las citas pendientes del paciente si el usuario ya está logueado al recargar la página
    if (currentUserRole === ROLES.PATIENT && currentLoggedInPatientId !== null) {
        displayPatientPendingAppointments();
    }
});