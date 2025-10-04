// JavaScript específico da página Index
console.log('ConexãoPerfeita - Página inicial carregada');

document.addEventListener('DOMContentLoaded', function() {
    // Navegação simples
    const cadastroBtn = document.getElementById('btnCadastro');
    const loginBtn = document.getElementById('btnLogin');
    
    if (cadastroBtn) {
        cadastroBtn.addEventListener('click', function() {
            window.location.href = 'cadastro.html';
        });
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            window.location.href = 'login.html';
        });
    }
    
    // Animação simples dos cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 200);
    });
});