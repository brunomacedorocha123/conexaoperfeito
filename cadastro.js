// Cadastro.js - DEFINITIVO
document.addEventListener('DOMContentLoaded', function() {
    const cadastroForm = document.getElementById('cadastroForm');
    const btnCadastrar = document.getElementById('btnCadastrar');

    console.log('Cadastro.js carregado');

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

    // VERIFICAÇÃO DEFINITIVA
    async function verificarNickname(nickname) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', nickname);

        if (error) {
            console.error('Erro:', error);
            return false;
        }

        return data.length === 0;
    }

    // Validação do nickname
    const nicknameInput = document.getElementById('nickname');
    if (nicknameInput) {
        let timeout;
        
        nicknameInput.addEventListener('input', function() {
            clearTimeout(timeout);
            const nickname = this.value.trim();
            
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

    // SUBMIT DEFINITIVO
    cadastroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
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

        // Validações
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

        // Verificação final
        const nicknameDisponivel = await verificarNickname(formData.nickname);
        
        if (!nicknameDisponivel) {
            alert('❌ Este nickname já está em uso. Escolha outro.');
            resetarBotao();
            return;
        }

        try {
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

            if (authError) {
                throw new Error(authError.message);
            }

            if (authData.user) {
                alert('✅ Cadastro realizado! Verifique seu e-mail.');
                window.location.href = 'email.html';
            }

        } catch (error) {
            alert('❌ Erro: ' + error.message);
            resetarBotao();
        }
    });

    function resetarBotao() {
        btnCadastrar.disabled = false;
        btnCadastrar.textContent = 'Criar minha conta';
    }
});

// Salvar e-mail para possível reenvio
localStorage.setItem('last_signup_email', formData.email);