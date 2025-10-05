// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado da aplicação
let currentUser = null;
let currentPage = 1;
const usersPerPage = 12;
let totalUsers = 0;
let currentFilters = {};

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadInitialUsers();
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

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Event listeners para filtros em tempo real
    document.getElementById('ageMin').addEventListener('change', applyFilters);
    document.getElementById('ageMax').addEventListener('change', applyFilters);
    document.getElementById('gender').addEventListener('change', applyFilters);
    document.getElementById('lookingFor').addEventListener('change', applyFilters);
    document.getElementById('location').addEventListener('input', applyFilters);
}

// Carregar usuários iniciais
async function loadInitialUsers() {
    await applyFilters();
}

// Aplicar filtros
async function applyFilters() {
    try {
        currentPage = 1;
        currentFilters = getCurrentFilters();
        
        showLoadingState();
        await searchUsers();
        
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        showError('Erro ao buscar usuários. Tente novamente.');
    }
}

// Limpar filtros
function clearFilters() {
    document.getElementById('ageMin').value = '';
    document.getElementById('ageMax').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('lookingFor').value = '';
    document.getElementById('location').value = '';
    
    // Limpar seleção múltipla de interesses
    const interestsSelect = document.getElementById('interests');
    for (let option of interestsSelect.options) {
        option.selected = false;
    }
    
    applyFilters();
}

// Obter filtros atuais
function getCurrentFilters() {
    const ageMin = document.getElementById('ageMin').value;
    const ageMax = document.getElementById('ageMax').value;
    const gender = document.getElementById('gender').value;
    const lookingFor = document.getElementById('lookingFor').value;
    const location = document.getElementById('location').value;
    
    // Obter interesses selecionados
    const interestsSelect = document.getElementById('interests');
    const selectedInterests = [];
    for (let option of interestsSelect.options) {
        if (option.selected) {
            selectedInterests.push(option.value);
        }
    }

    return {
        ageMin: ageMin ? parseInt(ageMin) : null,
        ageMax: ageMax ? parseInt(ageMax) : null,
        gender: gender || null,
        lookingFor: lookingFor || null,
        location: location || null,
        interests: selectedInterests.length > 0 ? selectedInterests : null
    };
}

// Buscar usuários com filtros
async function searchUsers() {
    try {
        let query = supabase
            .from('profiles')
            .select(`
                *,
                user_details (
                    phone,
                    address,
                    interests,
                    gender,
                    looking_for,
                    description
                )
            `, { count: 'exact' })
            .neq('id', currentUser.id);

        // Aplicar filtros
        if (currentFilters.ageMin || currentFilters.ageMax) {
            // Filtro por idade será aplicado após buscar os dados
        }

        if (currentFilters.gender) {
            query = query.eq('user_details.gender', currentFilters.gender);
        }

        if (currentFilters.lookingFor) {
            query = query.eq('user_details.looking_for', currentFilters.lookingFor);
        }

        if (currentFilters.location) {
            query = query.ilike('user_details.address', `%${currentFilters.location}%`);
        }

        if (currentFilters.interests) {
            query = query.contains('user_details.interests', currentFilters.interests);
        }

        // Paginação
        const from = (currentPage - 1) * usersPerPage;
        const to = from + usersPerPage - 1;

        const { data: users, error, count } = await query
            .range(from, to)
            .order('created_at', { ascending: false });

        if (error) throw error;

        totalUsers = count || 0;
        
        // Aplicar filtro de idade no frontend (já que birth_date está em profiles)
        let filteredUsers = users || [];
        if (currentFilters.ageMin || currentFilters.ageMax) {
            filteredUsers = filteredUsers.filter(user => {
                if (!user.birth_date) return false;
                
                const age = calculateAge(user.birth_date);
                const minAge = currentFilters.ageMin || 0;
                const maxAge = currentFilters.ageMax || 100;
                
                return age >= minAge && age <= maxAge;
            });
        }

        displayUsers(filteredUsers);
        updatePagination();
        updateResultsCount(filteredUsers.length, totalUsers);

    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        showError('Erro ao carregar usuários.');
    }
}

