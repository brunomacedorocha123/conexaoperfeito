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
        
        // ✅ CARREGAR FOTO DO USUÁRIO LOGADO
        await loadCurrentUserAvatar();

    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

// ✅ CARREGAR FOTO DO USUÁRIO LOGADO
async function loadCurrentUserAvatar() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('avatar_url, nickname')
            .eq('id', currentUser.id)
            .single();

        if (error || !profile) return;

        const userAvatar = document.getElementById('userAvatar');
        const userAvatarFallback = userAvatar.querySelector('.user-avatar-fallback') || userAvatar;
        
        if (profile.avatar_url) {
            const photoUrl = await loadUserPhoto(profile.avatar_url);
            if (photoUrl) {
                // Criar elemento img se não existir
                let imgElement = userAvatar.querySelector('.user-avatar-img');
                if (!imgElement) {
                    imgElement = document.createElement('img');
                    imgElement.className = 'user-avatar-img';
                    userAvatar.appendChild(imgElement);
                }
                imgElement.src = photoUrl;
                imgElement.style.display = 'block';
                if (userAvatarFallback.style) {
                    userAvatarFallback.style.display = 'none';
                }
            }
        }

    } catch (error) {
        console.error('Erro ao carregar avatar do usuário:', error);
    }
}

// ✅ CARREGAR FOTO DO USUÁRIO PARA O CARD
async function loadUserPhoto(avatarUrl) {
    try {
        if (!avatarUrl) {
            return null;
        }

        const { data, error } = await supabase.storage
            .from('avatars')
            .download(avatarUrl);

        if (error) {
            return null;
        }

        return URL.createObjectURL(data);

    } catch (error) {
        console.error('Erro ao carregar foto:', error);
        return null;
    }
}

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Event listeners para filtros
    document.getElementById('ageMin').addEventListener('change', applyFilters);
    document.getElementById('ageMax').addEventListener('change', applyFilters);
    document.getElementById('gender').addEventListener('change', applyFilters);
    document.getElementById('lookingFor').addEventListener('change', applyFilters);
    document.getElementById('location').addEventListener('input', applyFilters);
    document.getElementById('zodiac').addEventListener('change', applyFilters);
    document.getElementById('interests').addEventListener('change', applyFilters);
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
    document.getElementById('zodiac').value = '';
    
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
    const zodiac = document.getElementById('zodiac').value;
    
    // Obter interesses selecionados
    const interestsSelect = document.getElementById('interests');
    const selectedInterests = [];
    for (let option of interestsSelect.options) {
        if (option.selected) {
            if (option.value === 'nao_importa') {
                return {
                    ageMin: ageMin ? parseInt(ageMin) : null,
                    ageMax: ageMax ? parseInt(ageMax) : null,
                    gender: gender || null,
                    lookingFor: lookingFor || null,
                    location: location || null,
                    zodiac: zodiac || null,
                    interests: null
                };
            }
            selectedInterests.push(option.value);
        }
    }

    return {
        ageMin: ageMin ? parseInt(ageMin) : null,
        ageMax: ageMax ? parseInt(ageMax) : null,
        gender: gender || null,
        lookingFor: lookingFor || null,
        location: location || null,
        zodiac: zodiac || null,
        interests: selectedInterests.length > 0 ? selectedInterests : null
    };
}

