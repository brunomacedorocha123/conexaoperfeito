// ==================== AUTH.JS ====================
// Lógica específica para autenticação (login, cadastro, validações)

// ==================== CONFIGURAÇÕES DE AUTENTICAÇÃO ====================
const AUTH_CONFIG = {
    minPasswordLength: 8,
    maxPasswordLength: 128,
    minNameLength: 2,
    minNicknameLength: 3,
    minAge: 18
};

// ==================== VALIDAÇÕES DE FORMULÁRIOS ====================

// Validação do formulário de login
function validateLoginForm(email, password) {
    const errors = {};
    
    // Validar email
    if (!email || !validateEmail(email)) {
        errors.email = 'Por favor, insira um e-mail válido';
    }
    
    // Validar senha
    if (!password || password.length < 6) {
        errors.password = 'A senha deve ter pelo menos 6 caracteres';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors: errors
    };
}

// Validação do formulário de cadastro
function validateRegisterForm(formData) {
    const errors = {};
    const {
        firstName,
        lastName,
        nickname,
        email,
        birthDate,
        password,
        confirmPassword,
        terms
    } = formData;

    // Validar nome
    if (!firstName || firstName.trim().length < AUTH_CONFIG.minNameLength) {
        errors.firstName = `Nome deve ter pelo menos ${AUTH_CONFIG.minNameLength} caracteres`;
    }

    // Validar sobrenome
    if (!lastName || lastName.trim().length < AUTH_CONFIG.minNameLength) {
        errors.lastName = `Sobrenome deve ter pelo menos ${AUTH_CONFIG.minNameLength} caracteres`;
    }

    // Validar nickname
    if (!nickname || nickname.trim().length < AUTH_CONFIG.minNicknameLength) {
        errors.nickname = `Nickname deve ter pelo menos ${AUTH_CONFIG.minNicknameLength} caracteres`;
    }

    // Validar email
    if (!email || !validateEmail(email)) {
        errors.email = 'Por favor, insira um e-mail válido';
    }

    // Validar data de nascimento
    if (!birthDate) {
        errors.birthDate = 'Data de nascimento é obrigatória';
    } else {
        const age = calculateAge(birthDate);
        if (age < AUTH_CONFIG.minAge) {
            errors.birthDate = `Você deve ter pelo menos ${AUTH_CONFIG.minAge} anos`;
        }
    }

    // Validar senha
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        errors.password = 'A senha não atende aos requisitos de segurança';
    }

    // Validar confirmação de senha
    if (password !== confirmPassword) {
        errors.confirmPassword = 'As senhas não coincidem';
    }

    // Validar termos
    if (!terms) {
        errors.terms = 'Você deve aceitar os termos e condições';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors: errors
    };
}

// ==================== MANIPULAÇÃO DE FORMULÁRIOS ====================

// Configurar formulário de login
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    console.log('🔐 Configurando formulário de login...');

    // Toggle de visibilidade da senha
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }

    // Validação em tempo real
    const emailInput = document.getElementById('email');
    const passwordInputElement = document.getElementById('password');

    if (emailInput) {
        emailInput.addEventListener('blur', validateEmailRealTime);
    }

    if (passwordInputElement) {
        passwordInputElement.addEventListener('blur', validatePasswordRealTime);
    }

    // Submit do formulário
    loginForm.addEventListener('submit', handleLoginSubmit);
}

// Configurar formulário de cadastro
function setupRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;

    console.log('📝 Configurando formulário de cadastro...');

    // Configurar data máxima (18 anos atrás)
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - AUTH_CONFIG.minAge, today.getMonth(), today.getDate());
    const birthDateInput = document.getElementById('birthDate');
    if (birthDateInput) {
        birthDateInput.max = maxDate.toISOString().split('T')[0];
    }

    // Toggle de visibilidade da senha
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }

    // Validação em tempo real da senha
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            updatePasswordRequirements(this.value);
            validatePasswordRealTime();
        });
    }

    // Validações em tempo real
    const inputs = ['firstName', 'lastName', 'nickname', 'email', 'birthDate', 'confirmPassword'];
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', function() {
                validateFieldRealTime(inputId);
            });
        }
    });

    // Submit do formulário
    registerForm.addEventListener('submit', handleRegisterSubmit);
}

// ==================== HANDLERS DE SUBMIT ====================

// Handler para login
async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');

    // Esconder alertas
    hideAlerts();

    // Coletar dados
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;

    // Validar
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
        showFormErrors(validation.errors);
        return;
    }

    // Mostrar loading
    if (submitBtn) submitBtn.disabled = true;
    if (loading) loading.style.display = 'block';

    try {
        console.log('🔄 Tentando login para:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('❌ Erro no login:', error);
            throw error;
        }

        console.log('✅ Login bem-sucedido:', data.user);

        if (data.user) {
            // Verificar se o e-mail foi confirmado
            if (!data.user.email_confirmed_at) {
                showAlert('📧 Sua conta precisa ser verificada. Verifique seu e-mail antes de fazer login.', 'warning');
            } else {
                showAlert('✅ Login realizado com sucesso! Redirecionando...', 'success');
                
                // Salvar e-mail se "Lembrar-me" estiver marcado
                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                }
                
                // Redirecionar para home após 2 segundos
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 2000);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro completo no login:', error);
        handleAuthError(error);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (loading) loading.style.display = 'none';
    }
}

