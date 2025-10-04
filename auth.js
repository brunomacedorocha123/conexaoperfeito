// Configuração do Supabase
const SUPABASE_URL = 'https://ivposfgebabrtpexxpko.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cG9zZmdlYmFicnRwZXh4cGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODczMzEsImV4cCI6MjA3NTE2MzMzMX0.AJU3Vt2dqATDORS4mjTW3gDWeh1MK9lNTWk-uoG5ojo';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Funções de autenticação
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
    
    setTimeout(() => {
        alertDiv.classList.add('hidden');
    }, 5000);
}

// CADASTRO - VERSÃO COM DEBUG
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value;
        const nickname = document.getElementById('nickname').value;
        const birthDate = document.getElementById('birthDate').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        console.log('📝 Dados do formulário:', { fullName, nickname, birthDate, email });
        
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
            console.log('🚀 Iniciando cadastro no Supabase Auth...');
            
            // 1. CADASTRO NO AUTH (SEM email confirmation para teste)
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        nickname: nickname
                    }
                }
            });
            
            console.log('📨 Resposta do Auth:', authData);
            console.log('❌ Erro do Auth:', authError);
            
            if (authError) {
                throw authError;
            }
            
            if (authData.user) {
                console.log('✅ Usuário criado no Auth. ID:', authData.user.id);
                console.log('📊 Status do email:', authData.user.email_confirmed_at ? 'Confirmado' : 'Não confirmado');
                
                // 2. SALVAR PERFIL NA TABELA
                console.log('💾 Salvando perfil na tabela profiles...');
                
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            full_name: fullName,
                            nickname: nickname,
                            birth_date: birthDate,
                            email: email
                        }
                    ])
                    .select(); // Adiciona .select() para ver o resultado
                
                console.log('📈 Resposta do Profile:', profileData);
                console.log('❌ Erro do Profile:', profileError);
                
                if (profileError) {
                    throw profileError;
                }
                
                console.log('🎉 PERFIL CRIADO COM SUCESSO!');
                
                // Verificar se precisa confirmar email
                if (authData.user.identities && authData.user.identities.length === 0) {
                    showAlert('Este email já está cadastrado. Faça login.', 'error');
                } else if (!authData.user.email_confirmed_at) {
                    showAlert('Cadastro realizado! Verifique seu email para confirmar a conta.', 'success');
                } else {
                    showAlert('Cadastro realizado com sucesso! Redirecionando...', 'success');
                }
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            } else {
                throw new Error('Usuário não foi criado');
            }
            
        } catch (error) {
            console.error('💥 ERRO COMPLETO:', error);
            
            if (error.message.includes('User already registered')) {
                showAlert('Este email já está cadastrado. Faça login ou use outro email.');
            } else if (error.message.includes('nickname')) {
                showAlert('Este nickname já está em uso. Escolha outro.');
            } else {
                showAlert('Erro: ' + (error.message || 'Erro desconhecido'));
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
            console.log('🔐 Tentando login:', email);
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            console.log('📨 Resposta do login:', data);
            console.log('❌ Erro do login:', error);
            
            if (error) throw error;
            
            if (data.user) {
                showAlert('Login realizado com sucesso!', 'success');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);
            }
            
        } catch (error) {
            console.error('💥 Erro no login:', error);
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

// VERIFICAR AUTENTICAÇÃO
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Usuário atual:', user);
    return user;
}

async function requireAuth() {
    const user = await checkAuth();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
}