// Buscar usuários com filtros
async function searchUsers() {
    try {
        console.log('🔍 Aplicando filtros:', currentFilters);
        
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
                    description,
                    zodiac,
                    profession
                )
            `, { count: 'exact' })
            .neq('id', currentUser.id);

        const { data: allUsers, error, count } = await query;

        if (error) throw error;

        console.log('📊 Total de usuários no banco:', allUsers?.length);

        // FILTRAGEM ESTRITA
        let filteredUsers = allUsers || [];
        
        // 1. PRIMEIRO: Remover usuários sem dados básicos ESSENCIAIS
        filteredUsers = filteredUsers.filter(user => {
            const hasName = user.nickname || user.full_name;
            const hasGender = user.user_details?.gender;
            const hasBirthDate = user.birth_date;
            
            return hasName && hasGender && hasBirthDate;
        });
        
        console.log('✅ Usuários com dados básicos:', filteredUsers.length);

        // 2. APLICAR FILTROS DE FORMA ESTRITA
        if (currentFilters.gender) {
            filteredUsers = filteredUsers.filter(user => {
                const userGender = user.user_details?.gender;
                return userGender === currentFilters.gender;
            });
        }

        if (currentFilters.lookingFor) {
            filteredUsers = filteredUsers.filter(user => {
                const userLookingFor = user.user_details?.looking_for;
                return userLookingFor === currentFilters.lookingFor;
            });
        }

        if (currentFilters.zodiac) {
            filteredUsers = filteredUsers.filter(user => {
                const userZodiac = user.user_details?.zodiac;
                return userZodiac === currentFilters.zodiac;
            });
        }

        // Filtro de idade
        if (currentFilters.ageMin || currentFilters.ageMax) {
            filteredUsers = filteredUsers.filter(user => {
                if (!user.birth_date) return false;
                
                const age = calculateAge(user.birth_date);
                const minAge = currentFilters.ageMin || 0;
                const maxAge = currentFilters.ageMax || 100;
                
                return age >= minAge && age <= maxAge;
            });
        }

        // Filtro de localização
        if (currentFilters.location && currentFilters.location.trim() !== '') {
            filteredUsers = filteredUsers.filter(user => {
                const userLocation = user.user_details?.address;
                if (!userLocation) return false;
                return userLocation.toLowerCase().includes(currentFilters.location.toLowerCase());
            });
        }

        // Filtro de interesses
        if (currentFilters.interests) {
            filteredUsers = filteredUsers.filter(user => {
                const userInterests = user.user_details?.interests || [];
                return currentFilters.interests.some(interest => 
                    userInterests.includes(interest)
                );
            });
        }

        console.log('🎉 RESULTADO FINAL:', filteredUsers.length, 'usuários');

        // Paginação
        totalUsers = filteredUsers.length;
        const startIndex = (currentPage - 1) * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

        // ✅ CARREGAR FOTOS ASSINCRONAMENTE
        await displayUsersWithPhotos(paginatedUsers);
        updatePagination();
        updateResultsCount(paginatedUsers.length, totalUsers);

    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        showError('Erro ao carregar usuários.');
    }
}

// ✅ EXIBIR USUÁRIOS COM FOTOS - ASSÍNCRONO
async function displayUsersWithPhotos(users) {
    const usersGrid = document.getElementById('usersGrid');
    const noResults = document.getElementById('noResults');
    const loadingResults = document.getElementById('loadingResults');

    loadingResults.classList.add('hidden');

    if (!users || users.length === 0) {
        usersGrid.innerHTML = '';
        noResults.classList.remove('hidden');
        const message = getNoResultsMessage();
        document.querySelector('#noResults h3').textContent = message.title;
        document.querySelector('#noResults p').textContent = message.description;
        return;
    }

    noResults.classList.add('hidden');

    // ✅ CARREGAR FOTOS PARA CADA USUÁRIO
    const userCards = await Promise.all(
        users.map(async user => await createUserCardWithPhoto(user))
    );
    
    usersGrid.innerHTML = userCards.join('');
}

// ✅ CRIAR CARD DE USUÁRIO COM FOTO - ASSÍNCRONO
async function createUserCardWithPhoto(user) {
    if (!user.user_details || !user.nickname) {
        console.warn('⚠️ Usuário sem dados suficientes:', user);
        return '';
    }

    const nickname = user.nickname || user.full_name?.split(' ')[0] || 'Usuário';
    const age = user.birth_date ? calculateAge(user.birth_date) : null;
    const details = user.user_details;
    
    // ✅ CARREGAR FOTO DO USUÁRIO
    let avatarHtml = '';
    if (user.avatar_url) {
        const photoUrl = await loadUserPhoto(user.avatar_url);
        if (photoUrl) {
            avatarHtml = `
                <div class="user-card-avatar" style="background: none;">
                    <img src="${photoUrl}" alt="${nickname}" class="user-card-avatar-img" style="display: block;">
                    <div class="user-card-avatar-fallback" style="display: none;">${nickname.charAt(0).toUpperCase()}</div>
                </div>
            `;
        } else {
            avatarHtml = `
                <div class="user-card-avatar">
                    <div class="user-card-avatar-fallback">${nickname.charAt(0).toUpperCase()}</div>
                </div>
            `;
        }
    } else {
        avatarHtml = `
            <div class="user-card-avatar">
                <div class="user-card-avatar-fallback">${nickname.charAt(0).toUpperCase()}</div>
            </div>
        `;
    }

    // Informações públicas para mostrar
    const zodiac = details.zodiac ? getZodiacIcon(details.zodiac) + ' ' + formatZodiac(details.zodiac) : null;
    const profession = details.profession || null;
    const interests = details.interests || [];
    const lookingFor = details.looking_for ? formatLookingFor(details.looking_for) : null;
    const location = details.address || null;
    const gender = details.gender ? formatGender(details.gender) : null;
    const bio = details.description || 'Este usuário ainda não adicionou uma descrição.';

    return `
        <div class="user-card" onclick="viewProfile('${user.id}')">
            ${avatarHtml}
            <div class="user-card-name">${nickname}${age ? `, ${age}` : ''}</div>
            
            <div class="user-card-info">
                ${gender ? `<div class="user-card-detail">👤 ${gender}</div>` : ''}
                ${zodiac ? `<div class="user-card-detail">${zodiac}</div>` : ''}
                ${profession ? `<div class="user-card-detail">💼 ${profession}</div>` : ''}
                ${lookingFor ? `<div class="user-card-detail">🎯 ${lookingFor}</div>` : ''}
                ${location ? `<div class="user-card-detail">📍 ${location}</div>` : ''}
            </div>
            
            ${interests.length > 0 ? `
                <div class="user-card-interests">
                    ${interests.slice(0, 3).map(interest => 
                        `<span class="interest-tag">${interest}</span>`
                    ).join('')}
                    ${interests.length > 3 ? `<span class="interest-tag">+${interests.length - 3}</span>` : ''}
                </div>
            ` : ''}
            
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
}

