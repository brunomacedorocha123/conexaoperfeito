// auth.js - SISTEMA COM VERIFICAÇÃO DE EMAIL FUNCIONANDO

const SITE_URL = 'https://conexaoperfeitaamor.netlify.app';

// Verificar autenticação
async function checkAuthState() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        const currentPage = window.location.pathname.split('/').pop();
        
        if (error) {
            console.error('Erro ao verificar sessão:', error);
            return;
        }

        console.log('🔐 Estado da autenticação:', session ? 'LOGADO' : 'NÃO LOGADO');

        if (session) {
            if (['login.html', 'cadastro.html', 'esqueci-senha.html', 'index.html', ''].includes(currentPage)) {
                window.location.href = 'home.html';
            }
            
            if (currentPage === 'home.html') {
                await updateUserInterface(session.user);
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

// CADASTRO COM VERIFICAÇÃO DE EMAIL REAL
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

        showMessage('register-message', 'Criando sua conta e enviando e-mail de confirmação...', 'success');

        console.log('📝 Iniciando cadastro para:', formData.email);
        console.log('🔗 URL de redirecionamento:', `${SITE_URL}/home.html`);

        // CADASTRO COM VERIFICAÇÃO DE EMAIL
        const { data: authData, error: authError } = await supabase.auth.signUp({
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
                emailRedirectTo: `${SITE_URL}/home.html`
            }
        });

        if (authError) {
            console.error('❌ Erro no Auth:', authError);
            
            if (authError.message.includes('User already registered')) {
                showMessage('register-message', 
                    '❌ Este e-mail já está cadastrado.<br>Verifique sua caixa de entrada - você deve ter recebido um e-mail de confirmação anteriormente.', 
                    'error'
                );
            } else {
                showMessage('register-message', `❌ Erro: ${getAuthErrorMessage(authError)}`, 'error');
            }
            return false;
        }

        console.log('✅ Resposta do Auth:', authData);

        // Verificar se é usuário novo
        if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
            showMessage('register-message', 
                '❌ Este e-mail já está cadastrado. Verifique sua caixa de entrada para o e-mail de confirmação.', 
                'error'
            );
            return false;
        }

        // CRIAR PERFIL NA TABELA SQL (se usuário for novo)
        if (authData.user && authData.user.identities && authData.user.identities.length > 0) {
            try {
                const { error: profileError } = await supabase
                    .from('user_profiles')
                    .insert({
                        user_id: authData.user.id,
                        full_name: formData.name.trim(),
                        birth_date: formData.birthDate,
                        gender: formData.gender,
                        interested_in: formData.interestedIn,
                        location: formData.location || '',
                        bio: formData.bio || ''
                    });

                if (profileError) {
                    console.error('⚠️ Erro ao criar perfil:', profileError);
                } else {
                    console.log('✅ Perfil criado na tabela SQL');
                }
            } catch (profileError) {
                console.error('⚠️ Erro ao criar perfil:', profileError);
            }
        }

        // VERIFICAR SE O EMAIL FOI ENVIADO
        if (authData.user) {
            if (authData.user.email_confirmed_at) {
                // Caso raro: email já confirmado
                showMessage('register-message', 
                    '✅ <strong>Cadastro realizado com sucesso!</strong><br><br>Seu e-mail já está confirmado.<br>Redirecionando...', 
                    'success'
                );
                
                // Fazer login automático
                setTimeout(async () => {
                    const { error: loginError } = await supabase.auth.signInWithPassword({
                        email: formData.email.trim(),
                        password: formData.password
                    });
                    
                    if (!loginError) {
                        window.location.href = 'home.html';
                    }
                }, 2000);
                
            } else {
                // CASO NORMAL: Email de confirmação enviado
                showMessage('register-message', 
                    `✅ <strong>Cadastro realizado com sucesso!</strong><br><br>
                    
                    📧 <strong>ENVIAMOS UM E-MAIL DE CONFIRMAÇÃO PARA:</strong><br>
                    <strong style="color: #e91e63;">${formData.email}</strong><br><br>
                    
                    🔍 <strong>PARA ATIVAR SUA CONTA:</strong><br>
                    1. <strong>Abra sua caixa de entrada</strong><br>
                    2. <strong>Procure pelo e-mail da "Conexão Perfeita Amor"</strong><br>
                    3. <strong>Clique no link de confirmação</strong><br>
                    4. <strong>Volte aqui e faça login</strong><br><br>
                    
                    ⚠️ <strong>IMPORTANTE:</strong><br>
                    • Verifique a <strong>pasta de SPAM</strong> ou <strong>lixo eletrônico</strong><br>
                    • O link expira em 24 horas<br>
                    • Use a mesma senha que cadastrou<br><br>
                    
                    💡 <strong>Não recebeu o e-mail?</strong><br>
                    • Aguarde alguns minutos<br>
                    • Verifique o e-mail digitado: <strong>${formData.email}</strong><br>
                    • Tente reenviar o e-mail de confirmação<br><br>
                    
                    <div style="text-align: center; margin-top: 1rem;">
                        <a href="login.html" class="btn-primary" style="display: inline-block;">
                            📝 Fazer Login Após Confirmar
                        </a>
                    </div>`, 
                    'success'
                );
            }
        }

        // Limpar formulário
        const registerForm = document.getElementById('register-form');
        if (registerForm) registerForm.reset();

        return true;

    } catch (error) {
        console.error('💥 Erro completo no cadastro:', error);
        showMessage('register-message', 
            '❌ Erro inesperado no cadastro. Por favor, tente novamente.', 
            'error'
        );
        return false;
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// LOGIN EXIGINDO EMAIL CONFIRMADO
async function handleLogin(email, password) {
    const loginBtn = document.getElementById('login-btn');
    const originalText = loginBtn ? loginBtn.textContent : 'Entrar na Minha Conta';
    
    try {
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Entrando...';
        }

        showMessage('login-message', 'Verificando suas credenciais...', 'success');

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) {
            throw new Error(getAuthErrorMessage(error));
        }

        // VERIFICAÇÃO STRICT: Exigir email confirmado
        if (data.user && !data.user.email_confirmed_at) {
            showMessage('login-message', 
                `❌ <strong>E-MAIL NÃO CONFIRMADO</strong><br><br>
                
                📧 <strong>Para fazer login, você precisa confirmar seu e-mail primeiro.</strong><br><br>
                
                🔍 <strong>O QUE FAZER:</strong><br>
                1. <strong>Verifique sua caixa de entrada:</strong><br>
                   <strong style="color: #e91e63;">${email}</strong><br>
                2. <strong>Procure pelo e-mail da "Conexão Perfeita Amor"</strong><br>
                3. <strong>Clique no link de confirmação</strong><br>
                4. <strong>Volte aqui e faça login novamente</strong><br><br>
                
                ⚠️ <strong>Não encontrou o e-mail?</strong><br>
                • Verifique a <strong>pasta de SPAM</strong><br>
                • Aguarde alguns minutos<br>
                • Certifique-se de que digitou o e-mail correto<br><br>
                
                <div style="text-align: center;">
                    <button onclick="resendConfirmationEmail('${email}')" class="btn-secondary" style="margin: 0.5rem;">
                        📧 Reenviar E-mail de Confirmação
                    </button>
                    <br>
                    <a href="cadastro.html" style="color: #e91e63; font-weight: bold;">
                        🔄 Tentar com outro e-mail
                    </a>
                </div>`, 
                'error'
            );
            
            // Fazer logout para garantir segurança
            await supabase.auth.signOut();
            return false;
        }

        // SUCESSO - EMAIL CONFIRMADO
        showMessage('login-message', 
            '✅ <strong>Login realizado com sucesso!</strong><br><br>Redirecionando para sua conta...', 
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

// REENVIAR EMAIL DE CONFIRMAÇÃO
async function resendConfirmationEmail(email) {
    try {
        showMessage('login-message', '📧 Reenviando e-mail de confirmação...', 'success');
        
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim(),
            options: {
                emailRedirectTo: `${SITE_URL}/home.html`
            }
        });

        if (error) {
            throw new Error('Erro ao reenviar e-mail: ' + error.message);
        }

        showMessage('login-message', 
            `✅ <strong>E-mail reenviado com sucesso!</strong><br><br>
            📧 Enviamos um novo e-mail de confirmação para:<br>
            <strong style="color: #e91e63;">${email}</strong><br><br>
            Verifique sua caixa de entrada e pasta de spam.`, 
            'success'
        );
        
    } catch (error) {
        showMessage('login-message', error.message, 'error');
    }
}

// Funções auxiliares (manter iguais)
async function updateUserInterface(user) {
    try {
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

        await loadUserProfile(user.id);
        
    } catch (error) {
        console.error('Erro ao atualizar interface:', error);
    }
}

async function loadUserProfile(userId) {
    try {
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao carregar perfil:', error);
        }

        return profile;
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        return null;
    }
}

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

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Tornar função global para o botão de reenvio
window.resendConfirmationEmail = resendConfirmationEmail;

// Event Listeners
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
                location: registerForm.querySelector('input[type="text"]').value,
                bio: registerForm.querySelector('textarea')?.value || '',
                termsAccepted: registerForm.querySelector('#terms').checked,
                ageConfirmed: registerForm.querySelector('#age').checked
            };

            await handleRegister(formData);
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Tem certeza que deseja sair?')) {
                supabase.auth.signOut().then(() => {
                    window.location.href = 'index.html';
                });
            }
        });
    }
});

// Auth State Listener
supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Evento de autenticação:', event);
    
    if (event === 'SIGNED_IN' && session) {
        console.log('✅ Usuário logado:', session.user.email);
        updateUserInterface(session.user);
    }
});

console.log('✅ Sistema carregado - VERIFICAÇÃO DE EMAIL ATIVA');