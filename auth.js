// auth.js - SISTEMA COM VERIFICAÇÃO DE EMAIL

const SITE_URL = 'https://conexaoperfeitaamor.netlify.app';

async function checkAuthState() {
    const { data } = await supabase.auth.getSession();
    const page = window.location.pathname.split('/').pop();
    
    if (data.session && ['login.html', 'cadastro.html', 'esqueci-senha.html'].includes(page)) {
        window.location.href = 'home.html';
    }
    if (!data.session && page === 'home.html') {
        window.location.href = 'index.html';
    }
}

// CADASTRO COM VERIFICAÇÃO DE EMAIL
async function handleRegister(formData) {
    const btn = document.getElementById('submit-btn');
    const originalText = btn.textContent;
    
    try {
        btn.disabled = true;
        btn.textContent = 'Criando conta...';

        // VALIDAÇÃO
        if (!formData.name || !formData.email || !formData.password) {
            alert('Preencha todos os campos');
            return false;
        }

        if (formData.password.length < 6) {
            alert('Senha deve ter pelo menos 6 caracteres');
            return false;
        }

        console.log('📧 Enviando cadastro para:', formData.email);

        // CADASTRO COM VERIFICAÇÃO
        const { data, error } = await supabase.auth.signUp({
            email: formData.email.trim(),
            password: formData.password,
            options: {
                data: { 
                    name: formData.name.trim(),
                    full_name: formData.name.trim()
                },
                emailRedirectTo: `${SITE_URL}/home.html`
            }
        });

        if (error) {
            console.error('❌ Erro no cadastro:', error);
            
            if (error.message.includes('User already registered')) {
                alert('📧 Este e-mail já está cadastrado.\n\nVerifique sua caixa de entrada - você deve ter recebido um email de confirmação anteriormente.\n\nSe não encontrou, verifique a pasta de SPAM.');
            } else {
                alert('❌ Erro: ' + error.message);
            }
            return false;
        }

        console.log('✅ Resposta do Supabase:', data);

        // VERIFICAR SE USUÁRIO FOI CRIADO
        if (data.user) {
            if (data.user.identities && data.user.identities.length === 0) {
                alert('📧 Este e-mail já está cadastrado.\n\nVerifique sua caixa de entrada para o email de confirmação.');
                return false;
            }

            // CRIAR PERFIL NA TABELA SQL
            try {
                await supabase.from('user_profiles').insert({
                    user_id: data.user.id,
                    full_name: formData.name,
                    birth_date: formData.birthDate,
                    gender: formData.gender,
                    interested_in: formData.interestedIn
                });
                console.log('✅ Perfil criado na tabela SQL');
            } catch (profileError) {
                console.error('⚠️ Erro ao criar perfil:', profileError);
                // Continua mesmo com erro no perfil
            }

            // SUCESSO - EMAIL ENVIADO
            alert(`✅ CADASTRO REALIZADO COM SUCESSO!

📧 Enviamos um email de confirmação para:
${formData.email}

🔍 PARA ATIVAR SUA CONTA:
1. Verifique sua CAIXA DE ENTRADA
2. Procure pelo email da "Conexão Perfeita Amor"
3. Clique no LINK DE CONFIRMAÇÃO
4. Volte aqui e faça LOGIN

💡 DICA: Verifique também a pasta de SPAM/LIXO ELETRÔNICO

Após confirmar, use:
Email: ${formData.email}
Senha: ${'*'.repeat(formData.password.length)}`);

            // Limpar formulário
            document.getElementById('register-form').reset();
            return true;
        }

    } catch (error) {
        console.error('💥 Erro completo:', error);
        alert('❌ Erro inesperado. Tente novamente.');
        return false;
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// LOGIN EXIGINDO EMAIL CONFIRMADO
async function handleLogin(email, password) {
    const btn = document.getElementById('login-btn');
    const originalText = btn ? btn.textContent : 'Entrar';
    
    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Entrando...';
        }

        console.log('🔐 Tentando login:', email);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                alert(`❌ EMAIL NÃO CONFIRMADO

Para fazer login, você precisa confirmar seu email primeiro.

📧 Verifique sua caixa de entrada:
${email}

💡 Não encontrou? Verifique a pasta de SPAM.

Se não recebeu o email, tente se cadastrar novamente.`);
            } else if (error.message.includes('Invalid login credentials')) {
                alert('❌ Email ou senha incorretos');
            } else {
                alert('❌ Erro: ' + error.message);
            }
            return false;
        }

        // VERIFICAR SE EMAIL ESTÁ CONFIRMADO
        if (data.user && !data.user.email_confirmed_at) {
            alert(`❌ EMAIL AINDA NÃO CONFIRMADO

Confirme seu email antes de fazer login.

Verifique: ${email}
(Incluindo pasta de SPAM)`);
            await supabase.auth.signOut();
            return false;
        }

        // SUCESSO - LOGIN PERMITIDO
        console.log('✅ Login bem-sucedido:', data.user.email);
        alert('✅ Login realizado com sucesso!');
        window.location.href = 'home.html';
        return true;

    } catch (error) {
        console.error('💥 Erro no login:', error);
        alert('❌ Erro no login');
        return false;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

// LOGOUT
async function handleLogout() {
    try {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro no logout:', error);
    }
}

// EVENT LISTENERS
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();

    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;
            await handleLogin(email, password);
        });
    }

    // Cadastro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                name: registerForm.querySelector('input[type="text"]').value,
                email: registerForm.querySelector('input[type="email"]').value,
                password: registerForm.querySelectorAll('input[type="password"]')[0].value,
                birthDate: registerForm.querySelector('input[type="date"]').value,
                gender: registerForm.querySelector('select').value,
                interestedIn: registerForm.querySelectorAll('select')[1].value
            };
            await handleRegister(formData);
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Sair da conta?')) {
                handleLogout();
            }
        });
    }
});

// LISTENER PARA MUDANÇAS DE AUTENTICAÇÃO
supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Evento Auth:', event);
    if (event === 'SIGNED_IN') {
        console.log('✅ Usuário logado:', session.user.email);
    }
});

console.log('✅ Sistema carregado - VERIFICAÇÃO DE EMAIL ATIVA');