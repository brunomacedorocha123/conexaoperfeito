// auth.js - VERSÃO TESTADA
console.log('🔧 Script auth.js carregado!');

// Configuração Supabase
const supabaseUrl = 'https://ivposfgebabrtpexxpko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cG9zZmdlYmFicnRwZXh4cGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODczMzEsImV4cCI6MjA3NTE2MzMzMX0.AJU3Vt2dqATDORS4mjTW3gDWeh1MK9lNTWk-uoG5ojo';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase inicializado');

// Verificar se elementos existem
console.log('📝 registerForm:', document.getElementById('registerForm'));
console.log('📝 loginForm:', document.getElementById('loginForm'));

// Função para mostrar mensagens
function showMessage(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message); // Fallback
    }
}

// CADASTRO - VERSÃO SIMPLES E FUNCIONAL
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 DOM carregado');
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        console.log('✅ registerForm encontrado, adicionando evento...');
        
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('🎯 Formulário de cadastro enviado!');
            
            // Coletar dados
            const formData = new FormData(registerForm);
            const fullName = document.getElementById('fullName').value;
            const nickname = document.getElementById('nickname').value;
            const birthDate = document.getElementById('birthDate').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            console.log('📧 Tentando cadastrar:', email);
            
            // Mostrar loading
            const btn = document.getElementById('registerBtn');
            const btnText = document.getElementById('registerText');
            const spinner = document.getElementById('registerSpinner');
            
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'block';
            if (btn) btn.disabled = true;
            
            try {
                // Cadastrar no Supabase
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: fullName,
                            nickname: nickname
                        },
                        emailRedirectTo: 'https://conexaoperfeitaamor.netlify.app'
                    }
                });
                
                if (error) {
                    console.error('❌ Erro Supabase:', error);
                    throw error;
                }
                
                console.log('✅ Resposta Supabase:', data);
                
                if (data.user) {
                    // Criar perfil
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([{
                            id: data.user.id,
                            full_name: fullName,
                            nickname: nickname,
                            birth_date: birthDate,
                            email: email
                        }]);
                    
                    if (profileError) {
                        console.error('❌ Erro perfil:', profileError);
                    }
                    
                    showMessage('🎉 Cadastro realizado! Verifique seu email.', 'success');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 3000);
                }
                
            } catch (error) {
                console.error('💥 Erro completo:', error);
                showMessage('Erro: ' + error.message);
            } finally {
                // Restaurar botão
                if (btnText) btnText.style.display = 'block';
                if (spinner) spinner.style.display = 'none';
                if (btn) btn.disabled = false;
            }
        });
    } else {
        console.error('❌ registerForm NÃO encontrado!');
    }
    
    // LOGIN
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) throw error;
                
                showMessage('Login realizado!', 'success');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);
                
            } catch (error) {
                showMessage('Erro: ' + error.message);
            }
        });
    }
});

// Logout
window.logout = async function() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
};