// Handler para cadastro
async function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('#registerForm button[type="submit"]');
    const loading = document.getElementById('loading');
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');

    // Esconder alertas e erros
    hideAlerts();
    clearFormErrors();

    // Coletar dados
    const formData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        nickname: document.getElementById('nickname').value.trim(),
        email: document.getElementById('email').value.trim(),
        birthDate: document.getElementById('birthDate').value,
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        terms: document.getElementById('terms').checked
    };

    // Validar
    const validation = validateRegisterForm(formData);
    if (!validation.isValid) {
        showFormErrors(validation.errors);
        return;
    }

    // Mostrar loading
    if (submitBtn) submitBtn.disabled = true;
    if (loading) loading.style.display = 'block';

    try {
        console.log('🔄 Iniciando cadastro...');

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    full_name: `${formData.firstName} ${formData.lastName}`,
                    nickname: formData.nickname,
                    birth_date: formData.birthDate
                },
                emailRedirectTo: `${window.location.origin}/login.html`
            }
        });

        if (authError) {
            console.error('❌ Erro no Auth:', authError);
            throw authError;
        }

        console.log('✅ Auth criado:', authData);

        if (authData.user) {
            // Verificar se é um usuário novo
            if (authData.user.identities && authData.user.identities.length === 0) {
                showAlert('❌ Este e-mail já está cadastrado. Tente fazer login.', 'error');
                return;
            }

            // ✅ SUCESSO - CADASTRO REALIZADO
            console.log('✅ Cadastro completo!');
            showAlert('✅ Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.', 'success');
            
            // Limpar formulário
            document.getElementById('registerForm').reset();
            
            // Redirecionar para login após 3 segundos
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);

        } else {
            throw new Error('Falha ao criar usuário');
        }

    } catch (error) {
        console.error('❌ Erro no cadastro:', error);
        handleAuthError(error);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (loading) loading.style.display = 'none';
    }
}

// ==================== MANIPULAÇÃO DE ERROS ====================

// Tratamento de erros de autenticação
function handleAuthError(error) {
    let errorMessage = 'Erro ao processar a solicitação. Tente novamente.';
    
    if (error.message.includes('Invalid login credentials')) {
        errorMessage = '❌ E-mail ou senha incorretos. Tente novamente.';
    } else if (error.message.includes('Email not confirmed')) {
        errorMessage = '📧 Sua conta precisa ser verificada. Verifique seu e-mail antes de fazer login.';
    } else if (error.message.includes('User not found')) {
        errorMessage = '❌ Usuário não encontrado. Verifique o e-mail ou cadastre-se.';
    } else if (error.message.includes('already registered') || error.message.includes('user already exists')) {
        errorMessage = '❌ Este e-mail já está cadastrado. Tente fazer login.';
    } else if (error.message.includes('password')) {
        errorMessage = '❌ A senha deve atender a todos os requisitos de segurança.';
    } else if (error.message.includes('email')) {
        errorMessage = '❌ Por favor, insira um e-mail válido.';
    } else if (error.message.includes('rate limit')) {
        errorMessage = '⏰ Muitas tentativas. Aguarde alguns minutos.';
    }
    
    showAlert(errorMessage, 'error');
}

// ==================== VALIDAÇÕES EM TEMPO REAL ====================

function validateEmailRealTime() {
    const field = document.getElementById('email');
    const value = field.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(value);
    
    if (!isValid && value !== '') {
        showFieldError('email', 'Por favor, insira um e-mail válido');
        field.classList.add('error');
    } else {
        hideFieldError('email');
        field.classList.remove('error');
    }
}

function validatePasswordRealTime() {
    const field = document.getElementById('password');
    const value = field.value;
    const isValid = value.length >= 6;
    
    if (!isValid && value !== '') {
        showFieldError('password', 'A senha deve ter pelo menos 6 caracteres');
        field.classList.add('error');
    } else {
        hideFieldError('password');
        field.classList.remove('error');
    }
}