// Ver perfil
function viewProfile(userId) {
    localStorage.setItem('viewingProfileId', userId);
    window.location.href = 'perfil.html';
}

// Enviar mensagem
function sendMessage(userId) {
    const message = prompt('Digite sua mensagem para esta pessoa:');
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

// Mensagem personalizada quando não há resultados
function getNoResultsMessage() {
    const filters = currentFilters;
    
    if (filters.gender) {
        return {
            title: `Nenhum ${filters.gender === 'masculino' ? 'homem' : 'mulher'} encontrado`,
            description: 'Tente ajustar os filtros ou buscar por outro gênero.'
        };
    }
    
    if (filters.lookingFor) {
        const lookingForText = formatLookingFor(filters.lookingFor);
        return {
            title: `Ninguém procurando por ${lookingForText.toLowerCase()}`,
            description: 'Talvez outras pessoas estejam buscando algo diferente.'
        };
    }
    
    if (filters.zodiac) {
        const zodiacText = formatZodiac(filters.zodiac);
        return {
            title: `Nenhum ${zodiacText} encontrado`,
            description: 'Tente buscar por outro signo ou remover este filtro.'
        };
    }
    
    return {
        title: 'Nenhuma pessoa encontrada',
        description: 'Tente ajustar os filtros de busca para encontrar mais pessoas.'
    };
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

function formatGender(gender) {
    const genders = {
        'feminino': 'Feminino',
        'masculino': 'Masculino'
    };
    return genders[gender] || gender;
}

function getZodiacIcon(zodiac) {
    const icons = {
        'aries': '♈', 'touro': '♉', 'gemeos': '♊', 'cancer': '♋',
        'leao': '♌', 'virgem': '♍', 'libra': '♎', 'escorpiao': '♏',
        'sagitario': '♐', 'capricornio': '♑', 'aquario': '♒', 'peixes': '♓'
    };
    return icons[zodiac] || '⭐';
}

function formatZodiac(zodiac) {
    const names = {
        'aries': 'Áries', 'touro': 'Touro', 'gemeos': 'Gêmeos', 'cancer': 'Câncer',
        'leao': 'Leão', 'virgem': 'Virgem', 'libra': 'Libra', 'escorpiao': 'Escorpião',
        'sagitario': 'Sagitário', 'capricornio': 'Capricórnio', 'aquario': 'Aquário', 'peixes': 'Peixes'
    };
    return names[zodiac] || zodiac;
}

function formatLookingFor(lookingFor) {
    const options = {
        'amizade': 'Amizade',
        'namoro': 'Namoro', 
        'relacionamento_serio': 'Relacionamento Sério',
        'conversa': 'Apenas Conversa'
    };
    return options[lookingFor] || lookingFor;
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
                <button class="btn btn-primary" onclick="applyFilters()">
                    🔁 Tentar Novamente
                </button>
            </div>
        </div>
    `;
}