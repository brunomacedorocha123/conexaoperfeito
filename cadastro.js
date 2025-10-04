// Cadastro.js - NOVO E SIMPLES
document.addEventListener('DOMContentLoaded', function() {
    const cadastroForm = document.getElementById('cadastroForm');
    const btnCadastrar = document.getElementById('btnCadastrar');

    console.log('🚀 Cadastro iniciado');

    // Função simples de idade
    function calcularIdade(data) {
        const hoje = new Date();
        const nascimento = new Date(data);
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const mes = hoje.getMonth() - nascimento.getMonth();
        if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
            idade--;
        }
        return idade;
    }

    // Verificação SIMPLES do nickname
    async function nicknameDisponivel(nickname) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', nickname);

            if (error) throw error;
            return data.length === 0;
        } catch (error) {
            console.error('Erro verificação:', error);
            return true;
        }
    }

    // Submit DIRETO E FUNCIONAL
    cadastroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Dados do formulário
        const dados = {
            nome: document.getElementById('nomeCompleto').value.trim(),
            nascimento: document.getElementById('dataNascimento').value,
            nickname: document.getElementById('nickname').value.trim(),
            email: document.getElementById('email').value.trim(),
            senha: document.getElementById('senha').value
        };

        console.log('📝 Tentando cadastrar:', dados);

        // Validações BÁSICAS
        if (calcularIdade(dados.nascimento) < 18) {
            alert('❌ Precisa ter 18 anos ou mais');
            return;
        }

        if (dados.senha.length < 6) {
            alert('❌ Senha precisa de 6+ caracteres');
            return;
        }

        if (dados.nickname.length < 3) {
            alert('❌ Nickname precisa de 3+ caracteres');
            return;
        }

        // Botão loading
        btnCadastrar.disabled = true;
        btnCadastrar.textContent = 'Cadastrando...';

        try {
            // Verificar nickname
            const disponivel = await nicknameDisponivel(dados.nickname);
            if (!disponivel) {
                alert('❌ Nickname já em uso');
                btnCadastrar.disabled = false;
                btnCadastrar.textContent = 'Criar minha conta';
                return;
            }

            // CADASTRAR NO SUPABASE
            console.log('📨 Enviando para Supabase...');
            
            const { data, error } = await supabase.auth.signUp({
                email: dados.email,
                password: dados.senha,
                options: {
                    data: {
                        full_name: dados.nome,
                        username: dados.nickname,
                        birth_date: dados.nascimento
                    }
                }
            });

            console.log('📩 Resposta:', { data, error });

            if (error) {
                throw new Error(error.message);
            }

            if (data.user) {
                // SALVAR EMAIL PARA REENVIO
                localStorage.setItem('cadastro_email', dados.email);
                
                alert('✅ Cadastrado! Verifique seu email.');
                window.location.href = 'email.html';
            } else {
                throw new Error('Usuário não criado');
            }

        } catch (error) {
            console.error('💥 Erro completo:', error);
            alert('❌ Erro: ' + error.message);
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Criar minha conta';
        }
    });
});