function validateFieldRealTime(fieldId) {
    const field = document.getElementById(fieldId);
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    switch (fieldId) {
        case 'firstName':
        case 'lastName':
            if (value.length < AUTH_CONFIG.minNameLength) {
                isValid = false;
                errorMessage = `Deve ter pelo menos ${AUTH_CONFIG.minNameLength} caracteres`;
            }
            break;
        case 'nickname':
            if (value.length < AUTH_CONFIG.minNicknameLength) {
                isValid = false;
                errorMessage = `Deve ter pelo menos ${AUTH_CONFIG.minNicknameLength} caracteres`;
            }
            break;
        case 'confirmPassword':
            const password = document.getElementById('password').value;
            if (value !== password) {
                isValid = false;
                errorMessage = 'As senhas não coincidem';
            }
            break;
    }

    if (!isValid && value !== '') {
        showFieldError(fieldId, errorMessage);
        field.classList.add('error');
    } else {
        hideFieldError(fieldId);
        field.classList.remove('error');
    }
}

// ==================== UTILITÁRIOS DE FORMULÁRIO ====================

function showFormErrors(errors) {
    Object.keys(errors).forEach(fieldId => {
        showFieldError(fieldId, errors[fieldId]);
        const field = document.getElementById(fieldId);
        if (field) field.classList.add('error');
    });
}

function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function hideFieldError(fieldId) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function clearFormErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('.form-control').forEach(el => {
        el.classList.remove('error');
    });
}

function hideAlerts() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        alert.style.display = 'none';
    });
}

// ==================== REQUISITOS DE SENHA EM TEMPO REAL ====================

function updatePasswordRequirements(password) {
    const { requirements, strength } = checkPasswordStrength(password);
    const requirementElements = {
        length: document.getElementById('reqLength'),
        uppercase: document.getElementById('reqUppercase'),
        lowercase: document.getElementById('reqLowercase'),
        number: document.getElementById('reqNumber'),
        special: document.getElementById('reqSpecial')
    };
    
    // Atualizar cada requisito
    Object.keys(requirements).forEach(key => {
        const element = requirementElements[key];
        if (element) {
            if (requirements[key]) {
                element.classList.add('requirement-met');
                element.classList.remove('requirement-unmet');
            } else {
                element.classList.remove('requirement-met');
                element.classList.add('requirement-unmet');
            }
        }
    });

    // Atualizar barra de força
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    
    if (strengthBar && strengthText) {
        strengthBar.className = 'strength-bar';
        strengthText.textContent = '';
        
        if (password.length > 0) {
            switch(strength) {
                case 1:
                case 2:
                    strengthBar.classList.add('strength-weak');
                    strengthText.textContent = 'Fraca';
                    strengthText.style.color = '#ef4444';
                    break;
                case 3:
                    strengthBar.classList.add('strength-fair');
                    strengthText.textContent = 'Razoável';
                    strengthText.style.color = '#f59e0b';
                    break;
                case 4:
                    strengthBar.classList.add('strength-good');
                    strengthText.textContent = 'Boa';
                    strengthText.style.color = '#eab308';
                    break;
                case 5:
                    strengthBar.classList.add('strength-strong');
                    strengthText.textContent = 'Forte';
                    strengthText.style.color = '#22c55e';
                    break;
            }
        }
    }
}

// ==================== INICIALIZAÇÃO ====================

// Inicializar sistemas de autenticação
function initializeAuth() {
    console.log('🔐 Inicializando sistemas de autenticação...');
    
    // Verificar status de verificação de e-mail
    checkVerificationStatus();
    
    // Configurar formulários
    setupLoginForm();
    setupRegisterForm();
    
    // Configurar "Lembrar-me"
    setupRememberMe();
}

// Verificar status de verificação de e-mail
function checkVerificationStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('verified') === 'true') {
        showAlert('✅ E-mail verificado com sucesso! Faça login para continuar.', 'success');
        
        // Limpar parâmetro da URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Configurar "Lembrar-me"
function setupRememberMe() {
    const rememberMe = document.getElementById('rememberMe');
    const savedEmail = localStorage.getItem('rememberedEmail');

    if (rememberMe && savedEmail) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = savedEmail;
            rememberMe.checked = true;
        }
    }

    if (rememberMe) {
        rememberMe.addEventListener('change', function() {
            const emailInput = document.getElementById('email');
            const email = emailInput ? emailInput.value : '';
            
            if (this.checked && email) {
                localStorage.setItem('rememberedEmail', email);
                console.log('💾 E-mail salvo:', email);
            } else {
                localStorage.removeItem('rememberedEmail');
                console.log('💾 E-mail removido do storage');
            }
        });
    }
}

// ==================== EXPORTAÇÃO ====================

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Só inicializar se estiver em página de autenticação
    if (document.getElementById('loginForm') || document.getElementById('registerForm')) {
        initializeAuth();
    }
});

// Tornar funções disponíveis globalmente
window.validateLoginForm = validateLoginForm;
window.validateRegisterForm = validateRegisterForm;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.setupLoginForm = setupLoginForm;
window.setupRegisterForm = setupRegisterForm;
window.updatePasswordRequirements = updatePasswordRequirements;

console.log('✅ Auth.js carregado! Sistemas de autenticação prontos.');