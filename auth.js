// auth.js - VERSÃO QUE FUNCIONA COM EMAIL
console.log('🚀 auth.js carregado!');

const SUPABASE_URL = 'https://ivposfgebabrtpexxpko.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cG9zZmdlYmFicnRwZXh4cGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODczMzEsImV4cCI6MjA3NTE2MzMzMX0.AJU3Vt2dqATDORS4mjTW3gDWeh1MK9lNTWk-uoG5ojo';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Funções
function isOver18(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age >= 18;
}

function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 5000);
}

// CADASTRO - COM EMAIL DE CONFIRMAÇÃO
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value;
        const nickname = document.getElementById('nickname').value;
        const birthDate = document.getElementById('birthDate').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Validações
        if (!isOver18(birthDate)) {
            showAlert('Você deve ter pelo menos 18 anos para se cadastrar.');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
            showAlert('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        
        // Loading
        document.getElementById('registerText').classList.add('hidden');
        document.getElementById('registerSpinner').classList.remove('hidden');
        document.getElementById('registerBtn').disabled = true;
        
        try {
            console.log('📧 Tentando cadastrar:', email);
            
            // CADASTRO COM CONFIRMAÇÃO DE EMAIL - IGUAL À LOJA VIRTUAL
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        nickname: nickname
                    },
                    // 🔑 ISSO É O QUE ESTAVA FALTANDO - URL DE REDIRECIONAMENTO
                    emailRedirectTo: 'https://conexaoperfeitaamor.netlify.app/login.html'
                }
            });
            
            if (error) {
                console.error('❌ Erro no cadastro:', error);
                throw error;
            }
            
            console.log('✅ Resposta do Supabase:', data);
            
            if (data.user) {
                // CRIAR PERFIL NA TABELA
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: data.user.id,
                            full_name: fullName,
                            nickname: nickname,
                            birth_date: birthDate,
                            email: email
                        }
                    ]);
                
                if (profileError) {
                    console.error('❌ Erro ao criar perfil:', profileError);
                    // Mesmo com erro no perfil, o usuário foi criado no Auth
                }
                
                // 🎉 SUCESSO - EMAIL ENVIADO
                showAlert('✅ Cadastro realizado! Verifique seu email para confirmar a conta.', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 4000);
            }
            
        } catch (error) {
            console.error('💥 ERRO:', error);
            if (error.message.includes('already registered')) {
                showAlert('Este email já está cadastrado. Faça login.');
            } else {
                showAlert('Erro: ' + error.message);
            }
        } finally {
            document.getElementById('registerText').classList.remove('hidden');
            document.getElementById('registerSpinner').classList.add('hidden');
            document.getElementById('registerBtn').disabled = false;
        }
    });
}

// LOGIN
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        document.getElementById('loginText').classList.add('hidden');
        document.getElementById('loginSpinner').classList.remove('hidden');
        document.getElementById('loginBtn').disabled = true;
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            if (data.user) {
                showAlert('Login realizado com sucesso!', 'success');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);
            }
            
        } catch (error) {
            showAlert(error.message || 'Erro ao fazer login.');
        } finally {
            document.getElementById('loginText').classList.remove('hidden');
            document.getElementById('loginSpinner').classList.add('hidden');
            document.getElementById('loginBtn').disabled = false;
        }
    });
}

// LOGOUT
async function logout() {
    try {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        alert('Erro ao sair.');
    }
}