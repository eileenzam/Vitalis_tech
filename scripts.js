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