// JavaScript específico da página Index
console.log('ConexãoPerfeita - Página inicial carregada');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado - inicializando funcionalidades');
    
    // Navegação simples
    const cadastroBtn = document.getElementById('btnCadastro');
    const loginBtn = document.getElementById('btnLogin');
    
    if (cadastroBtn) {
        cadastroBtn.addEventListener('click', function() {
            console.log('Navegando para cadastro');
            window.location.href = 'cadastro.html';
        });
    } else {
        console.error('Botão cadastro não encontrado');
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            console.log('Navegando para login');
            window.location.href = 'login.html';
        });
    } else {
        console.error('Botão login não encontrado');
    }
    
    // Animação simples dos cards
    const featureCards = document.querySelectorAll('.feature-card');
    if (featureCards.length > 0) {
        featureCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 200);
        });
        console.log(`Animação aplicada em ${featureCards.length} cards`);
    }
    
    // Verificar se as páginas existem (opcional)
    function verificarPagina(url) {
        return fetch(url, { method: 'HEAD' })
            .then(response => response.ok)
            .catch(() => false);
    }
    
    // Feedback visual nos botões
    const botoes = document.querySelectorAll('.btn');
    botoes.forEach(botao => {
        botao.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        botao.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
        
        botao.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    console.log('Index.js carregado com sucesso');
});

// Tratamento de erro global
window.addEventListener('error', function(e) {
    console.error('Erro na página:', e.error);
});