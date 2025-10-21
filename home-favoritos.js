// home-favoritos.js - Sistema de Favoritos e Lista VIP
class FavoriteSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.isPremium = false;
    }

    async initialize() {
        try {
            console.log('🎯 Inicializando sistema de favoritos...');
            
            // Verificar se usuário é premium
            await this.checkPremiumStatus();
            
            // Carregar contador de pulses
            await this.loadPulseCount();
            
            console.log('✅ Sistema de favoritos inicializado!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema de favoritos:', error);
        }
    }

    async checkPremiumStatus() {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', this.currentUser.id)
                .single();

            if (!error && profile) {
                this.isPremium = profile.is_premium || false;
                console.log(`👑 Status Premium: ${this.isPremium}`);
            }
        } catch (error) {
            console.error('Erro ao verificar status premium:', error);
        }
    }

    // ❤️ Curtir/Descurtir usuário
    async toggleFavorite(userId, userCardElement = null) {
        try {
            // Verificar se usuário está bloqueado
            if (window.blockSystem && window.blockSystem.isUserBlocked(userId)) {
                showQuickToast('🚫 Você bloqueou este usuário.');
                return;
            }

            // Verificar se está bloqueado pelo usuário
            const isBlockedByUser = await this.checkIfBlockedByUser(userId);
            if (isBlockedByUser) {
                showQuickToast('🚫 Este usuário te bloqueou.');
                if (window.blockSystem) {
                    window.blockSystem.removeUserCardImmediately(userId);
                }
                return;
            }

            console.log(`❤️ Alternando favorito para usuário: ${userId}`);

            // Verificar se já é favorito
            const { data: existingFavorite, error: checkError } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingFavorite) {
                // ❌ Remover dos favoritos
                await this.removeFavorite(userId, userCardElement);
            } else {
                // ✅ Adicionar aos favoritos
                await this.addFavorite(userId, userCardElement);
            }

        } catch (error) {
            console.error('❌ Erro ao alternar favorito:', error);
            showQuickToast('⚠️ Erro ao processar curtida. Tente novamente.');
        }
    }

    async addFavorite(userId, userCardElement) {
        try {
            const { data, error } = await this.supabase
                .from('user_favorites')
                .insert({
                    user_id: this.currentUser.id,
                    favorite_user_id: userId
                })
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Usuário adicionado aos favoritos:', data);

            // Atualizar UI do card
            if (userCardElement) {
                this.updateCardUI(userCardElement, true);
            }

            // Verificar se é match mútuo
            await this.checkMutualLike(userId);

            // Mostrar feedback
            if (this.isPremium) {
                showQuickToast('❤️ Adicionado à sua Lista VIP!');
            } else {
                showQuickToast('❤️ Curtida enviada! Torne-se Premium para salvar na Lista VIP.');
            }

        } catch (error) {
            console.error('❌ Erro ao adicionar favorito:', error);
            throw error;
        }
    }

    async removeFavorite(userId, userCardElement) {
        try {
            const { error } = await this.supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId);

            if (error) throw error;

            console.log('❌ Usuário removido dos favoritos:', userId);

            // Atualizar UI do card
            if (userCardElement) {
                this.updateCardUI(userCardElement, false);
            }

            showQuickToast('💔 Curtida removida');

        } catch (error) {
            console.error('❌ Erro ao remover favorito:', error);
            throw error;
        }
    }

    // 🔄 Verificar match mútuo
    async checkMutualLike(userId) {
        try {
            // Verificar se o outro usuário também curtiu
            const { data: mutualLike, error } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', userId)
                .eq('favorite_user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (mutualLike) {
                console.log('🔄 MATCH MÚTUO detectado!');
                await this.incrementPulseCount();
                showQuickToast('💝 Match! Vocês curtiram um ao outro!');
                
                // Notificar o outro usuário (opcional)
                await this.createMutualLikeNotification(userId);
            }

        } catch (error) {
            console.error('❌ Erro ao verificar match mútuo:', error);
        }
    }

    // 📈 Incrementar contador de pulses
    async incrementPulseCount() {
        try {
            // Verificar se já existe registro
            const { data: existingPulse, error: checkError } = await this.supabase
                .from('user_pulses')
                .select('id, pulse_count')
                .eq('user_id', this.currentUser.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingPulse) {
                // Atualizar contador existente
                const { error } = await this.supabase
                    .from('user_pulses')
                    .update({
                        pulse_count: existingPulse.pulse_count + 1,
                        last_updated: new Date().toISOString()
                    })
                    .eq('user_id', this.currentUser.id);

                if (error) throw error;
            } else {
                // Criar novo registro
                const { error } = await this.supabase
                    .from('user_pulses')
                    .insert({
                        user_id: this.currentUser.id,
                        pulse_count: 1
                    });

                if (error) throw error;
            }

            console.log('📈 Pulse count incrementado');

        } catch (error) {
            console.error('❌ Erro ao incrementar pulse count:', error);
        }
    }

    // 📊 Carregar contador de pulses
    async loadPulseCount() {
        try {
            const { data: pulseData, error } = await this.supabase
                .from('user_pulses')
                .select('pulse_count')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            const pulseCount = pulseData?.pulse_count || 0;
            this.updatePulseBadge(pulseCount);
            
            return pulseCount;

        } catch (error) {
            console.error('❌ Erro ao carregar pulse count:', error);
            return 0;
        }
    }

    // 🎯 Atualizar badge de pulses na UI
    updatePulseBadge(count) {
        // Remover badges existentes
        document.querySelectorAll('.pulse-badge').forEach(badge => badge.remove());
        
        if (count > 0) {
            // Adicionar badge no header (próximo ao sino de notificações)
            const notificationBell = document.getElementById('notificationBell');
            if (notificationBell) {
                const pulseBadge = document.createElement('span');
                pulseBadge.className = 'pulse-badge';
                pulseBadge.textContent = count;
                pulseBadge.style.cssText = `
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: linear-gradient(135deg, #ff6b6b, #ee5a52);
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid white;
                    z-index: 10;
                `;
                notificationBell.style.position = 'relative';
                notificationBell.appendChild(pulseBadge);
            }
        }
    }

    // 🎨 Atualizar UI do card
    updateCardUI(cardElement, isFavorite) {
        const favoriteBtn = cardElement.querySelector('.favorite-btn');
        if (favoriteBtn) {
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
    }

    // 🔍 Verificar se usuário está bloqueado
    async checkIfBlockedByUser(userId) {
        try {
            const { data: blocks, error } = await this.supabase
                .from('user_blocks')
                .select('blocker_id')
                .eq('blocker_id', userId)
                .eq('blocked_user_id', this.currentUser.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return false;
                throw error;
            }
            return !!blocks;
        } catch (error) {
            return false;
        }
    }

    // 🔔 Criar notificação de match mútuo
    async createMutualLikeNotification(targetUserId) {
        try {
            const { error } = await this.supabase
                .from('notifications')
                .insert({
                    user_id: targetUserId,
                    type: 'mutual_like',
                    title: '💝 Novo Match!',
                    message: `Você e ${this.currentUser.user_metadata?.nickname || 'alguém'} curtiram um ao outro!`,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
            
        } catch (error) {
            console.error('❌ Erro ao criar notificação:', error);
        }
    }

    // 📋 Buscar lista de favoritos do usuário
    async getUserFavorites() {
        try {
            const { data: favorites, error } = await this.supabase
                .from('user_favorites')
                .select(`
                    favorite_user_id,
                    profiles:user_favorites_favorite_user_id_fkey (
                        id, nickname, avatar_url, age, city, bio, is_premium
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return favorites || [];

        } catch (error) {
            console.error('❌ Erro ao buscar favoritos:', error);
            return [];
        }
    }

    // 🔄 Verificar se usuário é favorito
    async isUserFavorite(userId) {
        try {
            const { data: favorite, error } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return false;
                throw error;
            }

            return !!favorite;

        } catch (error) {
            console.error('❌ Erro ao verificar favorito:', error);
            return false;
        }
    }
}

// ==================== INICIALIZAÇÃO NO SISTEMA EXISTENTE ====================

// Adicionar ao initializeSeparatedSystems()
async function initializeSeparatedSystems() {
    try {
        // ... sistemas existentes ...
        
        // 5. Sistema de Favoritos (NOVO)
        if (window.FavoriteSystem) {
            window.favoriteSystem = new FavoriteSystem(supabase, currentUser);
            await window.favoriteSystem.initialize();
            console.log('✅ Sistema de favoritos inicializado!');
        }
        
    } catch (error) {
        console.error('❌ Erro ao inicializar sistemas:', error);
    }
}

// ==================== FUNÇÕES GLOBAIS ====================
window.toggleFavorite = function(userId, event) {
    if (event) event.stopPropagation();
    
    if (window.favoriteSystem) {
        const cardElement = event ? event.target.closest('.user-card') : null;
        window.favoriteSystem.toggleFavorite(userId, cardElement);
    } else {
        showQuickToast('⚠️ Sistema de favoritos não carregado');
    }
};

// Função para ir para a Lista VIP
window.goToVipList = function() {
    if (window.favoriteSystem && window.favoriteSystem.isPremium) {
        window.location.href = 'lista-vip.html';
    } else {
        showQuickToast('⭐ Torne-se Premium para acessar a Lista VIP!');
        window.location.href = 'princing.html';
    }
};

console.log('✅ home-favoritos.js carregado!');