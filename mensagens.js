// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado da aplicação
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
});

// Verificar autenticação
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        await loadConversations();
        updateMessagesStats();
        
    } catch (error) {
        console.error('Erro na autenticação:', error);
        window.location.href = 'login.html';
    }
}

// Carregar dados do usuário
async function loadUserData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        let displayName = 'Usuário';
        
        if (user.user_metadata && user.user_metadata.nickname) {
            displayName = user.user_metadata.nickname;
        } else if (user.user_metadata && user.user_metadata.full_name) {
            displayName = user.user_metadata.full_name;
        } else if (user.email) {
            displayName = user.email.split('@')[0];
        }

        document.getElementById('userNickname').textContent = displayName;
        document.getElementById('userAvatar').textContent = displayName.charAt(0).toUpperCase();

    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

// Carregar conversas
async function loadConversations() {
    try {
        showLoadingState();
        
        // Buscar mensagens onde o usuário atual é o receptor
        const { data: receivedMessages, error: receivedError } = await supabase
            .from('messages')
            .select(`
                *,
                profiles:sender_id (
                    nickname,
                    birth_date
                )
            `)
            .eq('receiver_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (receivedError) throw receivedError;

        // Buscar mensagens onde o usuário atual é o remetente
        const { data: sentMessages, error: sentError } = await supabase
            .from('messages')
            .select(`
                *,
                profiles:receiver_id (
                    nickname,
                    birth_date
                )
            `)
            .eq('sender_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (sentError) throw sentError;

        // Combinar e organizar conversas
        const conversations = organizeConversations(receivedMessages || [], sentMessages || []);
        displayConversations(conversations);
        updateConversationsInfo(conversations.length);

    } catch (error) {
        console.error('Erro ao carregar conversas:', error);
        showError('Erro ao carregar mensagens.');
    }
}

// Organizar conversas por usuário
function organizeConversations(receivedMessages, sentMessages) {
    const conversationsMap = new Map();

    // Processar mensagens recebidas
    receivedMessages.forEach(msg => {
        const otherUserId = msg.sender_id;
        const otherUser = msg.profiles;
        
        if (!conversationsMap.has(otherUserId)) {
            conversationsMap.set(otherUserId, {
                user_id: otherUserId,
                nickname: otherUser?.nickname || 'Usuário',
                age: otherUser?.birth_date ? calculateAge(otherUser.birth_date) : null,
                last_message: msg.content,
                last_message_time: msg.created_at,
                unread: !msg.is_read,
                message_count: 1,
                last_interaction: msg.created_at
            });
        } else {
            const existing = conversationsMap.get(otherUserId);
            if (new Date(msg.created_at) > new Date(existing.last_interaction)) {
                existing.last_message = msg.content;
                existing.last_message_time = msg.created_at;
                existing.unread = existing.unread || !msg.is_read;
            }
            existing.message_count++;
        }
    });

    // Processar mensagens enviadas
    sentMessages.forEach(msg => {
        const otherUserId = msg.receiver_id;
        const otherUser = msg.profiles;
        
        if (!conversationsMap.has(otherUserId)) {
            conversationsMap.set(otherUserId, {
                user_id: otherUserId,
                nickname: otherUser?.nickname || 'Usuário',
                age: otherUser?.birth_date ? calculateAge(otherUser.birth_date) : null,
                last_message: msg.content,
                last_message_time: msg.created_at,
                unread: false,
                message_count: 1,
                last_interaction: msg.created_at
            });
        } else {
            const existing = conversationsMap.get(otherUserId);
            if (new Date(msg.created_at) > new Date(existing.last_interaction)) {
                existing.last_message = msg.content;
                existing.last_message_time = msg.created_at;
            }
            existing.message_count++;
        }
    });

    // Converter para array e ordenar por última interação
    return Array.from(conversationsMap.values())
        .sort((a, b) => new Date(b.last_interaction) - new Date(a.last_interaction));
}

// Exibir conversas
function displayConversations(conversations) {
    const conversationsGrid = document.getElementById('conversationsGrid');
    const noConversations = document.getElementById('noConversations');
    const loadingConversations = document.getElementById('loadingConversations');

    loadingConversations.classList.add('hidden');

    if (!conversations || conversations.length === 0) {
        conversationsGrid.innerHTML = '';
        noConversations.classList.remove('hidden');
        return;
    }

    noConversations.classList.add('hidden');

    conversationsGrid.innerHTML = conversations.map(conv => {
        const timeAgo = formatTime(conv.last_message_time);
        const unreadBadge = conv.unread ? '<span class="unread-badge">●</span>' : '';

        return `
            <div class="user-card conversation-card" onclick="openConversation('${conv.user_id}')">
                <div class="user-card-avatar">${conv.nickname.charAt(0).toUpperCase()}</div>
                <div class="conversation-header">
                    <div class="user-card-name">
                        ${conv.nickname}
                        ${unreadBadge}
                    </div>
                    <div class="conversation-time">${timeAgo}</div>
                </div>
                <div class="user-card-info">
                    ${conv.age ? `<span>${conv.age} anos</span>` : ''}
                    <span class="message-count">${conv.message_count} ${conv.message_count === 1 ? 'mensagem' : 'mensagens'}</span>
                </div>
                <div class="conversation-preview">
                    ${conv.last_message}
                </div>
                <div class="user-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); sendMessage('${conv.user_id}')">
                        💌 Responder
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Atualizar estatísticas
async function updateMessagesStats() {
    try {
        // Total de mensagens recebidas
        const { count: totalReceived } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id);

        // Mensagens não lidas
        const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);

        // Total de mensagens enviadas
        const { count: totalSent } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', currentUser.id);

        // Número de conversas únicas
        const { count: conversationsCount } = await supabase
            .from('messages')
            .select('sender_id', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id);

        document.getElementById('totalMessages').textContent = (totalReceived || 0) + (totalSent || 0);
        document.getElementById('unreadMessages').textContent = unreadCount || 0;
        document.getElementById('conversationsCount').textContent = conversationsCount || 0;
        document.getElementById('sentMessages').textContent = totalSent || 0;

    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Atualizar info de conversas
function updateConversationsInfo(count) {
    const conversationsInfo = document.getElementById('conversationsInfo');
    conversationsInfo.textContent = `${count} ${count === 1 ? 'conversa' : 'conversas'}`;
}

// Abrir conversa
function openConversation(userId) {
    sendMessage(userId);
}

// Enviar mensagem
function sendMessage(userId) {
    const message = prompt('Digite sua mensagem:');
    if (message && message.trim()) {
        sendMessageToUser(userId, message.trim());
    }
}

async function sendMessageToUser(receiverId, content) {
    try {
        const { error } = await supabase
            .from('messages')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: receiverId,
                    content: content
                }
            ]);

        if (error) throw error;
        
        alert('Mensagem enviada com sucesso! 💌');
        await loadConversations();
        await updateMessagesStats();
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem. Tente novamente.');
    }
}

// Mostrar estado de carregamento
function showLoadingState() {
    const conversationsGrid = document.getElementById('conversationsGrid');
    const noConversations = document.getElementById('noConversations');
    const loadingConversations = document.getElementById('loadingConversations');
    
    conversationsGrid.innerHTML = '';
    noConversations.classList.add('hidden');
    loadingConversations.classList.remove('hidden');
}

// Mostrar erro
function showError(message) {
    const conversationsGrid = document.getElementById('conversationsGrid');
    const loadingConversations = document.getElementById('loadingConversations');
    
    loadingConversations.classList.add('hidden');
    conversationsGrid.innerHTML = `
        <div class="no-results">
            <div class="no-results-content">
                <div class="no-results-icon">❌</div>
                <h3>Erro</h3>
                <p>${message}</p>
            </div>
        </div>
    `;
}

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

// Logout
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao fazer logout. Tente novamente.');
    }
}

// Funções auxiliares
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

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    
    return date.toLocaleDateString('pt-BR');
}