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