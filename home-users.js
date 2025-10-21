// home-users.js - ATUALIZADO COM SISTEMA DE FAVORITOS
class HomeUsersSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.userProfile = null;
        this.favoriteSystem = null;
    }

    async initialize(userProfile) {
        this.userProfile = userProfile;
        
        // 🔥 NOVO: Inicializar sistema de favoritos se disponível
        if (window.favoriteSystem) {
            this.favoriteSystem = window.favoriteSystem;
            console.log('✅ Sistema de favoritos integrado ao users system');
        }
        
        await this.loadRealUsers();
    }

    // ✅ CORREÇÃO CRÍTICA: Carregar usuários OTIMIZADO com função SQL
    async loadRealUsers() {
        try {
            console.log('👥 Carregando usuários OTIMIZADO...');
            
            const limit = window.innerWidth <= 768 ? 4 : 8;
            
            // ✅ USAR A FUNÇÃO SQL OTIMIZADA QUE JÁ FILTRA BLOQUEIOS
            const { data: users, error } = await this.supabase.rpc(
                'get_home_users_optimized', {
                    current_user_uuid: this.currentUser.id,
                    limit_count: limit
                }
            );

            if (error) {
                console.error('Erro ao carregar usuários otimizado:', error);
                // Fallback para query normal
                await this.loadRealUsersFallback(limit);
                return;
            }

            console.log(`✅ ${users?.length || 0} usuários encontrados (OTIMIZADO)`);

            if (!users || users.length === 0) {
                this.showEmptyState('Ainda não há outros usuários cadastrados.');
                return;
            }
            
            await this.displayUsersWithPhotos(users);

        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            this.showEmptyState('Erro ao carregar usuários.');
        }
    }

    // ✅ FALLBACK se a função SQL falhar
    async loadRealUsersFallback(limit) {
        console.log('🔄 Usando fallback...');
        
        const { data: users, error } = await this.supabase
            .from('profiles')
            .select(`
                id,
                nickname,
                full_name,
                birth_date,
                avatar_url,
                last_online_at,
                is_invisible,
                user_details (
                    gender,
                    zodiac,
                    profession,
                    interests,
                    looking_for,
                    description
                )
            `)
            .neq('id', this.currentUser.id)
            .limit(limit)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        await this.displayUsersWithPhotos(users);
    }

    // Exibir usuários com fotos
    async displayUsersWithPhotos(users) {
        const usersGrid = document.getElementById('usersGrid');
        if (!usersGrid) {
            console.error('❌ usersGrid não encontrado');
            return;
        }
        
        const userCards = [];
        
        for (const user of users) {
            // ✅ AGORA O FILTRO DE BLOQUEIO É FEITO NO SQL, SEM VERIFICAÇÃO AQUI
            const card = await this.createUserCardWithPhoto(user);
            if (card) userCards.push(card);
        }
        
        console.log(`🎯 Exibindo ${userCards.length} cards`);
        usersGrid.innerHTML = userCards.join('');
        
        if (userCards.length === 0) {
            this.showEmptyState('Nenhum usuário disponível no momento.');
        }
    }

    // ✅ ATUALIZADO: Criar card com BOTÃO DE FAVORITO
    async createUserCardWithPhoto(user) {
        try {
            // ✅ CORREÇÃO: A função SQL retorna campos diferentes, precisamos adaptar
            const userId = user.user_id || user.id;
            const nickname = user.nickname || user.full_name?.split(' ')[0] || 'Usuário';
            const age = user.birth_date ? this.calculateAge(user.birth_date) : null;
            
            // ✅ CORREÇÃO: Dados podem vir de user_details JSONB ou do objeto principal
            let details = {};
            if (user.user_details) {
                details = user.user_details; // Veio da função SQL
            } else if (user.user_details) {
                details = user.user_details; // Veio do fallback
            }
            
            // 🔥 NOVO: Verificar se usuário já é favorito
            let isFavorite = false;
            if (this.favoriteSystem) {
                isFavorite = await this.favoriteSystem.isUserFavorite(userId);
            }
            
            // Status online
            const isOnline = this.isUserOnline(user, this.currentUser.id);
            const onlineBadge = isOnline ? 
                '<div class="online-badge" title="Online"></div>' : 
                '<div class="offline-badge" title="Offline"></div>';
            
            // ✅ CORREÇÃO CRÍTICA: Usar IMG tag igual no perfil.html
            let avatarHtml = '';
            if (user.avatar_url) {
                const photoUrl = await this.loadUserPhoto(user.avatar_url);
                if (photoUrl) {
                    avatarHtml = `
                        <div class="user-card-avatar">
                            <img class="user-card-avatar-img" src="${photoUrl}" alt="${nickname}" style="display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                            <div class="user-card-avatar-fallback" style="display: none;">${nickname.charAt(0).toUpperCase()}</div>
                            ${onlineBadge}
                        </div>
                    `;
                }
            }
            
            // ✅ Fallback apenas se não tiver foto
            if (!avatarHtml) {
                avatarHtml = `
                    <div class="user-card-avatar">
                        <div class="user-card-avatar-fallback">${nickname.charAt(0).toUpperCase()}</div>
                        ${onlineBadge}
                    </div>
                `;
            }

            const zodiac = details.zodiac || user.zodiac;
            const profession = details.profession || user.profession;
            const lookingFor = details.looking_for || user.looking_for;
            const bio = details.description || user.description || 'Este usuário ainda não adicionou uma descrição.';

            // 🔥 NOVO: Botão de favorito com estado inicial correto
            const favoriteIcon = isFavorite ? '❤️' : '🤍';
            const favoriteTitle = isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
            const favoriteClass = isFavorite ? 'favorite-btn favorited' : 'favorite-btn';

            return `
                <div class="user-card" data-user-id="${userId}" onclick="viewProfile('${userId}')">
                    ${avatarHtml}
                    
                    <div class="user-card-header">
                        <div class="user-card-name">${nickname}${age ? `, ${age}` : ''}</div>
                        <!-- 🔥 NOVO: BOTÃO DE FAVORITO -->
                        <button class="${favoriteClass}" onclick="event.stopPropagation(); toggleFavorite('${userId}', event)" 
                                title="${favoriteTitle}">
                            ${favoriteIcon}
                        </button>
                    </div>
                    
                    <div class="user-card-info">
                        ${zodiac ? `<div class="user-card-detail">${this.getZodiacIcon(zodiac)} ${this.formatZodiac(zodiac)}</div>` : ''}
                        ${profession ? `<div class="user-card-detail">💼 ${profession}</div>` : ''}
                        ${lookingFor ? `<div class="user-card-detail">🎯 ${this.formatLookingFor(lookingFor)}</div>` : ''}
                    </div>
                    
                    <div class="user-card-bio">${bio}</div>
                    
                    <div class="user-card-actions">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); sendMessage('${userId}')">
                            💌 Mensagem
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewProfile('${userId}')">
                            👀 Ver Perfil
                        </button>
                        <div class="user-card-menu">
                            <button class="btn-more" onclick="event.stopPropagation(); toggleMenu(this)" title="Mais opções">
                                ⋯
                            </button>
                            <div class="menu-options">
                                <button class="report-btn" onclick="event.stopPropagation(); openReportModal('${userId}', '${nickname}')">
                                    🚨 Reportar
                                </button>
                                <button class="block-btn" onclick="event.stopPropagation(); openBlockModal('${userId}', '${nickname}')">
                                    🚫 Bloquear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erro ao criar card:', error);
            return '';
        }
    }

    // 🔥 NOVO: Atualizar estado do botão de favorito em um card específico
    async updateFavoriteButton(userId, isFavorite) {
        const card = document.querySelector(`.user-card[data-user-id="${userId}"]`);
        if (!card) return;
        
        const favoriteBtn = card.querySelector('.favorite-btn');
        if (!favoriteBtn) return;
        
        if (isFavorite) {
            favoriteBtn.innerHTML = '❤️';
            favoriteBtn.title = 'Remover dos favoritos';
            favoriteBtn.classList.add('favorited');
        } else {
            favoriteBtn.innerHTML = '🤍';
            favoriteBtn.title = 'Adicionar aos favoritos';
            favoriteBtn.classList.remove('favorited');
        }
    }

    // Carregar foto do usuário
    async loadUserPhoto(avatarUrl) {
        try {
            if (!avatarUrl) return null;
            const { data } = this.supabase.storage.from('avatars').getPublicUrl(avatarUrl);
            return data?.publicUrl || null;
        } catch (error) {
            return null;
        }
    }

    // ==================== FUNÇÕES AUXILIARES ====================

    calculateAge(birthDate) {
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

    formatZodiac(zodiac) {
        const zodiacMap = {
            'aries': 'Áries', 'taurus': 'Touro', 'gemini': 'Gêmeos', 'cancer': 'Câncer',
            'leo': 'Leão', 'virgo': 'Virgem', 'libra': 'Libra', 'scorpio': 'Escorpião',
            'sagittarius': 'Sagitário', 'capricorn': 'Capricórnio', 'aquarius': 'Aquário', 'pisces': 'Peixes'
        };
        return zodiacMap[zodiac?.toLowerCase()] || zodiac;
    }

    getZodiacIcon(zodiac) {
        const zodiacIcons = {
            'aries': '♈', 'taurus': '♉', 'gemini': '♊', 'cancer': '♋',
            'leo': '♌', 'virgo': '♍', 'libra': '♎', 'scorpio': '♏',
            'sagittarius': '♐', 'capricorn': '♑', 'aquarius': '♒', 'pisces': '♓'
        };
        return zodiacIcons[zodiac?.toLowerCase()] || '✨';
    }

    formatLookingFor(lookingFor) {
        if (Array.isArray(lookingFor)) {
            return lookingFor.join(', ');
        }
        return lookingFor || 'Não informado';
    }

    isUserOnline(userProfile, currentUserId) {
        if (!userProfile.last_online_at) return false;
        const lastOnline = new Date(userProfile.last_online_at);
        const now = new Date();
        const minutesDiff = (now - lastOnline) / (1000 * 60);
        const isActuallyOnline = minutesDiff <= 5;
        if (userProfile.id === currentUserId) return true;
        if (userProfile.is_invisible && userProfile.id !== currentUserId) return false;
        return isActuallyOnline;
    }

    showEmptyState(message) {
        const usersGrid = document.getElementById('usersGrid');
        if (usersGrid) {
            usersGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>${message}</h3>
                    <p>Volte mais tarde para conhecer novas pessoas!</p>
                </div>
            `;
        }
    }

    // 🔥 NOVO: Recarregar usuários (útil após ações como bloqueio)
    async refreshUsers() {
        console.log('🔄 Recarregando usuários...');
        await this.loadRealUsers();
    }
}

// Inicializar quando o script carregar
let usersSystem = null;

function initializeUsersSystem(supabase, currentUser, userProfile) {
    usersSystem = new HomeUsersSystem(supabase, currentUser);
    return usersSystem.initialize(userProfile);
}

// 🔥 NOVO: Função global para atualizar favorito em cards específicos
window.updateFavoriteInCard = function(userId, isFavorite) {
    if (usersSystem) {
        usersSystem.updateFavoriteButton(userId, isFavorite);
    }
};

// 🔥 NOVO: Função global para recarregar usuários
window.refreshUsersGrid = function() {
    if (usersSystem) {
        usersSystem.refreshUsers();
    }
};

console.log('✅ home-users.js ATUALIZADO com sistema de favoritos!');