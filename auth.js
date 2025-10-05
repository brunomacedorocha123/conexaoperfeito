// auth.js - Sistema Corrigido com URLs do Netlify

// Configuração - URLs ABSOLUTAS do Netlify
const SITE_URL = 'https://conexaoperfeitaamor.netlify.app';
const REDIRECT_URL = 'https://conexaoperfeitaamor.netlify.app/home.html';
const PASSWORD_REDIRECT_URL = 'https://conexaoperfeitaamor.netlify.app/update-password.html';

// Verificar autenticação
async function checkAuthState() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        const currentPage = window.location.pathname.split('/').pop();
        
        if (error) {
            console.error('Erro ao verificar sessão:', error);
            return;
        }

        if (session) {
            // USUÁRIO LOGADO
            if (['login.html', 'cadastro.html', 'esqueci-senha.html', 'index.html', ''].includes(currentPage)) {
                window.location.href = 'home.html';
            }
            
            if (currentPage === 'home.html') {
                updateUserInterface(session.user);
            }
        } else {
            // USUÁRIO NÃO LOGADO
            if (currentPage === 'home.html') {
                window.location.href = 'index.html';
            }
        }
    } catch (error) {
        console.error('Erro no checkAuthState:', error);
    }
}

// Atualizar interface do usuário logado
function updateUserInterface(user) {
    const userName = user.user_metadata?.name || user.email || 'Usuário';
    const welcomeElement = document.getElementById('welcome-message');
    const userInfoElement = document.getElementById('user-info');
    
    if (welcomeElement) welcomeElement.textContent = `Bem-vindo, ${userName}!`;
    if (userInfoElement) userInfoElement.textContent = `Email: ${user.email}`;
    
    const userNameElement = document.getElementById('user-name');
    const userWelcomeElement = document.getElementById('user-welcome');
    if (userNameElement && userWelcomeElement) {
        userNameElement.textContent = userName;
        userWelcomeElement.style.display = 'block';
    }
}

// Cadastro PROFISSIONAL - COM URL CORRETA
async function handleRegister(formData) {
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn ? submitBtn.textContent : 'Criar Minha Conta';
    
    try {
        // Validar dados
        const errors = validateRegisterData(formData);
        if (errors.length > 0) {
            showMessage('register-message', errors.join('<br>'), 'error');
            return false;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Criando conta...';
        }

        showMessage('register-message', 'Criando sua conta...', 'success');

        // CADASTRO COM URL ABSOLUTA DO NETLIFY
        const { data, error } = await supabase.auth.signUp({
            email: formData.email.trim(),
            password: formData.password,
            options: {
                data: {
                    name: formData.name.trim(),
                    full_name: formData.name.trim(),
                    birth_date: formData.birthDate,
                    gender: formData.gender,
                    interested_in: formData.interestedIn
                },
                // URL ABSOLUTA - CORRIGIDA
                emailRedirectTo: REDIRECT_URL
            }
        });

        if (error) {
            throw new Error(getAuthErrorMessage(error));
        }

        // Verificar se usuário já existe
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            showMessage('register-message', 
                'Este e-mail já está cadastrado. <a href="login.html">Faça login aqui</a>.', 
                'error'
            );
            return false;
        }

        // SUCESSO
        showMessage('register-message', 
            `✅ <strong>Cadastro realizado com sucesso!</strong><br><br>
            Enviamos um e-mail de confirmação para <strong>${formData.email}</strong>.<br>
            <strong>Verifique sua caixa de entrada</strong> e clique no link para ativar sua conta.<br><br>
            💡 <em>Dica: Verifique também sua pasta de spam.</em>`, 
            'success'
        );

        const registerForm = document.getElementById('register-form');
        if (registerForm) registerForm.reset();

        return true;

    } catch (error) {
        showMessage('register-message', error.message, 'error');
        return false;
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// Login PROFISSIONAL
async function handleLogin(email, password) {
    const loginBtn = document.getElementById('login-btn');
    const originalText = loginBtn ? loginBtn.textContent : 'Entrar na Minha Conta';
    
    try {
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Entrando...';
        }

        showMessage('login-message', 'Verificando credenciais...', 'success');

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) {
            throw new Error(getAuthErrorMessage(error));
        }

        // Verificar se email foi confirmado
        if (data.user && !data.user.email_confirmed_at) {
            showMessage('login-message', 
                `❌ <strong>E-mail não confirmado</strong><br><br>
                Verifique sua caixa de entrada e confirme seu e-mail para fazer login.<br>
                <br>
                <strong>Dica:</strong> Verifique também sua pasta de spam/lixo eletrônico.`, 
                'error'
            );
            await supabase.auth.signOut();
            return false;
        }

        // SUCESSO
        showMessage('login-message', '✅ Login realizado com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 1500);

        return true;

    } catch (error) {
        showMessage('login-message', error.message, 'error');
        return false;
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
        }
    }
}