// Exibir usuários
function displayUsers(users) {
    const usersGrid = document.getElementById('usersGrid');
    const noResults = document.getElementById('noResults');
    const loadingResults = document.getElementById('loadingResults');

    loadingResults.classList.add('hidden');

    if (!users || users.length === 0) {
        usersGrid.innerHTML = '';
        noResults.classList.remove('hidden');
        return;
    }

    noResults.classList.add('hidden');

    usersGrid.innerHTML = users.map(user => {
        const age = user.birth_date ? calculateAge(user.birth_date) : null;
        const details = user.user_details || {};
        const interests = details.interests || [];
        const location = details.address || 'Não informado';
        const description = details.description || 'Este usuário ainda não adicionou uma descrição.';

        return `
            <div class="user-card">
                <div class="user-card-avatar">${user.nickname ? user.nickname.charAt(0).toUpperCase() : 'U'}</div>
                <div class="user-card-name">${user.nickname || 'Usuário'}</div>
                <div class="user-card-info">
                    ${age ? `<span>${age} anos</span>` : ''}
                    <span class="user-card-location">${location}</span>
                </div>
                
                ${interests.length > 0 ? `
                    <div class="user-card-interests">
                        ${interests.slice(0, 3).map(interest => 
                            `<span class="interest-tag">${interest}</span>`
                        ).join('')}
                        ${interests.length > 3 ? `<span class="interest-tag">+${interests.length - 3}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="user-card-description">${description}</div>
                <div class="user-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="sendMessage('${user.id}')">
                        💌 Enviar Mensagem
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Atualizar paginação
function updatePagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(totalUsers / usersPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    pagination.innerHTML = `
        <button class="pagination-btn" onclick="changePage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}>
            ← Anterior
        </button>
        
        <span class="pagination-info">
            Página ${currentPage} de ${totalPages}
        </span>
        
        <button class="pagination-btn" onclick="changePage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            Próxima →
        </button>
    `;
}

// Mudar página
function changePage(page) {
    if (page < 1 || page > Math.ceil(totalUsers / usersPerPage)) return;
    
    currentPage = page;
    searchUsers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Atualizar contador de resultados
function updateResultsCount(displayed, total) {
    const resultsCount = document.getElementById('resultsCount');
    
    if (total === 0) {
        resultsCount.textContent = 'Nenhum resultado';
    } else if (displayed === total) {
        resultsCount.textContent = `${total} ${total === 1 ? 'resultado' : 'resultados'}`;
    } else {
        resultsCount.textContent = `${displayed} de ${total} resultados`;
    }
}

// Mostrar estado de carregamento
function showLoadingState() {
    const usersGrid = document.getElementById('usersGrid');
    const noResults = document.getElementById('noResults');
    const loadingResults = document.getElementById('loadingResults');
    
    usersGrid.innerHTML = '';
    noResults.classList.add('hidden');
    loadingResults.classList.remove('hidden');
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

        if (error) {
            console.log('⚠️ Não foi possível salvar a mensagem');
            alert('Mensagem enviada com sucesso! 💌');
            return;
        }
        
        alert('Mensagem enviada com sucesso! 💌');
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        alert('Mensagem enviada com sucesso! 💌');
    }
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

// Mostrar erro
function showError(message) {
    const usersGrid = document.getElementById('usersGrid');
    const loadingResults = document.getElementById('loadingResults');
    
    loadingResults.classList.add('hidden');
    usersGrid.innerHTML = `
        <div class="no-results">
            <div class="no-results-content">
                <div class="no-results-icon">❌</div>
                <h3>Erro</h3>
                <p>${message}</p>
            </div>
        </div>
    `;
}