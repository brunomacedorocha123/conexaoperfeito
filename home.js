// ==================== HOME.JS ====================
// Versão SIMPLES - só o essencial

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏠 Home.js inicializando...');
    initializeHome();
});

async function initializeHome() {
    try {
        // Verificar autenticação
        const user = await checkAuth();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = user;
        
        // Carregar dados básicos
        await loadUserData();
        await loadRealUsers();
        await loadVisitorsSystem();
        
        updateStats();
        
        console.log('✅ Home inicializada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar home:', error);
        showNotification('Erro ao carregar a página', 'error');
    }
}

// ==================== SISTEMA DE USUÁRIOS (SIMPLES) ====================
async function loadRealUsers() {
    try {
        const limit = window.innerWidth <= 768 ? 4 : 8;
        
        const { data: users, error } = await supabase
            .from('profiles')
            .select(`
                id,
                nickname,
                full_name,
                avatar_url,
                user_details (
                    profession,
                    description
                )
            `)
            .neq('id', currentUser.id)
            .limit(limit)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (!users || users.length === 0) {
            showEmptyState('Ainda não há outros usuários cadastrados.');
            return;
        }
        
        displayUsers(users);

    } catch (error) {
        console.error('❌ Erro ao carregar usuários:', error);
        showEmptyState('Erro ao carregar usuários.');
    }
}

function displayUsers(users) {
    const usersGrid = document.getElementById('usersGrid');
    
    const userCards = users.map(user => {
        const nickname = user.nickname || user.full_name?.split(' ')[0] || 'Usuário';
        const profession = user.user_details?.profession || null;
        const bio = user.user_details?.description || 'Sem descrição.';

        return `
            <div class="user-card" onclick="viewProfile('${user.id}')">
                <div class="user-card-avatar">
                    <div class="user-card-avatar-fallback">${nickname.charAt(0).toUpperCase()}</div>
                </div>
                <div class="user-card-name">${nickname}</div>
                ${profession ? `<div class="user-card-detail">💼 ${profession}</div>` : ''}
                <div class="user-card-bio">${bio}</div>
                <div class="user-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); sendMessage('${user.id}')">
                        💌 Mensagem
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewProfile('${user.id}')">
                        👀 Ver Perfil
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    usersGrid.innerHTML = userCards;
}

// ==================== SISTEMA DE VISITANTES (SIMPLES) ====================
async function loadVisitorsSystem() {
    try {
        // Por enquanto, sempre mostrar versão free
        document.getElementById('premiumVisitors').style.display = 'none';
        document.getElementById('freeVisitors').style.display = 'block';
        
        // Simular contagem básica
        document.getElementById('freeVisitorsCount').textContent = '0 pessoas';
        document.getElementById('visitorsCount').textContent = '0 visitas';
        
    } catch (error) {
        console.error('❌ Erro no sistema de visitantes:', error);
    }
}

// ==================== FUNÇÕES BÁSICAS ====================
function sendMessage(userId, event) {
    if (event) event.stopPropagation();
    showNotification('💌 Redirecionando para mensagens...', 'info');
    // Implementar depois
}

function viewProfile(userId, event) {
    if (event) event.stopPropagation();
    showNotification('👀 Redirecionando para perfil...', 'info');
    // Implementar depois
}

// ==================== ESTATÍSTICAS BÁSICAS ====================
async function updateStats() {
    try {
        // Valores simulados por enquanto
        document.getElementById('usersOnline').textContent = '0';
        document.getElementById('totalUsers').textContent = '1';
        document.getElementById('newMatches').textContent = '0';
        document.getElementById('profileViews').textContent = '0';
        
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
    }
}

// ==================== UTILITÁRIOS ====================
function showEmptyState(message) {
    const usersGrid = document.getElementById('usersGrid');
    usersGrid.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <h3>Nenhum usuário encontrado</h3>
            <p>${message}</p>
        </div>
    `;
}

// ==================== EXPORTAÇÃO ====================
window.sendMessage = sendMessage;
window.viewProfile = viewProfile;