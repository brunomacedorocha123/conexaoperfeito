// auth.js - VERSÃO COM DEBUG
console.log('🚀 auth.js carregado!');

const SUPABASE_URL = 'https://ivposfgebabrtpexxpko.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cG9zZmdlYmFicnRwZXh4cGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODczMzEsImV4cCI6MjA3NTE2MzMzMX0.AJU3Vt2dqATDORS4mjTW3gDWeh1MK9lNTWk-uoG5ojo';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 5000);
}

// CADASTRO - COM DEBUG
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('1️⃣ Formulário enviado');
        
        const fullName = document.getElementById('fullName').value;
        const nickname = document.getElementById('nickname').value;
        const birthDate = document.getElementById('birthDate').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        console.log('2️⃣ Dados coletados:', { email, fullName });
        
        // Validações básicas
        if (password !== confirmPassword) {
            showAlert('As senhas não coincidem.');
            return;
        }
        
        // Loading
        document.getElementById('registerText').classList.add('hidden');
        document.getElementById('registerSpinner').classList.remove('hidden');
        document.getElementById('registerBtn').disabled = true;
        
        try {
            console.log('3️⃣ Tentando cadastrar no Supabase Auth...');
            
            // CADASTRO SIMPLES - SEM COMPLICAÇÃO
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        nickname: nickname
                    },
                    emailRedirectTo: 'https://conexaoperfeitaamor.netlify.app/login.html'
                }
            });
            
            console.log('4️⃣ Resposta do Supabase:', data);
            console.log('5️⃣ Erro do Supabase:', error);
            
            if (error) {
                throw error;
            }
            
            if (data.user) {
                console.log('6️⃣ Usuário criado, tentando criar perfil...');
                
                // TENTAR CRIAR PERFIL
                try {
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
                        console.log('7️⃣ Erro no perfil (mas auth ok):', profileError);
                    } else {
                        console.log('8️⃣ Perfil criado com sucesso!');
                    }
                } catch (profileError) {
                    console.log('9️⃣ Erro ao criar perfil:', profileError);
                }
                
                // SUCESSO MESMO COM ERRO NO PERFIL
                showAlert('✅ Cadastro realizado! Verifique seu email para confirmar.', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
                
            } else {
                throw new Error('Usuário não foi criado');
            }
            
        } catch (error) {
            console.error('💥 ERRO FINAL:', error);
            showAlert('Erro: ' + error.message);
        } finally {
            console.log('🔚 Finalizando...');
            document.getElementById('registerText').classList.remove('hidden');
            document.getElementById('registerSpinner').classList.add('hidden');
            document.getElementById('registerBtn').disabled = false;
        }
    });
}

// LOGIN (mantenha o seu)
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