// Recuperação de senha - COM URL CORRETA
async function handlePasswordReset(email) {
    try {
        showMessage('reset-message', 'Enviando link de recuperação...', 'success');
        
        // URL ABSOLUTA - CORRIGIDA
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: PASSWORD_REDIRECT_URL,
        });
        
        if (error) {
            throw new Error(getAuthErrorMessage(error));
        }
        
        showMessage('reset-message', 
            '✅ E-mail de recuperação enviado! Verifique sua caixa de entrada.', 
            'success'
        );
        return true;
    } catch (error) {
        showMessage('reset-message', error.message, 'error');
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
        console.error('Erro no logout:', error);
        showMessage('logout-message', '❌ Erro ao sair', 'error');
    }
}

// Funções de validação (mantidas iguais)
function validateRegisterData(formData) {
    const errors = [];

    if (!formData.name || formData.name.trim().length < 2) {
        errors.push('• Nome deve ter pelo menos 2 caracteres');
    }

    if (!formData.email || !isValidEmail(formData.email)) {
        errors.push('• E-mail inválido');
    }

    if (!formData.password || formData.password.length < 6) {
        errors.push('• Senha deve ter pelo menos 6 caracteres');
    }

    if (formData.password !== formData.confirmPassword) {
        errors.push('• As senhas não coincidem');
    }

    if (!formData.birthDate) {
        errors.push('• Data de nascimento é obrigatória');
    } else {
        const birthDate = new Date(formData.birthDate);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        if (age < 18) {
            errors.push('• Você deve ter 18 anos ou mais');
        }
    }

    if (!formData.gender) {
        errors.push('• Gênero é obrigatório');
    }

    if (!formData.interestedIn) {
        errors.push('• Interesse é obrigatório');
    }

    if (!formData.termsAccepted) {
        errors.push('• Você deve aceitar os termos de uso');
    }

    if (!formData.ageConfirmed) {
        errors.push('• Você deve confirmar que tem 18 anos ou mais');
    }

    return errors;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function getAuthErrorMessage(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid login credentials')) {
        return '❌ E-mail ou senha incorretos';
    } else if (message.includes('email not confirmed')) {
        return '❌ E-mail não confirmado. Verifique sua caixa de entrada.';
    } else if (message.includes('user already registered') || message.includes('already registered')) {
        return '❌ Este e-mail já está cadastrado';
    } else if (message.includes('password should be at least')) {
        return '❌ A senha deve ter pelo menos 6 caracteres';
    } else if (message.includes('invalid email')) {
        return '❌ E-mail inválido';
    } else if (message.includes('rate limit')) {
        return '❌ Muitas tentativas. Tente novamente em alguns minutos.';
    } else {
        return `❌ Erro: ${error.message}`;
    }
}

// Mostrar mensagens
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        if (type === 'success') {
            setTimeout(() => {
                element.style.display = 'none';
            }, 8000);
        }
    }
}

// Event Listeners (mantidos iguais)
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = loginForm.querySelector('input[type="email"]');
            const passwordInput = loginForm.querySelector('input[type="password"]');
            
            const email = emailInput ? emailInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            
            if (!email || !password) {
                showMessage('login-message', '❌ Preencha todos os campos', 'error');
                return;
            }

            await handleLogin(email, password);
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: registerForm.querySelector('input[type="text"]').value,
                email: registerForm.querySelector('input[type="email"]').value,
                password: registerForm.querySelectorAll('input[type="password"]')[0].value,
                confirmPassword: registerForm.querySelectorAll('input[type="password"]')[1].value,
                birthDate: registerForm.querySelector('input[type="date"]').value,
                gender: registerForm.querySelector('select').value,
                interestedIn: registerForm.querySelectorAll('select')[1].value,
                termsAccepted: registerForm.querySelector('#terms').checked,
                ageConfirmed: registerForm.querySelector('#age').checked
            };

            await handleRegister(formData);
        });
    }

    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = resetForm.querySelector('input[type="email"]');
            const email = emailInput ? emailInput.value : '';
            
            if (!email) {
                showMessage('reset-message', '❌ Informe seu e-mail', 'error');
                return;
            }

            await handlePasswordReset(email);
        });
    }

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

// Auth State Listener
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event);
    
    if (event === 'SIGNED_IN' && session) {
        console.log('Usuário logado:', session.user.email);
        updateUserInterface(session.user);
        
        const currentPage = window.location.pathname.split('/').pop();
        if (['login.html', 'cadastro.html', 'esqueci-senha.html'].includes(currentPage)) {
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1000);
        }
    } else if (event === 'SIGNED_OUT') {
        console.log('Usuário deslogado');
    }
});

console.log('✅ Auth.js carregado - URLs do Netlify configuradas');