// ==================== GLOBALS.JS ====================
// Configurações e funções COMUNS a todas as páginas

// Configuração do Supabase (COMUM a todas as páginas)
const SUPABASE_URL = 'https://rohsbrkbdlbewonibclf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvaHNicmtiZGxiZXdvbmliY2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTc5MDMsImV4cCI6MjA3NjE5MzkwM30.PUbV15B1wUoU_-dfggCwbsS5U7C1YsoTrtcahEKn_Oc';

// Inicialização do Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global da aplicação
let currentUser = null;
let isInitialized = false;

// ==================== INICIALIZAÇÃO GLOBAL ====================
document.addEventListener('DOMContentLoaded', function() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('🚀 Globals.js inicializado - Projeto Amor Conect');
    initializeGlobalSystems();
});

// ==================== SISTEMAS GLOBAIS ====================
function initializeGlobalSystems() {
    setupMobileMenu();
    startOnlineStatusUpdater();
    setupGlobalEventListeners();
}

// ==================== SISTEMA DE MENU MOBILE ====================
function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMobileMenu = document.getElementById('closeMobileMenu');
    
    if (!hamburgerBtn || !mobileMenu) {
        console.log('ℹ️ Elementos do menu mobile não encontrados');
        return;
    }

    // Criar overlay se não existir
    let overlay = document.getElementById('mobileMenuOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mobileMenuOverlay';
        overlay.className = 'mobile-menu-overlay';
        document.body.appendChild(overlay);
    }

    // Abrir menu
    hamburgerBtn.addEventListener('click', openMobileMenu);
    
    // Fechar menu
    closeMobileMenu.addEventListener('click', closeMobileMenu);
    overlay.addEventListener('click', closeMobileMenu);
    
    // Fechar com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
            closeMobileMenu();
        }
    });

    function openMobileMenu() {
        document.body.classList.add('menu-open');
        mobileMenu.style.display = 'flex';
        overlay.classList.add('active');
        
        // Animações de entrada
        setTimeout(() => {
            mobileMenu.classList.remove('menu-closing');
            overlay.classList.remove('menu-closing');
        }, 10);
        
        console.log('📱 Menu mobile aberto');
    }

    function closeMobileMenu() {
        mobileMenu.classList.add('menu-closing');
        overlay.classList.add('menu-closing');
        
        setTimeout(() => {
            document.body.classList.remove('menu-open');
            mobileMenu.style.display = 'none';
            overlay.classList.remove('active');
        }, 300);
        
        console.log('📱 Menu mobile fechado');
    }
}

// ==================== SISTEMA DE STATUS ONLINE ====================
function startOnlineStatusUpdater() {
    // Atualizar status imediatamente
    updateOnlineStatus();
    
    // Atualizar a cada 2 minutos
    setInterval(updateOnlineStatus, 120000);
    
    // Atualizar quando a página fica visível
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            updateOnlineStatus();
        }
    });
    
    // Atualizar em interações do usuário (com debounce)
    ['click', 'mousemove', 'keypress'].forEach(event => {
        document.addEventListener(event, debounce(updateOnlineStatus, 30000), { 
            passive: true 
        });
    });
    
    console.log('🟢 Sistema de status online iniciado');
}

async function updateOnlineStatus() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('profiles')
            .update({ 
                last_online_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) {
            console.error('❌ Erro ao atualizar status online:', error);
        }
        
    } catch (error) {
        console.error('❌ Erro no sistema de status online:', error);
    }
}

// ==================== FUNÇÕES UTILITÁRIAS GLOBAIS ====================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

function getTimeAgo(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return `${Math.floor(diffDays / 7)}sem`;
}

// ==================== SISTEMA DE NOTIFICAÇÕES ====================
function showNotification(message, type = 'info') {
    // Remover notificação existente
    const existingNotification = document.querySelector('.global-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `global-notification notification-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: '💡'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || '💡'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Estilos inline para garantir funcionamento
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f56565' : 
                     type === 'success' ? '#48bb78' : 
                     type === 'warning' ? '#ed8936' : '#4299e1'};
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 350px;
        animation: slideInRight 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        border-left: 4px solid ${type === 'error' ? '#c53030' : 
                              type === 'success' ? '#2f855a' : 
                              type === 'warning' ? '#b7791f' : '#2c5aa0'};
    `;

    // Adicionar ao DOM
    document.body.appendChild(notification);

    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ==================== SISTEMA DE AUTENTICAÇÃO ====================
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        
        if (user) {
            currentUser = user;
            return user;
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Erro na verificação de autenticação:', error);
        return null;
    }
}

async function logout() {
    try {
        const confirmLogout = confirm('Tem certeza que deseja sair?');
        if (!confirmLogout) return;
        
        showNotification('👋 Saindo...', 'info');
        
        // Atualizar último online antes de sair
        if (currentUser) {
            await supabase
                .from('profiles')
                .update({ 
                    last_online_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentUser.id);
        }
        
        // Fazer logout
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Redirecionar para login
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro ao fazer logout:', error);
        showNotification('❌ Erro ao sair', 'error');
    }
}

// ==================== SISTEMA DE CARREGAMENTO DE IMAGENS ====================
async function loadUserPhoto(avatarUrl) {
    try {
        if (!avatarUrl) return null;

        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(avatarUrl);

        return data?.publicUrl || null;

    } catch (error) {
        console.error('❌ Erro ao carregar foto:', error);
        return null;
    }
}

// ==================== EVENT LISTENERS GLOBAIS ====================
function setupGlobalEventListeners() {
    // Logout global
    document.addEventListener('click', function(e) {
        if (e.target.id === 'logoutBtn' || e.target.id === 'mobileLogoutBtn') {
            e.preventDefault();
            logout();
        }
    });

    // Prevenir comportamento padrão de links vazios
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' && e.target.getAttribute('href') === '#') {
            e.preventDefault();
        }
    });

    // Melhorar acessibilidade
    document.addEventListener('keydown', function(e) {
        // Fechar modais com ESC
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="display: flex"]');
            if (openModal) {
                openModal.style.display = 'none';
            }
        }
    });
}

// ==================== MÁSCARAS DE FORMULÁRIO ====================
function maskCPF(cpf) {
    return cpf.replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(phone) {
    return phone.replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function maskCEP(cep) {
    return cep.replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

// ==================== VALIDAÇÕES GLOBAIS ====================
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    return {
        isValid: Object.values(requirements).every(Boolean),
        requirements: requirements
    };
}

// ==================== EXPORTAÇÃO DE FUNÇÕES GLOBAIS ====================
// Tornar funções disponíveis globalmente
window.supabase = supabase;
window.currentUser = currentUser;
window.checkAuth = checkAuth;
window.logout = logout;
window.showNotification = showNotification;
window.formatDate = formatDate;
window.calculateAge = calculateAge;
window.getTimeAgo = getTimeAgo;
window.loadUserPhoto = loadUserPhoto;
window.maskCPF = maskCPF;
window.maskPhone = maskPhone;
window.maskCEP = maskCEP;
window.validateEmail = validateEmail;
window.validatePassword = validatePassword;
window.debounce = debounce;

console.log('✅ Globals.js carregado com sucesso!');