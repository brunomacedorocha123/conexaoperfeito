// Cadastro.js - ConexãoPerfeita
document.addEventListener('DOMContentLoaded', function() {
    const cadastroForm = document.getElementById('cadastroForm');
    const btnCadastrar = document.getElementById('btnCadastrar');

    console.log('Cadastro.js carregado');

    // Verificar idade (maior de 18 anos)
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

    // Verificar se nickname já existe - CORRIGIDA
    async function verificarNickname(nickname) {
        try {
            console.log('🔍 Verificando nickname:', nickname);
            
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', nickname);

            console.log('📦 Resposta do Supabase:', data);

            if (error) {
                console.error('❌ Erro ao verificar nickname:', error);
                return false;
            }

            // CORREÇÃO: Se data é array vazio = nickname disponível
            const disponivel = data.length === 0;
            console.log('✅ Nickname disponível?', disponivel);
            
            return disponivel;

        } catch (error) {
            console.error('❌ Erro:', error);
            return false;
        }
    }

    // Validação em tempo real do nickname
    const nicknameInput = document.getElementById('nickname');
    if (nicknameInput) {
        let timeout;
        
        nicknameInput.addEventListener('input', function() {
            clearTimeout(timeout);
            const nickname = this.value.trim();
            
            // Resetar cor
            this.style.borderColor = '#e1e5e9';
            
            if (nickname.length < 3) {
                return;
            }
            
            timeout = setTimeout(async () => {
                const disponivel = await verificarNickname(nickname);
                this.style.borderColor = disponivel ? '#4ecdc4' : '#ff6b6b';
                
                // Mostrar mensagem para o usuário
                const mensagemExistente = this.parentNode.querySelector('.nickname-message');
                if (mensagemExistente) {
                    mensagemExistente.remove();
                }
                
                const mensagem = document.createElement('div');
                mensagem.className = 'nickname-message';
                mensagem.style.marginTop = '5px';
                mensagem.style.fontSize = '0.85rem';
                mensagem.style.color = disponivel ? '#4ecdc4' : '#ff6b6b';
                mensagem.textContent = disponivel ? '✓ Nickname disponível' : '✗ Nickname já em uso';
                
                this.parentNode.appendChild(mensagem);
                
            }, 800);
        });
    }

    // Validação da data de nascimento
    const dataNascimentoInput = document.getElementById('dataNascimento');
    if (dataNascimentoInput) {
        dataNascimentoInput.addEventListener('change', function() {
            const idade = calcularIdade(this.value);
            const valido = idade >= 18;
            
            this.style.borderColor = valido ? '#4ecdc4' : '#ff6b6b';
            
            // Mostrar mensagem
            const mensagemExistente = this.parentNode.querySelector('.idade-message');
            if (mensagemExistente) {
                mensagemExistente.remove();
            }
            
            if (this.value) {
                const mensagem = document.createElement('div');
                mensagem.className = 'idade-message';
                mensagem.style.marginTop = '5px';
                mensagem.style.fontSize = '0.85rem';
                mensagem.style.color = valido ? '#4ecdc4' : '#ff6b6b';
                mensagem.textContent = valido ? `✓ Idade válida (${idade} anos)` : `✗ Você precisa ter 18 anos ou mais (${idade} anos)`;
                
                this.parentNode.appendChild(mensagem);
            }
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

    // Submit do formulário
    cadastroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('🚀 Iniciando cadastro...');
        
        btnCadastrar.disabled = true;
        btnCadastrar.textContent = 'Cadastrando...';

        // Coletar dados do formulário
        const formData = {
            nomeCompleto: document.getElementById('nomeCompleto').value.trim(),
            dataNascimento: document.getElementById('dataNascimento').value,
            nickname: document.getElementById('nickname').value.trim(),
            email: document.getElementById('email').value.trim(),
            senha: document.getElementById('senha').value,
            confirmarSenha: document.getElementById('confirmarSenha').value
        };

        console.log('📝 Dados do formulário:', formData);

        // Validações
        const idade = calcularIdade(formData.dataNascimento);
        if (idade < 18) {
            alert('❌ Você deve ter pelo menos 18 anos para se cadastrar.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        if (formData.senha !== formData.confirmarSenha) {
            alert('❌ As senhas não coincidem.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        if (formData.senha.length < 6) {
            alert('❌ A senha deve ter pelo menos 6 caracteres.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        if (formData.nickname.length < 3) {
            alert('❌ O nickname deve ter pelo menos 3 caracteres.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        // Verificar nickname único
        console.log('🎯 Verificação final do nickname...');
        const nicknameDisponivel = await verificarNickname(formData.nickname);
        console.log('✅ Nickname disponível na verificação final:', nicknameDisponivel);
        
        if (!nicknameDisponivel) {
            alert('❌ Este nickname já está em uso. Por favor, escolha outro.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        try {
            console.log('📨 Enviando dados para o Supabase Auth...');
            
            // Cadastrar usuário no Supabase Auth
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

            console.log('📩 Resposta do Supabase Auth:', { authData, authError });

            if (authError) {
                throw new Error(authError.message);
            }

            if (authData.user) {
                alert('✅ Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.');
                window.location.href = 'email.html';
            }

        } catch (error) {
            console.error('💥 Erro no cadastro:', error);
            alert('❌ Erro ao cadastrar: ' + error.message);
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
        }
    });
});