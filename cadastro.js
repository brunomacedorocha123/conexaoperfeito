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

    // Verificar se nickname já existe
    async function verificarNickname(nickname) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', nickname);

            if (error) {
                console.error('Erro ao verificar nickname:', error);
                return false;
            }

            // Se data é um array vazio, nickname está disponível
            return data.length === 0;

        } catch (error) {
            console.error('Erro:', error);
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
            
            if (nickname.length < 3) {
                this.style.borderColor = '#e1e5e9';
                return;
            }
            
            timeout = setTimeout(async () => {
                const disponivel = await verificarNickname(nickname);
                this.style.borderColor = disponivel ? '#4ecdc4' : '#ff6b6b';
            }, 500);
        });
    }

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

    // Submit do formulário
    cadastroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
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

        // Validações
        const idade = calcularIdade(formData.dataNascimento);
        if (idade < 18) {
            alert('Você deve ter pelo menos 18 anos para se cadastrar.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        if (formData.senha !== formData.confirmarSenha) {
            alert('As senhas não coincidem.');
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

        // Verificar nickname único
        const nicknameDisponivel = await verificarNickname(formData.nickname);
        if (!nicknameDisponivel) {
            alert('Este nickname já está em uso. Por favor, escolha outro.');
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
            return;
        }

        try {
            // Cadastrar usuário no Supabase Auth
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

            if (authError) {
                throw new Error(authError.message);
            }

            if (authData.user) {
                alert('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.');
                window.location.href = 'email.html';
            }

        } catch (error) {
            console.error('Erro no cadastro:', error);
            alert('Erro ao cadastrar: ' + error.message);
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
        }
    });
});