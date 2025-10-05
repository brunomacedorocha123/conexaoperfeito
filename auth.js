// auth.js - Lógica de autenticação para Conexão Perfeita Amor

// Verificar autenticação e redirecionar
async function checkAuthState() {
    try {
        const { data } = await supabase.auth.getSession();
        
        const currentPage = window.location.pathname.split('/').pop();
        
        if (data.session) {
            // USUÁRIO LOGADO
            if (currentPage === 'index.html' || currentPage === '' || currentPage === 'login.html' || currentPage === 'cadastro.html') {
                window.location.href = 'home.html';
            }
            
            // Atualizar interface se estiver na home
            if (currentPage === 'home.html') {
                updateUserInterface(data.session.user);
            }
            
        } else {
            // USUÁRIO NÃO LOGADO
            if (currentPage === 'home.html') {
                window.location.href = 'index.html';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
}

// Atualizar interface do usuário logado
function updateUserInterface(user) {
    const userName = user.user_metadata?.name || user.email || 'Usuário';
    const welcomeElement = document.getElementById('welcome-message');
    const userInfoElement = document.getElementById('user-info');
    
    if (welcomeElement) {
        welcomeElement.textContent = `Bem-vindo, ${userName}!`;
    }
    
    if (userInfoElement) {
        userInfoElement.textContent = `Email: ${user.email}`;
    }
    
    // Atualizar saudação no header da home
    const userNameElement = document.getElementById('user-name');
    const userWelcomeElement = document.getElementById('user-welcome');
    
    if (userNameElement && userWelcomeElement) {
        userNameElement.textContent = userName;
        userWelcomeElement.style.display = 'block';
    }
}

// Login
async function handleLogin(email, password) {
    try {
        showMessage('login-message', 'Entrando...', 'success');
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        
        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                showMessage('login-message', 'E-mail ou senha incorretos.', 'error');
            } else if (error.message.includes('Email not confirmed')) {
                showMessage('login-message', 'E-mail não confirmado. Verifique sua caixa de entrada.', 'error');
            } else {
                showMessage('login-message', `Erro: ${error.message}`, 'error');
            }
            return false;
        } else {
            showMessage('login-message', 'Login realizado com sucesso!', 'success');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
            return true;
        }
    } catch (error) {
        showMessage('login-message', 'Erro inesperado ao fazer login.', 'error');
        return false;
    }
}

// Cadastro
async function handleRegister(name, email, password) {
    try {
        showMessage('register-message', 'Criando sua conta...', 'success');
        
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    name: name.trim(),
                    full_name: name.trim()
                },
                emailRedirectTo: 'https://conexaoperfeitaamor.netlify.app/home.html'
            }
        });
        
        if (error) {
            if (error.message.includes('already registered')) {
                showMessage('register-message', 'Este e-mail já está cadastrado. Faça login.', 'error');
            } else if (error.message.includes('Password should be at least 6 characters')) {
                showMessage('register-message', 'A senha deve ter pelo menos 6 caracteres.', 'error');
            } else if (error.message.includes('Invalid email')) {
                showMessage('register-message', 'E-mail inválido. Verifique o formato.', 'error');
            } else {
                showMessage('register-message', `Erro: ${error.message}`, 'error');
            }
            return false;
        } else {
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                showMessage('register-message', 'Este e-mail já está cadastrado. Faça login.', 'error');
                return false;
            }
            
            showMessage('register-message', 'Cadastro realizado! Verifique seu e-mail para confirmação.', 'success');
            
            // Limpar formulário
            const registerForm = document.getElementById('register-form');
            if (registerForm) registerForm.reset();
            
            // Redirecionar após 3 segundos
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
            return true;
        }
    } catch (error) {
        showMessage('register-message', 'Erro inesperado no cadastro.', 'error');
        return false;
    }
}

// Logout
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Erro ao fazer logout:', error);
            showMessage('logout-message', 'Erro ao sair.', 'error');
            return;
        }
        // Redirecionar para index após logout
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        showMessage('logout-message', 'Erro ao sair.', 'error');
    }
}

// Atualizar dados do usuário
async function updateUserProfile(userData) {
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: {
                name: userData.full_name,
                full_name: userData.full_name
            }
        });
        
        if (error) {
            console.error('Erro ao atualizar perfil:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        return false;
    }
}

// Mostrar mensagens
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        
        // Scroll para a mensagem se for erro
        if (type === 'error') {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Verificar confirmação de email na URL
function checkEmailConfirmation() {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const type = urlParams.get('type');
    const accessToken = urlParams.get('access_token');
    
    if (type === 'signup' && accessToken) {
        showMessage('login-message', 'Email confirmado com sucesso! Faça login.', 'success');
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Obter usuário atual
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Erro ao obter usuário:', error);
        return null;
    }
}

// Verificar se usuário está autenticado
async function isAuthenticated() {
    const user = await getCurrentUser();
    return user !== null;
}

// Recuperar senha
async function handlePasswordReset(email) {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: 'https://conexaoperfeitaamor.netlify.app/update-password.html',
        });
        
        if (error) {
            showMessage('reset-message', `Erro: ${error.message}`, 'error');
            return false;
        } else {
            showMessage('reset-message', 'E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success');
            return true;
        }
    } catch (error) {
        showMessage('reset-message', 'Erro ao enviar e-mail de recuperação.', 'error');
        return false;
    }
}

