// auth.js - SISTEMA LIMPO E FUNCIONAL
const SITE_URL = 'https://conexaoperfeitaamor.netlify.app';

// Verificar autenticação
async function checkAuthState() {
    const { data } = await supabase.auth.getSession();
    const page = window.location.pathname.split('/').pop();
    
    if (data.session && ['login.html', 'cadastro.html'].includes(page)) {
        window.location.href = 'home.html';
    }
    if (!data.session && page === 'home.html') {
        window.location.href = 'index.html';
    }
}

// Cadastro DIRETO
async function handleRegister(formData) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: { name: formData.name },
                emailRedirectTo: `${SITE_URL}/home.html`
            }
        });

        if (error) {
            alert('Erro: ' + error.message);
            return false;
        }

        if (data.user) {
            // Criar perfil na tabela
            await supabase.from('user_profiles').insert({
                user_id: data.user.id,
                full_name: formData.name,
                birth_date: formData.birthDate,
                gender: formData.gender,
                interested_in: formData.interestedIn
            });

            alert('Cadastro feito! Verifique seu email.');
            return true;
        }
    } catch (error) {
        alert('Erro no cadastro');
        return false;
    }
}

// Login DIRETO
async function handleLogin(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            alert('Erro: ' + error.message);
            return false;
        }

        window.location.href = 'home.html';
        return true;
    } catch (error) {
        alert('Erro no login');
        return false;
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;
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
                birthDate: registerForm.querySelector('input[type="date"]').value,
                gender: registerForm.querySelector('select').value,
                interestedIn: registerForm.querySelectorAll('select')[1].value
            };
            await handleRegister(formData);
        });
    }
});