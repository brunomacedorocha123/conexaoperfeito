// auth.js - SISTEMA COMPLETO COM SQL INTEGRADO

// Configuração
const PRODUCTION_URL = 'https://conexaoperfeitaamor.netlify.app';
const REDIRECT_URL = `${PRODUCTION_URL}/home.html`;

console.log('🔧 Sistema com SQL - Conexão Perfeita Amor');

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
            if (['login.html', 'cadastro.html', 'esqueci-senha.html', 'index.html', ''].includes(currentPage)) {
                window.location.href = 'home.html';
            }
            
            if (currentPage === 'home.html') {
                updateUserInterface(session.user);
            }
        } else {
            if (currentPage === 'home.html') {
                window.location.href = 'index.html';
            }
        }
    } catch (error) {
        console.error('Erro no checkAuthState:', error);
    }
}

// Atualizar interface do usuário logado
async function updateUserInterface(user) {
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

    // Carregar dados do perfil da tabela SQL
    await loadUserProfile(user.id);
}

// Carregar perfil do usuário da tabela SQL
async function loadUserProfile(userId) {
    try {
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = nenhum resultado
            console.error('Erro ao carregar perfil:', error);
            return;
        }

        if (profile) {
            console.log('📊 Perfil carregado:', profile);
            // Aqui você pode usar os dados do perfil na interface
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

// CADASTRO COMPLETO COM SQL
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

        console.log('📝 Iniciando cadastro para:', formData.email);

        // PASSO 1: Criar usuário no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email.trim(),
            password: formData.password,
            options: {
                data: {
                    name: formData.name.trim()
                },
                emailRedirectTo: REDIRECT_URL
            }
        });

        if (authError) {
            console.error('❌ Erro no Auth:', authError);
            
            if (authError.message.includes('User already registered')) {
                showMessage('register-message', 
                    '❌ Este e-mail já está cadastrado. <a href="login.html">Faça login aqui</a>.', 
                    'error'
                );
            } else {
                throw new Error(getAuthErrorMessage(authError));
            }
            return false;
        }

        console.log('✅ Usuário Auth criado:', authData.user);

        // Verificar se é usuário novo
        if (authData.user.identities && authData.user.identities.length === 0) {
            showMessage('register-message', 
                '❌ Este e-mail já está cadastrado. <a href="login.html">Faça login aqui</a>.', 
                'error'
            );
            return false;
        }

        // PASSO 2: Criar perfil na tabela SQL (APENAS se usuário for novo)
        if (authData.user.identities && authData.user.identities.length > 0) {
            console.log('💾 Criando perfil na tabela SQL...');
            
            const { data: profileData, error: profileError } = await supabase
                .from('user_profiles')
                .insert([
                    {
                        user_id: authData.user.id,
                        full_name: formData.name.trim(),
                        birth_date: formData.birthDate,
                        gender: formData.gender,
                        interested_in: formData.interestedIn
                    }
                ])
                .select();

            if (profileError) {
                console.error('❌ Erro ao criar perfil SQL:', profileError);
                
                // Se der erro no perfil, deletar o usuário do Auth para evitar inconsistência
                await supabase.auth.admin.deleteUser(authData.user.id);
                
                throw new Error('Erro ao criar perfil. Tente novamente.');
            }

            console.log('✅ Perfil SQL criado:', profileData);
        }

        // SUCESSO
        if (authData.user.email_confirmed_at) {
            showMessage('register-message', 
                '✅ <strong>Cadastro realizado com sucesso!</strong><br><br>Sua conta foi criada e confirmada.<br>Redirecionando...', 
                'success'
            );
            
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
        } else {
            showMessage('register-message', 
                `✅ <strong>Cadastro realizado com sucesso!</strong><br><br>
                📧 <strong>Enviamos um e-mail de confirmação para:</strong><br>
                <strong>${formData.email}</strong><br><br>
                
                🔍 <strong>Para ativar sua conta:</strong><br>
                1. Verifique sua caixa de entrada<br>
                2. Clique no link de confirmação<br>
                3. Faça login com seu e-mail e senha<br><br>
                
                💡 <strong>Dica importante:</strong><br>
                • Verifique a pasta de spam<br>
                • Use a mesma senha que cadastrou<br><br>
                
                <a href="login.html" style="color: #e91e63; font-weight: bold;">→ Fazer login após confirmar</a>`, 
                'success'
            );
        }

        // Limpar formulário
        const registerForm = document.getElementById('register-form');
        if (registerForm) registerForm.reset();

        return true;

    } catch (error) {
        console.error('💥 Erro completo no cadastro:', error);
        showMessage('register-message', error.message, 'error');
        return false;
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// LOGIN VERIFICANDO SQL
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
                Confirme seu e-mail para fazer login.<br>
                Verifique sua caixa de entrada: <strong>${email}</strong>`, 
                'error'
            );
            await supabase.auth.signOut();
            return false;
        }

        // Verificar se existe perfil na tabela SQL
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', data.user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Erro ao verificar perfil:', profileError);
        }

        if (!profile) {
            console.log('⚠️  Usuário sem perfil na tabela SQL');
        }

        // SUCESSO
        showMessage('login-message', 
            '✅ <strong>Login realizado com sucesso!</strong><br><br>Redirecionando...', 
            'success'
        );
        
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);

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

// RECUPERAÇÃO DE SENHA
async function handlePasswordReset(email) {
    const resetBtn = document.getElementById('reset-btn');
    const originalText = resetBtn ? resetBtn.textContent : 'Enviar Link de Recuperação';
    
    try {
        if (resetBtn) {
            resetBtn.disabled = true;
            resetBtn.textContent = 'Enviando...';
        }

        showMessage('reset-message', 'Enviando link de recuperação...', 'success');
        
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${PRODUCTION_URL}/update-password.html`,
        });
        
        if (error) {
            throw new Error(getAuthErrorMessage(error));
        }
        
        showMessage('reset-message', 
            `✅ <strong>E-mail de recuperação enviado!</strong><br><br>
            Enviamos as instruções para: <strong>${email}</strong><br>
            Verifique sua caixa de entrada.`, 
            'success'
        );
        return true;
    } catch (error) {
        showMessage('reset-message', error.message, 'error');
        return false;
    } finally {
        if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.textContent = originalText;
        }
    }
}

// FUNÇÕES DE VALIDAÇÃO (mantidas iguais)
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
    } else if (message.includes('user already registered')) {
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

// MOSTRAR MENSAGENS
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// EVENT LISTENERS
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();

    // Login Form
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

    // Register Form
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

    // Reset Password Form
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

    // Logout
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

// AUTH STATE LISTENER
supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Evento de autenticação:', event);
    
    if (event === 'SIGNED_IN' && session) {
        console.log('✅ Usuário logado:', session.user.email);
        updateUserInterface(session.user);
    } else if (event === 'SIGNED_OUT') {
        console.log('👋 Usuário deslogado');
    }
});

console.log('✅ Sistema com SQL carregado - PRONTO!');