// Atualizar senha
async function handleUpdatePassword(newPassword) {
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) {
            showMessage('update-password-message', `Erro: ${error.message}`, 'error');
            return false;
        } else {
            showMessage('update-password-message', 'Senha atualizada com sucesso!', 'success');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
            return true;
        }
    } catch (error) {
        showMessage('update-password-message', 'Erro ao atualizar senha.', 'error');
        return false;
    }
}

// Event Listeners quando DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticação
    checkAuthState();
    
    // Verificar confirmação de email
    checkEmailConfirmation();
    
    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = loginForm.querySelector('input[type="email"]');
            const passwordInput = loginForm.querySelector('input[type="password"]');
            
            if (!emailInput || !passwordInput) {
                showMessage('login-message', 'Campos de email e senha não encontrados.', 'error');
                return;
            }
            
            const email = emailInput.value;
            const password = passwordInput.value;
            
            if (!email || !password) {
                showMessage('login-message', 'Por favor, preencha todos os campos.', 'error');
                return;
            }
            
            await handleLogin(email, password);
        });
    }
    
    // Register Form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nameInput = registerForm.querySelector('input[type="text"]');
            const emailInput = registerForm.querySelector('input[type="email"]');
            const passwordInput = registerForm.querySelector('input[type="password"]');
            const termsCheckbox = registerForm.querySelector('#terms');
            
            if (!nameInput || !emailInput || !passwordInput) {
                showMessage('register-message', 'Campos do formulário não encontrados.', 'error');
                return;
            }
            
            const name = nameInput.value;
            const email = emailInput.value;
            const password = passwordInput.value;
            
            if (!name || !email || !password) {
                showMessage('register-message', 'Por favor, preencha todos os campos.', 'error');
                return;
            }
            
            if (!termsCheckbox || !termsCheckbox.checked) {
                showMessage('register-message', 'Você precisa aceitar os termos de uso.', 'error');
                return;
            }
            
            if (password.length < 6) {
                showMessage('register-message', 'A senha deve ter pelo menos 6 caracteres.', 'error');
                return;
            }
            
            await handleRegister(name, email, password);
        });
    }
    
    // Password Reset Form
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = resetForm.querySelector('input[type="email"]');
            
            if (!emailInput) {
                showMessage('reset-message', 'Campo de email não encontrado.', 'error');
                return;
            }
            
            const email = emailInput.value;
            
            if (!email) {
                showMessage('reset-message', 'Por favor, informe seu e-mail.', 'error');
                return;
            }
            
            await handlePasswordReset(email);
        });
    }
    
    // Update Password Form
    const updatePasswordForm = document.getElementById('update-password-form');
    if (updatePasswordForm) {
        updatePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const passwordInput = updatePasswordForm.querySelector('input[type="password"]');
            
            if (!passwordInput) {
                showMessage('update-password-message', 'Campo de senha não encontrado.', 'error');
                return;
            }
            
            const newPassword = passwordInput.value;
            
            if (!newPassword) {
                showMessage('update-password-message', 'Por favor, informe a nova senha.', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showMessage('update-password-message', 'A senha deve ter pelo menos 6 caracteres.', 'error');
                return;
            }
            
            await handleUpdatePassword(newPassword);
        });
    }
    
    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Confirmação antes de sair
            if (confirm('Tem certeza que deseja sair?')) {
                handleLogout();
            }
        });
    }
    
    // Atualizar saudação se usuário estiver logado em qualquer página
    setTimeout(async () => {
        const user = await getCurrentUser();
        if (user) {
            updateUserInterface(user);
        }
    }, 100);
});

// Listener para mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Evento de autenticação:', event);
    
    if (event === 'SIGNED_IN' && session) {
        console.log('Usuário logado:', session.user.email);
        updateUserInterface(session.user);
        
        // Se estiver na página de login/cadastro, redirecionar para home
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'login.html' || currentPage === 'cadastro.html') {
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1000);
        }
    } else if (event === 'SIGNED_OUT') {
        console.log('Usuário deslogado');
        
        // Se estiver na home, redirecionar para index
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'home.html') {
            window.location.href = 'index.html';
        }
    } else if (event === 'PASSWORD_RECOVERY') {
        console.log('Recuperação de senha solicitada');
        window.location.href = 'update-password.html';
    } else if (event === 'USER_UPDATED') {
        console.log('Usuário atualizado');
    }
});

// Funções globais para uso em outras páginas
window.authUtils = {
    getCurrentUser,
    isAuthenticated,
    handleLogout,
    updateUserProfile,
    showMessage
};

console.log('✅ Auth.js carregado para Conexão Perfeita Amor!');