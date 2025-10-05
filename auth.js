// auth.js - Sistema de Autenticação para Conexão Perfeita Amor

// Verificar autenticação e redirecionar
async function checkAuthState() {
    try {
        const { data } = await supabase.auth.getSession();
        const currentPage = window.location.pathname.split('/').pop();
        
        if (data.session) {
            // USUÁRIO LOGADO - Redirecionar se estiver em páginas de auth
            if (currentPage === 'login.html' || currentPage === 'cadastro.html' || currentPage === 'esqueci-senha.html') {
                window.location.href = 'home.html';
            }
            // Atualizar interface se estiver na home
            if (currentPage === 'home.html') {
                updateUserInterface(data.session.user);
            }
        } else {
            // USUÁRIO NÃO LOGADO - Redirecionar se tentar acessar home
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
    
    if (welcomeElement) welcomeElement.textContent = `Bem-vindo, ${userName}!`;
    if (userInfoElement) userInfoElement.textContent = `Email: ${user.email}`;
    
    // Atualizar saudação no header
    const userNameElement = document.getElementById('user-name');
    const userWelcomeElement = document.getElementById('user-welcome');
    if (userNameElement && userWelcomeElement) {
        userNameElement.textContent = userName;
        userWelcomeElement.style.display = 'block';
    }
}

// Login
async function handleLogin(email, password, rememberMe = false) {
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
            setTimeout(() => window.location.href = 'home.html', 1500);
            return true;
        }
    } catch (error) {
        showMessage('login-message', 'Erro inesperado ao fazer login.', 'error');
        return false;
    }
}

// Cadastro
async function handleRegister(name, email, password, confirmPassword) {
    try {
        // Validar senhas
        if (password !== confirmPassword) {
            showMessage('register-message', 'As senhas não coincidem.', 'error');
            return false;
        }
        
        if (password.length < 6) {
            showMessage('register-message', 'A senha deve ter pelo menos 6 caracteres.', 'error');
            return false;
        }
        
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
            if (error.message.includes('already registered') || error.message.includes('user already exists')) {
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
            // Verificar se o usuário já existe
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                showMessage('register-message', 'Este e-mail já está cadastrado. Faça login.', 'error');
                return false;
            }
            
            // Sucesso - NÃO REDIRECIONA AUTOMATICAMENTE
            showMessage('register-message', 
                '🎉 Cadastro realizado com sucesso!<br><br>Enviamos um e-mail de confirmação para você.<br>Verifique sua caixa de entrada e clique no link para ativar sua conta.<br><br>Após a confirmação, você poderá fazer login.', 
                'success'
            );
            
            // Limpar formulário
            const registerForm = document.getElementById('register-form');
            if (registerForm) registerForm.reset();
            
            return true;
        }
    } catch (error) {
        showMessage('register-message', 'Erro inesperado no cadastro.', 'error');
        return false;
    }
}

// Recuperação de Senha
async function handlePasswordReset(email) {
    try {
        showMessage('reset-message', 'Enviando link de recuperação...', 'success');
        
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: 'https://conexaoperfeitaamor.netlify.app/update-password.html',
        });
        
        if (error) {
            showMessage('reset-message', `Erro: ${error.message}`, 'error');
            return false;
        } else {
            showMessage('reset-message', 
                '📧 E-mail enviado com sucesso!<br><br>Verifique sua caixa de entrada e clique no link para redefinir sua senha.', 
                'success'
            );
            return true;
        }
    } catch (error) {
        showMessage('reset-message', 'Erro ao enviar e-mail de recuperação.', 'error');
        return false;
    }
}

// Logout
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        showMessage('logout-message', 'Erro ao sair.', 'error');
    }
}

// Mostrar mensagens
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = message; // Usar innerHTML para permitir <br>
        element.className = `message ${type}`;
        element.style.display = 'block';
        
        // Scroll para a mensagem
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Auto-esconder apenas mensagens de sucesso
        if (type === 'success') {
            setTimeout(() => {
                element.style.display = 'none';
            }, 10000); // 10 segundos para mensagens de sucesso
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    
    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;
            const rememberMe = loginForm.querySelector('#remember')?.checked || false;
            
            if (!email || !password) {
                showMessage('login-message', 'Por favor, preencha todos os campos.', 'error');
                return;
            }
            
            await handleLogin(email, password, rememberMe);
        });
    }
    
    // Register Form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = registerForm.querySelector('input[type="text"]').value;
            const email = registerForm.querySelector('input[type="email"]').value;
            const password = registerForm.querySelectorAll('input[type="password"]')[0].value;
            const confirmPassword = registerForm.querySelectorAll('input[type="password"]')[1].value;
            const terms = registerForm.querySelector('#terms');
            
            if (!name || !email || !password || !confirmPassword) {
                showMessage('register-message', 'Por favor, preencha todos os campos.', 'error');
                return;
            }
            
            if (!terms?.checked) {
                showMessage('register-message', 'Você precisa aceitar os termos de uso.', 'error');
                return;
            }
            
            await handleRegister(name, email, password, confirmPassword);
        });
    }
    
    // Reset Password Form
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = resetForm.querySelector('input[type="email"]').value;
            
            if (!email) {
                showMessage('reset-message', 'Por favor, informe seu e-mail.', 'error');
                return;
            }
            
            await handlePasswordReset(email);
        });
    }
    
    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Tem certeza que deseja sair?')) {
                handleLogout();
            }
        });
    }
});

// Listener para mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Evento de autenticação:', event);
    
    if (event === 'SIGNED_IN' && session) {
        console.log('Usuário logado:', session.user.email);
        updateUserInterface(session.user);
    }
});

console.log('✅ Auth.js carregado - Conexão Perfeita Amor');