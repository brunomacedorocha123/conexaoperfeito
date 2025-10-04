// auth.js - VERSÃO FUNCIONAL
console.log('🔧 auth.js carregado!');

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

// CADASTRO - FUNCIONAL
if (document.getElementById('registerForm')) {
    console.log('📝 Formulário de cadastro encontrado!');
    
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('🔄 Iniciando cadastro...');
        
        const fullName = document.getElementById('fullName').value;
        const nickname = document.getElementById('nickname').value;
        const birthDate = document.getElementById('birthDate').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        console.log('📧 Dados:', { email, fullName, nickname });
        
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
            // 1. CADASTRO NO SUPABASE AUTH
            console.log('🚀 Cadastrando no Supabase Auth...');
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
            
            if (authError) {
                console.error('❌ Erro no Auth:', authError);
                throw authError;
            }
            
            console.log('✅ Auth criado:', authData);
            
            // 2. CRIAR PERFIL NA TABELA
            if (authData.user) {
                console.log('💾 Criando perfil na tabela...');
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
                    .select();
                
                if (profileError) {
                    console.error('❌ Erro no Profile:', profileError);
                    throw profileError;
                }
                
                console.log('✅ Perfil criado:', profileData);
                
                // SUCESSO
                showAlert('🎉 Cadastro realizado! Verifique seu email para confirmar a conta.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            }
            
        } catch (error) {
            console.error('💥 ERRO COMPLETO:', error);
            
            if (error.message.includes('already registered')) {
                showAlert('Este email já está cadastrado. Faça login.');
            } else if (error.message.includes('nickname')) {
                showAlert('Este nickname já está em uso. Escolha outro.');
            } else {
                showAlert('Erro: ' + error.message);
            }
        } finally {
            document.getElementById('registerText').classList.remove('hidden');
            document.getElementById('registerSpinner').classlist.add('hidden');
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

// VERIFICAR AUTENTICAÇÃO
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function requireAuth() {
    const user = await checkAuth();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
}