// Funções de autenticação

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

// Cadastro
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
            // Cadastrar no Supabase Auth
            const { data, error } = await supabase.auth.signUp({
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
            
            if (error) throw error;
            
            if (data.user) {
                // Criar perfil na tabela profiles
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: data.user.id,
                            full_name: fullName,
                            nickname: nickname,
                            birth_date: birthDate,
                            email: email,
                            created_at: new Date().toISOString()
                        }
                    ]);
                
                if (profileError) throw profileError;
                
                showAlert('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Erro no cadastro:', error);
            showAlert(error.message || 'Erro ao realizar cadastro. Tente novamente.');
        } finally {
            // Esconder loading
            document.getElementById('registerText').classList.remove('hidden');
            document.getElementById('registerSpinner').classList.add('hidden');
            document.getElementById('registerBtn').disabled = false;
        }
    });
}

// Login
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
            console.error('Erro no login:', error);
            showAlert(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
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