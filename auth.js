// Funções de autenticação - VERSÃO CORRIGIDA

// Verificar idade (mínimo 18 anos)
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

// Mostrar alerta
function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.classList.remove('hidden');
    
    // Auto-esconder após 5 segundos
    setTimeout(() => {
        alertDiv.classList.add('hidden');
    }, 5000);
}

// Cadastro - VERSÃO CORRIGIDA
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
        
        // Mostrar loading
        document.getElementById('registerText').classList.add('hidden');
        document.getElementById('registerSpinner').classList.remove('hidden');
        document.getElementById('registerBtn').disabled = true;
        
        try {
            console.log('Iniciando cadastro para:', email);
            
            // 1. Primeiro cadastra no Auth do Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        nickname: nickname,
                        birth_date: birthDate
                    }
                }
            });
            
            if (authError) {
                console.error('Erro no Auth:', authError);
                throw authError;
            }
            
            console.log('Usuário criado no Auth:', authData.user);
            
            // 2. Depois cria o perfil na tabela profiles - FORMA SIMPLIFICADA
            const profileData = {
                id: authData.user.id,
                full_name: fullName,
                nickname: nickname,
                birth_date: birthDate,
                email: email,
                created_at: new Date().toISOString()
            };
            
            console.log('Tentando inserir perfil:', profileData);
            
            const { data: profileInsertData, error: profileError } = await supabase
                .from('profiles')
                .insert([profileData]);
            
            if (profileError) {
                console.error('Erro ao criar perfil:', profileError);
                
                // Se der erro no perfil, tenta uma abordagem alternativa
                showAlert('Cadastro realizado! Mas houve um problema técnico. Faça login para completar seu perfil.');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
                return;
            }
            
            console.log('Perfil criado com sucesso:', profileInsertData);
            
            // Sucesso completo
            showAlert('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
            
        } catch (error) {
            console.error('Erro completo no cadastro:', error);
            
            // Mensagens de erro mais específicas
            if (error.message.includes('already registered')) {
                showAlert('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
            } else if (error.message.includes('nickname')) {
                showAlert('Este nickname já está em uso. Escolha outro.');
            } else {
                showAlert(error.message || 'Erro ao realizar cadastro. Tente novamente.');
            }
        } finally {
            // Esconder loading
            document.getElementById('registerText').classList.remove('hidden');
            document.getElementById('registerSpinner').classList.add('hidden');
            document.getElementById('registerBtn').disabled = false;
        }
    });
}

// Login - VERSÃO CORRIGIDA
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Mostrar loading
        document.getElementById('loginText').classList.add('hidden');
        document.getElementById('loginSpinner').classList.remove('hidden');
        document.getElementById('loginBtn').disabled = true;
        
        try {
            console.log('Tentando login:', email);
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                console.error('Erro no login:', error);
                throw error;
            }
            
            if (data.user) {
                console.log('Login bem-sucedido:', data.user);
                showAlert('Login realizado com sucesso!', 'success');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);
            }
            
        } catch (error) {
            console.error('Erro completo no login:', error);
            
            if (error.message.includes('Invalid login credentials')) {
                showAlert('E-mail ou senha incorretos. Verifique suas credenciais.');
            } else if (error.message.includes('Email not confirmed')) {
                showAlert('Confirme seu e-mail antes de fazer login.');
            } else {
                showAlert(error.message || 'Erro ao fazer login. Tente novamente.');
            }
        } finally {
            // Esconder loading
            document.getElementById('loginText').classList.remove('hidden');
            document.getElementById('loginSpinner').classList.add('hidden');
            document.getElementById('loginBtn').disabled = false;
        }
    });
}

// Logout
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao sair. Tente novamente.');
    }
}

// Verificar autenticação em páginas protegidas
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Verificar se usuário está logado e redirecionar se necessário
async function requireAuth() {
    const user = await checkAuth();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
}