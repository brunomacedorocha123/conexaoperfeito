// Cadastro.js - ConexãoPerfeita
document.addEventListener('DOMContentLoaded', function() {
    const cadastroForm = document.getElementById('cadastroForm');
    const btnCadastrar = document.getElementById('btnCadastrar');

    console.log('Cadastro.js carregado');

    // Verificar idade
    function calcularIdade(dataNascimento) {
        const hoje = new Date();
        const nascimento = new Date(dataNascimento);
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const mes = hoje.getMonth() - nascimento.getMonth();
        if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
            idade--;
        }
        return idade;
    }

    // VERIFICAÇÃO CORRIGIDA DO NICKNAME
    async function verificarNickname(nickname) {
        try {
            console.log('🔍 Verificando nickname:', nickname);
            
            // VERIFICAÇÃO MAIS ROBUSTA
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username')
                .ilike('username', nickname); // usa ilike para case insensitive

            console.log('📦 Resposta completa:', { data, error });

            if (error) {
                console.error('❌ Erro na consulta:', error);
                return true; // Se der erro, permite tentar o cadastro
            }

            // SE NÃO ENCONTROU NADA, nickname está disponível
            const disponivel = !data || data.length === 0;
            console.log('✅ Nickname disponível?', disponivel);
            
            return disponivel;

        } catch (error) {
            console.error('💥 Erro geral:', error);
            return true; // Em caso de erro, permite tentar
        }
    }

    // Validação em tempo real do nickname - SIMPLIFICADA
    const nicknameInput = document.getElementById('nickname');
    if (nicknameInput) {
        let timeout;
        
        nicknameInput.addEventListener('input', function() {
            clearTimeout(timeout);
            const nickname = this.value.trim();
            
            // Resetar
            this.style.borderColor = '#e1e5e9';
            const msgExistente = this.parentNode.querySelector('.nickname-message');
            if (msgExistente) msgExistente.remove();
            
            if (nickname.length < 3) return;
            
            timeout = setTimeout(async () => {
                const disponivel = await verificarNickname(nickname);
                this.style.borderColor = disponivel ? '#4ecdc4' : '#ff6b6b';
                
                const mensagem = document.createElement('div');
                mensagem.className = 'nickname-message';
                mensagem.style.cssText = 'margin-top:5px; font-size:0.85rem; font-weight:600;';
                mensagem.style.color = disponivel ? '#4ecdc4' : '#ff6b6b';
                mensagem.textContent = disponivel ? '✓ Disponível' : '✗ Em uso';
                
                this.parentNode.appendChild(mensagem);
            }, 1000);
        });
    }

    // Validação da data de nascimento
    const dataNascimentoInput = document.getElementById('dataNascimento');
    if (dataNascimentoInput) {
        dataNascimentoInput.addEventListener('change', function() {
            if (!this.value) return;
            
            const idade = calcularIdade(this.value);
            const valido = idade >= 18;
            this.style.borderColor = valido ? '#4ecdc4' : '#ff6b6b';
            
            const msgExistente = this.parentNode.querySelector('.idade-message');
            if (msgExistente) msgExistente.remove();
            
            const mensagem = document.createElement('div');
            mensagem.className = 'idade-message';
            mensagem.style.cssText = 'margin-top:5px; font-size:0.85rem; font-weight:600;';
            mensagem.style.color = valido ? '#4ecdc4' : '#ff6b6b';
            mensagem.textContent = valido ? `✓ ${idade} anos` : `✗ ${idade} anos (precisa 18+)`;
            
            this.parentNode.appendChild(mensagem);
        });
    }

    // Validação de senha
    const senhaInput = document.getElementById('senha');
    const confirmarSenhaInput = document.getElementById('confirmarSenha');
    
    function validarSenhas() {
        const senha = senhaInput.value;
        const confirmarSenha = confirmarSenhaInput.value;
        
        if (confirmarSenha && senha !== confirmarSenha) {
            confirmarSenhaInput.style.borderColor = '#ff6b6b';
            return false;
        } else if (confirmarSenha) {
            confirmarSenhaInput.style.borderColor = '#4ecdc4';
        }
        
        return true;
    }
    
    if (senhaInput && confirmarSenhaInput) {
        senhaInput.addEventListener('input', validarSenhas);
        confirmarSenhaInput.addEventListener('input', validarSenhas);
    }

    // SUBMIT CORRIGIDO
    cadastroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('🚀 Iniciando cadastro...');
        
        btnCadastrar.disabled = true;
        btnCadastrar.textContent = 'Cadastrando...';

        const formData = {
            nomeCompleto: document.getElementById('nomeCompleto').value.trim(),
            dataNascimento: document.getElementById('dataNascimento').value,
            nickname: document.getElementById('nickname').value.trim(),
            email: document.getElementById('email').value.trim().toLowerCase(),
            senha: document.getElementById('senha').value
        };

        console.log('📝 Dados:', formData);

        // Validações básicas
        const idade = calcularIdade(formData.dataNascimento);
        if (idade < 18) {
            alert('❌ Você deve ter pelo menos 18 anos.');
            resetarBotao();
            return;
        }

        if (formData.senha.length < 6) {
            alert('❌ Senha deve ter 6+ caracteres.');
            resetarBotao();
            return;
        }

        if (formData.nickname.length < 3) {
            alert('❌ Nickname deve ter 3+ caracteres.');
            resetarBotao();
            return;
        }

        try {
            console.log('📨 Cadastrando no Supabase...');
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.senha,
                options: {
                    data: {
                        full_name: formData.nomeCompleto,
                        username: formData.nickname,
                        birth_date: formData.dataNascimento
                    },
                    emailRedirectTo: 'https://conexaoperfeitaamor.netlify.app/email.html'
                }
            });

            console.log('📩 Resposta:', { authData, authError });

            if (authError) {
                // Se for erro de username duplicado, o Supabase vai avisar
                if (authError.message.includes('username') || authError.message.includes('duplicate')) {
                    alert('❌ Nickname já em uso. Escolha outro.');
                } else {
                    alert('❌ Erro: ' + authError.message);
                }
                resetarBotao();
                return;
            }

            if (authData.user) {
                alert('✅ Cadastro realizado! Verifique seu e-mail.');
                window.location.href = 'email.html';
            }

        } catch (error) {
            console.error('💥 Erro:', error);
            alert('❌ Erro no cadastro.');
            resetarBotao();
        }
    });

    function resetarBotao() {
        btnCadastrar.disabled = false;
        btnCadastrar.textContent = 'Criar minha conta';
    }
});