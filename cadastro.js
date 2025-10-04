// Cadastro.js - ConexãoPerfeita (VERIFICAÇÃO FUNCIONAL)
document.addEventListener('DOMContentLoaded', function() {
    const cadastroForm = document.getElementById('cadastroForm');
    const btnCadastrar = document.getElementById('btnCadastrar');

    console.log('Cadastro.js carregado - COM verificação funcional');

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

    // **VERIFICAÇÃO CORRETA DO NICKNAME**
    async function verificarNickname(nickname) {
        try {
            console.log('🔍 Verificando nickname:', nickname);
            
            // CONSULTA SIMPLES E DIRETA
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', nickname);

            console.log('📦 Resposta da consulta:', data);

            // **LÓGICA CORRETA:**
            // Se data = [] (array vazio) → nickname NÃO existe → DISPONÍVEL
            // Se data = [algum valor] → nickname JÁ existe → INDISPONÍVEL
            const disponivel = data.length === 0;
            
            console.log('✅ Nickname disponível?', disponivel);
            return disponivel;

        } catch (error) {
            console.error('❌ Erro na verificação:', error);
            return false;
        }
    }

    // Validação em tempo real - FUNCIONAL
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
                mensagem.textContent = disponivel ? '✓ Disponível' : '✗ Já em uso';
                
                this.parentNode.appendChild(mensagem);
            }, 800);
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

    // **SUBMIT COM VERIFICAÇÃO FINAL**
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
            senha: document.getElementById('senha').value,
            confirmarSenha: document.getElementById('confirmarSenha').value
        };

        console.log('📝 Dados:', formData);

        // Validações básicas
        const idade = calcularIdade(formData.dataNascimento);
        if (idade < 18) {
            alert('❌ Você deve ter pelo menos 18 anos.');
            resetarBotao();
            return;
        }

        if (formData.senha !== formData.confirmarSenha) {
            alert('❌ As senhas não coincidem.');
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

        // **VERIFICAÇÃO FINAL DO NICKNAME**
        console.log('🎯 Verificação FINAL do nickname...');
        const nicknameDisponivel = await verificarNickname(formData.nickname);
        console.log('✅ Resultado final:', nicknameDisponivel);
        
        if (!nicknameDisponivel) {
            alert('❌ Este nickname já está em uso. Por favor, escolha outro.');
            resetarBotao();
            return;
        }

        try {
            console.log('📨 Cadastrando no Supabase Auth...');
            
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

            console.log('📩 Resposta do Auth:', { authData, authError });

            if (authError) {
                // Se mesmo assim der erro de username único
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