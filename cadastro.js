// Cadastro.js - ConexãoPerfeita
document.addEventListener('DOMContentLoaded', function() {
    const cadastroForm = document.getElementById('cadastroForm');
    const btnCadastrar = document.getElementById('btnCadastrar');

    console.log('Cadastro.js carregado - Supabase:', !!supabase);

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

    // Função SIMPLES para verificar nickname
    async function verificarNickname(nickname) {
        try {
            console.log('🔍 Verificando nickname:', nickname);
            
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', nickname)
                .maybeSingle(); // Usando maybeSingle em vez de single

            console.log('📦 Resposta do Supabase:', { data, error });

            // Se data é null, nickname está disponível
            // Se data existe, nickname já está em uso
            return !data;

        } catch (error) {
            console.error('❌ Erro na verificação:', error);
            return false;
        }
    }

    // Remover verificação em tempo real por enquanto - focar no submit
    const nicknameInput = document.getElementById('nickname');
    
    // Validação da data de nascimento
    const dataNascimentoInput = document.getElementById('dataNascimento');
    if (dataNascimentoInput) {
        dataNascimentoInput.addEventListener('change', function() {
            const idade = calcularIdade(this.value);
            this.style.borderColor = idade >= 18 ? '#4ecdc4' : '#ff6b6b';
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

    // Submit do formulário - FOCAR AQUI
    cadastroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('🚀 Iniciando cadastro...');
        
        btnCadastrar.disabled = true;
        btnCadastrar.textContent = 'Cadastrando...';

        // Coletar dados
        const formData = {
            nomeCompleto: document.getElementById('nomeCompleto').value.trim(),
            dataNascimento: document.getElementById('dataNascimento').value,
            nickname: document.getElementById('nickname').value.trim(),
            email: document.getElementById('email').value.trim(),
            senha: document.getElementById('senha').value,
        };

        console.log('📝 Dados:', formData);

        // Validações básicas
        const idade = calcularIdade(formData.dataNascimento);
        if (idade < 18) {
            alert('Você deve ter pelo menos 18 anos para se cadastrar.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        if (formData.senha.length < 6) {
            alert('A senha deve ter pelo menos 6 caracteres.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        if (formData.nickname.length < 3) {
            alert('O nickname deve ter pelo menos 3 caracteres.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        // VERIFICAÇÃO DO NICKNAME - TESTE DIRETO
        console.log('🎯 Verificando nickname...');
        const nicknameDisponivel = await verificarNickname(formData.nickname);
        console.log('✅ Nickname disponível?', nicknameDisponivel);
        
        if (!nicknameDisponivel) {
            alert('❌ Este nickname já está em uso. Por favor, escolha outro.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        // TENTAR CADASTRAR MESMO SE A VERIFICAÇÃO FALHAR
        try {
            console.log('📨 Enviando para Supabase Auth...');
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.senha,
                options: {
                    data: {
                        full_name: formData.nomeCompleto,
                        username: formData.nickname,
                        birth_date: formData.dataNascimento
                    }
                }
            });

            console.log('📩 Resposta Auth:', { authData, authError });

            if (authError) {
                if (authError.message.includes('username') || authError.message.includes('duplicate')) {
                    alert('❌ Este nickname já está em uso. Escolha outro.');
                } else {
                    alert('❌ Erro: ' + authError.message);
                }
                btnCadastrar.disabled = false;
                btnCadastrar.textContent = 'Criar minha conta';
                return;
            }

            if (authData.user) {
                alert('✅ Cadastro realizado! Verifique seu e-mail.');
                window.location.href = 'login.html';
            }

        } catch (error) {
            console.error('💥 Erro geral:', error);
            alert('❌ Erro no cadastro: ' + error.message);
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
        }
    });
});